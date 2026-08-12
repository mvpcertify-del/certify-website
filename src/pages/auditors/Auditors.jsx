import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { Button, Input } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/roles';
import { Plus, Search } from 'lucide-react';

export default function Auditors() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [search, setSearch] = useState('');
  const [auditors, setAuditors] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [certificationBodies, setCertificationBodies] = useState([]);
  const [showCBModal, setShowCBModal] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState(null);
  const [selectedCbId, setSelectedCbId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchAuditors = async () => {
    setFetching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*, cb:certification_bodies!cb_id(name)')
      .eq('role', 'auditor')
      .order('created_at', { ascending: false });
    if (data) {
      const flattened = data.map(item => ({
        ...item,
        cb_name: item.cb?.name || 'Independent/Unassigned'
      }));
      setAuditors(flattened);
    }
    setFetching(false);
  };

  const fetchCBs = async () => {
    const { data } = await supabase.from('certification_bodies').select('id, name').order('name');
    if (data) setCertificationBodies(data);
  };

  useEffect(() => {
    if (!user) return;
    fetchAuditors();
    fetchCBs();
    // Keyed on the identity/role/region this query actually reads, not on the
    // whole `user` object — Supabase replaces that object on every tab refocus
    // (TOKEN_REFRESHED), which re-ran the fetch and flashed the list back to
    // "Loading" each time the user came back from another window.
  }, [user?.id, user?.role, user?.region]);


  if (!user || loading) return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;

  const canManage = hasPermission(user?.role, PERMISSIONS.MANAGE_AUDITORS);

  const handleAssignCB = async (e) => {
    e.preventDefault();
    setAssigning(true);
    const { error } = await supabase
      .from('profiles')
      .update({ cb_id: selectedCbId || null })
      .eq('id', editingAuditor.id);
      
    if (error) {
       console.error('Update error:', error);
       alert('Failed to assign CB: ' + error.message);
    } else {
       await fetchAuditors();
       setShowCBModal(false);
    }
    setAssigning(false);
  };

  const filtered = auditors.filter(a => {
    const matchesSearch = (a.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
                          (a.email?.toLowerCase() || '').includes(search.toLowerCase());
    return matchesSearch;
  });

  const columns = [
    { key: 'full_name', label: t('admin.name') },
    { key: 'email', label: t('auth.email') },
    { key: 'cb_name', label: t('dashboard.assignedCB') },
    { key: 'status', label: t('dashboard.status'), render: (val) => <StatusBadge status={val} /> },
    {
      key: 'actions', label: t('dashboard.action'), render: (_, row) => (
        <Button size="sm" variant="ghost" onClick={() => {
          setEditingAuditor(row);
          setSelectedCbId(row.cb_id || '');
          setShowCBModal(true);
        }}>
          {t('admin.assignCB')}
        </Button>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.auditorsTitle')}</h1>
          <p className="page-subtitle">{t('admin.auditorsFound', { count: filtered.length })}</p>
        </div>
        {canManage && (
          <Button variant="primary" size="md" onClick={() => alert('To add auditors, have them register via the Sign Up page first, then update their role to Auditor in User Management.')}>
            <Plus size={16} /> Invite Auditor
          </Button>
        )}
      </div>

      <div className="companies__filters" style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
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
        <p>{t('admin.loadingAuditors')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('admin.noAuditorsFound')}
        />
      )}

      {/* Assign CB Modal */}
      <Modal isOpen={showCBModal} onClose={() => setShowCBModal(false)} title="Assign Certification Body">
        <form onSubmit={handleAssignCB} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Assigning CB to <strong>{editingAuditor?.full_name}</strong>
          </p>
          <Select
            label="Certification Body"
            id="assign-cb-select"
            value={selectedCbId}
            onChange={(e) => setSelectedCbId(e.target.value)}
          >
            <option value="">Unassigned (Independent)</option>
            {certificationBodies.map(cb => (
              <option key={cb.id} value={cb.id}>{cb.name}</option>
            ))}
          </Select>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button type="button" variant="ghost" onClick={() => setShowCBModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={assigning}>{t('admin.assignCB')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
