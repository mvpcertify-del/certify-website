import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft, ClipboardPaste } from 'lucide-react';
import { Input, Button } from '../ui/FormElements';
import { OTP_MAX_LENGTH, OTP_RESEND_SECONDS, isValidOtp, normalizeOtp } from '../../config/loginMode';

// The "verify your email" step of code sign-up: the person types the six-digit code that was
// just emailed. The page that owns the form does the actual work through the three callbacks, so
// the same step serves the client form and every partner registration.
//   onVerify(code)  checks the code, then creates the account
//   onResend()      emails a new code (resolves { success })
//   onBack()        back to the form (to fix the email)
export default function SignupCodeStep({ email, onVerify, onResend, onBack, loading, error, title, subtitle, verifyLabel }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');
  const [cooldown, setCooldown] = useState(OTP_RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = (e) => {
    e.preventDefault();
    if (!isValidOtp(code)) {
      setLocalError(t('auth.otpInvalid'));
      return;
    }
    setLocalError('');
    onVerify(normalizeOtp(code));
  };

  const resend = async () => {
    setLocalError('');
    const result = await onResend();
    if (result?.success) setCooldown(OTP_RESEND_SECONDS);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = String(text || '').replace(/\D/g, '').slice(0, OTP_MAX_LENGTH);
      if (digits) setCode(digits);
    } catch { /* clipboard blocked: paste into the box by hand */ }
  };

  const shown = localError || error;

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
        <Input
          label={t('auth.otpLabel')}
          id="login-otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_MAX_LENGTH + 2}
          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))}
          autoFocus
          required
        />
        <button type="button" className="auth-otp-paste" onClick={paste}>
          <ClipboardPaste size={16} /> {t('auth.otpPaste', 'Paste code')}
        </button>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {verifyLabel || t('auth.signupCodeVerify')}
        </Button>
        <div className="auth-otp-actions">
          <button type="button" className="auth-back-link" onClick={onBack} disabled={loading}>
            <ArrowLeft size={16} /> {t('auth.otpUseDifferentEmail')}
          </button>
          <button
            type="button"
            className="auth-form__link auth-otp-resend"
            disabled={cooldown > 0 || loading}
            onClick={resend}
          >
            {cooldown > 0 ? t('auth.otpResendIn', { s: cooldown }) : t('auth.otpResend')}
          </button>
        </div>
      </form>
    </div>
  );
}
