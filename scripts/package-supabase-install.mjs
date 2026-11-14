import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function prepareInstaller(){
 const files=(await readdir('supabase/migrations')).filter(f=>/^\d{3}_.*\.sql$/.test(f)).sort();
 const sources=await Promise.all(files.map(f=>readFile('supabase/migrations/'+f,'utf8')));
 if(sources.some(s=>/\bon all (functions|tables|sequences) in schema public\b/i.test(s)))throw new Error('Unscoped schema-wide permission operation found.');
 const tableNames=[...new Set(sources.flatMap(s=>[...s.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_]+)/gi)].map(m=>m[1])))];
 const functionNames=[...new Set(sources.flatMap(s=>[...s.matchAll(/create (?:or replace )?function\s+(?:public\.)?([a-z_]+)/gi)].map(m=>m[1])))];
 const quoteArray=names=>'array['+names.map(n=>"'"+n+"'").join(',')+']';
 const guard=`do $preflight$\ndeclare collisions text;\nbegin\n perform pg_advisory_xact_lock(hashtextextended('electronics-store-schema-install',0));\n select string_agg(c.relname,', ' order by c.relname) into collisions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(${quoteArray(tableNames)}) and c.relkind in ('r','p','v','m','f');\n if collisions is not null then raise exception 'Installation stopped: existing application objects: %. No objects were changed; inspect and use additive migrations.',collisions;end if;\n select string_agg(distinct p.proname,', ') into collisions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(${quoteArray(functionNames)});\n if collisions is not null then raise exception 'Installation stopped: existing application functions: %. No existing function will be replaced.',collisions;end if;\nend $preflight$;`;
 const body=sources.map((s,i)=>`-- Source: ${files[i]}\n`+s.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'')).join('\n\n');
 const securityGuard=`do $security$ begin
 if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') then raise exception 'Untrusted public schema CREATE requires review';end if;
 if exists(select 1 from pg_namespace n,lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname='public' and a.grantee=0 and a.privilege_type='CREATE') then raise exception 'PUBLIC schema CREATE requires review';end if;
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then raise exception 'Unexpected API bypass privilege';end if;
end $security$;`;
 const verify=`do $verify$ begin
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(${quoteArray(tableNames)}) and c.relkind='r' and c.relrowsecurity) <> ${tableNames.length} then raise exception 'Application RLS postcondition failed';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated')) r(role_name) where n.nspname='public' and c.relname=any(${quoteArray(tableNames)}) and has_table_privilege(r.role_name,c.oid,'TRUNCATE')) then raise exception 'Unexpected client TRUNCATE privilege';end if;
end $verify$;`;
 const header=`-- REVIEW COPY: requires owner approval before execution on Supabase.\n-- Guarded first installation for roamotmagssiipntchgh.supabase.co.\n-- Aborts on application object/function collisions; preserves Auth, Storage and unrelated objects.\n-- Checkout remains disabled. Seeds only categories and disabled store settings.\n-- All ${files.length} migrations execute in one transaction; any failure rolls back installation.\n`;
 const sql=header+'begin;\nset local search_path = pg_catalog, public, pg_temp;\n'+guard+'\n'+securityGuard+'\n\n'+body+'\n'+verify+"\nnotify pgrst,'reload schema';\ncommit;\n";
 await mkdir('supabase/setup',{recursive:true});await writeFile('supabase/setup/install-store.sql',sql);
 const manifest={generatedOn:'2026-11-03',sourceFiles:files,sha256:createHash('sha256').update(sql).digest('hex'),tables:tableNames,functions:functionNames,checkoutEnabled:false,approvalRequired:true,remoteExecuted:false};
 await writeFile('supabase/setup/install-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 return {sql,manifest};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/package-supabase-install.mjs')){const {manifest}=await prepareInstaller();console.log('Prepared guarded installer:',manifest.sourceFiles.length,'migrations,',manifest.tables.length,'tables. Not executed remotely.');}
