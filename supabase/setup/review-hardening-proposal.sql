-- HISTORICAL PROPOSAL: now incorporated as migration 011 in install-store.sql.
-- Do not execute this file separately. Review the consolidated installer instead.
-- Neither this file nor the consolidated installer has been executed on Supabase.
-- Resets permissions on the 23 new application tables only. No Storage/Auth changes.
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
