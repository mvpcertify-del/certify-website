import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import { Button, Input } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import RowActions from '../../components/ui/RowActions';
import { Plus, TrendingUp } from 'lucide-react';

const EMPTY = {
  min_conversions: '',
  max_conversions: '',
  commission_percent: '',
  label: '',
  is_active: true,
};

export default function AdminCommissionTiers() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(false);

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
    const { data } = await supabase
      .from('referral_commission_tiers')
      .select('*')
      .order('min_conversions', { ascending: true });
    setItems(data || []);
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
    setEditingId(row.id);
    setFormData({
      min_conversions: row.min_conversions ?? '',
      max_conversions: row.max_conversions ?? '',
      commission_percent: row.commission_percent ?? '',
      label: row.label || '',
      is_active: !!row.is_active,
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

    const minC = Number(formData.min_conversions);
    const maxC = formData.max_conversions === '' ? null : Number(formData.max_conversions);
    const pct = Number(formData.commission_percent);

    if (!Number.isFinite(minC) || minC < 0) {
      setError(t('tiers.minInvalid'));
      return;
    }
    if (maxC !== null && (!Number.isFinite(maxC) || maxC <= minC)) {
      setError(t('tiers.maxInvalid'));
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError(t('tiers.percentInvalid'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        min_conversions: minC,
        max_conversions: maxC,
        commission_percent: pct,
        label: formData.label.trim() || null,
        is_active: !!formData.is_active,
      };

      if (editingId) {
        const { error: upErr } = await supabase
          .from('referral_commission_tiers')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from('referral_commission_tiers')
          .insert([payload]);
        if (insErr) throw insErr;
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Save tier error:', err);
      setError(err.message || t('tiers.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(t('tiers.confirmDelete', { label: row.label || `${row.min_conversions}+` }))) return;
    try {
      const { error: delErr } = await supabase
        .from('referral_commission_tiers')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setItems(prev => prev.filter(c => c.id !== row.id));
    } catch (err) {
      alert(t('tiers.deleteFailed') + ': ' + err.message);
    }
  };

  const toggleActive = async (row) => {
    try {
      const { error: upErr } = await supabase
        .from('referral_commission_tiers')
        .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) throw upErr;
      setItems(prev => prev.map(c => c.id === row.id ? { ...c, is_active: !row.is_active } : c));
    } catch (err) {
      alert(err.message);
    }
  };

  const columns = [
    {
      key: 'label',
      label: t('tiers.label'),
      render: (v) => v || <span style={{ color: 'var(--color-text-secondary)' }}>—</span>,
    },
    {
      key: 'min_conversions',
      label: t('tiers.range'),
      render: (_, row) => {
        const min = row.min_conversions;
        const max = row.max_conversions;
        return max == null ? `${min}+` : `${min}–${max}`;
      },
    },
    {
      key: 'commission_percent',
      label: t('tiers.commission'),
      render: (v) => <strong>{v}%</strong>,
    },
    {
      key: 'is_active',
      label: t('dashboard.status'),
      render: (v) => (
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 4,
          background: v ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.15)',
          color: v ? '#047857' : '#64748b',
        }}>
          {v ? t('common.active') : t('common.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: t('common.actions') || 'Actions',
      render: (_, row) => (
        <RowActions
          isActive={!!row.is_active}
          showView
          onView={() => { setViewingRow(row); setShowView(true); }}
          onToggle={() => toggleActive(row)}
          onEdit={() => openEdit(row)}
          onDelete={() => handleDelete(row)}
        />
      ),
    },
  ];

  if (!user || loading) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="page-container">
        <p>{t('common.noAccess') || 'You do not have access to this page.'}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('tiers.title')}</h1>
          <p className="page-subtitle">{t('tiers.subtitle')}</p>
        </div>
        <Button variant="primary" size="md" onClick={openCreate}>
          <Plus size={16} /> {t('tiers.addTier')}
        </Button>
      </div>

      <div style={{
        display: 'flex',
        gap: 12,
        padding: '14px 18px',
        background: 'rgba(62,207,142,0.08)',
        border: '1px solid rgba(62,207,142,0.25)',
        borderRadius: 10,
        marginBottom: 'var(--spacing-lg)',
        alignItems: 'flex-start',
      }}>
        <TrendingUp size={20} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#065f46', lineHeight: 1.5 }}>
          {t('tiers.explanation')}
        </p>
      </div>

      {fetching ? (
        <p>{t('tiers.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          emptyMessage={t('tiers.empty')}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? t('tiers.editTier') : t('tiers.addTier')}
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
            label={t('tiers.label')}
            name="label"
            value={formData.label}
            onChange={e => setFormData({ ...formData, label: e.target.value })}
            placeholder={t('tiers.labelPlaceholder')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label={t('tiers.minConversions')}
              type="number"
              min="0"
              name="min_conversions"
              value={formData.min_conversions}
              onChange={e => setFormData({ ...formData, min_conversions: e.target.value })}
              required
            />
            <Input
              label={t('tiers.maxConversions')}
              type="number"
              min="0"
              name="max_conversions"
              value={formData.max_conversions}
              onChange={e => setFormData({ ...formData, max_conversions: e.target.value })}
              placeholder={t('tiers.openEnded')}
            />
          </div>

          <Input
            label={t('tiers.commissionPercent')}
            type="number"
            min="0"
            max="100"
            step="0.1"
            name="commission_percent"
            value={formData.commission_percent}
            onChange={e => setFormData({ ...formData, commission_percent: e.target.value })}
            required
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <span>{t('tiers.activeLabel')}</span>
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? t('common.save') : t('tiers.addTier')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View (read-only). DetailModal reuses the table's own columns and drops
          the actions one, so the popup can never disagree with the list. */}
      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingRow?.label || t('common.view')}
        columns={columns}
        row={viewingRow}
      />
    </div>
  );
}
