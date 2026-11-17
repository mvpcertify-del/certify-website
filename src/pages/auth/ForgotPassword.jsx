import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input, Button } from '../../components/ui/FormElements';
import { AlertCircle, CheckCircle } from 'lucide-react';
import AuthSwitch from '../../components/auth/AuthSwitch';
import './Auth.css';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(t('checkout.errEmail'));
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(address);
      if (result.success) {
        setSent(true);
      } else {
        // This branch used to be invisible: the error was stored and never
        // rendered, so a rejected request (most often Supabase's one-per-minute
        // rate limit after a double click) left the button doing nothing at all
        // — which is exactly how it was reported on 16 Aug. Say what happened.
        setError(result.error || t('checkout.errGeneric'));
      }
    } catch (err) {
      setError(err?.message || t('checkout.errGeneric'));
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="auth-form auth-form--login auth-form--compact">
        <div className="auth-form__success-icon">
          <CheckCircle size={48} />
        </div>
        <h2 className="auth-form__title">{t('auth.checkEmail')}</h2>
        <p className="auth-form__subtitle">
          {t('auth.resetLinkSent')} <strong>{email}</strong>
        </p>
        <Link to="/login">
          <Button variant="secondary" size="lg" fullWidth>
            {t('auth.backToSignIn')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-form auth-form--login auth-form--compact">
      <h2 className="auth-form__title">{t('auth.resetPassword')}</h2>
      <p className="auth-form__subtitle">{t('auth.resetPasswordDesc')}</p>

      <form onSubmit={handleSubmit} className="auth-form__body">
        <Input
          label={t('auth.email')}
          type="email"
          id="forgot-email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {error && (
          <div className="auth-form__error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {loading ? t('auth.sendingResetLink') : t('auth.sendResetLink')}
        </Button>
      </form>

      <AuthSwitch to="/login" prompt={t('auth.rememberPassword')} label={t('auth.signIn')} />
    </div>
  );
}
