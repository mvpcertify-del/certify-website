// -------------------------------------------------------
// $1 test item for verifying the Whop checkout end-to-end with a real card
// charge, without touching real pricing or needing a one-off coupon.
//
// Shown on the /checkout picker (src/pages/public/Checkout.jsx) as its own
// "Internal Test" group, styled identically to a real ISO/compliance card —
// deliberately NOT mixed into ISO_CATALOG_LIST or COMPLIANCE_SERVICE_LIST
// though, so it can never appear on the public landing page or
// /certifications, only on the /checkout picker itself.
//
// Delete this file and its call sites (src/utils/pricing.js,
// src/pages/public/Checkout.jsx, and the testGroupTitle/testPaymentTitle i18n
// keys) once Whop is verified live and this is no longer needed.
// -------------------------------------------------------
export const TEST_CHECKOUT_ITEM = {
  slug: 'test-payment',
  code: 'TEST PAYMENT',
  fullCode: 'TEST PAYMENT ($1)',
  titleKey: 'checkout.testPaymentTitle',
  price: 1,
};

export const TEST_CHECKOUT_ITEM_LIST = [TEST_CHECKOUT_ITEM];

export function getTestCheckoutItem(slug) {
  return slug === TEST_CHECKOUT_ITEM.slug ? TEST_CHECKOUT_ITEM : null;
}
