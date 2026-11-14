-- Owner-approved product completion; prices, unrelated records and schema preserved.
begin;
set local lock_timeout='5s';
do $$
declare
 pids uuid[]:=array['26408392-8c5e-8406-8878-419fa9f8d361','32a6c65f-f173-4157-b2c2-231078c057d9','997fac76-b60c-82e7-84a1-00cd7164cff2']::uuid[];
 vids uuid[]:=array['1a4e671b-126b-84e5-8c7a-b939968daada','ddcd42c0-9ae9-42c2-9e9d-207ca2a4a2d9','46fa2a00-fee2-4629-be02-87379c28d7d3','19918074-f965-4212-90da-091b3d6f3d5b','9d06921f-d21d-4026-ab6a-2413dd7ace47','c61021a4-ce8e-8ac4-a0d1-227b89e98650']::uuid[];
 before_prices jsonb;n integer;
begin
 perform 1 from public.products where id=any(pids) order by id for update;
 perform 1 from public.product_variants where product_id=any(pids) order by id for update;
 perform 1 from public.inventory where variant_id=any(vids) order by variant_id for update;
 select count(*),jsonb_object_agg(v.id::text,v.price_cents) into n,before_prices from public.product_variants v
 where v.id=any(vids) and v.product_id=any(pids) and length(trim(v.sku))>0 and v.currency='USD'
 and v.image_path is not null and v.image_permission='approved' and v.image_verified_at is not null
 and length(trim(v.price_source))>0 and v.price_verified_at is not null
 and ((v.product_id=pids[1] and v.price_cents=12900) or (v.product_id=pids[2] and v.price_cents=51975) or (v.product_id=pids[3] and v.price_cents=89900));
 if n<>6 or (select count(*) from public.product_variants where product_id=any(pids))<>6 then raise exception 'Product identity, prices or readiness changed; inspect first';end if;
 if exists(select 1 from public.inventory where variant_id=any(vids) and quantity<>5) then raise exception 'Inventory changed; reconcile first';end if;
 if exists(select 1 from public.order_items x join public.orders o on o.id=x.order_id where x.variant_id=any(vids) and not o.stock_released and o.status not in ('delivered','cancelled','refunded')) then raise exception 'Open orders reserve stock; reconcile first';end if;
 perform set_config('store.inventory_reason','Owner confirmed five units per specified variant and final configurations on 2026-11-13; Max 2 total twenty units',true);
 insert into public.inventory(variant_id,quantity,provisional) select unnest(vids),5,false
 on conflict(variant_id) do update set quantity=excluded.quantity,provisional=false
 where inventory.quantity is distinct from excluded.quantity or inventory.provisional;
 update public.product_variants set configuration='USB-C Charging Case' where id=vids[1] and configuration is distinct from 'USB-C Charging Case';
 update public.products set specifications=jsonb_set(specifications,'{Configuration}','"USB-C Charging Case"'::jsonb,true) where id=pids[1] and specifications->>'Configuration' is distinct from 'USB-C Charging Case';
 update public.product_variants set color='White',configuration='Standard Configuration' where id=vids[6] and (color is distinct from 'White' or configuration is distinct from 'Standard Configuration');
 update public.product_variants set active=true where id=any(vids) and not active;
 update public.products set demo_only=false where id=any(pids) and demo_only;
 if before_prices is distinct from (select jsonb_object_agg(id::text,price_cents) from public.product_variants where id=any(vids)) then raise exception 'Price preservation failed';end if;
 if (select sum(quantity) from public.inventory where variant_id=any(vids[2:5]))<>20 then raise exception 'Max 2 allocation failed';end if;
end$$;
select p.name,v.color,v.configuration,i.quantity,v.price_cents,v.active,p.demo_only
from public.products p join public.product_variants v on v.product_id=p.id join public.inventory i on i.variant_id=v.id
where p.id in ('26408392-8c5e-8406-8878-419fa9f8d361','32a6c65f-f173-4157-b2c2-231078c057d9','997fac76-b60c-82e7-84a1-00cd7164cff2') order by p.name,v.color;
commit;
