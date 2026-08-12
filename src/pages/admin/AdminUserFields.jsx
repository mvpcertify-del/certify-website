import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import MultiSelect from '../../components/ui/MultiSelect';
import { Button, Input, Select } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES, ROLE_LABELS } from '../../utils/roles';
import RowActions from '../../components/ui/RowActions';
import { Plus, Users } from 'lucide-react';

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'multiselect', 'date', 'boolean'];

const EMPTY = {
  field_key: '',
  label: '',
  field_type: 'text',
  options: '',  // newline-separated in the form, serialized to array on save
  required: false,
  applies_to_roles: [ROLES.CLIENT],
  display_order: 0,
  is_active: true,
};

const slugify = (str) =>
  str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export default function AdminUserFields() {
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
      .from('custom_user_fields')
      .select('*')
      .order('display_order', { ascending: true });
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
      field_key: row.field_key || '',
      label: row.label || '',
      field_type: row.field_type || 'text',
      options: Array.isArray(row.options) ? row.options.join('\n') : '',
      required: !!row.required,
      applies_to_roles: row.applies_to_roles || [],
      display_order: row.display_order ?? 0,
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

    const key = formData.field_key.trim() || slugify(formData.label);
    if (!key) {
      setError(t('userFields.keyRequired'));
      return;
    }
    if (!formData.label.trim()) {
      setError(t('userFields.labelRequired'));
      return;
    }
    const needsOptions = formData.field_type === 'select' || formData.field_type === 'multiselect';
    const parsedOptions = formData.options
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    if (needsOptions && parsedOptions.length === 0) {
      setError(t('userFields.optionsRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        field_key: key,
        label: formData.label.trim(),
        field_type: formData.field_type,
        options: needsOptions ? parsedOptions : null,
        required: !!formData.required,
        applies_to_roles: formData.applies_to_roles.length
          ? formData.applies_to_roles
          : [ROLES.CLIENT],
        display_order: Number(formData.display_order) || 0,
        is_active: !!formData.is_active,
      };

      if (editingId) {
        const { error: upErr } = await supabase
          .from('custom_user_fields')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from('custom_user_fields')
          .insert([{ ...payload, created_by: user?.id }]);
        if (insErr) throw insErr;
      }

      await fetchData();
      closeModal();
    } catch (err) {
      setError(err.message || t('userFields.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(t('userFields.confirmDelete', { label: row.label }))) return;
    try {
      const { error: delErr } = await supabase
        .from('custom_user_fields')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setItems(prev => prev.filter(c => c.id !== row.id));
    } catch (err) {
      alert(t('userFields.deleteFailed') + ': ' + err.message);
    }
  };

  const toggleActive = async (row) => {
    try {
      const { error: upErr } = await supabase
        .from('custom_user_fields')
        .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) throw upErr;
      setItems(prev => prev.map(c => c.id === row.id ? { ...c, is_active: !row.is_active } : c));
    } catch (err) {
      alert(err.message);
    }
  };

  const columns = [
    { key: 'label', label: t('userFields.label'), render: v => <strong>{v}</strong> },
    { key: 'field_key', label: t('userFields.key'), render: v => <code style={{ fontSize: '0.78rem' }}>{v}</code> },
    { key: 'field_type', label: t('userFields.type') },
    {
      key: 'applies_to_roles',
      label: t('userFields.roles'),
      render: (v) => (Array.isArray(v) && v.length ? v.map(r => ROLE_LABELS[r] || r).join(', ') : '—'),
    },
    { key: 'required', label: t('userFields.required'), render: v => v ? '✓' : '' },
    {
      key: 'is_active',
      label: t('dashboard.status'),
      render: (v) => (
        <span style={{
          fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: v ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.15)',
          color: v ? '#047857' : '#64748b',
        }}>
          {v ? t('common.active') : t('common.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
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
    return <div className="page-container"><p>{t('common.noAccess')}</p></div>;
  }

  const needsOptions = formData.field_type === 'select' || formData.field_type === 'multiselect';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('userFields.title')}</h1>
          <p className="page-subtitle">{t('userFields.subtitle')}</p>
        </div>
        <Button variant="primary" size="md" onClick={openCreate}>
          <Plus size={16} /> {t('userFields.addField')}
        </Button>
      </div>

      <div style={infoBannerStyle}>
        <Users size={20} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#065f46', lineHeight: 1.5 }}>
          {t('userFields.explanation')}
        </p>
      </div>

      {fetching ? (
        <p>{t('common.loading')}</p>
      ) : (
        <DataTable columns={columns} data={items} emptyMessage={t('userFields.empty')} />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? t('userFields.editField') : t('userFields.addField')}
        size="md"
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={errorStyle}>{error}</div>}

          <Input
            label={t('userFields.label')}
            value={formData.label}
            onChange={e => setFormData({ ...formData, label: e.target.value })}
            required
          />

          <Input
            label={t('userFields.key')}
            value={formData.field_key}
            onChange={e => setFormData({ ...formData, field_key: slugify(e.target.value) })}
            placeholder={slugify(formData.label) || 'e.g. tax_id'}
            disabled={!!editingId}
          />

          <Select
            label={t('userFields.type')}
            value={formData.field_type}
            onChange={e => setFormData({ ...formData, field_type: e.target.value })}
          >
            {FIELD_TYPES.map(ft => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </Select>

          {needsOptions && (
            <div className="form-group">
              <label className="form-label">{t('userFields.options')}</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={formData.options}
                onChange={e => setFormData({ ...formData, options: e.target.value })}
                placeholder={t('userFields.optionsPlaceholder')}
              />
            </div>
          )}

          <MultiSelect
            label={t('userFields.roles')}
            options={Object.values(ROLES).map(r => ({ value: r, label: ROLE_LABELS[r] }))}
            value={formData.applies_to_roles}
            onChange={(vals) => setFormData({ ...formData, applies_to_roles: vals })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label={t('userFields.displayOrder')}
              type="number"
              value={formData.display_order}
              onChange={e => setFormData({ ...formData, display_order: e.target.value })}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 28 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!formData.required}
                  onChange={e => setFormData({ ...formData, required: e.target.checked })}
                />
                <span>{t('userFields.required')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span>{t('common.active')}</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? t('common.save') : t('userFields.addField')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View (read-only). DetailModal reuses the table's own columns and drops
          the actions one, so the popup can never disagree with the list. */}
      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingRow?.label || viewingRow?.field_key || t('common.view')}
        columns={columns}
        row={viewingRow}
      />
    </div>
  );
}


const infoBannerStyle = {
  display: 'flex',
  gap: 12,
  padding: '14px 18px',
  background: 'rgba(62,207,142,0.08)',
  border: '1px solid rgba(62,207,142,0.25)',
  borderRadius: 10,
  marginBottom: 'var(--spacing-lg)',
  alignItems: 'flex-start',
};

const errorStyle = {
  padding: '10px 12px',
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#ef4444',
  borderRadius: 6,
  fontSize: '0.85rem',
};
