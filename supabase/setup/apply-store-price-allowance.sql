begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('electronics-catalogue-import',0));
lock table public.products, public.product_variants in share row exclusive mode;

do $$
declare
  price_changes jsonb;
  batch_key constant text := 'coastline-price-allowance-5-percent-v1';
begin
  if exists (select 1 from public.catalogue_imports where checksum = batch_key) then
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
    'variant_id', v.id, 'before_cents', v.price_cents,
    'after_cents', round(v.price_cents::numeric * 1.05)::integer
  ) order by v.id)
  into price_changes
  from public.storefront_catalogue() as product(document)
  cross join lateral jsonb_array_elements(product.document->'variants') as offer(document)
  join public.product_variants v on v.id = (offer.document->>'id')::uuid
  where jsonb_typeof(offer.document->'price_cents') = 'number';

  if price_changes is null then
    raise exception 'No published variants with visible prices were found';
  end if;

  update public.product_variants v
  set price_cents = change.after_cents
  from jsonb_to_recordset(price_changes) as change(variant_id uuid, after_cents integer)
  where v.id = change.variant_id;

  insert into public.catalogue_imports(checksum, actor, result)
  values (batch_key, auth.uid(), jsonb_build_object('price_changes', price_changes));
end
$$;
commit;

select jsonb_array_length(result->'price_changes') as adjusted_variants,
       (select count(distinct v.product_id)
        from jsonb_to_recordset(result->'price_changes') as c(variant_id uuid)
        join public.product_variants v on v.id = c.variant_id) as adjusted_products
from public.catalogue_imports
where checksum = 'coastline-price-allowance-5-percent-v1';
