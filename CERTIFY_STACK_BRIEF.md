# Certify.cx — technical brief

Prepared 9 August 2026, in answer to the "What I need from the programmer" list in
*ISO 22000 Audit Automation Implementation*. Everything below is safe to share: it
contains no keys, no secrets and no customer data.

---

## 0. Please read this first — the stack is not Next.js

The plan opens with *"Since Certify.cx is Next.js…"* and asks for an `app/` or
`pages/` directory. **Certify.cx is not a Next.js application and has no `app/`
or `pages/` directory.** Code written on that assumption — App Router layouts,
server components, `getServerSideProps`, `app/api/**/route.ts`, NextAuth — will
not drop into this codebase.

What it actually is:

| | |
|---|---|
| Frontend | **React 19** single-page app built with **Vite 8** (plain JavaScript + JSX, no TypeScript) |
| Routing | **react-router-dom 7**, client-side, routes declared in `src/App.jsx` |
| Backend | **Vercel serverless functions** in `/api/*.js` — plain handlers, `export default async function handler(req, res)`. Not Next.js route handlers. |
| Database + Auth + Storage | **Supabase** (PostgreSQL with Row Level Security) |
| Payments | **Stripe** Checkout Sessions |
| Email | **Resend** |
| i18n | **i18next / react-i18next**, 9 locales (en, es, ar, de, fr, hi, pt, ru, zh); Arabic is RTL |
| AI | `@google/generative-ai` (the "Sara" assistant) |
| Styling | Plain CSS files colocated with components. **No Tailwind.** |

Two hard constraints any proposal has to respect:

1. **The API is capped at 12 route files.** The project runs on the Vercel Hobby
   plan, which allows 12 serverless functions, and `/api` is at exactly 12. New
   capability is added as a new **action inside an existing route file**
   (`if (req.body.action === '…') return handler(req, res)`), not as a new file.
   Files starting with `_` are shared modules, not routes, and don't count.
2. **Multi-tenancy is enforced in the database.** Supabase RLS policies plus a
   region-scoping rule in the app: every non-super-admin is limited to their own
   `region`. Any new table needs its RLS policies designed at the same time as
   its columns.

---

## 1. package.json

```json
{
  "name": "certifycx",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "node seed.js && vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "@supabase/supabase-js": "^2.99.1",
    "dotenv": "^17.3.1",
    "i18next": "^26.0.4",
    "i18next-browser-languagedetector": "^8.2.1",
    "lucide-react": "^0.577.0",
    "pdf-lib": "^1.17.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-i18next": "^17.0.2",
    "react-router-dom": "^7.13.1",
    "standardwebhooks": "^1.0.0",
    "stripe": "^21.0.1",
    "tslib": "^2.8.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "vite": "^8.0.0"
  }
}
```

There is no test runner configured.

---

## 2. Directory layout

```
api/                     serverless functions (12 routes + shared _modules)
src/
  App.jsx                every route + its role guard
  components/
    ui/                  Button, Input, Select, Modal, DataTable, StatusBadge,
                         RowActions, DetailModal, StatCard …
    layout/              DashboardLayout, Sidebar, TopBar, AuthLayout
    admin/               ProfileManagementTable (shared admin CRUD table)
    pricing/, sara/      pricing cards, AI assistant widget
  contexts/AuthContext.jsx     the single source of truth for the current user
  pages/
    landing/ public/ iso/ register/ legal/    public marketing + checkout
    auth/                                     login, signup, reset, OAuth callback
    dashboard/    Dashboard.jsx (role-aware), MainDashboard.jsx
    client/       ApplicationForm, GapAnalysis, MyCertificates,
                  PaymentPlaceholder (checkout), StartPayment
    admin/        27 admin screens (see §5)
    auditors/ bodies/ companies/ certifications/ referrals/ partner/
    notifications/ reports/ settings/
  utils/          roles.js (RBAC), pricing.js, isoCatalog.js, isoStandards.js,
                  foodChainCategories.js, auditorOptions.js
  i18n/locales/   en, es, ar, de, fr, hi, pt, ru, zh
  lib/            supabase.js (anon client), apiClient.js (adds the Bearer token)
  config/         paymentMethods.js
supabase/         schema.sql + phase1…phase30 migrations
```

