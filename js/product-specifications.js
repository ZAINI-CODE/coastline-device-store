import {escapeHTML as e} from './core.js';
const metadata=new Set(['Product Name','Brand','Category','Model / Part Number','Price (as provided)','Original Price','Sale Price','Availability','Short Description','Warranty / Service','Shipping / Rush','Discount / Offer','Other Details']);
export function specificationGroups(product,variant={}){
 const values=new Map();
 const aliases={cpu:'processor',gpu:'graphics',psu:'power supply',os:'operating system',chassis:'case',monitor:'display / monitor'};
 function add(key,value){if(key.toLowerCase()==='verification'||value==null||String(value).trim()===''||/^(n\/a|not applicable|not specified|unknown|pending)$/i.test(String(value).trim()))return;values.set(aliases[key.toLowerCase()]||key.toLowerCase(),{label:key,value:typeof value==='object'?JSON.stringify(value):String(value)});}
 if(product.brand)add('Brand',product.brand);if(product.model_number)add('Model / Part number',product.model_number);
 for(const [key,value] of Object.entries(product.specifications||{}))add(key,value);
 for(const [key,value] of Object.entries(product.supplied_details?.raw||{}))if(!metadata.has(key))add(key,key==='Processor'&&product.supplied_details?.notes?.some(n=>/NPU/.test(n))?product.specifications?.CPU||value:value);
 for(const [key,value] of Object.entries(variant.specifications||{}))add(key,value);
 if(variant.color&&!/to confirm|pending|unknown/i.test(variant.color))add('Selected colour',variant.color);if(variant.configuration)add('Selected configuration',variant.configuration);
 const groups=new Map();
 for(const row of values.values()){
  const k=row.label.toLowerCase();let group='General Information';
  if(/display|monitor/.test(k)&&/none included|not included/i.test(row.value))group='Included Accessories';
  else if(/display|screen|resolution|refresh|monitor/.test(k))group='Display';
  else if(/memory|ram|storage|ssd|cache/.test(k))group='Memory & Storage';
  else if(/processor|cpu|chip|graphics|gpu|motherboard|cooling|performance|cores|threads|socket/.test(k))group='Performance';
  else if(/camera|video recording|aperture/.test(k))group='Camera';
  else if(/battery|charging|power|psu/.test(k))group='Battery & Power';
  else if(/connect|wireless|wifi|wi-fi|bluetooth|port|network/.test(k))group='Connectivity';
  else if(/dimension|weight|case|material|height|width|depth/.test(k))group='Physical Details';
  else if(/keyboard|mouse|included|accessor|in the box/.test(k))group='Included Accessories';
  if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row);
 }
 return [...groups].map(([title,rows])=>({title,rows}));
}
export function specificationsMarkup(product,variant){return `<section class="specification-section" aria-label="Product specifications"><div class="section-head"><div><span class="eyebrow">THE DETAILS</span><h2>Specifications</h2></div></div><div class="specification-groups">${specificationGroups(product,variant).map(group=>`<section class="specification-group"><h3>${e(group.title)}</h3><dl>${group.rows.map(row=>`<div class="specification-row"><dt>${e(row.label)}</dt><dd>${e(row.value)}</dd></div>`).join('')}</dl></section>`).join('')}</div></section>`;}
