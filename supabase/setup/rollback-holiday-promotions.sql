begin;
update public.promotions set active=false where id='cc202611-1111-4111-8111-000000000001';
create or replace function public.place_order(p_items jsonb,p_address jsonb,p_shipping uuid,p_method text,p_request uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare oid uuid; line record; sub bigint:=0; disc bigint:=0; ship integer; tax integer; rule shipping_rules; promo promotions; eligible bigint; candidate bigint; count_items integer; best_promo uuid; winning_eligible bigint; begin
 if auth.uid() is null then raise exception 'Sign in before checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from orders where user_id=auth.uid() and request_id=p_request;if found then return oid;end if;
 perform limit_request(auth.uid());
 if (select count(*) from orders where user_id=auth.uid() and not stock_released and payment_status in ('pending','processing')) >= (select max_open_reservations from store_settings where id=true) then raise exception 'Too many unpaid reservations; finish or cancel an existing order';end if;
 if p_method is null or p_items is null or p_method not in ('paypal','zelle') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 if length(p_address->>'full_name') not between 1 and 100 or length(p_address->>'line1') not between 1 and 200 or length(p_address->>'city') not between 1 and 100 or length(p_address->>'postal_code') not between 1 and 20 or p_address->>'country' is null or p_address->>'state' is null then raise exception 'Complete shipping address required';end if;
 select * into rule from shipping_rules where id=p_shipping and approved and country=p_address->>'country' and state=p_address->>'state';
 if not found or rule.tax_basis_points is null then raise exception 'Shipping or approved tax configuration unavailable';end if;
 if exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99 or variant_id is null) then raise exception 'Invalid quantities';end if;
 if (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid))<>jsonb_array_length(p_items) then raise exception 'Duplicate variants';end if;
 perform p.id from products p where p.id in (select v.product_id from product_variants v join jsonb_to_recordset(p_items) as x(variant_id uuid) on x.variant_id=v.id) order by p.id for share;
 for line in select v.*,i.quantity as stock,x.quantity as requested,p.name,p.published from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id join products p on p.id=v.product_id order by v.id for update of i,v loop
 if not line.active or not line.published or line.stock<line.requested then raise exception 'Product unavailable or insufficient inventory';end if;sub:=sub+line.price_cents::bigint*line.requested;end loop;
 select count(*) into count_items from jsonb_to_recordset(p_items) as x(variant_id uuid) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id;
 if count_items<>jsonb_array_length(p_items) then raise exception 'Unknown product';end if;
 for promo in select * from promotions where active and now() between starts_at and ends_at loop
 select coalesce(sum(v.price_cents::bigint*x.quantity),0) into eligible from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 if promo.kind='quantity' and (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id)<promo.minimum_quantity then continue;end if;
 if promo.kind='bundle' and (not exists(select 1 from promotion_products where promotion_id=promo.id) or exists(select 1 from promotion_products pp where pp.promotion_id=promo.id and not exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id where v.product_id=pp.product_id group by v.product_id having sum(x.quantity)>=promo.minimum_quantity))) then continue;end if;
 candidate:=least(eligible,case when promo.discount_cents>0 then promo.discount_cents else floor(eligible*promo.percent_basis_points/10000.0) end);if candidate>disc then disc:=candidate;best_promo:=promo.id;winning_eligible:=eligible;end if;end loop;
 ship:=case when rule.free_over_cents is not null and sub-disc>=rule.free_over_cents then 0 else rule.price_cents end;tax:=round((sub-disc+ship)*rule.tax_basis_points/10000.0);
 insert into orders(user_id,request_id,shipping_address,shipping_rule_id,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents) values(auth.uid(),p_request,p_address,p_shipping,p_method,sub,disc,ship,tax,sub-disc+ship+tax) returning id into oid;
 insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents) select oid,v.id,p.id,p.name,v.sku,v.color||' / '||v.configuration,x.quantity,v.price_cents from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join products p on p.id=v.product_id;
 if disc>0 then with allocations as (select oi.id, floor(sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)*disc/winning_eligible::numeric)-floor((sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)-oi.unit_price_cents::bigint*oi.quantity)*disc/winning_eligible::numeric) as amount from order_items oi where oi.order_id=oid and exists(select 1 from promotion_products pp where pp.promotion_id=best_promo and pp.product_id=oi.product_id)) update order_items oi set discount_cents=a.amount from allocations a where oi.id=a.id;end if;
 update inventory i set quantity=i.quantity-x.quantity from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where i.variant_id=x.variant_id;
 insert into payments(order_id) values(oid);return oid;
end$$;

commit;
