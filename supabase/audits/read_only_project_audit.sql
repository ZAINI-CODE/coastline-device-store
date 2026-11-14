-- READ ONLY: inspect existing structure and access policies before considering migrations.
-- Run in an authorized Supabase SQL Editor session for the selected project.
begin transaction read only;

-- Existing application tables and RLS flags. Do not assume empty API results prove RLS.
select n.nspname as schema_name,c.relname as table_name,c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage') and c.relkind in ('r','p')
order by n.nspname,c.relname;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

select table_schema,table_name,grantee,privilege_type
from information_schema.role_table_grants
where table_schema in ('public','storage') and grantee in ('anon','authenticated','service_role')
order by table_schema,table_name,grantee,privilege_type;

-- Detect conflicting existing columns without changing them.
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
order by table_name,ordinal_position;

-- Security-definer functions and fixed search-path configuration.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname;

-- Migration history existence only; avoid assuming the CLI has initialized this schema.
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
commit;
