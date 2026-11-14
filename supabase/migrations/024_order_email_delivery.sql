begin;
set local lock_timeout='5s';
-- Compatible with projects missing 018; no backfill or customer/catalogue edits.
create table if not exists public.order_email_outbox (
 order_id uuid not null references public.orders(id),kind text not null,recipient text,
 total_cents integer not null,currency text not null,carrier text,tracking_number text,
 created_at timestamptz not null default now(),next_attempt_at timestamptz not null default now(),
 first_attempt_at timestamptz,lease_token uuid,provider_id text,sent_at timestamptz,primary key(order_id,kind)
);
alter table public.order_email_outbox add column if not exists payload jsonb,
 add column if not exists attempts integer not null default 0,add column if not exists last_error text;
alter table public.order_email_outbox drop constraint if exists order_email_outbox_kind_check;
alter table public.order_email_outbox add constraint order_email_outbox_kind_check
 check(kind in ('order_received','payment_confirmed','processing','shipped','delivered','cancelled','refunded','partially_refunded'));
create index if not exists order_email_pending on public.order_email_outbox(next_attempt_at) where sent_at is null;
alter table public.order_email_outbox enable row level security;
revoke all on public.order_email_outbox from public,anon,authenticated;
grant select,update on public.order_email_outbox to service_role;
create or replace function public.queue_order_email() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare k text;begin
 if tg_op='INSERT' then k:='order_received';
 elsif old.payment_status is distinct from new.payment_status and new.payment_status='paid' then k:='payment_confirmed';
 elsif old.payment_status is distinct from new.payment_status and new.payment_status in ('refunded','partially_refunded') then k:=new.payment_status;
 elsif old.status is distinct from new.status and new.status in ('processing','shipped','delivered','cancelled') then k:=new.status;
 else return new;end if;
 if k in ('processing','shipped','delivered') and new.payment_status<>'paid' then return new;end if;
 insert into public.order_email_outbox(order_id,kind,recipient,total_cents,currency,carrier,tracking_number)
 select new.id,k,to_jsonb(u)->>'email',new.total_cents,new.currency,new.carrier,new.tracking_number
 from auth.users u where u.id=new.user_id on conflict(order_id,kind) do nothing;
 return new;
end$$;
revoke all on function public.queue_order_email() from public,anon,authenticated;
drop trigger if exists queue_order_email on public.orders;
create trigger queue_order_email after insert or update of status,payment_status on public.orders
 for each row execute function public.queue_order_email();
-- Freeze content after commit, reuse payload/key on retry. Stop before the
-- provider's 24-hour idempotency window; unresolved jobs need reconciliation.
create or replace function public.claim_order_emails(p_token uuid)
returns setof public.order_email_outbox language sql security invoker set search_path=pg_catalog as $$
 with due as (
 select e.order_id,e.kind from public.order_email_outbox e where e.recipient is not null
 and e.sent_at is null and e.next_attempt_at<=now() and e.attempts<8
 and (e.first_attempt_at is null or e.first_attempt_at>now()-interval '23 hours')
 order by e.created_at,e.kind,e.order_id limit 5 for update skip locked
 ) update public.order_email_outbox e set lease_token=p_token,next_attempt_at=now()+interval '10 minutes',
 first_attempt_at=coalesce(e.first_attempt_at,now()),attempts=e.attempts+1,
 payload=coalesce(e.payload,jsonb_build_object('order_id',o.id,'kind',e.kind,'status',o.status,
 'payment_status',o.payment_status,'total_cents',e.total_cents,'currency',e.currency,
 'shipping_address',o.shipping_address,'carrier',e.carrier,'tracking_number',e.tracking_number,
 'subtotal_cents',o.subtotal_cents,'discount_cents',o.discount_cents,'shipping_cents',o.shipping_cents,
 'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'sku',i.sku,
 'variant',i.variant,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,'discount_cents',i.discount_cents) order by i.id)
 from public.order_items i where i.order_id=o.id),'[]'::jsonb)))
 from due,public.orders o where e.order_id=due.order_id and e.kind=due.kind and o.id=e.order_id returning e.*
$$;
revoke all on function public.claim_order_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_order_emails(uuid) to service_role;
notify pgrst,'reload schema';
commit;
