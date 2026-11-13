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
  ClipboardCheck, Users, Award, Coins, Landmark, Target, Scale, Check, X,
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
for (const [name, Cmp] of [['icon-shield', ShieldCheck], ['icon-globe', Globe], ['icon-badge', BadgeCheck], ['icon-coins', Coins], ['icon-landmark', Landmark], ['icon-clipboard', ClipboardCheck], ['icon-users', Users], ['icon-award', Award]]) {
  shot(name, 96, 96, `<div style="width:96px;height:96px;border-radius:50%;background:#e6f8ef;display:flex;align-items:center;justify-content:center">${icon(Cmp, 46, '#0e9f6e', 1.9)}</div>`, true);
}

// ------------------------------------------------------------------ explainer graphics (1200 wide, shown at 600)
const CARD = 'background:#ffffff;border:2px solid #dfe7e3;border-radius:28px;';
// Two standards, side by side
shot('graphic-standards', 1200, 400, `
  <div style="width:1200px;height:400px;background:#ffffff;display:flex;gap:36px;padding:10px 0">
    ${[['ISO 21001', 'Educational Organizations Management Systems', GraduationCap, ''], ['ISO 9001', 'Quality Management Systems', ShieldCheck, '']].map(([t, d, I, tag]) => `
    <div style="flex:1;${CARD}padding:36px 40px;position:relative;overflow:hidden;background:linear-gradient(160deg,#f2fbf7 0%,#ffffff 60%)">
      <div style="width:104px;height:104px;border-radius:50%;background:#e6f8ef;display:flex;align-items:center;justify-content:center;margin-bottom:24px">${icon(I, 56, '#0e9f6e', 1.8)}</div>
      <div style="font-size:78px;font-weight:800;letter-spacing:-.02em;color:#06231a;line-height:1">${t}</div>
      <div style="font-size:35px;line-height:1.28;color:#46526a;margin-top:16px;font-weight:600">${d}</div>
    </div>`).join('')}
  </div>`);

// Three steps
shot('graphic-steps', 1200, 380, `
  <div style="width:1200px;height:380px;background:#ffffff;position:relative;padding-top:20px">
    <div style="position:absolute;left:210px;right:210px;top:112px;border-top:4px dashed #bfe9d5"></div>
    <div style="display:flex;justify-content:space-between;padding:0 30px;position:relative">
      ${[['1', 'Share your goals', 'Tell us the standard', Target], ['2', 'Compare proposals', 'Pre-vetted bodies', Scale], ['3', 'Get certified', 'Recognised worldwide', BadgeCheck]].map(([n, t, d, I]) => `
      <div style="width:340px;text-align:center">
        <div style="position:relative;width:184px;height:184px;margin:0 auto 22px;border-radius:50%;background:#06231a;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 12px #e6f8ef">
          ${icon(I, 80, '#3ECF8E', 1.6)}
          <div style="position:absolute;left:-6px;top:-6px;width:56px;height:56px;border-radius:50%;background:#3ECF8E;color:#06231a;font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center;border:5px solid #fff">${n}</div>
        </div>
        <div style="font-size:42px;font-weight:800;color:#06231a;letter-spacing:-.01em;line-height:1.1">${t}</div>
        <div style="font-size:30px;color:#5b6478;margin-top:10px">${d}</div>
      </div>`).join('')}
    </div>
  </div>`);

// Before / after
shot('graphic-compare', 1200, 440, `
  <div style="width:1200px;height:440px;background:#ffffff;display:flex;gap:36px;padding:8px 0">
    <div style="flex:1;border-radius:28px;background:#f3f4f7;border:2px solid #e3e6ec;padding:34px 38px">
      <div style="font-size:28px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a93a6;margin-bottom:28px">Without a marketplace</div>
      ${['Hunting for providers', 'Unclear audit timelines', 'Quotes hard to compare'].map((t) => `
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px"><div style="width:52px;height:52px;border-radius:50%;background:#e3e6ec;display:flex;align-items:center;justify-content:center;flex:none">${icon(X, 28, '#8a93a6', 2.4)}</div><div style="font-size:36px;line-height:1.2;font-weight:600;color:#6b7488">${t}</div></div>`).join('')}
    </div>
    <div style="flex:1;border-radius:28px;background:linear-gradient(150deg,#06231a 0%,#0c3d2d 100%);padding:34px 38px;position:relative">
      <div style="font-size:28px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3ECF8E;margin-bottom:28px">With Certify.cx&trade;</div>
      ${['One marketplace', 'Matched, vetted auditors', 'Faster, lower-cost certification'].map((t) => `
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px"><div style="width:52px;height:52px;border-radius:50%;background:#3ECF8E;display:flex;align-items:center;justify-content:center;flex:none">${icon(Check, 30, '#06231a', 3)}</div><div style="font-size:36px;line-height:1.2;font-weight:700;color:#ffffff">${t}</div></div>`).join('')}
    </div>
  </div>`);

// ------------------------------------------------------------------ footer: white logo + social icons
shot('logo-white', 160, 154, `<img src="${MARK}" style="width:160px;height:auto;filter:brightness(0) invert(1)">`, true);
const social = { 'social-linkedin': icon(Linkedin, 30, '#fff', 1.8), 'social-youtube': icon(Youtube, 30, '#fff', 1.8), 'social-x': X_MARK(26, '#fff'), 'social-facebook': icon(Facebook, 30, '#fff', 1.8) };
for (const [name, svg] of Object.entries(social)) {
  shot(name, 72, 72, `<div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center">${svg}</div>`, true);
}
fs.rmSync(TMP, { recursive: true, force: true });
