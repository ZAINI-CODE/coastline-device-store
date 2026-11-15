import fs from 'node:fs';
import path from 'node:path';

const files = [];
function collect(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) collect(p);
    else if (/\.(html|js|mjs)$/.test(ent.name)) files.push(p);
  }
}
collect('.');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // check inline handlers: on[a-z]+ *=
  const handlerMatches = [...content.matchAll(/\bon(click|load|error|change|submit|input|keydown|keyup|mouseover|mouseout)\s*=/gi)];
  if (handlerMatches.length) {
    console.log('Inline handler in', file, handlerMatches.map(m => m[0]));
  }
  // check style= attribute
  const styleMatches = [...content.matchAll(/style\s*=\s*["'][^"']+["']/gi)];
  if (styleMatches.length) {
    console.log('style= attribute in', file, styleMatches.length, 'matches');
    for (const m of styleMatches.slice(0, 10)) {
      console.log('   ', m[0]);
    }
  }
  // check <style
  const styleTags = [...content.matchAll(/<style[\s>]/gi)];
  if (styleTags.length) {
    console.log('<style> tag in', file);
  }
  // check inline <script
  const scriptTags = [...content.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (scriptTags.length) {
    console.log('inline <script> tag in', file, scriptTags.map(m => m[0].slice(0, 80)));
  }
}
