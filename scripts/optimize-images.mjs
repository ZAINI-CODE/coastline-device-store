import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
await mkdir("images/products", { recursive: true });
for (const [input, name] of [["iphone-16-ultramarine-original.png", "iphone-16-ultramarine"], ["dualsense-white-original.png", "dualsense-white"], ["ps5-original-disc-original.png", "ps5-original-disc"]]) {
  const source = "images/originals/" + input;
  for (const width of [480, 960, 1600]) {
    const path = `images/products/${name}-${width}.webp`;
    await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 88, effort: 6 }).toFile(path);
    console.log(path, (await stat(path)).size);
  }
}
