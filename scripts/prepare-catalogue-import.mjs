import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {catalogueImportPlan} from './catalogue-import-plan.mjs';
const products=JSON.parse(await readFile('data/products.json','utf8'));
const store=JSON.parse(await readFile('config/store.json','utf8'));
const plan=catalogueImportPlan(products,store.categories);
await mkdir('outputs/catalogue-import',{recursive:true});
await writeFile('outputs/catalogue-import/draft-plan.json',JSON.stringify(plan,null,2)+'\n');
console.log(`Prepared ${plan.entries.length} unpublished product rows and ${plan.categories.length} categories. Price references and model totals retained as review metadata; variant allocation and hosted writes remain pending.`);
