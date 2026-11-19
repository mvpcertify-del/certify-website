import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, OFFER } from '../../api/_microOffer.js';
import { microOfferReceivedEmail, microOfferDecisionEmail } from '../../api/_emailTemplates.js';

const GOOD = {
  budget_usd: 900, company_name: 'Nile Bakery', website: 'nilebakery.com', contact_name: 'Hana Ali', job_title: 'Owner',
  phone: '+20 100 123 4567', email: 'Hana@NileBakery.com', main_activity: 'Bakery and catering', employees: 6, one_location: true,
};
const NOW = new Date('2026-11-20T10:00:00Z');

test('a complete request is accepted and normalised', () => {
  const r = validateRequest(GOOD, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.row.email, 'hana@nilebakery.com');
  assert.equal(r.row.website, 'https://nilebakery.com');
  assert.equal(r.row.standard, 'ISO 9001');
  assert.equal(r.row.budget_usd, 900);
});

test('the budget must be inside the offer range', () => {
  assert.ok(validateRequest({ ...GOOD, budget_usd: 499 }, NOW).errors.budget_usd);
  assert.ok(validateRequest({ ...GOOD, budget_usd: 1501 }, NOW).errors.budget_usd);
  assert.ok(validateRequest({ ...GOOD, budget_usd: 'abc' }, NOW).errors.budget_usd);
  assert.equal(validateRequest({ ...GOOD, budget_usd: OFFER.min }, NOW).ok, true);
  assert.equal(validateRequest({ ...GOOD, budget_usd: OFFER.max }, NOW).ok, true);
});

test('only companies with 1 to 9 employees and 1 location qualify', () => {
  assert.ok(validateRequest({ ...GOOD, employees: 0 }, NOW).errors.employees);
  assert.ok(validateRequest({ ...GOOD, employees: 10 }, NOW).errors.employees);
  assert.ok(validateRequest({ ...GOOD, one_location: false }, NOW).errors.one_location);
  assert.ok(validateRequest({ ...GOOD, one_location: undefined }, NOW).errors.one_location);
});

test('contact details are required', () => {
  const e = validateRequest({ ...GOOD, email: 'nope', phone: '12', contact_name: '', job_title: '', company_name: '', main_activity: '' }, NOW).errors;
  for (const k of ['email', 'phone', 'contact_name', 'job_title', 'company_name', 'main_activity']) assert.ok(e[k], k);
});

test('the website is optional but must look like a website', () => {
  assert.equal(validateRequest({ ...GOOD, website: '' }, NOW).ok, true);
  assert.ok(validateRequest({ ...GOOD, website: 'not a site' }, NOW).errors.website);
});

test('the offer ends after 31 December 2026', () => {
  assert.equal(validateRequest(GOOD, new Date('2026-12-31T12:00:00Z')).ok, true);
  assert.ok(validateRequest(GOOD, new Date('2027-01-01T00:30:00Z')).errors.offer);
});

test('line breaks in a field cannot break out of it', () => {
  const r = validateRequest({ ...GOOD, company_name: 'Nile\nBakery' }, NOW);
  assert.equal(r.row.company_name, 'Nile Bakery');
});

test('emails: received, approved and declined', () => {
  const got = microOfferReceivedEmail({ name: 'Hana', companyName: 'Nile <b>Bakery</b>', budget: 900, hours: 3 });
  assert.match(got.html, /within 3 hours/);
  assert.ok(!got.html.includes('<b>Bakery</b>'), 'company name is escaped');
  const yes = microOfferDecisionEmail({ name: 'Hana', companyName: 'Nile Bakery', budget: 900, decision: 'approved', note: 'Welcome' });
  assert.match(yes.subject, /approved/);
  assert.match(yes.html, /certificate valid for one year/);
  const no = microOfferDecisionEmail({ name: 'Hana', companyName: 'Nile Bakery', budget: 900, decision: 'declined' });
  assert.match(no.html, /not able to approve/);
});
