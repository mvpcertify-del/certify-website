import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import RowActions from '../ui/RowActions';
import Modal from '../ui/Modal';
import { Input, Select, Button } from '../ui/FormElements';
import { ROLES, REGIONS } from '../../utils/roles';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { AlertCircle, CheckCircle, UserPlus } from 'lucide-react';

// Reusable management table for `profiles`-backed admin modules (Auditors,
// Certification Bodies, Regional Admins). It renders the listing plus the
// Super-Admin-only action cluster — Activate/Deactivate, Edit, Delete — using
// the same RowActions component (and therefore the same icons/spacing/theming)
// as the reference Discount Coupons screen.
//
// Writes route through the existing service-role endpoints:
//   - Edit              -> /api/user           (action: 'update-profile')
//   - Activate/Deactivate -> /api/user         (action: 'set-active')  [super only]
//   - Delete            -> /api/delete-user                            [super only]
//
// Props:
//   role            ROLES.* value to filter the profiles list by.
//   columns         display columns (the status + actions columns are appended).
//   editFields      [{ key, label, type? ('text'|'email'|'region'), required? }]
//   title, subtitleKey(count), loadingText, emptyText
//   scopeToRegion   when true, a regional_admin only sees their own region.
//   createFields    [{ key, label, type? ('text'|'email'|'password'|'region'), required? }]
//                   when provided (and the viewer is a super admin), an "Add"
//                   button appears that creates the user via /api/create-user
//                   with this table's `role`.
//   addLabel        label for the Add button. createTitle  modal heading.
export default function ProfileManagementTable({
  role,
  columns,
  editFields = [],
  title,
  subtitle,
  loadingText,
  emptyText,
  scopeToRegion = true,
  createFields = [],
  addLabel,
  createTitle,
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState(
    scopeToRegion && isRegionalAdmin ? (user?.region || '') : ''
  );

  const [showEdit, setShowEdit] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canCreate = isSuperAdmin && createFields.length > 0;

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').eq('role', role);
    if (scopeToRegion && isRegionalAdmin && user?.region) {
      query = query.eq('region', user.region);
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const filtered = regionFilter && !isRegionalAdmin
    ? items.filter(i => i.region === regionFilter)
    : items;

  const rowName = (row) => row.full_name || row.company_name || row.email || '';

  const openEdit = (row) => {
    setEditingRow(row);
    const form = {};
    editFields.forEach(f => { form[f.key] = row[f.key] || ''; });
    setEditForm(form);
    setError('');
    setShowEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setError('');
    // Required-field validation.
    for (const f of editFields) {
      if (f.required && !String(editForm[f.key] || '').trim()) {
        setError(t('admin.fillRequired'));
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { action: 'update-profile', userId: editingRow.id };
      editFields.forEach(f => {
        payload[f.key] = f.type === 'region'
          ? (editForm[f.key] || null)
          : editForm[f.key];
      });
      await apiPost('/api/user', payload);
      setItems(prev => prev.map(i => i.id === editingRow.id ? { ...i, ...editForm } : i));
      setSuccess(`${t('common.save')}: ${rowName(editingRow)}`);
      setShowEdit(false);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const openCreate = () => {
    const form = {};
    createFields.forEach(f => { form[f.key] = ''; });
    setCreateForm(form);
    setError('');
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setError('');
    // Required-field validation.
    for (const f of createFields) {
      if (f.required && !String(createForm[f.key] || '').trim()) {
        setError(t('admin.fillRequired'));
        return;
      }
    }
    // Password rule mirrors the Companies "Add Client" form.
    const pwField = createFields.find(f => f.type === 'password');
    if (pwField && String(createForm[pwField.key] || '').length < 6) {
      setError(t('admin.passwordMinLength'));
      return;
    }
    setSaving(true);
    try {
      const payload = { role };
      createFields.forEach(f => {
        payload[f.key] = f.type === 'region'
          ? (createForm[f.key] || null)
          : createForm[f.key];
      });
      await apiPost('/api/create-user', payload);
      setSuccess(`${t('common.add') || 'Added'}: ${createForm.full_name || createForm.email || ''}`);
      setShowCreate(false);
      fetchItems();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (row) => {
    setError('');
    const next = !(row.is_active !== false);
    try {
      await apiPost('/api/user', { action: 'set-active', userId: row.id, isActive: next });
      setItems(prev => prev.map(i => i.id === row.id ? { ...i, is_active: next } : i));
      setSuccess(`${next ? t('common.activate') : t('common.deactivate')}: ${rowName(row)}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (row) => {
    setError('');
    const name = rowName(row);
    if (!window.confirm(t('admin.deleteUserConfirm') + ` ${name}?`)) return;
    try {
      await apiPost('/api/delete-user', { userId: row.id });
      setItems(prev => prev.filter(i => i.id !== row.id));
      setSuccess(`${t('admin.successDeleted')} ${name}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const allColumns = [...columns];
  if (isSuperAdmin) {
    allColumns.push({
      key: 'is_active',
      label: t('dashboard.status'),
      render: (val) => (
        <StatusBadge
          status={val === false ? 'inactive' : 'active'}
          label={val === false ? t('common.inactive') : t('common.active')}
        />
      ),
    });
    allColumns.push({
      key: 'actions',
      label: t('dashboard.action'),
      render: (_, row) => (
        <RowActions
          isActive={row.is_active !== false}
          showEdit={editFields.length > 0}
          onToggle={() => handleToggleActive(row)}
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
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle(filtered.length)}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!isRegionalAdmin && (
            <Select
              id="filter-region"
              name="region"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="">{t('common.allRegions')}</option>
              {REGIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
          )}
          {canCreate && (
            <Button variant="primary" size="md" onClick={openCreate}>
              <UserPlus size={18} /> {addLabel || t('common.add') || 'Add'}
            </Button>
          )}
        </div>
      </div>

      {success && (
        <div className="admin-users__success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}
      {error && !showEdit && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p>{loadingText}</p>
      ) : (
        <DataTable columns={allColumns} data={filtered} emptyMessage={emptyText} />
      )}

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={t('common.edit')}>
        <form onSubmit={submitEdit} className="admin-users__form">
          {error && (
            <div className="auth-form__error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {editFields.map(f => (
            f.type === 'region' ? (
              <Select
                key={f.key}
                label={f.label}
                id={`edit-${f.key}`}
                name={f.key}
                value={editForm[f.key] || ''}
                onChange={(e) => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
              >
                <option value="">{t('admin.selectRegion')}</option>
                {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            ) : (
              <Input
                key={f.key}
                label={f.label}
                type={f.type === 'email' ? 'email' : 'text'}
                id={`edit-${f.key}`}
                name={f.key}
                value={editForm[f.key] || ''}
                onChange={(e) => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                required={!!f.required}
              />
            )
          ))}
          <div className="admin-users__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowEdit(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={createTitle || addLabel || t('common.add')}>
        <form onSubmit={submitCreate} className="admin-users__form">
          {error && (
            <div className="auth-form__error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {createFields.map(f => (
            f.type === 'region' ? (
              <Select
                key={f.key}
                label={f.label}
                id={`create-${f.key}`}
                name={f.key}
                value={createForm[f.key] || ''}
                onChange={(e) => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))}
              >
                <option value="">{t('admin.selectRegion')}</option>
                {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            ) : (
              <Input
                key={f.key}
                label={f.label}
                type={f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text'}
                id={`create-${f.key}`}
                name={f.key}
                value={createForm[f.key] || ''}
                onChange={(e) => setCreateForm(p => ({ ...p, [f.key]: e.target.value }))}
                required={!!f.required}
              />
            )
          ))}
          <div className="admin-users__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowCreate(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
              {addLabel || t('common.add')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
