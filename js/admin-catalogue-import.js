import {db,unwrap} from './api.js';
import {safe,notify} from './app.js';
export function catalogueImportPanel(){return `<details class="panel"><summary>Import complete catalogue transaction</summary><p>Upload persistent-catalogue.json. Optionally provide the private internal-costs.json in the separate admin-only field. The server checks MFA, product identities and 15 total demo units per model. Existing inventory is never reset.</p><form id="catalogue-transaction"><label>Catalogue JSON<input name="catalogue" type="file" accept=".json,application/json" required></label><label>Private supplier costs (optional; administrators only)<input name="costs" type="file" accept=".json,application/json"></label><button class="button">Validate & import catalogue</button><p role="status" id="catalogue-import-result"></p></form></details>`;}
export function wireCatalogueImport(render){
 const form=document.querySelector('#catalogue-transaction');if(!form)return;
 form.onsubmit=event=>safe(async()=>{
  event.preventDefault();
  if(!await unwrap(db.rpc('is_admin')))throw new Error('Admin MFA required');
  const file=form.elements.catalogue.files[0],privateFile=form.elements.costs.files[0];
  if(!file||file.size>2000000||privateFile?.size>100000)throw new Error('Catalogue must be under 2 MB; private costs under 100 KB.');
  const manifest=JSON.parse(await file.text()),costs=privateFile?JSON.parse(await privateFile.text()):[];
  if(!Array.isArray(manifest.products)||!Array.isArray(costs))throw new Error('Invalid catalogue or private cost JSON.');
  if(!confirm(`Import ${manifest.products.length} models with provisional demo stock? Existing live records and stock are protected by server checks.`))return;
  const button=form.querySelector('button');button.disabled=true;
  try{const result=await unwrap(db.rpc('import_store_catalogue',{p_manifest:manifest,p_costs:costs}));notify(`${result.models} models and ${result.variants} variants ${result.replayed?'already imported':'imported'}.`);await render();}finally{button.disabled=false;}
 });
}
