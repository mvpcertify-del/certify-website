// Black Friday sale settings. The banner and popup only SHOW the offer; the discount itself is the coupon row CGBF60 in
// discount_coupons (supabase/phase54_cgbf60_coupon.sql), applied by certify.cx's checkout and limited to ISO 9001.
// Change the values here and the banner and popup follow; the coupon row must be changed to match.
//
// 26 Nov 2026 (client): 60% off, code CGBF60, ISO 9001 for micro and small companies. It was 30% / CGBF30 earlier the same day.
// The coupon row must exist with the same spelling and end time, or buyers will see "invalid code".

import { getPriceForStandard } from '../utils/pricing';

export const BF_DISCOUNT = 60;
export const BF_CODE = 'CGBF60';

// What the offer is on, and the two prices shown (list price comes from utils/pricing.js, so it cannot drift from the page prices).
export const BF_PRODUCT = 'ISO 9001 for micro & small companies';
export const BF_FULL_PRICE = getPriceForStandard('iso-9001');
export const BF_SALE_PRICE = Math.round(BF_FULL_PRICE * (100 - BF_DISCOUNT)) / 100;
export const fmtUsd = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

// Sale ends 30 Nov 2026, 11:59:59 pm Pakistan time (UTC+5). After this moment the banner and popup disappear by themselves.
export const BF_ENDS_AT = new Date('2026-11-30T23:59:59+05:00').getTime();

// Where the "Claim" buttons go: the ISO 9001 checkout with the code already in the link (the checkout applies it by itself).
export const BF_CTA_PATH = `/checkout?iso=iso-9001&coupon=${BF_CODE}`;

// Pages where the popup must not appear (forms, checkout). The banner still shows everywhere.
export const BF_POPUP_SKIP = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/checkout'];

// Popup: shown once per browser per day, after a short delay.
export const BF_POPUP_DELAY_MS = 3000;
export const BF_POPUP_STORAGE_KEY = 'certifycx-bf-popup-day';