---

## 3. Authentication and authorisation

**Sessions.** Supabase Auth (email + password, and Google OAuth).
`src/contexts/AuthContext.jsx` loads the session, fetches the user's `profiles`
row and merges it onto the user object, so `user.role`, `user.region`,
`user.approval_status`, `user.company_name` are read straight off `user` via
`useAuth()`. Components must not re-query Supabase for the current user.

**Roles** — `src/utils/roles.js`:

```
super_admin · regional_admin · auditor · certification_body · client
```

plus `stakeholder_type` sub-kinds on the client role (client, consultancy,
investor, referral partner). The same file holds `PERMISSIONS`,
`ROLE_PERMISSIONS`, `hasPermission()`, `canAccessRegion()`, `getCreatableRoles()`
and the country → region map.

**Route guards** — `src/App.jsx`:

```jsx
<Route path="/admin/applications" element={
  <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN]}>
    <AdminApplications />
  </ProtectedRoute>
} />
```

**Server-side.** The browser only ever holds the Supabase **anon** key. Anything
needing the service role (creating/deleting users, cross-account reads, Stripe,
email) goes through `/api/*`, which verifies the caller's JWT with
`api/_verifyAdmin.js` (`verifySession`, `verifyAdmin`, `callerCanManageTarget`).
The caller's identity always comes from the verified token, never from the
request body.

---

## 4. API routes (all 12)

| File | What it does | Actions (`req.body.action`) |
|---|---|---|
| `api/user.js` | profile + role + contracts + auditor qualifications | `update-profile`, `update-role`, `set-active`, `save-permission-override`, `get-contract`, `accept-contract`, `get-contract-template`, `save-contract-template`, `consultancy-kpi`, `add-auditor-document`, `save-auditor-qualifications`, `get-meta` (GET) |
| `api/create-user.js` | account creation for every role + signup | — |
| `api/delete-user.js` | delete an account | — |
| `api/checkout.js` | Stripe + coupons + offline payments + billing docs | `guest-checkout`, `validate-coupon`, `confirm-guest-payment`, `verify-offline-payment`, `set-payment-status`, `approve-client-access`, `book-consultation`, `issue-invoice`, `issue-receipt`, `list-billing-documents`, plus the default logged-in checkout |
| `api/referrals.js` | partner programme, commissions, invites | `list`, `partner-list`, `record`, `check-discount`, `mark-payout`, `send-client-invite`, `save-signature` |
| `api/issue-certificate.js` | generates the certificate PDF (pdf-lib) and emails it | — |
| `api/notify-event.js` | lifecycle emails + the daily renewal-reminder cron | — |
| `api/approve-registration.js` | admin approval of a pending registration | — |
| `api/auth-email-hook.js` | Supabase Send Email Hook receiver (signed) | — |
| `api/send-welcome.js` | welcome email, called by a Postgres trigger | — |
| `api/resend-verification.js` | re-sends a verification link | — |
| `api/ai-chat.js` | the Sara assistant (Google Generative AI) | — |

Shared, non-route modules: `_verifyAdmin.js`, `_emailTemplates.js`,
`_notifyAdmins.js`, `_notifyWhatsApp.js`, `_resendClient.js`,
`_sendVerificationEmail.js`, `_billing.js`, `_contract.js`, `_brandAsset.js`,
`_appUrl.js`.

---

## 5. Database

Canonical schema: `supabase/schema.sql`. Incremental migrations:
`supabase/phase1_migration.sql` … `supabase/phase30_core_legal_signatures.sql`
(idempotent, `create … if not exists` style). Tables in active use:

**Core** — `profiles`, `applications`, `documents`, `certificates`,
`notifications`, `reports`, `countries`

