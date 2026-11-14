// Original vector artwork for Coastline Device. No source-reference pixels are used.
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('images/branding',{recursive:true});
const symbol=(ink,accent)=>`<path d="M54 20a34 34 0 1 0 0 60" fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><path d="M65 21h7a29 29 0 0 1 0 58h-7V21Z" fill="none" stroke="${accent}" stroke-width="8" stroke-linejoin="round"/><path d="M23 53c10-14 19 14 30 0s19-9 27-9" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round"/>`;
const icon=(ink,accent)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 100" role="img" aria-label="Coastline Device monogram"><g transform="translate(8 0)">${symbol(ink,accent)}</g></svg>`;
const logo=(ink,accent)=>`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="100" viewBox="0 0 360 100" role="img" aria-label="Coastline Device"><title>Coastline Device</title><g transform="translate(8 0)">${symbol(ink,accent)}</g><g fill="${ink}" font-family="Segoe UI,Arial,sans-serif"><text x="129" y="49" font-size="47" font-weight="600" letter-spacing="-1.7">Coastline</text><text x="132" y="81" font-size="23" font-weight="500" letter-spacing="6.1">Device</text></g></svg>`;
for(const [variation,ink,accent]of [['light','#102743','#147D97'],['dark','#F3F6F8','#64D3DC']]){
 const svg=logo(ink,accent),mark=icon(ink,accent);
 await writeFile(`images/branding/coastline-device-${variation}.svg`,svg);
 await sharp(Buffer.from(svg)).resize(1800,500).png().toFile(`images/branding/coastline-device-${variation}.png`);
 await writeFile(`images/branding/coastline-device-icon-${variation}.svg`,mark);
 await sharp(Buffer.from(mark)).resize(1180,1000).png().toFile(`images/branding/coastline-device-icon-${variation}.png`);
}
// Favicons have their own high-contrast tile; logo files remain transparent.
const favicon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#102743"/><g transform="translate(17 18) scale(.92)">${symbol('#F3F6F8','#64D3DC')}</g></svg>`;
await writeFile('favicon.svg',favicon);
for(const [name,size]of [['favicon-16x16.png',16],['favicon-32x32.png',32],['apple-touch-icon.png',180],['android-chrome-192x192.png',192],['android-chrome-512x512.png',512]])await sharp(Buffer.from(favicon)).resize(size,size).png().toFile(name);
const images=await Promise.all([16,32,48].map(size=>sharp(Buffer.from(favicon)).resize(size,size).png().toBuffer()));
const directory=Buffer.alloc(54);directory.writeUInt16LE(1,2);directory.writeUInt16LE(3,4);let offset=directory.length;
images.forEach((buffer,i)=>{const entry=6+16*i,size=[16,32,48][i];directory[entry]=size;directory[entry+1]=size;directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);directory.writeUInt32LE(buffer.length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=buffer.length;});
await writeFile('favicon.ico',Buffer.concat([directory,...images]));
console.log('Created original transparent logos, icon variants and favicon assets.');
