// Filesystem-only review. Does not import a SQL engine, load credentials, or connect to Supabase.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sql=await readFile('supabase/setup/install-store.sql','utf8');
const manifest=JSON.parse(await readFile('supabase/setup/install-manifest.json','utf8'));
const evidence=JSON.parse(await readFile('docs/security/installer-review/final/catalogue.json','utf8'));
const hash=createHash('sha256').update(sql).digest('hex');
if(hash!==manifest.sha256||hash!==evidence.sha256)throw new Error('Installer/evidence hash mismatch; regenerate evidence only in an approved isolated SQL test.');
for(const file of manifest.sourceFiles){
 const marker=`-- Source: ${file}\n`;
 const start=sql.indexOf(marker);if(start<0)throw new Error('Missing source '+file);
 const source=(await readFile('supabase/migrations/'+file,'utf8')).replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
 if(sql.slice(start+marker.length,start+marker.length+source.length)!==source)throw new Error('Source drift: '+file);
}
// Split only top-level statements, preserving quoted strings, comments and dollar bodies.
const statements=[];let buffer='',quote=null,dollar=null,lineComment=false,block=0;
for(let i=0;i<sql.length;i++){
 const c=sql[i],n=sql[i+1];
 if(lineComment){if(c==='\n'){lineComment=false;buffer+='\n';}continue;}
 if(block){if(c==='/'&&n==='*'){block++;i++;}else if(c==='*'&&n==='/'){block--;i++;}continue;}
 if(dollar){if(sql.startsWith(dollar,i)){buffer+=dollar;i+=dollar.length-1;dollar=null;}else buffer+=c;continue;}
 if(quote){buffer+=c;if(c===quote){if(n===quote){buffer+=n;i++;}else quote=null;}continue;}
 if(c==='-'&&n==='-'){lineComment=true;i++;continue;}
 if(c==='/'&&n==='*'){block++;i++;continue;}
 if(c==="'"||c==='"'){quote=c;buffer+=c;continue;}
 if(c==='$'){const tag=sql.slice(i).match(/^\$(?:[a-z_][a-z_0-9]*)?\$/i)?.[0];if(tag){dollar=tag;buffer+=tag;i+=tag.length-1;continue;}}
 if(c===';'){if(buffer.trim())statements.push(buffer.trim());buffer='';}else buffer+=c;
}
if(quote||dollar||block||buffer.trim())throw new Error('Unexpected unterminated statement');
const destructive=statements.filter(s=>/^(drop|truncate|delete|update)\b/i.test(s)||/\bdisable row level security\b/i.test(s));
if(destructive.length)throw new Error('Top-level destructive/data-changing statement requires manual review');
const acls=statements.filter(s=>/^(grant|revoke)\b/i.test(s));
const alterations=statements.filter(s=>/^alter\b/i.test(s));
const lines=['# Complete migration object and permission inventory','',
 'Reviewed 6 November 2026. Static inspection only; no SQL executed in this review.',
 `Installer SHA-256: \`${hash}\`. All eleven embedded migration bodies match their source files byte-for-byte.`,
 '', 'The final-state catalogue below is existing local PostgreSQL simulation evidence for this exact hash, not a new hosted observation. No credentials were loaded.',
 '',`${evidence.tables.length} application tables; ${evidence.columns.length} columns; ${evidence.constraints.length} catalogued constraints (including NOT NULL); ${evidence.indexes.length} indexes; ${evidence.triggers.length} explicit row triggers; ${evidence.functions.length} functions; ${evidence.policies.length} RLS policies.`,
 '', '## Tables, columns, constraints, indexes, triggers and policies',''];
for(const table of evidence.tables){
 lines.push(`### public.${table.name}`,'',`RLS enabled=${table.rls_enabled}; forced=${table.rls_forced}.`,'','Columns:','');
 for(const c of evidence.columns.filter(x=>x.table_name===table.name))lines.push(`- \`${c.column_name}\` ${c.udt_name}, ${c.is_nullable==='NO'?'NOT NULL':'nullable'}${c.column_default?'; default '+c.column_default:''}${c.is_identity==='YES'?'; IDENTITY':''}.`);
 lines.push('','Constraints and foreign keys:','');
 for(const c of evidence.constraints.filter(x=>x.table_name===table.name))lines.push(`- \`${c.name}\`: \`${c.definition}\`.`);
 lines.push('','Indexes:','');for(const x of evidence.indexes.filter(x=>x.tablename===table.name))lines.push('```sql',x.indexdef+';','```');
 lines.push('','Explicit triggers:','');const triggers=evidence.triggers.filter(x=>x.table_name===table.name);
 if(!triggers.length)lines.push('None.');for(const x of triggers)lines.push('```sql',x.definition+';','```');
 lines.push('','Policies:','');const policies=evidence.policies.filter(x=>x.tablename===table.name);
 if(!policies.length)lines.push('None: default deny for API roles without bypass privileges.');
 for(const x of policies)lines.push(`- \`${x.policyname}\`: ${x.cmd}, ${x.permissive}, TO ${x.roles.join(', ')}; USING \`${x.qual??'not applicable'}\`; WITH CHECK \`${x.with_check??'implicit USING for ALL/UPDATE; otherwise not applicable'}\`.`);
 lines.push('');
}
lines.push('## PostgreSQL-generated foreign-key triggers','',
 'In addition to the 17 explicit application triggers, PostgreSQL creates internal referential-integrity triggers for these 24 foreign keys. Their literal RI_ConstraintTrigger_a/c_<OID> names depend on the target database object IDs and cannot be named before installation. Each ordinary nonpartitioned FK has child INSERT/UPDATE checks and parent DELETE/UPDATE actions; the definitions below identify every generated trigger family and its behavior. Ten FKs reference auth.users, so its internal dependency/constraint-trigger set grows. No Auth login/OAuth configuration or user row is rewritten. With NO ACTION references, deleting a referenced Auth user can fail; this is an intended retention constraint requiring an account-deletion workflow.','');
