# Task Report — 21 August 2026

**Project:** Certify.cx
**Status:** Done and pushed. No database step, no configuration change, nothing to run. **Two decisions needed from you — see "Two things I need you to decide".**

---

## The request

> *"Post the 8 Compliance Audits in certify.cx below the ISO & keep the title
> heading as Compliance Audits. You can check the https://kaleshaco.com website
> for information."*

Accompanied by a screenshot of `kaleshaco.com/services` with two things crossed
out by hand: the **ISO Certification** card inside the grid, and the **Indian
Regulators** heading below it.

---

## What I read from the screenshot

The Compliance Audits grid on that page holds nine cards. With ISO Certification
struck out, exactly eight remain — which matches "the 8 Compliance Audits" in
your message, so I took the strike-through as the instruction and left both
struck items out:

- **ISO Certification** — excluded. Certify.cx *is* the ISO product; it already
  has twelve ISO standards immediately above, each with a price and a checkout.
  Repeating it as a ninth card would send buyers to a second, worse version of
  something they can already buy.
- **Indian Regulators** — excluded. Struck out, and it is a separate section on
  that site rather than one of the eight.

The eight now live on Certify.cx, in the screenshot's own reading order:

| | Card | Badge |
|---|---|---|
| 1 | SOC Examinations | SOC |
| 2 | GDPR Compliance | GDPR |
| 3 | PCI DSS Compliance | PCI DSS |
| 4 | CCPA & CPRA Compliance | CCPA CPRA |
| 5 | HITRUST Certification | HITRUST |
| 6 | HIPAA/HITECH Compliance | HIPAA |
| 7 | Penetration Testing | PEN TEST |
| 8 | SOX ITGC Testing | SOX |

The heading is exactly **Compliance Audits**, as you asked.

---

## Where it appears

**Directly below the ISO standards**, in both public places a visitor sees the
ISO list:

1. **The home page** (`certify.cx`) — the new section sits between the ISO
   standards block and "Why Certify". It has its own anchor,
   `certify.cx/#compliance-audits`, and I added a matching link in the footer so
   it is reachable from every page, not only by scrolling.
2. **The certifications page** (`certify.cx/certifications`) — the page the gap
   analysis sends people to. The ISO grid is unchanged; the Compliance Audits
   grid now follows it under the same heading.

I did both because a visitor who lands on `/certifications` from the gap
analysis would otherwise never see the eight at all. The ISO section itself is
untouched: same twelve standards, same prices, same links.

---

## The logos

Each card carries the framework's own logo, **the same eight marks used on
kaleshaco.com/services**, as you asked. **A preview of all eight, on both the
dark and the light theme, was sent to you alongside this report**
(`compliance-logos-preview.html` — open it in any browser).

| Card | Mark | Owner |
|---|---|---|
| SOC Examinations | AICPA SOC seal | AICPA |
| GDPR Compliance | EU circle-of-stars GDPR mark | European Union |
| PCI DSS Compliance | PCI DSS Compliant mark | PCI Security Standards Council |
| CCPA & CPRA Compliance | CCPA / CPRA shields | State of California |
| HITRUST Certification | HITRUST wordmark | HITRUST Alliance |
| HIPAA/HITECH Compliance | HIPAA caduceus | US Dept. of Health & Human Services |
| Penetration Testing | Security testing mark | — generic, not a trademark |
| SOX ITGC Testing | SOX shield | — generic, not a trademark |

The files are **copied into Certify.cx rather than linked to the other site**.
Linking would have meant every visitor's browser fetching eight images from
kaleshaco.com, and all eight cards going blank the day that site reorganises its
files. At 3.7–10.4 KB each they add about 57 KB in total, which is less than one
photograph.

**One display detail worth knowing:** all eight source files are JPEGs with a
solid white background, not cut-out transparent images. On the reference site
that is invisible because its cards are white. Certify.cx has a dark theme,
where a bare white-backed image would sit on the card as a hard white rectangle.
So each logo is placed on a deliberate white plate with a little padding — on
the light theme you cannot tell, and on the dark theme it reads as an intentional
logo plate. You can see both in the preview.

### One thing I still owe you as a straight answer

Six of the eight are **third-party trademarks** — AICPA, PCI SSC, HITRUST
Alliance, HHS and the EU own their marks. Several of them may only be displayed
by a firm the owning body has **licensed or accredited**. Displaying the AICPA
SOC seal, for instance, reads as a claim that AICPA has authorised Certify.cx to
perform SOC examinations.

I have used them because you asked for them directly, and it is your call to
make, not mine. But I would not be doing my job if I did not say it once,
plainly: **if Certify.cx does not hold those accreditations, this is the kind of
thing that surfaces when a large client's legal team reviews the site.** Worth a
five-minute check with whoever handles your legal side. If any need to come off,
tell me which and it is a one-line change per logo — the file records who owns
each mark so it is easy to audit.

---

## Two things I need you to decide

**1. What happens when someone clicks a Compliance Audit card?**

