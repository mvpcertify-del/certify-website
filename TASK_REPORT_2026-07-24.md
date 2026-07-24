# Task Report — 24 July 2026

Covers your 16-point list of 23–24 July plus the four follow-up items raised this evening. Every item was investigated against the live site and the actual code before anything below was written.

**Summary: one live data exposure found and closed. Fourteen items fixed. Referral commissions rebuilt from the ground up — they had never been paid. Three decisions still needed from you.**

---

# 🚨 FIRST — a live data exposure, found and closed

While investigating why your Client user could not access certifications, we found the cause, and it was worse than the symptom.

On **Roles & Permissions**, four permissions had been manually changed for the **Client** role:

| Permission | Was | Should be | Effect |
|---|---|---|---|
| `create_certification` | **OFF** | ON | **This is why a client could not start any certification.** "New Application" vanished for every client. |
| `manage_settings` | **OFF** | ON | Removed "My Profile" from every client's menu. |
| `view_all_certifications` | **ON** | OFF | 🔴 **Every client could see every other client's application** — company names, industry, scope, country, assigned auditor and certification body. |
| `view_certifications` | **ON** | OFF | — |

The third row is the serious one. Your own screenshot shows it: the client account's menu contained an **"Applications"** entry it should never have had. Behind it is the full administrative list, which applies no per-client filter of any kind. Sparck Services' order was visible to any logged-in client.

**With your authorisation we clicked Reset on the Client role.** All four are back to their built-in defaults. The exposure is closed and clients can start certifications again.

- **The other four roles had no changes at all.** Referral, Auditor, Consultancy and Certification Body were already at defaults — so items 13/14 turned out to mean one role, not five. Their problems were in our code, not your settings.
- **Anyone already signed in must reload (Ctrl+F5)** before the corrected permissions take effect in their browser.

We would ask that permission toggles are left alone from here. One switch on that screen does not merely hide a menu item — it locks the entire page behind it, for every user of that role, across the whole platform, instantly.

---

# 🔴 THE BIGGEST FINDING — referral commissions had never been paid

This matters more than anything else on the list.

**The live checkout ignored referrals completely.** When a partner shared their link and a client bought through it:

- the checkout page **never read the referral code from the link**;
- the payment handler contained **no referral lookup and no commission calculation**;
- and because that handler creates the buyer's account itself, the buyer never passed through the referral sign-up path, **so no referral record was ever created**.

**Every sale made through a partner link paid that partner nothing.** Not a display fault — the commission was never calculated or recorded.

Three further faults in the same area:

1. **The advertised "Referred clients get 10% off their first purchase" was never applied** on the live funnel. It existed only on an older path today's buyers do not use. That promise is on a public page and was not being kept.
2. **There was no referral code.** The `?ref=` value was the first 8 characters of the partner's internal record number, matched by scanning the first 1,000 users. It would break past 1,000 partners, and two partners could collide and be paid each other's commission.
3. **"Mark as paid" had never worked.** The payout button wrote to a database column that did not exist, so every click returned an error. No commission had ever been marked paid, because it could not be.

## What we built

**One code, both jobs.** A partner now has a single code — `REF-XXXXXX` — shown large on their dashboard. A buyer typing it at checkout gets their 10% discount, and the partner is credited automatically. Previously there were two separate things (a tracking link and a coupon) and partners kept sharing the wrong one.

| | Before | Now |
|---|---|---|
| Partner's code | Derived in the browser, stored nowhere | Real, stored, unique, indexed |
| Attribution | Matched on the buyer's email address | Stamped onto the order itself |
| Commission on a live sale | Never | On card, cash and bank transfer |
| Buyer's 10% discount | Advertised, not applied | Applied, and shown on the total |
| Double payment | Possible | Blocked at the database |
| "Mark as paid" | Always failed | Works |

The code letters deliberately exclude `0`, `O`, `1`, `I` and `L` — these codes get read off a phone screen and dictated over the phone, and those five are what people mistype.

**Attribution now rides on the order, not on an email match.** Previously, a buyer who paid with a different address than the partner had typed lost the partner their commission entirely.

---

# ✅ ALSO FIXED

## Auditor has no options in the dashboard *(item 1)*

**Confirmed exactly as described.** An auditor's menu contained only Dashboard, My Profile and Notifications. A Certification Body's menu was identically bare — the same fault, which you had not yet hit.

**Cause:** the auditor's work queue and the CB's review queue both already existed and worked correctly — but **nothing anywhere linked to them.** They were unreachable.

**Fixed:** both now appear — **My Audits** for auditors, **My Reviews** for certification bodies.

**One thing we deliberately did not do,** and want on the record: the obvious-looking fix is to give auditors the main Applications list. **We did not**, because that list applies no filter for who is asking — an auditor would have seen every client's order in every country, the same exposure we had just closed for clients. The new entries point at the properly-scoped queues instead.

