import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const owner = (await readJSON('data/owner-image-manifest.json')).records;
const catalogue = (await readJSON('outputs/catalogue-import/persistent-catalogue.json')).products;
const manifestPath = 'data/image-manifest.json';
const manifest = (await readJSON(manifestPath)).filter(record => record.permission_basis !== 'owner_confirmed');
const productKeys = new Set([
  'iphone-16', 'iphone-17', 'iphone-17e', 'iphone-18-pro', 'iphone-air', 'iphone-duo',
  'airpods-pro-3', 'airpods-5', 'lenovo-legion-tower-5-gen-10-rtx-5070-ti',
  'acer-nitro-85-n85-100-ur35', 'cyberpowerpc-et99707'
]);
const pcFiles = {
  'acer-nitro-85-n85-100-ur35': ['side pic.webp', 'fornyt.webp', 'show.webp'],
  'cyberpowerpc-et99707': ['main_400.webp', '01_400.webp', '02_400.webp', '04_400.webp', '05_400.webp']
};
const assignments = [];
const approved = new Map();

async function localImage(record, product) {
  if (approved.has(record.source_sha256)) return approved.get(record.source_sha256).local_path;
  let path = record.path;
  const widths = path ? [480, 960, 1600] : [];
  if (!path) {
    path = `images/products/owner-${product.catalogue_key}-${record.source_sha256.slice(0, 16)}.webp`;
    const original = await readFile(record.original_local_path);
    const webp = await sharp(original).rotate().webp({ quality: 94 }).toBuffer();
    try {
      await writeFile(path, webp, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST' || !webp.equals(await readFile(path))) throw error;
    }
  }
  const metadata = await sharp(await readFile(path)).metadata();
  if (!metadata.width || !metadata.height) throw Error(`Invalid image: ${path}`);
  for (const width of widths) await readFile(path.replace(/-960\.webp$/, `-${width}.webp`));
  approved.set(record.source_sha256, {
    product_id: product.catalogue_key, database_product_id: product.id, product_name: product.name,
    local_path: path, width_variants: widths, source_sha256: record.source_sha256,
    source_width: record.width, source_height: record.height, angle: record.angle,
    image_kind: 'owner_supplied_product_asset',
    permission_status: 'approved', quality_status: 'approved', permission_basis: 'owner_confirmed'
  });
  return path;
}

for (const product of catalogue.filter(product => productKeys.has(product.catalogue_key))) {
  const key = product.catalogue_key;
  const pc = product.category === 'Gaming PCs';
  const audio = key.startsWith('airpods-');
  for (const variant of product.variants) {
    const pool = owner.filter(record => record.product_id === key && (pc || audio || record.color === variant.color));
    let records = pool.filter(record => record.review_status === 'matched_for_local_review' && record.path);
    if (pcFiles[key]) {
      records = pcFiles[key].map(name => pool.find(record => record.file.endsWith('/' + name)));
      if (records.some(record => !record)) throw Error(`Missing supplied PC angle for ${key}`);
    } else if (key === 'airpods-5') {
      // The earbuds can be shown before the retailer's charging-case configuration is identified.
      records = records.filter(record => /gallery-[12]/.test(record.file)).sort((a, b) => a.file.localeCompare(b.file));
    } else {
      records.sort((a, b) => Number(b.angle === 'main') - Number(a.angle === 'main')
        || Number(b.card_eligible) - Number(a.card_eligible));
    }
    if (!records.length) throw Error(`No matched photo for ${variant.catalogue_key}`);
    const paths = [];
    for (const record of records) paths.push(await localImage(record, product));
    const [main, ...gallery] = [...new Set(paths)];
    assignments.push({ id: variant.id, product_id: product.id, key: variant.catalogue_key, main, gallery });
  }
}

await writeFile(manifestPath, JSON.stringify([...manifest, ...approved.values()], null, 2) + '\n');
const sql = `begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('electronics-catalogue-import',0));
create temporary table supplied_media on commit drop as
select * from jsonb_to_recordset($media$${JSON.stringify(assignments)}$media$::jsonb)
  as row(id uuid, product_id uuid, key text, main text, gallery text[]);
do $$
begin
  if exists (
    select 1 from supplied_media m
    left join public.product_variants v on v.id=m.id and v.product_id=m.product_id and v.catalogue_key=m.key
    left join public.products p on p.id=v.product_id and p.published
    where p.id is null
  ) then raise exception 'Hosted product or variant identity differs from the reviewed media plan'; end if;
end $$;
update public.product_variants v
set image_path=m.main, gallery_paths=m.gallery, image_source='Owner-supplied image set',
  image_permission='approved', image_verified_at='2026-11-09T00:00:00Z'
from supplied_media m
where v.id=m.id and (v.image_path,v.gallery_paths,v.image_permission)
  is distinct from (m.main,m.gallery,'approved'::text);
commit;
`;
await writeFile('supabase/setup/apply-approved-product-media.sql', sql);
console.log(`Prepared ${approved.size} distinct photos for ${assignments.length} variants across ${productKeys.size} products.`);
