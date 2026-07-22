import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import RowActions from '../ui/RowActions';
import Modal from '../ui/Modal';
import DetailModal from '../ui/DetailModal';
import MultiSelect from '../ui/MultiSelect';
import { Input, Select, Button } from '../ui/FormElements';
import { ROLES, REGIONS } from '../../utils/roles';
import { COUNTRY_DIAL_CODES } from '../../utils/dialCodes';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { AlertCircle, CheckCircle, Eye, EyeOff, UserPlus } from 'lucide-react';

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
//   - File fields       -> /api/user           (action from field.uploadAction)
//
// Props:
//   role            ROLES.* value to filter the profiles list by.
//   columns         display columns (the status + actions columns are appended).
//   editFields      field config, see below.
//   title, subtitleKey(count), loadingText, emptyText
//   scopeToRegion   when true, a regional_admin only sees their own region.
//   createFields    field config; when provided (and the viewer is a super
//                   admin), an "Add" button appears that creates the user via
//                   /api/create-user with this table's `role`.
//   addLabel        label for the Add button. createTitle  modal heading.
//
// Field config — [{ key, label, required?, halfWidth?, type? }] where type is:
//   'text' (default) | 'email' | 'region'
//   'password'    adds a show/hide eye toggle.
//   'multiselect' renders MultiSelect; needs `options` [{value,label}];
//                 the value is a string[].
//   'phone'       dial-code select + number input; the value is stored as one
//                 concatenated "+971 50 123 4567" string (see splitPhone).
//   'file'        file input; supports `accept`, `multiple`, `docType` and
//                 `uploadAction`. Files cannot ride along in the JSON create
//                 payload, so they are sent one-by-one AFTER the row exists.
//   halfWidth: true on consecutive fields lays them out side by side.
const MAX_UPLOAD_MB = 3;

// Split a stored phone string ("+971 50 123 4567") back into dial code +
// number so the two-part control can round-trip it. Longest code wins so
// "+1-268" doesn't get mistaken for "+1". Mirrors Settings.jsx — the single
// `phone` column is the convention; there is no separate dial-code column.
const splitPhone = (raw) => {
  if (!raw) return { code: '+971', number: '' };
  const match = [...COUNTRY_DIAL_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find(c => raw.startsWith(c.code));
  if (match) return { code: match.code, number: raw.slice(match.code.length).trim() };
  return { code: '+971', number: raw };
};

// A bare dial code with no number is not a phone number — store nothing.
const normalizePhone = (raw) => {
  const { code, number } = splitPhone(raw);
  return number.trim() ? `${code} ${number.trim()}` : '';
};

// Serverless handlers receive JSON, so the bytes travel as base64. Vercel caps
// a request body at 4.5 MB and base64 inflates by a third, hence MAX_UPLOAD_MB.
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsDataURL(file);
});

