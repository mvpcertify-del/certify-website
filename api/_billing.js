// ============================================================================
// Billing — invoice & payment-receipt generation
// ============================================================================
// Client instruction, 19 Jul:
//   "Need to generate the Invoice & be shared with the Client with mode of
//    payment displayed & full payment information. After payment is received
//    from Client, certify.cx will issue a payment receipt voucher & sent to
//    client."
//
// This lives in an underscore-prefixed helper on purpose: api/ is at exactly
// 12 non-underscore routes, which is the Vercel Hobby function ceiling, so a
// 13th route file would break the deployment. The HTTP surface is a set of
// `action` cases on api/checkout.js — the billing route, thematically.
//
// Schema: supabase/phase20_billing_invoices_receipts.sql
// PDF approach mirrors api/issue-certificate.js (pdf-lib → private bucket →
// short-lived signed URL), which is the only PDF pattern already proven here.
// ============================================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sendViaResend } from './_resendClient.js';

const BUCKET = 'billing-documents';

// ----------------------------------------------------------------------------
// Input validation
// ----------------------------------------------------------------------------
// Every field below arrives in an admin's request body. The DB CHECKs are the
// last line of defence, but a constraint violation surfaces as a raw Postgres
// message and — worse — some bad values (a numeric invoice number, a negative
// subtotal) only blow up AFTER the row and the PDF are already committed.

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// Reject NaN, Infinity, booleans, arrays and numeric strings that aren't.
function requireMoney(value, field, { min = 0 } = {}) {
  if (typeof value === 'boolean' || Array.isArray(value) || value === null || value === '') {
    throw badRequest(`${field} must be a number`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw badRequest(`${field} must be a number`);
  if (n < min) throw badRequest(`${field} must be at least ${min}`);
  return Math.round(n * 100) / 100;
}

function optionalText(value, field, { max = 500 } = {}) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} is too long`);
  return trimmed || null;
}

function requireText(value, field, { max = 500 } = {}) {
  const out = optionalText(value, field, { max });
  if (!out) throw badRequest(`${field} is required`);
  return out;
}

// A document number becomes part of a storage path and a UNIQUE key, so it has
// to be a string in a predictable shape.
function optionalDocumentNumber(value, field) {
  const out = optionalText(value, field, { max: 64 });
  if (out && !/^[A-Za-z0-9/_-]+$/.test(out)) {
    throw badRequest(`${field} may only contain letters, numbers, slashes, dashes and underscores`);
  }
  return out;
}

function optionalEmail(value, field) {
  const out = optionalText(value, field, { max: 254 });
  if (out && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out)) {
    throw badRequest(`${field} is not a valid email address`);
  }
  return out;
}

function optionalDate(value, field) {
  const out = optionalText(value, field, { max: 32 });
  if (!out) return null;
  if (Number.isNaN(new Date(out).getTime())) throw badRequest(`${field} is not a valid date`);
  return out.slice(0, 10);
}

// Layout constants — A4 portrait (595 × 842 pt).
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const INK = rgb(0.11, 0.12, 0.15);
const MUTED = rgb(0.42, 0.45, 0.50);
const ACCENT = rgb(0.05, 0.65, 0.45);
const RULE = rgb(0.85, 0.87, 0.89);

// ----------------------------------------------------------------------------
// Issuer identity
// ----------------------------------------------------------------------------
// Read from org_settings (single row, super-admin editable) so changing the
// trading name, TRN or bank details is a form edit rather than a redeploy.
// The fallbacks only apply if phase20 has not been run yet.
export async function loadOrgSettings(supabaseAdmin) {
  const { data } = await supabaseAdmin
    .from('org_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  return data || {
    legal_name: 'WCA GLOBAL FZE',
    trading_name: 'Certify.cx',
    address_lines: ['B21-057 Block B, SRTI Park', 'Sharjah FU 66636', 'United Arab Emirates'],
    tax_label: 'TRN',
    tax_number: '104366665800003',
    email: 'support@certify.cx',
    phone: null,
    bank_details: null,
    invoice_prefix: 'CCX',
    invoice_footer: null,
  };
}

// ----------------------------------------------------------------------------
// Document numbering
// ----------------------------------------------------------------------------
// Numbers come from Postgres sequences so two concurrent issuances can never
// collide. Format: {PREFIX}/INV/{YYYY}/{NNNN}.
async function nextNumber(supabaseAdmin, { sequence, prefix, kind }) {
  const { data, error } = await supabaseAdmin.rpc('nextval_public', { seq_name: sequence });

  let n;
  if (error || data == null) {
    // The RPC is optional (see phase20 notes). Fall back to counting existing
    // rows — good enough for a low-volume manual issuance flow, and the UNIQUE
    // constraint on the number column is the real collision guard.
    const table = kind === 'INV' ? 'invoices' : 'payment_receipts';
    const { count } = await supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true });
    n = (count || 0) + 1;
  } else {
    n = Number(data);
  }

  const year = new Date().getFullYear();
  return `${prefix}/${kind}/${year}/${String(n).padStart(4, '0')}`;
}

// ----------------------------------------------------------------------------
// PDF drawing helpers
// ----------------------------------------------------------------------------
// pdf-lib's standard fonts are WinAnsi-encoded and THROW on any character
// outside that set, aborting the whole document. Bill-to names, addresses and
// notes are free text typed by an admin, so smart quotes, dashes pasted from
// Word, and non-Latin scripts all reach here. Map what has an obvious
// equivalent and drop the rest — a receipt missing one glyph beats a 500 the
// admin cannot act on.
const WINANSI_SUBSTITUTIONS = {
  '\u2212': '-', '\u2013': '-', '\u2014': '-', '\u2010': '-', '\u2011': '-',
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"',
  '\u2026': '...',
  // Narrow/thin/non-breaking/zero-width spaces - Word and web paste are full of them.
  '\u202F': ' ', '\u2009': ' ', '\u00A0': ' ', '\u200B': '',
};

function winAnsi(text) {
  return String(text)
    .replace(
      /[\u2212\u2013\u2014\u2010\u2011\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2026\u202F\u2009\u00A0\u200B]/g,
      (c) => WINANSI_SUBSTITUTIONS[c],
    )
    // Anything still outside Latin-1 (Arabic, CJK, emoji) cannot be drawn at
    // all with these fonts.
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
}

function drawText(page, text, { x, y, size = 10, font, color = INK }) {
  if (text == null || text === '') return;
  page.drawText(winAnsi(text), { x, y, size, font, color });
}

function drawRight(page, text, { x, y, size = 10, font, color = INK }) {
  if (text == null || text === '') return;
  const safe = winAnsi(text);
  const w = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: x - w, y, size, font, color });
}

// Wrap a long string to a pixel width, returning an array of lines.
function wrap(text, font, size, maxWidth) {
  if (!text) return [];
  // Sanitize before measuring — widthOfTextAtSize throws on the same
  // characters drawText does, and it runs first.
  const words = winAnsi(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function money(n, currency = 'USD') {
  const sym = currency === 'USD' ? 'US$' : `${currency} `;
  return `${sym}${Number(n || 0).toFixed(2)}`;
}

function formatDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

// Shared header: issuer block on the left, document title on the right.
function drawHeader(page, { org, title, fonts }) {
  const { bold, regular } = fonts;
  let y = PAGE_H - MARGIN;

  drawText(page, org.trading_name || org.legal_name, { x: MARGIN, y, size: 20, font: bold, color: ACCENT });
  y -= 16;

  if (org.trading_name && org.legal_name && org.trading_name !== org.legal_name) {
    drawText(page, org.legal_name, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 12;
  }

  for (const line of org.address_lines || []) {
    drawText(page, line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 11;
  }
  if (org.tax_number) {
    drawText(page, `${org.tax_label || 'TRN'}: ${org.tax_number}`, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 11;
  }
  if (org.email) {
    drawText(page, org.email, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 11;
  }

  drawRight(page, title, { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN, size: 24, font: bold });

  return Math.min(y, PAGE_H - MARGIN - 80) - 14;
}

// Bank details + custom footer, pinned to the bottom of the page.
function drawFooter(page, { org, fonts }) {
  const { regular } = fonts;
  const width = PAGE_W - MARGIN * 2;
  let y = MARGIN + 46;

  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: PAGE_W - MARGIN, y: y + 12 },
    thickness: 0.5,
    color: RULE,
  });

  for (const line of wrap(org.bank_details, regular, 7.5, width)) {
    drawText(page, line, { x: MARGIN, y, size: 7.5, font: regular, color: MUTED });
    y -= 9;
  }
}

// ----------------------------------------------------------------------------
// Invoice PDF
// ----------------------------------------------------------------------------
async function buildInvoicePdf(invoice, org) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold, regular };
  const width = PAGE_W - MARGIN * 2;

  let y = drawHeader(page, { org, title: 'INVOICE', fonts });

  // --- Bill to ---
  drawText(page, 'BILL TO', { x: MARGIN, y, size: 8, font: bold, color: MUTED });
  y -= 14;
  drawText(page, invoice.bill_to_name, { x: MARGIN, y, size: 11, font: bold });
  y -= 13;
  for (const line of wrap(invoice.bill_to_address, regular, 9, width / 2)) {
    drawText(page, line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 11;
  }
  if (invoice.bill_to_country) {
    drawText(page, invoice.bill_to_country, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 11;
  }
  if (invoice.bill_to_email) {
    drawText(page, invoice.bill_to_email, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
    y -= 11;
  }

  // --- Invoice meta (right-aligned, level with Bill To) ---
  let metaY = y + 60;
  const metaX = PAGE_W - MARGIN;
  const meta = [
    ['Invoice No.', invoice.invoice_number],
    ['Invoice Date', formatDate(invoice.issue_date)],
    ['Due Date', formatDate(invoice.due_date)],
  ];
  for (const [label, value] of meta) {
    if (!value) continue;
    drawRight(page, label, { x: metaX - 110, y: metaY, size: 8, font: bold, color: MUTED });
    drawRight(page, value, { x: metaX, y: metaY, size: 9, font: regular });
    metaY -= 14;
  }

  y = Math.min(y, metaY) - 24;

  // --- Line-item table ---
  const colDesc = MARGIN;
  const colQty = MARGIN + 330;
  const colUnit = MARGIN + 400;
  const colAmt = PAGE_W - MARGIN;

  page.drawRectangle({
    x: MARGIN - 6, y: y - 6, width: width + 12, height: 22,
    color: rgb(0.96, 0.97, 0.98),
  });
  drawText(page, 'DESCRIPTION', { x: colDesc, y, size: 8, font: bold, color: MUTED });
  drawRight(page, 'QTY', { x: colQty, y, size: 8, font: bold, color: MUTED });
  drawRight(page, 'UNIT PRICE', { x: colUnit, y, size: 8, font: bold, color: MUTED });
  drawRight(page, 'AMOUNT', { x: colAmt, y, size: 8, font: bold, color: MUTED });
  y -= 24;

  const descLines = wrap(invoice.description, regular, 10, 300);
  drawText(page, descLines[0] || '', { x: colDesc, y, size: 10, font: regular });
  drawRight(page, '1.00', { x: colQty, y, size: 10, font: regular });
  drawRight(page, money(invoice.subtotal, invoice.currency), { x: colUnit, y, size: 10, font: regular });
  drawRight(page, money(invoice.subtotal, invoice.currency), { x: colAmt, y, size: 10, font: regular });
  y -= 13;
  for (const line of descLines.slice(1)) {
    drawText(page, line, { x: colDesc, y, size: 10, font: regular, color: MUTED });
    y -= 12;
  }

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: RULE });
  y -= 20;

  // --- Totals ---
  const totalRow = (label, value, { strong = false, color = INK } = {}) => {
    drawRight(page, label, { x: colAmt - 110, y, size: strong ? 10 : 9, font: strong ? bold : regular, color: strong ? INK : MUTED });
    drawRight(page, value, { x: colAmt, y, size: strong ? 12 : 9, font: strong ? bold : regular, color });
    y -= strong ? 20 : 15;
  };

  totalRow('Subtotal', money(invoice.subtotal, invoice.currency));
  if (Number(invoice.discount_amount) > 0) {
    totalRow(
      invoice.discount_label || 'Discount',
      `- ${money(invoice.discount_amount, invoice.currency)}`,
      { color: ACCENT },
    );
  }
  totalRow('Total', money(invoice.total, invoice.currency), { strong: true });

  // Mode of payment + full payment information — explicitly requested.
  if (invoice.payment_method) {
    totalRow('Payment method', invoice.payment_method);
  }
  if (Number(invoice.amount_paid) > 0) {
    totalRow('Paid', money(invoice.amount_paid, invoice.currency), { color: ACCENT });
  }
  const due = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
  totalRow('Amount Due', money(due, invoice.currency), { strong: true, color: due > 0 ? INK : ACCENT });

  // --- Notes ---
  y -= 10;
  const notes = invoice.notes || org.invoice_footer;
  if (notes) {
    for (const line of wrap(notes, regular, 8.5, width)) {
      drawText(page, line, { x: MARGIN, y, size: 8.5, font: regular, color: MUTED });
      y -= 11;
    }
  }
  if (invoice.payment_terms) {
    y -= 6;
    for (const line of wrap(invoice.payment_terms, regular, 8.5, width)) {
      drawText(page, line, { x: MARGIN, y, size: 8.5, font: regular, color: MUTED });
      y -= 11;
    }
  }

  drawFooter(page, { org, fonts });
  return doc.save();
}

// ----------------------------------------------------------------------------
// Payment receipt PDF
// ----------------------------------------------------------------------------
async function buildReceiptPdf(receipt, org, invoice) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const fonts = { bold, regular };

  let y = drawHeader(page, { org, title: 'RECEIPT', fonts });

  drawText(page, `Payment Receipt: ${receipt.receipt_number}`, { x: MARGIN, y, size: 14, font: bold });
  y -= 24;

  const rows = [
    ['Payment Date', formatDate(receipt.payment_date)],
    ['Customer', receipt.customer_name],
    ['Payment Method', receipt.payment_method || '—'],
    ['Payment Amount', money(receipt.amount, receipt.currency)],
    ['Memo', receipt.memo || (invoice ? invoice.invoice_number : '')],
  ];
  for (const [label, value] of rows) {
    if (!value) continue;
    drawText(page, label, { x: MARGIN, y, size: 9, font: bold, color: MUTED });
    drawText(page, value, { x: MARGIN + 130, y, size: 10, font: regular });
    y -= 17;
  }

  y -= 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: RULE });
  y -= 22;

  // Settlement table — mirrors the client's own receipt format: the invoice,
  // then the payment against it, then the remaining balance.
  if (invoice) {
    drawText(page, 'INVOICE', { x: MARGIN, y, size: 8, font: bold, color: MUTED });
    drawText(page, 'DATE', { x: MARGIN + 180, y, size: 8, font: bold, color: MUTED });
    drawRight(page, 'AMOUNT', { x: PAGE_W - MARGIN, y, size: 8, font: bold, color: MUTED });
    y -= 16;

    drawText(page, invoice.invoice_number, { x: MARGIN, y, size: 9, font: regular });
    drawText(page, formatDate(invoice.issue_date), { x: MARGIN + 180, y, size: 9, font: regular });
    drawRight(page, money(invoice.total, invoice.currency), { x: PAGE_W - MARGIN, y, size: 9, font: regular });
    y -= 14;

    drawText(page, receipt.receipt_number, { x: MARGIN, y, size: 9, font: regular });
    drawText(page, formatDate(receipt.payment_date), { x: MARGIN + 180, y, size: 9, font: regular });
    drawRight(page, `- ${money(receipt.amount, receipt.currency)}`, { x: PAGE_W - MARGIN, y, size: 9, font: regular, color: ACCENT });
    y -= 20;

    const balance = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
    drawText(page, `Due amount for ${invoice.invoice_number}`, { x: MARGIN, y, size: 10, font: bold });
    drawRight(page, money(balance, invoice.currency), { x: PAGE_W - MARGIN, y, size: 12, font: bold, color: balance > 0 ? INK : ACCENT });
    y -= 26;
  }

  drawText(page, 'Thank you for your payment.', { x: MARGIN, y, size: 9, font: regular, color: MUTED });

  drawFooter(page, { org, fonts });
  return doc.save();
}

// ----------------------------------------------------------------------------
// Storage
// ----------------------------------------------------------------------------
// Path is {client_id}/{kind}-{number}.pdf so the first segment is the owner
// check used by the storage RLS policies in phase20.
async function uploadPdf(supabaseAdmin, { clientId, kind, number, bytes }) {
  const safeNumber = String(number).replace(/[^A-Za-z0-9_-]+/g, '-');
  const path = `${clientId || 'unassigned'}/${kind}-${safeNumber}.pdf`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });

  if (error) {
    // Storage errors carry bucket paths and internal detail — log them, but
    // don't relay them to the browser.
    console.error(`uploadPdf failed for ${kind} ${number}:`, error);
    throw new Error(`Could not store the ${kind} PDF.`);
  }
  return path;
}

// `bucket` defaults to the billing bucket so existing callers are unchanged;
// api/_contract.js passes its own.
export async function signedUrlFor(supabaseAdmin, storagePath, seconds = 300, bucket = BUCKET) {
  if (!storagePath) return null;
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, seconds);
  return data?.signedUrl || null;
}

// ----------------------------------------------------------------------------
// Email
// ----------------------------------------------------------------------------
// Best-effort: a mail outage must never roll back a successfully issued
// document. The caller surfaces `emailSent: false` so staff can retry.
async function emailDocument({ to, subject, heading, body, org, attachment }) {
  if (!to) return false;
  try {
    const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    await sendViaResend({
      to,
      subject,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1d1f26">
          <h2 style="color:#0da678;margin:0 0 16px">${safe(heading)}</h2>
          <p style="line-height:1.6">${safe(body)}</p>
          <p style="line-height:1.6;color:#6b7280;font-size:13px">
            The document is attached to this email as a PDF. You can also view it any time
            from your ${safe(org.trading_name || 'Certify.cx')} dashboard under Billing.
          </p>
          <p style="color:#6b7280;font-size:12px;margin-top:24px">
            ${safe(org.trading_name || 'Certify.cx')}${org.tax_number ? ` · ${safe(org.tax_label || 'TRN')} ${safe(org.tax_number)}` : ''}
          </p>
        </div>`,
      attachments: attachment ? [attachment] : undefined,
    });
    return true;
  } catch (err) {
    console.error('billing: email send failed (non-blocking)', err);
    return false;
  }
}

