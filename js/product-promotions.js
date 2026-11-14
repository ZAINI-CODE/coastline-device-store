import {escapeHTML as e, money} from './core.js';
import {purchaseLimit} from './product-options.js';
import {promotionEstimate} from './promotions.js';

const easternTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'
});
const offerDate = new Intl.DateTimeFormat('en-US', {
  timeZone:'America/New_York', month:'short', day:'numeric', year:'numeric'
});

export function nextEasternMidnight(now) {
  const date = easternDate.format(now);
  const nextDate = new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  return [4,5].map(hour => Date.parse(nextDate+`T0${hour}:00:00Z`))
    .find(time => easternTime.format(time) === '00:00:00');
}

function promotionStyle(offer) {
  if (/^early black friday\b/i.test(offer.name)) return 'early';
  if (/^countdown deal\b/i.test(offer.name)) return 'countdown';
  const start = Date.parse(offer.starts_at), end = Date.parse(offer.ends_at);
  const hours = (end - start) / 3600000;
  if (/^daily deal\b/i.test(offer.name) && [23, 24, 25].includes(hours) &&
      [start, end].every(time => time % 1000 === 0 && easternTime.format(time) === '00:00:00')) return 'daily';
  return 'standard';
}

export function productOffer(product, variant, now = Date.now()) {
  if (!purchaseLimit(product, variant)) return null;
  const line = {product_id: product.id, price_cents: variant.price_cents, quantity: 1};
  let best = null;
  for (const offer of product.promotions || []) {
    const ends = Date.parse(offer.ends_at);
    const rule = offer.promotion_products?.find(row => row.product_id === product.id);
    const basisPoints = rule?.percent_basis_points ?? offer.percent_basis_points;
    if (offer.kind !== 'quantity' || offer.minimum_quantity !== 1 || offer.discount_cents !== 0 ||
        !Number.isInteger(basisPoints) || basisPoints <= 0 || basisPoints >= 10000 || !(ends > now)) continue;
    const estimate = promotionEstimate(offer, [line], now);
    if (estimate.discount_cents > (best?.discount || 0)) {
      const style = rule?.display_style && rule.display_style !== 'standard' ? rule.display_style : promotionStyle(offer);
      best = {price: estimate.total_cents, discount: estimate.discount_cents, ends, basisPoints, style,
        timerEnds: style === 'daily' ? Math.min(ends,nextEasternMidnight(now)) : ends};
    }
  }
  return best;
}

export function countdown(ends, now, showDays = false) {
  const seconds = Math.max(0, Math.ceil((ends - now) / 1000));
  const days = showDays ? Math.floor(seconds / 86400) : 0;
  const clock = [Math.floor(seconds / 3600) - days * 24, Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
  return days ? `${days}d ${clock}` : clock;
}

function priceContent(variant, offer, detail, now) {
  const tag = detail ? 'h2' : 'strong';
  if (!offer) return `<${tag}>${money(variant.price_cents)}</${tag}>`;
  const percent = offer.basisPoints / 100;
  const label = ['daily', 'countdown'].includes(offer.style) ? `${offer.style === 'daily' ? 'Daily Deal · ' : ''}Ends in <span data-promotion-clock="${offer.style}">${countdown(offer.timerEnds, now, offer.style === 'countdown')}</span>`
    : offer.style === 'early' ? 'Early Black Friday Deal' : `${percent}% OFF`;
  return `<div class="sale-pricing sale-pricing--${offer.style}">
    <span class="sale-badge">${label}</span>
    <div class="sale-price-line">${offer.style === 'standard' ? '' : `<span class="sale-percent">${percent}% off</span>`}<${tag}>${money(offer.price)}</${tag}></div>
    <span class="sale-reference">Regular price <s>${money(variant.price_cents)}</s></span>
    <span class="sale-reference">Save ${money(offer.discount)}</span>
    ${offer.style === 'daily' ? `<span class="sale-reference">Timer resets daily at midnight ET. Offer through ${offerDate.format(offer.ends-1)}.</span>` : ''}
  </div>`;
}

export function recentSalesMarkup(hasRecentSales) {
  return hasRecentSales === true ? '<p class="recent-sales">12+ sold in the past week</p>' : '';
}

export function productPriceMarkup(product, variant, {detail = false, now = Date.now()} = {}) {
  if (product.review_only || !Number.isInteger(variant.price_cents)) return '';
  const offer = productOffer(product, variant, now);
  const content = priceContent(variant, offer, detail, now);
  return offer ? `<div data-sale-price data-product="${e(product.id)}" data-variant="${e(variant.id)}" data-detail="${detail}" data-ends="${offer.timerEnds}">${content}</div>` : content;
}

export function wireProductPromotions(root, products) {
  if (!products.some(product => product.promotions?.length)) return () => {};
  const byId = new Map(products.map(product => [product.id, product]));
  const timer = setInterval(() => {
    const now = Date.now();
    for (const element of root.querySelectorAll('[data-sale-price]')) {
      const ends = Number(element.dataset.ends);
      if (ends <= now) {
        const product = byId.get(element.dataset.product);
        const variant = product?.variants.find(item => item.id === element.dataset.variant);
        if (variant) element.outerHTML = productPriceMarkup(product, variant, {detail: element.dataset.detail === 'true', now});
      } else {
        const clock = element.querySelector('[data-promotion-clock]');
        if (clock) {
          const label = countdown(ends, now, clock.dataset.promotionClock === 'countdown');
          if (clock.textContent !== label) clock.textContent = label;
        }
      }
    }
  }, 250);
  return () => clearInterval(timer);
}
