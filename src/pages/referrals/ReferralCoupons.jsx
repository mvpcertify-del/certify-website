import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Copy, Check } from 'lucide-react';
import './Referrals.css';

// "Coupons to share" — one of the six boxes the client asked for on the
// Referral Program Dashboard (6 Sep).
//
// The discount code and the referral link used to sit halfway down the Clients
// screen, under the stats. They are MOVED here rather than copied: two screens
// showing the same code is two places to fix when the code changes, and the
// dashboard box now exists precisely so this has somewhere of its own to live.
export default function ReferralCoupons() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [copied, setCopied] = useState('');

  // The partner's real, stored code (phase25 profiles.referral_code). A partner
  // whose row predates that migration has none; the screen says so rather than
  // showing a code that would be rejected at checkout.
  const referralCode = user?.referral_code || '';
  const codeReady = Boolean(referralCode);

  // Points at CHECKOUT, not signup — the live funnel creates the account during
  // payment, so a link to /signup records no referral at all.
  const referralLink = codeReady
    ? `${window.location.origin}/checkout?ref=${encodeURIComponent(referralCode)}`
    : '';

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch { /* clipboard blocked — the field is still selectable by hand */ }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refDash.coupons')}</h1>
          <p className="page-subtitle">{t('refDash.couponsDesc')}</p>
        </div>
      </div>

      <div className="referral-link-card">
        <div className="referral-link-card__title">{t('referrals.yourDiscountCode')}</div>
        {codeReady ? (
          <>
            <div className="referral-code-display">{referralCode}</div>
            <div className="referral-link-card__row" style={{ marginTop: '0.75rem' }}>
              <button className="referral-link-card__btn" onClick={() => copy('code', referralCode)}>
                {copied === 'code'
                  ? <><Check size={16} /> {t('common.copied')}</>
                  : <><Copy size={16} /> {t('referrals.copyCode')}</>}
              </button>
            </div>
            <p className="referral-link-card__hint">{t('referrals.discountCodeHint')}</p>

            <div className="referral-link-card__title" style={{ marginTop: '1.25rem' }}>
              {t('referrals.yourReferralLink')}
            </div>
            <div className="referral-link-card__row">
              <input
                className="referral-link-card__input"
                value={referralLink}
                readOnly
                onClick={(e) => e.target.select()}
              />
              <button className="referral-link-card__btn" onClick={() => copy('link', referralLink)}>
                {copied === 'link'
                  ? <><Check size={16} /> {t('common.copied')}</>
                  : <><Copy size={16} /> {t('referrals.copyLink')}</>}
              </button>
            </div>
            <p className="referral-link-card__hint">{t('referrals.shareLinkHint')}</p>
          </>
        ) : (
          <p className="referral-link-card__hint">{t('referrals.codePending')}</p>
        )}
      </div>

      {/* How the code turns into money. It belongs next to the code itself —
          this is the answer to the question a partner asks while looking at it. */}
      <div className="referral-section">
        <h3 className="referral-section__title">{t('referrals.howItWorks')}</h3>
        <div className="referral-how-it-works">
          {[1, 2, 3, 4].map((n) => (
            <div className="referral-how-step" key={n}>
              <div className="referral-how-step__num">{n}</div>
              <div className="referral-how-step__title">{t(`referrals.step${n}Title`)}</div>
              <div className="referral-how-step__desc">{t(`referrals.step${n}Desc`)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
