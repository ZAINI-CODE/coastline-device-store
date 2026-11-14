-- READ ONLY. Run in an authorized SQL Editor session, not through a public RPC.
-- This does not add/revoke grants, create policies, alter tables, or change RLS.
select jsonb_build_object(
 'auto_rls_function',coalesce((select jsonb_agg(t) from (
   select p.oid::regprocedure::text as signature,pg_get_userbyid(p.proowner) as owner,
          pg_get_function_result(p.oid) as returns,p.prosecdef as security_definer,
          p.proconfig as configuration,p.proacl::text as acl,pg_get_functiondef(p.oid) as definition,
          has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
          has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='rls_auto_enable'
 )t),'[]'::jsonb),
 'event_triggers',coalesce((select jsonb_agg(t) from (
   select e.evtname as name,e.evtevent as event,e.evtenabled as enabled,e.evttags as tags,
          pg_get_userbyid(e.evtowner) as owner,e.evtfoid::regprocedure::text as function
   from pg_event_trigger e where e.evtfoid in (
     select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='rls_auto_enable'
   )
 )t),'[]'::jsonb),
 'buckets',coalesce((select jsonb_agg(t) from (
   select id,name,public,file_size_limit,allowed_mime_types from storage.buckets
 )t),'[]'::jsonb),
 'api_roles',coalesce((select jsonb_agg(t) from (
   select rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb
   from pg_roles where rolname in ('anon','authenticated','service_role')
 )t),'[]'::jsonb),
 'public_create_permissions',jsonb_build_object(
   'public_pseudo_role',exists(select 1 from pg_namespace n,
     lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
     where n.nspname='public' and a.grantee=0 and a.privilege_type='CREATE'),
   'anon',has_schema_privilege('anon','public','CREATE'),
   'authenticated',has_schema_privilege('authenticated','public','CREATE')
 ),
 'other_user_relations',coalesce((select jsonb_agg(t order by t.schema_name,t.name) from (
   select n.nspname as schema_name,c.relname as name,c.relkind::text as kind
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname not in ('public','storage','auth','realtime','extensions','graphql','graphql_public',
     'supabase_migrations','supabase_functions','vault','net','cron','pg_catalog','information_schema',
     'pgsodium','pgsodium_masks','_analytics','_realtime')
   and n.nspname not like 'pg_%' and c.relkind in ('r','p','v','m','f')
 )t),'[]'::jsonb)
) as storage_function_followup;
