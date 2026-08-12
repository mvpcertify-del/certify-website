import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import { Button, Input, Select } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES, REGIONS, getRegionLabel, getRegionFromCountry } from '../../utils/roles';
import StatusBadge from '../../components/ui/StatusBadge';
import RowActions from '../../components/ui/RowActions';
import { Plus, Search, Wand2 } from 'lucide-react';

const EMPTY = { name: '', region_id: '' };

export default function AdminCountries() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const canWrite = isSuperAdmin;

  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoAssigning, setAutoAssigning] = useState(false);
  // Read-only View popup — the first of the four row actions (client, 12 Aug:
  // "now I see only 3 Deactivate, Edit, Delete (View) Is missing").
  const [showView, setShowView] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);

  const fetchData = async () => {
    setFetching(true);
    const { data, error: err } = await supabase
      .from('countries')
      .select('id, name, region_id, is_active')
      .order('name');
    if (!err && data) setItems(data);
    setFetching(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    if (!canWrite) return;
    setEditingId(null);
    setFormData(EMPTY);
    setError('');
    setShowModal(true);
  };

  const openEdit = (row) => {
    if (!canWrite) return;
    setEditingId(row.id);
    setFormData({
      name: row.name || '',
      region_id: row.region_id || '',
    });
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
    if (!formData.name.trim()) {
      setError(t('countries.nameRequired'));
      return;
    }
    if (!formData.region_id) {
      setError(t('countries.regionRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        region_id: formData.region_id,
      };

      if (editingId) {
        const { error: upErr } = await supabase
          .from('countries')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from('countries')
          .insert([payload]);
        if (insErr) throw insErr;
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Save country error:', err);
      setError(err.message || t('countries.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!canWrite) return;
    const candidates = items
      .map(c => ({ ...c, _suggested: getRegionFromCountry(c.name) }))
      .filter(c => !c.region_id && c._suggested);

    if (candidates.length === 0) {
      alert(t('countries.autoAssignNoMatches'));
      return;
    }

    if (!window.confirm(t('countries.autoAssignConfirm', { count: candidates.length }))) return;

    setAutoAssigning(true);
    let success = 0;
    let failed = 0;
    for (const c of candidates) {
      const { error: upErr } = await supabase
        .from('countries')
        .update({ region_id: c._suggested, updated_at: new Date().toISOString() })
        .eq('id', c.id);
      if (upErr) failed += 1; else success += 1;
    }
    setAutoAssigning(false);
    await fetchData();
    alert(t('countries.autoAssignDone', { success, failed }));
  };

  const handleDelete = async (row) => {
    if (!canWrite) return;
    if (!window.confirm(t('countries.confirmDelete', { name: row.name }))) return;
    try {
      const { error: delErr } = await supabase
        .from('countries')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setItems(prev => prev.filter(c => c.id !== row.id));
    } catch (err) {
      console.error('Delete country error:', err);
      alert(t('countries.deleteFailed') + ': ' + err.message);
    }
  };

  const toggleActive = async (row) => {
    if (!canWrite) return;
    const next = !(row.is_active !== false);
    try {
      const { error: upErr } = await supabase
        .from('countries')
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) throw upErr;
      setItems(prev => prev.map(c => c.id === row.id ? { ...c, is_active: next } : c));
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(c => {
      const matchSearch = !q || c.name?.toLowerCase().includes(q);
      const matchRegion = !regionFilter || c.region_id === regionFilter;
      return matchSearch && matchRegion;
    });
  }, [items, search, regionFilter]);

  const columns = [
    { key: 'name', label: t('countries.country'), render: (v) => v || '—' },
    {
      key: 'region_id',
      label: t('admin.region'),
      render: (v) => v ? getRegionLabel(v) : <span style={{ color: '#ef4444' }}>{t('countries.unassigned')}</span>,
    },
  ];

  if (canWrite) {
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

  if (!user || loading) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('countries.title')}</h1>
          <p className="page-subtitle">{t('countries.subtitle', { count: filtered.length })}</p>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="md" onClick={handleAutoAssign} loading={autoAssigning}>
              <Wand2 size={16} /> {t('countries.autoAssignRegions')}
            </Button>
            <Button variant="primary" size="md" onClick={openCreate}>
              <Plus size={16} /> {t('countries.addCountry')}
            </Button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
        <div className="companies__search" style={{ flex: 1, minWidth: 220 }}>
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
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          style={{ width: 220 }}
        >
          <option value="">{t('common.allRegions')}</option>
          {REGIONS.map(r => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </Select>
      </div>

      {fetching ? (
        <p>{t('countries.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('countries.empty')}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? t('countries.editCountry') : t('countries.addCountry')}
        size="md"
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
            label={t('countries.countryName')}
            name="name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Select
            label={t('countries.linkedRegion')}
            name="region_id"
            value={formData.region_id}
            onChange={e => setFormData({ ...formData, region_id: e.target.value })}
            required
          >
            <option value="">{t('countries.selectRegion')}</option>
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? t('common.save') : t('countries.addCountry')}
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
