import fs from 'node:fs';
import path from 'node:path';

const files = [];
function collect(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === '.private') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) collect(p);
    else if (/\.(html|js|mjs)$/.test(ent.name)) files.push(p);
  }
}
collect('.');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // check style= in strings
  const styleAttrMatches = [...content.matchAll(/style\s*=\s*["'][^"']+["']/gi)];
  if (styleAttrMatches.length) {
    console.log('style= attribute in', file);
    styleAttrMatches.forEach(m => console.log('   ', m[0].slice(0, 100)));
  }

  // check .style. in js
  const elemStyle = [...content.matchAll(/\.style\.[a-zA-Z]+\s*=/g)];
  if (elemStyle.length) {
    console.log('.style.prop in', file);
    elemStyle.forEach(m => console.log('   ', m[0]));
  }

  // check setAttribute('style'
  const setAttrStyle = [...content.matchAll(/setAttribute\s*\(\s*["']style["']/gi)];
  if (setAttrStyle.length) {
    console.log('setAttribute("style") in', file);
  }
}
