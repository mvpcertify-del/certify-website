// Black Friday sale settings. Frontend only: the discount itself (code check, price change at checkout)
// is handled by the backend. Change the values here and the banner and popup follow.

export const BF_DISCOUNT = 30;
export const BF_CODE = 'CGBF30';

// Sale ends 30 Nov 2026, 11:59:59 pm Pakistan time (UTC+5). After this moment the banner and popup disappear by themselves.
export const BF_ENDS_AT = new Date('2026-11-30T23:59:59+05:00').getTime();

// Where the "Claim" buttons go.
export const BF_CTA_PATH = '/signup';

// Pages where the popup must not appear (forms, checkout). The banner still shows everywhere.
export const BF_POPUP_SKIP = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/checkout'];

// Popup: shown once per browser per day, after a short delay.
export const BF_POPUP_DELAY_MS = 3000;
export const BF_POPUP_STORAGE_KEY = 'certifycx-bf-popup-day';
