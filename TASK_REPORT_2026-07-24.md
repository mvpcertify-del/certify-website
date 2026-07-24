# Task Report — 24 July 2026

Covers your 16-point list of 23–24 July. Every item was investigated against the live site and the actual code before anything was written below.

**Summary: one live data exposure found and closed immediately. Five items fixed in code. Three items need your decision. The rest are scoped and estimated.**

---

# 🚨 FIRST — a live data exposure, found and closed

While investigating why your Client user could not access certifications, we found the cause, and it was worse than the symptom.

On **Roles & Permissions**, four permissions had been manually changed for the **Client** role:

| Permission | Was set to | Should be | What it did |
|---|---|---|---|
| `create_certification` | **OFF** | ON | **This is why a client could not start any certification.** The "New Application" menu item disappeared for every client on the platform. |
| `manage_settings` | **OFF** | ON | Removed "My Profile" from every client's menu. |
| `view_all_certifications` | **ON** | OFF | 🔴 **Every client could see every other client's application** — company names, industry, scope, country, and the assigned auditor and certification body. |
| `view_certifications` | **ON** | OFF | — |

That third row is the serious one. Your own screenshot shows it: the client account's menu contained an **"Applications"** entry it should never have had. Behind that entry is the full administrative list, and it applies no per-client filter of any kind. Sparck Services' order was visible to any logged-in client.

**With your authorisation we clicked Reset on the Client role.** All four are now back to their built-in defaults. The exposure is closed and clients can start certifications again.

Two things worth stating plainly:

- **The other four roles had no changes at all.** Referral, Auditor, Consultancy and Certification Body were already at defaults. Their problems are in our code, not in your settings — so item 13/14 ("restore the previous settings") is now fully done, and it turned out to mean one role, not five.
- **Anyone already logged in must reload the page** (Ctrl+F5) before the corrected permissions take effect in their browser.

We would ask that permission toggles are left alone from here. A single switch on that screen does not merely hide a menu item — it locks the entire page behind it for every user of that role, across the whole platform, instantly.

---

# ✅ FIXED IN CODE (not yet deployed)

## 1 — Auditor has no options in the dashboard *(your item 1)*

**Confirmed exactly as you described.** An auditor's menu contained only Dashboard, My Profile and Notifications. A Certification Body's menu was identically bare — the same fault, which you had not yet hit.

**Cause:** the auditor's work queue at `/auditor/dashboard` and the CB's at `/cert-body/dashboard` both already existed, work correctly, and are properly restricted — but **nothing anywhere linked to them.** They were unreachable.

**Fixed:** both now appear in the menu — **My Audits** for auditors, **My Reviews** for certification bodies.

**One thing we deliberately did not do,** and want on the record: the obvious-looking fix is to give auditors access to the main Applications list. **We did not**, because that list applies no filter for who is asking. An auditor would have seen every client's order in every country — the same exposure we had just closed for clients. The two new entries point at the properly-scoped queues instead: an auditor sees only applications assigned to them.

**On "add Clients":** an auditor cannot create users anywhere in the platform, by design. That is a new feature and a commercial decision, not a bug — see the questions section below.

## 2 — Role change not reflected in the user's own profile *(your item 2)*

**The change is saving correctly.** We verified it writes to both places a role is stored. The problem is that the affected person's browser has already loaded their old role and never re-reads it — it only refreshes on a full page load or roughly every 50 minutes.

**Immediate workaround, works today:** the affected user presses **Ctrl+F5**, or logs out and back in.

A proper automatic refresh is a small change but touches the session layer for every user; we have left it out of today's batch rather than risk it in a hotfix. Say the word and we will schedule it.

## 3 — No way back to the Hero / main page *(your item 3)*

**Confirmed:** no screen inside the platform linked back to the public home page. The logo in the menu was deliberately made non-clickable.

**Fixed:** the Certify.cx logo at the top of the menu is now a link to the home page, on every screen, for every role.

## 5, 6, 7 — Menu category icons *(your items 5, 6, 7)*

**Done for all seven user types.** Every one of the 30 menu entries now carries a marker:

- 🔍 **View only** — the screen shows information
- ⚡ **Data entry** — the screen is where records are created

**Two deliberate departures from your note, both for good reasons:**

1. **We used drawn icons rather than the 🔍 and ⚡ emoji.** Emoji are painted by the operating system, so they change shape between Windows, Mac and Android — and in Arabic the font substitutes a mismatched symbol. The drawn versions are the same two symbols and stay identical in all nine languages.

2. **Eight screens change category depending on who is looking.** Applications, Companies, Country Admins, Auditors, Cert Bodies and Consultancies are **data entry for a Super Admin** but **view only for a Country Admin**, because a Country Admin cannot add records there. A fixed marker would have been wrong for one of them, so the marker is now worked out from the signed-in user's role.

## 11 (part) — A new client had nowhere to go

Beyond the permission problem above, the client dashboard had a genuine dead end:

- A new client with no gap-analysis score saw **one button: the quiz.** There was no route from the dashboard to the certification catalogue at all.
- A client who scored **under 60 saw no buttons whatsoever** — a page with nothing to click and no way to buy.

**Fixed:** both states now offer **Browse Certifications**. A low gap-analysis score is advice, not a barrier to purchase.

## 11 (part) — Notifications about purchases, not logins *(your item 11)*

First, a correction to the premise: **the platform never created a login notification.** What arrives on sign-in is the emailed magic link, which is re-sent every time an administrator touches a payment status.

The real problem was the opposite of what it looked like — **purchases generated almost nothing:**

| Event | Before | Now |
|---|---|---|
| Card payment received | ❌ nothing | ✅ **"Payment received"** |
| Cash / bank payment verified | ❌ nothing | ✅ **"Payment received"** |
| Admin marks an order paid | ❌ nothing | ✅ **"Payment received"** |

