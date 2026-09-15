import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Button } from '../../components/ui/FormElements';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { ROLES } from '../../utils/roles';
import { PENDING_CHECKOUT_KEY } from '../public/StartCheckout';
import './Auth.css';

// Post-payment-first flow: forward to /client/start-payment which creates the
// stub application row and hands off to Stripe checkout.
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
  const { login, signInWithGoogle, getRoleDashboard, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2 className="auth-form__title">{t('auth.welcomeBack')}</h2>
      <p className="auth-form__subtitle">{t('auth.signInSubtitle')}</p>

      {error && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="auth-google-btn"
        disabled={googleLoading}
        onClick={async () => {
          setGoogleLoading(true);
          setError('');
          const result = await signInWithGoogle();
          if (!result.success) {
            setError(result.error);
            setGoogleLoading(false);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {googleLoading ? t('common.redirecting') : t('auth.continueWithGoogle')}
      </button>

      <div className="auth-divider">
        <span>{t('common.or')}</span>
      </div>

      <form onSubmit={handleSubmit} className="auth-form__body">
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
          placeholder="••••••••"
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
