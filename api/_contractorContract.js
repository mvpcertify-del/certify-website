// ============================================================================
// Contractor contracts — tri-party agreement (WCA GLOBAL / Contractor / Certify.cx)
// ============================================================================
//
// Client correction, 28 Oct: a contractor's agreement is NOT one generic
// template everyone clicks "I agree" on (that was the first, wrong, attempt —
// see git history). A contractor "provides a service based on agreed tasks &
// is compensated based on completion of the service", so each contract is
// authored per-contractor by an admin: job scope, compensation, and a KPI
// table, then signed by three parties before it's final:
//   1st party — WCA GLOBAL (a fixed company, not a dynamic account — the
//               admin acts on its behalf; there is no separate WCA GLOBAL
//               login in this system)
//   2nd party — the contractor themself, from their own dashboard
//   3rd party — Certify.cx, the platform (also the admin, at finalize time)
//
// This is a helper module, not a route — api/ sits at exactly 12
// non-underscore files (the Vercel Hobby ceiling); the endpoints are
// `action` cases on api/user.js. The PDF pipeline mirrors api/_contract.js
// (build with pdf-lib → upload to a private bucket → hand back a signed URL)
// and api/_billing.js before it.
// ============================================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export class ContractorContractError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const CONTRACTOR_CONTRACT_STATUSES = ['draft', 'pending_signatures', 'signed', 'terminated'];
export const CONTRACTOR_PARTY_ROLES = ['wca_global', 'contractor', 'platform'];
const PDF_BUCKET = 'contractor-contract-pdfs';

// A4 portrait, matching the invoice/consultancy-contract documents.
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 55;
const INK = rgb(0.11, 0.12, 0.15);
const MUTED = rgb(0.42, 0.45, 0.50);
const ACCENT = rgb(0.05, 0.65, 0.45);
const RULE = rgb(0.85, 0.87, 0.89);

// Same WinAnsi safety net as api/_contract.js — admin-typed job/KPI text will
// get pasted from Word and bring smart quotes / long dashes with it.
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

export function generateReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `WCA-${Date.now()}-${rand}`;
}

function requireText(value, field, { max = 2000 } = {}) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new ContractorContractError(`${field} is required.`);
  if (s.length > max) throw new ContractorContractError(`${field} is too long.`);
  return s;
}

// Validates and normalizes the fields an admin supplies when authoring a
// contract. Throws ContractorContractError on anything invalid.
export function validateContractInput(input) {
  const jobTitle = requireText(input?.jobTitle, 'Job title', { max: 200 });
  const jobDescription = requireText(input?.jobDescription, 'Job description', { max: 10000 });
  const keyResponsibilities = requireText(input?.keyResponsibilities, 'Key responsibilities', { max: 10000 });
  const compensationType = requireText(input?.compensationType, 'Compensation type', { max: 100 });
  const compensationRate = Number(input?.compensationRate);
  if (!Number.isFinite(compensationRate) || compensationRate < 0) {
    throw new ContractorContractError('Compensation rate must be a non-negative number.');
  }
  const compensationCurrency = ['INR', 'USD'].includes(input?.compensationCurrency)
    ? input.compensationCurrency : 'USD';
  const paymentSchedule = requireText(input?.paymentSchedule, 'Payment schedule', { max: 500 });

  const kpiDefinitions = Array.isArray(input?.kpiDefinitions) ? input.kpiDefinitions : [];
  if (!kpiDefinitions.length) {
    throw new ContractorContractError('At least one KPI is required.');
  }
  if (kpiDefinitions.length > 50) {
    throw new ContractorContractError('Too many KPIs (max 50).');
  }
  const cleanKpis = kpiDefinitions.map((k, i) => ({
    description: requireText(k?.description, `KPI ${i + 1} description`, { max: 500 }),
    target: requireText(k?.target, `KPI ${i + 1} target`, { max: 300 }),
    measurement: requireText(k?.measurement, `KPI ${i + 1} measurement`, { max: 300 }),
    consequence: requireText(k?.consequence, `KPI ${i + 1} consequence`, { max: 300 }),
  }));

  const jurisdiction = input?.jurisdiction ? String(input.jurisdiction).trim().slice(0, 200) : null;
  const noticePeriodDays = input?.noticePeriodDays != null && input.noticePeriodDays !== ''
    ? Number(input.noticePeriodDays) : null;
  if (noticePeriodDays != null && (!Number.isInteger(noticePeriodDays) || noticePeriodDays < 0)) {
    throw new ContractorContractError('Notice period must be a whole number of days.');
  }
  const startDate = input?.startDate || null;
  const endDate = input?.endDate || null;

  return {
    job_title: jobTitle,
    job_description: jobDescription,
    key_responsibilities: keyResponsibilities,
    compensation_type: compensationType,
    compensation_rate: compensationRate,
    compensation_currency: compensationCurrency,
    payment_schedule: paymentSchedule,
    kpi_definitions: cleanKpis,
    jurisdiction,
    notice_period_days: noticePeriodDays,
    start_date: startDate,
    end_date: endDate,
  };
}

