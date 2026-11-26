// Black Friday sale settings. Frontend only: the discount itself is a promo code created on the Whop plan (Whop dashboard,
// plan "ISO 9001 Certification Package for Micro Companies"); this site only shows the offer and sends buyers to that checkout.
// Change the values here and the banner and popup follow.
//
// 26 Nov 2026 (client): 60% off, code CGBF60, ISO 9001 for micro and small companies, sold on Whop. It was 30% / CGBF30 earlier
// the same day. The code must exist on Whop with the same spelling and end time, or buyers will see "invalid code".

import { getPriceForStandard } from '../utils/pricing';
import { whopCheckoutUrl } from '../utils/whopPlans';

export const BF_DISCOUNT = 60;
export const BF_CODE = 'CGBF60';

// What the offer is on, and the two prices shown (list price comes from utils/pricing.js, so it cannot drift from the page prices).
export const BF_PRODUCT = 'ISO 9001 for micro & small companies';
export const BF_FULL_PRICE = getPriceForStandard('iso-9001');
export const BF_SALE_PRICE = Math.round(BF_FULL_PRICE * (100 - BF_DISCOUNT)) / 100;
export const fmtUsd = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

// Sale ends 30 Nov 2026, 11:59:59 pm Pakistan time (UTC+5). After this moment the banner and popup disappear by themselves.
export const BF_ENDS_AT = new Date('2026-11-30T23:59:59+05:00').getTime();

// Where the "Claim" buttons go: the Whop checkout of the plan the code works on (the buyer types the code there).
export const BF_CTA_URL = whopCheckoutUrl('iso-9001');

// Pages where the popup must not appear (forms, checkout). The banner still shows everywhere.
export const BF_POPUP_SKIP = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/checkout'];

// Popup: shown once per browser per day, after a short delay.
export const BF_POPUP_DELAY_MS = 3000;
export const BF_POPUP_STORAGE_KEY = 'certifycx-bf-popup-day';
