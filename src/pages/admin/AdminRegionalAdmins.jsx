import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/ui/StatusBadge';
import ProfileManagementTable from '../../components/admin/ProfileManagementTable';
import { ROLES, ROLE_LABELS, REGIONS } from '../../utils/roles';

export default function AdminRegionalAdmins() {
  const { t } = useTranslation();

  const columns = [
    { key: 'full_name', label: t('admin.name'), render: (val) => val || '—' },
    { key: 'email', label: t('auth.email') },
    { key: 'region', label: t('admin.region'), render: (val) => {
      if (!val) return '—';
      const r = REGIONS.find(reg => reg.id === val);
      return r ? r.label : val;
    }},
    { key: 'role', label: t('settings.role'), render: (val) => <StatusBadge status={val} label={ROLE_LABELS[val] || val} /> },
    { key: 'created_at', label: t('admin.joined'), render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
  ];

  const editFields = [
    { key: 'full_name', label: t('admin.fullName'), required: true },
    { key: 'email', label: t('auth.email'), type: 'email', required: true },
    { key: 'region', label: t('admin.region'), type: 'region' },
  ];

  return (
    <ProfileManagementTable
      role={ROLES.REGIONAL_ADMIN}
      columns={columns}
      editFields={editFields}
      title={t('admin.regionalAdminsTitle')}
      subtitle={(count) => t('admin.regionalAdminsFound', { count })}
      loadingText={t('admin.loadingRegionalAdmins')}
      emptyText={t('admin.noRegionalAdminsFound')}
      scopeToRegion={false}
    />
  );
}
