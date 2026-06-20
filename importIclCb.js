// Creates / updates the real ICL certification body exactly as the client
// requested, from the EGAC accreditation schedule (ICL-ACCREDITATION SCHEDULE.pdf):
//
//   - Full name        : Integral Certification Pvt. Ltd (ICL)
//   - Address          : New Delhi office (from the schedule header)
//   - Accreditation    : EGAC (Egyptian Accreditation Council)
//   - 6 ISO standards  : 9001:2015, 14001:2015, 45001:2018, 22000:2018,
//                        27001:2022, 50001:2018
//   - IAF codes        : PER STANDARD (each standard has its own set)
//   - Countries covered: named jurisdictions + full MENA region
//
//   Usage:
//     DEMO_ADMIN_EMAIL=... DEMO_ADMIN_PASSWORD=... node importIclCb.js
//
// REQUIRES the phase12 migration (address column + per-standard cb_iaf_codes)
// to have been applied first — see supabase/phase12_cb_address_per_standard_iaf.sql.
//
// Idempotent: re-running updates the same ICL row instead of duplicating it.
// Signs in as the Super Admin (anon key) so RLS is satisfied. Pricing is NOT
// set here — the schedule contains no prices; the client must supply them.

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

// ---------------- Client data (from the EGAC schedule) ----------------
const CB_NAME = 'Integral Certification Pvt. Ltd (ICL)';
const CB_ACRONYM = 'ICL';
const CB_ADDRESS = '301, U 60, 3rd Floor, Shakarpur, Laxmi Nagar, New Delhi-110092, 110066 India';
const CB_COUNTRY = 'India';
const DEMO_NAME = 'ICL-1 (Demo)';
// Existing rows that represent this same CB from earlier runs — fold them in.
const OLD_NAMES = ['ICL-1', 'ICL'];

const ACCREDITATION_BODIES = [
  { name: 'Egyptian Accreditation Council', acronym: 'EGAC' },
];

// Each ISO standard with its OWN IAF sector codes, exactly as listed in the
// schedule. 22000 (food clusters), 27001 and 50001 carry no numeric IAF codes
// in the schedule, so they are added as standards with an empty code set.
const STANDARDS = {
  'ISO 9001:2015': [
    '01', '03', '04', '05', '06', '07', '08', '09', '12', '14', '15', '16',
    '17', '18', '19', '23', '28', '29', '30', '31', '32', '33', '34', '35',
    '36', '37', '39',
  ],
  'ISO 14001:2015': [
    '10', '12', '13', '14', '15', '16', '17', '18', '19', '28', '29', '30',
    '31', '32', '33', '34', '35', '36', '37',
  ],
  'ISO 45001:2018': [
    '10', '12', '13', '14', '15', '16', '17', '18', '19', '28', '29', '30',
    '31', '32', '33', '34', '35', '36', '37',
  ],
  'ISO 22000:2018': [],
  'ISO/IEC 27001:2022': [],
  'ISO 50001:2018': [],
};

// Named jurisdictions on the schedule + the full MENA region (the schedule
// states MENA applies to all ICL standards under EGAC accreditation).
const COUNTRIES = [
  // Named jurisdictions (pages 4–5)
  'India', 'United States of America', 'Spain', 'Italy', 'Poland', 'Albania',
  'United Kingdom', 'Uganda', 'Peru', 'Indonesia', 'Malaysia', 'Vietnam',
  'Nigeria', 'Netherlands', 'Bangladesh', 'Russia', 'Thailand', 'Azerbaijan',
  'Belarus', 'Serbia', 'Pakistan', 'Myanmar', 'Singapore', 'Greece',
  'South Africa', 'Taiwan', 'China', 'Nepal', 'Canada', 'Mexico', 'South Korea',
  'Romania', 'Australia', 'Philippines', 'Ireland',
  // MENA — Middle East & North Africa
  'Algeria', 'Bahrain', 'Djibouti', 'Egypt', 'Iran', 'Iraq', 'Israel', 'Jordan',
  'Kuwait', 'Lebanon', 'Libya', 'Morocco', 'Oman', 'Palestine', 'Qatar',
  'Saudi Arabia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen',
];

