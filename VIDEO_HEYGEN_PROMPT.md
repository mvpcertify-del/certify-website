# HeyGen Video Agent — Master Prompt (v3)

## Before you paste anything

**Attach these 8 files** via the **+ Attachments** button. Without them the agent invents generic stock footage — which is exactly why v1 was rejected.

Folder: `C:\Users\my\Desktop\certify-video-assets\`

| File | What it is |
|---|---|
| `00-logo.png` | Certify.cx logo mark |
| `01-landing-hero.jpg` | Landing page hero |
| `02-how-it-works-4-steps.jpg` | The 4-step process |
| `03-iso-standards-grid.jpg` | ISO standards grid |
| `04-dashboard-stats.jpg` | Dashboard statistics |
| `05-cb-registry.jpg` | Certification body registry |
| `06-checkout-999.jpg` | Checkout / pricing |
| `07-main-dashboard.jpg` | Main dashboard |

Also set **+ Brand System** → logo `00-logo.png`, primary `#3ECF8E`, background `#171717`, font **Inter**.

---

## The prompt — paste everything inside the box

```
Create a 60-second corporate introductory video for Certify.cx, an online ISO
certification platform. This is a B2B SaaS product explainer in the style of a
polished software product-launch video — motion graphics, animated on-screen
text, and real product screenshots. It is NOT a talking-head video.

=== NON-NEGOTIABLE BRAND RULES ===

Background: #171717 (near-black). The video must be DARK throughout. Never use
a white or light background.
Accent colour: #3ECF8E (bright mint green). Use it for highlights, underlines,
icons, checkmarks and key words.
Card / panel colour: #242424.
Body text: #EDEDED. Secondary text: #A0A0A0.
Font: Inter. Headlines Inter Bold, body Inter Regular. No serif fonts, no
decorative fonts.

These are the exact colours and font of the live Certify.cx product. The video
must look like it came from the same design system as the attached screenshots.

=== AVATAR RULE — CRITICAL ===

The avatar appears in ONE scene only (Scene 2), for a maximum of 10 seconds,
positioned at the right side of the frame at roughly one third of the frame
width. In every other scene there is NO avatar on screen — only voiceover,
product screenshots and animated text. Do not place the avatar full-screen at
any point.

=== HOW TO USE THE ATTACHED FILES ===

00-logo.png  -> the Certify.cx logo. Large and centred in Scene 1 and Scene 7,
                and small in the top-left corner of Scenes 3 to 6.
01-landing-hero.jpg, 02-how-it-works-4-steps.jpg, 03-iso-standards-grid.jpg,
04-dashboard-stats.jpg, 05-cb-registry.jpg, 06-checkout-999.jpg,
07-main-dashboard.jpg
             -> these are real screenshots of the Certify.cx product. Use them
                as the visuals in Scenes 3 and 4. Animate them with slow zoom
                and gentle slide movement so they feel alive. Do not replace
                them with stock footage or invented user interfaces.

Do not use generic stock video of offices, handshakes, people at laptops, or
abstract technology loops. Every visual is either the product, animated text,
icons, or the logo.

=== SCENES ===

SCENE 1 — 0:00 to 0:05 — BRAND OPENING
No voiceover. Solid #171717. The logo large and centred. Beneath it the
wordmark "Certify.cx" in Inter Bold #EDEDED, and under that in #A0A0A0:
"ISO Certification. Simplified." A thin #3ECF8E line draws itself under the
wordmark. Calm, confident, no motion clutter.

SCENE 2 — 0:05 to 0:15 — THE PROBLEM (the only avatar scene)
Voiceover: "ISO certification should be straightforward. Instead it means
months of emails, quotes that never arrive, consultants you can't reach — and
no idea where your file actually is."
Visual: dark frame. Avatar on the right third. On the left, three lines of
text appear one at a time in dull grey and are struck through as they appear:
"Months of waiting", "Unclear costs", "No visibility".
The avatar exits at the end of this scene and never returns.

SCENE 3 — 0:15 to 0:22 — THE ANSWER
Voiceover: "Certify.cx puts the entire process on one platform."
Visual: the grey problem text collapses away. The screenshot
07-main-dashboard.jpg scales up into frame with a slow push-in. The logo
appears small in the top-left corner and stays there for the rest of the
video. Large text in #3ECF8E: "ONE PLATFORM".

SCENE 4 — 0:22 to 0:39 — THE PLATFORM
Voiceover: "Apply online in minutes. Get matched with an accredited
certification body. Upload your documents. And track every step, in real time,
in your language — right up to your certificate."
Visual: cut between the real screenshots in this order, roughly three seconds
each, each with a slow zoom:
  06-checkout-999.jpg        with the label "Apply"
  05-cb-registry.jpg         with the label "Matched"
  02-how-it-works-4-steps.jpg with the label "Upload"
  04-dashboard-stats.jpg     with the label "Track"
  01-landing-hero.jpg        with the label "Certified"
Labels in #3ECF8E, Inter Semibold, lower-left of frame.

SCENE 5 — 0:39 to 0:47 — INDUSTRIES
Voiceover: "Manufacturing, construction, services, medical, hospitality,
education, exporters, farming. Every sector. Every size."
Visual: eight #242424 cards with thin #3ECF8E outlines appear in a grid on the
dark background, each holding a simple line icon for its sector, landing in
time with the words. The scene ends on large centred text:
"Every sector. Every size."

SCENE 6 — 0:47 to 0:55 — WHO IT IS FOR
Voiceover: "Clients certify faster. Referral partners and consultancies earn
commission. Auditors and certification bodies get verified work — all in one
place."
Visual: five #242424 cards slide in across the dark frame, each lighting up in
#3ECF8E as it is named: CLIENTS, REFERRALS, CONSULTANCIES, AUDITORS,
CERTIFICATION BODIES.

SCENE 7 — 0:55 to 1:00 — BRAND CLOSING
Voiceover: "Certify.cx. Certification, made clear. Start free at certify dot
c x."
Visual: back to solid #171717. The logo large and centred, with "certify.cx"
beneath it in #3ECF8E. Hold this frame completely still for the final two
seconds.

=== OUTPUT SETTINGS ===

Aspect ratio 16:9 landscape. Total length 60 seconds maximum.
One professional English voice throughout, natural pace, confident and calm —
not an excited advertising read.
Burned-in subtitles in Inter, positioned low, white on a subtle dark bar.
Background music: minimal ambient corporate, low volume, no heavy beat.
Transitions: clean cuts and soft fades only. No spins, no flashy wipes, no
lens flares.
```

---

## After it generates — check these before sending to the client

- [ ] Logo large and readable in the **first 5 seconds**
- [ ] Logo large and readable in the **last 5 seconds**
- [ ] Avatar appears **once**, **10 seconds or less**
- [ ] Background is **dark**, never white
- [ ] Green is **#3ECF8E**, not blue or teal
- [ ] The **real screenshots** appear — not stock footage
- [ ] The **problem** is stated before any feature
- [ ] **60 seconds or under**
- [ ] **No real client data** anywhere on screen

If the agent ignores an instruction, do not regenerate from scratch — reply to
it in the chat with the single correction, e.g. *"Remove the avatar from Scene
4"* or *"Scene 5 background must be #171717, not white."* The agent edits the
existing video, which is faster and keeps everything else intact.

---

*v3 — 22 July 2026. Built for the HeyGen Video Agent with real product screenshots attached.*
