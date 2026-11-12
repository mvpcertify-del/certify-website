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
  assert.match(pickTemplate('signup', { name: 'B', url: 'https://x/s', code: '111111' }).html, /https:\/\/x\/s/);
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
  for (const bad of ['12345', '1234567', 'abcdef', '12345a', '', null, undefined]) {
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
