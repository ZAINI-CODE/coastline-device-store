begin;
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
commit;
