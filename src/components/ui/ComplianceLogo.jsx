// ============================================
// Certify.cx — Compliance Audit logo mark
// ============================================
// Renders the badge shown on each Compliance Audit card.
//
// These are ORIGINAL wordmark badges drawn here in SVG, not the official
// AICPA / PCI SSC / HITRUST / HHS trademarks. That is deliberate: those marks
// are owned by their bodies and most of them may only be displayed by a firm
// that body has licensed or accredited. Drawing our own keeps the cards honest
// and keeps the repo free of third-party artwork we have no licence for.
//
// If Certify.cx obtains the right to display an official mark, swap that one
// entry's `logo` in utils/complianceAudits.js for an <img> and leave the rest.
//
// Self-contained SVG: no font files, no network requests, and it scales to any
// size, so it stays crisp on a retina screen and inside a PDF.

// Uppercase bold sans is roughly 0.62em wide per glyph. Size the text from the
// longest line so a 7-character mark (HITRUST) fits the same badge as a
// 3-character one (SOX) without overflowing or being stretched thin.
const BADGE = 64;
// Wide enough to use the badge, narrow enough that the longest mark (HITRUST)
// still clears the inner hairline at x=6.5..57.5 rather than touching it.
const SAFE_WIDTH = 46;
const GLYPH_RATIO = 0.62;
const MAX_FONT_SIZE = 22;

function fitFontSize(lines, maxSize) {
  const longest = lines.reduce((n, line) => Math.max(n, line.length), 1);
  return Math.min(maxSize, SAFE_WIDTH / (longest * GLYPH_RATIO));
}

export default function ComplianceLogo({ lines, color, title, size = 44 }) {
  const safeLines = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).slice(0, 2);
  if (safeLines.length === 0) return null;

  const twoLine = safeLines.length === 2;
  const fontSize = fitFontSize(safeLines, twoLine ? 18 : MAX_FONT_SIZE);
  // Single line sits on the badge's centre; two lines straddle it.
  const baselines = twoLine ? [25, 46] : [BADGE / 2];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BADGE} ${BADGE}`}
      role="img"
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <rect x="2" y="2" width={BADGE - 4} height={BADGE - 4} rx="14" fill={color} />
      {/* Inner hairline: reads as a seal rather than a plain colour swatch. */}
      <rect
        x="6.5"
        y="6.5"
        width={BADGE - 13}
        height={BADGE - 13}
        rx="10"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.35"
      />
      {safeLines.map((line, i) => (
        <text
          key={line}
          x={BADGE / 2}
          y={baselines[i]}
          textAnchor="middle"
          dominantBaseline={twoLine ? 'auto' : 'central'}
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          fontWeight="700"
          fontSize={fontSize}
          letterSpacing="0.5"
          fill="#ffffff"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}
