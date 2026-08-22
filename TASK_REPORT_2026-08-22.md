# Task Report — 22 August 2026

**Project:** Certify.cx
**Status:** Both tasks done and pushed. No database step, no configuration change.
**One thing needs your answer before this goes live: the prices. See "The prices are placeholders".**

---

## The two requests

> **1.** *"Remove the background from the logos you added — the white one.
> Ok, just remove the white area around the logos."*
>
> **2.** *"All these 8 Compliance systems have to be interactive so that when
> clients press on any of them it should take them to content & to price
> payment gateway."* (with a screenshot of the live section, all eight cards
> arrowed)

Both are done. A self-contained preview was sent with this report
(`compliance-preview-22aug.html`) — it opens straight from your Downloads
folder, needs no internet, and shows the cut-out logos on both themes plus the
new service page.

---

## 1. The white behind the logos is gone

The white was not styling — it was inside the image files themselves. The eight
marks came off the reference site as **JPEGs, and a JPEG cannot hold a
transparent area**, so every one arrived as a mark painted on a solid white
rectangle. That is why a white box appeared behind each logo on the dark cards.

So the files were re-cut rather than restyled. Each image is now a **PNG with the
white around the mark removed**, and the plate that was holding them has been
deleted from the page.

The cut works outwards from the edge of each picture, which matters: it clears
**only the white around the mark**, and leaves white that belongs to the mark
itself — the letters inside the PCI DSS badge, the gaps between the stars in the
GDPR ring, the white in the HIPAA symbol. A blanket "delete every white pixel"
would have eaten holes in four of the eight.

### One thing I fixed that you would have seen next

With the white gone, four marks are drawn in near-black — **HIPAA, HITRUST, the
penetration-testing laptop, and the "COMPLIANT" line under PCI DSS**. On your
dark theme they went from a white box to almost invisible. Neither is what you
asked for.

So each mark now carries a **soft white halo that follows its own outline**. No
box, no plate, no rectangle — the glow traces the shape of the logo. The dark
marks read clearly again, the already-bright ones (GDPR, SOX, CCPA) pick up only
a faint edge, and on the **light theme the halo switches off entirely**, because
there the marks sit on white exactly as their owners drew them. Both are in the
preview; the dark version is the one worth looking at first.

### Size

The eight went from 57 KB to about 165 KB in total. Transparency costs more to
store than a flat JPEG. To keep it from being worse I capped each image at 192
pixels — twice the largest size it is ever drawn at — which strips out the
compression noise the old JPEGs carried. They load one at a time as you scroll,
so this is not something a visitor will feel.

---

## 2. The eight cards are now clickable, with content and a payment page

Each card opens its own page at **`certify.cx/compliance/<service>`** — for
example `certify.cx/compliance/soc`. The page carries:

- the mark, the service name, and **who owns the framework** (AICPA, PCI SSC,
  the EU, and so on),
- **About this engagement** — what the service covers,
- **What's included** — five points: scoping session, gap assessment against the
  full control set, written remediation guidance, the formal assessment by an
  independent assessor, and the final report and attestation letter,
- **How it works** — the four stages, pay → scoping and evidence → independent
  assessment → report and attestation,
- **a price card with a "Proceed to payment" button.**

That button goes to **the same checkout, the same Stripe gateway, the same bank
transfer and cash options** the ISO standards already use. Nothing separate was
built for it: a compliance order is created, priced, discounted, referral-tracked
and receipted by exactly the code that handles an ISO order. A partner's referral
link and a discount code both work on these eight the same way they work on
ISO 9001.

The compliance services also now appear in the **checkout's own picker**, under
their own "Compliance Audits" heading below "ISO Standards" — so a buyer who
arrives on a bare `/checkout` link, or on a partner's `?ref=` link that names no
standard, can choose one of the eight there too.

### What I deliberately did NOT do

I did not move the eight into the ISO catalogue. That would have been the
quickest way to make them buyable, and it would have put them into the auditor's
ISO standards list and the ISO-specific parts of the application flow, where
they are not ISO standards and cannot be delivered as such. They keep their own
catalogue and their own pages; only the **price and checkout paths** are shared,
which is the part you actually asked for.

---

## The prices are placeholders — this is the one thing I need from you

**You have never given me a price for any of these eight.** They are live and
buyable now, so I could not leave the price blank.

What I did instead of inventing numbers: **all eight are set to US$1,999, which
is your site's own existing specialist-audit price** — the same figure ISO 27001,
ISO 42001, ISO 13485 and the rest already sell at. It is not a number I made up;
it is a number your site already charges.

But it is still a placeholder, and it is **live**: a buyer can pay $1,999 for a
HITRUST certification or a SOC 2 examination today. In the real market those
engagements usually cost several times that. If someone buys one at this price,
you are committed to delivering it at this price.

**Send me the eight figures and each one is a one-line change.** They sit
together in a single file (`src/utils/complianceServices.js`) with a note
explaining exactly this — each service has its own price field, so they do not
have to be the same.

The employee and location surcharges apply to these the same as to an ISO
certification: the headline price covers up to 50 employees at 1 location, and
the checkout adds the rest.

---

## Two more things worth knowing

