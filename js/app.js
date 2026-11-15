import {styleActions} from './action-styles.js';
import {interfaceIcon} from './interface-icons.js';
import {zelleInstructions,wireZelleForms} from './zelle-checkout.js';
import { connectionPage, wireConnection } from "./connection.js";
import { addressPicker, shippingFields, wireCheckoutAddresses } from "./checkout-addresses.js";
import { informationPage } from "./content.js";
import { bundlesPage, wireBundles } from "./bundles.js";
import { contactPage, wireContact } from "./contact.js";
import { creditsPage } from "./media.js";
import { initialize, db, catalogue, unwrap, invoke, settings } from "./api.js";
import { escapeHTML as e, money, normalizeCart, filterProducts } from "./core.js";
import { accountPage, wireAccount } from "./customer.js";
import { adminPage, wireAdmin } from "./admin.js";
import {catalogueDirectory} from './catalogue-directory.js';
import {initializeTheme} from './theme.js';
import {initializeMotion} from './motion.js';
import {availability,displayVariant,productCard,storefrontHome} from './storefront-ui.js';
import {mountGallery} from './product-gallery.js';
import {iphonePricingPage} from './iphone-pricing.js';
import {suppliedProductDetails} from './supplied-product-details.js';
import {purchaseLimit,remainingQuantity,quantityStepper,wireStepper,wireProductOptions} from './product-options.js';
import {productReviewsMarkup,wireReviewLikes} from './product-reviews.js';
import {rememberReview,resumeAfterSignIn,validStoreReturn} from './review-navigation.js';
import {specificationsMarkup} from './product-specifications.js';
import {showcaseMarkup,wireShowcase} from './product-showcase.js';
import {promotionEstimate} from './promotions.js';
import {productOffer,productPriceMarkup,recentSalesMarkup,wireProductPromotions} from './product-promotions.js';
let cleanupShowcase=()=>{};
let cleanupPromotions=()=>{};
let store, content, products = [], loadError = "", cart = [];
try {
  cart = normalizeCart(JSON.parse(localStorage.getItem("cart") || "[]"));
} catch {
}
const main = document.querySelector("main");
initializeTheme();
main.addEventListener('error',event=>{
  const photo=event.target;
  if(!photo.matches?.('[data-product-photo]'))return;
  if(photo.hasAttribute('srcset')&&photo.currentSrc&&photo.currentSrc!==photo.src){
    photo.removeAttribute('srcset');
    photo.removeAttribute('sizes');
    return;
  }
  photo.hidden=true;
  photo.closest('.product-image,.gallery-stage,.photo-art,.gaming-photo,.bundle-media')?.classList.add('neutral-media');
},true);
const revealPage=initializeMotion();
function notify(message) {
  const el = document.querySelector("#notice");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => el.classList.remove("visible"), 6e3);
}
function getCart() {
  return cart;
}
async function saveCart() {
  cart = normalizeCart(cart);
  localStorage.setItem("cart", JSON.stringify(cart));
  document.querySelector("#cart-count").textContent = cart.reduce((n, x) => n + x.quantity, 0);
  if (db) {
    const { data: { user } } = await db.auth.getUser();
    if (user) await unwrap(db.from("carts").upsert({ user_id: user.id, items: cart }));
  }
}
function empty(title = "The next great find is on its way.", text = "Check back soon to explore the collection.") {
  return `<div class="empty"><span class="empty-icon">\uFF0B</span><h3>${e(title)}</h3><p>${e(text)}</p><a class="text-link" href="#/contact">Get in touch <span>\u2197</span></a></div>`;
}
function card(p) { return productCard(p); }
function home() { return storefrontHome(products,store).replace('<section class="category-section',showcaseMarkup(products)+'<section class="category-section'); }
function attributeFilters(filters) {
  const options = [["type", "Product type", products.map((p) => p.product_type)], ["color", "Colour", products.flatMap((p) => p.variants.map((v) => v.color))], ["configuration", "Configuration", products.flatMap((p) => p.variants.map((v) => v.configuration))]];
  return options.map(([name, label, values]) => `<label>${label}<select name="${name}"><option value="">All</option>${[...new Set(values.filter(Boolean))].map((value) => `<option ${filters[name] === value ? "selected" : ""}>${e(value)}</option>`).join("")}</select></label>`).join("");
}
function shop(params) {
  const filters = Object.fromEntries(params);
  const available = params.get("available") === "on";
  const now = Date.now();
  const matching = products.map(p=>{
    const priceFor = v => productOffer(p,v,now)?.price ?? v.price_cents;
    const variants=p.variants.filter(v=>{
      const price = priceFor(v);
      return (
      (!filters.color||v.color===filters.color)&&(!filters.configuration||v.configuration===filters.configuration)
      &&(!available||purchaseLimit(p,v)>0)
      &&(!filters.min||!p.review_only&&Number.isInteger(price)&&price>=Number(filters.min)*100)
      &&(!filters.max||!p.review_only&&Number.isInteger(price)&&price<=Number(filters.max)*100)
      );
    });
    const prices=variants.map(priceFor).filter(Number.isInteger);
    return {...p,variants,price:!p.review_only&&prices.length?Math.min(...prices):null};
  });
  const items=filterProducts(matching,{q:filters.q,category:filters.category,brand:filters.brand,type:filters.type,sort:filters.sort});
  return `<section class="wrap page"><span class="eyebrow">EXPLORE THE COLLECTION</span><h1>${e(params.get("category") || "All electronics")}</h1><p class="intro">Your next connection starts here.</p><form id="filters" class="filters"><label>Search<input name="q" value="${e(filters.q || "")}" placeholder="Product, brand or model"></label><label>Category<select name="category"><option value="">All categories</option>${store.categories.map((c) => `<option ${filters.category === c ? "selected" : ""}>${e(c)}</option>`).join("")}</select></label><label>Brand<select name="brand"><option value="">All brands</option>${[...new Set(products.map((p) => p.brand))].map((b) => `<option ${filters.brand === b ? "selected" : ""}>${e(b)}</option>`).join("")}</select></label>${attributeFilters(filters)}<label>Min price<input name="min" type="number" min="0" value="${e(filters.min || "")}" placeholder="$0"></label><label>Max price<input name="max" type="number" min="0" value="${e(filters.max || "")}" placeholder="Any"></label><label>Sort<select name="sort">${[["", "Choose sorting"], ["featured", "Featured"], ["newest", "Newest"], ["low", "Price: low to high"], ["high", "Price: high to low"], ["name", "Name"], ...products.some((p) => p.review_count > 0) ? [["rating", "Customer rating"]] : []].map(([v, l]) => `<option value="${v}" ${filters.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label><label class="check"><input type="checkbox" name="available" ${filters.available ? "checked" : ""}> In stock</label><button class="button">Apply filters</button><a href="#/shop">Reset</a></form><p class="result-count">${items.length} products</p>${items.length ? `<div class="product-grid">${items.map(card).join("")}</div>` : empty(products.length ? "No matching products." : void 0, products.length ? "Try another search or adjust your filters." : void 0)}</section>`;
}
async function product(id) {
  const p = products.find((p2) => p2.id === id);
  if (!p) return `<section class="wrap page">${empty("Product unavailable.", "This product is not currently published. Browse the catalogue for available products.")}</section>`;
  const [[reviews, eligibility], hasRecentSales] = db ? await Promise.all([
    Promise.all([
      unwrap(db.from('reviews').select('id,display_name,rating,title,body,created_at,verified_purchase,feedback_source').eq('product_id', id).eq('approved', true).order('created_at', {ascending:false})),
      db.auth.getSession().then(({data}) => data.session ? unwrap(db.rpc('review_eligibility', {p_product:id})) : 'sign_in')
    ]).catch(() => [null, null]),
    unwrap(db.rpc('has_recent_product_sales', {p_product:id})).catch(() => false)
  ]) : [[[], null], false];
  return `<section class="wrap page"><a class="text-link" href="#/shop">\u2190 Back to the collection</a><div class="detail-grid"><div id="variant-image"></div><div><span class="eyebrow">${e(p.brand)}</span><h1>${e(p.name)}</h1><p>${e(p.description)}</p><div id="product-options"></div><label class="native-variant">Colour / configuration<select id="variant" tabindex="-1" aria-hidden="true">${p.variants.map((v) => `<option value="${e(v.id)}">${e([v.color,v.configuration].filter(Boolean).join(" / "))}</option>`).join("")}</select></label>${recentSalesMarkup(hasRecentSales)}<div id="variant-info" aria-live="polite"></div>${quantityStepper()}<button class="button" id="add">Add to cart \u2197</button> <button class="button" id="buy-now">Buy Now</button><p><a href="#/shipping">Shipping</a> · <a href="#/returns">Returns</a> · <a href="#/warranty">Warranty</a></p><div id="product-specifications"></div>${suppliedProductDetails(p)}<div id="variant-specs"></div></div></div>${productReviewsMarkup(reviews, eligibility)}<h2>Related products</h2><div class="product-grid">${products.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 4).map(card).join("")}</div></section>`;
}
function cartPage() {
  let subtotal = 0, pricedItems = 0;
  let unresolved=false;
  const rows = cart.map((line) => {
    const p = products.find((p2) => p2.variants.some((v2) => v2.id === line.variant_id)), v = p?.variants.find((v2) => v2.id === line.variant_id);
    if (Number.isInteger(v?.price_cents)) { subtotal += v.price_cents * line.quantity; pricedItems++; }
    if(!v||line.quantity>purchaseLimit(p,v))unresolved=true;
    return `<article class="cart-row"><div><h3>${e(p?.name || "Unavailable product")}</h3><p>${e(v ? [v.color,v.configuration].filter(Boolean).join(' / ') : "This item is unavailable.")}</p>${Number.isInteger(v?.price_cents) ? money(v.price_cents) : ""}${v?`<p>${availability(v)}</p>`:''}</div><label>Quantity<input class="cart-quantity" data-id="${e(line.variant_id)}" type="number" min="1" max="99" value="${line.quantity}"></label><button class="remove" data-id="${e(line.variant_id)}">Remove</button></article>`;
  }).join("");
  const lines=cart.map(line=>{const p=products.find(p=>p.variants.some(v=>v.id===line.variant_id));const v=p?.variants.find(v=>v.id===line.variant_id);return v&&Number.isInteger(v.price_cents)?{product_id:p.id,price_cents:v.price_cents,quantity:line.quantity}:null;}).filter(Boolean);
  const offers=[...new Map(products.flatMap(p=>p.promotions||[]).map(offer=>[offer.id,offer])).values()];
  const savings=Math.max(0,...offers.map(offer=>promotionEstimate(offer,lines).discount_cents));
  return `<section class="wrap page"><span class="eyebrow">YOUR SELECTION</span><h1>Shopping cart</h1>${cart.length ? `<div class="checkout-grid"><div>${rows}</div><aside class="panel"><h2>Order estimate</h2>${pricedItems?`<div class="total-line">${unresolved?"Known items subtotal":"Product subtotal"} <strong>${money(subtotal)}</strong></div>${savings?`<div class="total-line">Promotion savings <strong>−${money(savings)}</strong></div><div class="total-line">Product total <strong>${money(subtotal-savings)}</strong></div>`:""}`:""}<p>Discounts, shipping and tax are calculated by the server before payment.</p>${unresolved?'<p role="alert">Adjust quantities or remove unavailable items before continuing.</p><button class="button" disabled>Continue to checkout</button>':'<a class="button" href="#/checkout">Continue to checkout ↗</a>'}<p>Prices and inventory are revalidated.</p></aside></div>` : empty("Your cart is waiting.", "Explore the collection and add something you love.")}</section>`;
}
async function checkout() {
  const closed = '<section class="wrap page"><h1>Checkout</h1><p>Online ordering is currently unavailable.</p><a class="button" href="#/cart">Review cart</a></section>';
  if (!db) return closed;
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    sessionStorage.setItem("returnTo", "#/checkout");
    location.hash = "/account";
    return "";
  }
  if (new URLSearchParams(location.hash.split("?")[1] || "").get("order")) return `<section class="wrap page"><h1>Order & payment</h1><div class="panel payment-panel" id="payment"></div><a class="text-link" href="#/account">Return to your order history</a></section>`;
  const launch=await unwrap(db.from("store_settings").select("checkout_enabled,policies_approved,zelle_enabled,paypal_enabled").single());
  if(!store.policiesApproved||!launch.policies_approved||!launch.checkout_enabled)return closed;
  const methods=await invoke("payment_methods");
  if(!methods.zelle&&!methods.paypal)return closed;
  if(cart.some(line=>{const p=products.find(p=>p.variants.some(v=>v.id===line.variant_id));return line.quantity>purchaseLimit(p,p?.variants.find(v=>v.id===line.variant_id));}))return '<section class="wrap page"><h1>Checkout</h1><p role="alert">Your cart contains unavailable items. Review your selection before continuing.</p><a class="button" href="#/cart">Review cart</a></section>';
  const [rules, addresses, profile] = await Promise.all([unwrap(db.from("shipping_rules").select("*").eq("approved", true)), unwrap(db.from("customer_addresses").select("*")),unwrap(db.from("profiles").select("*").eq("id",user.id).maybeSingle())]);
  return `<section class="wrap page checkout-page"><span class="eyebrow">YOUR NEXT CONNECTION</span><h1>Checkout</h1><div class="checkout-steps" aria-label="Checkout steps"><span class="current">${interfaceIcon("pin")} Shipping</span><span>${interfaceIcon("card")} Payment</span><span>${interfaceIcon("check")} Confirmation</span></div><div class="checkout-grid"><form id="checkout" class="panel" data-contact-name="${e(profile?.display_name||user.user_metadata?.full_name||'')}" data-contact-phone="${e(profile?.phone||'')}"><h2 class="checkout-heading">${interfaceIcon("truck")} Shipping details</h2><label>Contact email<input type="email" value="${e(user.email)}" readonly required autocomplete="email"></label>${addressPicker(addresses, rules)}${shippingFields()}<label>Payment method<select name="method" required>${methods.zelle?'<option value="zelle">Zelle · manual bank verification</option>':''}<option value="paypal" disabled>PayPal — Temporarily Unavailable</option><option disabled>Credit/debit cards — unavailable</option></select></label><label class="check"><input type="checkbox" required> I have reviewed the store policies.</label><button type="submit" class="button action-positive" ${!cart.length || !rules.length ? "disabled" : ""}>Continue to payment</button></form><aside class="panel checkout-assurance"><span class="checkout-assurance-icon">${interfaceIcon("shield")}</span><h2>One step closer.</h2><p>Choose your delivery, then review the exact total before sending your Zelle payment.</p><div class="checkout-detail">${interfaceIcon("truck")} Standard shipping is free<br>Fast delivery is $25</div><div class="checkout-detail">${interfaceIcon("shield")} Bank receipt verified before processing</div><div id="payment"></div></aside></div></section>`;
}
async function render() {
  main.setAttribute("aria-busy","true");
  cleanupShowcase();
  cleanupPromotions();
  const [path, query = ""] = (location.hash.slice(1) || "/").split("?"), params = new URLSearchParams(query);
  document.title = (path === "/" ? "Home" : path.split("/")[1] || "Store") + " \xB7 " + (store.name || "Electronics");
  document.querySelector("#nav").classList.remove("open");
  document.querySelector("#nav details").open = false;
  document.querySelector("#menu").setAttribute("aria-expanded", "false");
  try {
    if(db&&['/','/shop','/cart','/checkout'].includes(path)||db&&path.startsWith('/product/'))products=await catalogue();
    if (path === "/") main.innerHTML = home();
    else if (path === "/shop") main.innerHTML = shop(params);
    else if (path.startsWith("/product/")) {
      const detail = await product(path.split("/")[2]);
      if (location.hash.slice(1).split("?")[0] !== path) return;
      main.innerHTML = detail;
    }
    else if (path === "/cart") main.innerHTML = cartPage();
    else if (path === "/checkout") main.innerHTML = await checkout();
    else if (path === "/contact") main.innerHTML = await contactPage(store);
    else if (path === "/credits") main.innerHTML = await creditsPage();
    else if(path==='/catalogue-review'&&settings.frontendReview) main.innerHTML=catalogueDirectory((await fetch('./data/products.json').then(r=>r.json())).filter(draft=>products.some(product=>product.id===draft.id)),store.categories);
    else if(path==='/iphone-prices'&&settings.frontendReview) {
      const pricePreview=await fetch('./data/iphone-pricing.json').then(r=>r.json());
      const rows=pricePreview.rows.filter(row=>products.some(product=>product.id===row.product_id));
      main.innerHTML=iphonePricingPage({...pricePreview,rows},params.get('product')||'');
    }
    else if (path === "/connection" && settings.localTools) main.innerHTML = await connectionPage();
    else if (path === "/account") main.innerHTML = await accountPage();
    else if (path === "/admin") main.innerHTML = await adminPage();
    else if (path === "/deals") main.innerHTML = await bundlesPage(products, async (lines) => {
      cart.push(...lines);
      await saveCart();
    });
    else {
      main.innerHTML = informationPage(path.slice(1), content, store);
    }
    const heading = main.querySelector("h1")?.textContent;
    if (path !== "/" && heading) document.title = heading + " \xB7 " + (store.name || "Electronics");
    if (loadError && !["/connection", "/account", "/admin"].includes(path)) main.insertAdjacentHTML("afterbegin", `<div class="error wrap" role="alert">${e(loadError)}</div>`);
    wire(path);styleActions(main);
    if (path === '/' || path === '/shop' || path.startsWith('/product/')) cleanupPromotions=wireProductPromotions(main,products);
    revealPage(main);
    if(settings.frontendReview&&settings.localTools) main.insertAdjacentHTML('afterbegin','<div class="review-banner wrap" role="note">Collection preview · Product photography and details for review. Orders, accounts and payments are unavailable in this preview.</div>');
    if(settings.frontendReview&&settings.localTools&&path==='/shop')main.querySelector('.intro').insertAdjacentHTML('afterend','<p><a class="text-link" href="#/iphone-prices">Preview iPhone prices · $200 below Apple reference ↗</a></p><p><a class="text-link" href="#/catalogue-review">Review the researched model list and photo status ↗</a></p>');
    document.querySelectorAll('#nav>a').forEach(a=>a.getAttribute('href')==='#'+path?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
    const reviewForm=main.querySelector('#review');
    if(path.startsWith('/product/')&&params.get('review')==='1'&&reviewForm&&!reviewForm.hidden)reviewForm.scrollIntoView({block:'start',behavior:'instant'});
    else window.scrollTo(0, 0);
  } catch (error) {
    main.innerHTML = `<section class="wrap page"><h1>Something needs attention.</h1><p role="alert">${path==='/admin'?e(error.message):'This page is temporarily unavailable. Please try again.'}</p><a href="#/">Return home</a></section>`;
  }
  finally {main.removeAttribute("aria-busy");}
}
function wire(path) {
  if(path==='/')cleanupShowcase=wireShowcase(main.querySelector('.product-showcase'));
  if(path==='/shop'){
    const form=document.querySelector('#filters'),disclosure=document.createElement('details'),summary=document.createElement('summary');
    disclosure.className='filters-disclosure';summary.textContent='Filter & sort';
    form.before(disclosure);disclosure.append(summary,form);
  }
  if (path === "/connection" && settings.localTools) wireConnection();
  if (path === "/checkout") {
    wireCheckoutAddresses();
    const id = new URLSearchParams(location.hash.split("?")[1] || "").get("order");
    if (id && db) safe(() => showPayment(id));
  }
  if (path === "/deals") wireBundles();
  if (path === "/contact") wireContact();
  document.querySelector("#filters")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    location.hash = "/shop?" + new URLSearchParams(new FormData(ev.target));
  });
  document.querySelectorAll(".remove").forEach((b) => b.onclick = async () => {
    cart = cart.filter((x) => x.variant_id !== b.dataset.id);
    await saveCart();
    render();
  });
  document.querySelectorAll(".cart-quantity").forEach(input=>{
    const p=products.find(p=>p.variants.some(v=>v.id===input.dataset.id)),v=p?.variants.find(v=>v.id===input.dataset.id);
    const field=document.createElement('div');field.innerHTML=quantityStepper(Number(input.value),'cart-'+input.dataset.id,'Quantity');
    const label=input.closest('label');label.replaceWith(field.firstElementChild);
    const root=document.getElementById('cart-'+input.dataset.id).closest('.quantity-field');
    root.querySelector('.quantity-limit').textContent=purchaseLimit(p,v)?'Maximum '+purchaseLimit(p,v):'Unavailable';
    wireStepper(root,{max:()=>purchaseLimit(p,v),onChange:async n=>{cart.find(x=>x.variant_id===input.dataset.id).quantity=n;await saveCart();const top=window.scrollY;await render();window.scrollTo({top,left:0,behavior:'instant'});}});
    if(purchaseLimit(p,v)>0&&Number(input.value)>purchaseLimit(p,v)){root.querySelector('input').value=input.value;root.querySelector('input').setAttribute('aria-invalid','true');root.querySelector('.quantity-limit').textContent='Exceeds current availability. Reduce to '+purchaseLimit(p,v)+' or remove this item.';}
  });
  if (path.startsWith("/product/")) {
    const p = products.find((p2) => p2.id === path.split("/")[2]);
    if (!p) return;
    const select=document.querySelector('#variant');
    const getVariant=()=>p.variants.find(v=>v.id===select.value);
    const syncQuantity=wireStepper(document.querySelector('#quantity').closest('.quantity-field'),{max:()=>remainingQuantity(p,getVariant(),cart)});
    const update = (rememberSelection = false) => {
      const v = p.variants.find((v2) => v2.id === document.querySelector("#variant").value);
      mountGallery(document.querySelector('#variant-image'),p,v);
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelector('#variant-image').animate?.([{opacity:.35},{opacity:1}],{duration:200});
      document.querySelector("#variant-info").innerHTML = `${productPriceMarkup(p,v,{detail:true})}<p>${availability(v)}</p>${v.sku ? `<p>SKU ${e(v.sku)}</p>` : ''}${v.active === false && v.stock > 0 ? "<p>This configuration is awaiting confirmation before purchase.</p>" : ""}`;
      document.querySelector("#product-specifications").innerHTML=specificationsMarkup(p,v);
      const accessories=(v.compatible_product_ids||[]).map(id=>products.find(item=>item.id===id)).filter(Boolean);
      document.querySelector("#variant-specs").innerHTML = accessories.length?`<h3>Compatible accessories</h3>${accessories.map(item=>`<p><a href="#/product/${e(item.id)}">${e(item.name)}</a></p>`).join('')}`:'';
      const limit = purchaseLimit(p, v);
      const remaining = remainingQuantity(p, v, cart);
      document.querySelector('#add').disabled = remaining < 1;
      document.querySelector('#buy-now').disabled = limit < 1;
      document.querySelector('#add').textContent = remaining > 0 ? 'Add to cart' : limit > 0 ? 'In cart' : 'Unavailable';
      document.querySelector('#quantity').closest('.quantity-field').hidden = limit === 0;
      document.querySelector('#quantity-limit').textContent = remaining > 0
        ? 'In Stock' : 'All available units are already in your cart.';
      syncQuantity();
      if (rememberSelection) {
        const url = new URL(location.href);
        url.hash = `#${path}?variant=${encodeURIComponent(v.id)}`;
        history.replaceState(history.state, '', url);
      }
      const info=document.querySelector('#variant-info');
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)info.animate?.([{opacity:.4},{opacity:1}],{duration:180});
    };
    select.onchange = () => update(true);
    const requestedVariant=new URLSearchParams(location.hash.split('?')[1]||'').get('variant');
    select.value=p.variants.some(v=>v.id===requestedVariant)?requestedVariant:displayVariant(p).id;
    wireProductOptions(p,select,()=>update(true));
    update();
    let adding = false;
    const addSelected = async (checkoutNow) => {
      if (adding) return;
      const quantity = Number(document.querySelector("#quantity").value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return notify("Choose a quantity from 1 to 99.");
      const variant=p.variants.find(v=>v.id===document.querySelector('#variant').value);
      if(!variant||quantity>remainingQuantity(p,variant,cart))return notify('This quantity is not available.');
      cart.push({ variant_id: document.querySelector("#variant").value, quantity });
      adding = true;
      try {
        await saveCart();
      } finally {
        adding = false;
      }
      if (checkoutNow) {
        location.hash = "/checkout";
        return;
      }
      update();
      const add=document.querySelector('#add');
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)add.animate?.([{transform:'scale(1)'},{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:220});
      notify("Added to your cart.");
    };
    document.querySelector('#add').onclick = () => safe(() => addSelected(false));
    document.querySelector('#buy-now').onclick = () => safe(() => {
      const variant = getVariant();
      const inCart = cart.find(line => line.variant_id === variant.id)?.quantity || 0;
      if (inCart > 0 && inCart === purchaseLimit(p, variant)) {
        location.hash = "/checkout";
        return;
      }
      return addSelected(true);
    });
    document.querySelector('#review')?.addEventListener('submit', ev => {
      ev.preventDefault();
      const form = ev.currentTarget;
      const button = form.querySelector('button');
      button.disabled = true;
      safe(async () => {
        const fields = new FormData(form);
        await unwrap(db.rpc('submit_review', {
          p_product: p.id, p_rating: Number(fields.get('rating')), p_title: fields.get('title'),
          p_body: fields.get('body'), p_name: fields.get('name')
        }));
        form.replaceWith(Object.assign(document.createElement('p'), {textContent:'Review submitted for moderation.'}));
        const addReview=document.querySelector('#add-review');if(addReview){addReview.disabled=true;addReview.setAttribute('aria-expanded','false');}
        notify('Review submitted for moderation.');
      }).finally(() => { button.disabled = false; });
    });
    const addReview=document.querySelector('#add-review');
    const openReview=()=>{
      if(addReview?.dataset.eligibility==='sign_in'){
        const target=rememberReview();location.hash='/account'+(target?'?return='+encodeURIComponent(target):'');return;
      }
      const form=document.querySelector('#review');if(!form)return;
      form.hidden=false;addReview.setAttribute('aria-expanded','true');form.querySelector('input')?.focus();
    };
    if(addReview)addReview.onclick=openReview;
    if(new URLSearchParams(location.hash.split('?')[1]||'').get('review')==='1'&&addReview?.dataset.eligibility==='eligible')openReview();
    wireReviewLikes(main,db).catch(()=>{});
  }
  document.querySelector("#checkout")?.addEventListener("submit", (ev) => safe(async () => {
    ev.preventDefault();
    const button = ev.target.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const f = Object.fromEntries(new FormData(ev.target));
      if (!ev.target.reportValidity() || !f.shipping) return;
      delete f.shipping_method;
      delete f.phone_display;
      const request = sessionStorage.getItem("checkout-request") || crypto.randomUUID();
      sessionStorage.setItem("checkout-request", request);
      const result = await invoke("place_order", { items: cart, address: f, shipping: f.shipping, method: f.method, request });
      sessionStorage.setItem("checkout-active-order",result.id);
      cart=[];await saveCart();
      sessionStorage.removeItem("checkout-request");
      location.hash="/checkout?order="+encodeURIComponent(result.id);
    } finally {
      button.disabled = false;
    }
  }));
  if (path === "/account") wireAccount(render);
  if (path === "/admin") wireAdmin(render);
}
async function safe(fn) {
  try {
    await fn();
  } catch (error) {
    notify(error.message);
  }
}
async function showPayment(id) {
  const o = await unwrap(db.from("orders").select("*").eq("id", id).single());
  const box = document.querySelector("#payment");
  if (o.method === "paypal" && o.payment_status === "processing") {
    const result = await invoke("paypal_reconcile", { id });
    if (["paid", "refunded", "partially_refunded"].includes(result.status)) {
      box.innerHTML = `<h2>Payment status: ${e(result.status)}</h2><p>Your provider payment status has been verified.</p>`;
      return;
    }
    box.innerHTML = '<h2>Payment is being reconciled</h2><p>Do not send a second payment. Check this order again or contact the store if it remains unresolved.</p><button id="recheck-payment">Check provider status again</button>';
    document.querySelector("#recheck-payment").onclick = () => safe(() => showPayment(id));
    return;
  }
  if (["paid", "refunded", "partially_refunded", "cancelled"].includes(o.payment_status) || o.stock_released) {
    box.innerHTML = `<h2>Payment status: ${e(o.payment_status)}</h2><p>Order ${e(o.id)}</p>`;
    return;
  }
  box.innerHTML = `<h3>Final order summary</h3>${[["Subtotal", o.subtotal_cents], ["Discount", -o.discount_cents], ["Shipping", o.shipping_cents], ...(o.tax_cents > 0 ? [["Tax", o.tax_cents]] : []), ["Total", o.total_cents]].map(([l, n]) => `<div class="total-line">${l}<strong>${money(n)}</strong></div>`).join("")}<p>Reference: ${e(o.id)}</p><p>Payment pending. Reservation expires ${e(new Date(o.expires_at).toLocaleString())}.</p><div id="paypal-buttons"></div>`;
  if (o.method === "zelle") {
    const result = await invoke("zelle_instructions", { id });
    box.querySelector("p").textContent="Order number: "+o.id;
    box.querySelector("p").nextElementSibling.remove();
    if(result.submitted){box.innerHTML=zelleInstructions(o,result);return;}
    box.insertAdjacentHTML("beforeend", zelleInstructions(o,result));
    wireZelleForms(box);styleActions(box);
    return;
  }
  throw new Error("PayPal is temporarily unavailable. Your order remains unpaid.");
  const methods=await invoke('payment_methods');
  if(!methods.paypal||methods.paypal_environment!=='sandbox'||!methods.paypal_client_id)throw new Error("PayPal is currently unavailable. Your order remains unpaid.");
  box.insertAdjacentHTML('beforeend','<p role="status">PayPal Sandbox test — no real money will be charged.</p>');
  if (!window.paypal) await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(methods.paypal_client_id)}&currency=USD&components=buttons&disable-funding=card,credit,paylater,venmo`;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load PayPal."));
    document.head.append(s);
  });
  window.paypal.Buttons({ fundingSource: window.paypal.FUNDING.PAYPAL, createOrder: async () => {
    const r = await invoke("paypal_create", { id });
    return r.provider_id;
  }, onApprove: async () => {
    const result = await invoke("paypal_capture", { id });
    if (result.status !== "paid") {
      notify("Order payment status: " + result.status);
      location.hash = "/account";
      return;
    }
    cart = [];
    await saveCart();
    notify("Payment verified by the server.");
    location.hash = "/account";
  }, onCancel: () => notify("PayPal cancelled. Your order remains unpaid."), onError: () => notify("Payment could not be completed. Check your order before trying again.") }).render("#paypal-buttons");
}
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
if (document.body.dataset.route && !location.hash) location.hash = document.body.dataset.route;
await initialize();
store = await fetch("./config/store.json").then((r) => r.json());
content = await fetch("./config/content.json").then((r) => r.json());



document.querySelector("#store-tagline").textContent = store.tagline || "Technology for the way you live.";
for (const value of [store.supportEmail, store.phone, store.hours].filter(Boolean)) {
  const p = document.createElement("p");
  p.textContent = value;
  document.querySelector("#store-tagline").after(p);
}
document.querySelector("#copyright").textContent = `© ${new Date().getFullYear()} Coastline Device. All rights reserved.`;
document.querySelector("#category-menu").innerHTML = store.categories.map((c) => `<a href="#/shop?category=${encodeURIComponent(c)}">${e(c)}</a>`).join("");
document.querySelector("#search").onsubmit = (ev) => {
  ev.preventDefault();
  location.hash = "/shop?q=" + encodeURIComponent(new FormData(ev.target).get("q"));
};
document.querySelector("#menu").onclick = () => {
  const open = document.querySelector("#nav").classList.toggle("open");
  document.querySelector("#menu").setAttribute("aria-expanded", String(open));
};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('#nav').classList.remove('open');document.querySelector('#menu').setAttribute('aria-expanded','false');document.querySelector('#nav details').open=false;}});
try {
  products = await catalogue();
} catch {
  loadError = "The catalogue could not be loaded. Please try again later.";
}
document.querySelector("#cart-count").textContent = cart.reduce((n, x) => n + x.quantity, 0);
document.addEventListener('click',event=>{if(!event.target.closest('a[href="#/account"]')||!db)return;event.preventDefault();const target=validStoreReturn(location.hash);safe(async()=>{const {data:{user}}=await db.auth.getUser();if(!user&&target)sessionStorage.setItem('returnTo',target);else sessionStorage.removeItem('returnTo');location.hash='/account';});});
window.addEventListener("hashchange", render);
if (db) db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") setTimeout(() => safe(async () => {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    const profileSync=await db.rpc("sync_my_profile");if(profileSync.error)notify("Signed in. Profile synchronization is temporarily unavailable.");
    try {
      const saved = await unwrap(db.from("carts").select("items").eq("user_id", user.id).maybeSingle());
      const merged = new Map(cart.map((x) => [x.variant_id, x.quantity]));
      for (const x of normalizeCart(saved?.items)) merged.set(x.variant_id, Math.max(merged.get(x.variant_id) || 0, x.quantity));
      cart = [...merged].map(([variant_id, quantity]) => ({ variant_id, quantity }));
      await saveCart();
    } catch {
      notify("Signed in. Your cart is still on this device.");
    }
    if(!resumeAfterSignIn())render();
  }), 0);
});
if(db){
 let refreshing=false;
 const refreshStock=async()=>{
  if(refreshing||document.hidden)return;
  refreshing=true;
  try{const next=await catalogue();const before=JSON.stringify(products);const after=JSON.stringify(next);products=next;if(before!==after&&/^#\/(shop|product|cart)/.test(location.hash))await render();}catch{notify('Inventory refresh unavailable. Prices and stock will be checked again before ordering.');}finally{refreshing=false;}
 };
 // Refresh the public projection without subscribing browsers to private inventory rows.
 window.addEventListener('focus',refreshStock);setInterval(refreshStock,30000);
}
render();
export {
  getCart,
  notify,
  safe,
  saveCart
};