## Role change not reflected in the user's own profile *(item 2)*

**The change saves correctly.** We verified it writes to both places a role is stored. The problem is that the affected person's browser has already loaded their old role and never re-reads it.

**Workaround that works today:** the affected user presses **Ctrl+F5**, or logs out and back in.

An automatic refresh touches the session layer for every user; we left it out of this batch rather than risk it in a hotfix.

## No way back to the Hero / main page *(item 3)*

**Confirmed:** no screen inside the platform linked back to the public home page. The logo in the menu had been made deliberately non-clickable.

**Fixed:** the logo is now a link home, on every screen, for every role.

## Back button was centred *(this evening)*

On the login and password screens the back arrow sat in the middle of the page under the logo, because the layout centres everything. **It is now at the left edge**, where a back control belongs and where every other screen puts it.

## Menu category icons *(items 5, 6, 7)*

**Done for all seven user types.** All 30 menu entries now carry a marker:

- 🔍 **View only** — the screen shows information
- ⚡ **Data entry** — the screen is where records are created

**Two deliberate departures from your note:**

1. **We used drawn icons rather than the 🔍 and ⚡ emoji.** Emoji are painted by the operating system, so they change shape between Windows, Mac and Android — and in Arabic the font substitutes a mismatched symbol. The drawn versions are the same two symbols and stay identical in all nine languages.
2. **Eight screens change category depending on who is looking.** Applications, Companies, Country Admins, Auditors, Cert Bodies and Consultancies are **data entry for a Super Admin** but **view only for a Country Admin**, who cannot add records there. A fixed marker would have been wrong for one of them, so it is worked out from the signed-in user's role.

## No dark/light switch on the public site *(this evening)*

The theme switch existed only **inside** the dashboard. A visitor on the public site had no way to switch to dark mode, and no way back once they had.

**Fixed:** it now sits in the public header, on desktop and mobile, next to the language switcher.

## 🔴 White cards on the dark theme — and it was not one page *(this evening)*

You asked why the Main Dashboard cards were white on the dark theme. The cause turned out to be a whole class of fault.

The card style referred to a colour variable **that does not exist anywhere in the project** — the name was slightly wrong. When a browser cannot find a variable it uses the written fallback instead, and every one of those fallbacks was a light-theme colour. So the cards were white in **both** themes, permanently.

We scanned the entire project. **Twenty such variables were in use and none of them existed:**

| Affected screen | Symptom |
|---|---|
| Main Dashboard, Sales | White cards on the dark theme |
| My Certificates | Blue instead of the brand green |
| Settings | Light alert boxes on a dark page |
| Client Dashboard, Application form | No background or border at all |

All twenty now point at the real colours, in one place, and follow the theme correctly. A re-scan confirms none are left except two that are set deliberately per-item.

## Menu unreadable on the dark theme *(item 4, this evening)*

The public header and its mobile menu had their colours **written in directly** rather than taken from the theme. So the header stayed dark even in light mode — visible in your own screenshot — and in dark mode the mobile menu was the same near-black as the page behind it, which is why the links were hard to read.

Both now follow the theme. Verified in the browser in both modes.

## Notifications about purchases *(item 11)*

First, a correction to the premise: **the platform never created a login notification.** What arrives on sign-in is the emailed access link, re-sent whenever an administrator touches a payment status.

The real problem was the opposite — **purchases generated almost nothing:**

| Event | Before | Now |
|---|---|---|
| Card payment received | ❌ nothing | ✅ "Payment received" |
| Cash / bank payment verified | ❌ nothing | ✅ "Payment received" |
| Admin marks an order paid | ❌ nothing | ✅ "Payment received" |

A card buyer who closed the browser tab, and **every cash and bank-transfer buyer**, previously had no record of their payment anywhere in the platform.

## A new client had nowhere to go *(item 11)*

Beyond the permission problem, the client dashboard had a genuine dead end: a new client saw **one button — the quiz** — with no route to the certification catalogue at all, and a client scoring **under 60 saw no buttons whatsoever.**

**Fixed:** both states now offer **Browse Certifications**. A low gap-analysis score is advice, not a barrier to purchase.

---

# 🔒 Independent security review of the new commission code

Because this code moves money, we had it reviewed adversarially rather than trusting our own work. It found eleven issues. **Eight were in the new code and are already fixed:**

