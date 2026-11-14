import { mkdir, writeFile, access } from "node:fs/promises";
const files = [
  ["iphone-16-ultramarine-original.png", "https://upload.wikimedia.org/wikipedia/commons/a/a0/IPhone_16_Ultramarine_Rear.png"],
  ["airpods-4-original.jpg", "https://upload.wikimedia.org/wikipedia/commons/2/23/Airpods_4.jpg"],
  ["dualsense-white-original.png", "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Playstation_DualSense_Controller.png/1280px-Playstation_DualSense_Controller.png"],
  ["ps5-original-disc-original.png", "https://upload.wikimedia.org/wikipedia/commons/1/1b/PlayStation_5_and_DualSense_with_transparent_background.png"]
];
await mkdir("images/originals", { recursive: true });
for (const [name, url] of files) {
  try {
    await access("images/originals/" + name);
    console.log(name, "already downloaded");
    continue;
  } catch {
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": "ElectronicsStoreAssetPreparation/1.0 (licensed image download)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    await writeFile("images/originals/" + name, bytes);
    console.log(name, bytes.length, "bytes");
  } catch (error) {
    console.error(name, error.message);
    process.exitCode = 1;
  }
}