const isFieldEmpty = (f, value) => {
  if (f.type === 'multiselect' || f.type === 'file') return !value || value.length === 0;
  if (f.type === 'phone') return !normalizePhone(value);
  return !String(value || '').trim();
};

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
  // Country search (replaces the old Region filter). Regional admins are still
  // scoped to their region server-side in fetchItems; this is a display filter
  // for super admins across the full list.
  const [countryFilter, setCountryFilter] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({});
  const [showView, setShowView] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Keyed by `${prefix}-${fieldKey}` so the create and edit modals never share
  // a reveal state.
  const [revealed, setRevealed] = useState({});

  const canCreate = isSuperAdmin && createFields.length > 0;

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').eq('role', role);
    if (scopeToRegion && isRegionalAdmin) {
      // Fail-closed: a regional admin with no region resolved must see nothing,
      // never the full unscoped list.
      query = query.eq('region', user?.region || '__no_region__');
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const filtered = countryFilter.trim()
    ? items.filter(i => (i.country || '').toLowerCase().includes(countryFilter.trim().toLowerCase()))
    : items;

  const rowName = (row) => row.full_name || row.company_name || row.email || '';

  // Blank value appropriate to the field type — an empty string in a
  // MultiSelect would render as one anonymous chip.
  const emptyValue = (f) => {
    if (f.type === 'multiselect' || f.type === 'file') return [];
    return '';
  };

  const openEdit = (row) => {
    setEditingRow(row);
    const form = {};
    editFields.forEach(f => {
      if (f.type === 'multiselect') form[f.key] = Array.isArray(row[f.key]) ? row[f.key] : [];
      else if (f.type === 'file') form[f.key] = [];
      else form[f.key] = row[f.key] || '';
    });
    setEditForm(form);
    setError('');
    setShowEdit(true);
  };

  // Push every file field's selection to the server, one request per file.
  // Returns the names that failed: the profile row already exists at this
  // point, so a failed upload must be reported, not thrown away — the account
  // is usable but the document is not attached.
  const uploadFieldFiles = async (fields, form, targetId) => {
    const failed = [];
    for (const f of fields.filter(x => x.type === 'file')) {
      for (const file of (form[f.key] || [])) {
        if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
          failed.push(file.name);
          continue;
        }
        try {
          await apiPost('/api/user', {
            action: f.uploadAction,
            auditorId: targetId,
            docType: f.docType || 'other',
            fileName: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
            dataBase64: await fileToBase64(file),
          });
        } catch (err) {
          console.error('Document upload failed:', f.key, err);
          failed.push(file.name);
        }
      }
    }
    return failed;
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setError('');
    // Required-field validation.
    for (const f of editFields) {
      if (f.required && isFieldEmpty(f, editForm[f.key])) {
        setError(t('admin.fillRequired'));
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { action: 'update-profile', userId: editingRow.id };
      editFields.forEach(f => {
        if (f.type === 'file') return; // sent separately, below
        if (f.type === 'region') payload[f.key] = editForm[f.key] || null;
        else if (f.type === 'phone') payload[f.key] = normalizePhone(editForm[f.key]);
        else payload[f.key] = editForm[f.key];
      });
      await apiPost('/api/user', payload);

      const failedUploads = await uploadFieldFiles(editFields, editForm, editingRow.id);

      // Reflect only the persisted (non-file) values in the list.
      const persisted = { ...editForm };
      editFields.filter(f => f.type === 'file').forEach(f => { delete persisted[f.key]; });
      editFields.filter(f => f.type === 'phone').forEach(f => {
        persisted[f.key] = normalizePhone(editForm[f.key]);
      });
      setItems(prev => prev.map(i => i.id === editingRow.id ? { ...i, ...persisted } : i));
      setShowEdit(false);
      if (failedUploads.length) {
        setError(t('admin.docUploadPartialFailed', {
          count: failedUploads.length,
          files: failedUploads.join(', '),
          max: MAX_UPLOAD_MB,
        }));
      } else {
        setSuccess(`${t('common.save')}: ${rowName(editingRow)}`);
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const openView = (row) => {
    setViewingRow(row);
    setShowView(true);
  };

  const openCreate = () => {
    const form = {};
    createFields.forEach(f => { form[f.key] = emptyValue(f); });
    setCreateForm(form);
    setError('');
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setError('');
    // Required-field validation.
    for (const f of createFields) {
      if (f.required && isFieldEmpty(f, createForm[f.key])) {
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
        if (f.type === 'file') return; // uploaded after the account exists
        if (f.type === 'region') payload[f.key] = createForm[f.key] || null;
        else if (f.type === 'phone') payload[f.key] = normalizePhone(createForm[f.key]);
        else payload[f.key] = createForm[f.key];
      });
      const result = await apiPost('/api/create-user', payload);

      const newId = result?.user?.id;
      const failedUploads = newId
        ? await uploadFieldFiles(createFields, createForm, newId)
        : [];

      setShowCreate(false);
      fetchItems();

      // The account is unusable until the user clicks the verification link, so
      // a failed send has to be visible here rather than showing a plain success.
      if (result?.emailSendFailed) {
        setError(t('admin.createdButEmailFailed'));
      } else if (failedUploads.length) {
        setError(t('admin.docUploadPartialFailed', {
          count: failedUploads.length,
          files: failedUploads.join(', '),
          max: MAX_UPLOAD_MB,
        }));
      } else {
        setSuccess(`${t('common.add') || 'Added'}: ${createForm.full_name || createForm.email || ''}`);
      }
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

  // ---------------------------------------------------------------------
  // Field rendering — shared by the create and edit modals so a new field
  // type only has to be taught once.
  // ---------------------------------------------------------------------
  const renderField = (f, form, setForm, prefix) => {
    const id = `${prefix}-${f.key}`;
    const set = (value) => setForm(p => ({ ...p, [f.key]: value }));

    if (f.type === 'region') {
      return (
        <Select
          key={f.key} label={f.label} id={id} name={f.key}
          value={form[f.key] || ''}
          onChange={(e) => set(e.target.value)}
        >
          <option value="">{t('admin.selectRegion')}</option>
          {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
      );
    }

    if (f.type === 'multiselect') {
      return (
        <MultiSelect
          key={f.key} id={id} label={f.label}
          options={f.options || []}
          value={Array.isArray(form[f.key]) ? form[f.key] : []}
          onChange={set}
          placeholder={f.placeholder || f.label}
          maxVisible={f.maxVisible ?? 2}
        />
      );
    }

    if (f.type === 'phone') {
      const { code, number } = splitPhone(form[f.key] || '');
      return (
        <div className="form-group" key={f.key}>
          <label className="form-label" htmlFor={id}>{f.label}</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ flex: '1 1 120px', minWidth: '120px' }}
              aria-label={f.label}
              value={code}
              onChange={(e) => set(`${e.target.value} ${number}`)}
            >
              {COUNTRY_DIAL_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <input
                className="form-input"
                id={id}
                name={f.key}
                placeholder="50 123 4567"
                value={number}
                onChange={(e) => set(`${code} ${e.target.value}`)}
                required={!!f.required}
              />
            </div>
          </div>
        </div>
      );
    }

    if (f.type === 'file') {
      const chosen = form[f.key] || [];
      return (
        <div className="form-group" key={f.key}>
          <label className="form-label" htmlFor={id}>{f.label}</label>
          <input
            className="form-input"
            id={id}
            type="file"
            accept={f.accept}
            multiple={!!f.multiple}
            onChange={(e) => set(Array.from(e.target.files || []))}
          />
          {chosen.length > 0 && (
            <span className="form-hint" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {t('admin.filesSelected', { count: chosen.length, max: MAX_UPLOAD_MB })}
            </span>
          )}
        </div>
      );
    }

    if (f.type === 'password') {
      const shown = !!revealed[id];
      return (
        <Input
          key={f.key} label={f.label} id={id} name={f.key}
          type={shown ? 'text' : 'password'}
          value={form[f.key] || ''}
          onChange={(e) => set(e.target.value)}
          required={!!f.required}
          rightElement={
            <button
              type="button"
              aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
              title={shown ? t('auth.hidePassword') : t('auth.showPassword')}
              onClick={() => setRevealed(p => ({ ...p, [id]: !shown }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: '4px' }}
            >
              {shown ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
      );
    }

    return (
      <Input
        key={f.key} label={f.label} id={id} name={f.key}
        type={f.type === 'email' ? 'email' : 'text'}
        value={form[f.key] || ''}
        onChange={(e) => set(e.target.value)}
        required={!!f.required}
      />
    );
  };

  // Consecutive `halfWidth` fields share one auto-fitting grid row (the client
  // asked for Standards and Level of certificate to sit next to each other);
  // the minmax collapses them to a single column on a narrow screen.
  const renderFields = (fields, form, setForm, prefix) => {
    const out = [];
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].halfWidth) {
        out.push(renderField(fields[i], form, setForm, prefix));
        continue;
      }
      const run = [];
      while (i < fields.length && fields[i].halfWidth) run.push(fields[i++]);
      i--;
      out.push(
        <div
          key={`row-${run[0].key}`}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-base)' }}
        >
          {run.map(f => renderField(f, form, setForm, prefix))}
        </div>
      );
    }
    return out;
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
  }
  // The read-only "View" action is available to every admin who can reach this
  // list (client request: View enabled for all categories of users). Only the
  // Super Admin gets the destructive/edit actions alongside it.
  allColumns.push({
    key: 'actions',
    label: t('dashboard.action'),
    render: (_, row) => (
      isSuperAdmin ? (
        <RowActions
          isActive={row.is_active !== false}
          showEdit={editFields.length > 0}
          showView
          onView={() => openView(row)}
          onToggle={() => handleToggleActive(row)}
          onEdit={() => openEdit(row)}
          onDelete={() => handleDelete(row)}
        />
      ) : (
        <RowActions
          showView
          onView={() => openView(row)}
          showToggle={false}
          showEdit={false}
          showDelete={false}
        />
      )
    ),
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle(filtered.length)}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!isRegionalAdmin && (
            <Input
              id="filter-country"
              name="country"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              placeholder={t('admin.filterByCountry')}
              style={{ width: '200px' }}
            />
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
          {renderFields(editFields, editForm, setEditForm, 'edit')}
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
          {renderFields(createFields, createForm, setCreateForm, 'create')}
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

      {/* A list cell has to stay narrow, so array columns truncate to "+N".
          The detail popup has room for the whole list, so a column may supply
          `renderDetail` and it wins there. */}
      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingRow ? rowName(viewingRow) : t('common.view')}
        columns={columns.map(c => (c.renderDetail ? { ...c, render: c.renderDetail } : c))}
        row={viewingRow}
      />
    </div>
  );
}
