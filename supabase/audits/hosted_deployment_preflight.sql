-- Run in the existing project's SQL Editor before choosing any migrations.
-- This reports catalogue metadata only and returns no customer or credential rows.
with app_relations as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
), app_functions as (
  select p.oid,p.proname,p.prosecdef,p.proconfig,p.proacl
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind in ('f','p')
)
select jsonb_build_object(
  'observed_at',now(),
  'migration_history_table',to_regclass('supabase_migrations.schema_migrations')::text,
  'tables',(select jsonb_agg(to_jsonb(t)-'oid' order by t.relname) from app_relations t),
  'columns',(select jsonb_agg(to_jsonb(c) order by c.table_name,c.ordinal_position) from (
    select table_name,ordinal_position,column_name,data_type,udt_name,is_nullable,column_default,is_identity
    from information_schema.columns where table_schema='public'
  ) c),
  'constraints',(select jsonb_agg(jsonb_build_object('table',t.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by t.relname,c.conname)
    from pg_catalog.pg_constraint c join app_relations t on t.oid=c.conrelid),
  'indexes',(select jsonb_agg(to_jsonb(i) order by i.tablename,i.indexname) from pg_catalog.pg_indexes i where i.schemaname='public'),
  'functions',(select jsonb_agg((to_jsonb(p)-'oid')||jsonb_build_object('arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid)) order by p.proname,p.oid) from app_functions p),
  'triggers',(select jsonb_agg(jsonb_build_object('table',t.relname,'name',g.tgname,'enabled',g.tgenabled,'definition',pg_get_triggerdef(g.oid)) order by t.relname,g.tgname)
    from pg_catalog.pg_trigger g join app_relations t on t.oid=g.tgrelid where not g.tgisinternal),
  'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_catalog.pg_policies p where p.schemaname in ('public','storage')),
  'api_grants',(select jsonb_agg(to_jsonb(g) order by g.table_name,g.grantee,g.privilege_type) from information_schema.role_table_grants g where g.table_schema='public' and g.grantee in ('anon','authenticated','service_role','PUBLIC')),
  'table_row_estimates',(select jsonb_object_agg(t.relname,s.n_live_tup) from app_relations t join pg_catalog.pg_stat_user_tables s on s.relid=t.oid)
) as deployment_preflight;
