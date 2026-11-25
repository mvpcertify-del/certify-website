import {
  BadgeCheck, Smile, Gauge, Leaf, Scale, Recycle, HardHat, ShieldAlert, HeartPulse, Lock, ShieldCheck, Handshake,
} from 'lucide-react';

// The hero picture for each ISO landing page: drawn in SVG, so it is sharp at any size, follows the dark/light theme and
// needs no photo licence. A motif per standard behind a "certified" seal, with three floating benefit cards.
const ICONS = { BadgeCheck, Smile, Gauge, Leaf, Scale, Recycle, HardHat, ShieldAlert, HeartPulse, Lock, ShieldCheck, Handshake };

function Motif({ kind }) {
  switch (kind) {
    case 'leaf':
      return (
        <g fill="currentColor" opacity="0.16">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} transform={`rotate(${a} 260 220) translate(260 70)`} d="M0 0 C34 30 34 86 0 120 C-34 86 -34 30 0 0 Z" />
          ))}
        </g>
      );
    case 'shield':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" opacity="0.28">
          <path d="M260 56 L402 106 V220 C402 298 340 352 260 388 C180 352 118 298 118 220 V106 Z" />
          <path d="M260 92 L372 130 V220 C372 280 324 322 260 352 C196 322 148 280 148 220 V130 Z" opacity="0.7" />
          <path d="M260 128 L342 156 V220 C342 262 308 292 260 316 C212 292 178 262 178 220 V156 Z" opacity="0.5" />
        </g>
      );
    case 'circuit':
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round">
          <path d="M40 120 H150 L190 80 H300" /><path d="M480 150 H390 L350 190 H300" />
          <path d="M60 300 H170 L210 340 H320" /><path d="M470 300 H380 L340 260 H300" />
          <path d="M260 40 V100" /><path d="M260 340 V400" />
          {[[300, 80], [300, 190], [320, 340], [300, 260], [260, 40], [260, 400], [40, 120], [480, 150], [60, 300], [470, 300]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="currentColor" />
          ))}
        </g>
      );
    default: // 'hex'
      return (
        <g fill="none" stroke="currentColor" strokeWidth="2" opacity="0.28">
          {[170, 135, 100].map((r, i) => (
            <polygon key={r} opacity={1 - i * 0.25} points={Array.from({ length: 6 }, (_, k) => {
              const a = (Math.PI / 3) * k - Math.PI / 6;
              return `${260 + r * Math.cos(a)},${220 + r * Math.sin(a)}`;
            }).join(' ')} />
          ))}
        </g>
      );
  }
}

export default function IsoArt({ slug, motif, seal, chips }) {
  const id = `isol-arc-${slug}`;
  return (
    <div className="isol-art" aria-hidden="true">
      <svg viewBox="0 0 520 440" role="img" focusable="false">
        <defs>
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.30" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <path id={id} d="M260 220 m-112 0 a112 112 0 1 1 224 0 a112 112 0 1 1 -224 0" />
        </defs>
        <circle cx="260" cy="220" r="210" fill={`url(#${id}-glow)`} />
        <Motif kind={motif} />
        <circle cx="260" cy="220" r="150" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 9" opacity="0.5" />
        <circle cx="260" cy="220" r="132" className="isol-art__disc" />
        <circle cx="260" cy="220" r="132" fill="none" stroke="currentColor" strokeWidth="6" />
        <circle cx="260" cy="220" r="84" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <text className="isol-art__ring" fontSize="14" fontWeight="800" letterSpacing="5">
          <textPath href={`#${id}`} startOffset="0">CERTIFIED • ACCREDITED • AUDITED • TRUSTED •</textPath>
        </text>
        <text x="260" y="202" textAnchor="middle" className="isol-art__iso" fontSize={seal[0].length > 3 ? 30 : 40} fontWeight="900">{seal[0]}</text>
        <text x="260" y="232" textAnchor="middle" className="isol-art__num" fontSize="19" fontWeight="800">{seal[1]}</text>
        <path d="M238 262 l16 16 l34 -36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {chips.map(([label, icon], i) => {
        const Icon = ICONS[icon] || BadgeCheck;
        return (
          <span className={`isol-art__chip isol-art__chip--${i + 1}`} key={label}>
            <Icon size={16} /> {label}
          </span>
        );
      })}
    </div>
  );
}
