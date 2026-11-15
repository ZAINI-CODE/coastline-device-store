begin;
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
commit;
