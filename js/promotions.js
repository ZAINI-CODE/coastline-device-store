function promotionEstimate(promotion, lines, now = Date.now()) {
  const subtotal = lines.reduce((sum, line) => sum + line.price_cents * line.quantity, 0);
  const eligibleIds = [...new Set((promotion.promotion_products || []).map((row) => row.product_id))];
  const eligible = lines.filter((line) => eligibleIds.includes(line.product_id));
  const quantities = /* @__PURE__ */ new Map();
  for (const line of eligible) quantities.set(line.product_id, (quantities.get(line.product_id) || 0) + line.quantity);
  const started = now >= new Date(promotion.starts_at).getTime(), notExpired = now < new Date(promotion.ends_at).getTime();
  let reason = "", applies = Boolean(promotion.active && started && notExpired && eligibleIds.length);
  if (!applies) reason = "This offer is not currently active.";
  else if (promotion.kind === "bundle" && eligibleIds.some((id) => (quantities.get(id) || 0) < promotion.minimum_quantity)) {
    applies = false;
    reason = "Select all required bundle products and quantities.";
  } else if (promotion.kind === "quantity" && eligible.reduce((n, l) => n + l.quantity, 0) < promotion.minimum_quantity) {
    applies = false;
    reason = "Add the minimum eligible quantity to use this offer.";
  }
  const base = eligible.reduce((sum, line) => sum + line.price_cents * line.quantity, 0);
  const hasProductRates = promotion.promotion_products?.some(row => Number.isInteger(row.percent_basis_points));
  const percentageDiscount = hasProductRates ? eligible.reduce((sum, line) => {
    const rule = promotion.promotion_products.find(row => row.product_id === line.product_id);
    return sum + Math.floor(line.price_cents * (rule.percent_basis_points ?? promotion.percent_basis_points) / 10000) * line.quantity;
  }, 0) : Math.floor(base * promotion.percent_basis_points / 10000);
  const discount = applies ? Math.min(base, promotion.discount_cents > 0 ? promotion.discount_cents : percentageDiscount) : 0;
  return { subtotal_cents: subtotal, discount_cents: discount, total_cents: subtotal - discount, applies, reason };
}
export {
  promotionEstimate
};
