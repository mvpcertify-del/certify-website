import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, Clock, MapPin, ShieldCheck, Sparkles, Users, Award, CircleCheck } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import SegmentBar from '../../components/layout/SegmentBar';
import { BlogFooter } from '../blog/BlogParts';
import usePageMeta from '../blog/usePageMeta';
import { apiPost } from '../../lib/apiClient';
import '../blog/Blog.css'; // the footer's styles
import './MicroLanding.css';
import './MicroBudget.css';

// ============================================
// Certify.cx — "What's your budget?" (/micro/budget)
// ============================================
// A special offer for MICRO companies (client, 18 Nov): ISO 9001 only, 1 to 9 employees, 1 location. The company
// moves the slider to a price from $500 to $1,500 inside its budget, sends its details and hears back by email
// within 3 hours if approved. The price covers all three stages and a certificate valid for one year.
// Valid up to 31.12.2026. Requests are decided in Super Admin > Sales > Micro Offer Requests.

const MIN = 500;
const MAX = 1500;
const STEP = 50;
const STAGES = [
  { title: 'Free gap assessment', text: 'A clear picture of where your company stands against ISO 9001.' },
  { title: 'Quality system creation and implementation', text: 'Build and put in place a quality system that fits a very small team.' },
  { title: 'Certification preparation', text: 'Get fully prepared, then certified, with the certificate valid for one year.' },
];
const EMPTY = { company_name: '', website: '', contact_name: '', job_title: '', phone: '', email: '', main_activity: '', employees: '', message: '', one_location: false, fax: '' };

const usd = (n) => `$${Number(n).toLocaleString('en-US')}`;
const clamp = (n) => Math.min(MAX, Math.max(MIN, Math.round(Number(n) / STEP) * STEP || MIN));

