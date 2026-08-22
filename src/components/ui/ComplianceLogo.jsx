import './ComplianceLogo.css';

// ============================================
// Certify.cx — Compliance Audit logo mark
// ============================================
// Renders the framework logo shown on each Compliance Audit card, matching the
// reference site the client asked us to follow (kaleshaco.com/services).
//
// The marks originally arrived as white-background JPEGs, which meant every
// logo sat on the dark cards inside a hard white rectangle. The client asked
// for that white area to go, so the eight files were re-cut: the white AROUND
// each mark is now transparent (see ComplianceLogo.css for how the dark theme
// keeps the dark marks legible without putting a plate back).
//
// `alt` is intentionally the service name rather than the logo's own wording —
// a screen reader announcing "AICPA SOC logo" tells the user less than
// "SOC Examinations", and the visible heading already repeats the name.

export default function ComplianceLogo({ src, title, size = 56 }) {
  if (!src) return null;

  return (
    <span className="compliance-logo" style={{ width: size, height: size }}>
      <img className="compliance-logo__img" src={src} alt={title || ''} loading="lazy" />
    </span>
  );
}
