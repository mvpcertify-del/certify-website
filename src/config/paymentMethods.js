// -------------------------------------------------------
// Certify.cx — Payment Methods
//
// The payment methods offered at checkout. One is processed online through
// Stripe (card); the other is offline/manual (bank transfer) where the buyer
// pays out-of-band and an admin verifies receipt before the certification
// proceeds and the buyer is granted dashboard access.
//
//   online  → api/checkout.js creates a Stripe Checkout session whose
//             payment_method_types is set from `stripeMethod`.
//   offline → no Stripe session; the order is persisted with
//             payment_status='awaiting_verification' and the buyer is shown
//             the instructions below. Dashboard access (the magic-link email)
//             is issued only once an admin confirms the payment.
//
// Labels/descriptions are i18n keys resolved with t() in the UI — the raw
// account details (IBAN, cash office) are NOT translated.
//
// Cash removed from checkout entirely (client, 17 Sep: "Remove Cash payment
// option for all Products Standards") — this list is the single source both
// the checkout UI and api/checkout.js's server-side validation read from
// (PAYMENT_METHOD_IDS below, checked at every new-order submission), so
// dropping the entry here removes it everywhere a buyer could choose it,
// for every standard, in one place. CASH_DETAILS stays below (not deleted):
// existing orders already placed with payment_method='cash' still need it to
// render correctly in the admin billing views, and api/checkout.js's
// separate DB-constraint whitelist (PAYMENT_METHOD_VALUES, for editing an
// EXISTING order) deliberately still accepts 'cash' for that reason — only
// the ability to choose it as a NEW order goes away.
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
    id: 'bank_transfer',
    type: 'offline',
    icon: 'Landmark',
    labelKey: 'payment.methodBankTransfer',
    descKey: 'payment.methodBankTransferDesc',
  },
];

// Canonical list of accepted method ids — used by api/checkout.js to reject
// anything unrecognized before it reaches the DB or Stripe.
export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map(m => m.id);

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
// Offline payment details shown to the buyer.
//
// TODO(client): replace these placeholders with the real beneficiary
// account details before going live. The IBAN and cash-office contact were
// not provided yet (client wrote "IBAN xxxxxxxxxxxxxxxxx").
// -------------------------------------------------------
export const BANK_TRANSFER_DETAILS = {
  beneficiary: 'Certify CX FZ-LLC',          // TODO: confirm legal beneficiary name
  bankName: 'XXXX Bank',                      // TODO
  iban: 'XXXX XXXX XXXX XXXX XXXX XX',        // TODO: real IBAN
  swift: 'XXXXXXXX',                          // TODO: SWIFT/BIC
  currency: 'USD',
};

export const CASH_DETAILS = {
  payee: 'Certify CX FZ-LLC',                 // TODO: confirm payee name
  contact: 'support@certify.cx',              // TODO: cash-payment coordinator contact
  note: 'Our team will contact you to arrange cash collection.',
};