// Region for each country, used only if it has to be inserted into the
// countries table. Regions allowed: asia | africa | europe | north_america |
// south_america. (No Oceania bucket exists, so Australia stays null.)
const REGION_BY_COUNTRY = {
  'india': 'asia', 'united states of america': 'north_america', 'spain': 'europe',
  'italy': 'europe', 'poland': 'europe', 'albania': 'europe', 'united kingdom': 'europe',
  'uganda': 'africa', 'peru': 'south_america', 'indonesia': 'asia', 'malaysia': 'asia',
  'vietnam': 'asia', 'nigeria': 'africa', 'netherlands': 'europe', 'bangladesh': 'asia',
  'russia': 'europe', 'thailand': 'asia', 'azerbaijan': 'asia', 'belarus': 'europe',
  'serbia': 'europe', 'pakistan': 'asia', 'myanmar': 'asia', 'singapore': 'asia',
  'greece': 'europe', 'south africa': 'africa', 'taiwan': 'asia', 'china': 'asia',
  'nepal': 'asia', 'canada': 'north_america', 'mexico': 'north_america',
  'south korea': 'asia', 'romania': 'europe', 'australia': null, 'philippines': 'asia',
  'ireland': 'europe', 'algeria': 'africa', 'bahrain': 'asia', 'djibouti': 'africa',
  'egypt': 'africa', 'iran': 'asia', 'iraq': 'asia', 'israel': 'asia', 'jordan': 'asia',
  'kuwait': 'asia', 'lebanon': 'asia', 'libya': 'africa', 'morocco': 'africa',
  'oman': 'asia', 'palestine': 'asia', 'qatar': 'asia', 'saudi arabia': 'asia',
  'sudan': 'africa', 'syria': 'asia', 'tunisia': 'africa',
  'united arab emirates': 'asia', 'yemen': 'asia',
};

