// Builds the images used by the marketing emails (banners, icons, social icons, white logo)
// into public/email/*.png, which is served at https://certify.cx/email/<file>.png.
//
// Email apps cannot use CSS backgrounds or SVG reliably, so every visual is a flat PNG that
// is drawn here (HTML + SVG) and photographed with headless Chrome.
//
//   node marketing-emails/build-assets.mjs
//   CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node marketing-emails/build-assets.mjs
//
// Edit the banner wording in BANNERS below and run it again.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  GraduationCap, ShieldCheck, Globe, BadgeCheck, Linkedin, Youtube, Facebook,
} from 'lucide-react';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'email');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ccx-email-'));
fs.mkdirSync(OUT, { recursive: true });

const MARK = pathToFileURL(path.join(ROOT, 'public', 'brand-mark.png')).href;
const icon = (Cmp, size, color, stroke = 2) =>
  renderToStaticMarkup(React.createElement(Cmp, { size, color, strokeWidth: stroke }));
const X_MARK = (size, color) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

const DARK = '#06231a';
const DARK2 = '#0c3d2d';
const ACCENT = '#3ECF8E';

function shot(name, w, h, bodyHtml, transparent = false) {
  const file = path.join(TMP, `${name}.html`);
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : '#fff'};font-family:'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  </style></head><body>${bodyHtml}</body></html>`);
  const png = path.join(OUT, `${name}.png`);
  const args = ['--headless', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`, `--screenshot=${png}`, '--force-device-scale-factor=1'];
  if (transparent) args.push('--default-background-color=00000000');
  args.push(pathToFileURL(file).href);
  execFileSync(CHROME, args, { stdio: 'ignore' });
  console.log('built', path.relative(ROOT, png));
}

// ------------------------------------------------------------------ banners (1200 x 420, shown at 600 x 210)
const BANNERS = [
  { name: 'banner-intro', eyebrow: 'ISO 21001  &  ISO 9001', title: 'Quality that students and<br>parents can trust', sub: 'Internationally recognised certification for schools and universities, matched with IAF-accredited bodies.', art: GraduationCap },
  { name: 'banner-followup', eyebrow: 'Following up', title: 'Certification without<br>the friction', sub: 'One marketplace. Vetted auditors. IAF-accredited Certification Bodies.', art: ShieldCheck },
  { name: 'banner-final', eyebrow: 'One last note', title: 'Quality and accreditation,<br>made simpler', sub: 'Zero obligation to get started.', art: BadgeCheck },
];

for (const b of BANNERS) {
  shot(b.name, 1200, 420, `
  <div style="position:relative;width:1200px;height:420px;background:linear-gradient(120deg,${DARK} 0%,${DARK2} 70%,#11513b 100%);overflow:hidden">
    <div style="position:absolute;right:-120px;top:-140px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(62,207,142,.35) 0%,rgba(62,207,142,0) 70%)"></div>
    <div style="position:absolute;right:90px;top:70px;width:280px;height:280px;border-radius:50%;border:2px solid rgba(62,207,142,.45)"></div>
    <div style="position:absolute;right:130px;top:110px;width:200px;height:200px;border-radius:50%;background:rgba(62,207,142,.14);border:2px solid rgba(62,207,142,.7);display:flex;align-items:center;justify-content:center">${icon(b.art, 96, ACCENT, 1.6)}</div>
    <div style="position:absolute;left:64px;top:44px;display:flex;align-items:center;gap:14px">
      <img src="${MARK}" style="width:46px;height:auto;filter:brightness(0) invert(1)">
      <div style="color:#fff;font-size:30px;font-weight:700;letter-spacing:-.01em">Certify.cx<span style="font-size:15px;vertical-align:super">&#8482;</span></div>
    </div>
    <div style="position:absolute;left:64px;top:134px;width:690px">
      <div style="color:${ACCENT};font-size:20px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px">${b.eyebrow}</div>
      <div style="color:#fff;font-size:50px;line-height:1.12;font-weight:800;letter-spacing:-.02em">${b.title}</div>
      <div style="color:rgba(255,255,255,.78);font-size:21px;line-height:1.45;margin-top:18px;max-width:600px">${b.sub}</div>
    </div>
  </div>`);
}

// ------------------------------------------------------------------ feature icons (96 x 96, transparent)
for (const [name, Cmp] of [['icon-shield', ShieldCheck], ['icon-globe', Globe], ['icon-badge', BadgeCheck]]) {
  shot(name, 96, 96, `<div style="width:96px;height:96px;border-radius:50%;background:#e6f8ef;display:flex;align-items:center;justify-content:center">${icon(Cmp, 46, '#0e9f6e', 1.9)}</div>`, true);
}

// ------------------------------------------------------------------ footer: white logo + social icons
shot('logo-white', 160, 154, `<img src="${MARK}" style="width:160px;height:auto;filter:brightness(0) invert(1)">`, true);
const social = { 'social-linkedin': icon(Linkedin, 30, '#fff', 1.8), 'social-youtube': icon(Youtube, 30, '#fff', 1.8), 'social-x': X_MARK(26, '#fff'), 'social-facebook': icon(Facebook, 30, '#fff', 1.8) };
for (const [name, svg] of Object.entries(social)) {
  shot(name, 72, 72, `<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center">${svg}</div>`, true);
}
fs.rmSync(TMP, { recursive: true, force: true });
