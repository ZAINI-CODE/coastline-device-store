begin;
set local lock_timeout='5s';
-- Additive: existing customer isolation, MFA, price calculation and payment
-- confirmation functions remain unchanged. This migration does not open checkout.
alter table public.store_settings add column if not exists zelle_enabled boolean not null default false;
alter table public.store_settings add column if not exists paypal_enabled boolean not null default false;
alter table public.payments add column if not exists zelle_instructions_at timestamptz;
alter table public.payments add column if not exists zelle_submitted_at timestamptz;
alter table public.payments add column if not exists zelle_reference_key text;
alter table public.payments add column if not exists zelle_evidence_path text;
create unique index if not exists payments_zelle_reference_unique on public.payments(zelle_reference_key) where zelle_reference_key is not null;

create or replace function public.guard_payment_method() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not exists(select 1 from store_settings where id and
   ((new.method='zelle' and zelle_enabled) or (new.method='paypal' and paypal_enabled))) then
   raise exception 'Payment method unavailable';
 end if;
 return new;
end$$;
do $$begin
 if not exists(select 1 from pg_trigger where tgname='store_payment_method_guard' and tgrelid='public.orders'::regclass) then
 create trigger store_payment_method_guard before insert on public.orders for each row execute function public.guard_payment_method();
 end if;
end$$;

-- Lock the same order row used by release_order/confirm_payment. Once payment
-- directions are issued, automatic expiry must not release stock while money
-- might be in transit. Payment remains UNPAID, awaiting bank verification.
create or replace function public.begin_zelle_payment(p_id uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$declare o orders;begin
 select * into o from orders where id=p_id and user_id=p_user for update;
 if not found or o.method<>'zelle' or o.stock_released or o.payment_status not in ('pending','processing') then raise exception 'Zelle order unavailable';end if;
 if not exists(select 1 from store_settings where id and zelle_enabled) then raise exception 'Zelle unavailable';end if;
 if o.payment_status='pending' and o.expires_at<=now() then raise exception 'Reservation expired';end if;
 update payments set zelle_instructions_at=coalesce(zelle_instructions_at,now()) where order_id=o.id;
 if not found then raise exception 'Missing payment record';end if;
 update orders set payment_status='processing' where id=o.id and payment_status='pending';
 return jsonb_build_object('id',o.id,'total_cents',o.total_cents,'currency',o.currency,'status','payment_pending');
end$$;

create or replace function public.submit_zelle_payment(p_id uuid,p_user uuid,p_reference text,p_evidence text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$declare o orders;pay payments;ref text:=trim(p_reference);begin
 select * into o from orders where id=p_id and user_id=p_user for update;
 if not found or o.method<>'zelle' or o.stock_released or o.payment_status<>'processing' then raise exception 'Zelle submission unavailable';end if;
 if ref is null or length(ref) not between 3 and 200 then raise exception 'Invalid payment reference';end if;
 select * into pay from payments where order_id=o.id for update;
 if pay.zelle_instructions_at is null or pay.verified_at is not null then raise exception 'Payment submission unavailable';end if;
 if pay.zelle_submitted_at is not null then
  if pay.reference=ref then return jsonb_build_object('status','payment_pending','submitted',true);end if;
  raise exception 'Reference already submitted; contact support for corrections';
 end if;
 if p_evidence is not null and (left(p_evidence,length(p_user::text||'/'||p_id::text||'/'))<>p_user::text||'/'||p_id::text||'/' or p_evidence ~ '\.\.' or p_evidence !~ '\.(png|jpg|webp)$') then raise exception 'Invalid screenshot path';end if;
 update payments set reference=ref,zelle_reference_key=lower(ref),zelle_evidence_path=p_evidence,zelle_submitted_at=now() where order_id=o.id;
 insert into admin_audit_logs(actor,action,record_id) values(p_user,'zelle_reference_submitted',o.id::text);
 return jsonb_build_object('status','payment_pending','submitted',true);
end$$;

-- Only MFA-authorized staff can release a Zelle hold, after checking with the
-- customer and bank that no payment was sent/received or remains unresolved.
create or replace function public.cancel_unreceived_zelle(p_id uuid,p_bank_check text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$declare o orders;begin
 if not is_admin() then raise exception 'Admin MFA required';end if;
 if coalesce(length(trim(p_bank_check)),0) not between 10 and 200 then raise exception 'Bank and customer reconciliation note required';end if;
 select * into o from orders where id=p_id for update;
 if not found or o.method<>'zelle' or o.payment_status not in ('pending','processing') or o.stock_released then raise exception 'Unpaid Zelle order required';end if;
 update orders set payment_status='pending' where id=o.id;
 perform release_order(o.id);
 insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),'zelle_cancel_bank_checked:'||trim(p_bank_check),o.id::text);
end$$;
revoke all on function public.guard_payment_method(),public.begin_zelle_payment(uuid,uuid),public.submit_zelle_payment(uuid,uuid,text,text),public.cancel_unreceived_zelle(uuid,text) from public,anon,authenticated;
grant execute on function public.begin_zelle_payment(uuid,uuid),public.submit_zelle_payment(uuid,uuid,text,text) to service_role;
grant execute on function public.cancel_unreceived_zelle(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