// Name variants so the schedule's spelling still matches the countries table.
const COUNTRY_ALIASES = {
  'united states of america': ['united states', 'usa', 'us'],
  'south korea': ['korea, republic of', 'republic of korea', 'korea', 'korea, south'],
  'united kingdom': ['uk', 'great britain', 'united kingdom of great britain and northern ireland'],
  'russia': ['russian federation'],
  'vietnam': ['viet nam'],
  'iran': ['iran, islamic republic of'],
  'syria': ['syrian arab republic'],
  'palestine': ['state of palestine', 'palestine, state of'],
  'taiwan': ['taiwan, province of china'],
  'myanmar': ['burma'],
};

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function run() {
  console.log(`[ICL] Connected to DB: ${supabaseUrl}`);
  console.log('[ICL] Building ICL certification body from the EGAC schedule...');

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
  });
  if (authErr) throw new Error(`Sign-in failed for ${ADMIN_EMAIL}: ${authErr.message}`);
  console.log(`[ICL] Signed in as ${ADMIN_EMAIL}.`);

  // 1) Accreditation body (EGAC)
  const { data: abRows, error: abErr } = await supabase
    .from('accreditation_bodies')
    .upsert(ACCREDITATION_BODIES, { onConflict: 'name' })
    .select('id, acronym');
  if (abErr) throw abErr;
  console.log(`[ICL] Step 1 — accreditation body ready: ${abRows.map(a => a.acronym).join(', ')}`);

  // 2) Match countries against the table; insert any that are missing.
  const { data: dbCountries0, error: dcErr } = await supabase
    .from('countries').select('id, name');
  if (dcErr) throw dcErr;
  let byName = new Map(dbCountries0.map(c => [norm(c.name), c]));

  const findHit = (wanted) => {
    let hit = byName.get(norm(wanted));
    if (hit) return hit;
    for (const alias of (COUNTRY_ALIASES[norm(wanted)] || [])) {
      hit = byName.get(norm(alias));
      if (hit) return hit;
    }
    return null;
  };

  const toInsert = [];
  for (const wanted of COUNTRIES) {
    if (!findHit(wanted)) {
      toInsert.push({ name: wanted, region_id: REGION_BY_COUNTRY[norm(wanted)] ?? null });
    }
  }
  if (toInsert.length) {
    const { error: insErr } = await supabase
      .from('countries').upsert(toInsert, { onConflict: 'name' });
    if (insErr) throw insErr;
    const { data: refreshed } = await supabase.from('countries').select('id, name');
    byName = new Map((refreshed || []).map(c => [norm(c.name), c]));
    console.log(`[ICL] Step 2a — added ${toInsert.length} missing countries: ${toInsert.map(c => c.name).join(', ')}`);
  }

  const matchedCountryIds = [];
  const unmatched = [];
  for (const wanted of COUNTRIES) {
    const hit = findHit(wanted);
    if (hit) matchedCountryIds.push(hit.id);
    else unmatched.push(wanted);
  }
  console.log(`[ICL] Step 2 — countries matched: ${matchedCountryIds.length}/${COUNTRIES.length}`);
  if (unmatched.length) console.log(`[ICL]   still not matched: ${unmatched.join(', ')}`);

  // 3) Find-or-create the CB (fold any earlier ICL-1 / ICL row into this one).
  const { data: allCbs } = await supabase
    .from('certification_bodies').select('id, name, acronym');
  const iclRows = (allCbs || []).filter(
    c => norm(c.acronym) === 'icl'
      || OLD_NAMES.map(norm).includes(norm(c.name))
      || norm(c.name) === norm(CB_NAME)
  );

  let cbId;
  if (iclRows.length) {
    cbId = iclRows[0].id;
    if (iclRows.length > 1) {
      console.log(`[ICL]   note: ${iclRows.length} ICL-like rows found; updating "${iclRows[0].name}" and leaving the rest (clean up manually): ${iclRows.slice(1).map(r => r.name).join(', ')}`);
    }
    const { error: updErr } = await supabase
      .from('certification_bodies')
      .update({
        name: CB_NAME, acronym: CB_ACRONYM, address: CB_ADDRESS,
        country: CB_COUNTRY, status: 'active', currency: 'USD',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cbId);
    if (updErr) throw updErr;
    await Promise.all([
      supabase.from('cb_accreditation_bodies').delete().eq('cb_id', cbId),
      supabase.from('cb_countries').delete().eq('cb_id', cbId),
      supabase.from('cb_iso_standards').delete().eq('cb_id', cbId),
      supabase.from('cb_iaf_codes').delete().eq('cb_id', cbId),
    ]);
    console.log(`[ICL] Step 3 — updated existing CB ${cbId} (joins reset).`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('certification_bodies')
      .insert([{
        name: CB_NAME, acronym: CB_ACRONYM, address: CB_ADDRESS,
        country: CB_COUNTRY, status: 'active', currency: 'USD',
      }])
      .select('id').single();
    if (insErr) throw insErr;
    cbId = inserted.id;
    console.log(`[ICL] Step 3 — created CB ${cbId}.`);
  }

  // 4) Write join rows
  const isoStandards = Object.keys(STANDARDS);
  const iafRows = [];
  for (const std of isoStandards) {
    for (const code of STANDARDS[std]) {
      iafRows.push({ cb_id: cbId, iso_standard: std, iaf_code: code });
    }
  }

  const writes = [
    supabase.from('cb_accreditation_bodies').insert(abRows.map(a => ({ cb_id: cbId, accreditation_body_id: a.id }))),
    supabase.from('cb_iso_standards').insert(isoStandards.map(s => ({ cb_id: cbId, iso_standard: s }))),
    supabase.from('cb_iaf_codes').insert(iafRows),
  ];
  if (matchedCountryIds.length) {
    writes.push(supabase.from('cb_countries').insert(matchedCountryIds.map(id => ({ cb_id: cbId, country_id: id }))));
  }
  const results = await Promise.all(writes);
  for (const r of results) if (r.error) throw r.error;
  console.log('[ICL] Step 4 — linked EGAC, 6 ISO standards, per-standard IAF codes, countries.');

  // 5) Remove the earlier throwaway demo CB if it still exists
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
  console.log(`   Address: ${CB_ADDRESS}`);
  console.log(`   Accreditation body: ${abRows.map(a => a.acronym).join(', ')}`);
  console.log(`   ISO standards (${isoStandards.length}): ${isoStandards.join(', ')}`);
  for (const std of isoStandards) {
    console.log(`     - ${std}: ${STANDARDS[std].length ? STANDARDS[std].join(', ') : '(no numeric IAF codes in schedule)'}`);
  }
  console.log(`   Countries linked: ${matchedCountryIds.length}/${COUNTRIES.length} (unmatched: ${unmatched.length})`);
  console.log('   Pricing: NOT set — schedule has no prices; client must provide initial/surveillance per standard.');
}

run().catch(err => {
  const msg = err.message || String(err);
  console.error('[ICL] Failed:', msg);
  if (/address|iso_standard|cb_iaf_codes/i.test(msg)) {
    console.error('[ICL] HINT: run supabase/phase12_cb_address_per_standard_iaf.sql in the Supabase SQL editor first.');
  }
  process.exit(1);
});
