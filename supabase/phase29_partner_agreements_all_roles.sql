-- =====================================================================
-- phase29 — Partner agreements for all four partner roles
-- =====================================================================
--
-- Client task (2 Aug): each partner role signs its own legal agreement at
-- registration. The e-signature machinery already exists (phase23:
-- contract_templates + contract_acceptances + PDF + admin editing), scoped to
-- consultancy. This seeds the three MISSING agreements so the same machinery
-- serves all four roles:
--
--   partner_type      role that signs it
--   ----------------  ---------------------------------
--   referral          ROLES.REFERRAL
--   country_admin     ROLES.REGIONAL_ADMIN (shown as "Country Admin")
--   auditor           ROLES.AUDITOR
--   consultancy       ROLES.CONSULTANCY  (already seeded in phase23)
--
-- The text below is transcribed from the client's WCA GLOBAL agreements. As
-- with phase23, it has NOT been reviewed by a lawyer and an admin can rewrite
-- every word from the admin panel (which publishes a new version and never
-- rewrites an already-signed copy). Each INSERT is guarded so re-running does
-- not duplicate or overwrite.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Referral Partner Agreement (flat 10% commission)
-- ---------------------------------------------------------------------
INSERT INTO public.contract_templates (partner_type, version, title, body, term_months, is_active)
SELECT 'referral', 1, 'WCA GLOBAL Referral Partner Agreement',
$CONTRACT$WCA GLOBAL REFERRAL PARTNER AGREEMENT

Effective Date: Date of digital registration and checkbox acceptance. Platform Provider: Certify.cx Platform (the "Platform"). Parties: WCA GLOBAL (the "Company") and the registering individual or corporate entity (the "Referral Partner").

By checking the "I agree to the Terms & Conditions" box during registration, the Referral Partner explicitly agrees to be legally bound by this Agreement.

SECTION 1: SCOPE OF ROLE & INDEPENDENT STATUS

1.1 Purpose: The Referral Partner is granted a non-exclusive right to identify and introduce prospective corporate clients ("Leads") to the Company for general ISO Systems and Compliance Certifications, training, and consulting services via the Platform.

1.2 Independent Contractor: The Referral Partner operates strictly as an independent contractor. This Agreement does not create any employment, partnership, agency, or joint venture relationship. The Referral Partner is solely responsible for all personal and corporate income taxes or social levies due in their country of residence.

SECTION 2: LEAD SUBMISSION & VETTING RULES

2.1 Platform Tracking: To qualify for compensation, all Leads must be input directly into the Referral Partner's secure portal on the Platform. Leads submitted via text, email, or verbal communication will not be recognized.

2.2 Conflict Resolution: If a Lead is submitted by multiple Referral Partners, the Platform's timestamp will decide attribution. The partner who successfully logged the Lead first will receive the credit.

2.3 Validity Period: A submitted Lead remains active under the Referral Partner for a period of six (6) months from submission. If a sale does not materialize within this timeframe, the Lead expires and returns to the open market.

SECTION 3: FINANCIAL COMPENSATION & PAYOUT STRUCTURE

3.1 Standard 10% Commission: The Referral Partner shall receive a commission equal to 10% of the Net-Net Sales Amount for every successful corporate deal that closes and clears payment as a direct result of their submitted Lead for ISO Systems and Compliance Certifications.

3.2 Definition of Net-Net Sales Amount: Payout bases are calculated strictly on cash revenue collected, after deducting any corporate discounts or promotional markdowns, all applicable local taxes (e.g., VAT, sales tax, government levies), and any transaction fees, chargebacks, or refunds.

3.3 Successful Sale Definition: A transaction is logged as a "Successful Sale" only when the client's full invoice amount has been received, cleared, and settled without dispute into the Company's primary bank account. No commission is earned or payable on partial payments, open balances, or uncollected milestone installments.

3.4 Non-Fulfillment and Cancellation: If a project is cancelled, unfulfilled, or terminated by either the client or the Company before final issuance of the certification, no commissions shall apply.

3.5 Automated Clawbacks and Refund Adjustments: If a client is legally granted a refund, all assigned commissions are instantly invalidated. If payments have already been disbursed, the platform will execute an automated deduction (clawback) against the Referral Partner's pending or future wallet balances.

3.6 Payout Timeline: Commissions are processed within thirty (30) days following the end of the month in which the Company received cleared client funds. Disbursements are executed in US Dollars (USD) or the equivalent in local currency at the exchange rate at settlement.

SECTION 4: CONDUCT & ACCOUNT TERMINATION

4.1 Brand Integrity: The Referral Partner shall use only the official marketing materials provided in the Platform resource section. They may not alter logos, change pricing tables, or make unauthorized performance guarantees.

4.2 Termination: Either party may terminate this agreement at any time without cause by giving forty-eight (48) hours' written notice via the Platform or email. The Company may terminate the account instantly for fraud, data misrepresentation, or 90 days of complete portal inactivity.

SECTION 5: GOVERNING LAW & DISPUTE RESOLUTION

