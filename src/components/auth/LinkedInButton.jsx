import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linkedin, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LINKEDIN_ENABLED, LINKEDIN_STAKEHOLDERS } from '../../config/loginMode';

// "Continue with LinkedIn" plus the divider under it. Renders nothing until LinkedIn is switched on
// (VITE_LINKEDIN_LOGIN_ENABLED) and only on registrations that LinkedIn alone can complete.
export default function LinkedInButton({ stakeholderType = 'client', dividerKey = 'common.or' }) {
  const { t } = useTranslation();
  const { signInWithLinkedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!LINKEDIN_ENABLED || !LINKEDIN_STAKEHOLDERS.includes(stakeholderType)) return null;

  const start = async () => {
    setLoading(true);
    setError('');
    const result = await signInWithLinkedIn('/auth/callback', stakeholderType);
    if (!result.success) {
      setError(result.error || t('auth.linkedinFailed'));
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" className="auth-linkedin-btn" disabled={loading} onClick={start}>
        <Linkedin size={20} aria-hidden="true" />
        {loading ? t('common.redirecting') : t('auth.continueWithLinkedIn')}
      </button>
      {error && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      <div className="auth-divider"><span>{t(dividerKey)}</span></div>
    </>
  );
}
