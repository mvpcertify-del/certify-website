import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/FormElements';
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS } from '../../config/loginMode';

// The "verify your email" step: six boxes for the six-digit code that was just emailed. The page that owns the
// form does the real work through the callbacks, so the same step serves the client form and every partner
// registration.
//   onVerify(code)  checks the code, then creates the account. Resolve { success: false } for a wrong code
//   onResend()      emails a new code (resolves { success })
//   onBack()        back to the form
// After OTP_MAX_ATTEMPTS wrong codes the boxes lock until a new code is requested.
export default function SignupCodeStep({ email, onVerify, onResend, onBack, loading, error, title, subtitle, verifyLabel, backLabel }) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(OTP_RESEND_SECONDS);
  const boxes = useRef([]);
  const locked = attempts >= OTP_MAX_ATTEMPTS;
  const code = digits.join('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const focusBox = (i) => boxes.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus();
  const fill = (text, from = 0) => {
    const chars = String(text || '').replace(/\D/g, '').slice(0, OTP_LENGTH - from).split('');
    if (!chars.length) return;
    setDigits((d) => { const next = [...d]; chars.forEach((c, k) => { next[from + k] = c; }); return next; });
    focusBox(from + chars.length);
  };

  const change = (i, value) => {
    const v = value.replace(/\D/g, '');
    if (!v) { setDigits((d) => { const n = [...d]; n[i] = ''; return n; }); return; }
    fill(v, i); // typing one digit moves on; pasting several fills the following boxes
  };
  const keyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i]) { e.preventDefault(); focusBox(i - 1); }
    if (e.key === 'ArrowLeft') focusBox(i - 1);
    if (e.key === 'ArrowRight') focusBox(i + 1);
  };
  const paste = (e) => { e.preventDefault(); fill(e.clipboardData.getData('text'), 0); };

  const submit = async (e) => {
    e.preventDefault();
    if (locked || code.length < OTP_LENGTH) return;
    const result = await onVerify(code);
    if (result && result.success === false) {
      setAttempts((a) => a + 1);
      setDigits(Array(OTP_LENGTH).fill(''));
      focusBox(0);
    }
  };

  const resend = async () => {
    const result = await onResend();
    if (result?.success) {
      setCooldown(OTP_RESEND_SECONDS);
      setAttempts(0);
      setDigits(Array(OTP_LENGTH).fill(''));
      focusBox(0);
    }
  };

  const shown = locked ? t('auth.otpTooManyAttempts') : error;

  return (
    <div className="auth-signup-code">
      <h2 className="auth-form__title">{title || t('auth.signupCodeTitle')}</h2>
      <p className="auth-form__subtitle">{subtitle || t('auth.signupCodeSubtitle', { email })}</p>

      {shown && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{shown}</span>
        </div>
      )}

      <form onSubmit={submit} className="auth-form__body">
        <div className="auth-otp-field">
          <span className="auth-otp-field__label" id="otp-label">{t('auth.otpLabel')}</span>
          <div className="auth-otp-boxes" role="group" aria-labelledby="otp-label" onPaste={paste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { boxes.current[i] = el; }}
                className="auth-otp-box"
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={OTP_LENGTH}
                value={d}
                disabled={locked || loading}
                aria-label={`${i + 1} / ${OTP_LENGTH}`}
                autoFocus={i === 0}
                onChange={(e) => change(i, e.target.value)}
                onKeyDown={(e) => keyDown(i, e)}
                onFocus={(e) => e.target.select()}
              />
            ))}
          </div>
          <span className="auth-otp-field__hint">{t('auth.otpHelper')}</span>
        </div>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} disabled={locked || code.length < OTP_LENGTH}>
          {verifyLabel || t('auth.signupCodeVerify')}
        </Button>

        <div className="auth-otp-resend-block">
          <span>{t('auth.otpDidnt')}</span>
          <button type="button" className="auth-form__link auth-otp-resend" disabled={cooldown > 0 || loading} onClick={resend}>
            {cooldown > 0 ? t('auth.otpResendIn', { s: cooldown }) : t('auth.otpResend')}
          </button>
        </div>

        <button type="button" className="auth-back-link auth-otp-back" onClick={onBack} disabled={loading}>
          <ArrowLeft size={16} /> {backLabel || t('auth.backToSignUp')}
        </button>
      </form>
    </div>
  );
}
