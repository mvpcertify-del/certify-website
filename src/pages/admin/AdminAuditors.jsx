import { useTranslation } from 'react-i18next';
import ProfileManagementTable from '../../components/admin/ProfileManagementTable';
import { ROLES } from '../../utils/roles';
import {
  AUDITOR_LEVELS,
  AUDITOR_STANDARD_OPTIONS,
  AUDITOR_SECTOR_OPTIONS,
  auditorLevelLabel,
  auditorSectorLabel,
} from '../../utils/auditorOptions';

const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

// A qualification list can hold 39 IAF codes; a table cell cannot. Show the
// first two and a "+N" counter (the same idiom MultiSelect uses for its chips)
// and hand the full list to the View popup via `renderDetail`.
function arrayCell(values, labelFn) {
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) return '—';
  const all = list.map(labelFn).join(', ');
  return (
    <span title={all} style={{ whiteSpace: 'nowrap' }}>
      {list.slice(0, 2).map(labelFn).join(', ')}
      {list.length > 2 && (
        <span style={{ color: 'var(--color-text-secondary)' }}> +{list.length - 2}</span>
      )}
    </span>
  );
}

function arrayDetail(values, labelFn) {
  const list = Array.isArray(values) ? values : [];
  return list.length ? list.map(labelFn).join(', ') : '—';
}

export default function AdminAuditors() {
  const { t } = useTranslation();

  // The Role column is deliberately absent: this page filters on role =
  // auditor, so every row carried the same badge. The space goes to the
  // qualification columns the client asked to see.
  const columns = [
    {
      key: 'full_name',
      label: t('admin.name'),
      render: (val, row) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {row.avatar_url && (
            <img
              src={row.avatar_url}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <span>{val || '—'}</span>
        </span>
      ),
    },
    { key: 'email', label: t('auth.email') },
    { key: 'phone', label: t('auth.mobileNumber'), render: (val) => val || '—' },
    { key: 'country', label: t('admin.country'), render: (val) => val || '—' },
    {
      key: 'auditor_standards',
      label: t('auth.auditorStandards'),
      render: (val) => arrayCell(val, (s) => s),
      renderDetail: (val) => arrayDetail(val, (s) => s),
    },
    {
      key: 'auditor_levels',
      label: t('auth.auditorLevel'),
      render: (val) => arrayCell(val, auditorLevelLabel),
      renderDetail: (val) => arrayDetail(val, auditorLevelLabel),
    },
    {
      // The list shows bare IAF codes — a cell wide enough for "29 Wholesale
      // and retail trade; repair of motor vehicles…" would push everything
      // else off screen. The View popup spells them out.
      key: 'auditor_sectors',
      label: t('auth.auditorSectors'),
      render: (val) => arrayCell(val, (c) => c),
      renderDetail: (val) => arrayDetail(val, auditorSectorLabel),
    },
    { key: 'created_at', label: t('admin.joined'), render: (val) => val ? new Date(val).toLocaleDateString() : '—' },
  ];

  // Shared by create and edit so the two forms cannot drift.
  const professionalFields = [
    { key: 'phone', label: t('auth.mobileNumber'), type: 'phone' },
    {
      key: 'auditor_standards', label: t('auth.auditorStandards'), type: 'multiselect',
      options: AUDITOR_STANDARD_OPTIONS, placeholder: t('auth.auditorStandardsPlaceholder'),
      // Client: "If possible to put the Standards & Level of certificate next
      // to each other, it will be good."
      halfWidth: true,
    },
    {
      key: 'auditor_levels', label: t('auth.auditorLevel'), type: 'multiselect',
      options: AUDITOR_LEVELS, placeholder: t('auth.auditorLevelPlaceholder'),
      halfWidth: true,
    },
    {
      key: 'auditor_sectors', label: t('auth.auditorSectors'), type: 'multiselect',
      options: AUDITOR_SECTOR_OPTIONS, placeholder: t('auth.auditorSectorsPlaceholder'),
    },
    {
      key: 'certificates', label: t('auth.auditorCertificates'), type: 'file',
      accept: FILE_ACCEPT, multiple: true,
      docType: 'certificate', uploadAction: 'add-auditor-document',
    },
    {
      // Client, 12 Aug: "Replace the Audit Log to become - Upload CV". The
      // auditor's own sign-up form has always asked for a CV and this one
      // never did, so the second file slot becomes the CV rather than a
      // second document type nobody was filling in. `cv` is already one of the
      // doc_type values auditor_documents accepts (phase24 migration), so
      // nothing changes in the database.
      key: 'cv', label: t('auth.auditorUploadCv'), type: 'file',
      accept: FILE_ACCEPT,
      docType: 'cv', uploadAction: 'add-auditor-document',
    },
  ];

  const editFields = [
    { key: 'full_name', label: t('admin.fullName'), type: 'name', required: true },
    { key: 'email', label: t('auth.email'), type: 'email', required: true },
    { key: 'country', label: t('admin.country') },
    ...professionalFields,
  ];

  const createFields = [
    { key: 'full_name', label: t('admin.fullName'), type: 'name', required: true },
    { key: 'email', label: t('auth.email'), type: 'email', required: true },
    { key: 'password', label: t('auth.password'), type: 'password', required: true },
    { key: 'country', label: t('admin.country') },
    ...professionalFields,
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
