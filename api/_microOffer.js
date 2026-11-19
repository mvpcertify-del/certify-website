// MICRO "What's your budget?" offer: the public request form and the Super Admin decision.
//
// No new serverless function (the Hobby plan allows 12): api/notify-event.js hands every action that starts with
// "micro-offer-" to this file.
//   micro-offer-submit   public. Stores the request, thanks the company by email and alerts the admins.
//   micro-offer-list     Super Admin. The requests, newest first.
//   micro-offer-decide   Super Admin. Approve or decline; the company is told by email.
//
// The offer (client, 18 Nov): ISO 9001 only, companies with 1 to 9 employees and 1 location, USD 500 to 1,500,
// all three stages plus a certificate valid for one year, valid up to 31.12.2026. The reply is promised within 3 hours.

import { getAdmin, verifyAdmin } from './_verifyAdmin.js';
import { sendViaResend } from './_resendClient.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { microOfferReceivedEmail, microOfferDecisionEmail } from './_emailTemplates.js';
import { APP_URL } from './_appUrl.js';

export const OFFER = { min: 500, max: 1500, standard: 'ISO 9001', validUntil: '2026-12-31', replyHours: 3 };

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
// Trims, caps the length and turns control characters (line breaks, tabs) into spaces.
const clean = (v, max) => Array.from(String(v == null ? '' : v), (ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch)).join('').trim().slice(0, max);

/** Checks the form and returns { ok, errors, row }. Pure, so it is easy to test. */
export function validateRequest(body = {}, now = new Date()) {
  const errors = {};
  const budget = Math.round(Number(body.budget_usd));
  if (!Number.isFinite(budget) || budget < OFFER.min || budget > OFFER.max) errors.budget_usd = `Choose a budget from $${OFFER.min} to $${OFFER.max.toLocaleString('en-US')}.`;

  const company = clean(body.company_name, 160);
  if (company.length < 2) errors.company_name = 'Enter the company name.';
  const contact = clean(body.contact_name, 120);
  if (contact.length < 2) errors.contact_name = 'Enter the contact person.';
  const title = clean(body.job_title, 120);
  if (title.length < 2) errors.job_title = 'Enter the job title.';
  const activity = clean(body.main_activity, 300);
  if (activity.length < 4) errors.main_activity = 'Describe the main activity of the company.';

  const email = clean(body.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  const phone = clean(body.phone, 40);
  if ((phone.match(/\d/g) || []).length < 6) errors.phone = 'Enter a contact number.';

  let website = clean(body.website, 200);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  if (website && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(website)) errors.website = 'Enter a valid website address.';

  const employees = Math.round(Number(body.employees));
  if (!Number.isFinite(employees) || employees < 1 || employees > 9) errors.employees = 'The offer is for companies with 1 to 9 employees.';
  if (body.one_location !== true) errors.one_location = 'The offer is for companies with 1 location. Please confirm.';

  if (now > new Date(`${OFFER.validUntil}T23:59:59Z`)) errors.offer = 'This offer has ended.';

  const ok = Object.keys(errors).length === 0;
  return {
    ok, errors,
    row: ok ? {
      budget_usd: budget, standard: OFFER.standard, company_name: company, website: website || null, contact_name: contact,
      job_title: title, phone, email, main_activity: activity, employees, message: clean(body.message, 1000) || null,
    } : null,
  };
}

const fail = (status, message) => Object.assign(new Error(message), { status });

async function submit(db, body) {
  // A hidden field that people never see: bots fill it in, so such a request is dropped quietly.
  if (clean(body.fax, 50)) return { ok: true };

  const { ok, errors, row } = validateRequest(body);
  if (!ok) return { ok: false, errors };

  // One open request per address in 24 hours, so a double click or a refresh does not create duplicates.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await db.from('micro_offer_requests').select('id').eq('email', row.email).gte('created_at', since).limit(1);
  if (recent?.length) return { ok: true, duplicate: true };

  const { data, error } = await db.from('micro_offer_requests').insert(row).select('id').single();
  if (error) throw error;

  // Both emails are best effort: the request is already saved.
  const mail = microOfferReceivedEmail({ name: row.contact_name, companyName: row.company_name, budget: row.budget_usd, hours: OFFER.replyHours });
  await sendViaResend({ to: row.email, ...mail }).catch((e) => console.error('[micro-offer] confirmation failed', e?.message));
  await notifyAdmins(db, {
    title: 'New MICRO offer request',
    message: `${row.company_name} asks for ISO 9001 at $${row.budget_usd}. Reply within ${OFFER.replyHours} hours.`,
    details: [
      ['Company', row.company_name], ['Contact', `${row.contact_name}, ${row.job_title}`], ['Email', row.email], ['Phone', row.phone],
      ['Website', row.website], ['Employees', String(row.employees)], ['Main activity', row.main_activity], ['Budget', `$${row.budget_usd}`],
    ],
  });
  return { ok: true, id: data.id };
}

export async function handleMicroOfferAction(req, res) {
  const body = req.body || {};
  const action = String(body.action || '');
  try {
    if (action === 'micro-offer-submit') {
      const out = await submit(getAdmin(), body);
      // 200 either way: the form reads { ok: false, errors } and shows each message next to its field.
      return res.status(200).json(out);
    }

    const auth = await verifyAdmin(req, { requireSuperAdmin: true });
    if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });
    const db = getAdmin();

    if (action === 'micro-offer-list') {
      const { data, error } = await db.from('micro_offer_requests').select('*').order('created_at', { ascending: false }).limit(300);
      if (error) throw fail(409, 'The requests table is not set up yet. Run supabase/phase50_micro_offers.sql in Supabase.');
      return res.status(200).json({ requests: data || [] });
    }

    if (action === 'micro-offer-decide') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'Missing request.');
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'declined' ? 'declined' : null;
      if (!decision) throw fail(400, 'Choose approve or decline.');
      const { data: r } = await db.from('micro_offer_requests').select('*').eq('id', id).maybeSingle();
      if (!r) throw fail(404, 'Request not found.');
      if (r.status !== 'pending') throw fail(409, `This request was already ${r.status}.`);
      const note = clean(body.note, 600) || null;
      const { error } = await db.from('micro_offer_requests')
        .update({ status: decision, decision_note: note, decided_at: new Date().toISOString(), decided_by: auth.caller.id }).eq('id', id);
      if (error) throw error;
      let emailed = true;
      const mail = microOfferDecisionEmail({ name: r.contact_name, companyName: r.company_name, budget: r.budget_usd, decision, note, appUrl: APP_URL });
      await sendViaResend({ to: r.email, ...mail }).catch((e) => { emailed = false; console.error('[micro-offer] decision email failed', e?.message); });
      return res.status(200).json({ ok: true, emailed });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[micro-offer]', action, e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.message || 'Request failed' });
  }
}
