-- REVIEW COPY: requires owner approval before execution on Supabase.
-- Guarded first installation for roamotmagssiipntchgh.supabase.co.
-- Aborts on application object/function collisions; preserves Auth, Storage and unrelated objects.
-- Checkout remains disabled. Seeds only categories and disabled store settings.
-- All 30 migrations execute in one transaction; any failure rolls back installation.
begin;
set local search_path = pg_catalog, public, pg_temp;
do $preflight$
declare collisions text;
begin
 perform pg_advisory_xact_lock(hashtextextended('electronics-store-schema-install',0));
 select string_agg(c.relname,', ' order by c.relname) into collisions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['admin_members','profiles','categories','products','product_variants','inventory','shipping_rules','promotions','promotion_products','customer_addresses','carts','orders','order_items','payments','order_status_history','reviews','review_reports','admin_audit_logs','webhook_events','request_limits','store_settings','contact_messages','refunds','product_costs','inventory_adjustments','catalogue_imports','payment_operations','order_email_outbox','review_likes']) and c.relkind in ('r','p','v','m','f');
 if collisions is not null then raise exception 'Installation stopped: existing application objects: %. No objects were changed; inspect and use additive migrations.',collisions;end if;
 select string_agg(distinct p.proname,', ') into collisions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['is_admin','audit_change','record_order_status','place_order','release_order','expire_reservations','confirm_payment','submit_review','admin_order','limit_request','guard_product_publication','validate_order_insert','begin_capture','send_contact','request_full_refund','finish_paypal_refund','admin_store_summary','record_inventory_adjustment','guard_demo_order_item','adjust_inventory','import_store_catalogue','claim_payment_operation','finish_payment_operation','record_paypal_webhook_event','storefront_catalogue','review_eligibility','my_product_reviews','queue_order_email','claim_order_emails','has_recent_product_sales','product_review_likes','like_review','guard_payment_method','begin_zelle_payment','submit_zelle_payment','cancel_unreceived_zelle','guard_order_address','guard_order_item_readiness','set_order_email_admin','queue_zelle_submission_email','claim_admin_order_emails','store_variant_ready','sync_my_profile']);
 if collisions is not null then raise exception 'Installation stopped: existing application functions: %. No existing function will be replaced.',collisions;end if;
end $preflight$;
do $security$ begin
 if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') then raise exception 'Untrusted public schema CREATE requires review';end if;
 if exists(select 1 from pg_namespace n,lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname='public' and a.grantee=0 and a.privilege_type='CREATE') then raise exception 'PUBLIC schema CREATE requires review';end if;
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then raise exception 'Unexpected API bypass privilege';end if;
end $security$;

-- Source: 001_store.sql
create table public.admin_members(user_id uuid primary key references auth.users(id));
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from admin_members where user_id=auth.uid()) and coalesce(auth.jwt()->>'aal','')='aal2' $$;
create table public.profiles(id uuid primary key references auth.users(id),display_name text check(length(display_name)<=80));
create table public.categories(id uuid primary key default gen_random_uuid(),name text unique not null);
create table public.products(id uuid primary key default gen_random_uuid(),category_id uuid references categories,name text not null,brand text not null,model text not null,description text not null default '',specifications jsonb not null default '{}',keywords text[] default '{}',published boolean not null default false,featured boolean default false,verification_source text,verified_at timestamptz,created_at timestamptz default now());
create table public.product_variants(id uuid primary key default gen_random_uuid(),product_id uuid not null references products,sku text unique not null,color text not null,configuration text not null,price_cents integer not null check(price_cents>0),currency text not null default 'USD' check(currency='USD'),image_path text,image_source text,image_permission text,image_verified_at timestamptz,specifications jsonb default '{}',compatible_product_ids uuid[] default '{}',active boolean default false,check(not active or (image_path is not null and image_permission='approved' and image_verified_at is not null)));
create table public.inventory(variant_id uuid primary key references product_variants,quantity integer not null default 0 check(quantity>=0));
create table public.shipping_rules(id uuid primary key default gen_random_uuid(),country text not null,state text not null,method text not null,price_cents integer not null check(price_cents>=0),tax_basis_points integer check(tax_basis_points between 0 and 10000),approved boolean not null default false,delivery_description text not null,free_over_cents integer);
create table public.promotions(id uuid primary key default gen_random_uuid(),name text not null,kind text check(kind in ('quantity','bundle')),minimum_quantity integer not null default 1 check(minimum_quantity>0),percent_basis_points integer not null check(percent_basis_points between 0 and 10000),starts_at timestamptz not null,ends_at timestamptz not null,active boolean default false,combination_rule text not null default 'exclusive' check(combination_rule='exclusive'),check(ends_at>starts_at));
create table public.promotion_products(promotion_id uuid references promotions on delete cascade,product_id uuid references products,primary key(promotion_id,product_id));
create table public.customer_addresses(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users,full_name text not null,line1 text not null,line2 text default '',city text not null,state text not null,postal_code text not null,country text not null);
create table public.carts(user_id uuid primary key default auth.uid() references auth.users,items jsonb not null default '[]');
create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,request_id uuid not null,created_at timestamptz default now(),expires_at timestamptz default now()+interval '30 minutes',shipping_address jsonb not null,shipping_rule_id uuid references shipping_rules,method text check(method in ('paypal','zelle')),status text not null default 'payment_pending' check(status in ('placed','payment_pending','payment_verified','processing','shipped','delivered','cancelled')),payment_status text not null default 'pending' check(payment_status in ('pending','processing','paid','failed','cancelled','refunded','partially_refunded')),subtotal_cents integer not null,discount_cents integer not null,shipping_cents integer not null,tax_cents integer not null,total_cents integer not null check(total_cents>0),currency text not null default 'USD',stock_released boolean not null default false,carrier text,tracking_number text,unique(user_id,request_id));
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references orders,variant_id uuid not null references product_variants,product_id uuid not null references products,product_name text not null,sku text not null,variant text not null,quantity integer not null check(quantity between 1 and 99),unit_price_cents integer not null,discount_cents integer not null default 0);
create table public.payments(order_id uuid primary key references orders,provider_order_id text unique,capture_id text unique,reference text,verified_by uuid references auth.users,verified_at timestamptz);
create table public.order_status_history(id bigint generated always as identity primary key,order_id uuid not null references orders,status text not null,payment_status text not null,created_at timestamptz default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users,product_id uuid not null references products,rating integer not null check(rating between 1 and 5),body text not null check(length(body) between 10 and 3000),display_name text not null check(length(display_name) between 1 and 80),approved boolean not null default false,created_at timestamptz default now(),unique(user_id,product_id));
create table public.review_reports(id uuid primary key default gen_random_uuid(),review_id uuid references reviews,user_id uuid default auth.uid() references auth.users,reason text not null check(length(reason) between 5 and 500),unique(review_id,user_id));
create table public.admin_audit_logs(id bigint generated always as identity primary key,actor uuid,action text not null,record_id text,created_at timestamptz default now(),outcome text not null default 'success');
create table public.webhook_events(id text primary key,created_at timestamptz default now());
create table public.request_limits(user_id uuid primary key,window_start timestamptz not null default now(),requests integer not null default 1);

