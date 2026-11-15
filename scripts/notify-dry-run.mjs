// Counts who the notification engine WOULD message today, without logging or sending anything.
//   node --env-file=.env scripts/notify-dry-run.mjs [rule_key]
// Reads only. Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the local .env).
import { createClient } from '@supabase/supabase-js';
import { runNotificationEngine } from '../api/_notifyEngine.js';

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env).');
  process.exit(1);
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const summary = await runNotificationEngine({ supabase, dryRun: true, only: process.argv[2] || null });
console.log(JSON.stringify(summary, null, 2));
