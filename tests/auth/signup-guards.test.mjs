import test from 'node:test';
import assert from 'node:assert/strict';
import { isDisposableEmail, DISPOSABLE_DOMAINS } from '../../api/_disposableEmail.js';

test('known throw-away providers are flagged, any letter case', () => {
  for (const e of ['a@mailinator.com', 'B@YopMail.com', 'x@10minutemail.com', 'x@guerrillamail.com']) {
    assert.equal(isDisposableEmail(e), true, e);
  }
});

test('subdomains of a throw-away provider are flagged', () => {
  assert.equal(isDisposableEmail('a@inbox.mailinator.com'), true);
});

test('normal and company addresses are not flagged', () => {
  for (const e of ['a@gmail.com', 'b@certify.cx', 'c@company.co.uk', 'd@mailinator.com.au.example.org']) {
    assert.equal(isDisposableEmail(e), false, e);
  }
});

test('bad input never throws and is not flagged', () => {
  for (const e of ['', null, undefined, 'no-at-sign', 'a@']) {
    assert.equal(isDisposableEmail(e), false, String(e));
  }
});

test('the list has no blank or uppercase entries', () => {
  for (const d of DISPOSABLE_DOMAINS) {
    assert.ok(d && d === d.toLowerCase() && d.includes('.'), d);
  }
});
