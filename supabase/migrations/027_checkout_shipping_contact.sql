begin;
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
commit;
