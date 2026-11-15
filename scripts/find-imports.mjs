import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (['node_modules', '.git', 'dist'].includes(file)) continue;
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results = results.concat(walk(full));
      } else {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const files = walk('.');
console.log(`Scanned ${files.length} non-ignored files.`);

let count = 0;
for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.toLowerCase().includes('@import')) {
      console.log(`FOUND @import in: ${file}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('@import')) {
          console.log(`  L${idx + 1}: ${line.trim()}`);
        }
      });
      count++;
    }
  } catch (e) {}
}

console.log(`Total files with @import: ${count}`);