create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$begin insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),tg_table_name||':'||tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'variant_id')); return coalesce(new,old);end$$;
create function public.record_order_status() returns trigger language plpgsql security definer set search_path=public as $$begin if tg_op='INSERT' or new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then insert into order_status_history(order_id,status,payment_status) values(new.id,new.status,new.payment_status);end if;return new;end$$;
create trigger order_history after insert or update on orders for each row execute function record_order_status();
do $$declare t text;begin
 foreach t in array array['admin_members','profiles','categories','products','product_variants','inventory','shipping_rules','promotions','promotion_products','customer_addresses','carts','orders','order_items','payments','order_status_history','reviews','review_reports','admin_audit_logs','webhook_events','request_limits'] loop execute format('alter table public.%I enable row level security',t);end loop;
 foreach t in array array['categories','products','product_variants','inventory','shipping_rules','promotions','promotion_products'] loop execute format('create policy admin_manage on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t); execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end loop;
 foreach t in array array['orders','payments','reviews','admin_members'] loop execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_change()',t);end loop;
end$$;
create policy public_categories on categories for select using(true);
create policy public_products on products for select using(published);
create policy public_variants on product_variants for select using(active and exists(select 1 from products where id=product_id and published));
create policy public_inventory on inventory for select using(exists(select 1 from product_variants where id=variant_id and active));
create policy public_shipping on shipping_rules for select using(approved);
create policy public_promotions on promotions for select using(active and now() between starts_at and ends_at);
create policy public_promotion_items on promotion_products for select using(exists(select 1 from promotions where id=promotion_id and active));
create policy own_profile on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_addresses on customer_addresses for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_cart on carts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy read_orders on orders for select to authenticated using(user_id=auth.uid() or is_admin());
create policy read_items on order_items for select to authenticated using(exists(select 1 from orders where id=order_id and (user_id=auth.uid() or is_admin())));
create policy read_payments on payments for select to authenticated using(exists(select 1 from orders where id=order_id and (user_id=auth.uid() or is_admin())));
create policy read_history on order_status_history for select to authenticated using(exists(select 1 from orders where id=order_id and (user_id=auth.uid() or is_admin())));
create policy read_reviews on reviews for select using(approved or user_id=auth.uid() or is_admin());
create policy moderate_reviews on reviews for update to authenticated using(is_admin()) with check(is_admin());
create policy own_reports on review_reports for insert to authenticated with check(user_id=auth.uid());
create policy admin_reports on review_reports for select to authenticated using(is_admin());
create policy admin_audit on admin_audit_logs for select to authenticated using(is_admin());
create index orders_user on orders(user_id,created_at desc);
create index items_order on order_items(order_id);
create index variants_product on product_variants(product_id);
create index reviews_product on reviews(product_id,approved);
create index history_order on order_status_history(order_id);

create function public.place_order(p_items jsonb,p_address jsonb,p_shipping uuid,p_method text,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid; line record; sub bigint:=0; disc bigint:=0; ship integer; tax integer; rule shipping_rules; promo promotions; eligible bigint; candidate bigint; count_items integer; best_promo uuid; winning_eligible bigint; begin
 if auth.uid() is null then raise exception 'Sign in before checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from orders where user_id=auth.uid() and request_id=p_request;if found then return oid;end if;
 if p_method is null or p_items is null or p_method not in ('paypal','zelle') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 if length(p_address->>'full_name') not between 1 and 100 or length(p_address->>'line1') not between 1 and 200 or length(p_address->>'city') not between 1 and 100 or length(p_address->>'postal_code') not between 1 and 20 or p_address->>'country' is null or p_address->>'state' is null then raise exception 'Complete shipping address required';end if;
 select * into rule from shipping_rules where id=p_shipping and approved and country=p_address->>'country' and state=p_address->>'state';
 if not found or rule.tax_basis_points is null then raise exception 'Shipping or approved tax configuration unavailable';end if;
 if exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99 or variant_id is null) then raise exception 'Invalid quantities';end if;
 if (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid))<>jsonb_array_length(p_items) then raise exception 'Duplicate variants';end if;
 for line in select v.*,i.quantity as stock,x.quantity as requested,p.name,p.published from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id join products p on p.id=v.product_id order by v.id for update of i loop
 if not line.active or not line.published or line.stock<line.requested then raise exception 'Product unavailable or insufficient inventory';end if;sub:=sub+line.price_cents::bigint*line.requested;end loop;
 select count(*) into count_items from jsonb_to_recordset(p_items) as x(variant_id uuid) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id;
 if count_items<>jsonb_array_length(p_items) then raise exception 'Unknown product';end if;
 for promo in select * from promotions where active and now() between starts_at and ends_at loop
 select coalesce(sum(v.price_cents::bigint*x.quantity),0) into eligible from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 if promo.kind='quantity' and (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id)<promo.minimum_quantity then continue;end if;
 if promo.kind='bundle' and (not exists(select 1 from promotion_products where promotion_id=promo.id) or exists(select 1 from promotion_products pp where pp.promotion_id=promo.id and not exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id where v.product_id=pp.product_id and x.quantity>=promo.minimum_quantity))) then continue;end if;
 candidate:=least(eligible,case when promo.discount_cents>0 then promo.discount_cents else floor(eligible*promo.percent_basis_points/10000.0) end);if candidate>disc then disc:=candidate;best_promo:=promo.id;winning_eligible:=eligible;end if;end loop;
 ship:=case when rule.free_over_cents is not null and sub-disc>=rule.free_over_cents then 0 else rule.price_cents end;tax:=round((sub-disc+ship)*rule.tax_basis_points/10000.0);
 insert into orders(user_id,request_id,shipping_address,shipping_rule_id,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents) values(auth.uid(),p_request,p_address,p_shipping,p_method,sub,disc,ship,tax,sub-disc+ship+tax) returning id into oid;
 insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents) select oid,v.id,p.id,p.name,v.sku,v.color||' / '||v.configuration,x.quantity,v.price_cents from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join products p on p.id=v.product_id;
 if disc>0 then with allocations as (select oi.id, floor(sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)*disc/winning_eligible::numeric)-floor((sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)-oi.unit_price_cents::bigint*oi.quantity)*disc/winning_eligible::numeric) as amount from order_items oi where oi.order_id=oid and exists(select 1 from promotion_products pp where pp.promotion_id=best_promo and pp.product_id=oi.product_id)) update order_items oi set discount_cents=a.amount from allocations a where oi.id=a.id;end if;
 update inventory i set quantity=i.quantity-x.quantity from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where i.variant_id=x.variant_id;
 insert into payments(order_id) values(oid);return oid;
end$$;

create function public.release_order(p_id uuid) returns void language plpgsql security definer set search_path=public as $$declare o orders;begin select * into o from orders where id=p_id for update;if o.payment_status='paid' or o.stock_released then return;end if;update inventory i set quantity=i.quantity+x.quantity from order_items x where x.order_id=p_id and x.variant_id=i.variant_id;update orders set stock_released=true,status='cancelled',payment_status='cancelled' where id=p_id;end$$;
create function public.expire_reservations() returns void language plpgsql security definer set search_path=public as $$declare o record;begin for o in select id from orders where expires_at<now() and payment_status='pending' and not stock_released loop perform release_order(o.id);end loop;end$$;
create function public.confirm_payment(p_id uuid,p_capture text,p_amount integer,p_currency text,p_actor uuid default null) returns void language plpgsql security definer set search_path=public as $$declare o orders;begin select * into o from orders where id=p_id for update;if not found or o.total_cents<>p_amount or o.currency<>p_currency then raise exception 'Payment mismatch';end if;if o.payment_status='paid' then if exists(select 1 from payments where order_id=p_id and capture_id=p_capture) then return;else raise exception 'Duplicate payment mismatch';end if;end if;if o.stock_released or o.payment_status='cancelled' then raise exception 'Reservation released: manual reconciliation required';end if;update payments set capture_id=p_capture,verified_by=p_actor,verified_at=now() where order_id=p_id;update orders set payment_status='paid',status='payment_verified' where id=p_id;insert into admin_audit_logs(actor,action,record_id) values(p_actor,'payment_verified',p_id::text);end$$;
create function public.submit_review(p_product uuid,p_rating integer,p_body text,p_name text) returns void language plpgsql security definer set search_path=public as $$begin if not exists(select 1 from orders o join order_items i on i.order_id=o.id where o.user_id=auth.uid() and o.payment_status='paid' and i.product_id=p_product) then raise exception 'A verified purchase is required';end if;insert into reviews(user_id,product_id,rating,body,display_name) values(auth.uid(),p_product,p_rating,p_body,p_name) on conflict(user_id,product_id) do update set rating=excluded.rating,body=excluded.body,display_name=excluded.display_name,approved=false;end$$;
create function public.admin_order(p_id uuid,p_action text,p_value text default '',p_carrier text default '') returns void language plpgsql security definer set search_path=public as $$declare o orders;begin if not is_admin() then raise exception 'Admin MFA required';end if;select * into o from orders where id=p_id for update;if not found then raise exception 'Order not found';end if;if p_action='verify_zelle' then if o.method<>'zelle' or length(p_value)<5 then raise exception 'Bank receipt reference required';end if;perform confirm_payment(p_id,'zelle:'||p_value,o.total_cents,o.currency,auth.uid());elsif p_action='cancel' then if o.payment_status='paid' then raise exception 'Refund through provider first; reconciliation required';end if;perform release_order(p_id);elsif p_action in ('processing','shipped','delivered') then if o.payment_status<>'paid' or (p_action='processing' and o.status<>'payment_verified') or (p_action='shipped' and (o.status<>'processing' or length(p_value)<3 or length(p_carrier)<2)) or (p_action='delivered' and o.status<>'shipped') then raise exception 'Invalid order transition';end if;update orders set status=p_action,tracking_number=case when p_action='shipped' then p_value else tracking_number end,carrier=case when p_action='shipped' then p_carrier else carrier end where id=p_id;else raise exception 'Unsupported action';end if;insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),p_action,p_id::text);end$$;
create function public.limit_request(p_user uuid) returns void language plpgsql security definer set search_path=public as $$declare n integer;begin insert into request_limits(user_id) values(p_user) on conflict(user_id) do update set requests=case when request_limits.window_start<now()-interval '1 minute' then 1 else request_limits.requests+1 end,window_start=case when request_limits.window_start<now()-interval '1 minute' then now() else request_limits.window_start end returning requests into n;if n>30 then raise exception 'Too many requests';end if;end$$;
-- Restrict only application functions; preserve existing platform/user functions.
revoke execute on function is_admin(),audit_change(),record_order_status(),
 place_order(jsonb,jsonb,uuid,text,uuid),release_order(uuid),expire_reservations(),
 confirm_payment(uuid,text,integer,text,uuid),submit_review(uuid,integer,text,text),
 admin_order(uuid,text,text,text),limit_request(uuid) from public,anon,authenticated;
grant execute on function is_admin() to anon,authenticated;
grant execute on function place_order(jsonb,jsonb,uuid,text,uuid), submit_review(uuid,integer,text,text),admin_order(uuid,text,text,text) to authenticated;
grant execute on function confirm_payment(uuid,text,integer,text,uuid),expire_reservations(),limit_request(uuid),release_order(uuid) to service_role;
insert into categories(name) values('Smartphones'),('Audio & Accessories'),('Gaming'),('Computers'),('Computer Components');

-- Source: 002_hardening.sql
-- Explicit privileges avoid depending on a project's default grants.
grant select on categories,products,product_variants,inventory,shipping_rules,promotions,promotion_products,reviews to anon,authenticated;
grant select,insert,update,delete on profiles,customer_addresses,carts to authenticated;
grant select on orders,order_items,payments,order_status_history,admin_audit_logs,review_reports to authenticated;
grant insert on review_reports to authenticated;
grant update on reviews to authenticated;
grant insert,update,delete on categories,products,product_variants,inventory,shipping_rules,promotions,promotion_products to authenticated;
revoke insert,update,delete on orders,order_items,payments,order_status_history,admin_audit_logs,admin_members,webhook_events,request_limits from anon,authenticated;
grant all on admin_members,profiles,categories,products,product_variants,inventory,
 shipping_rules,promotions,promotion_products,customer_addresses,carts,orders,
 order_items,payments,order_status_history,reviews,review_reports,admin_audit_logs,
 webhook_events,request_limits to service_role;
grant usage,select on sequence order_status_history_id_seq,admin_audit_logs_id_seq to service_role;
create function public.guard_product_publication() returns trigger language plpgsql set search_path=public as $$begin if new.published and (nullif(new.verification_source,'') is null or new.verified_at is null) then raise exception 'Verified product source required';end if;return new;end$$;
create trigger verify_publication before insert or update on products for each row execute function guard_product_publication();
-- Expiry is called by a configured Supabase Cron schedule (see deployment guide).

-- Source: 003_checkout_guards.sql
create table public.store_settings(id boolean primary key default true check(id),checkout_enabled boolean not null default false,policies_approved boolean not null default false);
insert into store_settings default values;
alter table store_settings enable row level security;
grant select on store_settings to anon,authenticated;
grant update on store_settings to authenticated;
grant all on store_settings to service_role;
create policy public_settings on store_settings for select using(true);
create policy admin_settings on store_settings for update to authenticated using(is_admin()) with check(is_admin());
create function public.validate_order_insert() returns trigger language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from store_settings where checkout_enabled and policies_approved) then raise exception 'Checkout is awaiting owner approval';end if;
 if coalesce(length(new.shipping_address->>'full_name'),0) not between 1 and 100 or coalesce(length(new.shipping_address->>'line1'),0) not between 1 and 200 or coalesce(length(new.shipping_address->>'city'),0) not between 1 and 100 or coalesce(length(new.shipping_address->>'postal_code'),0) not between 1 and 20 then raise exception 'Complete shipping address required';end if;
 return new;end$$;