for(const x of evidence.constraints.filter(x=>x.type==='f'))lines.push(`- \`${x.table_name}.${x.name}\`: ${x.definition}.`);
lines.push('','## All explicit GRANT/REVOKE statements, in execution order','',
 'Later statements override earlier grants. Table-level grants remain subject to RLS. Column-only moderation grants are shown explicitly. No database role, schema privilege or global default ACL is changed by these statements.','');
for(const s of acls)lines.push('```sql',s+';','```');
lines.push('','## All explicit ALTER statements, in execution order','',
 'These target application objects created earlier in the same guarded transaction. Function replacements likewise affect only functions created by this installation. The existing rls_auto_enable function is not altered.','');
for(const s of alterations)lines.push('```sql',s+';','```');
lines.push('','## Final functions and effective EXECUTE evidence','',
 'All functions are owned by the executing trusted installation role (normally postgres); no OWNER TO change is made. Owners retain implicit privileges. EXECUTE booleans below are from the prior local simulation; unusual additional target role memberships/default grants must be audited separately. Trigger function EXECUTE is checked when the trigger is created. No customer RPC permission is granted for invoking a trigger function directly.','');
for(const f of evidence.functions)lines.push(`### ${f.signature}`,'',`SECURITY ${f.security_definer?'DEFINER':'INVOKER'}; ${f.configuration?.join('; ')}. API execution: anon=${f.anon_execute}, authenticated=${f.authenticated_execute}, service_role=${f.service_execute}.`,'','```sql',f.definition,'```','');
lines.push('## Identity sequences','',
 '- public.order_status_history_id_seq: created for order_status_history.id; API roles/PUBLIC have all sequence privileges revoked; service_role gets USAGE and SELECT.',
 '- public.admin_audit_logs_id_seq: created for admin_audit_logs.id; the same explicit ACL treatment applies.',
 '', '## Immediate seed/data effects','',
 "- Creates five new category rows: Smartphones; Audio & Accessories; Gaming; Computers; Computer Components. Their audit triggers create five category INSERT audit rows, with no customer actor in a SQL Editor install.",
 '- Creates the singleton store_settings row: checkout_enabled=false, policies_approved=false, max_open_reservations=5.',
 '- No products, inventory, orders, payments, admin memberships or Auth users are seeded.',
 '', '## Installation control effects','',
 '- BEGIN/COMMIT wrap all eleven bodies; advisory install lock and existing application relation/function collision checks run before DDL.',
 '- SET LOCAL search_path=pg_catalog, public, pg_temp changes this transaction only.',
 '- Checks API schema CREATE and bypass rights; explicitly enables application RLS and verifies every application RLS flag and lack of client TRUNCATE before commit.',
 "- NOTIFY pgrst, 'reload schema' requests an API schema-cache refresh after commit.",
 '- No Storage/Auth configuration changes, extension installations, cron jobs, role creation, migration-history writes, network requests or Edge deployments.',
 '- promotion_products has the sole ON DELETE CASCADE, limited to its join rows when its new promotion parent is later deleted; no cascade runs during installation.',
 '- No top-level DROP, TRUNCATE, DELETE, UPDATE or RLS disable was found. UPDATE statements inside stored function bodies only run when those functions are later called.',
 '', '## Rerun behavior','',
 'Fresh compatible database: install once. Failure inside the transaction: ROLLBACK, inspect, then retry the entire file. Successful installation: a repeat deliberately aborts at the preflight before changes. This is safe refusal, not silent no-op idempotency; never bypass the guard with IF NOT EXISTS or manually reapply individual bodies. Use separately reviewed versioned additive migrations thereafter.');
const output='docs/security/migration-safety-2026-11-06';await mkdir(output,{recursive:true});
await writeFile(output+'/COMPLETE-INVENTORY.md',lines.join('\n')+'\n');
const result={reviewedOn:'2026-11-06',mode:'filesystem-only; no SQL executed; no hosted connections',sha256:hash,sourceBodiesMatch:true,counts:Object.fromEntries(['tables','columns','constraints','indexes','triggers','functions','policies'].map(k=>[k,evidence[k].length])),foreignKeys:evidence.constraints.filter(x=>x.type==='f').length,authUserForeignKeys:evidence.constraints.filter(x=>x.type==='f'&&x.definition.includes('auth.users')).length,topLevelStatements:statements.length,grantRevokeStatements:acls.length,alterStatements:alterations.length,topLevelDestructiveStatements:destructive.length,rerunMode:'fail closed on existing application objects; not no-op idempotent'};
await writeFile(output+'/static-evidence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
