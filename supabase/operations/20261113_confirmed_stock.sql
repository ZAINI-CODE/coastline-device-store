-- Owner confirmed 5 available units each on 13 November 2026.
-- Targeted data correction only. Does not activate incomplete variants.
begin;
set local lock_timeout='5s';
do $$declare n integer;begin
 perform 1 from public.inventory where variant_id in
 ('1a4e671b-126b-84e5-8c7a-b939968daada','c61021a4-ce8e-8ac4-a0d1-227b89e98650') order by variant_id for update;
 select count(*) into n from public.inventory i join public.product_variants v on v.id=i.variant_id
 where (v.id='1a4e671b-126b-84e5-8c7a-b939968daada' and v.product_id='26408392-8c5e-8406-8878-419fa9f8d361' and v.price_cents=12900
 or v.id='c61021a4-ce8e-8ac4-a0d1-227b89e98650' and v.product_id='997fac76-b60c-82e7-84a1-00cd7164cff2' and v.price_cents=89900)
 and i.quantity in (5,15);
 if n<>2 then raise exception 'Stock or product changed; inspect before updating';end if;
 if exists(select 1 from public.order_items x join public.orders o on o.id=x.order_id
 where x.variant_id in ('1a4e671b-126b-84e5-8c7a-b939968daada','c61021a4-ce8e-8ac4-a0d1-227b89e98650')
 and not o.stock_released and o.status not in ('delivered','cancelled','refunded'))
 then raise exception 'An order reserves stock; reconcile before updating';end if;
 perform set_config('store.inventory_reason','Owner confirmed five available units per model, 2026-11-13; existing price and purchase blocks preserved',true);
 update public.inventory set quantity=5,provisional=false where variant_id in
 ('1a4e671b-126b-84e5-8c7a-b939968daada','c61021a4-ce8e-8ac4-a0d1-227b89e98650') and (quantity<>5 or provisional);
end$$;
select p.name,i.quantity,i.provisional,v.price_cents,v.active,p.demo_only
from public.products p join public.product_variants v on v.product_id=p.id join public.inventory i on i.variant_id=v.id
where v.id in ('1a4e671b-126b-84e5-8c7a-b939968daada','c61021a4-ce8e-8ac4-a0d1-227b89e98650');
commit;