**1. What happens after payment.** A paid compliance order runs through the
existing certification pipeline — the buyer registers, an auditor and a
certification body are assigned, and at the end the system issues a certificate
naming the service ("SOC", "HITRUST", and so on). Nothing breaks. But **who
actually performs a SOC examination or a penetration test, and what the client
receives at the end, is a delivery question, not a software one.** Tell me how
you want these fulfilled and I will shape the pipeline around it. Until then the
software treats them the same as a certification.

**2. The trademark point, once more and then I will stop.** Six of the eight
marks belong to other organizations — AICPA, PCI SSC, HITRUST Alliance, HHS and
the EU. Now that the cards also **sell** the service, the mark is no longer just
decoration on a list; it sits next to a price and a payment button, which reads
as a claim that you are authorised to perform that assessment. If Certify.cx does
not hold those accreditations, that is the version of the problem a large
client's legal team notices. Five minutes with whoever handles your legal side.
Whichever need to come off, tell me — one line each.

---

## Languages

All twenty-one new strings — the section headings, the five "what's included"
points, the four steps, the price labels, the button — are translated into **all
nine languages** the site supports: English, Spanish, Arabic, German, French,
Hindi, Portuguese, Russian and Chinese. Nothing falls back to English. The new
page uses the same layout containers as the existing public pages, so Arabic
right-to-left is inherited rather than re-implemented.

---

## Files changed

| File | Change |
|---|---|
| `src/assets/compliance/*.png` (8 files) | **Replaced** the eight JPEGs — white cut out, transparent |
| `src/components/ui/ComplianceLogo.css` | White plate removed; dark-theme halo added |
| `src/components/ui/ComplianceLogo.jsx` | Comment updated to match |
| `src/utils/complianceServices.js` | **New** — the eight services, their codes and their prices |
| `src/utils/complianceAudits.js` | Now just attaches the logos to the above |
| `src/utils/pricing.js` | Prices a compliance service; resolves its display code |
| `src/pages/compliance/ComplianceLanding.jsx` + `.css` | **New** — the service page |
| `src/App.jsx` | The `/compliance/:slug` route |
| `src/pages/landing/LandingPage.jsx` + `.css` | Cards are links now |
| `src/pages/public/Certifications.jsx` + `.css` | Same |
| `src/pages/public/Checkout.jsx` + `.css` | Accepts a compliance service; shows both catalogs in the picker |
| `src/pages/client/StartPayment.jsx` | **Bug fixed** — see below |
| `api/checkout.js` | Records and receipts a compliance order under its proper name |
| `src/i18n/locales/*.json` (9 files) | 22 new strings, in all nine languages |

**A bug caught on the way through.** `StartPayment.jsx` resolves the thing being
bought using the ISO catalogue and falls back to ISO 9001 when it finds nothing.
A **logged-in client** who pressed "Proceed to payment" on SOC Examinations would
therefore have had an **ISO 9001 application** created and been charged for that
instead. Fixed. It could not have happened before today, because the cards were
not clickable — but it would have started happening the moment they were.

---

## Verification

Checked here:

- All nine language files still parse, and each carries all 22 new strings **in
  its own language**. The existing keys were not touched — the new lines are
  inserted, so every other key keeps its exact position.
- Every `t(...)` key used by the new and changed pages resolves against the
  English file — no missing-string placeholders.
- All eight logo files exist and each is used by a card; no broken image, no
  orphan file. The old JPEGs are removed rather than left behind.
- The cut-out was inspected image by image on a dark and on a light background —
  no white fringe, no hole eaten out of a mark, no logo cropped or squashed.
- The eleven changed code files are structurally intact, and no unused imports
  were left behind.
- The price a buyer is shown and the price the server charges come from the
  **same function**, for a compliance service exactly as for an ISO standard —
  they cannot disagree.
- The file that carries the logos is imported only by page components; the file
  the payment API needs carries no images. That split is deliberate — a single
  image import reachable from the checkout API would take the whole payment
  endpoint down on Vercel.

**Not checked here, and I want to be straight about it:** this machine has no
Node.js installed, so I cannot run the build or open the site. The checks above
are static. What needs your eyes after deploy:

1. `certify.cx` — scroll past the ISO standards. Logos with **no white box**, and
   each card should lift when you hover it.
2. Click one — you should land on its service page with the price.
3. Press **Proceed to payment** and check you reach the Stripe page showing the
   right service name and $1,999. **Do not complete it** until you have given me
   the real prices.
4. Switch to Arabic and glance at the new page — it should read right to left.
5. Switch to the light theme and check the logos — the halo should disappear.

The preview file shows you items 1 and 2 without waiting for a deploy.

---

## Still open from earlier

Not from today, and none of it affected by these changes — listing it so nothing
gets lost:

- **`supabase/phase31_checkout_org_size.sql`** from 16 Aug, if you have not run
  it. Thirty seconds, and it is the insurance against the checkout failing in
  front of a buyer.
- **A decision on the two pricing tables** — the landing-page calculator and the
  checkout still quote different surcharges for the same company size (a
  60-employee firm is quoted +$1,000 and charged +$200).
- **Whether registration should be split onto its own step** before payment.
- **The 27 missing `certBody.*` strings** in German, French, Hindi, Portuguese,
  Russian and Chinese — those screens fall back to English. Nothing is broken.
- **The migration-tracking table**, so a deploy can say "the database is behind"
  instead of failing silently.
- **The referral-partner and client registration testing** you asked for before
  the Compliance Audits task came in — not started, and the browser extension is
  not currently connected here. Say the word and I will pick it up.
