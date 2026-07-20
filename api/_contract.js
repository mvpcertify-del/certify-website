// ============================================================================
// Consultancy partner contracts — templates, electronic acceptance, PDF
// ============================================================================
//
// Client instruction, 21 Jul: "Create an Electronic contract which each
// Consultant partner will sign digitally or accept the terms & rules mentioned
// in the contract electronically. The contract will be valid for 12 months
// renewable & will be effective from date of approval by Certify.cx
// Administrator."
//
// This is a helper module, not a route. api/ sits at exactly 12 non-underscore
// files, which is the Vercel Hobby function ceiling — a 13th breaks the whole
// deployment. The endpoints live as `action` cases on api/user.js.
//
// The PDF pipeline deliberately mirrors api/_billing.js: build with pdf-lib →
// upload to a private bucket → hand back a short-lived signed URL.
// ============================================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { loadOrgSettings, signedUrlFor } from './_billing.js';

const BUCKET = 'contracts';

// A4 portrait, matching the invoice/receipt documents.
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 55;
const INK = rgb(0.11, 0.12, 0.15);
const MUTED = rgb(0.42, 0.45, 0.50);
const ACCENT = rgb(0.05, 0.65, 0.45);
const RULE = rgb(0.85, 0.87, 0.89);

// ----------------------------------------------------------------------------
// Text safety
// ----------------------------------------------------------------------------
// pdf-lib's standard fonts are WinAnsi-encoded and throw on anything outside
// that set, aborting the document. Contract text is admin-authored and will be
// pasted from Word, so smart quotes and long dashes are near-certain. Same
// treatment as _billing.js.
const SUBSTITUTIONS = {
  '\u2212': '-', '\u2013': '-', '\u2014': '-', '\u2010': '-', '\u2011': '-',
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"',
  '\u2026': '...',
  '\u202F': ' ', '\u2009': ' ', '\u00A0': ' ', '\u200B': '',
};

function winAnsi(text) {
  return String(text ?? '')
    .replace(
      /[\u2212\u2013\u2014\u2010\u2011\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2026\u202F\u2009\u00A0\u200B]/g,
      (c) => SUBSTITUTIONS[c],
    )
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------
export class ContractError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requireText(value, field, { max = 500 } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new ContractError(`${field} is required.`);
  if (s.length > max) throw new ContractError(`${field} is too long.`);
  return s;
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------
export async function getActiveTemplate(supabaseAdmin, partnerType = 'consultancy') {
  const { data, error } = await supabaseAdmin
    .from('contract_templates')
    .select('*')
    .eq('partner_type', partnerType)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('getActiveTemplate failed:', error);
    throw new ContractError('Could not load the contract.', 500);
  }
  if (!data) {
    throw new ContractError(
      'No contract has been published for this partner type yet.', 404,
    );
  }
  return data;
}

// Saving a template never edits the live one in place. Partners have signed
// against specific words; rewriting those words after the fact would silently
// change what they agreed to. Instead the current version is retired and a new
// version is published, so every signature stays anchored to its own text.
export async function saveTemplate(supabaseAdmin, input, caller) {
  const partnerType = input?.partnerType || 'consultancy';
  const title = requireText(input?.title, 'Title', { max: 200 });
  const body = requireText(input?.body, 'Contract text', { max: 100000 });
  const termMonths = Number(input?.termMonths ?? 12);

  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120) {
    throw new ContractError('Term must be a whole number of months between 1 and 120.');
  }

  const { data: current } = await supabaseAdmin
    .from('contract_templates')
    .select('id, version, title, body, term_months')
    .eq('partner_type', partnerType)
    .eq('is_active', true)
    .maybeSingle();

  // Nothing changed — don't burn a version number on a no-op save.
  if (current
    && current.title === title
    && current.body === body
    && current.term_months === termMonths) {
    return { template: current, unchanged: true };
  }

  const nextVersion = (current?.version || 0) + 1;

  // Retire the old one FIRST: a partial unique index allows only one active
  // template per partner type, so inserting before retiring would collide.
  if (current) {
    await supabaseAdmin
      .from('contract_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', current.id);
  }

  const { data: created, error } = await supabaseAdmin
    .from('contract_templates')
    .insert({
      partner_type: partnerType,
      version: nextVersion,
      title,
      body,
      term_months: termMonths,
      is_active: true,
      created_by: caller?.id || null,
    })
    .select()
    .single();

  if (error) {
    // Put the previous version back rather than leaving the partner type with
    // no active contract at all.
    if (current) {
      await supabaseAdmin
        .from('contract_templates')
        .update({ is_active: true })
        .eq('id', current.id);
    }
    console.error('saveTemplate failed:', error);
    throw new ContractError('Could not save the contract.', 500);
  }

  return { template: created, unchanged: false };
}

