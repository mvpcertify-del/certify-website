import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, CreditCard, Banknote, Landmark, Lock, CheckCircle2, Copy,
  ArrowRight, Mail, AlertCircle, MailCheck,
} from 'lucide-react';
import { computeTotal } from '../../utils/pricing';
import { getIsoBySlug } from '../../utils/isoCatalog';
import {
  PAYMENT_METHODS, isOfflineMethod, BANK_TRANSFER_DETAILS, CASH_DETAILS,
} from '../../config/paymentMethods';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import './Checkout.css';

const METHOD_ICONS = { CreditCard, Banknote, Landmark };

// -------------------------------------------------------
// Public pay-first checkout.
//
// The buyer arrives here straight from a package card — no signup gate, no
// pre-purchase email verification. They fill in contact details, pick a
// payment method, and pay. The account is created server-side during
// /api/checkout (action:'guest-checkout') and a dashboard magic link is
// emailed once payment is confirmed.
//
//   /checkout?tier=&iso=&staff=&locations=   → the form
//   /checkout/success?app=&session_id=       → post-Stripe confirmation
// -------------------------------------------------------
// Dispatcher: /checkout renders the form, /checkout/success the confirmation.
// Kept as its own component so neither path calls hooks conditionally.
export default function Checkout() {
  const location = useLocation();
  if (location.pathname.endsWith('/success')) return <CheckoutSuccess />;
  return <CheckoutForm />;
}

