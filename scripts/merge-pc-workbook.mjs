import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=JSON.parse(await readFile('data/pc-workbook-source.json','utf8'));
const rows=source.sheets[0].rows,headers=Object.fromEntries(Object.entries(rows[0]).map(([cell,v])=>[cell.replace(/\d+$/,''),v]));
const ids=['cyberpowerpc-et99707','ibuypower-ryzen-5-9500f','acer-nitro-85-n85-100-ur35','lenovo-legion-tower-5-gen-10-rtx-5070-ti','ps5-pro-2tb'];
const research=JSON.parse(await readFile('data/catalogue-expanded-research.json','utf8'));
const file=await readFile('C:/Users/Administrator/OneDrive/Documents/Phone Dataset/data of pcs ecel file/pcs details.xlsx');
const notes={
 'cyberpowerpc-et99707':['Supplied processor text claims an AMD Ryzen AI NPU. This specific claim is pending confirmation and is not included in the displayed CPU specification.'],
 'ibuypower-ryzen-5-9500f':['Exact SKU is missing; similar manufacturer configuration is not proof of this exact build.','DLSS version, SSD performance and warranty remain supplied claims pending exact build verification.'],
 'acer-nitro-85-n85-100-ur35':['Supplied Ethernet description includes both 2.5GbE and Gigabit Ethernet; exact adapter requires confirmation.','The supplied $1,999.99 sale reference differs from the earlier $2,099.99 manufacturer observation; retain both as dated references.'],
 'lenovo-legion-tower-5-gen-10-rtx-5070-ti':['$3,810.99 is described as an estimated value, not a verified previous selling price.','Supplier delivery estimate, rewards and warranty do not establish this store’s terms.'],
 'ps5-pro-2tb':['Supplied availability says currently unavailable; this does not establish owner stock.','Trade-in promotion is conditional supplier information, not this store’s offer.']
};
const records=[];
for(let i=0;i<ids.length;i++){
 const row=rows[i+1],raw=Object.fromEntries(Object.entries(row).map(([cell,value])=>[headers[cell.replace(/\d+$/,'')],value]));
 const p=research.products.find(p=>p.id===ids[i]);if(!p)throw Error('Missing matching product '+ids[i]);
 if(raw.Brand!==p.brand)throw Error('Brand mismatch for '+p.id);
 const details={product_id:p.id,source_file:source.source_file,source_sheet:source.sheets[0].sheet_file,source_row:i+2,imported_on:'2026-11-06',source_sha256:createHash('sha256').update(file).digest('hex'),raw,notes:notes[p.id]};
 const hardware={OS:raw['Operating System'],CPU:raw.Processor,GPU:raw.Graphics,Memory:raw.Memory,Storage:raw.Storage,Motherboard:raw.Motherboard,Cooling:raw.Cooling,PSU:raw['Power Supply'],Chassis:raw.Case,Monitor:raw['Display / Monitor'],Keyboard:raw.Keyboard,Mouse:raw.Mouse,Connectivity:raw.Connectivity};
 // Preserve unknowns as supplied text, and withhold the disputed NPU claim.
 if(p.id==='cyberpowerpc-et99707')hardware.CPU=hardware.CPU.replace(', AMD Ryzen AI NPU','');
 p.specifications={...hardware,Verification:'Additional details supplied in pcs details.xlsx; exact owner variant and supplier terms require confirmation'};
 p.supplied_details=details;p.specification_origin='owner_workbook';p.description=raw['Short Description'];
 p.supplied_price_reference={currency:'USD',price_cents:amount(raw['Price (as provided)']),original_cents:amount(raw['Original Price']),sale_cents:amount(raw['Sale Price']),source:'pcs details.xlsx',observed_on:null,imported_on:'2026-11-06',status:'supplied_reference_only_not_store_offer'};
 p.sale_price_cents=null;p.inventory=null;p.published=false;p.active=false;
 records.push(details);
}
function amount(value){return value&&/^\d+(\.\d{1,2})?$/.test(value)?Math.round(Number(value)*100):null;}
await writeFile('data/catalogue-expanded-research.json',JSON.stringify(research,null,2)+'\n');
await writeFile('data/pc-details-import.json',JSON.stringify({source_file:source.source_file,imported_on:'2026-11-06',matched_count:records.length,created_count:0,records},null,2)+'\n');
console.log('Merged five matching records; no duplicates, active offers or owned stock created.');
