import './ComplianceLogo.css';

// ============================================
// Certify.cx — Compliance Audit logo mark
// ============================================
// Renders the framework logo shown on each Compliance Audit card, matching the
// reference site the client asked us to follow (kaleshaco.com/services).
//
// The eight source files are JPEGs with a solid white background rather than
// transparent PNGs. On the reference site that is invisible because its cards
// are white; Certify.cx has a dark theme, where a bare white-backed JPEG would
// sit on the card as a hard white rectangle. So the logo always gets an
// explicit white tile with padding: on light backgrounds it is imperceptible,
// on dark ones it reads as a deliberate logo plate instead of an artefact.
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
