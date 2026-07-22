# Task Report — 22 July 2026

Covers the **22 July** task list (payment status control, sales figures, auditor registration, invoices & receipts, branding). Every item was checked against the actual code before being marked below.

**Summary: 7 of 8 stated items done. 1 item on your list was left blank. 1 item is done as far as the platform allows — please read point 1.**

> ⚠️ **READ THIS FIRST — nothing from today is live yet, and one database step is still outstanding.**
>
> Today's work is complete in the code but has **not been deployed**, and the database migration behind the auditor changes (`phase24`) has **not been run**.
>
> Until that migration is run, the new auditor fields cannot save. Please tell us whether you want us to run it or whether you will run it yourself.

---

# ✅ DONE

## 1 — Payment Status field on the application screen

The Workflow Controls panel now has a **Payment Received** dropdown, with exactly the options you listed:

- Unpaid
- Paid — Credit / Debit Card
- Paid — Cash
- Paid — Bank Transfer

Two further options appear — *Awaiting verification* and *Pending* — because the checkout genuinely puts orders into those states. They are shown so that saving an unrelated change on such an order does not quietly rewrite its payment state behind your back.

Setting an order to any **Paid** option does the full job, not just the label: the buyer's account is approved, their discount coupon is recorded as used, and they are emailed their access link. That is the same thing the Verify Payment button does, so a cash sale marked paid can never leave the buyer locked out.

**On "linking with the Payment Gateway so that it could be reflected automatically":**

Card payments **already reflect automatically** — when a card payment succeeds, the order is marked *Paid — Credit / Debit Card* by itself. That covers the case in your note.

What we could **not** add is the bank-grade version of this, where Stripe notifies the platform directly (a "webhook"). Our current hosting plan allows a fixed number of server functions and we are exactly at that limit; adding one more breaks the deployment. The practical difference is small: it only matters if a buyer's browser closes at the exact moment payment completes. If you want that gap closed as well, it needs a hosting-plan upgrade — please confirm and we will quote it.

## 2 — Sales and Main Dashboard showing $0

Fixed, and the cause is worth stating plainly: **the platform was reading revenue from a table that nothing ever wrote to.** The Sales page and the Main Dashboard were both looking in an empty drawer, so they could only ever show $0 — no matter how many real sales existed.

Both screens now read the actual orders and invoices. The Sparck sale now appears.

Two related problems were fixed at the same time:

- The Sales page only ever loaded the first 100 orders. Beyond that, revenue would have silently under-reported. That cap is gone.
- A regional administrator whose region was not set would previously have seen **every** region's revenue. They now see nothing rather than everything.

## 3 — Auditor registration (self-registration and administrator-created)

The four-field form has been replaced. Both the administrator's **Add Auditor** screen and the auditor's own sign-up now collect:

1. **Country dialling code + mobile number** — the code is a searchable dropdown, so the auditor picks their country and types the number.
2. **Standards** — a multi-select list. An auditor certified to several standards can select all of them.
3. **Level of certificate** — a multi-select list with your four values: Internal Auditor, Lead Auditor, Trainer, Lead Implementer. **Standards and Level are placed side by side**, as you asked.
4. **Uploads** — certificates and audit log, multiple files each.
5. **Sectors of specialisation** — the full **39 IAF codes**, multi-select, searchable by industry name as well as by number.
6. **Profile picture.**
7. **Show/hide button on the password field.**

One thing found while doing this, which explains a problem you may have already noticed: **the storage area for auditor documents had never been created.** Certificate uploads were failing silently — the auditor saw no error and the file simply never arrived. That storage area is created by the `phase24` migration mentioned at the top of this report.

## 4 — The auditors list should display these fields

The Auditors table now shows standards, level and specialisation sectors for each auditor, with their documents reachable from the row.

## 5 — Super Administrator access to Invoices & Receipts

