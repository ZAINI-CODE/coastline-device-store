begin;
create function public.admin_store_summary() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Admin MFA required';end if;
 return jsonb_build_object(
  'orders',(select count(*) from orders),
  'pending_payments',(select count(*) from orders where payment_status in ('pending','processing')),
  'paid_orders',(select count(*) from orders where payment_status='paid'),
  'processing',(select count(*) from orders where status='processing'),
  'shipped',(select count(*) from orders where status='shipped'),
  'delivered',(select count(*) from orders where status='delivered'),
  'cancelled',(select count(*) from orders where status='cancelled'),
  'products',(select count(*) from products),
  'published_products',(select count(*) from products where published),
  'available_units',(select coalesce(sum(quantity),0) from inventory),
  'captured_cents',(select coalesce(sum(total_cents),0) from orders where payment_status in ('paid','refunded','partially_refunded')),
  'refunded_cents',(select coalesce(sum(amount_cents),0) from refunds where status='completed'),
  'pending_reviews',(select count(*) from reviews where not approved),
  'open_messages',(select count(*) from contact_messages where not handled),
  'reconciliation_alerts',(select count(*) from admin_audit_logs where outcome='attention_required')
 );
end$$;
revoke execute on function admin_store_summary() from public,anon;
grant execute on function admin_store_summary() to authenticated;
commit;
