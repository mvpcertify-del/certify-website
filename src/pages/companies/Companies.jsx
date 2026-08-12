import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/roles';
import { Plus, Search } from 'lucide-react';
import './Companies.css';

export default function Companies() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchCompanies = async () => {
      setFetching(true);
      const { data } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setCompanies(data);
      setFetching(false);
    };
    fetchCompanies();
    // Keyed on the identity/role/region this query actually reads, not on the
    // whole `user` object — Supabase replaces that object on every tab refocus
    // (TOKEN_REFRESHED), which re-ran the fetch and flashed the list back to
    // "Loading" each time the user came back from another window.
  }, [user?.id, user?.role, user?.region]);


  if (!user || loading) return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;

  const canManage = hasPermission(user?.role, PERMISSIONS.MANAGE_COMPANIES);

  const filtered = companies.filter(c => {
    const matchesSearch =
      (c.company_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (c.industry?.toLowerCase() || '').includes(search.toLowerCase());
    return matchesSearch;
  });

  const columns = [
    { key: 'company_name', label: t('dashboard.company') },
    { key: 'industry', label: t('dashboard.industry') },
    { key: 'employee_count', label: t('admin.employees'), render: (val) => val || 0 },
    { key: 'locations_count', label: t('application.locationsCount'), render: (val) => val || 0 },
    { key: 'status', label: t('dashboard.status'), render: (val) => <StatusBadge status={val} /> },
    { key: 'created_at', label: t('dashboard.date'), render: (val) => new Date(val).toLocaleDateString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.companiesTitle')}</h1>
          <p className="page-subtitle">{t('admin.companiesFound', { count: filtered.length })}</p>
        </div>
        {canManage && (
          <Button variant="primary" size="md" onClick={() => navigate('/client/apply')}>
            <Plus size={16} /> {t('dashboard.newApplication')}
          </Button>
        )}
      </div>

      <div className="companies__filters">
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
      </div>

      {fetching ? (
        <p>{t('admin.loadingCompanies')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('admin.noCompaniesFound')}
        />
      )}
    </div>
  );
}
