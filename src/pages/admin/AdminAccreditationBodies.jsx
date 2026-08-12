import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import { Button, Input } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import StatusBadge from '../../components/ui/StatusBadge';
import RowActions from '../../components/ui/RowActions';
import { Plus, Search } from 'lucide-react';

const EMPTY = { name: '', acronym: '' };

export default function AdminAccreditationBodies() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const canAdd = isSuperAdmin || isRegionalAdmin;
  const canEditDelete = isSuperAdmin;

  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Read-only View popup — the first of the four row actions (client, 12 Aug:
  // "now I see only 3 Deactivate, Edit, Delete (View) Is missing").
  const [showView, setShowView] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);

  const fetchData = async () => {
    setFetching(true);
    const { data, error: err } = await supabase
      .from('accreditation_bodies')
      .select('*')
      .order('name');
    if (!err && data) setItems(data);
    setFetching(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY);
    setError('');
    setShowModal(true);
  };

  const openEdit = (row) => {
    if (!canEditDelete) return;
    setEditingId(row.id);
    setFormData({ name: row.name || '', acronym: row.acronym || '' });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(EMPTY);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim() || !formData.acronym.trim()) {
      setError(t('accBody.nameAcronymRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        acronym: formData.acronym.trim(),
      };

      if (editingId) {
        const { error: updErr } = await supabase
          .from('accreditation_bodies')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('accreditation_bodies')
          .insert([{ ...payload, created_by: user?.id || null }]);
        if (insErr) throw insErr;
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Save AB error:', err);
      setError(err.message || t('accBody.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!canEditDelete) return;
    if (!window.confirm(t('accBody.confirmDelete', { name: row.name }))) return;
    try {
      const { error: delErr } = await supabase
        .from('accreditation_bodies')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setItems(prev => prev.filter(x => x.id !== row.id));
    } catch (err) {
      console.error('Delete AB error:', err);
      alert(t('accBody.deleteFailed') + ': ' + err.message);
    }
  };

  const toggleActive = async (row) => {
    if (!canEditDelete) return;
    const next = !(row.is_active !== false);
    try {
      const { error: upErr } = await supabase
        .from('accreditation_bodies')
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) throw upErr;
      setItems(prev => prev.map(x => x.id === row.id ? { ...x, is_active: next } : x));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user || loading) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  const filtered = items.filter(x => {
    const q = search.toLowerCase();
    return (x.name || '').toLowerCase().includes(q)
        || (x.acronym || '').toLowerCase().includes(q);
  });

  const columns = [
    {
      key: 'acronym',
      label: t('accBody.acronym'),
      render: (val) => (
        <span style={{
          fontWeight: 600,
          background: 'rgba(62,207,142,0.12)',
          color: 'var(--color-accent, #3ECF8E)',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: '0.75rem',
        }}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'name',
      label: t('accBody.name'),
      render: (val) => (
        <span style={{ color: 'var(--color-text-primary)' }}>{val || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: t('admin.joined'),
      render: (val) => val ? new Date(val).toLocaleDateString() : '—',
    },
  ];

  if (canEditDelete) {
    columns.push({
      key: 'is_active',
      label: t('dashboard.status'),
      render: (v) => (
        <StatusBadge
          status={v === false ? 'inactive' : 'active'}
          label={v === false ? t('common.inactive') : t('common.active')}
        />
      ),
    });
    columns.push({
      key: 'actions',
      label: t('common.actions') || 'Actions',
      render: (_, row) => (
        <RowActions
          isActive={row.is_active !== false}
          showView
          onView={() => { setViewingRow(row); setShowView(true); }}
          onToggle={() => toggleActive(row)}
          onEdit={() => openEdit(row)}
          onDelete={() => handleDelete(row)}
        />
      ),
    });
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('accBody.title')}</h1>
          <p className="page-subtitle">{t('accBody.found', { count: filtered.length })}</p>
        </div>
        {canAdd && (
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus size={16} /> {t('accBody.addBody')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
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
        <p>{t('accBody.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('accBody.noneFound')}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? t('accBody.editBody') : t('accBody.addBody')}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: 6,
              fontSize: '0.85rem',
            }}>
              {error}
            </div>
          )}

          <Input
            label={t('accBody.nameRequired')}
            name="name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label={t('accBody.acronymRequired')}
            name="acronym"
            value={formData.acronym}
            onChange={e => setFormData({ ...formData, acronym: e.target.value })}
            required
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? t('common.save') : t('accBody.addBody')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View (read-only). DetailModal reuses the table's own columns and drops
          the actions one, so the popup can never disagree with the list. */}
      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingRow?.name || t('common.view')}
        columns={columns}
        row={viewingRow}
      />
    </div>
  );
}