function CheckoutForm() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const tier = (searchParams.get('tier') || 'silver').toLowerCase();
  const isoSlug = searchParams.get('iso') || 'iso-9001';
  const staff = Math.max(0, Math.floor(Number(searchParams.get('staff')) || 0));
  const locations = Math.max(0, Math.floor(Number(searchParams.get('locations')) || 0));
  const cancelled = searchParams.get('cancelled') === '1';

  const isoConfig = getIsoBySlug(isoSlug);
  const isoCode = isoConfig?.code || 'ISO 9001';
  const PACKAGE_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
  const packageLabel = PACKAGE_LABELS[tier] || 'Bronze';

  const totals = useMemo(
    () => computeTotal({ standardSlug: isoSlug, tier, employeeBands: staff, locations }),
    [isoSlug, tier, staff, locations]
  );

  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', country: '' });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [offlineOrder, setOfflineOrder] = useState(null);

  const offlineSelected = isOfflineMethod(paymentMethod);
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError(t('checkout.errName')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError(t('checkout.errEmail')); return; }

    setProcessing(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'guest-checkout',
          isoName: isoSlug,
          tier,
          employeeBands: staff,
          additionalLocations: locations,
          paymentMethod,
          contact: {
            name: form.name.trim(),
            email: form.email.trim(),
            company: form.company.trim(),
            phone: form.phone.trim(),
            country: form.country.trim(),
          },
        }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch {
        throw new Error(res.status >= 500
          ? t('payment.serverUnavailable')
          : `Unexpected response (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error || t('checkout.errGeneric'));

      if (data.offline) {
        setOfflineOrder({ method: paymentMethod, amount: data.amount, orderId: data.applicationId });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(t('checkout.errGeneric'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const copy = (text) => { try { navigator.clipboard?.writeText(text); } catch { /* ignore */ } };

  // -------- OFFLINE INSTRUCTIONS (order received, access after admin verify) --------
  if (offlineOrder) {
    const isBank = offlineOrder.method === 'bank_transfer';
    const rows = isBank
      ? [
          { label: t('payment.bankBeneficiary'), value: BANK_TRANSFER_DETAILS.beneficiary },
          { label: t('payment.bankName'), value: BANK_TRANSFER_DETAILS.bankName },
          { label: t('payment.bankIban'), value: BANK_TRANSFER_DETAILS.iban, copy: true },
          { label: t('payment.bankSwift'), value: BANK_TRANSFER_DETAILS.swift, copy: true },
        ]
      : [
          { label: t('checkout.cashPayee'), value: CASH_DETAILS.payee },
          { label: t('checkout.cashContact'), value: CASH_DETAILS.contact, copy: true },
        ];

    return (
      <div className="checkout">
        <div className="checkout__panel checkout__panel--narrow">
          <div className="checkout__result-head checkout__result-head--info">
            <div className="checkout__result-icon"><CheckCircle2 size={30} /></div>
            <h1>{t('checkout.offlineTitle')}</h1>
            <p>{t('checkout.offlineDesc')}</p>
          </div>
          <div className="checkout__result-body">
            <div className="checkout__amount-row">
              <span>{t('payment.amountToTransfer')}</span>
              <strong>${offlineOrder.amount.toLocaleString()}</strong>
            </div>
            <h3 className="checkout__section-label">{t('payment.transferInstructionsTitle')}</h3>
            <div className="checkout__detail-box">
              {rows.map((row) => (
                <div key={row.label} className="checkout__detail-row">
                  <span>{row.label}</span>
                  <span className={row.copy ? 'checkout__mono' : ''}>
                    {row.value}
                    {row.copy && (
                      <button type="button" onClick={() => copy(row.value)} aria-label="Copy" className="checkout__copy">
                        <Copy size={14} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
              <div className="checkout__detail-row">
                <span>{t('payment.transferReference')}</span>
                <span className="checkout__mono">
                  {offlineOrder.orderId}
                  <button type="button" onClick={() => copy(offlineOrder.orderId)} aria-label="Copy" className="checkout__copy">
                    <Copy size={14} />
                  </button>
                </span>
              </div>
            </div>
            {!isBank && <p className="checkout__note">{t('checkout.cashInstructions')}</p>}
            <Link to="/" className="checkout__ghost-btn">{t('checkout.backHome')}</Link>
          </div>
        </div>
      </div>
    );
  }

  // -------- CHECKOUT FORM --------
  return (
    <div className="checkout">
      <header className="checkout__topbar">
        <Link to="/" className="checkout__logo">
          <div className="checkout__logo-icon"><Shield size={18} /></div>
          <span>Certify.cx<sup className="brand-tm">&trade;</sup></span>
        </Link>
        <LanguageSwitcher variant="landing" />
      </header>

      <div className="checkout__grid">
        {/* ORDER SUMMARY */}
        <aside className="checkout__summary">
          <span className="checkout__summary-tag">{t('checkout.orderSummary')}</span>
          <div className="checkout__summary-iso">
            <span className="checkout__summary-code">{isoCode}</span>
            <span className="checkout__summary-pkg">{packageLabel} {t('checkout.package')}</span>
          </div>
          <div className="checkout__lines">
            <div className="checkout__line">
              <span>{t('pricing.lineItem.base')}</span>
              <span>${totals.base.toLocaleString()}</span>
            </div>
            {totals.employeeSurchargeTotal > 0 && (
              <div className="checkout__line">
                <span>{t('checkout.extraEmployees')}</span>
                <span>+${totals.employeeSurchargeTotal.toLocaleString()}</span>
              </div>
            )}
            {totals.locationSurchargeTotal > 0 && (
              <div className="checkout__line">
                <span>{t('checkout.extraLocations')}</span>
                <span>+${totals.locationSurchargeTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="checkout__total">
            <span>{t('payment.totalAmount')}</span>
            <strong>${totals.subtotal.toLocaleString()}</strong>
          </div>
          <p className="checkout__summary-note">{t('pricing.disclaimer')}</p>
        </aside>

        {/* FORM */}
        <form className="checkout__form" onSubmit={handleSubmit}>
          <h1 className="checkout__title">{t('checkout.title')}</h1>
          <p className="checkout__subtitle">{t('checkout.subtitle')}</p>

          {cancelled && (
            <div className="checkout__alert checkout__alert--info">
              <AlertCircle size={16} /> {t('checkout.cancelledNote')}
            </div>
          )}

          {/* Contact details */}
          <h2 className="checkout__section-label">{t('checkout.contactTitle')}</h2>
          <div className="checkout__fields">
            <label className="checkout__field checkout__field--full">
              <span>{t('checkout.fullName')} *</span>
              <input type="text" value={form.name} onChange={setField('name')} autoComplete="name" required />
            </label>
            <label className="checkout__field checkout__field--full">
              <span>{t('checkout.email')} *</span>
              <input type="email" value={form.email} onChange={setField('email')} autoComplete="email" required />
              <small><Mail size={12} /> {t('checkout.emailHint')}</small>
            </label>
            <label className="checkout__field">
              <span>{t('checkout.company')}</span>
              <input type="text" value={form.company} onChange={setField('company')} autoComplete="organization" />
            </label>
            <label className="checkout__field">
              <span>{t('checkout.phone')}</span>
              <input type="tel" value={form.phone} onChange={setField('phone')} autoComplete="tel" />
            </label>
            <label className="checkout__field checkout__field--full">
              <span>{t('checkout.country')}</span>
              <input type="text" value={form.country} onChange={setField('country')} autoComplete="country-name" />
            </label>
          </div>

          {/* Payment method — stacked, one on top of the other */}
          <h2 className="checkout__section-label">{t('payment.choosePaymentMethod')}</h2>
          <div className="checkout__methods">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m.icon] || CreditCard;
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`checkout__method ${active ? 'checkout__method--active' : ''}`}
                  onClick={() => setPaymentMethod(m.id)}
                >
                  <span className="checkout__method-icon"><Icon size={18} /></span>
                  <span className="checkout__method-text">
                    <strong>{t(m.labelKey)}</strong>
                    <small>{t(m.descKey)}</small>
                  </span>
                  <span className="checkout__method-radio">{active && <CheckCircle2 size={18} />}</span>
                </button>
              );
            })}
          </div>

          {offlineSelected && (
            <div className="checkout__alert checkout__alert--info">
              <AlertCircle size={16} /> {t('checkout.offlineHint')}
            </div>
          )}

          {error && (
            <div className="checkout__alert checkout__alert--error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button type="submit" className="checkout__submit" disabled={processing}>
            {processing ? (
              <><span className="checkout__spinner" /> {t('common.processing')}</>
            ) : (
              <><Lock size={17} /> {offlineSelected ? t('checkout.placeOrderButton') : t('checkout.payButton')} · ${totals.subtotal.toLocaleString()}</>
            )}
          </button>

          <p className="checkout__legal">
            {t('auth.legalPrefix')}{' '}
            <Link to="/terms">{t('auth.termsLink')}</Link> {t('auth.legalAnd')}{' '}
            <Link to="/privacy">{t('auth.privacyLink')}</Link>.
          </p>
          <p className="checkout__signin">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/login">{t('auth.signIn')} <ArrowRight size={12} /></Link>
          </p>
        </form>
      </div>
    </div>
  );
}

// -------- POST-STRIPE SUCCESS --------
// Verifies the Stripe session server-side, then tells the buyer to check their
// inbox for the dashboard access link.
function CheckoutSuccess() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('app');
  const sessionId = searchParams.get('session_id');

  const [state, setState] = useState('confirming'); // confirming | done | error
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!applicationId || !sessionId) { setState('error'); setMessage(t('checkout.errGeneric')); return; }
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm-guest-payment', applicationId, sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setState('error'); setMessage(data.error || t('checkout.errGeneric')); return; }
        setEmail(data.email || '');
        setState('done');
      } catch {
        if (!cancelled) { setState('error'); setMessage(t('checkout.errGeneric')); }
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId, sessionId, t]);

  return (
    <div className="checkout">
      <div className="checkout__panel checkout__panel--narrow">
        <div className={`checkout__result-head ${state === 'error' ? 'checkout__result-head--error' : 'checkout__result-head--success'}`}>
          <div className="checkout__result-icon">
            {state === 'confirming' && <span className="checkout__spinner checkout__spinner--lg" />}
            {state === 'done' && <MailCheck size={30} />}
            {state === 'error' && <AlertCircle size={30} />}
          </div>
          <h1>
            {state === 'confirming' && t('checkout.confirming')}
            {state === 'done' && t('checkout.successTitle')}
            {state === 'error' && t('checkout.errTitle')}
          </h1>
          <p>
            {state === 'confirming' && t('checkout.confirmingDesc')}
            {state === 'done' && t('checkout.successDesc')}
            {state === 'error' && (message || t('checkout.errGeneric'))}
          </p>
        </div>
        {state === 'done' && (
          <div className="checkout__result-body">
            {email && <p className="checkout__sent-to"><Mail size={14} /> {t('checkout.emailSentTo', { email })}</p>}
            <Link to="/login" className="checkout__ghost-btn">{t('auth.signIn')}</Link>
          </div>
        )}
        {state === 'error' && (
          <div className="checkout__result-body">
            <Link to="/" className="checkout__ghost-btn">{t('checkout.backHome')}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
