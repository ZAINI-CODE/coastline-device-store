begin;
set local lock_timeout='5s';
-- A fixed PC configuration does not require an optional exterior-colour label.
-- Keep all SKU, pricing, inventory and configuration checks in place.
create or replace function public.store_variant_ready(p_variant uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.product_variants v
 join public.products p on p.id=v.product_id
 left join public.categories c on c.id=p.category_id
 join public.inventory i on i.variant_id=v.id
 where v.id=p_variant and p.published and not p.demo_only and v.active
 and i.provisional is false and v.price_cents>0 and length(trim(v.sku))>0
 and nullif(trim(v.price_source),'') is not null and v.price_verified_at is not null
 and nullif(trim(v.configuration),'') is not null and v.configuration !~* '(pending|unknown|to confirm)'
 and (coalesce(v.color,'') !~* '(pending|unknown|to confirm)' or
   (c.name='Gaming PCs' and not exists(select 1 from public.product_variants other
     where other.product_id=p.id and other.active and other.id<>v.id
       and coalesce(other.color,'') is distinct from coalesce(v.color,''))))
 and (v.image_path is null or (v.image_permission='approved' and v.image_verified_at is not null)))
$$;
create or replace function public.guard_order_item_readiness() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$begin
 if not public.store_variant_ready(new.variant_id) or not exists(
   select 1 from public.product_variants v where v.id=new.variant_id
   and v.product_id=new.product_id and v.price_cents=new.unit_price_cents
 ) then raise exception 'Product configuration unavailable for purchase. Please contact support.';end if;
 return new;
end$$;
revoke all on function public.store_variant_ready(uuid),public.guard_order_item_readiness() from public,anon,authenticated;
-- Update only the reviewed readiness clause in the existing public projection.
-- Abort rather than overwrite an unfamiliar hosted definition.
do $projection$
declare definition text;clause text;normalized text;
begin
 definition:=pg_get_functiondef('public.storefront_catalogue()'::regprocedure);
 if position('select public.store_variant_ready(x.id) as approved' in definition)>0 then return;end if;
 clause:=substring(definition from '(?s)select not p\.demo_only and x\.active.*? as approved');
 normalized:=trim(regexp_replace(clause,'[[:space:]]+',' ','g'));
 if normalized is distinct from 'select not p.demo_only and x.active and (x.image_path is null or (x.image_permission = ''approved'' and x.image_verified_at is not null)) and nullif(trim(x.price_source), '''') is not null and x.price_verified_at is not null as approved' then
 raise exception 'Storefront readiness differs from reviewed source; inspect before applying';end if;
 execute replace(definition,clause,'select public.store_variant_ready(x.id) as approved');
end $projection$;
notify pgrst,'reload schema';
commit;