// ----------------------------------------------------------------------------
// Dates
// ----------------------------------------------------------------------------
// "effective from date of approval by Certify.cx Administrator" — so the clock
// starts at approval, NOT at signature. A partner who signs before being
// approved does not get a contract that is already running down.
function resolveEffectiveFrom(profile) {
  const approved = profile?.approved_at ? new Date(profile.approved_at) : null;
  if (approved && !Number.isNaN(approved.getTime())) return approved;
  // Not yet approved: the contract is signed but dormant. The approval step
  // stamps the real date (see stampEffectiveDate).
  return null;
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  // Guard the 31 Jan + 1 month = 3 Mar overflow.
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) d.setDate(0);
  return d;
}

const isoDate = (d) => (d ? d.toISOString().slice(0, 10) : null);

// ----------------------------------------------------------------------------
// PDF
// ----------------------------------------------------------------------------
function wrap(text, font, size, maxWidth) {
  const out = [];
  for (const rawLine of winAnsi(text).split('\n')) {
    if (!rawLine.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of rawLine.split(/\s+/)) {
      const attempt = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = attempt;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export async function buildContractPdf(acceptance, org, profile) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const width = PAGE_W - MARGIN * 2;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const line = (text, { size = 9.5, font = regular, color = INK, gap = 4 } = {}) => {
    if (y < MARGIN + 40) newPage();
    page.drawText(winAnsi(text), { x: MARGIN, y, size, font, color });
    y -= size + gap;
  };

  // --- Header -------------------------------------------------------------
  page.drawText(winAnsi(org.trading_name || 'Certify.cx'), {
    x: MARGIN, y: y - 4, size: 18, font: bold, color: ACCENT,
  });
  const heading = 'CONTRACT';
  page.drawText(heading, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(heading, 16),
    y: y - 3, size: 16, font: bold, color: INK,
  });
  y -= 26;

  if (org.legal_name && org.legal_name !== org.trading_name) {
    line(org.legal_name, { size: 8.5, color: MUTED, gap: 1 });
  }
  for (const l of (org.address_lines || [])) line(l, { size: 8.5, color: MUTED, gap: 1 });
  if (org.tax_number) {
    line(`${org.tax_label || 'TRN'}: ${org.tax_number}`, { size: 8.5, color: MUTED, gap: 1 });
  }

  y -= 12;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: RULE,
  });
  y -= 20;

  // --- Title & parties ----------------------------------------------------
  line(acceptance.title_snapshot, { size: 13, font: bold, gap: 10 });

  line('PARTNER', { size: 7.5, font: bold, color: MUTED, gap: 3 });
  line(profile?.company_name || profile?.full_name || acceptance.signed_name,
    { size: 10.5, font: bold, gap: 2 });
  if (profile?.company_name && profile?.full_name) {
    line(profile.full_name, { size: 9, color: MUTED, gap: 1 });
  }
  if (profile?.email) line(profile.email, { size: 9, color: MUTED, gap: 1 });
  if (profile?.country) line(profile.country, { size: 9, color: MUTED, gap: 1 });

  y -= 10;
  const meta = [
    ['Version', `v${acceptance.version}`],
    ['Accepted on', new Date(acceptance.accepted_at).toISOString().slice(0, 10)],
    ['Effective from', acceptance.effective_from || 'On approval'],
    ['Valid until', acceptance.expires_at || '-'],
  ];
  for (const [label, value] of meta) {
    if (y < MARGIN + 40) newPage();
    page.drawText(winAnsi(label), { x: MARGIN, y, size: 8.5, font: bold, color: MUTED });
    page.drawText(winAnsi(value), { x: MARGIN + 95, y, size: 8.5, font: regular, color: INK });
    y -= 13;
  }

  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: RULE,
  });
  y -= 18;

  // --- Body ---------------------------------------------------------------
  for (const l of wrap(acceptance.body_snapshot, regular, 9.5, width)) {
    if (!l) { y -= 6; continue; }
    // A short ALL-CAPS line is a clause heading — render it bold.
    const isHeading = /^[0-9]+\.\s+[A-Z][A-Z\s&(),'-]*$/.test(l) && l.length < 70;
    line(l, { size: 9.5, font: isHeading ? bold : regular, gap: isHeading ? 5 : 2.5 });
  }

  // --- Signature block ----------------------------------------------------
  y -= 14;
  if (y < MARGIN + 110) newPage();
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: RULE,
  });
  y -= 18;

  line('ELECTRONIC SIGNATURE', { size: 7.5, font: bold, color: MUTED, gap: 6 });
  line(acceptance.signed_name, { size: 12, font: bold, gap: 4 });
  line(`Accepted electronically on ${new Date(acceptance.accepted_at).toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    { size: 8.5, color: MUTED, gap: 2 });
  if (acceptance.accepted_ip) {
    line(`Network address: ${acceptance.accepted_ip}`, { size: 8.5, color: MUTED, gap: 2 });
  }
  line('This document was accepted electronically and is valid without a handwritten signature.',
    { size: 8, color: MUTED, gap: 2 });

  return doc.save();
}

async function uploadPdf(supabaseAdmin, { profileId, version, bytes }) {
  // First path segment is the owner id — the storage RLS policy keys off it.
  const path = `${profileId}/consultancy-agreement-v${version}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(bytes), {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) {
    console.error('Contract upload failed:', error);
    return null;
  }
  return path;
}

