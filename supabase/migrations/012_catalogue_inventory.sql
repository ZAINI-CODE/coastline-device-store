begin;
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
commit;
