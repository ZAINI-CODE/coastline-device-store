import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const types = { ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp":"image/webp", ".avif":"image/avif", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".xml": "application/xml", ".txt": "text/plain" };
const port=Number(process.env.FRONTEND_PREVIEW_PORT||4173);
const connected = process.argv.includes('--connected');
const infoPaths = new Set(['contact','shipping','returns','warranty','faq','privacy','terms','payment','about']);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if(pathname==='/config/public.json'){
      const config=connected?JSON.parse(await readFile(resolve(root,'config/public.json'),'utf8')):{frontendReview:true,supabaseUrl:'',supabaseKey:'',paypalClientId:''};
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      return res.end(JSON.stringify({...config,localTools:true}));
    }
    const reviewAsset=!connected&&(/^\/data\/(products|owner-image-manifest|iphone-pricing|store-zip-preview)\.json$/.test(pathname)||/^\/images\/products\/[\w.-]+\.(webp|avif|png|jpe?g)$/.test(pathname));
    const base=reviewAsset?resolve('.'):root;
    const route=pathname.replace(/^\/|\/$/g,'');
    const path = resolve(base, infoPaths.has(route)?`pages/${route}.html`:"." + pathname);
    if (path !== base && !path.startsWith(base + sep)) {
      res.writeHead(403);
      return res.end();
    }
    const file=path===root?resolve(root,'index.html'):pathname.endsWith('/')?resolve(path,'index.html'):path;
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(path)] || "text/html", "X-Content-Type-Options": "nosniff" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  const mode = connected ? 'Built integration preview' : 'Frontend-only review';
  console.log(`${mode} at http://localhost:${port}`);
});
