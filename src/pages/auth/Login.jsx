import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Button } from '../../components/ui/FormElements';
import { AlertCircle, ArrowLeft, Eye, EyeOff, MailCheck } from 'lucide-react';
import { ROLES } from '../../utils/roles';
import { PENDING_CHECKOUT_KEY } from '../public/StartCheckout';
import {
  LOGIN_OTP_ENABLED, OTP_RESEND_SECONDS, OTP_MAX_LENGTH, isValidOtp, normalizeOtp,
} from '../../config/loginMode';
import './Auth.css';

// Post-payment-first flow: forward to /client/start-payment which creates the
// stub application row and hands off to the payment checkout.
function consumePendingCheckout() {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    const { iso, staff, locations } = JSON.parse(raw);
    const params = new URLSearchParams({
      iso: iso || 'iso-9001',
    });
    // Carry the extra-staff / extra-locations selection through the login hop.
    if (staff) params.set('staff', String(staff));
    if (locations) params.set('locations', String(locations));
    return { path: `/client/start-payment?${params.toString()}` };
  } catch {
    return null;
  }
}

export default function Login() {
  const { login, requestLoginOtp, verifyLoginOtp, getRoleDashboard, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Code-login state: 'email' (ask for the address) then 'code' (ask for the code).
  const [step, setStep] = useState('email');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const autoSent = useRef(false);

  useEffect(() => {
    if (!authLoading && user) {
      // If the user came from /start-checkout, route them to /client/apply with
      // the chosen tier+iso preselected instead of dropping them on the dashboard.
      if (user.role === ROLES.CLIENT) {
        const pending = consumePendingCheckout();
        if (pending) {
          navigate(pending.path);
          return;
        }
      }
      navigate(getRoleDashboard(user.role));
    }
  }, [authLoading, user, navigate, getRoleDashboard]);

  useEffect(() => {
    if (searchParams.get('pending') === '1') {
      setError('Your registration is pending approval. A CertifyCX administrator will review and verify your account shortly.');
    } else if (searchParams.get('rejected') === '1') {
      setError('Your registration has been declined. Please contact support at support@certify.cx for more information.');
    }
  }, [searchParams]);

  // Count the resend timer down once a second.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async (address) => {
    setError('');
    setNotice('');
    setLoading(true);
    const result = await requestLoginOtp(address);
    setLoading(false);
    if (!result.success) {
      setError(result.rateLimited ? t('auth.otpTooSoon') : result.error);
      // A rate-limit means a code was sent very recently: still show the box.
      if (result.rateLimited) setStep('code');
      return false;
    }
    setStep('code');
    setCode('');
    setCooldown(OTP_RESEND_SECONDS);
    // Same message whether or not the address is registered, so the page does
    // not reveal who has an account.
    setNotice(t('auth.otpSent'));
    return true;
  };

  // Arriving from sign-up: the account was just created, so send the first code.
  useEffect(() => {
    if (LOGIN_OTP_ENABLED && location.state?.sendCode && location.state?.email && !autoSent.current) {
      autoSent.current = true;
      sendCode(location.state.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    await sendCode(email.trim());
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!isValidOtp(code)) {
      setError(t('auth.otpInvalid'));
      return;
    }
    setError('');
    setNotice('');
    setLoading(true);
    const result = await verifyLoginOtp(email.trim(), normalizeOtp(code));
    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
    // On success the session appears and the effect above redirects.
  };

  const backToEmail = () => {
    setStep('email');
    setCode('');
    setError('');
    setNotice('');
  };

  // ---------------------------------------------------------------- code mode
  if (LOGIN_OTP_ENABLED) {
    return (
      <div className="auth-form auth-form--login">
        <h2 className="auth-form__title">
          {step === 'email' ? t('auth.welcomeBack') : t('auth.otpTitle')}
        </h2>
        <p className="auth-form__subtitle">
          {step === 'email'
            ? t('auth.signInOtpSubtitle')
            : t('auth.otpSubtitle', { email: email.trim() })}
        </p>

        {error && (
          <div className="auth-form__error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {notice && step === 'code' && (
          <div className="auth-form__notice">
            <MailCheck size={16} />
            <span>{notice}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="auth-form__body">
            <Input
              label={t('auth.email')}
              type="email"
              id="login-email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              {t('auth.otpSendCode')}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="auth-form__body">
            <Input
              label={t('auth.otpLabel')}
              id="login-otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_MAX_LENGTH + 2}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))}
              autoFocus
              required
            />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              {t('auth.otpVerify')}
            </Button>

            <div className="auth-otp-actions">
              <button
                type="button"
                className="auth-back-link"
                onClick={backToEmail}
              >
                <ArrowLeft size={16} /> {t('auth.otpUseDifferentEmail')}
              </button>
              <button
                type="button"
                className="auth-form__link auth-otp-resend"
                disabled={cooldown > 0 || loading}
                onClick={() => sendCode(email.trim())}
              >
                {cooldown > 0 ? t('auth.otpResendIn', { s: cooldown }) : t('auth.otpResend')}
              </button>
            </div>
          </form>
        )}

        <p className="auth-form__footer-text">
          {t('auth.noAccount')} <Link to="/signup" className="auth-form__link">{t('auth.applyForCert')}</Link>
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------ password mode
  return (
    <div className="auth-form auth-form--login">
      <h2 className="auth-form__title">{t('auth.welcomeBack')}</h2>
      <p className="auth-form__subtitle">{t('auth.signInSubtitle')}</p>

      {error && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handlePasswordSubmit} className="auth-form__body">
        <Input
          label={t('auth.email')}
          type="email"
          id="login-email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label={t('auth.password')}
          type={showPassword ? 'text' : 'password'}
          id="login-password"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
              title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />

        <div className="auth-form__actions">
          <Link to="/forgot-password" className="auth-form__link">
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {t('auth.signIn')}
        </Button>
      </form>

      <p className="auth-form__footer-text">
        {t('auth.noAccount')} <Link to="/signup" className="auth-form__link">{t('auth.applyForCert')}</Link>
      </p>
    </div>
  );
}