export default function MicroBudget() {
  usePageMeta("What's your budget? ISO 9001 for MICRO companies | Certify.cx™ — Global Compliance Marketplace", 'A limited-time offer for MICRO companies with 1 to 9 employees: ISO 9001 from $500 to $1,500, all three stages and a certificate valid for one year.');

  const [params] = useSearchParams();
  const [budget, setBudget] = useState(() => clamp(params.get('budget') || 900));
  const [typed, setTyped] = useState(String(clamp(params.get('budget') || 900)));
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | done | duplicate
  const [apiError, setApiError] = useState('');

  const fill = useMemo(() => `${((budget - MIN) / (MAX - MIN)) * 100}%`, [budget]);
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const moveSlider = (v) => { const n = clamp(v); setBudget(n); setTyped(String(n)); };
  const commitTyped = () => moveSlider(typed);

  const submit = async (e) => {
    e.preventDefault();
    setApiError('');
    setErrors({});
    setState('sending');
    try {
      const out = await apiPost('/api/notify-event', { action: 'micro-offer-submit', ...form, employees: Number(form.employees), budget_usd: budget });
      if (out?.ok === false) {
        // The server lists what is wrong, field by field.
        setErrors(out.errors || {});
        setState('idle');
        return;
      }
      setState(out?.duplicate ? 'duplicate' : 'done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setState('idle');
      setApiError(err?.message || 'Something went wrong. Please try again.');
    }
  };

  const field = (k, label, props = {}) => (
    <label className={`mb-field${errors[k] ? ' mb-field--bad' : ''}`}>
      <span className="mb-field__label">{label}</span>
      <input value={form[k]} onChange={setField(k)} {...props} />
      {errors[k] && <span className="mb-field__err" role="alert">{errors[k]}</span>}
    </label>
  );

  return (
    <div className="micro mb">
      <PublicNav />
      <SegmentBar active="micro" />

      {/* ---------------- Limited-time header ---------------- */}
      <div className="mb-banner" role="note">
        <Sparkles size={16} aria-hidden="true" />
        <strong>NEW</strong> <span>Limited time offer valid up to 31.12.2026</span>
      </div>

      <section className="mb-hero">
        <div className="micro-container">
          <span className="micro-pill">MICRO companies · ISO 9001</span>
          <h1 className="mb-hero__title">What&apos;s your <span className="micro-accent">budget?</span></h1>
          <p className="mb-hero__sub">Choose the price that fits your budget, from {usd(MIN)} to {usd(MAX)}. ISO 9001 certification for companies with 1 to 9 employees and 1 location.</p>
          <ul className="mb-chips">
            <li><Award size={15} /> ISO 9001 only</li>
            <li><Users size={15} /> 1 to 9 employees</li>
            <li><MapPin size={15} /> 1 location</li>
            <li><Clock size={15} /> Reply within 3 hours if approved</li>
          </ul>
        </div>
      </section>

      <main className="micro-container mb-grid">
        {/* ---------------- Left: price and what is included ---------------- */}
        <section className="mb-card mb-price" aria-labelledby="mb-price-h">
          <h2 id="mb-price-h" className="mb-card__title">Slide to your budget</h2>
          <div className="mb-price__value" aria-live="polite">{usd(budget)}</div>
          <input
            className="mb-range" type="range" min={MIN} max={MAX} step={STEP} value={budget}
            style={{ '--fill': fill }} onChange={(e) => moveSlider(e.target.value)} aria-label="Budget in US dollars"
          />
          <div className="mb-range__ends"><span>{usd(MIN)}</span><span>{usd(MAX)}</span></div>

          <label className="mb-amount">
            <span>Or type your budget (USD)</span>
            <input type="number" inputMode="numeric" min={MIN} max={MAX} step={STEP} value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={commitTyped} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTyped(); } }} />
          </label>

          <h3 className="mb-sub">Your price includes all three stages</h3>
          <ol className="mb-stages">
            {STAGES.map((s, i) => (
              <li key={s.title}>
                <span className="mb-stages__n">{i + 1}</span>
                <span><strong>{s.title}</strong><small>{s.text}</small></span>
              </li>
            ))}
          </ol>
          <div className="mb-cert"><ShieldCheck size={22} aria-hidden="true" /> <span><strong>Certificate valid for 1 year</strong> is included.</span></div>
        </section>

        {/* ---------------- Right: the request ---------------- */}
        <section className="mb-card mb-form" aria-labelledby="mb-form-h">
          {state === 'done' || state === 'duplicate' ? (
            <div className="mb-done" role="status">
              <CircleCheck size={44} aria-hidden="true" />
              <h2>{state === 'duplicate' ? 'We already have your request' : 'Request received'}</h2>
              <p>
                {state === 'duplicate'
                  ? 'You sent a request in the last 24 hours, so we kept the first one.'
                  : `Thank you. We will reply by email within 3 hours if the offer is approved, to ${form.email}.`}
              </p>
              <p className="mb-done__small">Your budget: <strong>{usd(budget)}</strong> · ISO 9001 · valid up to 31.12.2026</p>
              <Link to="/micro" className="micro-btn micro-btn--outline">Back to MICRO companies</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 id="mb-form-h" className="mb-card__title">Tell us about your company</h2>
              <p className="mb-form__lead">Your budget: <strong>{usd(budget)}</strong>. You will hear from us by email.</p>

              {field('company_name', 'Company name', { required: true, autoComplete: 'organization' })}
              {field('website', 'Website', { type: 'text', placeholder: 'www.yourcompany.com', autoComplete: 'url' })}
              <div className="mb-row">
                {field('contact_name', 'Contact person', { required: true, autoComplete: 'name' })}
                {field('job_title', 'Job title', { required: true, autoComplete: 'organization-title' })}
              </div>
              <div className="mb-row">
                {field('phone', 'Contact number', { type: 'tel', required: true, autoComplete: 'tel', placeholder: '+971 50 000 0000' })}
                {field('email', 'Email', { type: 'email', required: true, autoComplete: 'email' })}
              </div>
              {field('main_activity', 'Main activity of the company', { required: true, placeholder: 'For example: bakery, accounting services, web design' })}
              <label className={`mb-field${errors.employees ? ' mb-field--bad' : ''}`}>
                <span className="mb-field__label">Number of employees</span>
                <select value={form.employees} onChange={setField('employees')} required>
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                {errors.employees && <span className="mb-field__err" role="alert">{errors.employees}</span>}
              </label>
              <label className="mb-field">
                <span className="mb-field__label">Message (optional)</span>
                <textarea rows={3} value={form.message} onChange={setField('message')} maxLength={1000} />
              </label>

              {/* Bots fill this in; people never see it. */}
              <div className="mb-trap" aria-hidden="true"><label>Fax<input tabIndex={-1} autoComplete="off" value={form.fax} onChange={setField('fax')} /></label></div>

              <label className={`mb-check${errors.one_location ? ' mb-check--bad' : ''}`}>
                <input type="checkbox" checked={form.one_location} onChange={setField('one_location')} />
                <span>My company has 1 location and 1 to 9 employees.</span>
              </label>
              {errors.one_location && <p className="mb-field__err" role="alert">{errors.one_location}</p>}
              {errors.budget_usd && <p className="mb-field__err" role="alert">{errors.budget_usd}</p>}
              {errors.offer && <p className="mb-field__err" role="alert">{errors.offer}</p>}
              {apiError && <p className="mb-field__err" role="alert">{apiError}</p>}

              <button type="submit" className="micro-btn micro-btn--primary micro-btn--block" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending...' : <>Request this offer at {usd(budget)} <ArrowRight size={16} /></>}
              </button>
              <p className="mb-fine"><BadgeCheck size={14} aria-hidden="true" /> Confirmation within 3 hours if approved.</p>
            </form>
          )}
        </section>
      </main>

      <section className="micro-container mb-terms">
        <h2>Offer terms</h2>
        <ul>
          <li><Check size={14} /> Valid up to 31.12.2026.</li>
          <li><Check size={14} /> Only for MICRO companies: 1 to 9 employees and 1 location.</li>
          <li><Check size={14} /> Applies to ISO 9001 only. One standard per company.</li>
          <li><Check size={14} /> The price covers all three stages and a certificate valid for one year.</li>
          <li><Check size={14} /> Each request is reviewed. You are told the result by email.</li>
        </ul>
      </section>

      <BlogFooter />
    </div>
  );
}