| Issue | What it meant |
|---|---|
| A partner could buy through **their own code** with a second email — taking the buyer's discount **and** their own commission, repeatedly | Now blocked, including `+tag` and dotted Gmail variants |
| A demoted partner's code **kept earning forever** | Codes now only work for current, approved partners |
| The coupon table could be **read out one letter at a time** by an anonymous visitor, and any coupon found could then be used — including a 100%-off one | Closed |
| A notification bug meant partners **would never have been told** they earned a commission | Fixed |
| The code-uniqueness check **was not actually checking**, and a clash would have aborted account creation | Fixed (needs the `phase26` migration below) |
| Raw database errors were returned to anonymous callers | Stopped |
| Oversized and malformed input reached the database | Capped and rejected |
| A partner sharing their own promotional coupon had the buyer silently dropped to the flat 10% | Fixed |

One recommendation we deliberately did **not** follow: the review suggested switching coupon lookups to exact matching. We could not confirm that no existing coupon is stored in lower case, and exact matching would have silently stopped honouring it. We closed the hole a different way, with no risk to existing coupons.

**Three findings were pre-existing and remain open — see below.**

---

# ❓ FOUR DECISIONS WE NEED FROM YOU

## A. Three security holes we have NOT touched

You asked us to do only what was on your list, so we stopped and are asking. All three predate this work, but **two are now more dangerous because the migrations have been run** — the payout button that had always failed now works.

1. **Anyone can register themselves as a referral partner and then create fake commission entries**, which land in your payout queue looking real. Roughly one hour to close.
2. **An older payment route awards commission before any money is taken** and can be triggered without signing in. Roughly one hour.
3. **Every signed-in user can read every discount coupon** in the system. Roughly fifteen minutes.

**Our recommendation: close all three now.** Say the word.

## B. Self-registration contradicts an instruction you gave earlier *(items 11, 12)*

You have asked: *"The objective is to enable users to Self register & Self complete the transactions."*

Today a client can pay in full by card and **still cannot sign in** until a Super Admin approves that specific order. This is not a fault — **it is exactly what you asked for previously**, and it is recorded in the code with that instruction beside it.

Both cannot be true. Please confirm:

1. **Fully self-service** — a successful card payment activates the account immediately.
2. **Keep admin approval** — as today.
3. **Split** — card activates automatically, cash and bank transfer still wait for verification. **This is our recommendation:** a card payment is already verified by the payment provider, so the manual check adds delay without adding certainty. Cash and bank genuinely need a human.

## C. Should an auditor be able to add clients? *(item 1)*

Auditors have never been able to create users anywhere in the platform. Giving them that is a new capability with commercial implications. Please confirm whether you want it, and if so whether those clients should be attributed to that auditor.

## D. Item 4 — *"Functionality is a priority"*

Taken as direction rather than a task, and reflected in what was prioritised. If you meant a specific screen, tell us which.

---

# ⚠️ BEFORE THIS GOES LIVE

**1. Run the `phase26` migration.** It hardens two faults in `phase25`, which you have already applied. Without it the code-uniqueness check does not work and a clash could block a partner from registering.

**2. Deploy the code.** Nothing from today is on the live site.

**Order matters: migration first, then the code.** We verified that with the code deployed but the migration missing, the referral feature fails silently — it looks deployed and simply does nothing.

**3. One thing for you to check.** `phase24` and `phase25` are confirmed applied — we verified every new column exists in the live database. What we could **not** verify is whether existing partners received their codes, because that table is not readable with the keys available to us. Please run:

```sql
SELECT full_name, role, referral_code
FROM public.profiles
WHERE role IN ('referral','consultancy')
ORDER BY created_at;
```

Every partner should show a `REF-XXXXXX` code. Tell us if any are blank.

---

# Technical status

- `npm run build` passes.
- All serverless functions verified to load under the production engine.
- Changed files are lint-clean. Two pre-existing warnings in the menu file were confirmed present before this work and left alone.
- New text translated into all nine languages — every key verified present in every language by scanning the source, not by trusting the files.
- The new input guards were tested directly against wildcards, injection strings, oversized input, and the `+tag` / dotted-Gmail self-referral cases.
- Both themes were checked in a real browser after the colour fixes.
- Investigation used five parallel reviews: auditor and CB access, the referral and coupon system, the client purchase journey, role synchronisation and menu structure, and an adversarial security review of the commission code. Findings were cross-checked against the live site.
- **Not committed, not deployed.**

---

# Still outstanding from earlier weeks

- **WCA GLOBAL's US$75 commission** on the Sparck sale — still not credited. *(19 July)*
- **Sparck's invoice and receipt** — still held from the client pending your review.
- **Pricing model** — one US$999 fee covering 3 years, versus "1 Year Initial" plus US$150/year. Still unanswered; it also blocks the promotional video script.
- **Consultancy contract** — still awaiting legal review before any partner signs.
- **3-month inactivity rule** — flag only, or automatic deactivation? Unconfirmed.
- **Item 10 of your 22 July list** was left blank. Still unanswered.
- **In-app logo colour** — black/white while the favicon, invoices and emails are teal. Awaiting your approval to match them.