create trigger checkout_guard before insert on orders for each row execute function validate_order_insert();
create function public.begin_capture(p_id uuid) returns void language plpgsql security definer set search_path=public as $$declare o orders;begin select * into o from orders where id=p_id for update;if not found or o.method<>'paypal' or o.stock_released or o.payment_status not in ('pending','processing') or o.expires_at<=now() then raise exception 'Reservation unavailable or expired';end if;update orders set payment_status='processing' where id=p_id;end$$;
revoke execute on function begin_capture(uuid),validate_order_insert(),guard_product_publication() from public,anon,authenticated;
grant execute on function begin_capture(uuid) to service_role;

-- Source: 004_media_and_contact.sql
alter table product_variants add column gallery_paths text[] not null default '{}';
alter table product_variants add column price_source text;
alter table product_variants add column price_verified_at timestamptz;
alter table promotions add column discount_cents integer not null default 0 check(discount_cents>=0);
alter table promotions add constraint one_discount_type check(percent_basis_points=0 or discount_cents=0);
alter table product_variants add constraint local_image_path check(not active or image_path ~ '^images/[a-zA-Z0-9/_.-]+\.(webp|avif|png|jpg|jpeg)$');
alter table product_variants add constraint verified_price check(not active or (nullif(price_source,'') is not null and price_verified_at is not null));
create table public.contact_messages(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users,subject text not null check(length(subject) between 3 and 150),message text not null check(length(message) between 10 and 5000),created_at timestamptz default now(),handled boolean not null default false);
alter table contact_messages enable row level security;
revoke all on contact_messages from anon,authenticated;
grant select,update on contact_messages to authenticated;
grant all on contact_messages to service_role;
create policy own_messages on contact_messages for select to authenticated using(user_id=auth.uid() or is_admin());
create policy handle_messages on contact_messages for update to authenticated using(is_admin()) with check(is_admin());
create function public.send_contact(p_subject text,p_message text) returns void language plpgsql security definer set search_path=public as $$begin if auth.uid() is null then raise exception 'Sign in to send a message';end if;perform limit_request(auth.uid());insert into contact_messages(user_id,subject,message) values(auth.uid(),p_subject,p_message);end$$;
revoke execute on function send_contact(text,text) from public,anon;
grant execute on function send_contact(text,text) to authenticated;
create trigger contact_audit after update on contact_messages for each row execute function audit_change();

-- Source: 005_refunds.sql
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

-- Source: 006_product_attributes.sql
alter table products add column product_type text;
alter table orders alter column method set not null;
create index products_category on products(category_id) where published;
create index products_search on products using gin(to_tsvector('english',name||' '||brand||' '||model));

-- Source: 007_payment_replay_guards.sql
-- Replayed captures must never undo a refund or restore a cancelled order.
create or replace function public.confirm_payment(p_id uuid,p_capture text,p_amount integer,p_currency text,p_actor uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders; existing_capture text;
begin
  select * into o from orders where id=p_id for update;
  if not found or p_amount is null or p_currency is null or coalesce(length(p_capture),0)<1
     or o.total_cents<>p_amount or o.currency<>p_currency then
    raise exception 'Payment mismatch';
  end if;
  select capture_id into existing_capture from payments where order_id=p_id;
  if o.payment_status in ('paid','refunded','partially_refunded') then
    if existing_capture=p_capture then return; end if;
    raise exception 'Duplicate payment mismatch';
  end if;
  if o.stock_released or o.payment_status='cancelled' then
    raise exception 'Reservation released: manual reconciliation required';
  end if;
  if existing_capture is not null and existing_capture<>p_capture then raise exception 'Capture identity mismatch';end if;
  update payments set capture_id=p_capture,verified_by=p_actor,verified_at=now() where order_id=p_id;
  if not found then raise exception 'Missing payment record';end if;
  update orders set payment_status='paid',status='payment_verified' where id=p_id;
  insert into admin_audit_logs(actor,action,record_id) values(p_actor,'payment_verified',p_id::text);
end$$;

create or replace function public.release_order(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  select * into o from orders where id=p_id for update;
  -- Recheck after locking: a concurrent capture may have begun since expiry selection.
  if not found or o.stock_released or o.payment_status not in ('pending','failed','cancelled') then return;end if;
  update inventory i set quantity=i.quantity+x.quantity from order_items x where x.order_id=p_id and x.variant_id=i.variant_id;
  update orders set stock_released=true,status='cancelled',payment_status='cancelled' where id=p_id;
end$$;

create or replace function public.admin_order(p_id uuid,p_action text,p_value text default '',p_carrier text default '')
returns void language plpgsql security definer set search_path=public as $$
declare o orders;
begin
  if not is_admin() then raise exception 'Admin MFA required';end if;
  select * into o from orders where id=p_id for update;
  if not found then raise exception 'Order not found';end if;
  if p_action='verify_zelle' then
    if o.method<>'zelle' or coalesce(length(trim(p_value)),0)<5 then raise exception 'Bank receipt reference required';end if;
    perform confirm_payment(p_id,'zelle:'||trim(p_value),o.total_cents,o.currency,auth.uid());
  elsif p_action='cancel' then
    if o.payment_status not in ('pending','failed','cancelled') then raise exception 'Reconcile payment or refund before cancellation';end if;
    perform release_order(p_id);
  elsif p_action in ('processing','shipped','delivered') then
    if o.payment_status<>'paid'
       or (p_action='processing' and o.status<>'payment_verified')
       or (p_action='shipped' and (o.status<>'processing' or coalesce(length(trim(p_value)),0)<3 or coalesce(length(trim(p_carrier)),0)<2))
       or (p_action='delivered' and o.status<>'shipped') then raise exception 'Invalid order transition';end if;
    update orders set status=p_action,
      tracking_number=case when p_action='shipped' then trim(p_value) else tracking_number end,
      carrier=case when p_action='shipped' then trim(p_carrier) else carrier end where id=p_id;
  else raise exception 'Unsupported action';end if;
  insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),p_action,p_id::text);
end$$;
revoke execute on function confirm_payment(uuid,text,integer,text,uuid),release_order(uuid),admin_order(uuid,text,text,text) from public,anon,authenticated;
grant execute on function confirm_payment(uuid,text,integer,text,uuid),release_order(uuid) to service_role;
grant execute on function admin_order(uuid,text,text,text) to authenticated;
create trigger launch_settings_audit after update on store_settings for each row execute function audit_change();

-- Source: 008_admin_summary.sql
create function public.admin_store_summary() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Admin MFA required';end if;
 return jsonb_build_object(
  'orders',(select count(*) from orders),
  'pending_payments',(select count(*) from orders where payment_status in ('pending','processing')),
  'paid_orders',(select count(*) from orders where payment_status='paid'),
  'processing',(select count(*) from orders where status='processing'),
  'shipped',(select count(*) from orders where status='shipped'),
  'delivered',(select count(*) from orders where status='delivered'),
  'cancelled',(select count(*) from orders where status='cancelled'),
  'products',(select count(*) from products),
  'published_products',(select count(*) from products where published),
  'available_units',(select coalesce(sum(quantity),0) from inventory),
  'captured_cents',(select coalesce(sum(total_cents),0) from orders where payment_status in ('paid','refunded','partially_refunded')),
  'refunded_cents',(select coalesce(sum(amount_cents),0) from refunds where status='completed'),
  'pending_reviews',(select count(*) from reviews where not approved),
  'open_messages',(select count(*) from contact_messages where not handled),
  'reconciliation_alerts',(select count(*) from admin_audit_logs where outcome='attention_required')
 );
end$$;
revoke execute on function admin_store_summary() from public,anon;
grant execute on function admin_store_summary() to authenticated;

-- Source: 009_checkout_snapshots.sql
-- Keep checkout prices stable and aggregate quantities across variants of a bundle product.
create or replace function public.place_order(p_items jsonb,p_address jsonb,p_shipping uuid,p_method text,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid; line record; sub bigint:=0; disc bigint:=0; ship integer; tax integer; rule shipping_rules; promo promotions; eligible bigint; candidate bigint; count_items integer; best_promo uuid; winning_eligible bigint; begin
 if auth.uid() is null then raise exception 'Sign in before checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from orders where user_id=auth.uid() and request_id=p_request;if found then return oid;end if;
 if p_method is null or p_items is null or p_method not in ('paypal','zelle') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 if length(p_address->>'full_name') not between 1 and 100 or length(p_address->>'line1') not between 1 and 200 or length(p_address->>'city') not between 1 and 100 or length(p_address->>'postal_code') not between 1 and 20 or p_address->>'country' is null or p_address->>'state' is null then raise exception 'Complete shipping address required';end if;
 select * into rule from shipping_rules where id=p_shipping and approved and country=p_address->>'country' and state=p_address->>'state';
 if not found or rule.tax_basis_points is null then raise exception 'Shipping or approved tax configuration unavailable';end if;
 if exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99 or variant_id is null) then raise exception 'Invalid quantities';end if;
 if (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid))<>jsonb_array_length(p_items) then raise exception 'Duplicate variants';end if;
 perform p.id from products p where p.id in (select v.product_id from product_variants v join jsonb_to_recordset(p_items) as x(variant_id uuid) on x.variant_id=v.id) order by p.id for share;
 for line in select v.*,i.quantity as stock,x.quantity as requested,p.name,p.published from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id join products p on p.id=v.product_id order by v.id for update of i,v loop
 if not line.active or not line.published or line.stock<line.requested then raise exception 'Product unavailable or insufficient inventory';end if;sub:=sub+line.price_cents::bigint*line.requested;end loop;
 select count(*) into count_items from jsonb_to_recordset(p_items) as x(variant_id uuid) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id;
 if count_items<>jsonb_array_length(p_items) then raise exception 'Unknown product';end if;
 for promo in select * from promotions where active and now() between starts_at and ends_at loop
 select coalesce(sum(v.price_cents::bigint*x.quantity),0) into eligible from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 if promo.kind='quantity' and (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id)<promo.minimum_quantity then continue;end if;
 if promo.kind='bundle' and (not exists(select 1 from promotion_products where promotion_id=promo.id) or exists(select 1 from promotion_products pp where pp.promotion_id=promo.id and not exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id where v.product_id=pp.product_id group by v.product_id having sum(x.quantity)>=promo.minimum_quantity))) then continue;end if;
 candidate:=least(eligible,case when promo.discount_cents>0 then promo.discount_cents else floor(eligible*promo.percent_basis_points/10000.0) end);if candidate>disc then disc:=candidate;best_promo:=promo.id;winning_eligible:=eligible;end if;end loop;
 ship:=case when rule.free_over_cents is not null and sub-disc>=rule.free_over_cents then 0 else rule.price_cents end;tax:=round((sub-disc+ship)*rule.tax_basis_points/10000.0);
 insert into orders(user_id,request_id,shipping_address,shipping_rule_id,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents) values(auth.uid(),p_request,p_address,p_shipping,p_method,sub,disc,ship,tax,sub-disc+ship+tax) returning id into oid;
 insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents) select oid,v.id,p.id,p.name,v.sku,v.color||' / '||v.configuration,x.quantity,v.price_cents from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join products p on p.id=v.product_id;
 if disc>0 then with allocations as (select oi.id, floor(sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)*disc/winning_eligible::numeric)-floor((sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)-oi.unit_price_cents::bigint*oi.quantity)*disc/winning_eligible::numeric) as amount from order_items oi where oi.order_id=oid and exists(select 1 from promotion_products pp where pp.promotion_id=best_promo and pp.product_id=oi.product_id)) update order_items oi set discount_cents=a.amount from allocations a where oi.id=a.id;end if;
 update inventory i set quantity=i.quantity-x.quantity from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where i.variant_id=x.variant_id;
 insert into payments(order_id) values(oid);return oid;