Right now: nothing. The cards display, and that is all. That is on purpose — I
had nowhere truthful to send a click:

- There is **no price** for any of the eight. Certify.cx prices are per ISO
  standard ($999 or $1,999); nothing in the system prices a SOC examination or a
  penetration test.
- There is **no detail page**, the way each ISO standard has `/iso/iso-9001`.
- There is **no enquiry or contact page** anywhere on the site to send them to.

I deliberately did **not** add these eight to the ISO catalogue, even though it
would have been quicker. Doing so would have pushed them into the checkout
picker, the client application form and the auditor's standards list — meaning a
buyer could pay $1,999 for "Penetration Testing" through the normal ISO checkout
and we would have no defined way to deliver it. That is a much more expensive
problem than a card that does not click.

So: **where should these cards lead?** The realistic options:

- **A "Request a quote" enquiry form** — name, company, email, which service,
  and it lands in the admin dashboard. My recommendation, and roughly a day.
- **A "Schedule a call" link** to whatever calendar you use — fastest, an hour.
- **A price and a real checkout for each** — the biggest piece of work, and it
  needs you to set prices and decide who delivers the audits.
- **Leave them as information only** — perfectly fine if the intent is simply to
  show visitors the full range.

**2. Should they appear anywhere else?** They are on the home page and the
certifications page. They are **not** in the checkout, the client dashboard, or
the gap analysis. Say the word if you want them in any of those.

---

## Languages

All eight titles, all eight descriptions and the section heading are translated
into **all nine languages** the site supports — English, Spanish, Arabic, German,
French, Hindi, Portuguese, Russian and Chinese — so nothing falls back to
English. Framework names (SOC, GDPR, PCI DSS, CCPA, CPRA, HITRUST, HIPAA,
HITECH, SOX, ITGC) stay in their original form in every language, which is how
they are written in each of those markets. Arabic right-to-left layout is
handled by the existing page structure; the new section uses the same containers
as the ISO section above it, so it inherits that behaviour rather than
re-implementing it.

---

## Files changed

| File | Change |
|---|---|
| `src/utils/complianceAudits.js` | **New** — the eight services, their logos and their text keys |
| `src/assets/compliance/*.jpg` (8 files) | **New** — the eight framework logos, ~57 KB in total |
| `src/components/ui/ComplianceLogo.jsx` + `.css` | **New** — renders each logo on its white plate |
| `src/pages/landing/LandingPage.jsx` | The new section below the ISO standards, plus the footer link |
| `src/pages/landing/LandingPage.css` | Styling for the new section and badges |
| `src/pages/public/Certifications.jsx` | The same eight below the ISO grid |
| `src/pages/public/Certifications.css` | Styling to match |
| `src/i18n/locales/*.json` (9 files) | 19 new strings, in all nine languages |

**Nothing was removed or rewritten.** The change is 336 added lines and zero
deleted ones across the tracked files — the ISO standards, prices, checkout,
referral flow and login are all byte-for-byte as they were this morning.

---

## Verification

Checked here:

- All nine language files still parse, and each carries all 19 new strings **in
  its own language** — spot-checked one title and one description per language,
  no English left where a translation should be.
- The existing strings in those files were not touched: the new block is
  appended, so every other key keeps its exact position.
- The four changed and new code files are structurally intact (bracket balance
  verified).
- No unused imports left behind in either page.
- All eight logo files are present in the project and each one is actually used
  by a card — no broken image, no orphan file.
- Each logo is set to scale inside its plate rather than being cropped, which
  matters because the eight differ in shape (HIPAA and SOX are wide, GDPR and
  the AICPA seal are square).

**Not checked here, and I want to be straight about it:** this machine has no
Node.js installed, so I cannot run the build or open the site. The checks above
are static. What still needs your eyes on the live site after deploy:

1. Open `certify.cx` and scroll past the ISO standards — the **Compliance
   Audits** heading and eight cards should be there.
2. Open `certify.cx/certifications` — same eight below the ISO grid.
3. Switch the language to Arabic and glance at the new section — it should read
   right to left like the rest of the page.

The badge preview file sent with this report already shows you exactly how the
eight logos look, so that part needs no deploy to review.

---

## Still open from earlier

Not from today, and none of it is affected by this change — listing it so
nothing gets lost:

- **`supabase/phase31_checkout_org_size.sql`** from 16 Aug, if you have not run
  it yet. Thirty seconds, changes nothing on most databases, but it is the
  insurance against the checkout failing in front of a buyer.
- **A decision on the two pricing tables** — the landing-page calculator and the
  checkout still quote different surcharges for the same company size (a
  60-employee firm is quoted +$1,000 and charged +$200).
- **Whether registration should be split onto its own step** before payment.
- **The 27 missing `certBody.*` strings** in German, French, Hindi, Portuguese,
  Russian and Chinese — those screens fall back to English. Nothing is broken.
- **The migration-tracking table**, so a deploy can say "the database is behind"
  instead of failing silently.
