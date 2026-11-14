import test from "node:test";
import assert from "node:assert/strict";
import { promotionEstimate } from "../js/promotions.js";
import { countdown, productOffer, productPriceMarkup, recentSalesMarkup, nextEasternMidnight } from "../js/product-promotions.js";
const offer = { active: true, kind: "bundle", minimum_quantity: 1, percent_basis_points: 1e3, discount_cents: 0, starts_at: "2026-01-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z", promotion_products: [{ product_id: "phone" }, { product_id: "audio" }] };
const now = Date.parse("2026-11-01");
test("bundle estimate updates with removal, variants, quantities and fixed discounts", () => {
  const lines = [{ product_id: "phone", price_cents: 1e4, quantity: 1 }, { product_id: "audio", price_cents: 2e3, quantity: 1 }];
  assert.equal(promotionEstimate(offer, lines, now).discount_cents, 1200);
  assert.equal(promotionEstimate(offer, lines.slice(0, 1), now).discount_cents, 0);
  assert.equal(promotionEstimate({ ...offer, percent_basis_points: 0, discount_cents: 2e4 }, lines, now).discount_cents, 12e3);
  assert.equal(promotionEstimate({ ...offer, active: false }, lines, now).discount_cents, 0);
  assert.equal(promotionEstimate(offer, lines, Date.parse("2028-01-01")).discount_cents, 0);
});

const variant = { id: 'base', price_cents: 9999, stock: 4 };
const standard = { ...offer, name: 'Autumn sale', kind: 'quantity', percent_basis_points: 1200 };
const daily = { ...standard, name: 'Daily Deal', percent_basis_points: 2000,
  starts_at: '2026-11-01T04:00:00Z', ends_at: '2026-11-02T05:00:00Z' };
const autumn = Date.parse('2026-11-01T22:00:00Z');
const phone = (...promotions) => ({ id: 'phone', promotions });

test('product price distinguishes standard, daily and Early Black Friday deals', () => {
  const early = { ...standard, name: 'Early Black Friday PC deals' };
  assert.match(productPriceMarkup(phone(standard), variant, { now: autumn }), /12% OFF[\s\S]*\$88\.00[\s\S]*<s>\$99\.99<\/s>/);
  assert.match(productPriceMarkup(phone(daily), variant, { detail: true, now: autumn }), /Ends in [\s\S]*07:00:00[\s\S]*<h2>\$80\.00<\/h2>/);
  assert.match(productPriceMarkup(phone(early), variant, { now: autumn }), /Early Black Friday Deal/);
  assert.equal(productOffer(phone(daily), variant, Date.parse(daily.starts_at)).style, 'daily');
  assert.equal(countdown(Date.parse(daily.ends_at), Date.parse(daily.starts_at)), '25:00:00');
  assert.equal(productOffer(phone({ ...daily, ends_at: '2026-11-02T04:00:00Z' }), variant, autumn).style, 'standard');
});

test('expired deals fall back to eligible prices for the selected variant', () => {
  const deadline = Date.parse(daily.ends_at);
  const upgrade = { ...variant, id: 'upgrade', price_cents: 19999 };
  assert.equal(countdown(deadline, deadline - 1), '00:00:01');
  assert.equal(countdown(deadline, deadline + 1), '00:00:00');
  assert.equal(productOffer(phone(standard, daily), upgrade, deadline - 1).price, 16000);
  assert.equal(productOffer(phone(standard, daily), upgrade, deadline).price, 17600);
  assert.equal(productPriceMarkup(phone(daily), upgrade, { now: deadline }), '<strong>$199.99</strong>');
});

test('ineligible, multi-unit, bundle and fixed offers do not produce single-unit percentage badges', () => {
  const excluded = phone(offer, { ...standard, minimum_quantity: 2 }, { ...standard, active: false },
    { ...standard, discount_cents: 100 }, { ...standard, starts_at: '2026-11-03T05:00:00Z' },
    { ...standard, promotion_products: [{ product_id: 'other' }] });
  assert.equal(productOffer(excluded, variant, autumn), null);
  assert.equal(productOffer(phone(standard), { ...variant, stock: 0 }, autumn), null);
});

test('campaign countdown uses the offer deadline and recent sales requires server confirmation', () => {
  const campaign = { ...standard, name: 'Countdown Deal', ends_at: '2027-01-02T05:00:00Z' };
  const now = Date.parse('2026-12-30T04:00:00Z');
  assert.match(productPriceMarkup(phone(campaign), variant, { now }), /Ends in [\s\S]*3d 01:00:00/);
  assert.equal(productOffer(phone(campaign), variant, Date.parse(campaign.ends_at)), null);
  assert.match(recentSalesMarkup(true), /12\+ sold in the past week/);
  for (const result of [false, null, undefined, 12, 'true']) assert.equal(recentSalesMarkup(result), '');
});

test('daily timer follows Eastern midnight throughout the campaign and stops on January 2', () => {
  const campaign={...standard,ends_at:'2027-01-02T05:00:00Z',promotion_products:[{product_id:'phone',percent_basis_points:1500,display_style:'daily'}]};
  for(const [time,expected] of [['2026-11-11T06:00:00Z','23:00:00'],['2026-11-11T23:00:00Z','06:00:00'],['2027-01-01T05:00:00Z','24:00:00']]) {
    const now=Date.parse(time), offer=productOffer(phone(campaign),variant,now);
    assert.equal(countdown(offer.timerEnds,now),expected);
    assert.equal(offer.basisPoints,1500);
  }
  assert.equal(nextEasternMidnight(Date.parse('2026-11-01T04:00:00Z')),Date.parse('2026-11-02T05:00:00Z'));
  assert.equal(productOffer(phone(campaign),variant,Date.parse('2027-01-02T05:00:00Z')),null);
});

test('one campaign applies phone, PC and audio percentages without stacking', () => {
  const campaign={...standard,percent_basis_points:0,promotion_products:[
    {product_id:'phone',percent_basis_points:1500},{product_id:'pc',percent_basis_points:1000},{product_id:'audio',percent_basis_points:1200}
  ]};
  const lines=[{product_id:'phone',price_cents:66045,quantity:1},{product_id:'pc',price_cents:209999,quantity:1},{product_id:'audio',price_cents:26145,quantity:1}];
  assert.equal(promotionEstimate(campaign,lines,autumn).discount_cents,9906+20999+3137);
  assert.equal(promotionEstimate(campaign,lines,Date.parse(campaign.ends_at)).discount_cents,0);
});