// ============================================================================
// Public API
// ============================================================================

// Issue an invoice. Idempotent per application: a second call for the same
// application returns the existing invoice rather than creating a duplicate
// (enforced for real by the partial unique index in phase20).
export async function issueInvoice(supabaseAdmin, input, caller) {
  const {
    applicationId = null,
    clientId = null,
    billToName,
    billToAddress = null,
    billToEmail = null,
    billToCountry = null,
    description,
    subtotal,
    discountAmount = 0,
    discountLabel = null,
    amountPaid = 0,
    paymentMethod = null,
    paymentTerms = null,
    notes = null,
    issueDate = null,
    dueDate = null,
    invoiceNumber = null,
    currency = 'USD',
    send = true,
  } = input || {};

  const name = requireText(billToName, 'billToName', { max: 200 });
  const desc = requireText(description, 'description', { max: 1000 });
  const sub = requireMoney(subtotal, 'subtotal');
  const number0 = optionalDocumentNumber(invoiceNumber, 'invoiceNumber');
  const email = optionalEmail(billToEmail, 'billToEmail');

  if (applicationId) {
    const { data: existing } = await supabaseAdmin
      .from('invoices').select('*').eq('application_id', applicationId).maybeSingle();
    if (existing) return { invoice: existing, alreadyExisted: true, emailSent: false };
  }

  const org = await loadOrgSettings(supabaseAdmin);

  // Clamp so a mistyped discount can never produce a negative invoice total.
  const disc = Math.min(sub, requireMoney(discountAmount || 0, 'discountAmount'));
  const total = Math.round((sub - disc) * 100) / 100;
  const paid = Math.min(total, requireMoney(amountPaid || 0, 'amountPaid'));

  const number = number0
    || await nextNumber(supabaseAdmin, { sequence: 'invoice_number_seq', prefix: org.invoice_prefix || 'CCX', kind: 'INV' });

  const row = {
    invoice_number: number,
    application_id: applicationId,
    client_id: clientId,
    bill_to_name: name,
    bill_to_address: optionalText(billToAddress, 'billToAddress', { max: 1000 }),
    bill_to_email: email,
    bill_to_country: optionalText(billToCountry, 'billToCountry', { max: 100 }),
    description: desc,
    currency,
    subtotal: sub,
    discount_amount: disc,
    discount_label: optionalText(discountLabel, 'discountLabel', { max: 200 }),
    total,
    amount_paid: paid,
    payment_method: optionalText(paymentMethod, 'paymentMethod', { max: 100 }),
    payment_terms: optionalText(paymentTerms, 'paymentTerms', { max: 1000 }),
    notes: optionalText(notes, 'notes', { max: 2000 }),
    issue_date: optionalDate(issueDate, 'issueDate') || new Date().toISOString().slice(0, 10),
    due_date: optionalDate(dueDate, 'dueDate'),
    status: paid >= total ? 'paid' : 'issued',
    created_by: caller?.id || null,
  };

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices').insert(row).select().single();

  if (error) {
    // 23505 = unique violation. The check-then-insert above is racy; the
    // partial unique index on application_id is what actually prevents a
    // duplicate. If we lost that race, return the invoice the winner created
    // rather than a 500 the admin can do nothing with.
    if (error.code === '23505' && applicationId) {
      const { data: winner } = await supabaseAdmin
        .from('invoices').select('*').eq('application_id', applicationId).maybeSingle();
      if (winner) return { invoice: winner, alreadyExisted: true, emailSent: false };
    }
    console.error('issueInvoice insert failed:', error);
    throw new Error('Could not save the invoice.');
  }

  // From here on the invoice row exists. If PDF/storage fails we remove the
  // row rather than leaving a numbered invoice with no document behind it —
  // same cleanup discipline as api/issue-certificate.js.
  let storagePath;
  let bytes;
  try {
    bytes = await buildInvoicePdf(invoice, org);
    storagePath = await uploadPdf(supabaseAdmin, {
      clientId, kind: 'invoice', number, bytes,
    });
  } catch (err) {
    await supabaseAdmin.from('invoices').delete().eq('id', invoice.id);
    throw err;
  }

  await supabaseAdmin.from('invoices').update({ storage_path: storagePath }).eq('id', invoice.id);
  invoice.storage_path = storagePath;

  let emailSent = false;
  if (send && (billToEmail || null)) {
    emailSent = await emailDocument({
      to: billToEmail,
      subject: `Invoice ${number} — ${org.trading_name || 'Certify.cx'}`,
      heading: `Invoice ${number}`,
      body: `Please find attached invoice ${number} for ${money(total, currency)}.`
        + (paid >= total ? ' This invoice is fully paid — thank you.' : ''),
      org,
      attachment: { filename: `${number.replace(/\//g, '-')}.pdf`, content: Buffer.from(bytes).toString('base64') },
    });
    if (emailSent) {
      await supabaseAdmin.from('invoices')
        .update({ sent_at: new Date().toISOString() }).eq('id', invoice.id);
    }
  }

  return { invoice, alreadyExisted: false, emailSent };
}

