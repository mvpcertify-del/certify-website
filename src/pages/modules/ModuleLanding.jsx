import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight, Check, FileText, TriangleAlert, ClipboardCheck, ListChecks, ChartColumn, GraduationCap, Truck,
  FolderCheck, Landmark, Boxes, ShoppingCart, Users, Wrench, Layers, RefreshCw,
} from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import MicroFooter from '../micro/MicroFooter';
import { LANDINGS, MODULE_PLANS } from '../../content/moduleLandings';
import './ModuleLanding.css';

// Certify.cx QMS (/qms) and Certify.cx ERP (/erp). One page, two sets of copy (src/content/moduleLandings.js).
// Frontend only: the "Request early access" buttons go to sign-up with ?module=<key>, and the subscription and
// billing behind them belong to the backend.

const ICONS = { FileText, TriangleAlert, ClipboardCheck, ListChecks, ChartColumn, GraduationCap, Truck, FolderCheck, Landmark, Boxes, ShoppingCart, Users, Wrench };

const money = (n) => `$${n.toLocaleString('en-US')}`;

function Price({ moduleKey, period }) {
  const v = MODULE_PLANS[moduleKey]?.[period];
  if (v == null) return <span className="ml-price__ask">Price on request</span>;
  return <><span className="ml-price__num">{money(v)}</span><span className="ml-price__per"> / {period === 'monthly' ? 'month' : 'year'}</span></>;
}

export default function ModuleLanding({ module: key }) {
  const d = LANDINGS[key];
  const other = d ? LANDINGS[d.other] : null;
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    if (!d) return undefined;
    const prev = document.title;
    document.title = `${d.name} — ${d.badge} | Certify.cx`;
    return () => { document.title = prev; };
  }, [d]);

  if (!d) return <Navigate to="/" replace />;
  const signup = `/signup?module=${d.key}`;

  return (
    <div className="ml">
      <PublicNav />

      <section className="ml-hero">
        <div className="ml-container ml-hero__inner">
          <div>
            <span className="ml-pill"><Layers size={14} /> {d.badge}</span>
            <h1 className="ml-h1">{d.title}</h1>
            <p className="ml-lead">{d.lead}</p>
            <div className="ml-hero__cta">
              <Link to={signup} className="ml-btn ml-btn--primary">{d.cta} <ArrowRight size={16} /></Link>
              <a href="#pricing" className="ml-btn ml-btn--ghost">See subscription</a>
            </div>
          </div>
          <div className="ml-stats" aria-label="Highlights">
            {d.stats.map(([big, small]) => (
              <div className="ml-stat" key={big}><b>{big}</b><span>{small}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="ml-section" id="features">
        <div className="ml-container">
          <h2 className="ml-h2">{d.featuresTitle}</h2>
          <p className="ml-sub">{d.featuresLead}</p>
          <div className="ml-grid">
            {d.features.map((f) => {
              const Icon = ICONS[f.icon] || Layers;
              return (
                <article className="ml-card" key={f.title}>
                  <div className="ml-card__top">
                    <span className="ml-card__icon"><Icon size={20} /></span>
                    <span className={`ml-badge ml-badge--${f.status}`}>{f.status === 'live' ? 'Available' : 'Coming soon'}</span>
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <small>{f.clause}</small>
                </article>
              );
            })}
          </div>
          <p className="ml-note">{d.note}</p>
        </div>
      </section>

      <section className="ml-section ml-section--alt">
        <div className="ml-container">
          <h2 className="ml-h2">{d.stepsTitle}</h2>
          <ol className="ml-steps">
            {d.steps.map(([t, x], i) => (
              <li key={t}><span className="ml-steps__n">{i + 1}</span><h3>{t}</h3><p>{x}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ml-section" id="pricing">
        <div className="ml-container">
          <h2 className="ml-h2">Subscribe to {d.name}</h2>
          <p className="ml-sub">Each module has its own subscription. Take one now and add the other later.</p>

          <div className="ml-toggle" role="group" aria-label="Billing period">
            <button type="button" className={period === 'monthly' ? 'is-on' : ''} onClick={() => setPeriod('monthly')}>Monthly</button>
            <button type="button" className={period === 'yearly' ? 'is-on' : ''} onClick={() => setPeriod('yearly')}>Yearly</button>
          </div>

          <div className="ml-plans">
            <div className="ml-plan ml-plan--main">
              <span className="ml-plan__tag">This module</span>
              <h3>{d.name}</h3>
              <div className="ml-price"><Price moduleKey={d.key} period={period} /></div>
              <ul>
                {d.features.slice(0, 5).map((f) => <li key={f.title}><Check size={15} /> {f.title}</li>)}
              </ul>
              <Link to={signup} className="ml-btn ml-btn--primary ml-btn--block">{d.cta} <ArrowRight size={16} /></Link>
            </div>

            <div className="ml-plan">
              <span className="ml-plan__tag ml-plan__tag--alt"><RefreshCw size={12} /> Add later</span>
              <h3>{other.name}</h3>
              <div className="ml-price"><Price moduleKey={other.key} period={period} /></div>
              <p className="ml-plan__text">{other.badge}. Add it to your workspace at any time. It has its own subscription and does not change the first one.</p>
              <Link to={other.path} className="ml-btn ml-btn--ghost ml-btn--block">Learn about {other.name} <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </section>

      <MicroFooter />
    </div>
  );
}
