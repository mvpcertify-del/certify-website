// Provider-agnostic WhatsApp sender — the seam that lets the app push WhatsApp
// notifications once the client signs up for a WhatsApp Business provider.
//
// It is intentionally SAFE TO SHIP UNCONFIGURED: with no credentials in the
// environment, every call is a no-op that returns { ok:false, skipped:... }
// and never throws, so notification paths (signup, payments, deactivation…)
// keep working on email + in-app alone. The moment the three env vars below are
// set in Vercel, WhatsApp messages start flowing — no code change needed.
//
// Env vars (set in Vercel when the provider is ready):
//   WHATSAPP_API_URL    full send endpoint, e.g. Meta Cloud API
//                       https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages
//   WHATSAPP_API_TOKEN  bearer token / access token
//   WHATSAPP_FROM       (optional) sender id, only needed by some providers
//
// The request body below matches the Meta WhatsApp Cloud API (the most common
// "WhatsApp Business API"). If the client picks a different provider (e.g.
// Twilio), only the fetch body/headers here need adjusting — callers don't change.

const WA_API_URL = process.env.WHATSAPP_API_URL;
const WA_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WA_FROM = process.env.WHATSAPP_FROM;

export function whatsAppConfigured() {
  return !!(WA_API_URL && WA_API_TOKEN);
}

// Normalise to digits-only (provider APIs want the number without "+", spaces,
// or dashes). Returns null if there aren't enough digits to be a real number.
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits.length >= 8 ? digits : null;
}

// Send one WhatsApp text message. Best-effort: never throws.
export async function sendWhatsApp({ to, text }) {
  const phone = normalisePhone(to);
  if (!phone) return { ok: false, skipped: 'no-recipient' };
  if (!whatsAppConfigured()) return { ok: false, skipped: 'not-configured' };

  try {
    const resp = await fetch(WA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        ...(WA_FROM ? { from: WA_FROM } : {}),
        to: phone,
        type: 'text',
        text: { body: text },
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('sendWhatsApp failed', resp.status, detail);
      return { ok: false, error: `WhatsApp ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error('sendWhatsApp error', err?.message);
    return { ok: false, error: err?.message };
  }
}