// ----------------------------------------------------------------------------
// Acceptance
// ----------------------------------------------------------------------------
export async function acceptContract(supabaseAdmin, input, caller, req) {
  // The signer is always the authenticated caller. Taking profileId from the
  // body would let anyone sign on anyone else's behalf.
  const profileId = caller?.id;
  if (!profileId) throw new ContractError('Not signed in.', 401);

  const signedName = requireText(input?.signedName, 'Full name', { max: 200 });
  const partnerType = input?.partnerType || 'consultancy';

  if (input?.confirmed !== true) {
    throw new ContractError('You must confirm that you accept the agreement.');
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, company_name, email, country, approved_at, role, stakeholder_type')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile) throw new ContractError('Profile not found.', 404);

  const isConsultancy = profile.role === 'consultancy'
    || profile.stakeholder_type === 'consultancy';
  if (partnerType === 'consultancy' && !isConsultancy) {
    throw new ContractError('This agreement is for consultancy partners.', 403);
  }

  const template = await getActiveTemplate(supabaseAdmin, partnerType);

  const effectiveFrom = resolveEffectiveFrom(profile);
  const expiresAt = effectiveFrom
    ? addMonths(effectiveFrom, template.term_months || 12)
    : null;

  const row = {
    profile_id: profileId,
    template_id: template.id,
    partner_type: partnerType,
    version: template.version,
    title_snapshot: template.title,
    body_snapshot: template.body,
    signed_name: signedName,
    accepted_ip: clientIp(req),
    user_agent: (req?.headers?.['user-agent'] || '').slice(0, 500) || null,
    effective_from: isoDate(effectiveFrom),
    expires_at: isoDate(expiresAt),
  };

  const { data: acceptance, error } = await supabaseAdmin
    .from('contract_acceptances')
    .insert(row)
    .select()
    .single();

  if (error) {
    // 23505 = already signed this version. Signing twice is not an error the
    // partner can do anything about — hand back what they already signed.
    if (error.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('contract_acceptances')
        .select('*')
        .eq('profile_id', profileId)
        .eq('partner_type', partnerType)
        .eq('version', template.version)
        .maybeSingle();
      if (existing) return { acceptance: existing, alreadySigned: true };
    }
    console.error('acceptContract insert failed:', error);
    throw new ContractError('Could not record your acceptance.', 500);
  }

  // The signature record is the legally meaningful artefact and it is already
  // committed. A PDF that fails to render must not undo it — unlike an
  // invoice, where the document IS the deliverable.
  try {
    const org = await loadOrgSettings(supabaseAdmin);
    const bytes = await buildContractPdf(acceptance, org, profile);
    const storagePath = await uploadPdf(supabaseAdmin, {
      profileId, version: acceptance.version, bytes,
    });
    if (storagePath) {
      await supabaseAdmin
        .from('contract_acceptances')
        .update({ storage_path: storagePath })
        .eq('id', acceptance.id);
      acceptance.storage_path = storagePath;
    }
  } catch (err) {
    console.error('Contract PDF generation failed (acceptance stands):', err);
  }

  return { acceptance, alreadySigned: false };
}

function clientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim().slice(0, 100);
  return req?.socket?.remoteAddress?.slice(0, 100) || null;
}

