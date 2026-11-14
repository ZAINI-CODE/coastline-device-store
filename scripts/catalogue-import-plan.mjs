import {createHash} from 'node:crypto';

// Stable IDs keep retries from inserting a second copy. Existing live rows must
// still be reconciled before applying this plan; this module performs no writes.
export function catalogueID(kind,key){
 const bytes=createHash('sha256').update(`electronics-store/catalogue/v1/${kind}/${key}`).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function catalogueImportPlan(products,categoryNames){
 if(new Set(categoryNames).size!==categoryNames.length)throw new Error('Duplicate category names');
 const categories=categoryNames.map(name=>({id:catalogueID('category',name),name}));
 const seen=new Set();
 const entries=products.map(p=>{
  if(!p.id||seen.has(p.id))throw new Error('Missing or duplicate product ID');seen.add(p.id);
  const category=categories.find(c=>c.name===p.category);
  if(!category)throw new Error(`Unapproved category for ${p.id}`);
  if(!p.name||!p.brand)throw new Error(`Missing product identity for ${p.id}`);
  return {local_id:p.id,database_id:catalogueID('product',p.id),row:{
   id:catalogueID('product',p.id),category_id:category.id,name:p.name,brand:p.brand,
   model:p.model_number||p.name,description:p.description||'',specifications:p.specifications||{},
   product_type:p.product_type||null,keywords:[p.id],published:false,featured:false,
   verification_source:p.verification_source||p.source||null,
   verified_at:p.verified_on?`${p.verified_on}T00:00:00Z`:null
  },catalogue_update:p.catalogue_update||null,pending:{price:p.catalogue_update?'Indicative USD prices supplied; retain reference label':'Awaiting final owner price sheet',stock:p.catalogue_update?'15 total per model; exact variant allocation required':'Awaiting final owner stock sheet',
   variants:'Exact SKU, colour, configuration and final price required before variant insertion',
   images:'Match approved exact-variant media and commercial rights before activation'},
   source_record:p};
 });
 return {version:1,mode:'review_only_no_database_writes',categories,entries,
  product_variants:[],inventory:[],checkout_enabled:false,
  application_rules:['Reconcile existing rows before import; never overwrite by name.',
   'Use product row fields only; retain source_record as local provenance.',
   'No zero or fabricated prices: variant price_cents must be positive.',
   'Do not import supplier availability as owned inventory.',
   'Do not remove historical categories that may have dependencies.']};
}