There is a new **Billing** screen for administrators, with two tabs: **Invoices** and **Receipts**. From it you can see every document issued and prepare and issue new ones to a client.

**Sending by email is off by default.** You prepare the document, look at it, and only then decide to send. This is deliberate — issuing a document and emailing a real client are two different decisions and should not be one button.

Regional administrators see only their own region's documents.

## 6 — The browser tab icon

The tab was showing an older green shield that is no longer your mark. It has been replaced with the logo you supplied. The same image is now also used when a link to the site is shared on WhatsApp, LinkedIn or any social platform, where previously no image appeared at all.

## 7 — "The logo is to be used throughout — invoices, receipts, emails and any other communication"

The logo now appears on:

- **Invoice PDFs** and **receipt PDFs** (in the header),
- **all transactional emails** — verification, welcome, access links, notifications,
- the **browser tab** and **link previews**, as above.

The email templates previously drew an approximation of the shield in code, which rendered differently in different email clients. They now use the real image.

**One point for your decision:** inside the application itself, the logo is currently forced to plain black (or white on dark backgrounds) by a styling rule that predates today. Everywhere else it is now the correct teal. We recommend making the in-app logo teal as well so it matches, but this changes the look of every screen, so **we have not done it without your say-so.** One word from you and it is done.

---

# ❓ NEEDS YOUR CLARIFICATION

## Item 10 on your list

Your list ended with a numbered point **10** that had no text against it. We asked at the time and did not get an answer. Please tell us what it was and we will pick it up.

---

# 🔒 Security issues found and fixed (not on your list)

Three endpoints that change accounts had **no security check at all**. They were live. In plain terms, anyone on the internet who knew the address could have:

- **made themselves a Super Administrator**,
- **changed any user's email address** — which then allows a password reset to that address, i.e. taking over the account, and
- **rewritten the entire Roles & Permissions matrix.**

All three now verify the signed-in user, and the caller's identity is taken from their session rather than from the request. A related flaw in the auditor document upload — where a crafted request could write a file into another auditor's folder — was closed at the same time.

We have flagged **further issues of the same kind elsewhere in the platform** and have deliberately not touched them, because you asked us to stay on the task list. They are written up separately. Please tell us when you want them addressed — our recommendation is soon.

---

# Before this goes live

1. **Run the `phase24` database migration.** Without it the auditor fields cannot save and document uploads keep failing. Tell us if you want us to run it.
2. **Deploy the code.** Nothing from today is on the live site yet.

# Technical status

- `npm run build` passes.
- The files changed today are lint-clean; the few pre-existing errors elsewhere were verified as already present before this work.
- All new text is translated into all nine supported languages (English, Spanish, Arabic, German, French, Hindi, Portuguese, Russian, Chinese) — every key was verified present in every language by scanning the source rather than by trusting the translation files.
- The payment control was reviewed by a separate check against the certification lifecycle rules. It found three faults in the new code, all of which were fixed today: an order could be cleared to a blank payment state, which would have **shown an unpaid client their assigned Certification Body**; moving an order back and forth between paid and unpaid could have **used a client's coupon twice** and sent a second access email; and marking a bank-transfer order "awaiting verification" **erased the record that it was a bank transfer**, so it would later have been reported as a card sale.
- **Not committed, not deployed.**

---

# Still outstanding from 19–21 July

- **WCA GLOBAL's US$75 commission on the Sparck sale has still not been credited.** It needs one database lookup to complete; we have asked several times and have not had it back.
- Sparck's invoice and receipt are still **held back from the client** pending your review, as agreed.
- The pricing-model question (one US$999 fee covering 3 years, versus your invoice's "1 Year Initial" plus US$150/year) is still unanswered and affects what Sparck is billed next year.
- The consultancy contract draft is still **awaiting legal review** before any partner signs it.
- Whether the 3-month inactivity rule should **automatically** deactivate a consultancy partner, or keep only flagging them, is still unconfirmed.