end$$;

-- Source: 010_reservation_limits.sql
alter table store_settings add column max_open_reservations integer not null default 5 check(max_open_reservations between 1 and 50);
create or replace function public.place_order(p_items jsonb,p_address jsonb,p_shipping uuid,p_method text,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid; line record; sub bigint:=0; disc bigint:=0; ship integer; tax integer; rule shipping_rules; promo promotions; eligible bigint; candidate bigint; count_items integer; best_promo uuid; winning_eligible bigint; begin
 if auth.uid() is null then raise exception 'Sign in before checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from orders where user_id=auth.uid() and request_id=p_request;if found then return oid;end if;
 perform limit_request(auth.uid());
 if (select count(*) from orders where user_id=auth.uid() and not stock_released and payment_status in ('pending','processing')) >= (select max_open_reservations from store_settings where id=true) then raise exception 'Too many unpaid reservations; finish or cancel an existing order';end if;
 if p_method is null or p_items is null or p_method not in ('paypal','zelle') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 if length(p_address->>'full_name') not between 1 and 100 or length(p_address->>'line1') not between 1 and 200 or length(p_address->>'city') not between 1 and 100 or length(p_address->>'postal_code') not between 1 and 20 or p_address->>'country' is null or p_address->>'state' is null then raise exception 'Complete shipping address required';end if;
 select * into rule from shipping_rules where id=p_shipping and approved and country=p_address->>'country' and state=p_address->>'state';
 if not found or rule.tax_basis_points is null then raise exception 'Shipping or approved tax configuration unavailable';end if;
 if exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99 or variant_id is null) then raise exception 'Invalid quantities';end if;
 if (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid))<>jsonb_array_length(p_items) then raise exception 'Duplicate variants';end if;
 perform p.id from products p where p.id in (select v.product_id from product_variants v join jsonb_to_recordset(p_items) as x(variant_id uuid) on x.variant_id=v.id) order by p.id for share;
 for line in select v.*,i.quantity as stock,x.quantity as requested,p.name,p.published from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id join products p on p.id=v.product_id order by v.id for update of i,v loop
 if not line.active or not line.published or line.stock<line.requested then raise exception 'Product unavailable or insufficient inventory';end if;sub:=sub+line.price_cents::bigint*line.requested;end loop;
 select count(*) into count_items from jsonb_to_recordset(p_items) as x(variant_id uuid) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id;
 if count_items<>jsonb_array_length(p_items) then raise exception 'Unknown product';end if;
 for promo in select * from promotions where active and now() between starts_at and ends_at loop
 select coalesce(sum(v.price_cents::bigint*x.quantity),0) into eligible from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 if promo.kind='quantity' and (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id)<promo.minimum_quantity then continue;end if;
 if promo.kind='bundle' and (not exists(select 1 from promotion_products where promotion_id=promo.id) or exists(select 1 from promotion_products pp where pp.promotion_id=promo.id and not exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id where v.product_id=pp.product_id group by v.product_id having sum(x.quantity)>=promo.minimum_quantity))) then continue;end if;
 candidate:=least(eligible,case when promo.discount_cents>0 then promo.discount_cents else floor(eligible*promo.percent_basis_points/10000.0) end);if candidate>disc then disc:=candidate;best_promo:=promo.id;winning_eligible:=eligible;end if;end loop;
 ship:=case when rule.free_over_cents is not null and sub-disc>=rule.free_over_cents then 0 else rule.price_cents end;tax:=round((sub-disc+ship)*rule.tax_basis_points/10000.0);
 insert into orders(user_id,request_id,shipping_address,shipping_rule_id,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents) values(auth.uid(),p_request,p_address,p_shipping,p_method,sub,disc,ship,tax,sub-disc+ship+tax) returning id into oid;
 insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents) select oid,v.id,p.id,p.name,v.sku,v.color||' / '||v.configuration,x.quantity,v.price_cents from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join products p on p.id=v.product_id;
 if disc>0 then with allocations as (select oi.id, floor(sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)*disc/winning_eligible::numeric)-floor((sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)-oi.unit_price_cents::bigint*oi.quantity)*disc/winning_eligible::numeric) as amount from order_items oi where oi.order_id=oid and exists(select 1 from promotion_products pp where pp.promotion_id=best_promo and pp.product_id=oi.product_id)) update order_items oi set discount_cents=a.amount from allocations a where oi.id=a.id;end if;
 update inventory i set quantity=i.quantity-x.quantity from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where i.variant_id=x.variant_id;
 insert into payments(order_id) values(oid);return oid;
end$$;

-- Source: 011_application_privileges.sql
-- Application-only hardening; preserves managed Storage/Auth and existing platform functions.
do $guard$ begin
 if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') then
   raise exception 'Untrusted public schema CREATE requires separate review';end if;
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then
   raise exception 'Unexpected API role bypass privilege';end if;
end $guard$;
revoke all privileges on table public.admin_audit_logs,public.admin_members,public.carts,public.categories,public.contact_messages,public.customer_addresses,public.inventory,public.order_items,public.order_status_history,public.orders,public.payments,public.product_variants,public.products,public.profiles,public.promotion_products,public.promotions,public.refunds,public.request_limits,public.review_reports,public.reviews,public.shipping_rules,public.store_settings,public.webhook_events from public,anon,authenticated;
grant select on public.categories,public.products,public.product_variants,public.inventory,public.shipping_rules,public.promotions,public.promotion_products,public.reviews,public.store_settings to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.customer_addresses,public.carts to authenticated;
grant select on public.orders,public.order_items,public.payments,public.order_status_history,public.admin_audit_logs,public.review_reports,public.contact_messages,public.refunds to authenticated;
grant insert on public.review_reports to authenticated;
grant update(approved) on public.reviews to authenticated;
grant update(handled) on public.contact_messages to authenticated;
grant update on public.store_settings to authenticated;
grant insert,update,delete on public.categories,public.products,public.product_variants,public.inventory,public.shipping_rules,public.promotions,public.promotion_products to authenticated;
revoke all privileges on sequence public.order_status_history_id_seq,public.admin_audit_logs_id_seq from public,anon,authenticated;
revoke execute on function public.admin_order(uuid,text,text,text),
 public.admin_store_summary(),
 public.audit_change(),
 public.begin_capture(uuid),
 public.confirm_payment(uuid,text,integer,text,uuid),
 public.expire_reservations(),
 public.finish_paypal_refund(uuid,text,integer,text,boolean),
 public.guard_product_publication(),
 public.is_admin(),
 public.limit_request(uuid),
 public.place_order(jsonb,jsonb,uuid,text,uuid),
 public.record_order_status(),
 public.release_order(uuid),
 public.request_full_refund(uuid,text),
 public.send_contact(text,text),
 public.submit_review(uuid,integer,text,text),
 public.validate_order_insert() from public,anon,authenticated;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.place_order(jsonb,jsonb,uuid,text,uuid),public.submit_review(uuid,integer,text,text),public.admin_order(uuid,text,text,text),public.send_contact(text,text),public.request_full_refund(uuid,text),public.admin_store_summary() to authenticated;
