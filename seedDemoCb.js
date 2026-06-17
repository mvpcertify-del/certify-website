// Demo seed: inserts one fully-populated Certification Body for local testing,
// so you don't have to fill the CB Registry form by hand.
//
//   Usage:  node seedDemoCb.js
//
// Idempotent: re-running updates the same demo CB instead of duplicating it.
// Signs in as the seeded Super Admin (via the anon key) so RLS policies are
// satisfied — same path the CB Registry UI uses. Local/dev only.
//
// Override the admin login with env vars if your super-admin differs:
//   DEMO_ADMIN_EMAIL=... DEMO_ADMIN_PASSWORD=... node seedDemoCb.js

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
  console.error('[DemoCB] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env. Aborting.');
  process.exit(1);
}

// Default to the seeded Super Admin account (see seed.js).
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'mvpcertify@gmail.com';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || '!@#123Certifymvp';

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Demo data (based on the ARS Assessment accreditation schedule) ----
const CB_NAME = 'ICL-1 (Demo)';

const ACCREDITATION_BODIES = [
  { name: 'United Accreditation Foundation', acronym: 'UAF' },
];

const COUNTRIES = [
  { name: 'India', region_id: 'asia' },
  { name: 'Thailand', region_id: 'asia' },
  { name: 'United Arab Emirates', region_id: 'asia' },
  { name: 'Egypt', region_id: 'africa' },
  { name: 'Italy', region_id: 'europe' },
  { name: 'United States of America', region_id: 'north_america' },
];

const ISO_STANDARDS = ['ISO 9001:2015', 'ISO 14001', 'ISO 45001'];

// QMS scope codes from the schedule (07(a)/07(b) collapse to '07').
const IAF_CODES = [
  '01', '03', '07', '08', '09', '10', '12', '13', '17', '18', '19',
  '20', '22', '24', '28', '29', '30', '31', '32', '33', '34', '35',
  '36', '37', '38', '39',
];

async function run() {
  console.log('[DemoCB] Seeding demo certification body...');

  // 0) Sign in as Super Admin so RLS allows the writes below.
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authErr) {
    throw new Error(
      `Super-admin sign-in failed for ${ADMIN_EMAIL}: ${authErr.message}. ` +
      `Pass DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD env vars for the correct account.`
    );
  }
  console.log(`[DemoCB] Signed in as ${ADMIN_EMAIL}.`);

  // 1) Accreditation bodies (name is UNIQUE → upsert)
  const { data: abRows, error: abErr } = await supabase
    .from('accreditation_bodies')
    .upsert(ACCREDITATION_BODIES, { onConflict: 'name' })
    .select('id, name');
  if (abErr) throw abErr;
  console.log(`[DemoCB] Accreditation bodies ready: ${abRows.map(a => a.name).join(', ')}`);

  // 2) Countries (name is UNIQUE → upsert)
  const { data: countryRows, error: cErr } = await supabase
    .from('countries')
    .upsert(COUNTRIES, { onConflict: 'name' })
    .select('id, name');
  if (cErr) throw cErr;
  console.log(`[DemoCB] Countries ready: ${countryRows.length}`);

  // 3) Certification body (no unique constraint on name → find-or-create)
  let cbId;
  const { data: existing } = await supabase
    .from('certification_bodies')
    .select('id')
    .eq('name', CB_NAME)
    .maybeSingle();

  if (existing) {
    cbId = existing.id;
    // Wipe old join rows so the re-run is clean.
    await Promise.all([
      supabase.from('cb_accreditation_bodies').delete().eq('cb_id', cbId),
      supabase.from('cb_countries').delete().eq('cb_id', cbId),
      supabase.from('cb_iso_standards').delete().eq('cb_id', cbId),
      supabase.from('cb_iaf_codes').delete().eq('cb_id', cbId),
    ]);
    console.log(`[DemoCB] Reusing existing CB ${cbId} (joins reset).`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('certification_bodies')
      .insert([{
        name: CB_NAME,
        acronym: 'ICL',
        website: 'https://example.com',
        country: 'India',
        status: 'active',
        currency: 'USD',
      }])
      .select('id')
      .single();
    if (insErr) throw insErr;
    cbId = inserted.id;
    console.log(`[DemoCB] Created CB ${cbId}.`);
  }

  // 4) Join rows
  const writes = [
    supabase.from('cb_accreditation_bodies').insert(
      abRows.map(a => ({ cb_id: cbId, accreditation_body_id: a.id }))
    ),
    supabase.from('cb_countries').insert(
      countryRows.map(c => ({ cb_id: cbId, country_id: c.id }))
    ),
    supabase.from('cb_iso_standards').insert(
      ISO_STANDARDS.map(s => ({ cb_id: cbId, iso_standard: s }))
    ),
    supabase.from('cb_iaf_codes').insert(
      IAF_CODES.map(code => ({ cb_id: cbId, iaf_code: code }))
    ),
  ];
  const results = await Promise.all(writes);
  for (const r of results) {
    if (r.error) throw r.error;
  }

  console.log('[DemoCB] Done ✅');
  console.log(`         CB: ${CB_NAME}`);
  console.log(`         Accreditation bodies: ${abRows.length}`);
  console.log(`         Countries: ${countryRows.length}`);
  console.log(`         ISO standards: ${ISO_STANDARDS.join(', ')}`);
  console.log(`         IAF codes: ${IAF_CODES.length}`);
}

run().catch(err => {
  console.error('[DemoCB] Failed:', err.message || err);
  process.exit(1);
});
