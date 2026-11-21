import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Copy, Check, ArrowRight, Tag, BadgeCheck, ShieldCheck, Clock } from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import {
  BF_DISCOUNT, BF_CODE, BF_ENDS_AT, BF_CTA_PATH, BF_POPUP_SKIP, BF_POPUP_DELAY_MS, BF_POPUP_STORAGE_KEY,
} from '../../config/blackFriday';
import './BlackFriday.css';

const pad = (n) => String(n).padStart(2, '0');

function split(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

// One ticking clock for the banner and the popup. `live` flips to false when the sale ends, which hides both.
function useSaleClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Date.now() >= BF_ENDS_AT) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = BF_ENDS_AT - now;
  return { live: left > 0, ...split(left) };
}

function CopyCode({ className = '' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(BF_CODE); } catch { /* clipboard blocked: the code is still visible */ }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" className={`bf-copy ${className}`} onClick={copy}>
      {done ? <Check size={15} /> : <Copy size={15} />}
      <span>{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

// A flat illustration of a black gift box with an orange ribbon, drawn in SVG so it stays sharp at any size.
function GiftBox() {
  return (
    <svg className="bf-gift" viewBox="0 0 300 300" role="img" aria-label={`${BF_DISCOUNT}% off gift box`}>
      <defs>
        <linearGradient id="bfBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2b2e" /><stop offset="1" stopColor="#111113" />
        </linearGradient>
        <linearGradient id="bfLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3e" /><stop offset="1" stopColor="#1e1e21" />
        </linearGradient>
        <linearGradient id="bfRib" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb061" /><stop offset="0.5" stopColor="#ff7a1a" /><stop offset="1" stopColor="#c4510a" />
        </linearGradient>
        <radialGradient id="bfGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff7a1a" stopOpacity="0.45" /><stop offset="1" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="150" cy="170" rx="145" ry="125" fill="url(#bfGlow)" />
      <ellipse cx="150" cy="282" rx="100" ry="10" fill="#000" opacity="0.5" />
      {/* box body + lid */}
      <rect x="68" y="150" width="164" height="124" rx="6" fill="url(#bfBox)" stroke="#ff7a1a" strokeOpacity="0.25" />
      <path d="M52 152 L62 112 H238 L248 152 Z" fill="url(#bfLid)" stroke="#ff7a1a" strokeOpacity="0.3" />
      {/* ribbon */}
      <rect x="176" y="150" width="30" height="124" fill="url(#bfRib)" />
      <path d="M176 112 H206 L210 152 H172 Z" fill="url(#bfRib)" />
      {/* bow */}
      <path d="M191 112 C150 100 120 40 160 38 C182 38 190 78 191 112 Z" fill="url(#bfRib)" />
      <path d="M191 112 C232 100 262 40 222 38 C200 38 192 78 191 112 Z" fill="url(#bfRib)" />
      <path d="M191 108 C165 92 158 62 168 52" fill="none" stroke="#7a3000" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
      <path d="M191 108 C217 92 224 62 214 52" fill="none" stroke="#7a3000" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
      <rect x="179" y="100" width="24" height="22" rx="6" fill="#ff7a1a" />
      {/* offer text */}
      <text x="78" y="226" fontSize="48" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif">{BF_DISCOUNT}</text>
      <text x="142" y="200" fontSize="24" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif">%</text>
      <text x="142" y="226" fontSize="21" fontWeight="800" fill="#ff7a1a" fontFamily="Inter, system-ui, sans-serif">OFF</text>
      {/* hang tag */}
      <g transform="rotate(14 250 190)">
        <rect x="222" y="160" width="62" height="40" rx="5" fill="#16161a" stroke="#ff7a1a" strokeOpacity="0.7" />
        <circle cx="228" cy="165" r="3" fill="#ff7a1a" />
        <text x="253" y="178" fontSize="11" fontWeight="800" textAnchor="middle" fill="#fff" fontFamily="Inter, system-ui, sans-serif">BLACK</text>
        <text x="253" y="191" fontSize="11" fontWeight="800" textAnchor="middle" fill="#ff7a1a" fontFamily="Inter, system-ui, sans-serif">FRIDAY</text>
      </g>
      {/* sparkles */}
      {[[40, 90, 3], [265, 100, 2.5], [70, 40, 2], [270, 250, 3], [30, 220, 2]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#ffb061" opacity="0.8" />
      ))}
    </svg>
  );
}

function Banner({ clock }) {
  return (
    <div className="bf-banner" role="region" aria-label="Black Friday offer">
      <div className="bf-banner__inner">
        <span className="bf-banner__tag">Black Friday</span>
        <span className="bf-banner__text">
          <strong>{BF_DISCOUNT}% OFF</strong><span className="bf-hide-sm"> everything</span>
        </span>
        <span className="bf-banner__clock" aria-label="Time left">
          <span className="bf-hide-sm">Ends in </span>
          <b>{clock.d}d</b> <b>{pad(clock.h)}</b>:<b>{pad(clock.m)}</b>:<b>{pad(clock.s)}</b>
        </span>
        <span className="bf-banner__code bf-hide-md">Code <b>{BF_CODE}</b></span>
        <Link to={BF_CTA_PATH} className="bf-banner__cta">Claim now <ArrowRight size={14} /></Link>
      </div>
    </div>
  );
}

function Popup({ clock, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const boxes = [[clock.d, 'Days'], [pad(clock.h), 'Hrs'], [pad(clock.m), 'Min'], [pad(clock.s), 'Sec']];

  return (
    <div className="bf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bf-modal" role="dialog" aria-modal="true" aria-labelledby="bf-title">
        <button type="button" className="bf-modal__close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        <div className="bf-modal__top">
          <div className="bf-modal__copy">
            <BrandLogo size={26} to={null} className="brand-logo--on-dark bf-modal__logo" />
            <p className="bf-eyebrow">Limited time only <i /></p>
            <h2 id="bf-title" className="bf-title"><span>BLACK</span><span className="bf-title__hot">FRIDAY</span></h2>
            <p className="bf-pill">Our Biggest Offer of the Year <span aria-hidden="true">🔥</span></p>
            <p className="bf-off"><b>{BF_DISCOUNT}%</b> <em>OFF</em></p>
            <p className="bf-sub">on <strong>every certification service</strong> on Certify.cx.</p>
          </div>
          <div className="bf-modal__art"><GiftBox /></div>
        </div>

        <div className="bf-timer">
          <span className="bf-timer__label">Offer ends in:</span>
          <div className="bf-timer__boxes">
            {boxes.map(([v, l], i) => (
              <span className="bf-timer__item" key={l}>
                <span className="bf-timer__box"><b>{v}</b><small>{l}</small></span>
                {i < 3 && <span className="bf-timer__sep" aria-hidden="true">:</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="bf-actions">
          <div className="bf-code">
            <Tag size={22} className="bf-code__icon" />
            <div><small>Your code</small><strong>{BF_CODE}</strong></div>
            <CopyCode />
          </div>
          <Link to={BF_CTA_PATH} className="bf-claim" onClick={onClose}>Claim {BF_DISCOUNT}% Off Now <ArrowRight size={18} /></Link>
        </div>

        <ul className="bf-perks">
          <li><BadgeCheck size={22} /><span><b>No Hidden Fees</b>Pay full price, get {BF_DISCOUNT}% off</span></li>
          <li><ShieldCheck size={22} /><span><b>Works on All Services</b>Applied at checkout</span></li>
          <li><Clock size={22} /><span><b>One-Time Use</b>Hurry, offer ends soon!</span></li>
        </ul>

        <p className="bf-fine">Discount applies automatically at checkout, or enter code {BF_CODE}. Offer ends Nov 30, 2026 at 11:59pm PKT.</p>
      </div>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export default function BlackFriday() {
  const clock = useSaleClock();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const live = clock.live;

  // Push the page down by the banner's height (fixed headers read --bf-h). Removed when the sale ends.
  useEffect(() => {
    if (!live) return undefined;
    document.documentElement.classList.add('has-bf');
    return () => document.documentElement.classList.remove('has-bf');
  }, [live]);

  const popupAllowed = !BF_POPUP_SKIP.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!live || !popupAllowed) return undefined;
    let seen = false;
    try { seen = localStorage.getItem(BF_POPUP_STORAGE_KEY) === today(); } catch { /* storage blocked: show it */ }
    if (seen) return undefined;
    const id = setTimeout(() => setOpen(true), BF_POPUP_DELAY_MS);
    return () => clearTimeout(id);
  }, [live, popupAllowed]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(BF_POPUP_STORAGE_KEY, today()); } catch { /* ignore */ }
  };

  if (!live) return null;
  return (
    <>
      <Banner clock={clock} />
      {open && popupAllowed && <Popup clock={clock} onClose={close} />}
    </>
  );
}