grant execute on function public.confirm_payment(uuid,text,integer,text,uuid),public.release_order(uuid),public.expire_reservations(),public.limit_request(uuid),public.begin_capture(uuid),public.finish_paypal_refund(uuid,text,integer,text,boolean) to service_role;
alter function public.admin_order(uuid,text,text,text) set search_path = public, pg_temp;
alter function public.admin_store_summary() set search_path = public, pg_temp;
alter function public.audit_change() set search_path = public, pg_temp;
alter function public.begin_capture(uuid) set search_path = public, pg_temp;
alter function public.confirm_payment(uuid,text,integer,text,uuid) set search_path = public, pg_temp;
alter function public.expire_reservations() set search_path = public, pg_temp;
alter function public.finish_paypal_refund(uuid,text,integer,text,boolean) set search_path = public, pg_temp;
alter function public.guard_product_publication() set search_path = public, pg_temp;
alter function public.is_admin() set search_path = public, pg_temp;
alter function public.limit_request(uuid) set search_path = public, pg_temp;
alter function public.place_order(jsonb,jsonb,uuid,text,uuid) set search_path = public, pg_temp;
alter function public.record_order_status() set search_path = public, pg_temp;
alter function public.release_order(uuid) set search_path = public, pg_temp;
alter function public.request_full_refund(uuid,text) set search_path = public, pg_temp;
alter function public.send_contact(text,text) set search_path = public, pg_temp;
alter function public.submit_review(uuid,integer,text,text) set search_path = public, pg_temp;
alter function public.validate_order_insert() set search_path = public, pg_temp;
-- Reject NULL proof fields, empty provider IDs and provider identity changes on retries.
create or replace function public.finish_paypal_refund(p_refund uuid,p_provider_id text,p_amount integer,p_currency text,p_completed boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$declare r public.refunds;begin
 if p_amount is null or p_currency is null or p_completed is null or nullif(trim(p_provider_id),'') is null then raise exception 'Refund proof required';end if;
 select * into r from public.refunds where id=p_refund for update;
 if not found or r.amount_cents is distinct from p_amount or r.currency is distinct from p_currency then raise exception 'Refund mismatch';end if;
 if not exists(select 1 from public.orders where id=r.order_id and method='paypal') then raise exception 'PayPal refund required';end if;
 if r.provider_refund_id is not null and r.provider_refund_id<>p_provider_id then raise exception 'Refund identity mismatch';end if;
 if r.status='completed' then return;end if;
 update public.refunds set provider_refund_id=p_provider_id,status=case when p_completed then 'completed' else 'pending' end,completed_at=case when p_completed then now() else null end where id=p_refund;
 if p_completed then update public.orders set payment_status='refunded' where id=r.order_id;end if;
 insert into public.admin_audit_logs(actor,action,record_id) values(r.requested_by,'paypal_refund_'||case when p_completed then 'completed' else 'pending' end,r.order_id::text);
end$$;

-- Source: 012_catalogue_inventory.sql
-- Additive application migration. No Auth/Storage changes and no seed data.
alter table public.products add column if not exists catalogue_key text;
alter table public.products add column if not exists price_label text;
alter table public.products add column if not exists catalogue_note text;
alter table public.products add column if not exists demo_only boolean not null default false;
alter table public.product_variants add column if not exists catalogue_key text;
alter table public.product_variants add column if not exists catalogue_visible boolean not null default false;
alter table public.inventory add column if not exists provisional boolean not null default false;
create unique index if not exists products_catalogue_key on public.products(catalogue_key) where catalogue_key is not null;
create unique index if not exists variants_catalogue_key on public.product_variants(catalogue_key) where catalogue_key is not null;

create table if not exists public.product_costs(
 product_id uuid primary key references public.products(id),
 supplier_cost_cents integer not null check(supplier_cost_cents>=0),
 currency text not null default 'USD' check(currency='USD'),
 note text not null default '',updated_at timestamptz not null default now()
);
create table if not exists public.inventory_adjustments(
 id bigint generated always as identity primary key,
 variant_id uuid not null references public.product_variants(id),
 before_quantity integer,after_quantity integer not null,delta integer not null,
 provisional boolean not null,actor uuid,reason text not null,created_at timestamptz not null default now()
);
create table if not exists public.catalogue_imports(
 checksum text primary key,actor uuid,result jsonb not null,created_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
alter table public.inventory_adjustments enable row level security;
alter table public.catalogue_imports enable row level security;
revoke all on public.product_costs,public.inventory_adjustments,public.catalogue_imports from public,anon,authenticated;
revoke all on sequence public.inventory_adjustments_id_seq from public,anon,authenticated;
grant select,insert,update on public.product_costs to authenticated;
grant select on public.inventory_adjustments to authenticated;
grant select,insert on public.catalogue_imports to authenticated;
grant all on public.product_costs,public.inventory_adjustments,public.catalogue_imports to service_role;
grant usage,select on sequence public.inventory_adjustments_id_seq to service_role;
do $$begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='product_costs' and policyname='admin_costs') then
  create policy admin_costs on public.product_costs for all to authenticated using(public.is_admin()) with check(public.is_admin());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory_adjustments' and policyname='admin_inventory_history') then
  create policy admin_inventory_history on public.inventory_adjustments for select to authenticated using(public.is_admin());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='catalogue_imports' and policyname='admin_imports') then
  create policy admin_imports on public.catalogue_imports for all to authenticated using(public.is_admin()) with check(public.is_admin());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='public_catalogue_variants') then
  create policy public_catalogue_variants on public.product_variants for select to anon,authenticated using(catalogue_visible and exists(select 1 from public.products p where p.id=product_id and p.published));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='inventory' and policyname='public_catalogue_inventory') then
  create policy public_catalogue_inventory on public.inventory for select to anon,authenticated using(exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=variant_id and v.catalogue_visible and p.published));
 end if;
end$$;
create index if not exists inventory_adjustments_variant on public.inventory_adjustments(variant_id,created_at desc);
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into public.admin_audit_logs(actor,action,record_id) values(auth.uid(),tg_table_name||':'||tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'variant_id',to_jsonb(new)->>'product_id'));
 return coalesce(new,old);end$$;

create or replace function public.record_inventory_adjustment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if tg_op='INSERT' or new.quantity is distinct from old.quantity or new.provisional is distinct from old.provisional then
  insert into public.inventory_adjustments(variant_id,before_quantity,after_quantity,delta,provisional,actor,reason)
  values(new.variant_id,case when tg_op='INSERT' then null else old.quantity end,new.quantity,new.quantity-case when tg_op='INSERT' then 0 else old.quantity end,new.provisional,auth.uid(),coalesce(nullif(current_setting('store.inventory_reason',true),''),'Reservation, release or trusted database adjustment'));
 end if;return new;
end$$;
create or replace function public.guard_demo_order_item() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id join public.inventory i on i.variant_id=v.id where v.id=new.variant_id and (p.demo_only or i.provisional)) then
  raise exception 'Provisional demo inventory cannot be ordered';
 end if;return new;
end$$;
create or replace function public.adjust_inventory(p_variant uuid,p_expected integer,p_quantity integer,p_reason text,p_provisional boolean default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not public.is_admin() then raise exception 'Admin MFA required';end if;
 if p_quantity is null or p_quantity<0 or p_expected is null or coalesce(length(trim(p_reason)),0) not between 5 and 500 then raise exception 'Quantity and adjustment reason required';end if;
 perform set_config('store.inventory_reason',trim(p_reason),true);
 update public.inventory set quantity=p_quantity,provisional=coalesce(p_provisional,provisional) where variant_id=p_variant and quantity=p_expected;
 if not found then raise exception 'Inventory changed; refresh before adjusting';end if;
end$$;
do $$begin
 if not exists(select 1 from pg_trigger where tgrelid='public.inventory'::regclass and tgname='inventory_quantity_history') then create trigger inventory_quantity_history after insert or update on public.inventory for each row execute function public.record_inventory_adjustment();end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.order_items'::regclass and tgname='block_demo_order') then create trigger block_demo_order before insert on public.order_items for each row execute function public.guard_demo_order_item();end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.product_costs'::regclass and tgname='cost_audit') then create trigger cost_audit after insert or update on public.product_costs for each row execute function public.audit_change();end if;
