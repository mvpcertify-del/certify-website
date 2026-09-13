import { useTranslation } from 'react-i18next';
import { RefreshCw, Pencil, Trash2, Eye, Mail, Linkedin } from 'lucide-react';

// Shared row-action cluster:
// [View] [Mail] [LinkedIn] [Activate/Deactivate] [Edit] [Delete].
// Mirrors the exact styling, icons and spacing first used on the Discount
// Coupons screen (the reference implementation), so every admin management
// module renders an identical action section with dark/light theme support
// (colors come from CSS variables) and the same responsive DataTable behavior.
//
// Render this only for users allowed to manage the row (Super Admin); callers
// gate it the same way the Coupons page does (`if (canWrite) columns.push(...)`).
export default function RowActions({
  isActive,
  onToggle,
  onEdit,
  onDelete,
  onView,
  onResend,
  onLink,
  showToggle = true,
  showEdit = true,
  showDelete = true,
  showView = false,
  showResend = false,
  showLink = false,
  // The envelope means "resend the verification email" on the user screens, but
  // on the investor register it means "write to this fund". Callers that mean
  // something else pass their own title rather than mislabelling the button.
  resendTitle,
  resendDisabled = false,
  // When the action is really a navigation (mailto:, an external profile),
  // pass the URL and it renders as a link. A button that calls window.open or
  // assigns location.href cannot be middle-clicked, copied or opened in a new
  // tab, and a mailto assigned to the document's location tears the SPA down
  // on a machine with no mail handler registered.
  resendHref,
  linkTitle,
  linkDisabled = false,
  linkHref,
  disabled = false,
}) {
  const { t } = useTranslation();

  const baseStyle = {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    padding: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--color-text-secondary)',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {showView && (
        <button
          type="button"
          title={t('common.view')}
          onClick={onView}
          disabled={disabled}
          style={baseStyle}
        >
          <Eye size={14} />
        </button>
      )}
      {showResend && (
        resendHref && !resendDisabled && !disabled ? (
          <a
            href={resendHref}
            title={resendTitle || t('auth.resendVerification')}
            style={{ ...baseStyle, display: 'inline-flex', textDecoration: 'none' }}
          >
            <Mail size={14} />
          </a>
        ) : (
          <button
            type="button"
            title={resendTitle || t('auth.resendVerification')}
            onClick={onResend}
            disabled={disabled || resendDisabled}
            style={resendDisabled ? { ...baseStyle, cursor: 'not-allowed', opacity: 0.4 } : baseStyle}
          >
            <Mail size={14} />
          </button>
        )
      )}
      {showLink && (
        linkHref && !linkDisabled && !disabled ? (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            title={linkTitle || t('common.view')}
            style={{
              ...baseStyle,
              display: 'inline-flex',
              textDecoration: 'none',
              color: '#0a66c2',
              border: '1px solid rgba(10,102,194,0.4)',
            }}
          >
            <Linkedin size={14} />
          </a>
        ) : (
          <button
            type="button"
            title={linkTitle || t('common.view')}
            onClick={onLink}
            disabled={disabled || linkDisabled}
            style={
              linkDisabled
                ? { ...baseStyle, cursor: 'not-allowed', opacity: 0.4 }
                : { ...baseStyle, color: '#0a66c2', border: '1px solid rgba(10,102,194,0.4)' }
            }
          >
            <Linkedin size={14} />
          </button>
        )
      )}
      {showToggle && (
        <button
          type="button"
          title={isActive ? t('common.deactivate') : t('common.activate')}
          onClick={onToggle}
          disabled={disabled}
          style={baseStyle}
        >
          <RefreshCw size={14} />
        </button>
      )}
      {showEdit && (
        <button
          type="button"
          title={t('common.edit')}
          onClick={onEdit}
          disabled={disabled}
          style={baseStyle}
        >
          <Pencil size={14} />
        </button>
      )}
      {showDelete && (
        <button
          type="button"
          title={t('common.delete')}
          onClick={onDelete}
          disabled={disabled}
          style={{
            ...baseStyle,
            border: '1px solid rgba(239,68,68,0.4)',
            color: '#ef4444',
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
