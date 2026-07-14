import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/ui/StatusBadge';
import ProfileManagementTable from '../../components/admin/ProfileManagementTable';
import { ROLES, ROLE_LABELS } from '../../utils/roles';

export default function AdminAuditors() {
  const { t } = useTranslation();

  const columns = [
    { key: 'full_name', label: t('admin.name'), render: (val) => val || '—' },
    { key: 'email', label: t('auth.email') },
    { key: 'country', label: t('admin.country'), render: (val) => val || '—' },
    { key: 'role', label: t('settings.role'), render: (val) => <StatusBadge status={val} label={ROLE_LABELS[val] || val} /> },
    { key: 'created_at', label: t('admin.joined'), render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
  ];

  const editFields = [
    { key: 'full_name', label: t('admin.fullName'), required: true },
    { key: 'email', label: t('auth.email'), type: 'email', required: true },
    { key: 'country', label: t('admin.country') },
  ];

  const createFields = [
    { key: 'full_name', label: t('admin.fullName'), required: true },
    { key: 'email', label: t('auth.email'), type: 'email', required: true },
    { key: 'password', label: t('auth.password'), type: 'password', required: true },
    { key: 'country', label: t('admin.country') },
  ];

  return (
    <ProfileManagementTable
      role={ROLES.AUDITOR}
      columns={columns}
      editFields={editFields}
      createFields={createFields}
      addLabel={t('admin.addAuditor')}
      createTitle={t('admin.addAuditor')}
      title={t('admin.auditorsTitle')}
      subtitle={(count) => t('admin.auditorsFound', { count })}
      loadingText={t('admin.loadingAuditors')}
      emptyText={t('admin.noAuditorsFound')}
    />
  );
}