// ----------------------------------------------------------------------------
// PDF
// ----------------------------------------------------------------------------
export async function buildContractorContractPdf(contract, contractorProfile, signatures) {
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

  const heading = (text) => {
    if (y < MARGIN + 60) newPage();
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: RULE });
    y -= 16;
    line(text, { size: 11, font: bold, gap: 8 });
  };

  const paragraph = (text, opts = {}) => {
    for (const l of wrap(text, regular, 9.5, width)) {
      if (!l) { y -= 5; continue; }
      line(l, { size: 9.5, gap: 2.5, ...opts });
    }
  };

  // --- Header -------------------------------------------------------------
  page.drawText('WCA GLOBAL', { x: MARGIN, y: y - 4, size: 18, font: bold, color: ACCENT });
  const hdg = 'INDEPENDENT CONTRACTOR AGREEMENT';
  page.drawText(hdg, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(hdg, 10), y: y - 1, size: 10, font: bold, color: INK,
  });
  y -= 26;
  line(`Reference: ${contract.reference}`, { size: 8.5, color: MUTED, gap: 1 });
  line(`Status: ${contract.status}`, { size: 8.5, color: MUTED, gap: 1 });

  // --- Parties --------------------------------------------------------------
  heading('PARTIES');
  line('1st Party', { size: 8, font: bold, color: MUTED, gap: 2 });
  line('WCA GLOBAL', { size: 10.5, font: bold, gap: 8 });
  line('2nd Party ("the Contractor")', { size: 8, font: bold, color: MUTED, gap: 2 });
  line(contractorProfile?.full_name || contractorProfile?.email || 'Contractor', { size: 10.5, font: bold, gap: 1 });
  if (contractorProfile?.email) line(contractorProfile.email, { size: 9, color: MUTED, gap: 1 });
  if (contractorProfile?.country) line(contractorProfile.country, { size: 9, color: MUTED, gap: 8 });
  line('3rd Party ("the Platform")', { size: 8, font: bold, color: MUTED, gap: 2 });
  line('Certify.cx — https://certify.cx', { size: 10.5, font: bold, gap: 2 });

  // --- Schedule A: Job -------------------------------------------------------
  heading('SCHEDULE A — JOB DESCRIPTION & KEY RESPONSIBILITIES');
  line(`Job Title: ${contract.job_title || '-'}`, { font: bold, gap: 8 });
  line('Job Description:', { font: bold, gap: 3 });
  paragraph(contract.job_description || '-');
  y -= 4;
  line('Key Responsibilities:', { font: bold, gap: 3 });
  paragraph(contract.key_responsibilities || '-');

  // --- Schedule B: Compensation -----------------------------------------------
  heading('SCHEDULE B — COMPENSATION');
  line(`Type: ${contract.compensation_type || '-'}`, { gap: 3 });
  line(`Rate: ${contract.compensation_currency || 'USD'} ${Number(contract.compensation_rate || 0).toLocaleString()}`, { gap: 3 });
  line(`Payment Schedule: ${contract.payment_schedule || '-'}`, { gap: 3 });
  if (contract.jurisdiction) line(`Jurisdiction: ${contract.jurisdiction}`, { gap: 3 });
  if (contract.notice_period_days != null) line(`Notice Period: ${contract.notice_period_days} days`, { gap: 3 });
  if (contract.start_date) line(`Start Date: ${contract.start_date}`, { gap: 3 });
  if (contract.end_date) line(`End Date: ${contract.end_date}`, { gap: 3 });

  // --- Schedule C: KPIs --------------------------------------------------------
  heading('SCHEDULE C — KEY PERFORMANCE INDICATORS');
  const kpis = Array.isArray(contract.kpi_definitions) ? contract.kpi_definitions : [];
  kpis.forEach((kpi, i) => {
    line(`${i + 1}. ${kpi.description}`, { font: bold, gap: 2 });
    paragraph(`Target: ${kpi.target}`);
    paragraph(`Measurement: ${kpi.measurement}`);
    paragraph(`Consequence: ${kpi.consequence}`);
    y -= 4;
  });

  // --- Signatures ---------------------------------------------------------
  heading('SIGNATURES');
  const byRole = (role) => (signatures || []).find((s) => s.party_role === role);
  const sigBlock = (label, role) => {
    const sig = byRole(role);
    line(label, { size: 8, font: bold, color: MUTED, gap: 2 });
    if (sig) {
      line(sig.signed_name, { size: 10.5, font: bold, gap: 2 });
      line(`Accepted electronically on ${new Date(sig.signed_at).toISOString().replace('T', ' ').slice(0, 19)} UTC`,
        { size: 8, color: MUTED, gap: 8 });
    } else {
      line('Not yet signed', { size: 9, color: MUTED, gap: 8 });
    }
  };
  sigBlock('1st Party — WCA GLOBAL', 'wca_global');
  sigBlock('2nd Party — Contractor', 'contractor');
  sigBlock('3rd Party — Certify.cx (Platform)', 'platform');
  line('This document was accepted electronically and is valid without a handwritten signature.',
    { size: 7.5, color: MUTED, gap: 2 });

  return doc.save();
}

export async function uploadContractorContractPdf(supabaseAdmin, { contractId, reference, bytes }) {
  const path = `${contractId}/${reference}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from(PDF_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
  if (error) {
    console.error('Contractor contract PDF upload failed:', error);
    return null;
  }
  return path;
}
