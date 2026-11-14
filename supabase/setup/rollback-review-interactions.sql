-- Recovery only: restores the pre-change submission/eligibility rules.
-- Retains all customer reviews and accumulated likes. Revert the frontend handlers separately.
begin;
CREATE OR REPLACE FUNCTION public.review_eligibility(p_product uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select case
 when auth.uid() is null then 'sign_in'
 when exists (select 1 from public.reviews r where r.user_id=auth.uid() and r.product_id=p_product) then 'submitted'
 when exists (
 select 1 from public.orders o join public.order_items i on i.order_id=o.id
 where o.user_id=auth.uid() and o.status='delivered' and o.payment_status='paid' and i.product_id=p_product
 ) then 'eligible'
 else 'purchase_required'
 end
$function$

CREATE OR REPLACE FUNCTION public.submit_review(p_product uuid, p_rating integer, p_body text, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin if not exists(select 1 from orders o join order_items i on i.order_id=o.id where o.user_id=auth.uid() and o.payment_status='paid' and i.product_id=p_product) then raise exception 'A verified purchase is required';end if;insert into reviews(user_id,product_id,rating,body,display_name) values(auth.uid(),p_product,p_rating,p_body,p_name) on conflict(user_id,product_id) do update set rating=excluded.rating,body=excluded.body,display_name=excluded.display_name,approved=false;end$function$

CREATE OR REPLACE FUNCTION public.submit_review(p_product uuid, p_rating numeric, p_title text, p_body text, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$

revoke execute on function public.like_review(uuid,uuid),public.product_review_likes(uuid,uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
