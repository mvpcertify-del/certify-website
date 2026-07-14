import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import './BackButton.css';

// Shared "go back" control. The client asked for a back arrow on every page.
//
// Deep links are the reason this isn't a bare navigate(-1): a buyer opening a
// shared /iso/:slug or /checkout link lands with no history entry, so going
// back would either do nothing or leave the site. When there's no history to
// pop (location.key === 'default'), fall back to a real link to `fallback`.
export default function BackButton({ fallback = '/', label, className = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const text = label || t('common.back');
  const cls = `back-button ${className}`.trim();
  const hasHistory = location.key !== 'default';

  if (!hasHistory) {
    return (
      <Link to={fallback} className={cls}>
        <ArrowLeft size={16} aria-hidden="true" />
        {text}
      </Link>
    );
  }

  return (
    <button type="button" className={cls} onClick={() => navigate(-1)}>
      <ArrowLeft size={16} aria-hidden="true" />
      {text}
    </button>
  );
}
