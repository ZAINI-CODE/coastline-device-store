begin;
set local lock_timeout='5s';
-- Extend the existing private outbox; no historical email backfill.
alter table public.order_email_outbox
 add column if not exists admin_recipient text,
 add column if not exists admin_next_attempt_at timestamptz not null default now(),
 add column if not exists admin_first_attempt_at timestamptz,
 add column if not exists admin_attempts integer not null default 0,
 add column if not exists admin_lease_token uuid,
 add column if not exists admin_provider_id text,
 add column if not exists admin_sent_at timestamptz,
 add column if not exists admin_last_error text;
alter table public.order_email_outbox drop constraint if exists order_email_outbox_kind_check;
alter table public.order_email_outbox add constraint order_email_outbox_kind_check check
 (kind in ('order_received','payment_submitted','payment_failed','payment_confirmed','processing','shipped','delivered','cancelled','refunded','partially_refunded'));
create index if not exists order_email_admin_pending on public.order_email_outbox(admin_next_attempt_at)
 where admin_recipient is not null and admin_sent_at is null;

-- Snapshot the existing business support destination only for newly queued events.
create or replace function public.set_order_email_admin() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$begin
 new.admin_recipient:='fa-23-bscs-530@lgu.edu.pk';return new;
end$$;
drop trigger if exists store_email_admin_recipient on public.order_email_outbox;
create trigger store_email_admin_recipient before insert on public.order_email_outbox
 for each row execute function public.set_order_email_admin();

create or replace function public.queue_order_email() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare kinds text[]:='{}';k text;begin
 if tg_op='INSERT' then kinds:=array['order_received'];
 else
  if old.payment_status is distinct from new.payment_status then
   if new.payment_status='paid' then kinds:=array_append(kinds,'payment_confirmed');
   elsif new.payment_status='failed' then kinds:=array_append(kinds,'payment_failed');
   elsif new.payment_status in ('refunded','partially_refunded') then kinds:=array_append(kinds,new.payment_status);end if;
  end if;
  if old.status is distinct from new.status and new.status in ('processing','shipped','delivered','cancelled') then
   if new.status='cancelled' or new.payment_status='paid' then kinds:=array_append(kinds,new.status);end if;
  end if;
 end if;
 foreach k in array kinds loop
  insert into public.order_email_outbox(order_id,kind,recipient,total_cents,currency,carrier,tracking_number)
  select new.id,k,to_jsonb(u)->>'email',new.total_cents,new.currency,new.carrier,new.tracking_number
  from auth.users u where u.id=new.user_id on conflict(order_id,kind) do nothing;
 end loop;
 return new;
end$$;

create or replace function public.queue_zelle_submission_email() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$begin
 if old.zelle_submitted_at is null and new.zelle_submitted_at is not null then
  insert into public.order_email_outbox(order_id,kind,recipient,total_cents,currency)
  select o.id,'payment_submitted',to_jsonb(u)->>'email',o.total_cents,o.currency
  from public.orders o join auth.users u on u.id=o.user_id
  where o.id=new.order_id and o.method='zelle' and o.payment_status='processing'
  on conflict(order_id,kind) do nothing;
 end if;return new;
end$$;
drop trigger if exists store_zelle_submission_email on public.payments;
create trigger store_zelle_submission_email after update of zelle_submitted_at on public.payments
 for each row execute function public.queue_zelle_submission_email();

create or replace function public.claim_admin_order_emails(p_token uuid)
returns setof public.order_email_outbox language sql security invoker set search_path=pg_catalog as $$
 with due as (
 select e.order_id,e.kind from public.order_email_outbox e where e.admin_recipient is not null
 and e.admin_sent_at is null and e.admin_next_attempt_at<=now() and e.admin_attempts<8
 and (e.admin_first_attempt_at is null or e.admin_first_attempt_at>now()-interval '23 hours')
 order by e.created_at,e.kind,e.order_id limit 5 for update skip locked
 ) update public.order_email_outbox e set admin_lease_token=p_token,
 admin_next_attempt_at=now()+interval '10 minutes',admin_first_attempt_at=coalesce(e.admin_first_attempt_at,now()),
 admin_attempts=e.admin_attempts+1,
 payload=coalesce(e.payload,jsonb_build_object('order_id',o.id,'kind',e.kind,'status',o.status,
 'payment_status',o.payment_status,'total_cents',e.total_cents,'currency',e.currency,
 'shipping_address',o.shipping_address,'carrier',e.carrier,'tracking_number',e.tracking_number,
 'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'shipping_cents',o.shipping_cents,
 'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'sku',i.sku,
 'variant',i.variant,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,'discount_cents',i.discount_cents) order by i.id)
 from public.order_items i where i.order_id=o.id),'[]'::jsonb)))
 from due,public.orders o where e.order_id=due.order_id and e.kind=due.kind and o.id=e.order_id returning e.*
$$;
revoke all on function public.set_order_email_admin(),public.queue_zelle_submission_email(),public.queue_order_email(),public.claim_admin_order_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_admin_order_emails(uuid) to service_role;
notify pgrst,'reload schema';
commit;
