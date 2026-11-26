// -------------------------------------------------------
// Certify.cx — products sold straight on Whop (client, 26 Nov 2026)
//
// "You have to position the ISO 9001 in Whop and point the payment gateway to Whop." For these standards the buy
// buttons on the site open the Whop checkout of the plan below, instead of certify.cx's own pay-first checkout.
// Every other standard keeps using certify.cx's checkout (api/checkout.js creates a one-off Whop variant per order).
//
// Data only, no imports: safe to use from the browser and from api/checkout.js (which runs in Node).
//
// To change the plan or switch a standard back to certify.cx checkout, edit this table; nothing else hard-codes it.
// The price on Whop and PRICE_OVERRIDES in utils/pricing.js must stay in step (ISO 9001: US$994).
// -------------------------------------------------------

// EMPTY on purpose since 26 Nov 2026 (client: "do the discount from code, like before"): ISO 9001 is bought on certify.cx's
// own checkout again, where the code CGBF60 works (supabase/phase54_cgbf60_coupon.sql). Card payment there is still taken by
// Whop (api/checkout.js creates a one-off Whop variant per order).
// To sell ISO 9001 on the Whop plan instead, put this entry back (then the buy buttons, old /checkout?iso=iso-9001 links
// and the Whop payment alert follow it automatically):
//   'iso-9001': { planId: 'plan_fI3yvWfEHph9C', url: 'https://whop.com/checkout/plan_fI3yvWfEHph9C',
//                 title: 'ISO 9001 Certification Package for Micro Companies' },
export const WHOP_PLANS = {};

// Whop checkout URL for a catalog slug, or null when that standard is bought on certify.cx.
export function whopCheckoutUrl(slug) {
  return WHOP_PLANS[slug]?.url || null;
}

// The standard slug a Whop plan id belongs to (webhook side), or null.
export function slugForWhopPlan(planId) {
  if (!planId) return null;
  return Object.keys(WHOP_PLANS).find((slug) => WHOP_PLANS[slug].planId === planId) || null;
}