end$$;
revoke update,delete on public.inventory from authenticated;
revoke execute on function public.record_inventory_adjustment(),public.guard_demo_order_item(),public.adjust_inventory(uuid,integer,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.adjust_inventory(uuid,integer,integer,text,boolean) to authenticated;

-- Invoker rights preserve table RLS. SQL Editor owner can run this without
-- pretending to be an authenticated user; storefront clients still require MFA.
create or replace function public.import_store_catalogue(p_manifest jsonb,p_costs jsonb default '[]') returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare batch_checksum text; saved jsonb; item jsonb; v jsonb; cost jsonb; pid uuid; vid uuid; cid uuid; matches integer; total integer; model_count integer:=0; variant_count integer:=0; existing public.products; existing_v public.product_variants;
begin
 if current_user not in ('postgres','supabase_admin') and not public.is_admin() then raise exception 'Admin MFA required';end if;
 if jsonb_typeof(p_manifest->'products') is distinct from 'array' or jsonb_array_length(p_manifest->'products') not between 1 and 100 or jsonb_typeof(p_costs) is distinct from 'array' or jsonb_array_length(p_costs)>100 then raise exception 'Invalid catalogue batch';end if;
 if exists(select 1 from jsonb_array_elements(p_manifest->'products') x group by x->>'catalogue_key' having count(*)>1) then raise exception 'Duplicate catalogue model';end if;
 batch_checksum:=md5(p_manifest::text||p_costs::text);
 perform pg_advisory_xact_lock(hashtextextended('electronics-catalogue-import',0));
 select result into saved from public.catalogue_imports where catalogue_imports.checksum=batch_checksum;
 if found then return saved||jsonb_build_object('replayed',true);end if;
 perform set_config('store.inventory_reason','Provisional demo allocation from owner catalogue import',true);
 for item in select value from jsonb_array_elements(p_manifest->'products') loop
  if nullif(item->>'catalogue_key','') is null or nullif(item->>'name','') is null or nullif(item->>'brand','') is null or jsonb_typeof(item->'specifications') is distinct from 'object' or jsonb_typeof(item->'variants') is distinct from 'array' or jsonb_array_length(item->'variants') not between 1 and 100 then raise exception 'Incomplete model record';end if;
  if item->>'category' not in ('Apple iPhones','Apple Products and Headphones','Gaming Consoles','Gaming Controllers','Processors and CPUs','Gaming PCs') then raise exception 'Unapproved category';end if;
  select sum((x->>'quantity')::integer),count(distinct x->>'catalogue_key') into total,matches from jsonb_array_elements(item->'variants') x;
  if total is distinct from 15 or matches<>jsonb_array_length(item->'variants') or exists(select 1 from jsonb_array_elements(item->'variants') x where (x->>'quantity')::integer<0 or (x->>'price_cents')::integer<=0 or nullif(x->>'catalogue_key','') is null or nullif(x->>'sku','') is null) then raise exception 'Expected unique SKU allocations totalling 15';end if;
  insert into public.categories(name) values(item->>'category') on conflict(name) do nothing;
  select id into cid from public.categories where name=item->>'category';
  select count(*) into matches from public.products where catalogue_key=item->>'catalogue_key' or id=(item->>'id')::uuid or keywords @> array[item->>'catalogue_key'];
  if matches>1 then raise exception 'Ambiguous existing model; reconcile IDs first';end if;
  select * into existing from public.products where catalogue_key=item->>'catalogue_key' or id=(item->>'id')::uuid or keywords @> array[item->>'catalogue_key'] for update;
  if found then
   if existing.brand<>item->>'brand' or existing.catalogue_key is not null and existing.catalogue_key<>item->>'catalogue_key' then raise exception 'Existing product identity conflict';end if;
   -- Do not silently convert an already selling product to demonstration stock.
   if existing.published and not existing.demo_only then raise exception 'Existing live model requires separate review';end if;
   pid:=existing.id;
   update public.products set name=item->>'name',category_id=cid,model=item->>'model',description=item->>'description',specifications=item->'specifications',product_type=item->>'product_type',catalogue_key=item->>'catalogue_key',keywords=array[item->>'catalogue_key'],price_label=item->>'price_label',catalogue_note=item->>'catalogue_note',demo_only=true,published=true,verification_source=item->>'verification_source',verified_at=(item->>'verified_at')::timestamptz where id=pid;
  else
   pid:=(item->>'id')::uuid;
   insert into public.products(id,category_id,name,brand,model,description,specifications,product_type,catalogue_key,keywords,price_label,catalogue_note,demo_only,published,verification_source,verified_at) values(pid,cid,item->>'name',item->>'brand',item->>'model',item->>'description',item->'specifications',item->>'product_type',item->>'catalogue_key',array[item->>'catalogue_key'],item->>'price_label',item->>'catalogue_note',true,true,item->>'verification_source',(item->>'verified_at')::timestamptz);
  end if;
  for v in select value from jsonb_array_elements(item->'variants') loop
   select count(*) into matches from public.product_variants where catalogue_key=v->>'catalogue_key' or id=(v->>'id')::uuid or sku=v->>'sku' or (product_id=pid and color=v->>'color' and configuration=v->>'configuration');
   if matches>1 then raise exception 'Ambiguous existing variant; reconcile SKUs first';end if;
   select * into existing_v from public.product_variants where catalogue_key=v->>'catalogue_key' or id=(v->>'id')::uuid or sku=v->>'sku' or (product_id=pid and color=v->>'color' and configuration=v->>'configuration') for update;
   if found then
    if existing_v.product_id<>pid or existing_v.active or existing_v.catalogue_key is not null and existing_v.catalogue_key<>v->>'catalogue_key' then raise exception 'Existing SKU identity or live variant conflict';end if;
    vid:=existing_v.id;
    update public.product_variants set catalogue_key=v->>'catalogue_key',price_cents=(v->>'price_cents')::integer,price_source=v->>'price_source',price_verified_at=(v->>'price_verified_at')::timestamptz,specifications=v->'specifications',catalogue_visible=true where id=vid;
   else
    vid:=(v->>'id')::uuid;
    insert into public.product_variants(id,product_id,sku,color,configuration,price_cents,price_source,price_verified_at,specifications,image_path,gallery_paths,image_source,image_permission,image_verified_at,catalogue_key,catalogue_visible,active) values(vid,pid,v->>'sku',v->>'color',v->>'configuration',(v->>'price_cents')::integer,v->>'price_source',(v->>'price_verified_at')::timestamptz,v->'specifications',v->>'image_path',array(select jsonb_array_elements_text(v->'gallery_paths')),v->>'image_source',v->>'image_permission',nullif(v->>'image_verified_at','')::timestamptz,v->>'catalogue_key',true,false);
   end if;
   -- Existing quantities are never reset by a repeat import or new price sheet.
   insert into public.inventory(variant_id,quantity,provisional) values(vid,(v->>'quantity')::integer,true) on conflict(variant_id) do nothing;
   variant_count:=variant_count+1;
  end loop;
  select sum(i.quantity) into total from public.inventory i join public.product_variants pv on pv.id=i.variant_id where pv.product_id=pid;
  if total is distinct from 15 then raise exception 'Existing model inventory differs from 15; allocation was not reset';end if;
  model_count:=model_count+1;
 end loop;
 for cost in select value from jsonb_array_elements(p_costs) loop
  select id into pid from public.products where catalogue_key=cost->>'catalogue_key';
  if pid is null then raise exception 'Unknown cost product';end if;
  insert into public.product_costs(product_id,supplier_cost_cents,note) values(pid,(cost->>'supplier_cost_cents')::integer,coalesce(cost->>'note','Owner supplied')) on conflict(product_id) do update set supplier_cost_cents=excluded.supplier_cost_cents,note=excluded.note,updated_at=now();
 end loop;
 saved:=jsonb_build_object('models',model_count,'variants',variant_count,'inventory_reset',false,'provisional',true,'replayed',false);
 insert into public.catalogue_imports(checksum,actor,result) values(batch_checksum,auth.uid(),saved);
 return saved;
end$$;
revoke execute on function public.import_store_catalogue(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_store_catalogue(jsonb,jsonb) to authenticated;
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='inventory') then
  alter publication supabase_realtime add table public.inventory;
 end if;
end$$;
notify pgrst,'reload schema';

-- Source: 013_payment_operation_leases.sql
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

-- Source: 014_storefront_catalogue.sql
set local lock_timeout = '5s';

-- Base records include sourcing, draft prices and stock allocations. Keep direct
-- reads available to the existing MFA-protected admin interface only.
alter policy public_products on public.products using (false);
alter policy public_variants on public.product_variants using (false);
alter policy public_catalogue_variants on public.product_variants using (false);
alter policy public_inventory on public.inventory using (false);
alter policy public_catalogue_inventory on public.inventory using (false);

-- The photographed Ultramarine exterior is identical across these storage sizes.
update public.product_variants v
set image_path = 'images/products/iphone-16-ultramarine-960.webp',
    image_source = 'https://commons.wikimedia.org/wiki/File:IPhone_16_Ultramarine_Rear.png',
    image_permission = 'approved', image_verified_at = date '2026-11-03'
from public.products p
where v.product_id = p.id and p.catalogue_key = 'iphone-16'
  and v.color = 'Ultramarine' and v.configuration in ('128GB', '256GB')
  and v.image_path is null and v.image_permission is distinct from 'approved';

create or replace function public.storefront_catalogue() returns setof jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'brand', p.brand, 'model', p.model,
    'category', c.name, 'product_type', p.product_type, 'description',
    case p.catalogue_key
      when 'airpods-5' then 'Apple wireless earbuds with an open-fit design.'
      when 'iphone-17e' then 'Explore storage and finish options for the iPhone 17e.'
      when 'iphone-air' then 'Explore storage and finish options for the iPhone Air.'
      when 'iphone-duo' then 'Explore storage and finish options for the foldable iPhone Duo.'
      else p.description
    end,
    'keywords', p.keywords, 'featured', p.featured, 'created_at', p.created_at,
    'specifications', p.specifications - array['Verification', 'Supplied pending checks', 'Other Details'],
    'review_count', coalesce(r.count, 0), 'rating', r.rating,
    'variants', v.options
  )
  from public.products p
  left join public.categories c on c.id = p.category_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'color', x.color,
      'configuration', case when x.configuration !~* '(pending|unknown|to confirm)' then x.configuration end,
      'compatible_product_ids', x.compatible_product_ids,
      'specifications', x.specifications - array['SKU origin', 'Price note', 'Verification'],
      'price_cents', case when readiness.approved then x.price_cents end,
      'stock', case when readiness.approved and not i.provisional then i.quantity end,
      'image_path', case when x.image_permission = 'approved' and x.image_verified_at is not null then x.image_path end,
      'gallery_paths', case when x.image_permission = 'approved' and x.image_verified_at is not null then x.gallery_paths else '{}'::text[] end
    ) order by case when readiness.approved then x.price_cents end nulls last, x.configuration, x.color, x.id) as options
    from public.product_variants x
    left join public.inventory i on i.variant_id = x.id
    cross join lateral (
      select not p.demo_only and x.active and x.image_path is not null
        and x.image_permission = 'approved' and x.image_verified_at is not null
        and nullif(trim(x.price_source), '') is not null and x.price_verified_at is not null as approved
    ) readiness
    where x.product_id = p.id and (x.active or x.catalogue_visible)
  ) v
  cross join lateral (
    select count(*) as count, avg(rating) as rating from public.reviews
    where product_id = p.id and approved
  ) r
  where p.published and v.options is not null
  order by p.id
$$;

revoke all on function public.storefront_catalogue() from public;
grant execute on function public.storefront_catalogue() to anon, authenticated;

notify pgrst, 'reload schema';

-- Source: 015_ps5_pro_photo.sql
set local lock_timeout = '5s';

-- Standard PS5 Pro exterior, documented in the internal image manifest.
update public.product_variants v
set image_path = 'images/products/ps5-pro-2tb-960.webp',
    image_source = 'https://commons.wikimedia.org/wiki/File:PlayStation_5_Pro_no_disc_drive.jpg',
    image_permission = 'approved', image_verified_at = date '2026-11-09'
from public.products p
where v.product_id = p.id and p.catalogue_key = 'ps5-pro-2tb'
  and v.configuration = 'Standard configuration' and v.color = 'Colour to confirm'
  and v.image_path is null and v.image_permission is distinct from 'approved';

-- Source: 016_verified_product_reviews.sql
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

-- Source: 017_confirmed_storefront_catalogue.sql
set local lock_timeout = '5s';

-- An exact, priced configuration can be sold while its photo is being sourced.
-- If an active variant has a photo, it still requires approval and verification.
alter table public.product_variants
  drop constraint product_variants_check,
  add constraint product_variants_photo_approval
    check (not active or image_path is null or
      (image_permission is not distinct from 'approved' and image_verified_at is not null));