// ----------------------------------------------------------------------------
// Approval stamping
// ----------------------------------------------------------------------------
// The contract runs from the administrator's approval. When a partner signs
// BEFORE being approved, their acceptance is recorded with no dates; this fills
// them in at the moment of approval. Called from api/approve-registration.js.
export async function stampEffectiveDate(supabaseAdmin, profileId, approvedAtIso) {
  const approved = new Date(approvedAtIso || Date.now());
  if (Number.isNaN(approved.getTime())) return;

  const { data: pending } = await supabaseAdmin
    .from('contract_acceptances')
    .select('id, version, template_id')
    .eq('profile_id', profileId)
    .is('effective_from', null);

  if (!pending?.length) return;

  for (const row of pending) {
    // Re-read the term from the template the partner actually signed rather
    // than assuming 12 — an admin may have published a different term.
    const { data: tpl } = await supabaseAdmin
      .from('contract_templates')
      .select('term_months')
      .eq('id', row.template_id)
      .maybeSingle();

    const months = tpl?.term_months || 12;
    await supabaseAdmin
      .from('contract_acceptances')
      .update({
        effective_from: isoDate(approved),
        expires_at: isoDate(addMonths(approved, months)),
      })
      .eq('id', row.id);
  }
}

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------
// What the signed-in partner needs to render the contract screen: the current
// agreement, and their own signature if they have one.
export async function getContractForPartner(supabaseAdmin, caller, partnerType = 'consultancy') {
  const template = await getActiveTemplate(supabaseAdmin, partnerType);

  const { data: acceptance } = await supabaseAdmin
    .from('contract_acceptances')
    .select('*')
    .eq('profile_id', caller.id)
    .eq('partner_type', partnerType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  let downloadUrl = null;
  if (acceptance?.storage_path) {
    downloadUrl = await signedUrlFor(supabaseAdmin, acceptance.storage_path, 300, BUCKET);
  }

  return {
    template: {
      id: template.id,
      version: template.version,
      title: template.title,
      body: template.body,
      term_months: template.term_months,
    },
    acceptance: acceptance || null,
    // True when they have signed the version currently published. A partner
    // who signed v1 after v2 was issued has NOT accepted the current terms.
    signedCurrentVersion: !!acceptance && acceptance.version === template.version,
    downloadUrl,
  };
}
