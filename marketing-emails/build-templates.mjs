// Generates the three marketing emails in the card layout (dark, Certify green accent).
// Run: node marketing-emails/build-templates.mjs, then node scripts/build-outreach-templates.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./', import.meta.url));
const IMG = 'https://certify.cx/email/';
const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const C = { bg: '#0B0B0C', card: '#131316', tile: '#0B0B0C', line: '#26262B', text: '#F3F2EF', mute: '#A9A9AF', dim: '#6E6E74', green: '#3ECF8E', deep: '#06231a', amber: '#F2B35E' };

const pill = (t, bg = C.green, fg = C.deep) =>
  `<span style="display:inline-block;padding:6px 13px;border-radius:999px;background:${bg};font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.12em;color:${fg};">${t}</span>`;

const kicker = (t, color = C.green) =>
  `<div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.12em;color:${color};padding-bottom:10px;">${t}</div>`;

const h = (t, size = 28, extra = '') =>
  `<div class="h1" style="font-family:${F};font-weight:700;font-size:${size}px;line-height:${size + 6}px;color:${C.text};letter-spacing:-0.01em;padding-bottom:10px;${extra}">${t}</div>`;

const p = (t, size = 15, color = C.mute, pad = 14) =>
  `<div style="font-family:${F};font-size:${size}px;line-height:${Math.round(size * 1.6)}px;color:${color};padding-bottom:${pad}px;">${t}</div>`;

// One rounded card. `accent` adds the green strip on top.
const card = (inner, { accent = false, bg = C.card, border = C.line, pad = '26px 28px' } = {}) => `
        <tr><td style="padding:0 0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid ${border};border-radius:16px;border-collapse:separate;">
            ${accent ? `<tr><td style="height:3px;line-height:3px;font-size:0;background:${C.green};border-radius:16px 16px 0 0;">&nbsp;</td></tr>` : ''}
            <tr><td class="px" style="padding:${pad};">${inner}</td></tr>
          </table>
        </td></tr>`;

