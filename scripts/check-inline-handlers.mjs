import fs from 'node:fs';
for (const f of fs.readdirSync('js')) {
  const content = fs.readFileSync('js/' + f, 'utf8');
  // Check for HTML inline event handler attributes like onclick="...", onsubmit='...', onerror=
  const htmlAttrMatches = [...content.matchAll(/\bon[a-z]{3,15}\s*=\s*['"][^'"]+['"]/gi)];
  // Also check without quotes e.g. onerror=this.remove()
  const unquotedMatches = [...content.matchAll(/\bon[a-z]{3,15}\s*=\s*[^'"\s>]+/gi)];
  // Check for DOM property assignment element.onclick =
  const domPropMatches = [...content.matchAll(/\.[a-zA-Z0-9_$]+\s*\.\s*on[a-z]{3,15}\s*=/gi)];
  const directPropMatches = [...content.matchAll(/\bon(click|submit|change|load|error|input|keydown|keyup)\s*=/g)];
  
  if (htmlAttrMatches.length || unquotedMatches.length) {
    console.log(`[HTML ATTRIBUTE] ${f}:`);
    for (const m of htmlAttrMatches) console.log('   quoted:', m[0].slice(0, 100));
    for (const m of unquotedMatches) console.log('   unquoted:', m[0].slice(0, 100));
  }
}
