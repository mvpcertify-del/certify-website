import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import StatusBadge from '../../components/ui/StatusBadge';
import RowActions from '../../components/ui/RowActions';
import { Button, Input, Select } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
// Pencil/Trash2 were dropped with the hand-rolled action buttons — RowActions
// owns those icons now. RefreshCw is still used by the "regenerate code" button.
import { Plus, Search, Copy, Check, Link2, RefreshCw } from 'lucide-react';

const EMPTY = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_percent: 10,
  discount_amount: 100,
  max_redemptions: '',
  expires_at: '',
  is_active: true,
};

const DISCOUNT_PRESETS = [10, 15, 20, 25];
const AMOUNT_PRESETS = [50, 100, 200, 500];

// `SAVE20-XXXXX` for percent coupons, `SAVE200USD-XXXXX` for fixed-amount ones.
function genCode(type, value) {
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (type === 'amount') {
    return `SAVE${value || 100}USD-${rand}`;
  }
  return `SAVE${value || 10}-${rand}`;
}

// Shared look for the selectable pill buttons (type toggle + value presets).
function pillStyle(isSelected) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    border: isSelected
      ? '2px solid var(--color-accent, #3ECF8E)'
      : '1px solid var(--color-border)',
    background: isSelected ? 'rgba(62,207,142,0.1)' : 'transparent',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
  };
}

// Rows created before the fixed-amount feature have a null discount_type.
function formatDiscount(row) {
  if ((row.discount_type || 'percent') === 'amount') {
    const amt = Number(row.discount_amount);
    return amt > 0 ? `US$${amt.toLocaleString()}` : '—';
  }
  const pct = Number(row.discount_percent);
  return pct > 0 ? `${pct}%` : '—';
}

