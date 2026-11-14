begin;
-- A lease serializes outbound mutations. Ambiguous captures are reconciled by
-- GET only; expiry alone never releases stock while capture may still succeed.
create table if not exists public.payment_operations(
 order_id uuid not null references public.orders(id),kind text not null check(kind in ('create','capture','refund')),
 token uuid not null,lease_until timestamptz not null,attempts integer not null default 1,
 completed boolean not null default false,created_at timestamptz not null default now(),primary key(order_id,kind)
);
alter table public.payment_operations enable row level security;
revoke all on public.payment_operations from public,anon,authenticated;
grant select on public.payment_operations to authenticated;
grant all on public.payment_operations to service_role;
do $$begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='payment_operations' and policyname='admin_payment_operations') then create policy admin_payment_operations on public.payment_operations for select to authenticated using(public.is_admin());end if;
end$$;
create or replace function public.claim_payment_operation(p_order uuid,p_kind text,p_token uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$declare op public.payment_operations;begin
 if p_token is null or p_kind not in ('create','capture','refund') then raise exception 'Invalid payment operation';end if;
 perform 1 from public.orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 select * into op from public.payment_operations where order_id=p_order and kind=p_kind for update;
 if found then
  if not op.completed and op.lease_until>now() then return jsonb_build_object('claimed',false);end if;
  update public.payment_operations set token=p_token,lease_until=now()+interval '120 seconds',attempts=attempts+1,completed=false where order_id=p_order and kind=p_kind;
  return jsonb_build_object('claimed',true,'recovery_only',p_kind='capture','attempt',op.attempts+1);
 end if;
 insert into public.payment_operations(order_id,kind,token,lease_until) values(p_order,p_kind,p_token,now()+interval '120 seconds');
 return jsonb_build_object('claimed',true,'recovery_only',false,'attempt',1);
end$$;
create or replace function public.finish_payment_operation(p_order uuid,p_kind text,p_token uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$begin
 update public.payment_operations set completed=true,lease_until=now() where order_id=p_order and kind=p_kind and token=p_token;
 if not found then raise exception 'Payment operation lease changed';end if;
end$$;
revoke execute on function public.claim_payment_operation(uuid,text,uuid),public.finish_payment_operation(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_operation(uuid,text,uuid),public.finish_payment_operation(uuid,text,uuid) to service_role;

-- Record a verified event and its reconciliation alert in one transaction.
create or replace function public.record_paypal_webhook_event(p_event_id text,p_event_type text,p_resource_id text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into public.webhook_events(id) values(p_event_id) on conflict(id) do nothing;
 if found and p_event_type in ('PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.CAPTURE.DENIED','PAYMENT.CAPTURE.PENDING') then
  insert into public.admin_audit_logs(action,record_id,outcome)
  values('paypal_reconciliation_required:'||p_event_type,p_resource_id,'attention_required');
 end if;
end$$;
revoke execute on function public.record_paypal_webhook_event(text,text,text) from public,anon,authenticated;
grant execute on function public.record_paypal_webhook_event(text,text,text) to service_role;
commit;