5.1 This Agreement is governed by Universal International Law and general principles of international commercial law (including the UNIDROIT Principles of International Commercial Contracts), and is not restricted to the national laws of any single country.

5.2 Any dispute shall first be addressed by amicable digital negotiation over thirty (30) business days. Failing that, it shall be finally resolved by binding international arbitration, conducted digitally, in English, before a single arbitrator, enforceable globally under the New York Convention.

ELECTRONIC ACCEPTANCE

By typing their full name and confirming below, the Referral Partner agrees to be bound by this Agreement. This electronic acceptance has the same effect as a handwritten signature; the date, time and network address of acceptance are recorded.$CONTRACT$,
       12, true
WHERE NOT EXISTS (SELECT 1 FROM public.contract_templates WHERE partner_type = 'referral');

-- ---------------------------------------------------------------------
-- 2. Country Admin Agreement (1% network override)
-- ---------------------------------------------------------------------
INSERT INTO public.contract_templates (partner_type, version, title, body, term_months, is_active)
SELECT 'country_admin', 1, 'WCA GLOBAL Country Admin Agreement',
$CONTRACT$WCA GLOBAL COUNTRY ADMIN AGREEMENT

Effective Date: Date of digital registration and checkbox acceptance. Platform Provider: Certify.cx Platform. Parties: WCA GLOBAL (the "Company") and the registering regional recruitment/management professional (the "Country Admin").

By checking the "I agree to the Terms & Conditions" box during registration, the Country Admin explicitly agrees to be legally bound by this Agreement.

SECTION 1: SCOPE OF APPOINTMENT & REGIONAL DUTIES

1.1 Territorial Mandate: The Country Admin is appointed on a non-exclusive basis to scale, manage, and monitor the Company's operational network within their designated territory, focusing on expanding the market footprint for ISO Systems and Compliance Certifications.

1.2 Network Onboarding Duties: The Country Admin shall actively source, interview, and register Referral Partners, Consultancy Partners, and Lead Auditors (qualified local technical professionals to execute client system audits).

1.3 Network Follow-Up: The Country Admin must log into the Platform weekly to audit user activity, check pending pipeline statuses, ensure Lead Auditors submit audit reports on time, and follow up with underperforming partners.

SECTION 2: INDEPENDENT CONTRACTOR STATUS

2.1 No Employment: The Country Admin is an independent contractor, not an employee, legal representative, or general agent of the Company, and has no authority to bind the Company to any unapproved debts or contracts.

2.2 Tax Indemnity: The Country Admin maintains full legal liability for local licensing, commercial registrations, and tax payments generated by their operational revenue.

SECTION 3: FINANCIAL COMPENSATION & THE 1% OVERRIDE

3.1 1% Network Override: The Country Admin shall receive a 1% commission override calculated on the Net-Net Sales Amount of all successful corporate deals finalized by any Referral Partner, Consultancy Partner, or Lead Auditor registered under their direct country network code.

3.2 Definition of Net-Net Sales Amount: Payout bases are calculated strictly on cash revenue collected, after deducting corporate discounts or markdowns, all applicable local taxes, and any transaction fees, chargebacks, or refunds.

3.3 Successful Sale Definition: A transaction counts only when the client's full invoice amount has been received, cleared, and settled without dispute into the Company's primary bank account. No override is payable on partial payments or open balances.

3.4 Non-Fulfillment and Cancellation: If a project is cancelled or terminated before final issuance of the certification, no overrides shall apply.

3.5 Automated Clawbacks: If a client is legally granted a refund, all assigned overrides are invalidated, and any already-disbursed amount is deducted from the Country Admin's pending or future wallet balances.

3.6 Currency & Settlements: All network overrides are calculated in US Dollars (USD) and paid out monthly via USD or equivalent local currency.

SECTION 4: NETWORK REALLOCATION & DEACTIVATION

4.1 Confidentiality: The Country Admin has access to contact records and pipeline files for multiple agents, auditors, and corporate clients, and must treat this data with strict confidentiality in compliance with regional data privacy laws.

4.2 Account Revocation: The Company may deactivate the Country Admin account instantly and reallocate their entire regional network to a new admin if the Country Admin violates compliance, fails weekly reporting, or has ninety (90) days of total network inactivity.

SECTION 5: GOVERNING LAW & DISPUTE RESOLUTION

5.1 This Agreement is governed by Universal International Law and general principles of international commercial law (including the UNIDROIT Principles), and is not restricted to the national laws of any single country.

5.2 Disputes are first addressed by amicable digital negotiation over thirty (30) business days, failing which they are finally resolved by binding international arbitration, conducted digitally, in English, before a single arbitrator, enforceable globally under the New York Convention.

ELECTRONIC ACCEPTANCE

By typing their full name and confirming below, the Country Admin agrees to be bound by this Agreement. This electronic acceptance has the same effect as a handwritten signature; the date, time and network address of acceptance are recorded.$CONTRACT$,
       12, true
WHERE NOT EXISTS (SELECT 1 FROM public.contract_templates WHERE partner_type = 'country_admin');

