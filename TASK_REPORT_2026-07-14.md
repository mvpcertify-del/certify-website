# Task Report — 14 July 2026

**Headline:** while working through the client's new list we found that **checkout has been completely broken in production** — every buyer, on every payment method, gets an error and no order is recorded. Root cause found and a fix is ready, but it needs one database migration to be run.

---

## 🔴 URGENT — Checkout is broken for all buyers

**What the client reported:** testing with `support.certify@gmail.com`, choosing Bank Transfer produced *"Could not record your order. Please try again."*

**What we found:** this is **not** a Bank Transfer problem. It affects **card, cash and bank transfer equally** — no one has been able to place an order.

**Root cause:** two database updates from earlier phases (the pricing-surcharge and payment-method updates) were **never applied to the live database**. Five columns the order code writes to simply don't exist there, so every order is rejected by the database.

We verified this directly against the live database rather than guessing — those five columns return "does not exist", while every other column resolves fine.

**We also found two further faults** that would have broken checkout *again* right after the first fix:
- **Cash payments** were not in the database's allowed-methods list — every cash order would have failed.
- The **"paid" status** written after a successful card payment was not in the allowed-status list — card buyers would have been charged and then silently left marked unpaid.

Both are corrected in the same migration.

**➡️ Action needed:** run `supabase/phase17_checkout_repair_and_country.sql` in the Supabase SQL Editor. Checkout stays broken until this is run. It is safe to re-run and ends with a check that prints the six columns it created.

---

## Batch 1 — ISO certification page slimmed down

The client crossed out most of the `/iso/...` page.

| Request | Status |
|---|---|
| Remove the top section (badge, title, "Your direct path to…", description, Apply button) | ✅ Removed |
| Remove the "What you get" 4-point block | ✅ Removed |
| Remove the "Flexible payment — full payment or 12-month plan" bar | ✅ Removed (this was the last surviving mention of the 12-month plan) |
| Remove the bottom "Ready to get started? / Apply / Already have an account? Sign In" block | ✅ Removed — buyers register on the checkout page, as the client said |

**One judgement call we'd like confirmed.** With the top section gone, nothing on the page named the standard any more — `/iso/iso-9001` and `/iso/iso-27001` would have looked identical, and a shared link would give no clue what it was selling. So the standard's code (e.g. **ISO 14001**) now appears as a small label above the price instead. If the client wants even that gone, it's a one-line change.

---

## Batch 2 — Pricing

- ✅ **ISO 9001 / 14001 / 45001 reset to $999.** Every standard is now the same single price — there is no cheaper band left.
- ✅ **Staff coverage raised to 50 employees.** The package now covers an organisation of **up to 50 employees at 1 location** (was 10). Updated in the pricing engine and in all nine languages.

---

## Batch 3 — New brand identity (single colour)

The client supplied the new logo and asked for **one colour only, no multi-colours**, applied across the whole platform.

**What we found:** the old lockup was hand-copied into **12 different places** in two different versions, with four different icon treatments (two gradients, a green glow, a flat tint) and a wordmark that deliberately painted "**C**" and "**.cx**" green while "ertify" stayed white — i.e. three colours.

