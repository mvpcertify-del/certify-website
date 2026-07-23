# Certify.cx — 60-Second Video · VERSION 2 (rebuilt after client feedback)

Version 1 was rejected. This document replaces it. Read the feedback decode first — v2 is built around it, not around the old script.

---

# 1. What the client actually said, decoded

| Client's words | What it means in production terms |
|---|---|
| *"I already sent you a video theme you could do similar"* + [Membrain SaaS explainer](https://youtu.be/2yL0LhyxOGk) | The reference is a **SaaS product explainer**: motion graphics, product screens animating, kinetic text, voiceover. **Not a talking-head video.** |
| *"Certify.cx Logo & name is not displayed clearly"* | Logo must be large and readable, not a corner watermark. |
| *"The Name & Logo should be displayed in the opening slide & before the end"* | Two dedicated full-screen brand slides: **Scene 1** and **final scene**. Non-negotiable. |
| *"Follow the colour & fonts of Certify.cx to be similar to the Platform"* | Exact platform values below. The video must look like the product. |
| *"I do not want the Girl Avatar to show for a long time"* | Avatar appears **once, ~6 seconds**, in one scene only. Every other scene is product + graphics. |
| *"Focus on what Certify.cx solves — a problem"* | The problem gets its own scene, up front, before any feature is mentioned. |
| *"Display the Certify.cx Platform briefly so viewers will be familiar with it"* | **Real screen recordings of the live product.** This is the single biggest missing asset. |

---

# 2. Brand specification — take these EXACT values

Pulled from `src/index.css`, the platform's own design system. Do not substitute.

| Item | Value | Where it came from |
|---|---|---|
| **Background** | `#171717` | `--color-bg-primary` |
| **Surface / cards** | `#242424` | `--color-bg-surface` |
| **Accent (the green)** | `#3ECF8E` | `--color-accent` |
| **Accent hover / darker** | `#2EB87A` | `--color-accent-hover` |
| **Primary text** | `#EDEDED` | `--color-text-primary` |
| **Secondary text** | `#A0A0A0` | `--color-text-secondary` |
| **Border** | `#333333` | `--color-border` |
| **Font** | **Inter** — weights 400 / 500 / 600 / 700 | `--font-family` |
| **Logo file** | `public/brand-mark.png` | — |

> ⚠️ **Correction to earlier guidance.** I previously said the brand colour was `#0e9f6e`. That is the darker green used only in **PDF invoices and emails**, where a light background needs more contrast. **The platform itself is `#3ECF8E` on a dark `#171717` background.** The client asked for the video to match *the Platform*, so `#3ECF8E` on dark is correct.

**The video is DARK, not white.** The platform is a dark-theme product. A white video will not look like Certify.cx, and that is exactly what the client objected to.

---

# 3. The missing asset — screen recordings

The video cannot be made without these. HeyGen has no footage of your product; the last video used generic stock, which is why it looked like nothing to do with Certify.cx.

**Record these six clips.** Each 4–6 seconds, no cursor hunting, one smooth motion per clip.

| # | Clip | What to show |
|---|---|---|
| 1 | **Landing page** | Scroll down slowly, then click **Get Started** |
| 2 | **Application form** | Standard selection + a few fields filling in |
| 3 | **Certification body matched** | The assigned CB appearing on the application |
| 4 | **Document upload** | Dragging a file in, upload completing |
| 5 | **Status tracker** | The lifecycle moving forward — pending → audit scheduled → approved |
| 6 | **Dashboard overview** | The main dashboard with real-looking figures |

**Recording settings**
- Resolution **1920×1080**, browser at **110% zoom**
- **Hide the bookmarks bar and all extensions** — a clean window
- Dark theme ON (the product default)
- Move the mouse **slowly and deliberately**; no jitter
- Windows: `Win + Alt + R` (Game Bar), or use OBS / ScreenPal

> 🔒 **Use demo data only.** No real client names, no Sparck data, no real email addresses on screen. This video goes on TikTok and LinkedIn — anything visible is public forever. Use the seeded test accounts.

---

# 4. The storyboard — 7 scenes, 60 seconds

**Total voiceover: 112 words ≈ 48 seconds spoken.** The remaining ~12 seconds are the brand slides and breathing room. Do not add more words.

### Scene 1 — 0:00–0:05 · BRAND OPENING SLIDE
- **Voiceover:** *(silence — let the logo land)*
- **Visual:** Full `#171717` screen. Logo centred and **large**. Beneath it, in Inter Semibold `#EDEDED`: **Certify.cx**. A thin `#3ECF8E` line draws underneath it.
- **On-screen text:** `Certify.cx` · below in `#A0A0A0`: `ISO Certification. Simplified.`
- **Why:** The client asked for this explicitly. It is the first thing on screen.

### Scene 2 — 0:05–0:16 · THE PROBLEM *(the only avatar scene)*
- **Voiceover:** "ISO certification should be straightforward. Instead it means months of emails, quotes that never arrive, consultants you can't reach — and no idea where your file actually is."
- **Visual:** Dark background. Avatar **medium size, right third of frame**, everything else is kinetic text on the left. Avatar leaves at the end of this scene and **does not return**.
- **On-screen text** (appearing line by line, muted grey, each one striking through):
  `Months of waiting` · `Unclear costs` · `No visibility`
- **Avatar total screen time: 11 seconds, once.**

### Scene 3 — 0:16–0:23 · THE ANSWER
- **Voiceover:** "Certify.cx puts the entire process on one platform."
- **Visual:** The grey problem text collapses away; the **dashboard screen recording (clip 6)** scales up into frame. Logo appears small, top-left, and stays there for the rest of the video.
- **On-screen text:** `ONE PLATFORM` in `#3ECF8E`

### Scene 4 — 0:23–0:39 · THE PLATFORM *(the core — client asked for this)*
- **Voiceover:** "Apply online in minutes. Get matched with an accredited certification body. Upload your documents. And track every step, in real time, in your language — right up to your certificate."
- **Visual:** **Screen recordings 1 → 2 → 3 → 4 → 5**, roughly 3 seconds each, cutting on the beat of the narration. A small `#3ECF8E` label captions each one.
- **On-screen labels:** `Apply` → `Matched` → `Upload` → `Track` → `Certified`
- **Why:** This is the "display the Platform briefly so viewers will be familiar with it" instruction. It is the longest scene on purpose.

### Scene 5 — 0:39–0:47 · INDUSTRIES *(the most-asked question)*
- **Voiceover:** "Manufacturing, construction, services, medical, hospitality, education, exporters, farming. Every sector. Every size."
- **Visual:** Eight icons on `#242424` cards appearing in a grid on the dark background, each with a `#3ECF8E` outline, landing in time with the words.
- **Closing line, large:** `Every sector. Every size.`

### Scene 6 — 0:47–0:55 · WHO IT'S FOR
- **Voiceover:** "Clients certify faster. Referral partners and consultancies earn commission. Auditors and certification bodies get verified work — all in one place."
- **Visual:** Five `#242424` cards sliding in across the dark background, each lighting up `#3ECF8E` as it is named.
- **On-screen text:** `CLIENTS` · `REFERRALS` · `CONSULTANCIES` · `AUDITORS` · `CERTIFICATION BODIES`

### Scene 7 — 0:55–1:00 · BRAND CLOSING SLIDE
- **Voiceover:** "Certify.cx. Certification, made clear. Start free at certify dot c x."
- **Visual:** Back to full `#171717`. Logo **large**, centred. `certify.cx` beneath it in `#3ECF8E`. Hold this frame completely still for the final 2 seconds.
- **Why:** The client asked for the name and logo "before the end". This is the frame that freezes on every social platform.

---

# 5. Voiceover script — clean copy for HeyGen

Paste this as the script. One paragraph = one scene. Scene 1 has no narration.

```
ISO certification should be straightforward. Instead it means months of emails, quotes that never arrive, consultants you can't reach — and no idea where your file actually is.

Certify.cx puts the entire process on one platform.

Apply online in minutes. Get matched with an accredited certification body. Upload your documents. And track every step, in real time, in your language — right up to your certificate.

Manufacturing, construction, services, medical, hospitality, education, exporters, farming. Every sector. Every size.

Clients certify faster. Referral partners and consultancies earn commission. Auditors and certification bodies get verified work — all in one place.

Certify.cx. Certification, made clear. Start free at certify dot c x.
```

---

# 6. How to build it in HeyGen

**Do not use the AI agent / Auto-pilot box again.** That is what produced the rejected video — it picks its own stock footage and its own look, and it will keep doing that. Build the scenes yourself.

1. **Brand kit first.** *Brand* → upload `public/brand-mark.png` → primary colour **`#3ECF8E`** → background **`#171717`** → font **Inter**.
2. **Create Video → Blank → Landscape 16:9.** Not a template.
3. **Upload all six screen recordings** into the project's assets before you start.
4. **Create 7 scenes**, matching the storyboard above.
5. **Delete the avatar from every scene except Scene 2.** In HeyGen the avatar is a layer — select it and remove it. This is the single most important step; the client called it out directly.
6. **Scenes 1 and 7:** no video, no avatar. Solid `#171717` background, logo image, text. These are the two brand slides.
7. **Scenes 3–4:** set the screen recording as the scene background, add the small text label on top.
8. **One voice across all scenes** — professional English, speed 1.0×.
9. **Subtitles ON**, Inter font, positioned low.
10. **Music:** minimal corporate / ambient, volume ~12%. Nothing with a heavy beat — the reference video is calm.

---

# 7. Before sending to the client — self-check

Play it once and answer honestly:

- [ ] Is the logo **large and readable** in the first 5 seconds?
- [ ] Is the logo **large and readable** in the last 5 seconds?
- [ ] Does the avatar appear for **11 seconds or less**, and only once?
- [ ] Is the background **dark `#171717`**, not white?
- [ ] Is the green **`#3ECF8E`**?
- [ ] Is the font **Inter**?
- [ ] Does the **real platform** appear on screen for at least 15 seconds?
- [ ] Does the **problem** come before any feature?
- [ ] Is it **60 seconds or under**?
- [ ] Is there **no real client data** visible anywhere?

If any box is unticked, fix it before sending. The client rejected v1 on four of these.

---

# 8. Open questions for the client

1. He says he **already sent a video theme** earlier. If there is an earlier reference besides the Membrain link, it should be found and matched — being asked twice is what caused the rejection.
2. **Arabic version** — required or not?
3. **"Transparent pricing"** was dropped from the v2 script because the pricing model question from 19 July is still unresolved. Confirm the model and it can go back in.

---

*Version 2 — 22 July 2026. Supersedes `VIDEO_SCRIPT_60S_CORPORATE.md`.*