create or replace function public.storefront_catalogue() returns setof jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'brand', p.brand, 'model', p.model,
    'category', c.name, 'product_type', p.product_type, 'description',
    case p.catalogue_key
      when 'airpods-5' then 'Apple wireless earbuds with an open-fit design.'
      when 'iphone-17e' then 'Explore storage and finish options for the iPhone 17e.'
      when 'iphone-air' then 'Explore storage and finish options for the iPhone Air.'
      when 'iphone-duo' then 'Explore storage and finish options for the foldable iPhone Duo.'
      else p.description
    end,
    'verification_source', case when p.catalogue_key like 'iphone-%' then p.verification_source end,
    'keywords', p.keywords, 'featured', p.featured, 'created_at', p.created_at,
    'specifications', p.specifications - array['Verification', 'Supplied pending checks', 'Other Details'],
    'review_count', coalesce(r.count, 0), 'rating', r.rating,
    'variants', v.options
  )
  from public.products p
  left join public.categories c on c.id = p.category_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'color', x.color,
      'configuration', case when x.configuration !~* '(pending|unknown|to confirm)' then x.configuration end,
      'compatible_product_ids', x.compatible_product_ids,
      'specifications', x.specifications - array['SKU origin', 'Price note', 'Verification'],
      'price_cents', case when readiness.approved or p.price_label = 'Store selling price' then x.price_cents end,
      'active', readiness.approved and i.provisional is false,
      'stock', case when i.provisional is false and (readiness.approved or p.catalogue_key is not null) then i.quantity end,
      'image_path', case when x.image_permission = 'approved' and x.image_verified_at is not null then x.image_path end,
      'gallery_paths', case when x.image_permission = 'approved' and x.image_verified_at is not null then x.gallery_paths else '{}'::text[] end
    ) || case when readiness.approved and i.provisional is false then jsonb_build_object('sku',x.sku) else '{}'::jsonb end
      order by x.price_cents, x.configuration, x.color, x.id) as options
    from public.product_variants x
    left join public.inventory i on i.variant_id = x.id
    cross join lateral (
      select not p.demo_only and x.active and (x.image_path is null
        or (x.image_permission = 'approved' and x.image_verified_at is not null))
        and nullif(trim(x.price_source), '') is not null and x.price_verified_at is not null as approved
    ) readiness
    where x.product_id = p.id and (x.active or x.catalogue_visible)
  ) v
  cross join lateral (
    select count(*) as count, avg(rating) as rating from public.reviews
    where product_id = p.id and approved
  ) r
  where p.published and v.options is not null
  order by p.id
$$;

revoke all on function public.storefront_catalogue() from public;
grant execute on function public.storefront_catalogue() to anon, authenticated;

notify pgrst, 'reload schema';

-- Source: 018_order_email_outbox.sql
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

-- Source: 019_recent_product_sales.sql
create index if not exists order_items_product_order_idx
  on public.order_items (product_id, order_id);

-- Expose only whether a public product has reached the display threshold.
create or replace function public.has_recent_product_sales(p_product uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(sum(recent.quantity), 0) >= 12
  from (
    select i.quantity
    from public.products p
    join public.order_items i on i.product_id = p.id
    join public.orders o on o.id = i.order_id
    join public.payments pay on pay.order_id = o.id
    where p.id = p_product and p.published and not p.demo_only
      and o.payment_status = 'paid' and o.status <> 'cancelled' and not o.stock_released
      and pay.capture_id is not null
      and pay.verified_at > now() - interval '168 hours' and pay.verified_at <= now()
    limit 12
  ) recent;
$$;

revoke all on function public.has_recent_product_sales(uuid) from public;
grant execute on function public.has_recent_product_sales(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- Source: 020_campaign_product_discounts.sql
set local lock_timeout = '5s';
do $guard$ begin
 if not exists(select 1 from pg_proc where oid='public.place_order(jsonb,jsonb,uuid,text,uuid)'::regprocedure
 and md5(trim(regexp_replace(prosrc,'[[:space:]]+',' ','g'))) in ('06243d3e4671cc7aa2f13ac9eafe89be','33165557deb6c730917b18e3a05fa2b9','4752d591272766c4d6026a5317d04cbc')) then
 raise exception 'Checkout definition differs from reviewed source. Inspect before applying.';
 end if;
end $guard$;

alter table public.promotion_products
 add column if not exists percent_basis_points integer check(percent_basis_points between 0 and 9999),
 add column if not exists display_style text not null default 'standard' check(display_style in ('standard','daily','early'));
create or replace function public.place_order(p_items jsonb,p_address jsonb,p_shipping uuid,p_method text,p_request uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare oid uuid; line record; sub bigint:=0; disc bigint:=0; ship integer; tax integer; rule shipping_rules; promo promotions; eligible bigint; candidate bigint; count_items integer; best_promo uuid; winning_eligible bigint; winning_item_rates boolean:=false; begin
 if auth.uid() is null then raise exception 'Sign in before checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from orders where user_id=auth.uid() and request_id=p_request;if found then return oid;end if;
 perform limit_request(auth.uid());
 if (select count(*) from orders where user_id=auth.uid() and not stock_released and payment_status in ('pending','processing')) >= (select max_open_reservations from store_settings where id=true) then raise exception 'Too many unpaid reservations; finish or cancel an existing order';end if;
 if p_method is null or p_items is null or p_method not in ('paypal','zelle') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 if length(p_address->>'full_name') not between 1 and 100 or length(p_address->>'line1') not between 1 and 200 or length(p_address->>'city') not between 1 and 100 or length(p_address->>'postal_code') not between 1 and 20 or p_address->>'country' is null or p_address->>'state' is null then raise exception 'Complete shipping address required';end if;
 select * into rule from shipping_rules where id=p_shipping and approved and country=p_address->>'country' and state=p_address->>'state';
 if not found or rule.tax_basis_points is null then raise exception 'Shipping or approved tax configuration unavailable';end if;
 if exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99 or variant_id is null) then raise exception 'Invalid quantities';end if;
 if (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid))<>jsonb_array_length(p_items) then raise exception 'Duplicate variants';end if;
 perform p.id from products p where p.id in (select v.product_id from product_variants v join jsonb_to_recordset(p_items) as x(variant_id uuid) on x.variant_id=v.id) order by p.id for share;
 for line in select v.*,i.quantity as stock,x.quantity as requested,p.name,p.published from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id join products p on p.id=v.product_id order by v.id for update of i,v loop
 if not line.active or not line.published or line.stock<line.requested then raise exception 'Product unavailable or insufficient inventory';end if;sub:=sub+line.price_cents::bigint*line.requested;end loop;
 select count(*) into count_items from jsonb_to_recordset(p_items) as x(variant_id uuid) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id;
 if count_items<>jsonb_array_length(p_items) then raise exception 'Unknown product';end if;
 for promo in select * from promotions where active and now() >= starts_at and now() < ends_at loop
 select coalesce(sum(v.price_cents::bigint*x.quantity),0) into eligible from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 if promo.kind='quantity' and (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id)<promo.minimum_quantity then continue;end if;
 if promo.kind='bundle' and (not exists(select 1 from promotion_products where promotion_id=promo.id) or exists(select 1 from promotion_products pp where pp.promotion_id=promo.id and not exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id where v.product_id=pp.product_id group by v.product_id having sum(x.quantity)>=promo.minimum_quantity))) then continue;end if;
 if promo.discount_cents=0 and exists(select 1 from promotion_products where promotion_id=promo.id and percent_basis_points is not null) then
   select coalesce(sum(floor(v.price_cents::bigint*coalesce(pp.percent_basis_points,promo.percent_basis_points)/10000.0)*x.quantity),0)
   into candidate
   from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer)
   join product_variants v on v.id=x.variant_id
   join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 else
   candidate:=least(eligible,case when promo.discount_cents>0 then promo.discount_cents else floor(eligible*promo.percent_basis_points/10000.0) end);
 end if;
 if candidate>disc then
   disc:=candidate;best_promo:=promo.id;winning_eligible:=eligible;
   winning_item_rates:=promo.discount_cents=0 and exists(select 1 from promotion_products where promotion_id=promo.id and percent_basis_points is not null);
 end if;
 end loop;
 ship:=case when rule.free_over_cents is not null and sub-disc>=rule.free_over_cents then 0 else rule.price_cents end;tax:=round((sub-disc+ship)*rule.tax_basis_points/10000.0);
 insert into orders(user_id,request_id,shipping_address,shipping_rule_id,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents) values(auth.uid(),p_request,p_address,p_shipping,p_method,sub,disc,ship,tax,sub-disc+ship+tax) returning id into oid;
 insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents) select oid,v.id,p.id,p.name,v.sku,v.color||' / '||v.configuration,x.quantity,v.price_cents from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join products p on p.id=v.product_id;
 if disc>0 and winning_item_rates then
   update order_items oi
   set discount_cents=floor(oi.unit_price_cents::bigint*coalesce(pp.percent_basis_points,pr.percent_basis_points)/10000.0)*oi.quantity
   from promotion_products pp join promotions pr on pr.id=pp.promotion_id
   where oi.order_id=oid and pp.promotion_id=best_promo and pp.product_id=oi.product_id;
 elsif disc>0 then
   with allocations as (select oi.id, floor(sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)*disc/winning_eligible::numeric)-floor((sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)-oi.unit_price_cents::bigint*oi.quantity)*disc/winning_eligible::numeric) as amount from order_items oi where oi.order_id=oid and exists(select 1 from promotion_products pp where pp.promotion_id=best_promo and pp.product_id=oi.product_id)) update order_items oi set discount_cents=a.amount from allocations a where oi.id=a.id;
 end if;
 update inventory i set quantity=i.quantity-x.quantity from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where i.variant_id=x.variant_id;
 insert into payments(order_id) values(oid);return oid;
end$$;
revoke all on function public.place_order(jsonb,jsonb,uuid,text,uuid) from public,anon;
grant execute on function public.place_order(jsonb,jsonb,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';

-- Source: 021_external_customer_feedback.sql
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

-- Source: 022_review_interactions.sql
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

-- Source: 023_zelle_checkout.sql
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

-- Source: 024_order_email_delivery.sql
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

-- Source: 025_purchase_validation.sql
set local lock_timeout='5s';
-- Additional guards; no replacement checkout and no existing row changes.
create or replace function public.guard_order_address() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare field text;begin
 foreach field in array array['full_name','line1','city','state','postal_code','country'] loop
  if jsonb_typeof(new.shipping_address->field) is distinct from 'string' or
   length(trim(coalesce(new.shipping_address->>field,'')))=0 then raise exception 'Complete shipping address required';end if;
 end loop;
 if length(new.shipping_address->>'full_name')>100 or length(new.shipping_address->>'line1')>200 or
 length(new.shipping_address->>'city')>100 or new.shipping_address->>'country'<>'US' or
 new.shipping_address->>'state' !~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$' or
 new.shipping_address->>'postal_code' !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'Invalid US shipping address';end if;
 return new;
end$$;
create or replace function public.guard_order_item_readiness() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$begin
 if not exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id
 join public.inventory i on i.variant_id=v.id where v.id=new.variant_id and p.id=new.product_id
 and p.published and not p.demo_only and v.active and i.provisional is false and v.price_cents>0
 and new.unit_price_cents=v.price_cents and length(trim(v.sku))>0
 and length(trim(coalesce(v.price_source,'')))>0 and v.price_verified_at is not null
 and length(trim(coalesce(v.configuration,'')))>0 and v.configuration !~* '(pending|unknown|to confirm)'
 and coalesce(v.color,'') !~* '(pending|unknown|to confirm)')
 then raise exception 'Product purchasing information incomplete';end if;
 return new;
