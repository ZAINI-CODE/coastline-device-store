import sharp from "sharp";
for (const name of ["iphone-16-ultramarine", "dualsense-original-white", "ps5-original-disc"]) for (const width of [480, 960]) await sharp(`images/studio/${name}.png`).resize({ width, withoutEnlargement: true }).webp({ quality: 90, effort: 6 }).toFile(`images/studio/${name}-${width}.webp`);
console.log("Created six optimized studio assets. Full-resolution originals retained.");
