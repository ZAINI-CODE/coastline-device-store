begin;
set local lock_timeout = '5s';
lock table public.shipping_rules in share row exclusive mode;

do $$
begin
  if not exists (select 1 from public.store_settings where not checkout_enabled) then
    raise exception 'Stage shipping only while checkout is disabled';
  end if;
end
$$;

insert into public.shipping_rules
  (country, state, method, price_cents, delivery_description, tax_basis_points, approved)
select 'US', state_code, 'Standard shipping', 0,
       '5–7 business days after dispatch', null, false
from unnest(string_to_array(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY',
  ' '
)) as states(state_code)
where not exists (
  select 1 from public.shipping_rules as existing
  where existing.country = 'US' and existing.state = states.state_code
    and existing.method = 'Standard shipping'
);

commit;

select count(distinct state) as free_shipping_draft_states,
       bool_or(state = 'AK') as includes_alaska,
       bool_or(state = 'HI') as includes_hawaii
from public.shipping_rules
where country = 'US' and method = 'Standard shipping'
  and price_cents = 0 and delivery_description = '5–7 business days after dispatch'
  and tax_basis_points is null and not approved;
