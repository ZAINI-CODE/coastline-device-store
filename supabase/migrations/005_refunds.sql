begin;
create table public.refunds(id uuid primary key default gen_random_uuid(),order_id uuid not null unique references orders,requested_by uuid not null references auth.users,amount_cents integer not null check(amount_cents>0),currency text not null check(currency='USD'),provider_refund_id text unique,status text not null default 'processing' check(status in ('processing','pending','completed')),bank_reference text,created_at timestamptz default now(),completed_at timestamptz);
alter table refunds enable row level security;
revoke all on refunds from anon,authenticated;
grant select on refunds to authenticated;
grant all on refunds to service_role;
create policy read_own_refunds on refunds for select to authenticated using(exists(select 1 from orders where id=order_id and (user_id=auth.uid() or is_admin())));
create function public.request_full_refund(p_id uuid,p_bank_reference text default null) returns uuid language plpgsql security definer set search_path=public as $$declare o orders;r refunds;begin
 if not is_admin() then raise exception 'Admin MFA required';end if;
 select * into o from orders where id=p_id for update;if not found or o.payment_status not in ('paid','refunded') then raise exception 'Verified payment required';end if;
 select * into r from refunds where order_id=p_id;if found then return r.id;end if;
 if o.method='zelle' and coalesce(length(p_bank_reference),0)<5 then raise exception 'Actual bank refund reference required';end if;
 insert into refunds(order_id,requested_by,amount_cents,currency,bank_reference,status,completed_at) values(o.id,auth.uid(),o.total_cents,o.currency,case when o.method='zelle' then p_bank_reference else null end,case when o.method='zelle' then 'completed' else 'processing' end,case when o.method='zelle' then now() else null end) returning id into r.id;
 if o.method='zelle' then update orders set payment_status='refunded' where id=p_id;end if;
 insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),'full_refund_requested',p_id::text);return r.id;end$$;
create function public.finish_paypal_refund(p_refund uuid,p_provider_id text,p_amount integer,p_currency text,p_completed boolean) returns void language plpgsql security definer set search_path=public as $$declare r refunds;begin
 select * into r from refunds where id=p_refund for update;if not found or r.amount_cents<>p_amount or r.currency<>p_currency then raise exception 'Refund mismatch';end if;
 if r.status='completed' then if r.provider_refund_id=p_provider_id then return;else raise exception 'Refund identity mismatch';end if;end if;
 update refunds set provider_refund_id=p_provider_id,status=case when p_completed then 'completed' else 'pending' end,completed_at=case when p_completed then now() else null end where id=p_refund;
 if p_completed then update orders set payment_status='refunded' where id=r.order_id;end if;
 insert into admin_audit_logs(actor,action,record_id) values(r.requested_by,'paypal_refund_'||case when p_completed then 'completed' else 'pending' end,r.order_id::text);
end$$;
revoke execute on function request_full_refund(uuid,text),finish_paypal_refund(uuid,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function request_full_refund(uuid,text) to authenticated;
grant execute on function finish_paypal_refund(uuid,text,integer,text,boolean) to service_role;
create trigger refund_audit after insert or update on refunds for each row execute function audit_change();
commit;
