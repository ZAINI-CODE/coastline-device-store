begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('electronics-catalogue-import',0));

do $$
declare
  retired text[] := array[
    'ps5-original-disc','ps5-original-digital','ps5-slim-disc','ps5-slim-digital',
    'ps5-pro-2tb','dualsense-original-white','dualsense-midnight-black','dualsense-cosmic-red',
    'dualsense-edge','dualsense-charging-station','playstation-portal-white','ps5-media-remote',
    'apple-20w-usbc-adapter','apple-35w-dual-compact-adapter','apple-70w-usbc-adapter',
    'apple-40w-dynamic-adapter','apple-60w-usbc-cable-1m','apple-240w-usbc-cable-2m',
    'ryzen-7-9700x','ryzen-5-9600x','ryzen-9-9900x','ryzen-9-9950x','ryzen-7-9800x3d',
    'core-ultra-5-245k','core-ultra-7-265k','core-ultra-9-285k',
    'core-i5-14600k','core-i7-14700k','core-i9-14900k',
    'airpods-4','airpods-4-anc','airpods-pro-2-usbc','airpods-max-usbc'
  ];
begin
  if (select count(*) from public.products where catalogue_key = any(retired)) <> cardinality(retired) then
    raise exception 'Catalogue retirement keys differ from the approved inventory';
  end if;

  -- Keep product/variant IDs and inventory intact for historical orders.
  update public.products
  set published = false
  where catalogue_key = any(retired) and published;
end $$;

insert into public.products (
  category_id, name, brand, model, description, specifications, product_type,
  catalogue_key, keywords, demo_only, published, verification_source, verified_at
)
select id, 'Apple AirPods Max 2', 'Apple', 'AirPods Max 2',
  'Apple over-ear headphones with Active Noise Cancellation and USB-C charging.',
  '{"Chip":"Apple H2","Design":"Over-ear headphones","Noise control":"Active Noise Cancellation and Transparency mode","Charging connection":"USB-C"}'::jsonb,
  'Over-ear headphones', 'airpods-max-2', array['airpods-max-2'], true, false,
  'https://www.apple.com/airpods-max/specs/', '2026-11-09T00:00:00Z'
from public.categories where name = 'Apple Products and Headphones'
on conflict (catalogue_key) where catalogue_key is not null do nothing;

do $$
begin
  if not exists (select 1 from public.products where catalogue_key = 'airpods-max-2'
    and name = 'Apple AirPods Max 2' and brand = 'Apple' and category_id is not null) then
    raise exception 'AirPods Max 2 draft could not be reconciled';
  end if;
end $$;

commit;