// A row of tiles. n = 2 or 3. Each tile: { big, bigColor, title, text }.
const tiles = (items) => {
  const n = items.length;
  const w = Math.floor(100 / n);
  const cells = items.map((t, i) => `
              <td class="col" width="${w}%" valign="top" style="padding:0 ${i < n - 1 ? 6 : 0}px 12px ${i > 0 ? 6 : 0}px;">
                <div style="padding:18px;border-radius:14px;background:${C.tile};border:1px solid ${C.line};">
                  ${t.big ? `<div style="font-family:${F};font-size:${t.bigSize || 24}px;font-weight:700;line-height:28px;color:${t.bigColor || C.green};">${t.big}</div>` : ''}
                  <div style="font-family:${F};font-size:14px;font-weight:800;line-height:20px;color:${C.text};padding-top:${t.big ? 8 : 0}px;">${t.title}</div>
                  ${t.text ? `<div style="font-family:${F};font-size:13px;line-height:19px;color:${C.mute};padding-top:3px;">${t.text}</div>` : ''}
                </div>
              </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}
            </tr></table>`;
};

const button = (href, label, ghost = false) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn"><tr>
  <td align="center" style="border-radius:12px;background:${ghost ? C.card : C.green};border:1px solid ${ghost ? '#3A3A40' : C.green};">
    <a href="${href}" style="display:block;padding:15px 30px;font-family:${F};font-size:15px;font-weight:800;border-radius:12px;text-align:center;text-decoration:none;color:${ghost ? C.text : C.deep};">${label}</a>
  </td></tr></table>`;

const signature = `
<div style="font-family:${F};font-size:15px;line-height:24px;color:${C.mute};">
  SIGN_OFF<br>
  <span style="display:inline-block;margin-top:6px;font-size:17px;font-weight:700;color:${C.text};">Midhat Abu-Ghazaleh</span><br>
  <span style="font-size:14px;">Founder &amp; CEO, Certify.cx&trade;</span><br>
  <span style="font-size:14px;"><a href="mailto:{{sender_email}}" style="color:${C.green};text-decoration:none;">{{sender_email}}</a> &nbsp;|&nbsp; {{phone}}</span>
</div>`;

const header = `
        <tr><td style="padding:4px 8px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="padding:0 10px 0 0;"><img src="${IMG}logo-white.png" width="32" height="30" alt="Certify.cx" style="display:block;border:0;"></td>
            <td style="font-family:${F};font-weight:700;font-size:18px;letter-spacing:0.02em;color:${C.text};white-space:nowrap;">Certify.cx<span style="font-size:10px;vertical-align:super;">&trade;</span></td>
          </tr></table>
        </td></tr>`;

const hero = ({ banner, alt, kick, title, sub, line }) => `
        <tr><td style="padding:0 0 16px;">
          <div style="border-radius:18px;overflow:hidden;background:#000;">
            <img src="${IMG}${banner}.png" width="600" height="210" alt="${alt}" class="hero" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:${C.deep};">
            <div class="px" style="padding:24px 26px 26px;background:${C.bg};border:1px solid ${C.line};border-top:0;border-radius:0 0 18px 18px;">
              ${kicker(kick)}
              ${h(title, 28)}
              ${p(sub, 16, '#C9C9CE', 12)}
              <div style="font-family:${F};font-size:14px;line-height:22px;color:#C9C9CE;">${line}</div>
            </div>
          </div>
        </td></tr>`;

const closing = (heading, text, label) => card(`
          <div style="text-align:center;">
            ${kicker('NEXT STEP', C.green)}
            ${h(heading, 26)}
            ${p(text, 15, C.mute, 20)}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="btn" style="margin:0 auto;"><tr>
              <td align="center" style="border-radius:12px;background:${C.green};border:1px solid ${C.green};">
                <a href="{{calendly_url}}" style="display:block;padding:15px 32px;font-family:${F};font-size:15px;font-weight:800;border-radius:12px;text-align:center;text-decoration:none;color:${C.deep};">${label}</a>
              </td></tr></table>
          </div>`, { bg: '#0f1d17', border: '#1f4a37', pad: '34px 28px' });

const footer = (unsub) => `
        <tr><td style="padding:12px 8px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding-bottom:16px;border-bottom:1px solid ${C.line};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding:0 9px 0 0;"><img src="${IMG}logo-white.png" width="26" height="24" alt="Certify.cx" style="display:block;border:0;"></td>
                <td style="font-family:${F};font-weight:700;font-size:15px;color:${C.text};">Certify.cx<span style="font-size:9px;vertical-align:super;">&trade;</span></td>
              </tr></table>
              <div style="font-family:${F};font-size:17px;font-weight:700;color:${C.text};padding-top:14px;">Certify.cx&trade; &mdash; Global Compliance Marketplace</div>
              <div style="font-family:${F};font-size:13px;line-height:20px;color:${C.mute};padding-top:4px;">Connect with trusted providers, access compliance solutions and get certified, anytime, anywhere.</div>
            </td></tr>
            <tr><td style="padding:16px 0 6px;font-family:${F};font-size:12px;line-height:22px;">
              <a href="{{website_url}}" style="color:${C.mute};text-decoration:none;display:inline-block;padding:0 16px 6px 0;">Website</a>
              <a href="https://certify.cx/privacy" style="color:${C.mute};text-decoration:none;display:inline-block;padding:0 16px 6px 0;">Privacy Policy</a>
              <a href="https://certify.cx/terms" style="color:${C.mute};text-decoration:none;display:inline-block;padding:0 16px 6px 0;">Terms</a>
              <a href="https://www.linkedin.com/company/certifycx" style="color:${C.mute};text-decoration:none;display:inline-block;padding:0 16px 6px 0;">LinkedIn</a>
              <a href="https://www.youtube.com/@certifycx" style="color:${C.mute};text-decoration:none;display:inline-block;padding:0 16px 6px 0;">YouTube</a>
            </td></tr>
            ${unsub ? `<tr><td style="padding:0 0 12px;font-family:${F};font-size:12px;line-height:19px;color:${C.dim};">You are receiving this because we believe quality management may be relevant to your institution. If you would rather not hear from us again, you can <a href="{{unsubscribe_url}}" style="color:${C.mute};text-decoration:underline;">unsubscribe</a> at any time.</td></tr>` : ''}
            <tr><td style="padding:0 0 8px;font-family:${F};font-size:12px;line-height:19px;color:${C.dim};">This email was sent through <a href="https://certify.wiki" style="color:${C.mute};text-decoration:underline;">Certify.wiki</a>, associated with <a href="https://certify.cx" style="color:${C.mute};text-decoration:underline;">Certify.cx</a>&trade;.</td></tr>
            <tr><td style="padding:0;font-family:${F};font-size:11px;line-height:18px;color:${C.dim};">&copy; Certify.cx&trade; &nbsp;|&nbsp; Operated by Certify International OPC Private Limited<br>WhatsApp: <a href="https://wa.me/971506449356" style="color:${C.dim};text-decoration:none;">+971 50 644 9356</a></td></tr>
          </table>
        </td></tr>`;

const page = ({ n, when, subject, preheader, unsub, rows }) => `<!--
  Certify.cx marketing email: Email ${n} of 3, ${when}.${unsub ? ' Has the unsubscribe link.' : ''}
  Subject: ${subject}
  Placeholders to fill per recipient: {{recipient_name}} {{institution_name}} {{calendly_url}} {{website_url}} {{sender_email}} {{phone}}${unsub ? ' {{unsubscribe_url}}' : ''}
  Layout: card layout on a dark background (client reference, 18 Nov). Generated, so edit the generator rather than this file.
  Images are hosted at https://certify.cx/email/ (built by marketing-emails/build-assets.mjs).
-->
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${subject.replace(/&/g, '&amp;')}</title>
<style>
  body { margin: 0; padding: 0; background: ${C.bg}; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { color: ${C.green}; }
  @media only screen and (max-width: 620px) {
    .outer { padding: 16px 10px 32px !important; }
    .wrap { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .h1 { font-size: 24px !important; line-height: 30px !important; }
    .col { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; box-sizing: border-box; }
    .btn, .btn td { width: 100% !important; }
    .hero { width: 100% !important; height: auto !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${F};color:${C.text};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};opacity:0;">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr><td class="outer" align="center" style="padding:28px 12px 44px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="wrap" style="width:600px;max-width:600px;">
${header}
${rows}
${footer(unsub)}
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ---------------------------------------------------------------- Email 1
const standards = tiles([
  { big: 'ISO 21001', title: 'Educational Organizations Management Systems', text: '' },
  { big: 'ISO 9001', bigColor: '#7FD4FF', title: 'Quality Management Systems', text: '' },
]);

const e1 = page({
  n: 1, when: 'introduction. Send on day 0', unsub: false,
  subject: 'Elevating Academic & Operational Excellence at {{institution_name}}: ISO 9001 & ISO 21001',
  preheader: 'ISO 21001 and ISO 9001 for {{institution_name}}, matched with IAF-accredited bodies.',
  rows: [
    hero({ banner: 'banner-intro', alt: 'Certify.cx: ISO 21001 and ISO 9001 for schools and universities', kick: 'INTRODUCTION', title: 'Elevating academic &amp; operational excellence at {{institution_name}}', sub: 'Internationally recognized certification, matched with IAF-accredited bodies.', line: '<strong style="color:#F3F2EF;">2 standards</strong> &nbsp;·&nbsp; <strong style="color:#F3F2EF;">IAF-accredited bodies</strong> &nbsp;·&nbsp; <strong style="color:#F3F2EF;">15-minute call</strong>' }),
    card(`
          ${p('Dear {{recipient_name}},', 16, C.text, 12)}
          ${p('<strong style="color:#F3F2EF;">Certify.cx&trade;</strong> is a Global Compliance Marketplace. We match <strong style="color:#F3F2EF;">{{institution_name}}</strong> with certified lead auditors and IAF-accredited Certification Bodies, for two standards:', 16, '#C9C9CE', 18)}
          ${standards}`, { accent: true }),
    card(`
          ${kicker('HOW IT WORKS', C.dim)}
          ${h('Three simple steps', 19, 'padding-bottom:16px;')}
          ${tiles([
            { big: '1', title: 'Share your goals' },
            { big: '2', bigColor: '#7FD4FF', title: 'Compare proposals' },
            { big: '3', bigColor: C.amber, title: 'Get certified' },
          ])}`),
    card(`
          ${kicker('WHY CERTIFY.CX', C.dim)}
          ${h('Built for schools and universities', 19, 'padding-bottom:16px;')}
          ${tiles([
            { title: 'Global credibility', text: 'Recognition that travels across borders.' },
            { title: 'Lower audit costs', text: 'Compare providers in one place.' },
            { title: 'Fits national accreditation', text: 'Works alongside your national framework.' },
          ])}`),
    closing('Open to a 15-minute introductory call next week?', 'A short conversation is enough to see whether it fits.', 'Book a 15-minute call'),
    card(signature.replace('SIGN_OFF', 'Warm regards,')),
  ].join('\n'),
});

// ---------------------------------------------------------------- Email 2
const e2 = page({
  n: 2, when: 'follow-up. Send on day 4 (same thread)', unsub: true,
  subject: 'Re: Elevating Academic & Operational Excellence at {{institution_name}}',
  preheader: 'A quick follow-up on ISO 21001 and ISO 9001 for {{institution_name}}.',
  rows: [
    hero({ banner: 'banner-followup', alt: 'Certify.cx: certification without the friction', kick: 'FOLLOWING UP', title: 'A quick follow-up for {{institution_name}}', sub: 'On ISO 21001 and ISO 9001. Finding the right accredited partner can feel overwhelming. We remove that friction.', line: '<strong style="color:#F3F2EF;">One marketplace</strong> &nbsp;·&nbsp; <strong style="color:#F3F2EF;">Vetted auditors</strong> &nbsp;·&nbsp; <strong style="color:#F3F2EF;">IAF-accredited bodies</strong>' }),
    card(`
          ${p('Dear {{recipient_name}},', 16, C.text, 12)}
          ${p('Here is the difference it makes:', 16, '#C9C9CE', 18)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td class="col" width="50%" valign="top" style="padding:0 6px 12px 0;">
              <div style="padding:18px;border-radius:14px;background:${C.tile};border:1px solid ${C.line};">
                <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.12em;color:${C.dim};padding-bottom:10px;">WITHOUT A MARKETPLACE</div>
                <div style="font-family:${F};font-size:14px;line-height:24px;color:${C.mute};">&#10005; &nbsp;Hunting for providers<br>&#10005; &nbsp;Unclear audit timelines<br>&#10005; &nbsp;Quotes hard to compare</div>
              </div>
            </td>
            <td class="col" width="50%" valign="top" style="padding:0 0 12px 6px;">
              <div style="padding:18px;border-radius:14px;background:#0f1d17;border:1px solid #1f4a37;">
                <div style="font-family:${F};font-size:11px;font-weight:800;letter-spacing:0.12em;color:${C.green};padding-bottom:10px;">WITH CERTIFY.CX</div>
                <div style="font-family:${F};font-size:14px;line-height:24px;color:#C9C9CE;">&#10003; &nbsp;One marketplace<br>&#10003; &nbsp;Matched vetted auditors<br>&#10003; &nbsp;Faster, lower-cost certification</div>
              </div>
            </td>
          </tr></table>`, { accent: true }),
    card(`
          ${kicker('HOW IT WORKS', C.dim)}
          ${h('Three simple steps', 19, 'padding-bottom:16px;')}
          ${tiles([
            { big: '1', title: 'Share your goals' },
            { big: '2', bigColor: '#7FD4FF', title: 'Compare proposals' },
            { big: '3', bigColor: C.amber, title: 'Get certified' },
          ])}`),
    closing('Prefer to choose later?', 'You can book a brief 15-minute introductory call, or simply reply with a time that suits you.', 'Book a 15-minute call'),
    card(signature.replace('SIGN_OFF', 'Best regards,')),
  ].join('\n'),
});

// ---------------------------------------------------------------- Email 3
const e3 = page({
  n: 3, when: 'final follow-up. Send on day 9 (same thread)', unsub: true,
  subject: 'Quick question regarding quality & accreditation at {{institution_name}}',
  preheader: 'A last short note. Zero obligation to get started.',
  rows: [
    hero({ banner: 'banner-final', alt: 'Certify.cx: quality and accreditation, made simpler', kick: 'ONE LAST NOTE', title: 'A quick question about quality &amp; accreditation', sub: 'I will keep this brief. ISO 21001 and ISO 9001 help {{institution_name}}:', line: '<strong style="color:#F3F2EF;">Zero obligation</strong> to get started.' }),
    card(`
          ${p('Dear {{recipient_name}},', 16, C.text, 12)}
          ${tiles([
            { big: '1', title: 'Show accountability', text: 'To boards and ministries.' },
            { big: '2', bigColor: '#7FD4FF', title: 'Raise satisfaction', text: 'Student and staff satisfaction.' },
            { big: '3', bigColor: C.amber, title: 'Gain recognition', text: 'IAF-backed recognition.' },
          ])}
          ${p('If a colleague oversees quality or accreditation, I would be grateful if you could point me their way.', 15, '#C9C9CE', 0)}`, { accent: true }),
    closing('Zero obligation to get started', 'Select a convenient 15-minute slot on my calendar, or reply to this email.', 'Book a 15-minute call'),
    card(signature.replace('SIGN_OFF', 'Warm regards,')),
  ].join('\n'),
});

writeFileSync(OUT + '01-introduction.html', e1);
writeFileSync(OUT + '02-follow-up-day-4.html', e2);
writeFileSync(OUT + '03-final-follow-up-day-9.html', e3);
console.log('written', e1.length, e2.length, e3.length);