**What was done:**
- ✅ The client's new mark replaces the old shield everywhere.
- ✅ One shared brand component now renders the logo on **all 12 places**, so it can never drift again.
- ✅ **Single colour, automatic:** white on dark backgrounds, black on light backgrounds. All gradients, glows and the green letters are gone.
- ✅ **™ in grey** (the client's second demo) is the default.

**Two things to confirm:**
1. **The two demos** the client asked to compare — *all-white* vs *all-white-with-grey-™* — are both built. Grey ™ is currently live. Switching to the all-white version is a one-word change; say which one and we'll set it.
2. **We need the logo as a vector (SVG/AI/EPS).** We only have a PNG, which is fine on screen but will look soft in print and on large displays. The emails also still carry the old brand and will be updated once the vector arrives.

---

## Batch 4 — Back button on every page

- ✅ A shared **Back** control now appears on **every page**: all dashboard pages, all sign-in pages, and every public page (ISO pages, certifications list, gap analysis, checkout, registration).
- It's suppressed only where going back is meaningless (the dashboard home) or would be harmful (the sign-up wizard already has its own step-back).
- Deep links are handled: opening a shared link directly still gives a working Back (it goes home rather than doing nothing).

---

## Batch 5 — Missing navigation bar

**Client asked:** why is there no nav bar on the ISO pages?

**Because it never existed there** — the nav bar was written directly into the home page only, so every other public page had nothing but a logo.

- ✅ The nav bar is now a **shared component** and appears on the ISO pages, certifications list, gap analysis and registration pages — with the section links, language switcher, Log In / Sign Up (or the account menu when signed in) and Free Gap Analysis, plus the mobile menu.
- The links to *How It Works / Standards / Benefits* now correctly jump back to the home page from other pages.
- **Deliberate exception: the checkout page.** It keeps its minimal header (logo + language + Back). Adding a full nav to a payment page is a well-known way to lose sales — it invites buyers to wander off mid-payment. Happy to add it if the client prefers.

---

## Batch 6 — Bank transfer details popup ✅

- When the buyer selects **Bank Transfer** (or **Cash**) at checkout, a **popup now opens immediately** with the account/collection details and copy buttons — matching the client's "a popup could appear with bank details" request. It can be reopened via a "view details" link, and the same details still appear on the order-confirmation screen.
- ⚠️ The details shown are still the **placeholder** IBAN/beneficiary (`XXXX`) — the popup is built and working; it will show the real details the moment the client provides them.

## Batch 7 — Client activated only after Super Admin approval ✅

The client asked that a client account be activated in the dashboard **only after Super Admin approval**.
- **Before:** a card payer got **instant dashboard access** the moment payment cleared — no review.
- **Now:** after a card payment, the account is marked **paid but pending**; the buyer sees "payment received, your account will be activated after review", and the **admins are notified** that a paid client is waiting.
- A **Super Admin approves** from the application page ("Approve & grant dashboard access") — only then is the dashboard access link emailed and the account activated.
- **Offline (cash/bank)** payers were already gated this way (an admin verifies the payment, which approves + sends the link) — unchanged.

## Batch 8 — Region replaced by Country ✅

The client asked to **remove "Region" and replace it with "Country"** for **all user types** (clients, CBs, auditors, referral/consultancy, admins).
- Every admin list — **Companies, Users, Auditors, Certification Bodies, Regional Admins, Applications** — now shows a **Country** column instead of Region.
- Every **create/edit form** now captures **Country** instead of Region.
- The list filters are now **"filter by country"** search boxes; the old top-bar "All Regions" selector (which did nothing) was removed.
- **The role itself is now called "Country Admin"** everywhere it appears (sidebar, page titles, the user list, the role picker, the profile menu). Its behaviour and access are unchanged — only the name changed, so nothing in the database or permissions was disturbed.
- **Under the hood:** the system still derives an internal region from the country automatically, so **the Country Admin's access limits keep working exactly as before** — they still only see their own area. This was verified so nothing about who-can-see-what changed.
- **Note:** `Country` is a new field on the client/user record. Existing users' countries are **backfilled** by the same `phase17` migration (from data captured at signup). Users created before that had no country stored will show "—" until edited. New users capture it going forward.

## Batch 9 — Landing hero cleanup ✅

The client marked two things on the homepage hero to remove (desktop **and** mobile).
- ✅ Removed the **"IAF Accredited Certification Bodies Partners" badge** (the green pill above the headline).
- ✅ Removed **"IAF"** from the headline — it now reads **"Accredited ISO Certifications"** (was "IAF Accredited ISO Certifications").
- The homepage is one responsive layout, so both changes apply to desktop and mobile automatically.

## Still to do from today's list

Everything on today's list is now built. Remaining blockers are **data/decisions from the client**, not development:
- **Real bank/cash details** for the popup (still `XXXX`).
- **Logo:** confirm white vs grey-™, and send the **vector** file.

---

## Decisions needed from the client

1. **Run the migration** (`phase17`) — checkout is dead until then, and it also creates the Country field + backfills it. This is the only blocker on revenue.
2. **Logo:** all-white ™, or grey ™? And please send the **vector** version.
3. **Region → Country:** done — including renaming the **role to "Country Admin"** everywhere it's shown. (The rename is display-only; the internal role identifier is unchanged so no database rules or permissions were touched.)
4. **Bank/cash details** are still placeholders (`XXXX`) — the popup is built but shows placeholder details until the real IBAN/beneficiary are provided.
5. **ISO page:** keep the small standard-code label, or remove that too?

---

## Internal review & fixes (this round)

Every change was put through internal security/logic review before this report. Three real issues were found and **fixed**:
- **Access control (important):** because a user's area is now derived from the country they type, a Regional Admin created with an unrecognised/misspelt country could have ended up with *no* area — and would then have seen **every** region. Fixed at the source (we now refuse to create a Regional Admin whose country doesn't resolve to a region) **and** defensively (all admin lists now show *nothing* rather than everything if an admin somehow has no region).
- **Payment gate:** the "Approve & grant access" button could appear for an **abandoned, unpaid** card order. Now both the button and the server only allow approval once payment has actually landed.
- **Double-click safety:** approving an already-approved client no longer re-sends the link or re-stamps the record.

## Technical status

- `npm run build` passes. New/changed code is lint-clean (a few pre-existing advisory warnings elsewhere were left untouched).
- Root cause of the checkout failure was confirmed against the **live database**, not inferred.
- **Not yet deployed** — awaiting go-ahead. The `phase17` migration must be run **before or with** the deploy.
