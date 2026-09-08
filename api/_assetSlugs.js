// Reserved keys in the outreach document library (api/outreach-assets.js).
//
// The library is keyed by `standard_slug`, one row per ISO standard. The client
// asked on 7 Sep for a "Company Profile to be attached to email" alongside the
// standard's own brochure — a document that belongs to no standard, so it
// cannot be keyed by one.
//
// It is stored in the same table under the reserved slug below rather than in a
// table of its own: `standard_slug` is plain text with a unique index, so the
// company profile inherits the upload guards, the private bucket, the signed
// download path and the admin screen that already exist, and it needs NO
// migration. On this project that difference is not cosmetic — a migration that
// has to be run by hand is the difference between a feature that works on
// deploy day and one that sits dark for a week.
//
// The slug contains a hyphen and is not a member of ISO_CATALOG, so it can
// never collide with a real standard.
//
// This lives in its own module so that api/referrals.js can name the slug
// without importing api/outreach-assets.js — importing a serverless handler for
// one constant would spin up a second service-role Supabase client on every
// cold start of the send path, for nothing.
export const COMPANY_PROFILE_SLUG = 'company-profile';
