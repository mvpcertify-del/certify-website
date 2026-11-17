import test from 'node:test';
import assert from 'node:assert/strict';
import { loginOtpEmail, magicLinkEmail } from '../../api/_emailTemplates.js';
import { pickTemplate } from '../../api/auth-email-hook.js';
import {
  LOGIN_OTP_ENABLED, OTP_LENGTH, OTP_RESEND_SECONDS, classifyOtpRequestError,
  isValidOtp, normalizeOtp, randomPassword,
} from '../../src/config/loginMode.js';

// ---------------------------------------------------------------------------
// The sign-in code email
// ---------------------------------------------------------------------------
test('the code email shows the code in the subject and the body', () => {
  const m = loginOtpEmail({ name: 'Bea', code: '482913' });
  assert.match(m.subject, /482913/);
  assert.match(m.html, /482913/);
  assert.match(m.text, /482913/);
  assert.match(m.html, /10 minutes/);
});

test('the code email carries no sign-in link: the code is the only way in', () => {
  const m = loginOtpEmail({ name: 'Bea', code: '482913' });
  assert.ok(!/href="https?:\/\/[^"]*(verify|token|magic)/i.test(m.html));
  assert.ok(!/https?:\/\/\S*(verify|token_hash)/i.test(m.text));
});

test('the code email refuses anything that is not a short numeric code', () => {
  for (const bad of ['', 'abc123', '12 34', '<script>', '12', '123456789012', undefined, null]) {
    assert.throws(() => loginOtpEmail({ name: 'x', code: bad }), /digits/, `value ${bad}`);
  }
});

test('the recipient name is HTML-escaped', () => {
  const m = loginOtpEmail({ name: '<img src=x onerror=1>', code: '123456' });
  assert.ok(!m.html.includes('<img src=x'));
  assert.ok(m.html.includes('&lt;img'));
});

// ---------------------------------------------------------------------------
// The Supabase email hook picks the right template
// ---------------------------------------------------------------------------
test('a magiclink email WITH a token is sent as a code', () => {
  const m = pickTemplate('magiclink', { name: 'Bea', url: 'https://x/verify', code: '654321' });
  assert.match(m.subject, /654321/);
  assert.ok(!m.html.includes('https://x/verify'));
});

test('a magiclink email WITHOUT a token still sends the old link', () => {
  const m = pickTemplate('magiclink', { name: 'Bea', url: 'https://x/verify' });
  assert.equal(m.subject, magicLinkEmail({ name: 'Bea', link: 'https://x/verify' }).subject);
  assert.ok(m.html.includes('https://x/verify'));
});

test('other email types are unchanged', () => {
  assert.match(pickTemplate('recovery', { name: 'B', url: 'https://x/r', code: '111111' }).subject, /Reset/i);
  // A confirmation link still goes out when Supabase supplies no code.
  assert.match(pickTemplate('signup', { name: 'B', url: 'https://x/s' }).html, /https:\/\/x\/s/);
});

// ---------------------------------------------------------------------------
// The login page rules
// ---------------------------------------------------------------------------
test('code login is OFF unless the build switch is the string "true"', () => {
  assert.equal(LOGIN_OTP_ENABLED, false); // no switch in the test environment
});

test('a code is exactly six digits; copy-pasted spaces are ignored', () => {
  assert.equal(OTP_LENGTH, 6);
  assert.equal(normalizeOtp(' 123 456 '), '123456');
  assert.equal(isValidOtp('123456'), true);
  assert.equal(isValidOtp('123 456'), true);
  assert.equal(isValidOtp('83352474'), true);
  for (const bad of ['12345', '123456789', 'abcdef', '12345a', '', null, undefined]) {
    assert.equal(isValidOtp(bad), false, `value ${bad}`);
  }
});

test('the resend wait is one minute', () => {
  assert.equal(OTP_RESEND_SECONDS, 60);
});

test('a failed code request is classified so the page never reveals who has an account', () => {
  assert.equal(classifyOtpRequestError(null), 'ok');
  assert.equal(classifyOtpRequestError({ status: 429, message: 'x' }), 'rate_limited');
  assert.equal(classifyOtpRequestError({ message: 'For security purposes, you can only request this after 52 seconds.' }), 'rate_limited');
  assert.equal(classifyOtpRequestError({ message: 'Signups not allowed for otp' }), 'unknown_account');
  assert.equal(classifyOtpRequestError({ message: 'User not found' }), 'unknown_account');
  assert.equal(classifyOtpRequestError({ message: 'SMTP exploded' }), 'failed');
});

