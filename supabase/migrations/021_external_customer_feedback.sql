begin;
set local lock_timeout = '5s';

-- Preserve historical feedback without inventing Auth users or completed orders.
alter table public.reviews alter column rating type numeric(2,1);
alter table public.reviews alter column user_id drop not null;
alter table public.reviews
 add column if not exists feedback_source text not null default 'storefront',
 add column if not exists external_order_reference text,
 add column if not exists source_record jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.reviews'::regclass and conname='reviews_feedback_origin') then
  alter table public.reviews add constraint reviews_feedback_origin check (
   (feedback_source='storefront' and user_id is not null and external_order_reference is null and source_record is null)
   or (feedback_source='external_customer' and user_id is null and verified_order_id is null
       and external_order_reference is not null and source_record is not null));
  alter table public.reviews add constraint reviews_half_star_rating check (rating*2=trunc(rating*2));
 end if;
end $$;
create unique index if not exists reviews_external_purchase on public.reviews(product_id,external_order_reference)
 where external_order_reference is not null;
-- Order references and original import metadata remain private. RLS is unchanged.
grant select(feedback_source) on public.reviews to anon,authenticated;

-- Replace only these exact API signatures to support half-star ratings.
drop function if exists public.submit_review(uuid,integer,text,text,text);
create or replace function public.submit_review(p_product uuid,p_rating numeric,p_title text,p_body text,p_name text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare buyer uuid:=auth.uid(); purchased_order uuid;
begin
 if buyer is null then raise exception 'Sign in to review a purchase';end if;
 if p_rating is null or p_rating not between 1 and 5 or p_rating*2<>trunc(p_rating*2)
  or coalesce(char_length(btrim(p_title)),0) not between 3 and 120
  or coalesce(char_length(btrim(p_body)),0) not between 10 and 3000
  or coalesce(char_length(btrim(p_name)),0) not between 1 and 80 then
  raise exception 'Enter a display name, rating, title and review';end if;
 select o.id into purchased_order from public.orders o
 where o.user_id=buyer and o.status='delivered' and o.payment_status='paid'
 and exists(select 1 from public.order_items i where i.order_id=o.id and i.product_id=p_product)
 order by o.created_at desc,o.id limit 1 for share;
 if purchased_order is null then raise exception 'A completed purchase is required';end if;
 insert into public.reviews(user_id,product_id,rating,title,body,display_name,verified_order_id)
 values(buyer,p_product,p_rating,btrim(p_title),btrim(p_body),btrim(p_name),purchased_order)
 on conflict(user_id,product_id) do nothing;
 if not found then raise exception 'You have already reviewed this product';end if;
end $$;
revoke execute on function public.submit_review(uuid,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_review(uuid,numeric,text,text,text) to authenticated;

drop function if exists public.my_product_reviews();
create function public.my_product_reviews()
returns table(product_id uuid,rating numeric,title text,body text,approved boolean,created_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $$
 select r.product_id,r.rating,r.title,r.body,r.approved,r.created_at from public.reviews r
 where r.user_id=auth.uid() order by r.created_at desc
$$;
revoke execute on function public.my_product_reviews() from public,anon,authenticated;
grant execute on function public.my_product_reviews() to authenticated;
notify pgrst,'reload schema';
commit;
