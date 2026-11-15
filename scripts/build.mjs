import { buildSEO } from "./seo.mjs";
import { publicConfig } from "./public-config.mjs";
import { loadLocalEnv } from "./load-env.mjs";
import {fetchPublishedCatalogue} from './seo-catalogue.mjs';
import { build, transform } from "esbuild";
import { mkdir, cp, writeFile, readFile, readdir, unlink, access } from "node:fs/promises";
await loadLocalEnv();
await mkdir("dist", { recursive: true });
for (const path of ["index.html", "google8e2f4d9e478d7709.html", "css", "robots.txt", "favicon.ico", "favicon.svg", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png", "site.webmanifest"]) await cp(path, `dist/${path}`, { recursive: true });
await cp('images/branding','dist/images/branding',{recursive:true});
await cp('node_modules/country-flag-icons/3x2','dist/images/flags',{recursive:true});
await mkdir('dist/config',{recursive:true});
for(const path of ['config/store.json','config/content.json'])await cp(path,'dist/'+path);
try { await unlink('dist/config/shipping.json'); } catch (error) { if(error.code!=='ENOENT')throw error; }
await mkdir('dist/data',{recursive:true});
const reviewData=['products.json','image-manifest.json','iphone-pricing.json','owner-image-manifest.json'];
for(const name of await readdir('dist/data'))if(reviewData.includes(name)||name.includes('studio')||name.includes('research'))await unlink('dist/data/'+name);
try{for(const name of await readdir('dist/images/studio'))await unlink('dist/images/studio/'+name);}catch(error){if(error.code!=='ENOENT')throw error;}
const images = JSON.parse(await readFile('data/image-manifest.json','utf8')).filter(r=>r.local_path&&r.permission_status==='approved'&&r.quality_status==='approved');
const assets = new Set();
for (const image of images) {
  if (!/^images\/products\/[\w.-]+\.(webp|avif|png|jpe?g)$/.test(image.local_path)) throw new Error('Invalid approved product image path');
  assets.add(image.local_path);
  for (const width of image.width_variants||[]) {
    if (!Number.isInteger(width) || !image.local_path.endsWith('-960.webp')) continue;
    const path=image.local_path.replace(/-960\.webp$/,`-${width}.webp`);
    try { await access(path); assets.add(path); } catch (error) { if(error.code!=='ENOENT')throw error; }
  }
}
await mkdir('dist/images/products',{recursive:true});
for(const file of await readdir('dist/images/products',{withFileTypes:true})){
  const path='images/products/'+file.name;
  if(file.isFile()&&!assets.has(path))await unlink('dist/'+path);
}
for(const path of assets)await cp(path,'dist/'+path);
const credits = images.filter(r=>r.licence&&!r.licence.startsWith('CC0')).map(({product_name,author,original_source,licence,licence_url,modifications})=>({product_name,author,original_source,licence,licence_url,modifications}));
await writeFile('dist/data/photo-attributions.json',JSON.stringify(credits));
await writeFile("dist/config/public.json", JSON.stringify(publicConfig()));
await build({entryPoints:['js/theme-init.js'],bundle:true,minify:true,format:'iife',outfile:'dist/js/theme-init.js',target:['es2022']});
await build({ entryPoints: ["js/app.js"], bundle: true, minify: true, format: "esm", outfile: "dist/js/app.js", target: ["es2022"] });
for (const file of await readdir("css")) if (file.endsWith(".css")) await writeFile("dist/css/" + file, (await transform(await readFile("css/" + file, "utf8"), { loader: "css", minify: true })).code);
const store = JSON.parse(await readFile("config/store.json", "utf8"));
await cp('THIRD-PARTY-LICENSES.txt','dist/THIRD-PARTY-LICENSES.txt');
await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${store.domain ? `<url><loc>${new URL("/", store.domain).href}</loc></url>` : ""}</urlset>`);
const seoCatalogue=await fetchPublishedCatalogue(publicConfig());
await buildSEO(store,seoCatalogue);
console.log(`Generated crawlable pages for ${seoCatalogue.products.length} published products.`);
console.log("Built dist. Unconfigured services remain unavailable.");