// Issue a payment receipt. Called after money is confirmed received — either
// automatically on card confirmation, or by an admin verifying a cash/bank
// payment.
export async function issueReceipt(supabaseAdmin, input, caller) {
  const {
    invoiceId = null,
    applicationId = null,
    clientId = null,
    customerName,
    amount,
    paymentMethod = null,
    paymentDate = null,
    memo = null,
    currency = 'USD',
    receiptNumber = null,
    send = true,
  } = input || {};

  const customer = requireText(customerName, 'customerName', { max: 200 });
  let amt = requireMoney(amount, 'amount');
  if (amt <= 0) throw badRequest('amount must be greater than zero');
  const number0 = optionalDocumentNumber(receiptNumber, 'receiptNumber');

  const org = await loadOrgSettings(supabaseAdmin);

  let invoice = null;
  if (invoiceId) {
    const { data } = await supabaseAdmin.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
    if (!data) throw badRequest('That invoice could not be found.');

    // The invoice must belong to the same order/client this receipt is being
    // filed against. Without this, any admin could settle any invoice in the
    // system — and the confirmation email would go to its owner, not to them.
    if (applicationId && data.application_id && data.application_id !== applicationId) {
      throw badRequest('That invoice belongs to a different application.');
    }
    if (clientId && data.client_id && data.client_id !== clientId) {
      throw badRequest('That invoice belongs to a different client.');
    }
    if (data.status === 'cancelled') {
      throw badRequest('That invoice has been cancelled and cannot take a payment.');
    }

    // Refuse to record more than is actually outstanding. Previously a $10,000
    // receipt against a $300 invoice was accepted and printed.
    const outstanding = Math.round((Number(data.total) - Number(data.amount_paid || 0)) * 100) / 100;
    if (outstanding <= 0) {
      throw badRequest('That invoice is already fully paid.');
    }
    if (amt > outstanding) {
      throw badRequest(`That is more than the outstanding balance (${money(outstanding, data.currency)}).`);
    }

    invoice = data;
  }

  const number = number0
    || await nextNumber(supabaseAdmin, { sequence: 'receipt_number_seq', prefix: org.invoice_prefix || 'CCX', kind: 'RCP' });

  const row = {
    receipt_number: number,
    invoice_id: invoiceId,
    application_id: applicationId,
    client_id: clientId,
    customer_name: customer,
    currency,
    amount: amt,
    payment_method: optionalText(paymentMethod, 'paymentMethod', { max: 100 }),
    payment_date: optionalDate(paymentDate, 'paymentDate') || new Date().toISOString().slice(0, 10),
    memo: optionalText(memo, 'memo', { max: 500 }) || invoice?.invoice_number || null,
    created_by: caller?.id || null,
  };

  const { data: receipt, error } = await supabaseAdmin
    .from('payment_receipts').insert(row).select().single();
  if (error) {
    console.error('issueReceipt insert failed:', error);
    throw new Error('Could not save the receipt.');
  }

  // Settle the invoice BEFORE rendering, so the PDF shows the balance that
  // results from this payment rather than the balance before it.
  //
  // Done via an RPC that increments under a row lock and caps at the invoice
  // total. Read-modify-write here would lose an update whenever two receipts
  // are issued concurrently — both would read the same amount_paid and one
  // payment would silently disappear from the invoice.
  if (invoice) {
    const { data: updated, error: settleErr } = await supabaseAdmin
      .rpc('apply_invoice_payment', { p_invoice_id: invoice.id, p_amount: amt });

    if (settleErr) {
      // The receipt row would otherwise stand as proof of a payment that was
      // never applied to the invoice.
      await supabaseAdmin.from('payment_receipts').delete().eq('id', receipt.id);
      console.error('apply_invoice_payment failed:', settleErr);
      throw new Error('Could not apply the payment to the invoice.');
    }
    if (updated) invoice = Array.isArray(updated) ? updated[0] : updated;
  }

  let storagePath;
  let bytes;
  try {
    bytes = await buildReceiptPdf(receipt, org, invoice);
    storagePath = await uploadPdf(supabaseAdmin, {
      clientId, kind: 'receipt', number, bytes,
    });
  } catch (err) {
    await supabaseAdmin.from('payment_receipts').delete().eq('id', receipt.id);
    throw err;
  }

  await supabaseAdmin.from('payment_receipts').update({ storage_path: storagePath }).eq('id', receipt.id);
  receipt.storage_path = storagePath;

  let emailSent = false;
  // The `email` fallback is an arbitrary caller-supplied address, so it is
  // validated rather than handed straight to Resend.
  const to = invoice?.bill_to_email || optionalEmail(input.email, 'email') || null;
  if (send && to) {
    emailSent = await emailDocument({
      to,
      subject: `Payment receipt ${number} — ${org.trading_name || 'Certify.cx'}`,
      heading: `Payment received — ${money(amt, currency)}`,
      body: `We have received your payment of ${money(amt, currency)}`
        + (paymentMethod ? ` by ${paymentMethod}` : '')
        + `. Your receipt ${number} is attached.`,
      org,
      attachment: { filename: `${number.replace(/\//g, '-')}.pdf`, content: Buffer.from(bytes).toString('base64') },
    });
    if (emailSent) {
      await supabaseAdmin.from('payment_receipts')
        .update({ sent_at: new Date().toISOString() }).eq('id', receipt.id);
    }
  }

  return { receipt, invoice, emailSent };
}