export default function AdminCoupons() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const canWrite = isSuperAdmin;

  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [customDiscount, setCustomDiscount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  // Read-only View popup — the first of the four row actions (client, 12 Aug:
  // "now I see only 3 Deactivate, Edit, Delete (View) Is missing").
  const [showView, setShowView] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);

  const isAmountType = formData.discount_type === 'amount';

  const fetchData = async () => {
    setFetching(true);
    const { data, error: err } = await supabase
      .from('discount_coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (!err && data) setItems(data);
    setFetching(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    if (!canWrite) return;
    setEditingId(null);
    setFormData({ ...EMPTY, code: genCode('percent', 10) });
    setCustomDiscount(false);
    setError('');
    setShowModal(true);
  };

  const openEdit = (row) => {
    if (!canWrite) return;
    setEditingId(row.id);
    const type = (row.discount_type || 'percent') === 'amount' ? 'amount' : 'percent';
    const pct = Number(row.discount_percent) || 10;
    const amt = Number(row.discount_amount) || 100;
    setFormData({
      code: row.code || '',
      description: row.description || '',
      discount_type: type,
      discount_percent: pct,
      discount_amount: amt,
      max_redemptions: row.max_redemptions ?? '',
      expires_at: row.expires_at ? row.expires_at.slice(0, 10) : '',
      is_active: !!row.is_active,
    });
    setCustomDiscount(type === 'amount'
      ? !AMOUNT_PRESETS.includes(amt)
      : !DISCOUNT_PRESETS.includes(pct));
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(EMPTY);
    setCustomDiscount(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const code = formData.code.trim().toUpperCase();
    const isAmount = formData.discount_type === 'amount';
    const pct = Number(formData.discount_percent);
    const amt = Number(formData.discount_amount);

    if (!code) {
      setError(t('coupons.codeRequired'));
      return;
    }
    if (isAmount) {
      if (!Number.isFinite(amt) || amt <= 0) {
        setError(t('coupons.amountInvalid'));
        return;
      }
    } else if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setError(t('coupons.percentInvalid'));
      return;
    }

    setSaving(true);
    try {
      // The DB CHECK requires exactly one value column set and the other
      // explicitly NULL — always send both keys.
      const payload = {
        code,
        description: formData.description.trim() || null,
        discount_type: isAmount ? 'amount' : 'percent',
        discount_percent: isAmount ? null : pct,
        discount_amount: isAmount ? amt : null,
        max_redemptions: formData.max_redemptions === '' ? null : Number(formData.max_redemptions),
        expires_at: formData.expires_at || null,
        is_active: !!formData.is_active,
      };

      if (editingId) {
        const { error: upErr } = await supabase
          .from('discount_coupons')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from('discount_coupons')
          .insert([{ ...payload, created_by: user?.id }]);
        if (insErr) throw insErr;
      }

      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Save coupon error:', err);
      setError(err.message || t('coupons.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!canWrite) return;
    if (!window.confirm(t('coupons.confirmDelete', { code: row.code }))) return;
    try {
      const { error: delErr } = await supabase
        .from('discount_coupons')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setItems(prev => prev.filter(c => c.id !== row.id));
    } catch (err) {
      console.error('Delete coupon error:', err);
      alert(t('coupons.deleteFailed') + ': ' + err.message);
    }
  };

  const toggleActive = async (row) => {
    if (!canWrite) return;
    try {
      const { error: upErr } = await supabase
        .from('discount_coupons')
        .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) throw upErr;
      setItems(prev => prev.map(c => c.id === row.id ? { ...c, is_active: !row.is_active } : c));
    } catch (err) {
      console.error('Toggle coupon error:', err);
      alert(err.message);
    }
  };

  const buildShareLink = (code) => `${window.location.origin}/signup?coupon=${encodeURIComponent(code)}`;

  const handleCopyLink = async (row) => {
    try {
      await navigator.clipboard.writeText(buildShareLink(row.code));
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // no-op
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(c => {
      const matchSearch = !q ||
        c.code?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q);
      const matchStatus =
        !statusFilter ||
        (statusFilter === 'active' && c.is_active) ||
        (statusFilter === 'inactive' && !c.is_active);
      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  const columns = [
    {
      key: 'code',
      label: t('coupons.code'),
      render: (v) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>,
    },
    {
      key: 'discount_percent',
      label: t('coupons.discount'),
      render: (_, row) => formatDiscount(row),
    },
    {
      key: 'redemption_count',
      label: t('coupons.redemptions'),
      render: (v, row) => {
        const used = v || 0;
        const cap = row.max_redemptions;
        return cap ? `${used} / ${cap}` : `${used}`;
      },
    },
    {
      key: 'expires_at',
      label: t('coupons.expires'),
      render: (v) => v ? new Date(v).toLocaleDateString() : t('coupons.never'),
    },
    {
      key: 'is_active',
      label: t('dashboard.status'),
      render: (v) => (
        <StatusBadge
          status={v ? 'active' : 'inactive'}
          label={v ? t('common.active') : t('common.inactive')}
        />
      ),
    },
    {
      key: 'share',
      label: t('coupons.shareLink'),
      render: (_, row) => (
        <button
          type="button"
          onClick={() => handleCopyLink(row)}
          title={buildShareLink(row.code)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            fontSize: '0.8rem',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
          }}
        >
          {copiedId === row.id ? <Check size={14} color="#10b981" /> : <Link2 size={14} />}
          {copiedId === row.id ? t('common.copied') : t('common.copy')}
        </button>
      ),
    },
  ];

  if (canWrite) {
    columns.push({
      key: 'actions',
      label: t('common.actions') || 'Actions',
      // This screen used to hand-roll its own three buttons, which is how it
      // drifted out of step with the rest of the admin area — it was the only
      // list with no View. Switched to the shared RowActions so it can never
      // drift again, and so all four icons are present (client, 12 Aug).
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
    });
  }

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
          <h1 className="page-title">{t('coupons.title')}</h1>
          <p className="page-subtitle">{t('coupons.subtitle', { count: filtered.length })}</p>
        </div>
        {canWrite && (
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus size={16} /> {t('coupons.addCoupon')}
          </Button>
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">{t('common.allStatuses') || 'All Statuses'}</option>
          <option value="active">{t('common.active')}</option>
          <option value="inactive">{t('common.inactive')}</option>
        </Select>
      </div>

      {fetching ? (
        <p>{t('coupons.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('coupons.empty')}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? t('coupons.editCoupon') : t('coupons.addCoupon')}
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Input
              label={t('coupons.code')}
              name="code"
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="SAVE10-XXXXX"
              required
              style={{ fontFamily: 'monospace', flex: 1 }}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormData(f => ({
                ...f,
                code: genCode(f.discount_type, f.discount_type === 'amount' ? f.discount_amount : f.discount_percent),
              }))}
            >
              <RefreshCw size={14} /> {t('coupons.regenerate')}
            </Button>
          </div>

          <div>
            <label className="form-label">{t('coupons.discountType')}</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { value: 'percent', label: t('coupons.typePercent') },
                { value: 'amount', label: t('coupons.typeAmount') },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setCustomDiscount(false);
                    setFormData(f => ({ ...f, discount_type: opt.value }));
                  }}
                  style={pillStyle(formData.discount_type === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="form-label">{t('coupons.discount')}</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {isAmountType
                ? AMOUNT_PRESETS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setCustomDiscount(false);
                      setFormData(f => ({ ...f, discount_amount: a }));
                    }}
                    style={pillStyle(!customDiscount && Number(formData.discount_amount) === a)}
                  >
                    US${a}
                  </button>
                ))
                : DISCOUNT_PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setCustomDiscount(false);
                      setFormData(f => ({ ...f, discount_percent: p }));
                    }}
                    style={pillStyle(!customDiscount && Number(formData.discount_percent) === p)}
                  >
                    {p}%
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setCustomDiscount(true)}
                style={pillStyle(customDiscount)}
              >
                {t('coupons.custom')}
              </button>
            </div>
            {customDiscount && (isAmountType ? (
              <Input
                type="number"
                name="discount_amount"
                min="1"
                step="0.01"
                value={formData.discount_amount}
                onChange={e => setFormData({ ...formData, discount_amount: e.target.value })}
                placeholder={t('coupons.customAmountPlaceholder')}
                required
              />
            ) : (
              <Input
                type="number"
                name="discount_percent"
                min="1"
                max="100"
                step="0.01"
                value={formData.discount_percent}
                onChange={e => setFormData({ ...formData, discount_percent: e.target.value })}
                placeholder={t('coupons.customPercentPlaceholder')}
                required
              />
            ))}
          </div>

          <Input
            label={t('coupons.description')}
            name="description"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('coupons.descriptionPlaceholder')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label={t('coupons.maxRedemptions')}
              type="number"
              name="max_redemptions"
              min="1"
              value={formData.max_redemptions}
              onChange={e => setFormData({ ...formData, max_redemptions: e.target.value })}
              placeholder={t('coupons.unlimited')}
            />
            <Input
              label={t('coupons.expiresAt')}
              type="date"
              name="expires_at"
              value={formData.expires_at}
              onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <span>{t('coupons.activeLabel')}</span>
          </label>

          {formData.code && (
            <div style={{
              padding: 12,
              background: 'rgba(62,207,142,0.08)',
              border: '1px solid rgba(62,207,142,0.25)',
              borderRadius: 8,
              fontSize: '0.82rem',
            }}>
              <div style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                {t('coupons.sharePreview')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link2 size={12} />
                <code style={{ wordBreak: 'break-all' }}>{buildShareLink(formData.code)}</code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(buildShareLink(formData.code));
                    } catch { /* ignore */ }
                  }}
                  style={{
                    marginLeft: 'auto',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  <Copy size={12} /> {t('common.copy')}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? t('common.save') : t('coupons.addCoupon')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View (read-only). DetailModal reuses the table's own columns and drops
          the actions one, so the popup can never disagree with the list. */}
      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingRow?.code || t('common.view')}
        columns={columns}
        row={viewingRow}
      />
    </div>
  );
}
