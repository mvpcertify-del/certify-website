// -------------------------------------------------------
// Hidden $1 test item for verifying the Whop checkout end-to-end with a real
// card charge, without touching real pricing or needing a one-off coupon.
//
// Reachable ONLY via a direct link — /checkout?iso=test-payment — because it
// is deliberately NOT part of ISO_CATALOG_LIST or COMPLIANCE_SERVICE_LIST,
// the two lists the public "choose a standard" picker on /checkout renders
// (see src/pages/public/Checkout.jsx). It never appears on the landing page,
// /certifications, or the picker grid.
//
// Delete this file and its three call sites (src/utils/pricing.js,
// src/pages/public/Checkout.jsx) once Whop is verified live and this is no
// longer needed.
// -------------------------------------------------------
export const TEST_CHECKOUT_ITEM = {
  slug: 'test-payment',
  code: 'TEST PAYMENT',
  fullCode: 'TEST PAYMENT ($1)',
  price: 1,
};

export function getTestCheckoutItem(slug) {
  return slug === TEST_CHECKOUT_ITEM.slug ? TEST_CHECKOUT_ITEM : null;
}
