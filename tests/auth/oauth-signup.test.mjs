import test from 'node:test';
import assert from 'node:assert/strict';
import { oauthBootstrapRole, OAUTH_STAKEHOLDER_ROLES } from '../../api/_oauthSignup.js';

const ok = { isSelf: true, provider: 'linkedin_oidc', emailConfirmed: true, targetRole: null };

test('LinkedIn gives the role of the registration door, decided on the server', () => {
  assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: 'client' }), 'client');
  assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: 'consultancy' }), 'consultancy');
  assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: 'referral' }), 'referral');
  assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: 'certification-body' }), 'certification_body');
});

test('auditors and contractors cannot register through LinkedIn alone', () => {
  assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: 'auditor' }), null);
  assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: 'contractor' }), null);
});

test('nobody can ask for an admin role', () => {
  for (const t of ['super_admin', 'regional_admin', 'admin', '__proto__', 'constructor', undefined, null, '']) {
    assert.equal(oauthBootstrapRole({ ...ok, stakeholderType: t }), null, String(t));
  }
  assert.ok(!Object.values(OAUTH_STAKEHOLDER_ROLES).some((r) => /admin/.test(r)));
});

test('Google and LinkedIn both work; nothing else does', () => {
  assert.equal(oauthBootstrapRole({ ...ok, provider: 'google', stakeholderType: 'client' }), 'client');
  assert.equal(oauthBootstrapRole({ ...ok, provider: 'email', stakeholderType: 'client' }), null);
});

test('only for yourself, from LinkedIn, with a confirmed email, and only while you have no role', () => {
  const base = { ...ok, stakeholderType: 'client' };
  assert.equal(oauthBootstrapRole({ ...base, isSelf: false }), null);
  assert.equal(oauthBootstrapRole({ ...base, provider: 'github' }), null);
  assert.equal(oauthBootstrapRole({ ...base, provider: 'email' }), null);
  assert.equal(oauthBootstrapRole({ ...base, emailConfirmed: false }), null);
  assert.equal(oauthBootstrapRole({ ...base, targetRole: 'client' }), null);
  assert.equal(oauthBootstrapRole({ ...base, targetRole: 'super_admin' }), null);
});
