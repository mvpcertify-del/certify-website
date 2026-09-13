#!/usr/bin/env node
// i18n audit for CertifyCX — diffs every locale file against English.
// Usage: node .claude/skills/i18n-audit/audit.mjs [--full]

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const localesDir = resolve(repoRoot, 'src', 'i18n', 'locales');

const full = process.argv.includes('--full');
const PREVIEW = full ? Infinity : 10;

// Read the directory rather than listing the locales. The project shipped
// six more languages after this script was written and the hardcoded trio
// meant the pre-commit blocker could not see drift in de/fr/hi/pt/ru/zh —
// six files that could go out of sync silently. English stays first: the
// checks below treat the first entry as the reference.
const files = [
  'en.json',
  ...readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json').sort(),
];
const data = Object.fromEntries(
  files.map(f => [f, JSON.parse(readFileSync(resolve(localesDir, f), 'utf8'))])
);

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out.set(key, v);
    }
  }
  return out;
}

const flat = Object.fromEntries(
  Object.entries(data).map(([f, obj]) => [f, flatten(obj)])
);

const enKeys = new Set(flat['en.json'].keys());
const targets = files.filter(f => f !== 'en.json');

function diff(a, b) {
  const out = [];
  for (const k of a) if (!b.has(k)) out.push(k);
  return out.sort();
}

// Per target language rather than the two hardcoded ones, so every locale the
// project ships is compared against English.
const missing = {};
const extra = {};
for (const f of targets) {
  const keys = new Set(flat[f].keys());
  missing[f] = diff(enKeys, keys);
  extra[f] = diff(keys, enKeys);
}

const empty = [];
for (const [file, m] of Object.entries(flat)) {
  for (const [k, v] of m) {
    if (v === '' || v === null || v === undefined) empty.push(`${file}: ${k}`);
  }
}

const identicalToEn = Object.fromEntries(targets.map(f => [f, []]));
for (const target of targets) {
  for (const [k, v] of flat[target]) {
    const en = flat['en.json'].get(k);
    if (typeof en === 'string' && typeof v === 'string' && en.length > 1 && en === v) {
      identicalToEn[target].push(k);
    }
  }
}

function section(title, items) {
  console.log(`\n## ${title} (${items.length})`);
  if (items.length === 0) { console.log('  OK'); return; }
  for (const item of items.slice(0, PREVIEW)) console.log(`  - ${item}`);
  if (items.length > PREVIEW) console.log(`  ... and ${items.length - PREVIEW} more (run with --full to see all)`);
}

console.log(`# i18n audit — ${enKeys.size} keys in en.json, ${targets.length} other locales`);
for (const f of targets) section(`Missing in ${f}`, missing[f]);
for (const f of targets) section(`Extra in ${f} (not in en.json)`, extra[f]);
section('Empty values', empty);
for (const f of targets) {
  section(`Likely untranslated (${f} identical to en)`, identicalToEn[f]);
}

// Hard issues = structural drift (missing/extra keys, empty values).
// Soft issues = heuristic "likely untranslated" — frequently legitimate
// (short tokens like brand names, "no", region names). Reported but not failing.
const sum = (o) => Object.values(o).reduce((a, v) => a + v.length, 0);
const hardIssues = sum(missing) + sum(extra) + empty.length;
const softIssues = sum(identicalToEn);

if (hardIssues === 0 && softIssues === 0) {
  console.log('\ni18n OK');
} else if (hardIssues === 0) {
  console.log(`\ni18n OK (structural) — ${softIssues} soft findings (likely-untranslated heuristics, often legitimate)`);
} else {
  console.log(`\nAction needed: ${hardIssues} structural findings, ${softIssues} soft findings`);
}

// Exit non-zero ONLY on hard issues so this is safe to use as a pre-commit blocker.
process.exit(hardIssues === 0 ? 0 : 1);
