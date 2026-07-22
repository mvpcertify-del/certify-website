// Auditor qualification option lists.
//
// This module exists so the admin "Add Auditor" modal
// (src/pages/admin/AdminAuditors.jsx) and the auditor self-registration
// wizard (src/pages/auth/SignUp.jsx) build their dropdowns from ONE source.
// They collect the same three attributes into the same three columns; if the
// two screens each kept their own list they would drift the first time a
// standard is added, and the data would stop being comparable.

import { ISO_STANDARD_OPTIONS } from './isoStandards';
import { IAF_SECTOR_CODES } from './iafCodes';

// The client's exact four levels, in their order.
//
// The labels stay in English on purpose and are NOT routed through t():
// "Lead Auditor" and "Lead Implementer" are the names of ISO/IEC 17024
// qualifications that appear verbatim on the certificate an auditor uploads.
// Translating them would make an Arabic-locale admin unable to match what the
// list says against the PDF in front of them.
//
// The `value` is the machine identifier stored in profiles.auditor_levels and
// must never change — changing one silently orphans every existing auditor.
export const AUDITOR_LEVELS = [
  { value: 'internal_auditor', label: 'Internal Auditor' },
  { value: 'lead_auditor', label: 'Lead Auditor' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'lead_implementer', label: 'Lead Implementer' },
];

// ISO_STANDARD_OPTIONS is a flat string array; MultiSelect wants {value,label}.
export const AUDITOR_STANDARD_OPTIONS = ISO_STANDARD_OPTIONS.map(s => ({
  value: s,
  label: s,
}));

// Value is the IAF code alone ('01' … '39') — see phase24 decision 2. The label
// carries the name so the dropdown is searchable by industry, not just number.
export const AUDITOR_SECTOR_OPTIONS = IAF_SECTOR_CODES.map(({ code, name }) => ({
  value: code,
  label: `${code} — ${name}`,
}));

// Maps stored values back to something a human reads, for the admin list and
// the read-only detail view. Unknown values pass through unchanged rather than
// disappearing, so a row written by an older build is still legible.
const LEVEL_LABELS = new Map(AUDITOR_LEVELS.map(l => [l.value, l.label]));
export const auditorLevelLabel = (value) => LEVEL_LABELS.get(value) || value;

const SECTOR_LABELS = new Map(IAF_SECTOR_CODES.map(s => [s.code, s.name]));
export const auditorSectorLabel = (code) =>
  SECTOR_LABELS.has(code) ? `${code} — ${SECTOR_LABELS.get(code)}` : code;

// 39 IAF codes is the largest legitimate list any of these three fields can
// hold, so anything beyond this is somebody probing how much they can write.
export const MAX_AUDITOR_TAGS = 60;

// Server-side guard, exported from here so api/create-user.js and api/user.js
// both validate exactly what these two forms can produce. Request bodies are
// attacker-controlled: a text[] column will happily accept 10,000 entries.
// Returns a clean string[] for anything, including garbage.
export function sanitizeAuditorTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, 120);
    if (trimmed) seen.add(trimmed);
    if (seen.size >= MAX_AUDITOR_TAGS) break;
  }
  return [...seen];
}
