import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import './Reports.css';

export default function Reports() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [reports, setReports] = useState([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchReports = async () => {
      setFetching(true);
      const { data } = await supabase
        .from('reports')
        .select('*, applications(company_name, recommended_iso), profiles(full_name)')
        .order('created_at', { ascending: false });
      if (data) {
        const flattened = data.map(r => ({
          ...r,
          company_name: r.applications?.company_name || '—',
          recommended_iso: r.applications?.recommended_iso || '—',
          generated_by: r.profiles?.full_name || '—',
        }));
        setReports(flattened);
      }
      setFetching(false);
    };
    fetchReports();
    // Keyed on the identity/role/region this query actually reads, not on the
    // whole `user` object — Supabase replaces that object on every tab refocus
    // (TOKEN_REFRESHED), which re-ran the fetch and flashed the list back to
    // "Loading" each time the user came back from another window.
  }, [user?.id, user?.role, user?.region]);


  if (!user || loading) return <div className="page-container"><p>{t('common.loading')}</p></div>;

  const columns = [
    { key: 'id', label: 'Report ID', render: (val) => (
      <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)' }}>{String(val).substring(0,8)}</span>
    )},
    { key: 'company_name', label: t('dashboard.company') },
    { key: 'recommended_iso', label: t('dashboard.standard') },
    { key: 'generated_by', label: t('admin.generatedBy') },
    { key: 'status', label: t('dashboard.status'), render: (val) => <StatusBadge status={val || 'completed'} /> },
    { key: 'created_at', label: t('dashboard.date'), render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.reportsTitle')}</h1>
          <p className="page-subtitle">{t('admin.reportsSubtitle')}</p>
        </div>
      </div>

      {fetching ? (
        <p>{t('common.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={reports}
          emptyMessage={t('common.noResults')}
        />
      )}
    </div>
  );
}
