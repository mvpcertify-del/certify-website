import { useTranslation } from 'react-i18next';
import { RefreshCw, Pencil, Trash2 } from 'lucide-react';

// Shared row-action cluster: [Activate/Deactivate] [Edit] [Delete].
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
  showToggle = true,
  showEdit = true,
  showDelete = true,
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
