-- Guarded first installation for the audited existing Supabase project.
-- Target project: roamotmagssiipntchgh.supabase.co
-- Creates only missing store objects; aborts on any application object/function collision.
-- Preserves auth, storage, existing public functions, and existing permissions outside app objects.
-- Checkout remains disabled. No sample products, prices, inventory or reviews are inserted.
-- All ten migrations execute in one transaction; any failure rolls back this installation.
begin;
do $preflight$
declare collisions text;
begin
 perform pg_advisory_xact_lock(hashtextextended('electronics-store-schema-install',0));
 select string_agg(c.relname,', ' order by c.relname) into collisions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['admin_members','profiles','categories','products','product_variants','inventory','shipping_rules','promotions','promotion_products','customer_addresses','carts','orders','order_items','payments','order_status_history','reviews','review_reports','admin_audit_logs','webhook_events','request_limits','store_settings','contact_messages','refunds']) and c.relkind in ('r','p','v','m','f');
 if collisions is not null then raise exception 'Installation stopped: existing application objects: %. No objects were changed; inspect and use additive migrations.',collisions;end if;
 select string_agg(distinct p.proname,', ') into collisions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['is_admin','audit_change','record_order_status','place_order','release_order','expire_reservations','confirm_payment','submit_review','admin_order','limit_request','guard_product_publication','validate_order_insert','begin_capture','send_contact','request_full_refund','finish_paypal_refund','admin_store_summary']);
 if collisions is not null then raise exception 'Installation stopped: existing application functions: %. No existing function will be replaced.',collisions;end if;
end $preflight$;

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
notify pgrst,'reload schema';
commit;
