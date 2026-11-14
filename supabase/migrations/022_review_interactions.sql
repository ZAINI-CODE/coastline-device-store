begin;
set local lock_timeout='5s';
create or replace function public.review_eligibility(p_product uuid) returns text
language sql stable security definer set search_path=pg_catalog as $$
 select case when auth.uid() is null then 'sign_in'
 when exists(select 1 from public.reviews where user_id=auth.uid() and product_id=p_product) then 'submitted'
 when exists(select 1 from public.products where id=p_product and published) then 'eligible'
 else 'unavailable' end
$$;
create or replace function public.submit_review(p_product uuid,p_rating numeric,p_title text,p_body text,p_name text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare buyer uuid:=auth.uid();purchased_order uuid;
begin
 if buyer is null then raise exception 'Sign in to add a review';end if;
 perform public.limit_request(buyer);
 if not exists(select 1 from public.products where id=p_product and published) then raise exception 'Product unavailable';end if;
 if p_rating is null or p_rating not between 1 and 5 or p_rating*2<>trunc(p_rating*2)
 or coalesce(char_length(btrim(p_title)),0) not between 3 and 120
 or coalesce(char_length(btrim(p_body)),0) not between 10 and 3000
 or coalesce(char_length(btrim(p_name)),0) not between 1 and 80 then raise exception 'Enter a display name, rating, title and review';end if;
 select o.id into purchased_order from public.orders o where o.user_id=buyer and o.status='delivered' and o.payment_status='paid'
 and exists(select 1 from public.order_items i where i.order_id=o.id and i.product_id=p_product)
 order by o.created_at desc,o.id limit 1 for share;
 insert into public.reviews(user_id,product_id,rating,title,body,display_name,verified_order_id,approved)
 values(buyer,p_product,p_rating,btrim(p_title),btrim(p_body),btrim(p_name),purchased_order,false)
 on conflict(user_id,product_id) do nothing;
 if not found then raise exception 'You have already reviewed this product';end if;
end $$;
revoke execute on function public.submit_review(uuid,numeric,text,text,text),public.review_eligibility(uuid) from public,anon,authenticated;
grant execute on function public.submit_review(uuid,numeric,text,text,text),public.review_eligibility(uuid) to authenticated;

create table if not exists public.review_likes(
 review_id uuid not null references public.reviews(id) on delete cascade,
 visitor_hash text not null check(length(visitor_hash)=32),
 created_at timestamptz not null default now(),
 primary key(review_id,visitor_hash)
);
alter table public.review_likes enable row level security;
revoke all on public.review_likes from public,anon,authenticated;
-- Visitors can only read aggregate counts, never the visitor identifiers.
create or replace function public.product_review_likes(p_product uuid,p_visitor uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('review_id',x.id,'count',x.n,'liked',x.liked)),'[]'::jsonb)
 from (select r.id,count(l.review_id) n,coalesce(bool_or(l.visitor_hash=md5(p_visitor::text)),false) liked
 from public.reviews r join public.products p on p.id=r.product_id
 left join public.review_likes l on l.review_id=r.id
 where r.product_id=p_product and r.approved and p.published group by r.id) x
$$;
create or replace function public.like_review(p_review uuid,p_visitor uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_visitor is null then raise exception 'Visitor identifier required';end if;
 perform public.limit_request(md5('review-like:'||p_visitor::text)::uuid);
 perform 1 from public.reviews r join public.products p on p.id=r.product_id
 where r.id=p_review and r.approved and p.published for share of r,p;
 if not found then raise exception 'Review unavailable';end if;
 insert into public.review_likes(review_id,visitor_hash) values(p_review,md5(p_visitor::text)) on conflict do nothing;
 return jsonb_build_object('count',(select count(*) from public.review_likes where review_id=p_review),'liked',true);
end $$;
revoke execute on function public.product_review_likes(uuid,uuid),public.like_review(uuid,uuid) from public,anon,authenticated;
grant execute on function public.product_review_likes(uuid,uuid),public.like_review(uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
