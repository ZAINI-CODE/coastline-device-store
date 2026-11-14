import { escapeHTML as e } from "./core.js";
const supportLinks = '<nav class="policy-links" aria-label="Customer support"><a class="text-link" href="#/contact">Contact us →</a><a class="text-link" href="#/account">Order support →</a></nav>';
const policyContactPages = new Set(['contact', 'shipping', 'returns', 'warranty', 'payment', 'privacy', 'terms']);
function policyText(text) {
  return text.split(/\n\s*\n/).map(block => {
    const lines = block.trim().split('\n');
    if (lines.every(line => /^- /.test(line))) {
      return '<ul>' + lines.map(line => '<li>' + e(line.slice(2)) + '</li>').join('') + '</ul>';
    }
    if (lines.every(line => /^\d+\. /.test(line))) {
      return '<ol>' + lines.map(line => '<li>' + e(line.replace(/^\d+\. /, '')) + '</li>').join('') + '</ol>';
    }
    return '<p>' + e(lines.join(' ')) + '</p>';
  }).join('');
}
function informationPage(key, content, store) {
  const page = content[key];
  if (!page) return '<section class="wrap page"><h1>Page not found</h1><a href="#/">Return home</a></section>';
  const sections = (page.sections || []).map(({title,text}) => {
    return key === 'faq'
      ? `<details class="faq-item"><summary>${e(title)}</summary><p>${e(text)}</p></details>`
      : `<section class="policy-section"><h2>${e(title)}</h2>${policyText(text)}</section>`;
  }).join('');
  const contact = policyContactPages.has(key) && store?.supportEmail
    ? `<p><strong>${e(store.name || 'Customer support')}</strong> · <a href="mailto:${e(store.supportEmail)}">${e(store.supportEmail)}</a></p>` : '';
  return `<section class="wrap page prose policy-page"><span class="eyebrow">${key === "about" ? "THE STORE" : "CUSTOMER INFORMATION"}</span><h1>${e(page.title)}</h1>${page.paragraphs.map(text => `<p class="intro">${e(text)}</p>`).join('')}<div class="policy-sections">${sections}</div>${contact}${supportLinks}</section>`;
}
export {
  informationPage
};
