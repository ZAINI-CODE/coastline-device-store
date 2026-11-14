import { mkdir, readFile } from "node:fs/promises";
import { build, transform } from "esbuild";
const functions = ['store-api', 'paypal-webhook', 'refund-order', 'order-email'];
const entryPoints = functions.map((name) => `supabase/functions/${name}/index.ts`);
for (const path of ["supabase/functions/_shared/http.ts", "supabase/functions/_shared/server.ts", ...entryPoints]) {
  await transform(await readFile(path, "utf8"), { loader: "ts", target: "es2022" });
  console.log("Parsed", path);
}
if (process.argv.includes('--dashboard-bundles')) {
  const output = '.private/edge-dashboard';
  await mkdir(output, { recursive: true });
  for (const [index, name] of functions.entries()) {
    await build({
      entryPoints: [entryPoints[index]],
      outfile: `${output}/${name}/index.ts`,
      bundle: true,
      external: ['npm:*'],
      format: 'esm',
      platform: 'neutral',
      target: 'es2022'
    });
    console.log(`Prepared Dashboard bundle for ${name}`);
  }
}
