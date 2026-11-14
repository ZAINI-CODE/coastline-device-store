begin;
set local lock_timeout = '5s';

-- An exact, priced configuration can be sold while its photo is being sourced.
-- If an active variant has a photo, it still requires approval and verification.
alter table public.product_variants
  drop constraint product_variants_check,
  add constraint product_variants_photo_approval
    check (not active or image_path is null or
      (image_permission is not distinct from 'approved' and image_verified_at is not null));

create or replace function public.storefront_catalogue() returns setof jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'brand', p.brand, 'model', p.model,
    'category', c.name, 'product_type', p.product_type, 'description',
    case p.catalogue_key
      when 'airpods-5' then 'Apple wireless earbuds with an open-fit design.'
      when 'iphone-17e' then 'Explore storage and finish options for the iPhone 17e.'
      when 'iphone-air' then 'Explore storage and finish options for the iPhone Air.'
      when 'iphone-duo' then 'Explore storage and finish options for the foldable iPhone Duo.'
      else p.description
    end,
    'verification_source', case when p.catalogue_key like 'iphone-%' then p.verification_source end,
    'keywords', p.keywords, 'featured', p.featured, 'created_at', p.created_at,
    'specifications', p.specifications - array['Verification', 'Supplied pending checks', 'Other Details'],
    'review_count', coalesce(r.count, 0), 'rating', r.rating,
    'variants', v.options
  )
  from public.products p
  left join public.categories c on c.id = p.category_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'color', x.color,
      'configuration', case when x.configuration !~* '(pending|unknown|to confirm)' then x.configuration end,
      'compatible_product_ids', x.compatible_product_ids,
      'specifications', x.specifications - array['SKU origin', 'Price note', 'Verification'],
      'price_cents', case when readiness.approved or p.price_label = 'Store selling price' then x.price_cents end,
      'active', readiness.approved and i.provisional is false,
      'stock', case when i.provisional is false and (readiness.approved or p.catalogue_key is not null) then i.quantity end,
      'image_path', case when x.image_permission = 'approved' and x.image_verified_at is not null then x.image_path end,
      'gallery_paths', case when x.image_permission = 'approved' and x.image_verified_at is not null then x.gallery_paths else '{}'::text[] end
    ) || case when readiness.approved and i.provisional is false then jsonb_build_object('sku',x.sku) else '{}'::jsonb end
      order by x.price_cents, x.configuration, x.color, x.id) as options
    from public.product_variants x
    left join public.inventory i on i.variant_id = x.id
    cross join lateral (
      select not p.demo_only and x.active and (x.image_path is null
        or (x.image_permission = 'approved' and x.image_verified_at is not null))
        and nullif(trim(x.price_source), '') is not null and x.price_verified_at is not null as approved
    ) readiness
    where x.product_id = p.id and (x.active or x.catalogue_visible)
  ) v
  cross join lateral (
    select count(*) as count, avg(rating) as rating from public.reviews
    where product_id = p.id and approved
  ) r
  where p.published and v.options is not null
  order by p.id
$$;

revoke all on function public.storefront_catalogue() from public;
grant execute on function public.storefront_catalogue() to anon, authenticated;

notify pgrst, 'reload schema';
commit;
