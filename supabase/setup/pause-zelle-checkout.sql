begin;
update public.store_settings set checkout_enabled=false,zelle_enabled=false,paypal_enabled=false where id=true;
-- Keep existing orders, evidence, references, audit/history and inventory holds.
-- Reconcile outstanding bank transfers individually before releasing any hold.
commit;
