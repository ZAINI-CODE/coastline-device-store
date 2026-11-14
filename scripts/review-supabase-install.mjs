// Local review only. Never connects to the hosted project or reads credentials.
import {PGlite} from '@electric-sql/pglite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Default reproduces historical findings; --final catalogues the corrected installer.
const finalMode=process.argv.includes('--final');
const sql=await readFile(finalMode?'supabase/setup/install-store.sql':'docs/security/installer-review/original-installer.sql','utf8');
const db=new PGlite();
const output='docs/security/installer-review'+(finalMode?'/final':'');
await mkdir(output,{recursive:true});
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('request.aal',true),'aal1'))$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;`);
 await db.exec(sql);
 const query=async s=>(await db.query(s)).rows;
 const evidence={scope:'LOCAL PGlite simulation; not a hosted-project audit',sha256:createHash('sha256').update(sql).digest('hex'),
 tables:await query(`select c.relname as name,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`),
 columns:await query(`select table_name,column_name,data_type,udt_name,is_nullable,column_default,is_identity from information_schema.columns where table_schema='public' order by table_name,ordinal_position`),
 constraints:await query(`select c.relname as table_name,x.conname as name,x.contype as type,pg_get_constraintdef(x.oid) as definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by 1,2`),
 policies:await query(`select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by 1,2`),
 grants:await query(`select table_name,grantee,privilege_type from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated','PUBLIC','service_role') order by 1,2,3`),
 functions:await query(`select p.oid::regprocedure::text as signature,p.prosecdef as security_definer,p.proconfig as configuration,pg_get_function_result(p.oid) as returns,pg_get_functiondef(p.oid) as definition,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`),
 triggers:await query(`select c.relname as table_name,t.tgname as name,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by 1,2`),
 indexes:await query(`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by 1,2`)};
 if(!finalMode){
 await db.exec('begin;set local role authenticated;truncate public.carts;rollback;');
 evidence.truncate_reproduction={role:'authenticated',table:'public.carts',succeeded:true,note:'Local empty table only; transaction rolled back. Shows inherited grants bypass row policies for TRUNCATE.'};
 const names=evidence.tables.map(t=>'public.'+t.name).join(',');
 const signatures=evidence.functions.map(f=>'public.'+f.signature).join(',\n ');
 const proposal=`-- HISTORICAL PROPOSAL: now incorporated as migration 011 in install-store.sql.
-- Do not execute this file separately. Review the consolidated installer instead.
-- Neither this file nor the consolidated installer has been executed on Supabase.
-- Resets permissions on the 23 new application tables only. No Storage/Auth changes.
do $guard$ begin
 if has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') then
   raise exception 'Untrusted public schema CREATE requires separate review';end if;
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) then
   raise exception 'Unexpected API role bypass privilege';end if;
end $guard$;
revoke all privileges on table ${names} from public,anon,authenticated;
grant select on public.categories,public.products,public.product_variants,public.inventory,public.shipping_rules,public.promotions,public.promotion_products,public.reviews,public.store_settings to anon,authenticated;
grant select,insert,update,delete on public.profiles,public.customer_addresses,public.carts to authenticated;
grant select on public.orders,public.order_items,public.payments,public.order_status_history,public.admin_audit_logs,public.review_reports,public.contact_messages,public.refunds to authenticated;
grant insert on public.review_reports to authenticated;
grant update(approved) on public.reviews to authenticated;
grant update(handled) on public.contact_messages to authenticated;
grant update on public.store_settings to authenticated;
grant insert,update,delete on public.categories,public.products,public.product_variants,public.inventory,public.shipping_rules,public.promotions,public.promotion_products to authenticated;
revoke all privileges on sequence public.order_status_history_id_seq,public.admin_audit_logs_id_seq from public,anon,authenticated;
revoke execute on function ${signatures} from public,anon,authenticated;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.place_order(jsonb,jsonb,uuid,text,uuid),public.submit_review(uuid,integer,text,text),public.admin_order(uuid,text,text,text),public.send_contact(text,text),public.request_full_refund(uuid,text),public.admin_store_summary() to authenticated;
grant execute on function public.confirm_payment(uuid,text,integer,text,uuid),public.release_order(uuid),public.expire_reservations(),public.limit_request(uuid),public.begin_capture(uuid),public.finish_paypal_refund(uuid,text,integer,text,boolean) to service_role;
${evidence.functions.map(f=>'alter function public.'+f.signature+' set search_path = public, pg_temp;').join('\n')}
-- Reject NULL proof fields, empty provider IDs and provider identity changes on retries.
create or replace function public.finish_paypal_refund(p_refund uuid,p_provider_id text,p_amount integer,p_currency text,p_completed boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$declare r public.refunds;begin
 if p_amount is null or p_currency is null or p_completed is null or nullif(trim(p_provider_id),'') is null then raise exception 'Refund proof required';end if;
 select * into r from public.refunds where id=p_refund for update;
 if not found or r.amount_cents is distinct from p_amount or r.currency is distinct from p_currency then raise exception 'Refund mismatch';end if;
 if not exists(select 1 from public.orders where id=r.order_id and method='paypal') then raise exception 'PayPal refund required';end if;
 if r.provider_refund_id is not null and r.provider_refund_id<>p_provider_id then raise exception 'Refund identity mismatch';end if;
 if r.status='completed' then return;end if;
 update public.refunds set provider_refund_id=p_provider_id,status=case when p_completed then 'completed' else 'pending' end,completed_at=case when p_completed then now() else null end where id=p_refund;
 if p_completed then update public.orders set payment_status='refunded' where id=r.order_id;end if;
 insert into public.admin_audit_logs(actor,action,record_id) values(r.requested_by,'paypal_refund_'||case when p_completed then 'completed' else 'pending' end,r.order_id::text);
end$$;
`;
 const refundFixture=`begin;
 update public.store_settings set checkout_enabled=true,policies_approved=true;
 insert into auth.users values('11111111-1111-4111-8111-111111111111');
 insert into public.orders(id,user_id,request_id,shipping_address,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents,payment_status)
 values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','{"full_name":"Local test","line1":"Local test","city":"Local test","postal_code":"00000"}','paypal',100,0,0,0,100,'paid');
 insert into public.refunds(id,order_id,requested_by,amount_cents,currency) values('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',100,'USD');`;
 await db.exec(refundFixture);
 await db.exec(`select public.finish_paypal_refund('44444444-4444-4444-8444-444444444444',null,null,null,true);`);
 evidence.refund_null_reproduction={accepted:true,status:(await query('select status from public.refunds'))[0].status,note:'Local rollback-only fixture; service-boundary defense gap, not a customer-accessible RPC.'};
 await db.exec('rollback');
 await writeFile('supabase/setup/review-hardening-proposal.sql',proposal);
 await db.exec(proposal);
 evidence.proposal_checks={applied_locally:true,remaining_client_truncate:(await query(`select count(*)::int as n from information_schema.table_privileges where table_schema='public' and grantee in ('anon','authenticated','PUBLIC') and privilege_type='TRUNCATE'`))[0].n};
 await db.exec('set role authenticated');
 try{await db.exec('truncate public.carts');throw Error('TRUNCATE unexpectedly allowed');}catch(e){if(!/permission denied/.test(e.message))throw e;evidence.proposal_checks.truncate_denied=true;}finally{await db.exec('reset role');}
 await db.exec(refundFixture);
 try{await db.exec(`select public.finish_paypal_refund('44444444-4444-4444-8444-444444444444',null,null,null,true);`);throw Error('NULL proof unexpectedly allowed');}catch(e){if(!/Refund proof required/.test(e.message))throw e;evidence.proposal_checks.null_refund_denied=true;}finally{await db.exec('rollback');}
 }
 await writeFile(output+'/catalogue.json',JSON.stringify(evidence,null,2)+'\n');
 const lines=['# Complete local installer catalogue','',`Reviewed installer SHA-256: \`${evidence.sha256}\`.`, '',evidence.scope+'. '+(finalMode?'Corrected consolidated installer (eleven source migrations).':'Historical installer, before hardening (ten source migrations).')+' No remote execution.','', 'All column names, nullability, defaults, constraints, foreign keys, RLS policies, functions, triggers and indexes follow. Function definitions are the final installed definitions.',''];
 for(const table of evidence.tables){
 lines.push('## public.'+table.name,'',`RLS enabled: ${table.rls_enabled}; forced: ${table.rls_forced}.`,'','Columns:','');
 for(const c of evidence.columns.filter(x=>x.table_name===table.name))lines.push(`- \`${c.column_name}\`: ${c.udt_name}; ${c.is_nullable==='NO'?'NOT NULL':'nullable'}; ${c.is_identity==='YES'?'identity':c.column_default?'default '+c.column_default:'no default'}.`);
 lines.push('','Constraints and relationships:','');for(const c of evidence.constraints.filter(x=>x.table_name===table.name))lines.push(`- \`${c.name}\`: \`${c.definition}\`.`);
 const policies=evidence.policies.filter(x=>x.tablename===table.name);lines.push('','RLS policies:','');
 if(!policies.length)lines.push('- No client policies; RLS defaults to deny for non-bypass roles.');
 for(const p of policies)lines.push(`- \`${p.policyname}\`: ${p.cmd}; roles ${p.roles.join(', ')}; ${p.permissive}; USING \`${p.qual??'(not applicable)'}\`; WITH CHECK \`${p.with_check??'(implicit USING for ALL/UPDATE; otherwise not applicable)'}\`.`);
 lines.push('','Indexes:','');for(const i of evidence.indexes.filter(x=>x.tablename===table.name))lines.push('- `'+i.indexdef+'`;');
 lines.push('','Triggers:','');const ts=evidence.triggers.filter(x=>x.table_name===table.name);if(!ts.length)lines.push('- None.');for(const t of ts)lines.push('- `'+t.definition+'`;');lines.push('');
 }
 lines.push('## Final function definitions','');for(const f of evidence.functions)lines.push(`### ${f.signature}`,'',`Returns ${f.returns}; SECURITY ${f.security_definer?'DEFINER':'INVOKER'}; ${f.configuration?.join('; ')}. Effective EXECUTE in the broad-default simulation: anon=${f.anon_execute}, authenticated=${f.authenticated_execute}, service_role=${f.service_execute}.`,'','```sql',f.definition,'```','');
 lines.push('## Effective table grants in the broad-default simulation','','These are local simulation results, not observed hosted privileges. Full role/table/privilege tuples are in catalogue.json.','');
 for(const g of evidence.grants.filter(x=>['anon','authenticated','PUBLIC'].includes(x.grantee)&&x.privilege_type==='TRUNCATE'))lines.push(`- ${g.grantee}: public.${g.table_name}`);
 lines.push('',finalMode?'The corrected installer leaves zero client TRUNCATE grants in this simulation. See tests/installer.test.mjs for active-event-trigger, permission-denial and preservation checks.':'The separate proposal removed every client TRUNCATE grant locally. This historical catalogue predates incorporation into the corrected installer.','');
 await writeFile(output+'/SCHEMA-AND-POLICIES.md',lines.join('\n'));
 console.log(JSON.stringify({sha256:evidence.sha256,tables:evidence.tables.length,functions:evidence.functions.length,policies:evidence.policies.length,triggers:evidence.triggers.length,indexes:evidence.indexes.length,original_client_truncate_grants:evidence.grants.filter(g=>['anon','authenticated'].includes(g.grantee)&&g.privilege_type==='TRUNCATE').length,proposal_checks:evidence.proposal_checks}));
}finally{await db.close();}