end$$;
revoke all on function public.guard_order_address(),public.guard_order_item_readiness() from public,anon,authenticated;
drop trigger if exists store_order_address_guard on public.orders;
create trigger store_order_address_guard before insert on public.orders for each row execute function public.guard_order_address();
drop trigger if exists store_order_item_readiness_guard on public.order_items;
create trigger store_order_item_readiness_guard before insert on public.order_items for each row execute function public.guard_order_item_readiness();

-- Source: 026_order_notifications.sql
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

-- Source: 027_checkout_shipping_contact.sql
set local lock_timeout='5s';
-- Add the requested fast option without changing existing shipping rules or orders.
do $$ begin
 if exists(select 1 from public.shipping_rules where country='US' and method='Fast delivery' and (price_cents<>2500 or free_over_cents is not null or tax_basis_points<>0 or not approved)) then raise exception 'Conflicting fast shipping rule; inspect before proceeding';end if;
end $$;
insert into public.shipping_rules(country,state,method,price_cents,tax_basis_points,approved,delivery_description)
select 'US',s.state,'Fast delivery',2500,0,true,'Fast delivery'
from (select distinct state from public.shipping_rules where country='US' and approved and method='Standard shipping' and price_cents=0) s
where not exists(select 1 from public.shipping_rules r where r.country='US' and r.state=s.state and r.method='Fast delivery');
create or replace function public.guard_order_address() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare field text;begin
 foreach field in array array['full_name','line1','city','state','postal_code','country','phone'] loop
  if jsonb_typeof(new.shipping_address->field) is distinct from 'string' or
   length(trim(coalesce(new.shipping_address->>field,'')))=0 then raise exception 'Complete shipping address required';end if;
 end loop;
 if length(new.shipping_address->>'phone')>30 or length(regexp_replace(new.shipping_address->>'phone','[^0-9]','','g')) not between 10 and 15 or length(new.shipping_address->>'full_name')>100 or length(new.shipping_address->>'line1')>200 or
 length(new.shipping_address->>'city')>100 or new.shipping_address->>'country'<>'US' or
 new.shipping_address->>'state' !~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$' or
 new.shipping_address->>'postal_code' !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'Invalid US shipping address';end if;
 return new;
end$$;

revoke all on function public.guard_order_address() from public,anon,authenticated;

-- Source: 028_international_contact.sql
set local lock_timeout='5s';
-- International contact numbers; delivery remains restricted to the 50 US states.
-- Only new-order validation changes. Existing orders and grants remain intact.
create or replace function public.guard_order_address() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare field text;begin
 foreach field in array array['full_name','line1','city','state','postal_code','country','phone'] loop
  if jsonb_typeof(new.shipping_address->field) is distinct from 'string' or
   length(trim(coalesce(new.shipping_address->>field,'')))=0 then raise exception 'Complete shipping address required';end if;
 end loop;
 if new.shipping_address->>'phone' !~ '^\+[1-9][0-9]{6,14}$' or length(new.shipping_address->>'full_name')>100 or length(new.shipping_address->>'line1')>200 or
 length(new.shipping_address->>'city')>100 or new.shipping_address->>'country'<>'US' or
 new.shipping_address->>'state' !~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$' or
 new.shipping_address->>'postal_code' !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'Invalid US shipping address';end if;
 return new;
end$$;

revoke all on function public.guard_order_address() from public,anon,authenticated;

-- Source: 029_purchase_readiness.sql
set local lock_timeout='5s';
-- A fixed PC configuration does not require an optional exterior-colour label.
-- Keep all SKU, pricing, inventory and configuration checks in place.
create or replace function public.store_variant_ready(p_variant uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.product_variants v
 join public.products p on p.id=v.product_id
 left join public.categories c on c.id=p.category_id
 join public.inventory i on i.variant_id=v.id
 where v.id=p_variant and p.published and not p.demo_only and v.active
 and i.provisional is false and v.price_cents>0 and length(trim(v.sku))>0
 and nullif(trim(v.price_source),'') is not null and v.price_verified_at is not null
 and nullif(trim(v.configuration),'') is not null and v.configuration !~* '(pending|unknown|to confirm)'
 and (coalesce(v.color,'') !~* '(pending|unknown|to confirm)' or
   (c.name='Gaming PCs' and not exists(select 1 from public.product_variants other
     where other.product_id=p.id and other.active and other.id<>v.id
       and coalesce(other.color,'') is distinct from coalesce(v.color,''))))
 and (v.image_path is null or (v.image_permission='approved' and v.image_verified_at is not null)))
$$;
create or replace function public.guard_order_item_readiness() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$begin
 if not public.store_variant_ready(new.variant_id) or not exists(
   select 1 from public.product_variants v where v.id=new.variant_id
   and v.product_id=new.product_id and v.price_cents=new.unit_price_cents
 ) then raise exception 'Product configuration unavailable for purchase. Please contact support.';end if;
 return new;
end$$;
revoke all on function public.store_variant_ready(uuid),public.guard_order_item_readiness() from public,anon,authenticated;
-- Update only the reviewed readiness clause in the existing public projection.
-- Abort rather than overwrite an unfamiliar hosted definition.
do $projection$
declare definition text;clause text;normalized text;
begin
 definition:=pg_get_functiondef('public.storefront_catalogue()'::regprocedure);
 if position('select public.store_variant_ready(x.id) as approved' in definition)>0 then return;end if;
 clause:=substring(definition from '(?s)select not p\.demo_only and x\.active.*? as approved');
 normalized:=trim(regexp_replace(clause,'[[:space:]]+',' ','g'));
 if normalized is distinct from 'select not p.demo_only and x.active and (x.image_path is null or (x.image_permission = ''approved'' and x.image_verified_at is not null)) and nullif(trim(x.price_source), '''') is not null and x.price_verified_at is not null as approved' then
 raise exception 'Storefront readiness differs from reviewed source; inspect before applying';end if;
 execute replace(definition,clause,'select public.store_variant_ready(x.id) as approved');
end $projection$;
notify pgrst,'reload schema';

-- Source: 030_customer_profiles.sql
set local lock_timeout='5s';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists avatar_mode text not null default 'google';
alter table public.profiles add column if not exists google_avatar_url text;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_contact_format') then
 alter table public.profiles add constraint profile_contact_format check(phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');end if;
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_avatar_scope') then
 alter table public.profiles add constraint profile_avatar_scope check(avatar_path is null or avatar_path ~ ('^'||id::text||'/[0-9a-f-]{36}\.webp$'));end if;
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_avatar_mode') then
 alter table public.profiles add constraint profile_avatar_mode check(avatar_mode in ('google','upload','none'));end if;
 if not exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and conname='profile_google_avatar_host') then
 alter table public.profiles add constraint profile_google_avatar_host check(google_avatar_url is null or (length(google_avatar_url)<=2048 and google_avatar_url ~ '^https://[a-zA-Z0-9-]+\.googleusercontent\.com/'));end if;
end$$;
create or replace function public.sync_my_profile() returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare who uuid:=auth.uid();meta jsonb:=auth.jwt()->'user_metadata';photo text;person text;contact text;
begin
 if who is null then raise exception 'Sign in required';end if;
 person:=left(coalesce(nullif(trim(meta->>'display_name'),''),nullif(trim(meta->>'full_name'),''),nullif(trim(meta->>'name'),'')),80);
 contact:=meta->>'phone';if contact !~ '^\+[1-9][0-9]{6,14}$' then contact:=null;end if;
 if auth.jwt()->'app_metadata'->>'provider'='google' or (auth.jwt()->'app_metadata'->'providers') ? 'google' then
 photo:=coalesce(meta->>'avatar_url',meta->>'picture');
 if photo !~ '^https://[a-zA-Z0-9-]+\.googleusercontent\.com/' or length(photo)>2048 then photo:=null;end if;
 end if;
 insert into public.profiles(id,display_name,phone,google_avatar_url) values(who,person,contact,photo)
 on conflict(id) do update set
 display_name=coalesce(nullif(trim(profiles.display_name),''),excluded.display_name),
 phone=coalesce(profiles.phone,excluded.phone),
 google_avatar_url=coalesce(excluded.google_avatar_url,profiles.google_avatar_url);
end$$;
revoke all on function public.sync_my_profile() from public,anon;
grant execute on function public.sync_my_profile() to authenticated;
-- Existing profile RLS continues to restrict all rows to auth.uid().
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-avatars','profile-avatars',false,2097152,array['image/webp']) on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='profile-avatars' and (public or file_size_limit is distinct from 2097152 or allowed_mime_types is distinct from array['image/webp'])) then
 raise exception 'Existing avatar bucket differs from reviewed private configuration';end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='own_avatar_read') then
 create policy own_avatar_read on storage.objects for select to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='own_avatar_insert') then
 create policy own_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='profile-avatars' and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.webp$'));end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='own_avatar_delete') then
 create policy own_avatar_delete on storage.objects for delete to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);end if;
end$$;
do $verify$ begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['admin_members','profiles','categories','products','product_variants','inventory','shipping_rules','promotions','promotion_products','customer_addresses','carts','orders','order_items','payments','order_status_history','reviews','review_reports','admin_audit_logs','webhook_events','request_limits','store_settings','contact_messages','refunds','product_costs','inventory_adjustments','catalogue_imports','payment_operations','order_email_outbox','review_likes']) and c.relkind='r' and c.relrowsecurity) <> 29 then raise exception 'Application RLS postcondition failed';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated')) r(role_name) where n.nspname='public' and c.relname=any(array['admin_members','profiles','categories','products','product_variants','inventory','shipping_rules','promotions','promotion_products','customer_addresses','carts','orders','order_items','payments','order_status_history','reviews','review_reports','admin_audit_logs','webhook_events','request_limits','store_settings','contact_messages','refunds','product_costs','inventory_adjustments','catalogue_imports','payment_operations','order_email_outbox','review_likes']) and has_table_privilege(r.role_name,c.oid,'TRUNCATE')) then raise exception 'Unexpected client TRUNCATE privilege';end if;
end $verify$;
notify pgrst,'reload schema';
commit;