**Certification bodies / accreditation** — `certification_bodies`,
`accreditation_bodies`, `cb_documents`, `cb_iso_standards`, `cb_iaf_codes`,
`cb_countries`, `cb_accreditation_bodies`, `cb_standard_pricing`

**Commerce** — `payments`, `invoices`, `payment_receipts`, `discount_coupons`,
`coupon_redemptions`

**Partner programme** — `referrals`, `referral_invites`,
`referral_commission_tiers`, `contract_templates`, `contract_acceptances`

**Configuration** — `custom_user_fields`, `custom_application_fields`,
`custom_permissions`, `iso_link_settings`, `sara_leads`

`applications` is the spine of the product: `client_id`, `status`,
`recommended_iso`, `selected_package`, `payment_status`, `payment_method`,
`total_amount`, `assigned_auditor_id`, `assigned_cb_id`, `company_name`,
`industry`, `scope`, `employee_count`, `locations_count`.

**Certification lifecycle** (`CERTIFICATION_STATUSES` in `src/utils/roles.js`):

```
awaiting_registration  →  pending  →  audit_scheduled  →  in_review  →  approved | rejected
   (paid, not yet          (submitted)                                  (certificate issued)
    registered)
```

(`awaiting_registration` is the pre-registration stub created at payment time;
`CERTIFICATION_STATUS_ORDER` in `src/utils/roles.js` covers the five states after
it.)

Product rule worth knowing before designing anything client-facing: a client must
not see their assigned Certification Body's identifying details until payment is
complete.

---

## 6. Client dashboard components

`src/pages/dashboard/Dashboard.jsx` renders a different dashboard per role from
one file. The client view contains: the gap-analysis score card and certification
picker, the application status stepper (Submitted → Under Review → Audit
Scheduled → Certified), a required-documents list with upload/delete, the payment
card, and the assigned auditor / CB cards.

Supporting client screens: `ApplicationForm.jsx` (company registration),
`GapAnalysis.jsx` (the readiness questionnaire), `PaymentPlaceholder.jsx` (the
checkout page: coupons, org-size surcharges, card / PayPal / bank / cash),
`MyCertificates.jsx`.

Shared UI worth reusing rather than reinventing: `components/ui/DataTable.jsx`,
`Modal.jsx`, `DetailModal.jsx`, `RowActions.jsx`, `StatusBadge.jsx`,
`StatCard.jsx`, `FormElements.jsx` (Input, Select, Textarea, Button,
Autocomplete), and `components/admin/ProfileManagementTable.jsx`.

Every user-facing string goes through `t('…')` and must be added to all nine
locale files.

---

## 7. Environment variables (names only — no values)

```
VITE_SUPABASE_URL              client-side Supabase
VITE_SUPABASE_ANON_KEY         client-side Supabase
SUPABASE_SERVICE_ROLE_KEY      server only — never imported from src/
VITE_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
VITE_GEOAPIFY_API_KEY          country / address autocomplete
RESEND_API_KEY
RESEND_FROM_EMAIL
SUPABASE_AUTH_HOOK_SECRET      signs the Supabase Send Email Hook
INTERNAL_WEBHOOK_SECRET        shared secret for the welcome-email trigger
APP_PUBLIC_URL                 public site URL
APP_URL                        optional override for links inside email
CRON_SECRET                    daily renewal-reminder cron
```

**Never send the `.env` file itself, and never send `SUPABASE_SERVICE_ROLE_KEY`
or `STRIPE_SECRET_KEY` to anyone — including an AI assistant.** The names above
are all that is needed to write code against them.

---

## 8. If you want to hand over source code as well

The safest package is the repository *without* secrets:

- the whole tree **except** `.env`, `node_modules/`, `dist/`
- `.env.example` (names only — already free of values)

`.env` is git-ignored, so a clone or a ZIP of the tracked files never contains a
secret. If a ZIP is made by hand from the working folder, delete `.env` from it
first.
