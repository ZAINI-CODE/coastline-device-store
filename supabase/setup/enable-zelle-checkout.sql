begin;
set local lock_timeout='5s';
-- Apply only after 023, private bucket creation and store-api deployment.
do $$begin
 if to_regprocedure('public.begin_zelle_payment(uuid,uuid)') is null then raise exception 'Zelle migration required';end if;
 if not exists(select 1 from storage.buckets where id='zelle-evidence' and not public and file_size_limit<=2097152) then raise exception 'Private restricted screenshot bucket required';end if;
 if (select count(distinct state) from public.shipping_rules where country='US' and method='Standard shipping' and price_cents=0 and delivery_description='5–7 business days after dispatch')<>50 then raise exception 'Review 50-state shipping configuration';end if;
end$$;
update public.shipping_rules set approved=true,tax_basis_points=0
 where country='US' and method='Standard shipping' and price_cents=0
 and delivery_description='5–7 business days after dispatch';
update public.store_settings set checkout_enabled=true,policies_approved=true,zelle_enabled=true,paypal_enabled=false where id=true;
commit;
