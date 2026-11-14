// Only use the existing public projection; never load supplier costs/private rows.
export async function fetchPublishedCatalogue(config,request=fetch){
 if(!config.supabaseUrl||!config.supabaseKey)return {products:[],promotions:[]};
 const headers={apikey:config.supabaseKey,'Content-Type':'application/json'};
 const read=async(path,options={})=>{
  const r=await request(config.supabaseUrl+path,{headers,signal:AbortSignal.timeout(20000),...options});
  if(!r.ok)throw new Error('Public SEO catalogue fetch failed (HTTP '+r.status+'); build stopped to avoid publishing stale information.');
  const rows=await r.json();if(!Array.isArray(rows))throw new Error('Invalid public SEO catalogue');return rows;
 };
 const [products,promotions]=await Promise.all([
  read('/rest/v1/rpc/storefront_catalogue',{method:'POST',body:'{}'}),
  read('/rest/v1/promotions?select=id,name,kind,minimum_quantity,percent_basis_points,discount_cents,starts_at,ends_at,active,promotion_products(product_id,percent_basis_points,display_style)&active=eq.true')
 ]);
 return {products,promotions};
}
