begin;

create table public.order_email_outbox (
  order_id uuid not null references public.orders(id),
  kind text not null check (kind in ('payment_confirmed', 'shipped')),
  recipient text,
  total_cents integer not null,
  currency text not null,
  carrier text,
  tracking_number text,
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_token uuid,
  provider_id text,
  sent_at timestamptz,
  primary key (order_id, kind)
);
create index order_email_pending on public.order_email_outbox(next_attempt_at)
where sent_at is null;
alter table public.order_email_outbox enable row level security;
revoke all on public.order_email_outbox from public, anon, authenticated;
grant select, update on public.order_email_outbox to service_role;

create function public.queue_order_email() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare
  event_kind text;
begin
  if old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' then
    event_kind := 'payment_confirmed';
  elsif old.status is distinct from new.status and new.status = 'shipped' and new.payment_status = 'paid' then
    event_kind := 'shipped';
  else
    return new;
  end if;

  insert into public.order_email_outbox(order_id, kind, recipient, total_cents, currency, carrier, tracking_number)
  select new.id, event_kind, to_jsonb(u)->>'email', new.total_cents, new.currency, new.carrier, new.tracking_number
  from auth.users u where u.id = new.user_id
  on conflict (order_id, kind) do nothing;
  return new;
end
$$;
revoke all on function public.queue_order_email() from public, anon, authenticated;
create trigger queue_order_email after update of payment_status, status on public.orders
for each row execute function public.queue_order_email();

create function public.claim_order_emails(p_token uuid)
returns setof public.order_email_outbox
language sql security invoker set search_path = pg_catalog as $$
  with due as (
    select order_id, kind
    from public.order_email_outbox
    where recipient is not null and sent_at is null and next_attempt_at <= now()
      and (first_attempt_at is null or first_attempt_at > now() - interval '23 hours')
    order by created_at, kind, order_id
    limit 5 for update skip locked
  )
  update public.order_email_outbox e
  set lease_token = p_token, next_attempt_at = now() + interval '2 minutes',
      first_attempt_at = coalesce(e.first_attempt_at, now())
  from due where e.order_id = due.order_id and e.kind = due.kind
  returning e.*
$$;
revoke all on function public.claim_order_emails(uuid) from public, anon, authenticated;
grant execute on function public.claim_order_emails(uuid) to service_role;

commit;
