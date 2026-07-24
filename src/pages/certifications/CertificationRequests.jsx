import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { Button, Select } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/roles';
import { Plus, Search, CheckCircle } from 'lucide-react';
import './CertificationRequests.css';

export default function CertificationRequests() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user) return;
    const fetchRequests = async () => {
      setFetching(true);
      const { data } = await supabase
        .from('applications')
        .select('*, profiles(email), auditor:profiles!assigned_auditor_id(full_name), cb:certification_bodies!assigned_cb_id(name)')
        .order('created_at', { ascending: false });
      if (data) {
        const flattened = data.map(app => ({
          ...app,
          client_email: app.profiles?.email || '—',
          auditor_name: app.auditor?.full_name || 'Unassigned',
          cb_name: app.cb?.name || 'Unassigned'
        }));
        setRequests(flattened);
      }
      setFetching(false);
    };
    fetchRequests();
  }, [user]);

  if (!user || loading) return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;

  const canManage = hasPermission(user?.role, PERMISSIONS.MANAGE_CERTIFICATIONS);

  const filtered = requests.filter(r => {
    const matchesSearch =
      (r.company_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (r.client_email?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { key: 'company_name', label: t('dashboard.company') },
    { key: 'recommended_iso', label: t('dashboard.certificate') },
    { key: 'auditor_name', label: t('dashboard.assignedAuditor') },
    { key: 'cb_name', label: t('dashboard.assignedCB') },
    { key: 'status', label: t('dashboard.status'), render: (val) => <StatusBadge status={val} /> },
    {
      key: 'actions',
      label: t('dashboard.action'),
      render: (_, row) => (
        <Button size="sm" onClick={() => navigate(`/admin/applications/${row.id}`)}>
          {t('common.manage')}
        </Button>
      )
    },
  ];

  return (
    <div className="page-container">
      {toast && (
        <div className="cert-request__toast">
          <CheckCircle size={16} />
          <span>{toast}</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.certRequestsTitle')}</h1>
          <p className="page-subtitle">{t('admin.certRequestsFound', { count: filtered.length })}</p>
        </div>
      </div>

      <div className="cert-request__filters">
        <div className="companies__search">
          <Search size={16} className="companies__search-icon" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="companies__search-input"
          />
        </div>
        <Select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">{t('admin.allStatuses')}</option>
          <option value="pending">{t('admin.pending')}</option>
          <option value="awaiting_payment">{t('admin.awaitingPayment')}</option>
          <option value="payment_received">{t('admin.paymentReceived')}</option>
          <option value="audit_scheduled">{t('admin.auditScheduled')}</option>
          <option value="in_review">{t('admin.inReview')}</option>
          <option value="approved">{t('admin.approved')}</option>
          <option value="rejected">{t('admin.rejected')}</option>
        </Select>
      </div>

      {fetching ? (
        <p>{t('admin.loadingCertRequests')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('admin.noCertRequestsFound')}
        />
      )}
    </div>
  );
}
