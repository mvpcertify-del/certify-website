// Creates the real ICL-1 Certification Body exactly as the client requested,
// using the data from the ARS Assessment accreditation schedule:
//   - Accreditation Body : UAF
//   - ISO Standard       : ISO 9001:2015
//   - IAF Sector Codes   : the QMS scope codes (01..39 subset)
//   - Countries covered  : the full sanctioned-countries list
//
//   Usage:
//     DEMO_ADMIN_EMAIL=... DEMO_ADMIN_PASSWORD=... node importIclCb.js
//
// Idempotent: re-running updates the same ICL-1 instead of duplicating it.
// Signs in as the Super Admin (anon key) so RLS is satisfied. Local/dev only.

import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  console.error('[ICL] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env. Aborting.');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'mvpcertify@gmail.com';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('[ICL] Set DEMO_ADMIN_PASSWORD (and optionally DEMO_ADMIN_EMAIL) when running. Aborting.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------- Client data (from the ARS schedule) ----------------
const CB_NAME = 'ICL-1';
const DEMO_NAME = 'ICL-1 (Demo)';

const ACCREDITATION_BODIES = [
  { name: 'United Accreditation Foundation', acronym: 'UAF' },
];

const ISO_STANDARDS = ['ISO 9001:2015'];

// QMS scope codes. 07(a)/07(b) from the schedule collapse to the system code '07'.
const IAF_CODES = [
  '01', '03', '07', '08', '09', '10', '12', '13', '17', '18', '19',
  '20', '22', '24', '28', '29', '30', '31', '32', '33', '34', '35',
  '36', '37', '38', '39',
];

// Countries covered (sanctioned-countries list on the schedule).
const COUNTRIES = [
  'Albania', 'Algeria', 'Angola', 'Australia', 'Austria', 'Azerbaijan', 'Bahrain',
  'Bangladesh', 'Belgium', 'Bhutan', 'Brazil', 'Bulgaria', 'Burkina Faso', 'Cambodia',
  'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cyprus',
  'Czech Republic', 'Denmark', 'Egypt', 'Estonia', 'Ethiopia', 'Finland', 'France',
  'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Guinea', 'Honduras',
  'Iceland', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Latvia', 'Lebanon',
  'Libya', 'Lithuania', 'Luxembourg', 'Malaysia', 'Maldives', 'Malta', 'Mauritius',
  'Mexico', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'Nigeria',
  'Norway', 'Oman', 'Pakistan', 'Papua New Guinea', 'Paraguay', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Saudi Arabia', 'Serbia', 'Singapore',
  'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka',
  'Sweden', 'Switzerland', 'Taiwan', 'Tanzania', 'Thailand', 'Turkey', 'Uganda',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States of America',
  'Uruguay', 'Uzbekistan', 'Vietnam', 'Yemen', 'Zimbabwe',
];

// Name variants so the schedule's spelling still matches the countries table.
const COUNTRY_ALIASES = {
  'united states of america': ['united states', 'usa', 'us', 'united states of america (usa)'],
  'south korea': ['korea, republic of', 'republic of korea', 'korea, south', 'korea (south)'],
  'czech republic': ['czechia'],
  'vietnam': ['viet nam'],
  'united kingdom': ['uk', 'united kingdom of great britain and northern ireland', 'great britain'],
  'russia': ['russian federation'],
  'tanzania': ['tanzania, united republic of', 'united republic of tanzania'],
};

// Countries on the schedule that are absent from the countries table — add them
// (with their region) so they can be linked and selected. Upsert won't touch
// existing rows, so regions of countries already present are never overwritten.
const MISSING_COUNTRIES = [
  { name: 'Libya', region_id: 'africa' },
  { name: 'Taiwan', region_id: 'asia' },
];

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function run() {
  console.log('[ICL] Creating real ICL-1 certification body...');

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  });
  if (authErr) throw new Error(`Sign-in failed for ${ADMIN_EMAIL}: ${authErr.message}`);
  console.log(`[ICL] Signed in as ${ADMIN_EMAIL}.`);

  // 1) Accreditation body (UAF)
  const { data: abRows, error: abErr } = await supabase
    .from('accreditation_bodies')
    .upsert(ACCREDITATION_BODIES, { onConflict: 'name' })
    .select('id, acronym');
  if (abErr) throw abErr;
  console.log(`[ICL] Step 1 — accreditation body ready: ${abRows.map(a => a.acronym).join(', ')}`);

  // 2) Add any schedule countries missing from the table, then match against it
  const { error: mcErr } = await supabase
    .from('countries').upsert(MISSING_COUNTRIES, { onConflict: 'name' });
  if (mcErr) throw mcErr;

  const { data: dbCountries, error: dcErr } = await supabase
    .from('countries').select('id, name');
  if (dcErr) throw dcErr;
  const byName = new Map(dbCountries.map(c => [norm(c.name), c]));

  const matchedCountryIds = [];
  const unmatched = [];
  for (const wanted of COUNTRIES) {
    let hit = byName.get(norm(wanted));
    if (!hit) {
      for (const alias of (COUNTRY_ALIASES[norm(wanted)] || [])) {
        hit = byName.get(norm(alias));
        if (hit) break;
      }
    }
    if (hit) matchedCountryIds.push(hit.id);
    else unmatched.push(wanted);
  }
  console.log(`[ICL] Step 2 — countries matched: ${matchedCountryIds.length}/${COUNTRIES.length}`);
  if (unmatched.length) console.log(`[ICL]   not found in countries table: ${unmatched.join(', ')}`);

  // 3) Find-or-create the CB
  let cbId;
  const { data: existing } = await supabase
    .from('certification_bodies').select('id').eq('name', CB_NAME).maybeSingle();
  if (existing) {
    cbId = existing.id;
    await Promise.all([
      supabase.from('cb_accreditation_bodies').delete().eq('cb_id', cbId),
      supabase.from('cb_countries').delete().eq('cb_id', cbId),
      supabase.from('cb_iso_standards').delete().eq('cb_id', cbId),
      supabase.from('cb_iaf_codes').delete().eq('cb_id', cbId),
    ]);
    console.log(`[ICL] Step 3 — reusing existing CB ${cbId} (joins reset).`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('certification_bodies')
      .insert([{ name: CB_NAME, acronym: 'ICL', country: 'India', status: 'active', currency: 'USD' }])
      .select('id').single();
    if (insErr) throw insErr;
    cbId = inserted.id;
    console.log(`[ICL] Step 3 — created CB ${cbId}.`);
  }

  // 4) Write all join rows
  const writes = [
    supabase.from('cb_accreditation_bodies').insert(abRows.map(a => ({ cb_id: cbId, accreditation_body_id: a.id }))),
    supabase.from('cb_iso_standards').insert(ISO_STANDARDS.map(s => ({ cb_id: cbId, iso_standard: s }))),
    supabase.from('cb_iaf_codes').insert(IAF_CODES.map(code => ({ cb_id: cbId, iaf_code: code }))),
  ];
  if (matchedCountryIds.length) {
    writes.push(supabase.from('cb_countries').insert(matchedCountryIds.map(id => ({ cb_id: cbId, country_id: id }))));
  }
  const results = await Promise.all(writes);
  for (const r of results) if (r.error) throw r.error;
  console.log('[ICL] Step 4 — linked accreditation body, ISO standard, IAF codes, countries.');

  // 5) Remove the earlier throwaway demo CB
  const { data: demo } = await supabase
    .from('certification_bodies').select('id').eq('name', DEMO_NAME).maybeSingle();
  if (demo) {
    await Promise.all([
      supabase.from('cb_accreditation_bodies').delete().eq('cb_id', demo.id),
      supabase.from('cb_countries').delete().eq('cb_id', demo.id),
      supabase.from('cb_iso_standards').delete().eq('cb_id', demo.id),
      supabase.from('cb_iaf_codes').delete().eq('cb_id', demo.id),
      supabase.from('cb_standard_pricing').delete().eq('cb_id', demo.id),
      supabase.from('cb_documents').delete().eq('cb_id', demo.id),
    ]);
    await supabase.from('certification_bodies').delete().eq('id', demo.id);
    console.log('[ICL] Step 5 — removed ICL-1 (Demo).');
  }

  console.log('\n[ICL] Done ✅');
  console.log(`   CB: ${CB_NAME}`);
  console.log(`   Accreditation body: ${abRows.map(a => a.acronym).join(', ')}`);
  console.log(`   ISO standard: ${ISO_STANDARDS.join(', ')}`);
  console.log(`   IAF codes: ${IAF_CODES.length}`);
  console.log(`   Countries linked: ${matchedCountryIds.length} (unmatched: ${unmatched.length})`);
}

run().catch(err => {
  console.error('[ICL] Failed:', err.message || err);
  process.exit(1);
});