A card buyer who closed the browser tab, and **every single cash and bank-transfer buyer**, previously had no record of their payment anywhere in the platform. That is now raised at the one point all three payment routes pass through, so it cannot be missed again.

The remaining gaps — no notification on application status change, on auditor assignment, or when an invoice is issued — are listed in the estimates below.

---

# ⚠️ THE BIGGEST FINDING — referral commissions are not being paid *(your items 8, 9, 16)*

This needs your attention more than anything else on the list.

**The live checkout ignores referrals completely.**

When a referral partner shares their link and the client buys through it:

- the checkout page **never reads the referral code from the link**;
- the payment handler contains **no referral lookup and no commission calculation**;
- and because that handler creates the buyer's account itself, the buyer never passes through the referral sign-up path, **so no referral record is ever created**.

**The consequence: every sale made through a partner link has paid that partner nothing.** Not a display fault — the commission was never calculated or recorded.

The **"Referred clients get 10% off their first purchase"** promise on your own referral page is in the same position. It is implemented only on an older path that today's buyers do not use. **A client arriving from a partner link and buying normally receives no discount.** That promise is currently on a public page and is not being kept.

**On the coupon question specifically:** a referral partner cannot create a coupon today. There is no screen, no permission, and the database has no concept of a coupon belonging to a partner. What you are asking for does not exist yet — it was never built.

**And the unique code:** the `?ref=` value is not a stored code at all. It is the first 8 characters of the partner's internal record number, matched by searching the first 1,000 users. It breaks past 1,000 partners, and two partners could collide and be paid each other's commission.

This is the single largest piece of work on your list, and it is **not a fix — it is a build.** Estimate and options are below.

---

# ❓ THREE DECISIONS WE NEED FROM YOU

## A. Self-registration contradicts an instruction you gave earlier *(your items 11, 12)*

You have asked: *"The objective is to enable users to Self register & Self complete the transactions."*

Today a client can pay in full by card and **still cannot log in** until a Super Admin approves that specific order. This is not a fault — **it is exactly what you asked for previously**, and it is written into the code with that instruction recorded beside it.

The two cannot both be true. **Please confirm which you want:**

1. **Fully self-service** — a successful card payment activates the account immediately, no admin step. (Faster for the buyer; you lose the manual check.)
2. **Keep admin approval** — as today. (You keep control; buyers wait.)
3. **Split** — card payments activate automatically, cash and bank transfer still wait for admin verification. **This is our recommendation:** a card payment is already verified by the payment provider, so the manual check adds a delay without adding certainty. Cash and bank genuinely do need a human to confirm the money arrived.

## B. Should an auditor be able to add clients? *(your item 1)*

Auditors have never been able to create users. Giving them that ability is a new capability with commercial implications — an auditor could enrol clients directly. Please confirm whether you actually want this, and if so, whether those clients should be attributed to that auditor.

## C. Your item 4 — *"Functionality is a priority"*

We have taken this as direction rather than a task, and it is reflected in what was prioritised today. If you meant a specific screen, please tell us which.

---

# 📋 REMAINING WORK — scoped and estimated

| # | Item | Est. | Notes |
|---|---|---|---|
| 8, 9, 16 | **Referral commission + unique code + partner coupons** | **2–3 days** | Database changes, checkout rewrite, and new screens. Cannot be shortened safely — it moves money. |
| 11, 12 | Self-service activation | 0.5 day | Blocked on decision **A** above. |
| 2 | Automatic profile refresh | 0.5 day | Workaround available today (Ctrl+F5). |
| 11 | Remaining purchase notifications (status change, auditor assigned, invoice issued) | 1 day | |
| 15 | Full permission review per role | 0.5 day | Now that defaults are restored, we can go through each role with you. |
| — | Client-visible orders & invoices screen | 1 day | Clients currently cannot see their own invoices at all. |
| — | **Auditor `phase24` database migration** | **minutes** | ⚠️ **Still outstanding from 22 July.** The new auditor fields are live but the database has nowhere to store them. |

---

# ⚠️ Two things still blocking

1. **The `phase24` migration has still not been run.** Third day of asking. Until it is, the auditor registration fields cannot save and auditor certificate uploads fail silently. Tell us whether we should run it or you will.

2. **Today's fixes are not deployed.** They exist in the working copy only, as instructed — nothing has been committed or pushed.

---

# Technical status

- `npm run build` passes.
- All four serverless functions verified to load under the production engine.
- Files changed today are lint-clean. Two pre-existing warnings in the menu file were confirmed present before this work and were left alone.
- All new text translated into all nine languages — 54 of 54 entries verified present.
- Investigation was carried out by four parallel reviews covering: auditor and CB access, the referral and coupon system, the client purchase journey, and role synchronisation with menu structure. Findings were cross-checked against the live site before anything was written here.
- **Not committed, not deployed.**

---

# Still outstanding from earlier weeks

- **WCA GLOBAL's US$75 commission** on the Sparck sale — still not credited. *(19 July)*
- **Sparck's invoice and receipt** — still held back from the client pending your review.
- **Pricing model** — one US$999 fee covering 3 years, versus "1 Year Initial" plus US$150/year. Still unanswered, and it now also blocks the promotional video script.
- **Consultancy contract** — still awaiting legal review before any partner signs.
- **3-month inactivity rule** — flag only, or automatic deactivation? Still unconfirmed.
- **Item 10 of your 22 July list** was left blank. Still unanswered.
- **In-app logo colour** — currently black/white while the favicon, invoices and emails are teal. Awaiting your approval to match them.
- **Further security issues** reported on 22 July remain untouched, as instructed.
