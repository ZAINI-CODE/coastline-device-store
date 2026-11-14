begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('coastline-holiday-2026',0));

-- One campaign, one rate per product. Existing approved prices and stock are preserved.
insert into public.promotions
  (id,name,kind,minimum_quantity,percent_basis_points,discount_cents,starts_at,ends_at,active)
values
  ('cc202611-1111-4111-8111-000000000001','Holiday offers - through January 1','quantity',1,0,0,
   '2026-11-11 00:00:00 America/New_York','2027-01-02 00:00:00 America/New_York',true)
on conflict (id) do update set name=excluded.name,kind=excluded.kind,minimum_quantity=excluded.minimum_quantity,
  percent_basis_points=excluded.percent_basis_points,discount_cents=excluded.discount_cents,
  starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active;

insert into public.promotion_products(promotion_id,product_id,percent_basis_points,display_style)
select 'cc202611-1111-4111-8111-000000000001',p.id,
  case when c.name='Apple iPhones' then 1500 when c.name='Gaming PCs' then 1000 else 1200 end,
  case when p.catalogue_key in ('iphone-16','iphone-17','acer-nitro-85-n85-100-ur35') then 'daily'
       when c.name='Gaming PCs' then 'early' else 'standard' end
from public.products p join public.categories c on c.id=p.category_id
where p.published and not p.demo_only
  and (c.name in ('Apple iPhones','Gaming PCs') or (c.name='Apple Products and Headphones' and p.name ~* '^Apple AirPods'))
on conflict (promotion_id,product_id) do update
  set percent_basis_points=excluded.percent_basis_points,display_style=excluded.display_style;

select p.name,pp.percent_basis_points/100.0 as discount_percent,pp.display_style,
       pr.starts_at,pr.ends_at
from public.promotion_products pp join public.products p on p.id=pp.product_id
join public.promotions pr on pr.id=pp.promotion_id
where pr.id='cc202611-1111-4111-8111-000000000001' order by p.name;
commit;
