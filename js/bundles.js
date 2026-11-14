import { db, unwrap } from "./api.js";
import { escapeHTML as e, money } from "./core.js";
import { productImages, mediaImage } from './product-media.js';
import { availability } from './storefront-ui.js';
import { remainingQuantity, purchaseLimit } from './product-options.js';
import { promotionEstimate } from "./promotions.js";
import { safe, notify, getCart } from "./app.js";
let offers = [], catalogue = [], addItems;
async function bundlesPage(products, add) {
  catalogue = products.map(p=>({...p,variants:p.variants.filter(v=>purchaseLimit(p,v)>0)})).filter(p=>p.variants.length);
  addItems = add;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  offers = db ? await unwrap(db.from("promotions").select("*,promotion_products(product_id,percent_basis_points,display_style)").eq("active", true).lte("starts_at", now).gt("ends_at", now)) : [];
  return `<section class="wrap page"><span class="eyebrow">BETTER TOGETHER</span><h1>Deals & bundles</h1><p class="intro">Build a combination that works for you.</p>${offers.length ? offers.map((offer) => {
    const required = offer.promotion_products.map((r) => catalogue.find((p) => p.id === r.product_id));
    if (required.some((p) => !p)) return `<article class="panel"><h2>${e(offer.name)}</h2><p>This offer is currently unavailable.</p></article>`;
    return `<form class="panel bundle-form" data-offer="${e(offer.id)}"><div class="section-head"><div><h2>${e(offer.name)}</h2><p>${offer.kind === "bundle" ? "Choose every required product" : "Choose eligible products"} \xB7 ${offer.discount_cents ? money(offer.discount_cents) : offer.promotion_products.some(row=>Number.isInteger(row.percent_basis_points)) ? [...new Set(offer.promotion_products.map(row=>(row.percent_basis_points ?? offer.percent_basis_points)/100+"%"))].join(" / ") : offer.percent_basis_points / 100 + "%"} off \xB7 Ends ${e(new Date(offer.ends_at).toLocaleDateString())}</p></div></div><div class="bundle-grid">${required.map((p) => `<article class="bundle-item" data-product="${e(p.id)}"><label class="check"><input name="include" type="checkbox" checked> ${e(p.name)}</label><div class="bundle-media"></div><label>Variant<select name="variant">${p.variants.map((v) => `<option value="${e(v.id)}">${e(v.color + " / " + v.configuration)} \xB7 ${money(v.price_cents)}</option>`).join("")}</select></label><label>Quantity<input name="quantity" type="number" min="1" max="99" value="${offer.minimum_quantity}"></label><p class="bundle-item-price"></p></article>`).join("")}</div><div class="bundle-summary" aria-live="polite"></div><button class="button" type="submit">Add selection to cart</button><p class="quote-note">This is an estimate. The server revalidates eligibility, prices, stock and the best available offer at checkout. Offers do not combine. Shipping and tax are shown before payment.</p></form>`;
  }).join("") : '<div class="empty"><h2>No active offers yet.</h2><p>Check back for our latest offers.</p><a class="text-link" href="#/shop">Explore the collection \u2192</a></div>'}</section>`;
}
function selection(form) {
  const lines = [];
  for (const item of form.querySelectorAll("[data-product]")) {
    if (!item.querySelector("[name=include]").checked) continue;
    const p = catalogue.find((p2) => p2.id === item.dataset.product), v = p.variants.find((v2) => v2.id === item.querySelector("[name=variant]").value), quantity = Number(item.querySelector("[name=quantity]").value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Choose quantities from 1 to 99.");
    lines.push({ variant_id: v.id, product_id: p.id, price_cents: v.price_cents, quantity, stock: remainingQuantity(p,v,getCart()) });
  }
  return lines;
}
function wireBundles() {
  document.querySelectorAll(".bundle-form").forEach((form) => {
    const offer = offers.find((o) => o.id === form.dataset.offer), update = () => {
      for (const item of form.querySelectorAll("[data-product]")) {
        const p = catalogue.find((p2) => p2.id === item.dataset.product), v = p.variants.find((v2) => v2.id === item.querySelector("[name=variant]").value);
        const image = productImages(p,v)[0], media=item.querySelector('.bundle-media');
        if (media.dataset.variant !== v.id) {
          media.dataset.variant=v.id;
          media.innerHTML=image?mediaImage(image,{className:'bundle-image'}):'';
        }
        item.querySelector(".bundle-item-price").textContent = money(v.price_cents) + " each · " + ((offer.promotion_products.find(row=>row.product_id===p.id)?.percent_basis_points ?? offer.percent_basis_points)/100) + "% off · " + availability(v);
      }
      try {
        const lines = selection(form), estimate = promotionEstimate(offer, lines), available = lines.length && lines.every((l) => l.stock >= l.quantity);
        form.querySelector(".bundle-summary").innerHTML = `<div class="total-line">Individual product total <strong>${money(estimate.subtotal_cents)}</strong></div><div class="total-line">Offer savings <strong>${money(estimate.discount_cents)}</strong></div><div class="total-line">Selection total <strong>${money(estimate.total_cents)}</strong></div><p>${e(estimate.reason || "Eligible combination selected.")}${!available ? " Some selected quantities are unavailable." : ""}</p>`;
        form.querySelector("[type=submit]").disabled = !available;
      } catch (error) {
        form.querySelector(".bundle-summary").textContent = error.message;
        form.querySelector("[type=submit]").disabled = true;
      }
    };
    form.addEventListener("change", update);
    form.addEventListener("input", update);
    update();
    form.onsubmit = (event) => safe(async () => {
      event.preventDefault();
      const lines = selection(form);
      if (!lines.length || lines.some((l) => l.quantity > l.stock)) throw new Error("Check product quantities and availability.");
      await addItems(lines.map(({ variant_id, quantity }) => ({ variant_id, quantity })));
      notify("Your selection was added to the cart.");
    });
  });
}
export {
  bundlesPage,
  wireBundles
};
