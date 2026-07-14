import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, CreditCard, Banknote, Landmark, Lock, CheckCircle2, Copy,
  ArrowRight, Mail, AlertCircle, MailCheck, Ticket, X, ChevronDown,
} from 'lucide-react';
import { computeTotal, PACKAGE_LABEL } from '../../utils/pricing';
import { getIsoBySlug } from '../../utils/isoCatalog';
import {
  PAYMENT_METHODS, isOfflineMethod, BANK_TRANSFER_DETAILS, CASH_DETAILS,
} from '../../config/paymentMethods';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import BrandLogo from '../../components/ui/BrandLogo';
import BackButton from '../../components/ui/BackButton';
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

  const isoSlug = searchParams.get('iso') || 'iso-9001';
  const staff = Math.max(0, Math.floor(Number(searchParams.get('staff')) || 0));
  const locations = Math.max(0, Math.floor(Number(searchParams.get('locations')) || 0));
  const cancelled = searchParams.get('cancelled') === '1';

  const isoConfig = getIsoBySlug(isoSlug);
  const isoCode = isoConfig?.code || 'ISO 9001';
  const packageLabel = PACKAGE_LABEL;

  const totals = useMemo(
    () => computeTotal({ standardSlug: isoSlug, employeeBands: staff, locations }),
    [isoSlug, staff, locations]
  );

  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', country: '' });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [offlineOrder, setOfflineOrder] = useState(null);

  // Discount code (collapsed by default). Applied client-side for the displayed
  // total; the server re-validates and re-applies the code authoritatively.
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const discountAmount = coupon ? Math.round(totals.subtotal * coupon.discount_percent) / 100 : 0;
  const finalTotal = Math.max(0, totals.subtotal - discountAmount);
  const money = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const validateCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-coupon', code }),
      });
      const data = await r.json();
      if (data.valid) {
        setCoupon(data.coupon);
        setCouponInput(data.coupon.code);
      } else {
        setCoupon(null);
        setCouponError(
          data.reason === 'expired' ? t('coupons.expiredCoupon')
          : data.reason === 'exhausted' ? t('coupons.exhaustedCoupon')
          : data.reason === 'inactive' ? t('coupons.inactiveCoupon')
          : t('coupons.invalidCoupon')
        );
      }
    } catch {
      setCoupon(null);
      setCouponError(t('coupons.invalidCoupon'));
    } finally {
      setValidatingCoupon(false);
    }
  };

  const clearCoupon = () => {
    setCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  const offlineSelected = isOfflineMethod(paymentMethod);
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Bank/cash beneficiary details, shown both in the on-select popup and on the
  // post-order confirmation screen. Single source so the two never drift.
  const offlineRows = (method) =>
    method === 'bank_transfer'
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

  // The client asked for a popup with the bank details the moment Bank Transfer
  // (or Cash) is chosen. `detailsFor` holds the method whose details are shown;
  // it auto-opens on switching TO an offline method, and can be reopened from
  // the "view details" link so re-renders don't nag the buyer.
  const [detailsFor, setDetailsFor] = useState(null);
  const selectMethod = (id) => {
    setPaymentMethod(id);
    if (isOfflineMethod(id)) setDetailsFor(id);
    else setDetailsFor(null);
  };

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
          employeeBands: staff,
          additionalLocations: locations,
          paymentMethod,
          couponCode: coupon?.code || null,
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
    const rows = offlineRows(offlineOrder.method);

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
        <BrandLogo size={26} />
        <LanguageSwitcher variant="landing" />
      </header>

      <BackButton />

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
            {coupon && (
              <div className="checkout__line checkout__line--discount">
                <span>{t('coupons.discount')} ({coupon.discount_percent}%)</span>
                <span>−${money(discountAmount)}</span>
              </div>
            )}
          </div>

          {/* Discount code — collapsed by default so it never distracts checkout */}
          <div className="checkout__coupon">
            {coupon ? (
              <div className="checkout__coupon-applied">
                <Ticket size={15} />
                <span className="checkout__coupon-code">{coupon.code}</span>
                <span className="checkout__coupon-off">−{coupon.discount_percent}%</span>
                <button type="button" className="checkout__coupon-remove" onClick={clearCoupon} aria-label={t('common.remove')}>
                  <X size={15} />
                </button>
              </div>
            ) : couponOpen ? (
              <div className="checkout__coupon-entry">
                <input
                  type="text"
                  className="checkout__coupon-input"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder={t('coupons.enterCode')}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validateCoupon(); } }}
                />
                <button
                  type="button"
                  className="checkout__coupon-apply"
                  onClick={validateCoupon}
                  disabled={!couponInput.trim() || validatingCoupon}
                >
                  {validatingCoupon ? t('common.processing') : t('coupons.applyCode')}
                </button>
              </div>
            ) : (
              <button type="button" className="checkout__coupon-toggle" onClick={() => setCouponOpen(true)}>
                <Ticket size={15} /> {t('coupons.haveCoupon')} <ChevronDown size={15} />
              </button>
            )}
            {couponError && <p className="checkout__coupon-error">{couponError}</p>}
          </div>

          <div className="checkout__total">
            <span>{t('payment.totalAmount')}</span>
            <strong>${money(finalTotal)}</strong>
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
                  onClick={() => selectMethod(m.id)}
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
              <AlertCircle size={16} />
              <span>
                {t('checkout.offlineHint')}{' '}
                <button
                  type="button"
                  className="checkout__inline-link"
                  onClick={() => setDetailsFor(paymentMethod)}
                >
                  {paymentMethod === 'bank_transfer' ? t('payment.viewBankDetails') : t('payment.viewCashDetails')}
                </button>
              </span>
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

      {/* Bank/cash details popup — opens on selecting an offline method. Kept
          checkout-local (not the shared themed Modal) so it stays light like
          the rest of this always-light page. */}
      {detailsFor && (
        <div className="checkout__modal-overlay" onClick={() => setDetailsFor(null)}>
          <div className="checkout__modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkout__modal-head">
              <h2>{detailsFor === 'bank_transfer' ? t('payment.bankDetailsTitle') : t('payment.cashDetailsTitle')}</h2>
              <button type="button" className="checkout__modal-close" onClick={() => setDetailsFor(null)} aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>
            <p className="checkout__modal-intro">
              {detailsFor === 'bank_transfer' ? t('payment.bankDetailsIntro') : t('payment.cashDetailsIntro')}
            </p>
            <div className="checkout__detail-box">
              {offlineRows(detailsFor).map((row) => (
                <div key={row.label} className="checkout__detail-row">
                  <span>{row.label}</span>
                  <span className={row.copy ? 'checkout__mono' : ''}>
                    {row.value}
                    {row.copy && (
                      <button type="button" onClick={() => copy(row.value)} aria-label={t('common.copy')} className="checkout__copy">
                        <Copy size={14} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="checkout__note">{t('payment.offlineAfterOrderNote')}</p>
            <button type="button" className="checkout__submit checkout__submit--modal" onClick={() => setDetailsFor(null)}>
              {t('common.gotIt')}
            </button>
          </div>
        </div>
      )}
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
  // Card payment no longer grants instant access — a Super Admin must approve
  // the account first. `pendingApproval` switches the success copy accordingly.
  const [pendingApproval, setPendingApproval] = useState(true);

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
        setPendingApproval(data.pendingApproval !== false);
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
            {state === 'done' && (pendingApproval ? t('checkout.paidPendingTitle') : t('checkout.successTitle'))}
            {state === 'error' && t('checkout.errTitle')}
          </h1>
          <p>
            {state === 'confirming' && t('checkout.confirmingDesc')}
            {state === 'done' && (pendingApproval ? t('checkout.paidPendingDesc') : t('checkout.successDesc'))}
            {state === 'error' && (message || t('checkout.errGeneric'))}
          </p>
        </div>
        {state === 'done' && (
          <div className="checkout__result-body">
            {email && (
              <p className="checkout__sent-to">
                <Mail size={14} /> {pendingApproval ? t('checkout.approvalEmailTo', { email }) : t('checkout.emailSentTo', { email })}
              </p>
            )}
            <Link to="/" className="checkout__ghost-btn">{t('checkout.backHome')}</Link>
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
