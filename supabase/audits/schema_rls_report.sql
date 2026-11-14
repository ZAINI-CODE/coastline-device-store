-- One read-only SELECT. Run in the existing project's authorized SQL Editor.
-- Returns schema/security metadata only: no customer rows, tokens or credentials.
select jsonb_build_object(
  'tables',coalesce((select jsonb_agg(t order by t.schema_name,t.table_name) from (
    select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','storage') and c.relkind in ('r','p')
  )t),'[]'::jsonb),
  'policies',coalesce((select jsonb_agg(t order by t.schemaname,t.tablename,t.policyname) from (
    select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage')
  )t),'[]'::jsonb),
  'grants',coalesce((select jsonb_agg(t order by t.table_schema,t.table_name,t.grantee,t.privilege_type) from (
    select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants
    where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role')
  )t),'[]'::jsonb),
  'public_columns',coalesce((select jsonb_agg(t order by t.table_name,t.ordinal_position) from (
    select table_name,column_name,data_type,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema='public'
  )t),'[]'::jsonb),
  'public_functions',coalesce((select jsonb_agg(t order by t.name,t.arguments) from (
    select p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,p.proconfig as configuration
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  )t),'[]'::jsonb),
  'migration_history_exists',to_regclass('supabase_migrations.schema_migrations') is not null
) as schema_rls_report;
