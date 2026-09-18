import { isoNumber } from '../../utils/isoCatalog';
import './IsoBadge.css';

// ============================================
// Certify.cx — per-standard badge ("logo" for each certificate type)
// ============================================
// Client, 19 Sep: "Add logo for each Certificate type."
//
// A circular seal carrying the standard's own number — "ISO / 9001",
// "ISO/IEC / 27001" — so each certificate type has a mark of its own where the
// cards used to share a handful of generic icons (Award, Shield, ...).
//
// This is deliberately NOT the official ISO logo: that is a registered
// trademark of the International Organization for Standardization and cannot be
// reproduced without permission. It is drawn from the code text, in the
// Certify.cx single-colour rule (currentColor, no gradients), so it follows the
// card's accent and needs no image asset per standard — a new catalog entry
// gets its badge for free.
//
// `code` is the short catalog code ("ISO/IEC 27001"). The seal is decorative;
// the code is always printed as text beside it, so it is hidden from
// assistive tech.
export default function IsoBadge({ code, size = 56 }) {
  const number = isoNumber(code);
  if (!number) return null;
  const prefix = /^ISO\/IEC/i.test(code) ? 'ISO/IEC' : 'ISO';

  return (
    <span
      className="iso-badge"
      style={{ width: size, height: size, fontSize: size }}
      aria-hidden="true"
    >
      <span className="iso-badge__prefix">{prefix}</span>
      <span className="iso-badge__number">{number}</span>
    </span>
  );
}
