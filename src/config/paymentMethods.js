// -------------------------------------------------------
// Certify.cx — Payment Methods
//
// The four payment methods offered at checkout. Two are processed online
// through Stripe (card, PayPal); two are offline/manual (MoneyGram, bank
// transfer) where the buyer transfers funds out-of-band and an admin
// verifies receipt before the application proceeds.
//
//   online  → api/checkout.js creates a Stripe Checkout session whose
//             payment_method_types is set from `stripeMethod`.
//   offline → no Stripe session; the order is persisted with
//             payment_status='awaiting_verification' and the buyer is shown
//             the transfer instructions below.
//
// Labels/descriptions are i18n keys resolved with t() in the UI — the raw
// account details (IBAN, MoneyGram receiver) are NOT translated.
// -------------------------------------------------------

export const PAYMENT_METHODS = [
  {
    id: 'card',
    type: 'online',
    stripeMethod: 'card',
    icon: 'CreditCard',
    labelKey: 'payment.methodCard',
    descKey: 'payment.methodCardDesc',
  },
  {
    id: 'paypal',
    type: 'online',
    stripeMethod: 'paypal',
    icon: 'Wallet',
    labelKey: 'payment.methodPaypal',
    descKey: 'payment.methodPaypalDesc',
  },
  {
    id: 'moneygram',
    type: 'offline',
    icon: 'Send',
    labelKey: 'payment.methodMoneygram',
    descKey: 'payment.methodMoneygramDesc',
  },
  {
    id: 'bank_transfer',
    type: 'offline',
    icon: 'Landmark',
    labelKey: 'payment.methodBankTransfer',
    descKey: 'payment.methodBankTransferDesc',
  },
];

export const ONLINE_METHOD_IDS = PAYMENT_METHODS.filter(m => m.type === 'online').map(m => m.id);
export const OFFLINE_METHOD_IDS = PAYMENT_METHODS.filter(m => m.type === 'offline').map(m => m.id);

export function getPaymentMethod(id) {
  return PAYMENT_METHODS.find(m => m.id === id) || null;
}

export function isOfflineMethod(id) {
  return OFFLINE_METHOD_IDS.includes(id);
}

// Map a chosen method id to the Stripe payment_method_types array. Used by
// api/checkout.js. Falls back to ['card'] for anything unrecognized.
export function stripeMethodTypesFor(id) {
  const m = getPaymentMethod(id);
  return m?.stripeMethod ? [m.stripeMethod] : ['card'];
}

// -------------------------------------------------------
// Offline transfer details shown to the buyer.
//
// TODO(client): replace these placeholders with the real beneficiary
// account details before going live. The IBAN and MoneyGram receiver name
// were not provided yet (client wrote "IBAN xxxxxxxxxxxxxxxxx").
// -------------------------------------------------------
export const BANK_TRANSFER_DETAILS = {
  beneficiary: 'Certify CX FZ-LLC',          // TODO: confirm legal beneficiary name
  bankName: 'XXXX Bank',                      // TODO
  iban: 'XXXX XXXX XXXX XXXX XXXX XX',        // TODO: real IBAN
  swift: 'XXXXXXXX',                          // TODO: SWIFT/BIC
  currency: 'USD',
};

export const MONEYGRAM_DETAILS = {
  receiverName: 'Certify CX FZ-LLC',          // TODO: confirm receiver name
  country: 'United Arab Emirates',            // TODO
  reference: 'Use your Order ID as the transfer reference',
};
