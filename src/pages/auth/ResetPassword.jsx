import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Input, Button } from '../../components/ui/FormElements';
import { AlertCircle, CheckCircle } from 'lucide-react';
import './Auth.css';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  // Supabase sends the user here with a recovery token in the URL hash.
  // The SDK auto-exchanges it and fires a PASSWORD_RECOVERY event, after which
  // updateUser({ password }) is allowed on the resulting session.
  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        resolved = true;
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        resolved = true;
        setReady(true);
      }
    });

    const timeout = setTimeout(() => {
      if (!resolved) setInvalidLink(true);
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || !confirm) {
      setError(t('settings.passwordsRequired'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort', 'Password must be at least 6 characters.'));
      return;
    }
    if (password !== confirm) {
      setError(t('settings.passwordsMismatch'));
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.success) {
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 2500);
    } else {
      setError(result.error);
    }
  };

  if (done) {
    return (
      <div className="auth-form">
        <div className="auth-form__success-icon">
          <CheckCircle size={48} />
        </div>
        <h2 className="auth-form__title">{t('settings.passwordUpdated')}</h2>
        <p className="auth-form__subtitle">
          {t('auth.redirectingToSignIn', 'Redirecting you to sign in…')}
        </p>
        <Link to="/login">
          <Button variant="secondary" size="md" fullWidth>
            {t('auth.backToSignIn')}
          </Button>
        </Link>
      </div>
    );
  }

  if (invalidLink && !ready) {
    return (
      <div className="auth-form">
        <h2 className="auth-form__title">{t('auth.invalidResetLink', 'Invalid or expired link')}</h2>
        <p className="auth-form__subtitle">
          {t('auth.invalidResetLinkDesc', 'This password reset link is invalid or has expired. Please request a new one.')}
        </p>
        <Link to="/forgot-password">
          <Button variant="primary" size="md" fullWidth>
            {t('auth.sendResetLink')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2 className="auth-form__title">{t('settings.updatePassword')}</h2>
      <p className="auth-form__subtitle">
        {t('auth.chooseNewPassword', 'Choose a new password for your account.')}
      </p>

      <form onSubmit={handleSubmit} className="auth-form__body">
        <Input
          label={t('settings.newPassword')}
          type="password"
          id="new-password"
          autoComplete="new-password"
          placeholder={t('settings.newPasswordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label={t('settings.confirmPassword')}
          type="password"
          id="confirm-password"
          autoComplete="new-password"
          placeholder={t('settings.confirmPasswordPlaceholder')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {error && (
          <div className="auth-form__error" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!ready}
        >
          {t('settings.updatePasswordBtn')}
        </Button>
      </form>

      <p className="auth-form__footer-text">
        <Link to="/login" className="auth-form__link">{t('auth.backToSignIn')}</Link>
      </p>
    </div>
  );
}
