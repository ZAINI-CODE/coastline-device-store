begin;

create index if not exists order_items_product_order_idx
  on public.order_items (product_id, order_id);

-- Expose only whether a public product has reached the display threshold.
create or replace function public.has_recent_product_sales(p_product uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(sum(recent.quantity), 0) >= 12
  from (
    select i.quantity
    from public.products p
    join public.order_items i on i.product_id = p.id
    join public.orders o on o.id = i.order_id
    join public.payments pay on pay.order_id = o.id
    where p.id = p_product and p.published and not p.demo_only
      and o.payment_status = 'paid' and o.status <> 'cancelled' and not o.stock_released
      and pay.capture_id is not null
      and pay.verified_at > now() - interval '168 hours' and pay.verified_at <= now()
    limit 12
  ) recent;
$$;

revoke all on function public.has_recent_product_sales(uuid) from public;
grant execute on function public.has_recent_product_sales(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
