# Task Report — 13 July 2026

**Focus:** Two client requests — (A) simplify the Gap Analysis → certification journey and add a consultation popup, and (B) replace the 3-tier packages with one single price.

Both are complete, build passes, and were reviewed by security + certification-lifecycle + i18n checks.

**Desktop + Mobile preview (for review):** https://claude.ai/code/artifact/0c734c06-b66a-43b3-9d79-ad4b6313b53e

---

## Batch A — Gap Analysis journey + Consultation popup

### What the client asked
- "Book a Consultation" should **not** be on the landing page — it should be a **popup after the Gap Analysis test**.
- After the test, also give the client an option to **proceed to certification and pick a standard**, landing on a page where **all certifications are displayed** (and they can choose one or more).

### What was built
| Request | Status |
|---|---|
| Keep "Book a Consultation" off the landing page | ✅ It was never on the landing page — confirmed it stays off. It now lives only as the post-test popup. |
| Consultation popup after the Gap Analysis test | ✅ On finishing the free test, a **"Book a Consultation" popup** opens automatically (name, email, phone, company, preferred time, message). It can also be reopened from a button. |
| "Proceed to Certification" option after the test | ✅ A primary **"Proceed to Certification"** button now sits on the results, opening the new certifications page. |
| A page showing all certifications to choose from | ✅ New **/certifications** page lists every ISO standard as a selectable card → each opens its details/pricing page. |

- The old behaviour (the gap-analysis results showed the pricing cards directly) was replaced by the two clear actions above.
- Consultation requests are emailed to the admin team (and shown as an in-app alert) so they can follow up. No public spam risk — the request only ever reaches your own admins, never an arbitrary address.

---

## Batch B — One single price package

### What the client asked
1. All certifications = **1 standard price package**, not 3 price options.
2. **Remove the 12-month payment/upgrade option** for all certifications.
3. **Remove the "Silver" wording** from the certificate.

### What was built
- ✅ The Bronze / Silver / Gold cards are gone. Every standard now shows **one "Standard" package** at a single price.
- ✅ The **12-month "online support" and "internal audit" upgrades were removed** (those were the Silver/Gold add-ons).
- ✅ **"Silver" (and Bronze/Gold) wording removed** everywhere the client sees it — pricing cards, checkout summary, payment page, and the admin package dropdown (now just "Standard").
- Prices shown (organization up to 10 employees, 1 location): **ISO 9001 / 14001 / 45001 → $799**, all other standards → **$999**. Larger organizations are still handled by surcharges after purchase.

Old orders that were saved as "Bronze/Silver/Gold" still work and are charged the single price. (Optional: we can relabel those old records to "Standard" — this is a one-time database update and needs your go-ahead.)

---

## Batch C — The two ChatGPT recommendations (also done)

The client's ChatGPT chats contained two extra ideas beyond the written instructions. Both are now implemented.

**1. Homepage call-to-action hierarchy (from ChatGPT chat 1).**
ChatGPT recommended: make "Get Certified Now" the big primary button and "Free Gap Analysis" a smaller secondary one (and keep "Book a Consultation" off as a minor action).
- ✅ The landing hero now shows **"Get Certified Now"** (primary) → opens the certifications list, and **"Free Gap Analysis"** (secondary) → the free test.
- Sign Up / Log In remain in the top navigation bar. "Book a Consultation" stays off the landing page (it's the post–gap-analysis popup).

**2. Discount code in checkout (from ChatGPT chat 2).**
ChatGPT recommended a collapsed "Have a discount code?" field before payment, with the discount shown as a line item and the total updating live.
- ✅ The public checkout order summary now has a **collapsed "Have a discount code?"** field → **Apply** → the code is validated, shown as a **−discount line item**, and the **Total updates instantly**.
- Works for card and cash/bank. The discount is re-checked on our server at payment time, so a code can't be faked.

---

## Batch D — Landing navbar UI fix

The top navigation bar's "Start Your Free Gap Analysis" button looked off (wrong colour, oversized).
- ✅ **Colour fixed:** the button was **blue**, clashing with the green brand — it's now an on-brand **green outline** button, matching the hero's "Free Gap Analysis" and sitting as a clear secondary next to the green "Get Certified Now".
- ✅ **Size fixed:** shortened the label to **"Free Gap Analysis"** (it was the long "Start Your Free Gap Analysis", which made the button too wide) and matched its width/height/padding to the other header buttons so the whole bar lines up.
- ✅ **Navbar polish:** all header buttons (Log In / Sign Up / Gap Analysis) now share the same height, and the menu links are separated a little from the language/account/CTA cluster for a cleaner look.

---

## Notes / still needed from client
- **Multi-certification cart:** the client mentioned "select one **or more**." Today a client picks certifications **one at a time** (choose → pay → can come back for another). A true multi-select cart (pay for several at once) is a larger feature — tell us if you want that built next.
- **Bank/cash details** are still placeholders from the previous round (unchanged) — needed to make Cash / Bank Transfer live. Card works already.
- **Consultation follow-up:** consultation requests currently alert the admin team by email + in-app. If you'd prefer them stored in a list/CRM or auto-booked into a calendar, we can add that.

---

## Technical status
- `npm run build` passes. API files syntax-checked.
- Reviewed by three internal passes:
  - **Security:** two issues found and **fixed** — user text is now HTML-escaped in admin alert emails, and the public consultation form has a flood guard.
  - **Certification lifecycle & payment-gating:** intact, no regressions.
  - **Translations:** English, Spanish, and Arabic fully translated for all new text; other languages fall back to English (translations pending).
- **Not committed/deployed yet** — awaiting your go-ahead.
