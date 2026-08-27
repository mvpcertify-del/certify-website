// ============================================================================
// Outreach letter copy — the per-standard sentence and the sender identity
// ============================================================================
// The client supplied ONE sample letter (27 Aug), written by a partner to a
// university, pitching ISO 21001. Turning that one letter into a feature meant
// deciding which parts are the template and which are the variables.
//
// The variables: the recipient organization, the standard being pitched, the
// certification they already hold (if any), and the partner's own sign-off.
// Everything else — the structure, the tone, the WCA GLOBAL identity — is
// fixed, because that is what the client actually sent.
//
// WHY THIS FILE HAS NO IMAGE OR i18n IMPORT:
// It is reachable from api/ (Node). The standards' titles are duplicated here
// as plain English rather than read from src/i18n/locales/en.json, because a
// JSON import in a Vercel lambda needs an import attribute this repo does not
// use anywhere else. The slugs are the contract with src/utils/isoCatalog.js
// and are checked against it at send time — a slug that exists here but not
// there is rejected, so the two cannot silently drift.
//
// LANGUAGE: English only, on purpose. This is cold B2B outreach to an address
// the platform has never seen; there is no recipient profile and therefore no
// locale to switch on. The nine-language treatment applies to the DASHBOARD
// around it, not to the letter.
// ============================================================================

// The sending organization, as it appears in the letter. The client's sample
// is WCA GLOBAL-branded throughout even though it is sent from the Certify.cx
// domain — that is theirs to decide, and it is centralised here so a change of
// mind is one edit rather than a hunt through the HTML.
export const SENDER = {
  name: 'WCA GLOBAL™',
  site: 'wca-global.com',
  siteUrl: 'https://wca-global.com',
  taglineA: 'Serving Global Clients in 120 Countries  |  Celebrating 40 Years Internationally',
  taglineB: 'Quality is a priority | Customer Satisfaction leads to Success',
  taglineC: 'ISO 9001:2015 Quality Management System Certified Organization',
};

// Served from the app's own origin. Email clients will not render an inline
// <svg> (Outlook drops it outright), so the mark is a hosted PNG — and because
// most clients block remote images on first view, the wordmark beside it in
// the signature is real text. The image is a bonus, never the only thing
// carrying the identity.
//
// Source artwork: the image.png embedded in the client's sample email, trimmed
// of its white margin and scaled down. Lives at public/wca-global-mark.png.
//
// NOT derived from APP_URL, for the reason recorded in api/_brandAsset.js: that
// var names the app host, was once set to a hostname that does not resolve, and
// broke the logo in every transactional email. The mark is served from the
// public site; override only if the artwork moves.
export const SENDER_MARK_URL = process.env.SENDER_MARK_URL
  || 'https://certify.cx/wca-global-mark.png';
export const SENDER_MARK_WIDTH = 110;
export const SENDER_MARK_HEIGHT = 88;

// ---------------------------------------------------------------------------
// Per-standard copy
// ---------------------------------------------------------------------------
// Each entry supplies the two things the letter varies on:
//   title — the standard's full name, completing "ISO 21001 – <title>"
//   pitch — the standalone paragraph describing who the standard is for and
//           what it delivers.
//
// `pitch` follows the client's own sentence shape exactly:
//   "<code> is specifically designed for <audience> and provides a framework
//    for <benefits>."
// The ISO 21001 entry is the client's wording verbatim; the other eleven are
// written to match it, so a partner pitching ISO 45001 sends a letter that
// reads as though it came from the same pen.
export const OUTREACH_COPY = {
  'iso-9001': {
    title: 'Quality Management Systems',
    pitch: 'ISO 9001 is specifically designed for organizations of every size and sector and provides a framework for consistently meeting customer and regulatory requirements, strengthening internal processes, and promoting continual improvement.',
  },
  'iso-14001': {
    title: 'Environmental Management Systems',
    pitch: 'ISO 14001 is specifically designed for organizations seeking to manage their environmental responsibilities and provides a framework for reducing environmental impact, meeting compliance obligations, and improving resource efficiency.',
  },
  'iso-45001': {
    title: 'Occupational Health and Safety Management Systems',
    pitch: 'ISO 45001 is specifically designed for organizations concerned with the health and safety of their workforce and provides a framework for preventing work-related injury and ill health, strengthening hazard controls, and improving safety performance.',
  },
  'iso-22000': {
    title: 'Food Safety Management Systems',
    pitch: 'ISO 22000 is specifically designed for organizations across the food supply chain and provides a framework for ensuring food safety from farm to fork, controlling hazards at every step, and meeting customer and regulatory expectations.',
  },
  'iso-21001': {
    title: 'Educational Organizations Management Systems',
    // The client's own sentence, unchanged.
    pitch: 'ISO 21001 is specifically designed for educational institutions and provides a framework for enhancing the quality of education, improving learner and stakeholder satisfaction, strengthening institutional processes, and promoting continual improvement.',
  },
  'iso-iec-27001': {
    title: 'Information Security Management Systems',
    pitch: 'ISO/IEC 27001 is specifically designed for organizations that handle sensitive information and provides a framework for protecting the confidentiality, integrity and availability of information, managing security risk, and demonstrating strong practice to customers and regulators.',
  },
  'iso-iec-27701': {
    title: 'Privacy Information Management Systems',
    pitch: 'ISO/IEC 27701 is specifically designed for organizations that process personal data and provides a framework for extending an existing information security programme with privacy controls aligned to GDPR and other global data-protection regulations.',
  },
  'iso-iec-42001': {
    title: 'Artificial Intelligence Management Systems',
    pitch: 'ISO/IEC 42001 is specifically designed for organizations that develop or deploy artificial intelligence and provides a framework for governing AI systems responsibly, managing algorithmic risk, and demonstrating transparency and accountability.',
  },
  'iso-50001': {
    title: 'Energy Management Systems',
    pitch: 'ISO 50001 is specifically designed for organizations seeking to control energy cost and consumption and provides a framework for improving energy performance, reducing emissions, and embedding a structured approach to energy use.',
  },
  'iso-37001': {
    title: 'Anti-Bribery Management Systems',
    pitch: 'ISO 37001 is specifically designed for organizations exposed to bribery risk and provides a framework for preventing, detecting and responding to bribery, and for demonstrating a clear commitment to ethical business conduct.',
  },
  'iso-22301': {
    title: 'Business Continuity Management Systems',
    pitch: 'ISO 22301 is specifically designed for organizations that must remain operational through disruption and provides a framework for protecting critical activities, shortening recovery times, and testing continuity arrangements before they are needed.',
  },
  'iso-13485': {
    title: 'Medical Devices Quality Management Systems',
    pitch: 'ISO 13485 is specifically designed for organizations in the medical device sector and provides a framework for meeting regulatory requirements across device design, production and post-market surveillance, and for maintaining consistent product quality.',
  },
};

export function getOutreachCopy(slug) {
  return (slug && Object.prototype.hasOwnProperty.call(OUTREACH_COPY, slug))
    ? OUTREACH_COPY[slug]
    : null;
}
