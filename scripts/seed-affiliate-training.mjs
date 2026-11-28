// Loads the affiliate training (scripts/affiliateTrainingContent.mjs) into public.training_modules.
// Run AFTER supabase/phase55_affiliate_training.sql:   node scripts/seed-affiliate-training.mjs
// Upserts by slug, so it is safe to re-run after editing the content. Uses the service role from .env; never prints it.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODULES } from './affiliateTrainingContent.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const f of ['.env', '.env.local']) {
  const file = path.join(root, f);
  if (!fs.existsSync(file)) continue;
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase URL or service role key in .env'); process.exit(1); }

const rows = MODULES.map((m) => ({
  slug: m.slug, position: m.position, title: m.title, summary: m.summary, minutes: m.minutes,
  lessons: m.lessons, quiz: m.quiz, published: true, updated_at: new Date().toISOString(),
}));
const res = await fetch(`${url}/rest/v1/training_modules?on_conflict=slug`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows),
});
console.log(res.ok ? `Seeded ${rows.length} modules into ${new URL(url).host}` : `Failed ${res.status}: ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
