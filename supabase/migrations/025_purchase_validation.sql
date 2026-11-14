begin;
set local lock_timeout='5s';
-- Additional guards; no replacement checkout and no existing row changes.
create or replace function public.guard_order_address() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare field text;begin
 foreach field in array array['full_name','line1','city','state','postal_code','country'] loop
  if jsonb_typeof(new.shipping_address->field) is distinct from 'string' or
   length(trim(coalesce(new.shipping_address->>field,'')))=0 then raise exception 'Complete shipping address required';end if;
 end loop;
 if length(new.shipping_address->>'full_name')>100 or length(new.shipping_address->>'line1')>200 or
 length(new.shipping_address->>'city')>100 or new.shipping_address->>'country'<>'US' or
 new.shipping_address->>'state' !~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$' or
 new.shipping_address->>'postal_code' !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'Invalid US shipping address';end if;
 return new;
end$$;
create or replace function public.guard_order_item_readiness() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$begin
 if not exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id
 join public.inventory i on i.variant_id=v.id where v.id=new.variant_id and p.id=new.product_id
 and p.published and not p.demo_only and v.active and i.provisional is false and v.price_cents>0
 and new.unit_price_cents=v.price_cents and length(trim(v.sku))>0
 and length(trim(coalesce(v.price_source,'')))>0 and v.price_verified_at is not null
 and length(trim(coalesce(v.configuration,'')))>0 and v.configuration !~* '(pending|unknown|to confirm)'
 and coalesce(v.color,'') !~* '(pending|unknown|to confirm)')
 then raise exception 'Product purchasing information incomplete';end if;
 return new;
end$$;
revoke all on function public.guard_order_address(),public.guard_order_item_readiness() from public,anon,authenticated;
drop trigger if exists store_order_address_guard on public.orders;
create trigger store_order_address_guard before insert on public.orders for each row execute function public.guard_order_address();
drop trigger if exists store_order_item_readiness_guard on public.order_items;
create trigger store_order_item_readiness_guard before insert on public.order_items for each row execute function public.guard_order_item_readiness();
commit;
