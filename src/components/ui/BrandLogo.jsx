import { Link } from 'react-router-dom';
import brandMark from '../../assets/brand-mark.png';
import './BrandLogo.css';

// The one and only Certify.cx™ lockup — the client's mark + the wordmark.
//
// Brand rule from the client: ONE colour, never multi-colour. The supplied
// artwork is a teal-gradient spiral "C" with a checkmark; it is flattened to a
// single colour in CSS (`filter: brightness(0)` → black, plus `invert(1)` →
// white) rather than by shipping recoloured copies, so the shape stays exactly
// as the client drew it and there is one asset to swap when they send a vector.
//
// Colour follows the surface automatically:
//   dark background  → white mark, white wordmark
//   light background → black mark, black wordmark
// Force it with the `brand-logo--on-dark` / `brand-logo--on-light` classes when
// a surface doesn't match the active theme (e.g. the light checkout card).
//
// `tm` controls the trademark symbol only:
//   'grey' — ™ in grey against the mono wordmark (the default)
//   'mono' — ™ in the same single colour as everything else
//
// Before this component the lockup was hand-duplicated at 12 sites in two
// diverging variants, with four different icon treatments (two gradients, a
// drop-shadow glow, a flat tint) and a wordmark that painted "C" and ".cx"
// green. Render it from here only.
export default function BrandLogo({
  size = 28,
  to = '/',
  tm = 'grey',
  className = '',
  showText = true,
}) {
  const content = (
    <>
      <img
        src={brandMark}
        alt=""
        aria-hidden="true"
        className="brand-logo__mark"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span className="brand-logo__text" style={{ fontSize: `${size * 0.62}px` }}>
          Certify.cx<sup className="brand-logo__tm">&trade;</sup>
        </span>
      )}
    </>
  );

  const cls = `brand-logo ${className}`.trim();

  // `to={null}` renders a plain span — for surfaces that are already the
  // destination (the dashboard shell) or where a link would be a dead end.
  if (!to) {
    return <span className={cls} data-tm={tm}>{content}</span>;
  }

  return (
    <Link to={to} className={cls} data-tm={tm} aria-label="Certify.cx">
      {content}
    </Link>
  );
}
