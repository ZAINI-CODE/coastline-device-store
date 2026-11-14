import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { loadLocalEnv } from "./load-env.mjs";
import { publicConfig } from "./public-config.mjs";
await loadLocalEnv();
const { supabaseUrl: url, supabaseKey: key } = publicConfig();
if (!url || !key) throw new Error("Public Supabase build variables are required. Never use the service-role key.");
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.rpc("storefront_catalogue");
if (error) throw new Error(error.message);
const rows = data.map(p=>({...p,database_id:p.id,model_number:p.model,published:true,
  variants:p.variants.filter(v=>Number.isInteger(v.price_cents)&&v.image_path).map(v=>({...v,active:true,image_permission:'approved',inventory:v.stock}))
}));
await mkdir('outputs/catalogue-export',{recursive:true});
await writeFile("outputs/catalogue-export/published-products.json", JSON.stringify(rows, null, 2) + "\n");
console.log("Exported", rows.length, "published products to outputs/catalogue-export/published-products.json. Local owner catalogue preserved.");
