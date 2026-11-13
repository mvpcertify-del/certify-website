# Marketing emails: schools and universities (3-step sequence)

Requested by the client (boss), 13 Nov 2026. Text taken from "Certify.cx Marketing Emails-13.11.26.docx"
(the revised follow-ups that carry the scheduling link).

| File | Email | When | Unsubscribe link |
|---|---|---|---|
| `01-introduction.html` | 1. Introduction | Day 0 | No |
| `02-follow-up-day-4.html` | 2. Follow-up | Day 4, same thread | Yes |
| `03-final-follow-up-day-9.html` | 3. Final follow-up | Day 9, same thread | Yes |

Each file is one complete HTML email, laid out like a large brand's newsletter: banner image on top, body copy,
icon highlights, a call-to-action button, a signature block, and a dark-green footer with logo, social icons and
legal links. CSS is inline (what email apps actually honour) plus an embedded `<style>` block for the phone
layout. A separate `.css` file is not used because Gmail and Outlook ignore linked stylesheets.

## Images

The banner, icons, white logo and social icons are PNG files in `public/email/`, so they are served from
`https://certify.cx/email/<file>.png` once deployed. Emails reference those absolute URLs, so the images only
show after `public/email/` is live. They are drawn by `marketing-emails/build-assets.mjs` (run
`node marketing-emails/build-assets.mjs` to rebuild; change the banner wording at the top of that file).
Every image has alt text and a dark-green fallback colour, because many apps block images until the reader
allows them.

## Placeholders (filled per recipient by the sending tool)

| Placeholder | Meaning |
|---|---|
| `{{recipient_name}}` | Greeting name, e.g. "Dr. Hassan" or "Quality Assurance Team" |
| `{{institution_name}}` | School or university |
| `{{calendly_url}}` | The client's Calendly link. Shown as words ("Book a 15-minute call"), never as the raw address |
| `{{website_url}}`, `{{sender_email}}`, `{{phone}}` | Signature line |
| `{{unsubscribe_url}}` | Emails 2 and 3 only; must be a working one-click opt-out |

The Calendly link, the website, the sender address and the phone number were not given, so they are left as
placeholders. Nothing was invented.

## Sending rules (from the client's brief)

- Email 2 goes out **4 days** after Email 1, Email 3 **9 days** after Email 1, e.g. Monday, Thursday, the
  Tuesday of the following week.
- Every send happens in the **recipient's local business hours** (Egypt: Egypt time), on the right day.
- Stop the sequence for anyone who replies, books, or unsubscribes.
- The sending tool, schedule and unsubscribe handling are **not built yet**; these are the templates only.

## Notes for whoever builds the sender

- The brief puts the unsubscribe link on emails 2 and 3. The client's own compliance notes (CAN-SPAM, GDPR)
  recommend an opt-out line in every automated email; adding it to Email 1 is a one-line change.
- Send cold outreach from a separate domain with SPF, DKIM and DMARC set up, to protect certify.cx.

## Footer

The footer carries "Operated by Certify International OPC Private Limited" and the founder's WhatsApp number in small
letters. Company address and other legal details are deliberately not in the emails; the client will publish
them on the platform's Contact us page.
