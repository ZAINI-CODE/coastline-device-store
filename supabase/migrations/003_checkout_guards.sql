begin;
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
commit;
