import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadLocalEnv} from './load-env.mjs';
import {publicConfig} from './public-config.mjs';

const normalize=value=>value.normalize('NFKC').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
export function parseFeedback(source,products) {
 const sections=[...source.matchAll(/^([^\r\n]+)\r?\n\s*\r?\nTotal Reviews: (\d+)\r?\n([\s\S]*?)(?=\r?\n-{3,}\s*(?:\r?\n|(?![\s\S]))|(?![\s\S]))/gm)];
 const records=[];
 for(const section of sections){
  const [ ,heading,expected,body]=section;
  const matches=products.filter(p=>normalize(p.name)===normalize(heading));
  if(matches.length!==1)throw new Error(`Product heading must match exactly one catalogue record: ${heading}`);
  const blocks=[...body.matchAll(/Review (\d+)\r?\nCustomer: ([^\r\n]*)\r?\nOrder ID: ([^\r\n]*)\r?\nRating: ([^\r\n]*)\r?\nFeedback: ([\s\S]*?)(?=\r?\n\s*\r?\nReview \d+|$)/g)];
  if(blocks.length!==Number(expected))throw new Error(`Review count mismatch: ${heading}`);
  for(const block of blocks){
   const [,number,customer,order,ratingText,feedbackWithSeparator]=block;
   // Remove record separators only, never trim or rewrite the supplied feedback.
   const feedback=feedbackWithSeparator.replace(/(?:\r?\n)+$/,'');
   const rating=Number(ratingText.match(/^([1-5](?:\.5)?)\/5(?:\s|$)/)?.[1]);
   if(!Number.isFinite(rating)||rating>5||!customer||!order||feedback.length<10)throw new Error(`Invalid review: ${heading} #${number}`);
   const raw={product_heading:heading,review_number:Number(number),customer,order_id:order,rating_text:ratingText,feedback};
   records.push({product_id:matches[0].id,display_name:customer,external_order_reference:order,rating,body:feedback,source_record:raw});
  }
 }
 if(!records.length||records.length!==[...source.matchAll(/^Customer: /gm)].length)throw new Error('Unparsed feedback records');
 const keys=records.map(r=>r.product_id+'|'+r.external_order_reference);
 if(new Set(keys).size!==keys.length)throw new Error('Duplicate product/order reference in source; resolve without discarding feedback');
 return records;
}

export function feedbackSQL(records){
 const json=JSON.stringify(records);
 if(json.includes('$feedback$'))throw new Error('Unsafe SQL delimiter');
 return `begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('external-customer-feedback-import',0));
create temporary table incoming_feedback on commit drop as
select * from jsonb_to_recordset($feedback$${json}$feedback$::jsonb)
as r(product_id uuid,display_name text,external_order_reference text,rating numeric,body text,source_record jsonb);
do $$ begin
 if exists(select 1 from incoming_feedback i left join public.products p on p.id=i.product_id where p.id is null) then raise exception 'Unknown product';end if;
 if exists(select 1 from incoming_feedback i join public.reviews r using(product_id,external_order_reference)
 where r.display_name is distinct from i.display_name or r.rating is distinct from i.rating or r.body is distinct from i.body
 or r.source_record is distinct from i.source_record or r.feedback_source<>'external_customer') then
 raise exception 'Existing review differs: import stopped without overwriting';end if;
end $$;
insert into public.reviews(user_id,product_id,display_name,external_order_reference,rating,body,source_record,feedback_source,approved)
select null,product_id,display_name,external_order_reference,rating,body,source_record,'external_customer',true from incoming_feedback
on conflict(product_id,external_order_reference) where external_order_reference is not null do nothing;
do $$ begin
 if (select count(*) from incoming_feedback i join public.reviews r using(product_id,external_order_reference)
 where r.display_name=i.display_name and r.rating=i.rating and r.body=i.body and r.source_record=i.source_record) <> ${records.length}
 then raise exception 'Import verification failed';end if;
end $$;
select p.name,count(*) as reviews,avg(r.rating) as average_rating from incoming_feedback i
join public.reviews r using(product_id,external_order_reference) join public.products p on p.id=r.product_id group by p.name order by p.name;
commit;
`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.argv[2];if(!path)throw new Error('Supply the feedback text file path');
 await loadLocalEnv();const config=publicConfig();
 const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/storefront_catalogue',{headers:{apikey:config.supabaseKey}});
 if(!response.ok)throw new Error('Catalogue lookup failed');
 const products=await response.json();const bytes=await readFile(path);const source=bytes.toString('utf8');
 const records=parseFeedback(source,products);const dir='.private/customer-feedback';await mkdir(dir,{recursive:true});
 await writeFile(dir+'/source.txt',bytes);await writeFile(dir+'/records.json',JSON.stringify(records,null,2));
 await writeFile(dir+'/import.sql',feedbackSQL(records));
 const migration=await readFile('supabase/migrations/021_external_customer_feedback.sql','utf8');
 // One atomic transaction covers both the additive schema update and exact import.
 const combined=migration.replace(/commit;\s*$/,'')+feedbackSQL(records).replace(/^begin;/,'');
 await writeFile(dir+'/apply.sql',combined);
 const summary={source_sha256:createHash('sha256').update(bytes).digest('hex'),total:records.length,products:products.map(p=>({id:p.id,name:p.name,count:records.filter(r=>r.product_id===p.id).length,average:records.filter(r=>r.product_id===p.id).reduce((n,r)=>n+r.rating,0)/records.filter(r=>r.product_id===p.id).length}))};
 await writeFile(dir+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}