-- ---------------------------------------------------------------------
-- 3. Lead Auditor Service & Channel Agreement (5%/10% fee + 25% bonus)
-- ---------------------------------------------------------------------
INSERT INTO public.contract_templates (partner_type, version, title, body, term_months, is_active)
SELECT 'auditor', 1, 'WCA GLOBAL Lead Auditor Service & Channel Agreement',
$CONTRACT$WCA GLOBAL LEAD AUDITOR SERVICE & CHANNEL AGREEMENT

Effective Date: Date of digital registration and checkbox acceptance. Platform Provider: Certify.cx Platform. Parties: WCA GLOBAL (the "Company") and the registering certified compliance specialist (the "Lead Auditor").

By checking the "I agree to the Terms & Conditions" box during registration, the Lead Auditor explicitly agrees to be legally bound by this Agreement.

SECTION 1: PROFESSIONAL QUALIFICATIONS & ASSIGNMENT FLOW

1.1 Credentials: The Lead Auditor certifies that they hold active, valid, and recognized professional auditing credentials (such as IRCA certification) for the ISO frameworks (e.g., ISO 9001, 14001, 45001) they select in their profile.

1.2 Project Allocation: Project assignments are dispatched digitally by the Country Admin through the Platform. The Lead Auditor has forty-eight (48) hours to accept or decline an assignment before it is reassigned.

SECTION 2: ALL-INCLUSIVE SCOPE & EXPENSE POLICY

2.1 Lumpsum Service Fee: For assigned client projects, the Lead Auditor is compensated via a flat, project-based percentage of the project's Net-Net Sales Amount (excluding client discounts and local taxes): Remote Audits receive 5% of the full project value, and On-Site Audits receive 10% of the full project value.

2.2 Scope of Services: This flat percentage is fully comprehensive. It covers all preliminary document reviews, the live audit execution, and the final generation and submission of the official Audit Report via the Platform.

2.3 No Expense Claims: The on-site flat fee includes all travel. Any operational, logistical, or personal expenses incurred during an audit — transportation, flights, fuel, accommodation, meals, or incidentals — are borne entirely by the Lead Auditor. The Company will not accept expense claims.

SECTION 3: DUAL-ROLE COMMERCIAL OPPORTUNITY (THE 25% BONUS)

3.1 Auditor-Originated Sales: If the Lead Auditor introduces a new corporate client directly to the Company and logs them on the Platform, they act as the originating sales channel.

3.2 25% Commission: If that client sale materializes, the Lead Auditor receives a premium 25% commission on the final Net-Net Sales Amount (exclusive of taxes and discounts). This bonus is paid separately from, and in addition to, the 5% or 10% project service fee.

3.3 Definition of Net-Net Sales Amount: Payout bases are calculated on cash revenue collected, after deducting discounts, applicable local taxes, and any transaction fees, chargebacks, or refunds.

3.4 Successful Sale Definition: A transaction counts only when the client's full invoice amount has been received, cleared, and settled without dispute. No fee or commission is payable on partial payments or open balances.

3.5 Non-Fulfillment and Cancellation: If a project is cancelled or terminated before final issuance of the certification, no fees or commissions shall apply.

3.6 Automated Clawbacks: If a client is legally granted a refund, all assigned fees and commissions are invalidated, and any already-disbursed amount is deducted from the Lead Auditor's pending or future wallet balances.

SECTION 4: DATA ENTRY, INDEPENDENT STATUS & TERMINATION

4.1 Data and Report Entry: All audit notes, checklists, and final report drafts must be submitted through the secure fields inside the Platform. Payouts are held until the compliance report passes the Country Admin's quality check.

4.2 Contractor Status: The Lead Auditor acts strictly as an independent technical professional, responsible for their own professional liability insurance and local income taxes.

4.3 Termination: Either party may terminate this agreement with fourteen (14) days' written notice, provided any ongoing audit assignments are fully completed, submitted, and approved before account deactivation.

SECTION 5: GOVERNING LAW & DISPUTE RESOLUTION

5.1 This Agreement is governed by Universal International Law and general principles of international commercial law (including the UNIDROIT Principles), and is not restricted to the national laws of any single country.

5.2 Disputes are first addressed by amicable digital negotiation over thirty (30) business days, failing which they are finally resolved by binding international arbitration, conducted digitally, in English, before a single arbitrator, enforceable globally under the New York Convention.

ELECTRONIC ACCEPTANCE

By typing their full name and confirming below, the Lead Auditor agrees to be bound by this Agreement. This electronic acceptance has the same effect as a handwritten signature; the date, time and network address of acceptance are recorded.$CONTRACT$,
       12, true
WHERE NOT EXISTS (SELECT 1 FROM public.contract_templates WHERE partner_type = 'auditor');

-- =====================================================================
-- Verification
-- =====================================================================
-- SELECT partner_type, version, title, is_active
--   FROM public.contract_templates ORDER BY partner_type;
-- Expect one active row each for: auditor, consultancy, country_admin, referral.
