# Task Report — 25 July 2026

Covers everything worked on today: the referral-partner invite email, the "Payment Received" status, and the three UI/permission changes you sent this afternoon. Each item was checked against the live site and the actual code.

**Summary: 6 items delivered. Some need a database migration and a domain step before they work — listed at the end. Three security items from yesterday are still open and need your decision.**

---

# ✅ DELIVERED TODAY

## 1 — Referral partners can email their clients directly *(your feature request)*

A referral partner can now send a ready-made invitation email to any client they have added, straight from their dashboard.

The email contains:
- their **registration link** (with the discount pre-applied),
- their **unique discount code** in a highlighted box,
- an optional **company profile** link (PDF or video — see the note below), and
- the partner's own **email signature**.

**How it appears to the client:** the email is sent through **mail.certify.cx** so it is properly authenticated and stays out of spam, but the **reply goes straight to the partner**. The client sees the partner's name and signature and can just hit reply to reach them.

**On the dashboard:** each client row has a **Send Invite** button (it becomes "Resend" after the first send), and there is an **Edit Signature** button at the top where the partner writes their sign-off once.

**Safeguards built in**, because these emails go out over the shared Certify.cx domain and one partner sending spam would hurt everyone's deliverability:
- only an **approved** partner can send;
- a partner can only email **their own** added clients;
- **20 invites per day** per partner, and **at most 3** to any one client, ever.

The whole feature was put through an independent adversarial security review, which found a serious issue — the original design saved the signature by writing to the profile directly from the browser, which (because of how database permissions work) could have let a partner change their own account role. That was rewritten to go through the server, which only ever touches the signature. Every other finding was fixed too.

## 2 — "Payment Received" status *(WhatsApp, 24 Jul)*

The application **Application Status** dropdown now has **Payment Received**, sitting right after **Awaiting Payment** — the stage between "waiting for the money" and "the audit work has begun". It shows as a green badge everywhere an application status appears, and it slots into the client's own progress tracker.

This is separate from the **Payment Status** field below it: that one records *how* they paid (card / cash / bank); this one records *where the order has reached*.

## 3 — "Companies" page renamed to "Clients" *(your item 1)*

The page that listed **Companies** is now **Clients** — in the menu, the page title, and the "N clients found" line. Nothing about the data changed, only the name, as you asked.

## 4 — "Add Referral" is now "Add Client", with two new fields *(your item 2)*

On the referral partner's dashboard:
- the **Add Referral** button and form are now **Add Client**;
- a **WhatsApp Number** field was added, so the partner can record the referred client's WhatsApp;
- a **Company Website** field was added.

Both new fields are optional and are saved against the referred client.

## 5 — The four action icons on User Management *(your item 3)*

The screenshot you sent was a **Country Admin** account, which previously saw only View and an "Edit Role" text link on the Users page. It now has the full set of four action icons — **View, Edit, Deactivate, Delete** — the same as the Clients page.

**One important point, because this is a permissions change and you chose how it should work:** a Country Admin can now manage **only the users in their own country**, and **only ordinary users** — never another Country Admin, never a Super Admin, and never their own account. A Super Admin continues to manage everyone. This is enforced on the server, not just hidden in the screen, so it cannot be worked around from the browser. The rule was verified against nine different cases before shipping.

---

# ⚠️ BEFORE THESE WORK — three steps

Today's work depends on database changes and one email-domain step. **Order matters: run the migrations first, then deploy the code.** We verified that if the code goes live before the migrations, the affected features fail cleanly rather than corrupting anything — but they will not work.

1. **Run three database migrations** (`phase27`, `phase28`, and `phase26` if not already run):
   - `phase27` — the partner email signature + the invite send-log (needed for the invite email).
   - `phase28` — the WhatsApp and Website fields on a referred client (needed for **Add Client**; without it, adding a client will fail).
   - `phase26` — a hardening fix for the referral-code system from yesterday.

2. **Set up mail.certify.cx in the email provider (Resend).** This is a one-time DNS verification (SPF/DKIM). Until it is done, the partner invite emails will land in spam or bounce. This needs the domain owner — we cannot do it for you.

3. **Company profile PDF / video link.** The invite email has a place for this, but it is empty until you provide the file or link. Send it whenever ready — no code change is needed to switch it on.

---

# ❓ STILL NEEDS YOUR DECISION — three security holes from yesterday

We flagged these on 24 July and, as instructed, have not touched them since they were not on your list. They are pre-existing, but two became more exploitable once yesterday's referral migrations went live (the payout button that used to fail now works):

1. **Anyone can register themselves as a referral partner and then create fake commission entries** that land in your payout queue looking real. ~1 hour to close.
2. **An older payment route awards commission before any money is taken**, and can be triggered without signing in. ~1 hour.
3. **Every signed-in user can read every discount coupon** in the system. ~15 minutes.

A fourth was surfaced by today's review and should be checked at the same time:

4. **The database rule that governs who can edit a profile is not in our code — it lives only in the live database.** If it is the common "you can edit your own row" rule with no column limit, a user could set their own role to Super Admin from the browser. We closed the one path today's feature opened, but the underlying rule must be verified. Please run this in Supabase and send us the result:
   ```sql
   SELECT policyname, cmd, qual, with_check
   FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE';
   ```

**Our recommendation: let us close all four now.** Roughly half a day. Say the word.

---

# Technical status

- `npm run build` passes.
- All serverless functions verified to load under the production engine, and the API is still within the 12-function hosting limit (the invite feature was folded into an existing route, no new function added).
- Files changed today are lint-clean; two pre-existing warnings in the Users page were confirmed present before this work and left alone.
- All new text is translated into all nine languages — 135 keys verified present across every locale.
- The new permission rule and the invite safeguards were tested directly against their edge cases (wrong region, admin targets, self, rate limits, malformed input) before shipping.
- The invite email feature was reviewed adversarially; the one serious finding and all minor ones were fixed.
- **Committed and pushed on your instruction earlier today; the items above marked "before these work" still need the migrations + domain step.**

---

# Still outstanding from earlier

- **WCA GLOBAL's US$75 commission** on the Sparck sale — still not credited.
- **Sparck's invoice and receipt** — still held from the client pending your review.
- **Pricing model** — one US$999 fee covering 3 years, versus "1 Year Initial" plus US$150/year. Still unanswered; also blocks the promotional video script.
- **Self-registration vs admin approval** — you asked for self-service, but a paid card client still waits for approval, which is what you asked for previously. Please confirm which you want.
- **Consultancy contract** — still awaiting legal review before any partner signs.
- **Item 10 of your 22 July list** was left blank. Still unanswered.
