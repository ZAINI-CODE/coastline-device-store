begin;
set local lock_timeout = '5s';

alter table public.reviews
  add column if not exists title text check (char_length(btrim(title)) between 3 and 120),
  add column if not exists verified_order_id uuid references public.orders(id),
  add column if not exists verified_purchase boolean generated always as (verified_order_id is not null) stored;

revoke select on public.reviews from public, anon, authenticated;
grant select (id, product_id, rating, title, body, display_name, approved, created_at, verified_purchase)
  on public.reviews to anon, authenticated;
revoke execute on function public.submit_review(uuid,integer,text,text) from public, anon, authenticated;

create or replace function public.review_eligibility(p_product uuid) returns text
language sql stable security definer set search_path = pg_catalog as $$
  select case
    when auth.uid() is null then 'sign_in'
    when exists (select 1 from public.reviews r where r.user_id=auth.uid() and r.product_id=p_product) then 'submitted'
    when exists (
      select 1 from public.orders o join public.order_items i on i.order_id=o.id
      where o.user_id=auth.uid() and o.status='delivered' and o.payment_status='paid' and i.product_id=p_product
    ) then 'eligible'
    else 'purchase_required'
  end
$$;

create or replace function public.submit_review(p_product uuid,p_rating integer,p_title text,p_body text,p_name text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare
  buyer uuid := auth.uid();
  purchased_order uuid;
begin
  if buyer is null then raise exception 'Sign in to review a purchase'; end if;
  if p_rating is null or p_rating not between 1 and 5
    or coalesce(char_length(btrim(p_title)),0) not between 3 and 120
    or coalesce(char_length(btrim(p_body)),0) not between 10 and 3000
    or coalesce(char_length(btrim(p_name)),0) not between 1 and 80 then
    raise exception 'Enter a display name, rating, title and review';
  end if;
  select o.id into purchased_order from public.orders o
  where o.user_id=buyer and o.status='delivered' and o.payment_status='paid'
    and exists (select 1 from public.order_items i where i.order_id=o.id and i.product_id=p_product)
  order by o.created_at desc, o.id limit 1 for share;
  if purchased_order is null then raise exception 'A completed purchase is required'; end if;
  insert into public.reviews(user_id,product_id,rating,title,body,display_name,verified_order_id)
  values(buyer,p_product,p_rating,btrim(p_title),btrim(p_body),btrim(p_name),purchased_order)
  on conflict(user_id,product_id) do nothing;
  if not found then raise exception 'You have already reviewed this product'; end if;
end
$$;

revoke execute on function public.review_eligibility(uuid),public.submit_review(uuid,integer,text,text,text)
  from public, anon, authenticated;
grant execute on function public.review_eligibility(uuid),public.submit_review(uuid,integer,text,text,text)
  to authenticated;
create or replace function public.my_product_reviews()
returns table(product_id uuid,rating integer,title text,body text,approved boolean,created_at timestamptz)
language sql stable security definer set search_path = pg_catalog as $review$
  select r.product_id,r.rating,r.title,r.body,r.approved,r.created_at
  from public.reviews r where r.user_id = auth.uid()
  order by r.created_at desc
$review$;
revoke execute on function public.my_product_reviews() from public, anon, authenticated;
grant execute on function public.my_product_reviews() to authenticated;
notify pgrst, 'reload schema';
commit;