test('the throw-away signup password is random, long and never repeats', () => {
  const seen = new Set(Array.from({ length: 50 }, () => randomPassword()));
  assert.equal(seen.size, 50);
  for (const p of seen) {
    assert.ok(p.length >= 32);
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /\d/);
  }
});

test('the code email has no buttons: the code is typed into the sign-in page', () => {
  const m = loginOtpEmail({ name: 'Bea', code: '482913' });
  assert.ok(!/Copy code|Sign in with this code/i.test(m.html));
  assert.ok(!/class="ccx-btn"/.test(m.html));
  assert.match(m.html, /482913/);
});

test('code sign-up: a new address gets a verification code, worded for registration', () => {
  const m = pickTemplate('signup', { name: 'Bea', url: 'https://x/s', code: '246810' });
  assert.match(m.subject, /246810 is your .* verification code/);
  assert.match(m.html, /registration page/);
  assert.ok(!m.html.includes('https://x/s'));
});

test('the sign-in code email keeps its sign-in wording', () => {
  const m = loginOtpEmail({ name: 'Bea', code: '246810' });
  assert.match(m.subject, /sign-in code/);
  assert.match(m.html, /sign-in page/);
});

// ---------------------------------------------------------------------------
// The confirmation / password-reset link
// ---------------------------------------------------------------------------
import { buildVerifyUrl } from '../../api/auth-email-hook.js';

test('the reset link points at /auth/v1/verify once, whichever way site_url arrives', () => {
  const data = { token_hash: 'abc', email_action_type: 'recovery', redirect_to: 'https://certify.cx/reset-password' };
  const want = 'https://proj.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https%3A%2F%2Fcertify.cx%2Freset-password';
  assert.equal(buildVerifyUrl({ ...data, site_url: 'https://proj.supabase.co/auth/v1' }), want); // what Supabase really sends
  assert.equal(buildVerifyUrl({ ...data, site_url: 'https://proj.supabase.co/auth/v1/' }), want);
  assert.equal(buildVerifyUrl({ ...data, site_url: 'https://proj.supabase.co' }), want);
});

// ---------------------------------------------------------------------------
// Reading the signed request body
// ---------------------------------------------------------------------------
import { EventEmitter } from 'node:events';
import { readRawBody } from '../../api/auth-email-hook.js';

function fakeRequest(buffers) {
  const req = new EventEmitter();
  setImmediate(() => { buffers.forEach((b) => req.emit('data', b)); req.emit('end'); });
  return req;
}

test('the signed body comes back byte for byte even when a character is split across chunks', async () => {
  const body = JSON.stringify({ user: { user_metadata: { name: 'ميدهات أبو غزالة', company: 'Certify.cx™ — café' } } });
  const bytes = Buffer.from(body, 'utf8');
  // cut in the middle of a multi-byte character
  const cut = bytes.indexOf(Buffer.from('™')) + 1;
  assert.notEqual(cut, 0);
  const got = await readRawBody(fakeRequest([bytes.subarray(0, cut), bytes.subarray(cut)]));
  assert.equal(got, body);
  assert.ok(!got.includes('\uFFFD'));
});

test('an ordinary single-chunk body is unchanged', async () => {
  const body = '{"a":"b"}';
  assert.equal(await readRawBody(fakeRequest([Buffer.from(body)])), body);
});

test('the body is read from the stream without touching req.body, and keeps Go-style escapes like \u0026', async () => {
  // What Supabase (Go) sends for a company called "A & B": the ampersand is written as \u0026.
  const body = '{"user":{"user_metadata":{"company":"A \u0026 B <x>"}}}';
  const req = fakeRequest([Buffer.from(body)]);
  let touched = false;
  Object.defineProperty(req, 'body', { get() { touched = true; return JSON.parse(body); } });
  const got = await readRawBody(req);
  assert.equal(touched, false, 'req.body must not be read first: Vercel parses (and consumes) the stream on that access');
  assert.equal(got, body);
  assert.notEqual(JSON.stringify(JSON.parse(body)), body, 'this is the case that re-stringifying gets wrong');
});
