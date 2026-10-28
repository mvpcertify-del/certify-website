// Contractor payment approval — phase44, 28 Oct.
//
// Two-step, by explicit client instruction: an admin raises a payment
// request (this IS the admin-approval step — an admin would not raise one
// for work that isn't approved), then a separate Finance-role user approves
// or rejects the actual money. The contractor CAN see a request while it's
// still 'pending_finance' (listContractorPayments in api/user.js scopes it
// to their own rows regardless of status — it's their own money, and the UI
// shows it as "Awaiting Finance"), but the amount counts toward their Credit
// total, and the contractor-facing decision email, only once Finance has
// actually approved it.
//
// Helper module, not a route — api/ is at the Vercel Hobby 12-function
// ceiling (see CLAUDE.md); the endpoints are `action` cases on api/user.js.
import { sendViaResend } from './_resendClient.js';
import { adminAlertEmail, contractorPaymentDecisionEmail } from './_emailTemplates.js';
import { APP_URL } from './_appUrl.js';

export class ContractorPaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validatePaymentInput({ amount, currency, description }) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new ContractorPaymentError('Amount must be a positive number.');
  }
  if (!['INR', 'USD'].includes(currency)) {
    throw new ContractorPaymentError('Currency must be INR or USD.');
  }
  const desc = String(description || '').trim().slice(0, 1000);
  if (!desc) throw new ContractorPaymentError('A description is required.');
  return { amount: amt, currency, description: desc };
}

// Finance isn't region-scoped (client's workflow treats it as one central
// function, unlike the per-region admin/contractor scoping elsewhere in this
// file) — every finance user is notified of every new request.
export async function notifyFinance(supabaseAdmin, { title, message, details = [] }) {
  const { data: financeUsers } = await supabaseAdmin
    .from('profiles').select('id, email, notifications_enabled').eq('role', 'finance');
  if (!financeUsers?.length) return;

  await supabaseAdmin
    .from('notifications')
    .insert(financeUsers.map((f) => ({ user_id: f.id, type: 'system', title, message })))
    .then(() => {}, (e) => console.error('notifyFinance: notification insert failed', e?.message));

  const { subject, html, text } = adminAlertEmail({
    title, message, details, actionUrl: `${APP_URL}/finance/payments`,
  });
  await Promise.all(financeUsers.map(async (f) => {
    if (!f.email || f.notifications_enabled === false) return;
    try {
      await sendViaResend({ to: f.email, subject, html, text });
    } catch (e) {
      console.error('notifyFinance: email failed', f.id, e?.message);
    }
  }));
}

// Emails the contractor once Finance has actually decided — see module note
// above for why nothing is sent at request-creation time.
export async function notifyContractorPaymentDecision(supabaseAdmin, payment, contractor) {
  if (!contractor?.email || contractor.notifications_enabled === false) return;
  try {
    const { subject, html, text } = contractorPaymentDecisionEmail({
      name: contractor.full_name || null,
      amount: payment.amount,
      currency: payment.currency,
      description: payment.description,
      status: payment.status,
      rejectionReason: payment.rejection_reason,
      dashboardUrl: `${APP_URL}/contractor/contract`,
    });
    await sendViaResend({ to: contractor.email, subject, html, text });
  } catch (e) {
    console.error('notifyContractorPaymentDecision: email failed', e?.message);
  }
}
