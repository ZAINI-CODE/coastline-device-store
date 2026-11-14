begin;
-- Replayed captures must never undo a refund or restore a cancelled order.
create or replace function public.confirm_payment(p_id uuid,p_capture text,p_amount integer,p_currency text,p_actor uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders; existing_capture text;
begin
  select * into o from orders where id=p_id for update;
  if not found or p_amount is null or p_currency is null or coalesce(length(p_capture),0)<1
     or o.total_cents<>p_amount or o.currency<>p_currency then
    raise exception 'Payment mismatch';
  end if;
  select capture_id into existing_capture from payments where order_id=p_id;
  if o.payment_status in ('paid','refunded','partially_refunded') then
    if existing_capture=p_capture then return; end if;
    raise exception 'Duplicate payment mismatch';
  end if;
  if o.stock_released or o.payment_status='cancelled' then
    raise exception 'Reservation released: manual reconciliation required';
  end if;
  if existing_capture is not null and existing_capture<>p_capture then raise exception 'Capture identity mismatch';end if;
  update payments set capture_id=p_capture,verified_by=p_actor,verified_at=now() where order_id=p_id;
  if not found then raise exception 'Missing payment record';end if;
  update orders set payment_status='paid',status='payment_verified' where id=p_id;
  insert into admin_audit_logs(actor,action,record_id) values(p_actor,'payment_verified',p_id::text);
end$$;

create or replace function public.release_order(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  select * into o from orders where id=p_id for update;
  -- Recheck after locking: a concurrent capture may have begun since expiry selection.
  if not found or o.stock_released or o.payment_status not in ('pending','failed','cancelled') then return;end if;
  update inventory i set quantity=i.quantity+x.quantity from order_items x where x.order_id=p_id and x.variant_id=i.variant_id;
  update orders set stock_released=true,status='cancelled',payment_status='cancelled' where id=p_id;
end$$;

create or replace function public.admin_order(p_id uuid,p_action text,p_value text default '',p_carrier text default '')
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not is_admin() then raise exception 'Admin MFA required';end if;
  select * into o from orders where id=p_id for update;
  if not found then raise exception 'Order not found';end if;
  if p_action='verify_zelle' then
    if o.method<>'zelle' or coalesce(length(trim(p_value)),0)<5 then raise exception 'Bank receipt reference required';end if;
    perform confirm_payment(p_id,'zelle:'||trim(p_value),o.total_cents,o.currency,auth.uid());
  elsif p_action='cancel' then
    if o.payment_status not in ('pending','failed','cancelled') then raise exception 'Reconcile payment or refund before cancellation';end if;
    perform release_order(p_id);
  elsif p_action in ('processing','shipped','delivered') then
    if o.payment_status<>'paid'
       or (p_action='processing' and o.status<>'payment_verified')
       or (p_action='shipped' and (o.status<>'processing' or coalesce(length(trim(p_value)),0)<3 or coalesce(length(trim(p_carrier)),0)<2))
       or (p_action='delivered' and o.status<>'shipped') then raise exception 'Invalid order transition';end if;
    update orders set status=p_action,
      tracking_number=case when p_action='shipped' then trim(p_value) else tracking_number end,
      carrier=case when p_action='shipped' then trim(p_carrier) else carrier end where id=p_id;
  else raise exception 'Unsupported action';end if;
  insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),p_action,p_id::text);
end$$;
revoke execute on function confirm_payment(uuid,text,integer,text,uuid),release_order(uuid),admin_order(uuid,text,text,text) from public,anon,authenticated;
grant execute on function confirm_payment(uuid,text,integer,text,uuid),release_order(uuid) to service_role;
grant execute on function admin_order(uuid,text,text,text) to authenticated;
create trigger launch_settings_audit after update on store_settings for each row execute function audit_change();
commit;
