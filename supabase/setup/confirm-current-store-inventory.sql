begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('confirm-current-store-inventory',0));

-- Workbook selling prices in USD cents. Inventory quantities are deliberately absent.
create temporary table confirmed_workbook_prices (
  product_key text, configuration text, cents integer not null, configuration_verified boolean not null
) on commit drop;
insert into confirmed_workbook_prices values
  ('iphone-16', '128GB', 62900, true),
  ('iphone-16', '256GB', 72900, true),
  ('iphone-16-plus', null, 69900, false),
  ('iphone-16-pro', null, 79900, false),
  ('iphone-16-pro-max', null, 99900, false),
  ('iphone-16e', null, 39900, false),
  ('iphone-17', '256GB', 72900, true),
  ('iphone-17', '512GB', 92900, true),
  ('iphone-17-pro', null, 89900, false),
  ('iphone-17-pro-max', null, 99900, false),
  ('iphone-17e', '256GB', 49900, true),
  ('iphone-17e', '512GB', 69900, true),
  ('iphone-air', '256GB', 89900, true),
  ('iphone-air', '512GB', 109900, true),
  ('iphone-air', '1TB', 149900, true),
  ('iphone-18-pro', '256GB', 99900, true),
  ('iphone-18-pro', '512GB', 119900, true),
  ('iphone-18-pro', '1TB', 159900, true),
  ('iphone-18-pro', '2TB', 219900, true),
  ('iphone-18-pro-max', '256GB', 109900, false),
  ('iphone-18-pro-max', '512GB', 129900, false),
  ('iphone-18-pro-max', '1TB', 169900, false),
  ('iphone-18-pro-max', '2TB', 229900, false),
  ('iphone-duo', '256GB', 179900, true),
  ('iphone-duo', '512GB', 199900, true),
  ('iphone-duo', '1TB', 239900, true),
  ('iphone-duo', '2TB', 299900, true),
  ('airpods-pro-3', null, 24900, true),
  ('corsair-vengeance-a7500-cs-9050121-na', null, 329999, true),
  ('cyberpowerpc-et99707', null, 206900, true),
  ('ibuypower-ryzen-5-9500f', null, 147900, false),
  ('acer-nitro-85-n85-100-ur35', null, 199999, true),
  ('lenovo-legion-tower-5-gen-10-rtx-5070-ti', null, 284999, true);

-- Stop if this project does not match the reviewed catalogue and inventory.
do $$
begin
  if exists (
    select 1 from confirmed_workbook_prices w
    where not exists (
      select 1 from public.products p join public.product_variants v on v.product_id=p.id
      where p.published and p.catalogue_key=w.product_key and v.catalogue_visible
        and (w.configuration is null or w.configuration=v.configuration)
    )
  ) or exists (
    select 1 from public.products p join public.product_variants v on v.product_id=p.id
    left join public.inventory i on i.variant_id=v.id
    left join confirmed_workbook_prices w on w.product_key=p.catalogue_key
      and (w.configuration is null or w.configuration=v.configuration)
    where p.published and v.catalogue_visible and
      ((p.catalogue_key <> 'airpods-5' and (w.cents is null or w.cents <> v.price_cents)) or i.variant_id is null)
  ) then
    raise exception 'Catalogue differs from the reviewed workbook or inventory';
  end if;
end
$$;

select set_config('store.inventory_reason','Owner confirmed existing quantities',true);
update public.inventory i set provisional=false
from public.product_variants v join public.products p on p.id=v.product_id
where v.id=i.variant_id and p.published and v.catalogue_visible and i.provisional
  and (p.catalogue_key='airpods-5' or exists (
    select 1 from confirmed_workbook_prices w where w.product_key=p.catalogue_key
  ));

update public.products p
set price_label='Store selling price',
    demo_only=not w.configuration_verified,
    catalogue_note=case when w.configuration_verified then null
      else 'Workbook price confirmed. Exact stocked configuration still needs confirmation.' end
from (select distinct product_key,configuration_verified from confirmed_workbook_prices) w
where p.published and p.catalogue_key=w.product_key;

update public.product_variants v
set active=w.configuration_verified,
    price_source='Owner-confirmed Excel catalogue',
    price_verified_at=coalesce(v.price_verified_at,now())
from public.products p join confirmed_workbook_prices w on w.product_key=p.catalogue_key
where p.id=v.product_id and p.published and v.catalogue_visible
  and (w.configuration is null or w.configuration=v.configuration)
  and (not w.configuration_verified or v.image_path is null
    or (v.image_permission='approved' and v.image_verified_at is not null));
commit;
