import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import MultiSelect from '../../components/ui/MultiSelect';
import { Button, Input, Select, Textarea } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { ROLES } from '../../utils/roles';
import { useAuth } from '../../contexts/AuthContext';
import { IAF_COUNTRIES } from '../../utils/countries';
import { ISO_STANDARD_OPTIONS } from '../../utils/isoStandards';
import { IAF_SECTOR_CODES } from '../../utils/iafCodes';
import { Plus, Search, Pencil, Trash2, Upload, Download, FileText, FileUp } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  acronym: '',
  website: '',
  country: '',
  address: '',
  accreditation_body_ids: [],
  country_ids: [],
  iso_standards: [],
  // Per-standard IAF codes: { [iso_standard]: [code, ...] }
  iaf_by_standard: {},
  // Per-standard pricing: { [iso_standard]: { initial, surveillance, recertification } }
  standard_pricing: {},
  currency: 'USD',
  status: 'active',
};

export default function CertificationBodies() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const canAdd = isSuperAdmin || isRegionalAdmin;
  const canEditOrDelete = isSuperAdmin;

  const [search, setSearch] = useState('');
  const [bodies, setBodies] = useState([]);
  const [accreditationBodies, setAccreditationBodies] = useState([]);
  const [dbCountries, setDbCountries] = useState([]);
  const [fetching, setFetching] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- Fetch CB registry + AB list + countries ---
  const fetchData = async () => {
    setFetching(true);
    try {
      const [cbRes, abRes, countryRes] = await Promise.all([
        supabase
          .from('certification_bodies')
          .select(`
            id, name, acronym, website, country, address, status,
            initial_price, surveillance_price, recertification_price, currency,
            created_at,
            cb_accreditation_bodies ( accreditation_body_id,
              accreditation_bodies ( id, name, acronym ) ),
            cb_countries ( country_id, countries ( id, name ) ),
            cb_iso_standards ( iso_standard ),
            cb_iaf_codes ( iaf_code, iso_standard ),
            cb_standard_pricing ( iso_standard, initial_price, surveillance_price, recertification_price, currency )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('accreditation_bodies').select('id, name, acronym, is_active').order('name'),
        supabase.from('countries').select('id, name, is_active').order('name'),
      ]);

      if (cbRes.data) setBodies(cbRes.data);
      if (abRes.data) setAccreditationBodies(abRes.data);
      if (countryRes.data) setDbCountries(countryRes.data);
    } catch (err) {
      console.error('Failed to load CB registry:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- Dropdown option lists ---
  // Only offer ACTIVE records as selectable options. Deactivated ones
  // (is_active === false) are hidden here; `!== false` keeps everything visible
  // if the is_active column isn't present yet (pre-migration safety).
  const abOptions = useMemo(
    () => accreditationBodies
      .filter(ab => ab.is_active !== false)
      .map(ab => ({ value: ab.id, label: `${ab.acronym} — ${ab.name}` })),
    [accreditationBodies]
  );

  const countryOptions = useMemo(
    () => dbCountries
      .filter(c => c.is_active !== false)
      .map(c => ({ value: c.id, label: c.name })),
    [dbCountries]
  );

  // Fallback: if countries table not populated yet, use the static list (id-less — names only)
  const countryOptionsFallback = useMemo(
    () => IAF_COUNTRIES.map(name => ({ value: name, label: name })),
    []
  );

  const isoOptions = useMemo(
    () => ISO_STANDARD_OPTIONS.map(s => ({ value: s, label: s })),
    []
  );

  const iafOptions = useMemo(
    () => IAF_SECTOR_CODES.map(c => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    []
  );

  // --- Modal actions ---
  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setError('');
    const pricingMap = {};
    for (const p of row.cb_standard_pricing || []) {
      pricingMap[p.iso_standard] = {
        initial: p.initial_price ?? '',
        surveillance: p.surveillance_price ?? '',
        recertification: p.recertification_price ?? '',
      };
    }
    // Group IAF codes under their ISO standard. Legacy rows with no
    // iso_standard (pre per-standard migration) are skipped here.
    const iafMap = {};
    for (const x of row.cb_iaf_codes || []) {
      if (!x.iso_standard) continue;
      (iafMap[x.iso_standard] ||= []).push(x.iaf_code);
    }
    setFormData({
      name: row.name || '',
      acronym: row.acronym || '',
      website: row.website || '',
      country: row.country || '',
      address: row.address || '',
      accreditation_body_ids: (row.cb_accreditation_bodies || [])
        .map(x => x.accreditation_body_id),
      country_ids: (row.cb_countries || []).map(x => x.country_id),
      iso_standards: (row.cb_iso_standards || []).map(x => x.iso_standard),
      iaf_by_standard: iafMap,
      standard_pricing: pricingMap,
      currency: row.currency || 'USD',
      status: row.status || 'active',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  // --- Write join tables ---
  const writeJoinRows = async (cbId, data) => {
    // Wipe + re-insert on edit (simple, correct, no diffing).
    if (editingId) {
      await Promise.all([
        supabase.from('cb_accreditation_bodies').delete().eq('cb_id', cbId),
        supabase.from('cb_countries').delete().eq('cb_id', cbId),
        supabase.from('cb_iso_standards').delete().eq('cb_id', cbId),
        supabase.from('cb_iaf_codes').delete().eq('cb_id', cbId),
        supabase.from('cb_standard_pricing').delete().eq('cb_id', cbId),
      ]);
    }

    const abRows = data.accreditation_body_ids.map(id => ({
      cb_id: cbId,
      accreditation_body_id: id,
    }));
    const countryRows = data.country_ids.map(id => ({
      cb_id: cbId,
      country_id: id,
    }));
    const isoRows = data.iso_standards.map(s => ({
      cb_id: cbId,
      iso_standard: s,
    }));
    // Each standard carries its own IAF codes (a code can repeat across standards).
    const iafRows = [];
    for (const std of data.iso_standards) {
      for (const code of (data.iaf_by_standard?.[std] || [])) {
        iafRows.push({ cb_id: cbId, iso_standard: std, iaf_code: code });
      }
    }

    // Only write pricing rows for standards actually selected AND with at least one price.
    const pricingRows = data.iso_standards
      .map(std => {
        const p = data.standard_pricing[std] || {};
        const toNum = (v) => v === '' || v == null ? null : Number(v);
        const initial = toNum(p.initial);
        const surveillance = toNum(p.surveillance);
        const recertification = toNum(p.recertification);
        if (initial == null && surveillance == null && recertification == null) return null;
        return {
          cb_id: cbId,
          iso_standard: std,
          initial_price: initial,
          surveillance_price: surveillance,
          recertification_price: recertification,
          currency: data.currency || 'USD',
        };
      })
      .filter(Boolean);

    const writes = [];
    if (abRows.length) writes.push(supabase.from('cb_accreditation_bodies').insert(abRows));
    if (countryRows.length) writes.push(supabase.from('cb_countries').insert(countryRows));
    if (isoRows.length) writes.push(supabase.from('cb_iso_standards').insert(isoRows));
    if (iafRows.length) writes.push(supabase.from('cb_iaf_codes').insert(iafRows));
    if (pricingRows.length) writes.push(supabase.from('cb_standard_pricing').insert(pricingRows));

    const results = await Promise.all(writes);
    for (const r of results) {
      if (r.error) throw r.error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError(t('certBody.nameRequired'));
      return;
    }
    if (formData.accreditation_body_ids.length === 0) {
      setError(t('certBody.selectAtLeastOneAB'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        acronym: formData.acronym.trim() || null,
        website: formData.website.trim() || null,
        country: formData.country || null,
        address: formData.address.trim() || null,
        status: formData.status || 'active',
        currency: formData.currency || 'USD',
      };

      let cbId = editingId;

      if (editingId) {
        const { error: updErr } = await supabase
          .from('certification_bodies')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (updErr) throw updErr;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('certification_bodies')
          .insert([{ ...payload, created_by: user?.id || null }])
          .select()
          .single();
        if (insErr) throw insErr;
        cbId = inserted.id;
      }

      await writeJoinRows(cbId, formData);
      await fetchData();
      closeModal();
    } catch (err) {
      console.error('Save CB error:', err);
      setError(err.message || t('certBody.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!canEditOrDelete) return;
    if (!window.confirm(t('certBody.confirmDelete', { name: row.name }))) return;
    try {
      const { error: delErr } = await supabase
        .from('certification_bodies')
        .delete()
        .eq('id', row.id);
      if (delErr) throw delErr;
      setBodies(prev => prev.filter(b => b.id !== row.id));
    } catch (err) {
      console.error('Delete CB error:', err);
      alert(t('certBody.deleteFailed') + ': ' + err.message);
    }
  };

  // --- Bulk import: create one CB from pasted/matched data ---
  // editingId is null here, so writeJoinRows performs inserts only (no wipe).
  const importCb = async (parsed) => {
    const payload = {
      name: parsed.name.trim(),
      acronym: parsed.acronym?.trim() || null,
      website: parsed.website?.trim() || null,
      country: null,
      address: parsed.address?.trim() || null,
      status: 'active',
      currency: parsed.currency || 'USD',
    };
    const { data: inserted, error: insErr } = await supabase
      .from('certification_bodies')
      .insert([{ ...payload, created_by: user?.id || null }])
      .select()
      .single();
    if (insErr) throw insErr;

    // Quick import applies the one pasted IAF list to every imported standard;
    // refine per-standard afterwards via Edit if they differ.
    const iafByStandard = {};
    for (const std of parsed.iso_standards) iafByStandard[std] = parsed.iaf_codes;

    await writeJoinRows(inserted.id, {
      accreditation_body_ids: parsed.accreditation_body_ids,
      country_ids: parsed.country_ids,
      iso_standards: parsed.iso_standards,
      iaf_by_standard: iafByStandard,
      standard_pricing: {},
      currency: parsed.currency || 'USD',
    });
    await fetchData();
  };

  if (!user || loading) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  const filtered = bodies.filter(b => {
    const q = search.toLowerCase();
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.acronym || '').toLowerCase().includes(q) ||
      (b.country || '').toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      key: 'name',
      label: t('admin.bodyName'),
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{val || '—'}</div>
          {row.acronym && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{row.acronym}</div>
          )}
          {row.address && (
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: 2, maxWidth: 260 }}>{row.address}</div>
          )}
        </div>
      ),
    },
    {
      key: 'cb_accreditation_bodies',
      label: t('certBody.accreditationBodies'),
      render: (val) => {
        if (!val || val.length === 0) return '—';
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {val.slice(0, 3).map((x, i) => (
              <span key={i} style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(62,207,142,0.12)',
                color: 'var(--color-accent, #3ECF8E)',
                fontWeight: 500,
              }}>
                {x.accreditation_bodies?.acronym || '—'}
              </span>
            ))}
            {val.length > 3 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>
                +{val.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'cb_countries',
      label: t('certBody.countriesCovered'),
      render: (val) => {
        if (!val || val.length === 0) return '—';
        if (val.length <= 2) {
          return val.map(x => x.countries?.name).filter(Boolean).join(', ');
        }
        return `${val[0].countries?.name || ''}, ${val[1].countries?.name || ''} +${val.length - 2}`;
      },
    },
    {
      key: 'cb_iso_standards',
      label: t('certBody.isoTypes'),
      render: (val) => {
        if (!val || val.length === 0) return '—';
        return val.slice(0, 3).map(x => x.iso_standard).join(', ') + (val.length > 3 ? ` +${val.length - 3}` : '');
      },
    },
    {
      key: 'website',
      label: t('admin.website'),
      render: (val) => val ? (
        <a href={val} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent, #3ECF8E)' }}>
          {val.replace(/^https?:\/\//, '').split('/')[0]}
        </a>
      ) : '—',
    },
    {
      key: 'status',
      label: t('dashboard.status'),
      render: (val) => <StatusBadge status={val} />,
    },
  ];

  if (canEditOrDelete || canAdd) {
    columns.push({
      key: 'actions',
      label: t('common.actions') || 'Actions',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {canEditOrDelete && (
            <button
              type="button"
              className="icon-btn"
              title={t('common.edit') || 'Edit'}
              onClick={() => openEdit(row)}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 6,
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Pencil size={14} />
            </button>
          )}
          {canEditOrDelete && (
            <button
              type="button"
              className="icon-btn"
              title={t('common.delete') || 'Delete'}
              onClick={() => handleDelete(row)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 6,
                padding: 6,
                cursor: 'pointer',
                color: '#ef4444',
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    });
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.certBodiesTitle')}</h1>
          <p className="page-subtitle">{t('admin.certBodiesFound', { count: filtered.length })}</p>
        </div>
        {canAdd && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="md" onClick={() => setShowImport(true)}>
              <FileUp size={16} /> {t('certBody.importBody')}
            </Button>
            <Button variant="primary" size="md" onClick={openCreate}>
              <Plus size={16} /> {t('certBody.addBody')}
            </Button>
          </div>
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
        <p>{t('admin.loadingCertBodies')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('admin.noCertBodiesFound')}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingId ? t('certBody.editBody') : t('certBody.addBody')}
        size="lg"
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

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Input
              label={t('certBody.bodyNameRequired')}
              name="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label={t('certBody.acronym')}
              name="acronym"
              value={formData.acronym}
              onChange={e => setFormData({ ...formData, acronym: e.target.value })}
            />
          </div>

          <Input
            label={t('admin.website')}
            name="website"
            type="url"
            placeholder="https://..."
            value={formData.website}
            onChange={e => setFormData({ ...formData, website: e.target.value })}
          />

          <Textarea
            label={t('certBody.address')}
            name="address"
            rows={2}
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
          />

          <MultiSelect
            label={t('certBody.accreditationBodiesRequired')}
            options={abOptions}
            value={formData.accreditation_body_ids}
            onChange={(ids) => setFormData({ ...formData, accreditation_body_ids: ids })}
            placeholder={t('certBody.selectABs')}
          />

          <MultiSelect
            label={t('certBody.countriesCovered')}
            options={countryOptions.length > 0 ? countryOptions : countryOptionsFallback}
            value={formData.country_ids}
            onChange={(ids) => setFormData({ ...formData, country_ids: ids })}
            placeholder={t('certBody.selectCountries')}
          />

          <MultiSelect
            label={t('certBody.isoTypes')}
            options={isoOptions}
            value={formData.iso_standards}
            onChange={(vals) => setFormData({ ...formData, iso_standards: vals })}
            placeholder={t('certBody.selectISO')}
          />

          <div style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: 12,
            marginTop: 4,
          }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
              {t('certBody.iafCodesPerStandard')}
            </h4>
            {formData.iso_standards.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', padding: '8px 0' }}>
                {t('certBody.iafSelectStandardsFirst')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {formData.iso_standards.map(std => (
                  <MultiSelect
                    key={std}
                    label={std}
                    options={iafOptions}
                    value={formData.iaf_by_standard[std] || []}
                    onChange={(vals) => setFormData(prev => ({
                      ...prev,
                      iaf_by_standard: { ...prev.iaf_by_standard, [std]: vals },
                    }))}
                    placeholder={t('certBody.selectIAF')}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: 12,
            marginTop: 4,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', margin: 0 }}>
                {t('certBody.pricingPerStandard')}
              </h4>
              <div style={{ width: 110 }}>
                <Select
                  label=""
                  name="currency"
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                  <option value="INR">INR</option>
                </Select>
              </div>
            </div>

            {formData.iso_standards.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', padding: '8px 0' }}>
                {t('certBody.pricingSelectStandardsFirst')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 10, fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: 4 }}>
                  <span>{t('certBody.standard')}</span>
                  <span>{t('certBody.initial')}</span>
                  <span>{t('certBody.surveillance')}</span>
                  <span>{t('certBody.recertification')}</span>
                </div>
                {formData.iso_standards.map(std => {
                  const p = formData.standard_pricing[std] || {};
                  const setPrice = (key, value) => setFormData(prev => ({
                    ...prev,
                    standard_pricing: {
                      ...prev.standard_pricing,
                      [std]: { ...(prev.standard_pricing[std] || {}), [key]: value },
                    },
                  }));
                  return (
                    <div key={std} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-primary)', padding: '0 4px' }}>{std}</span>
                      <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={p.initial ?? ''} onChange={e => setPrice('initial', e.target.value)} />
                      <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={p.surveillance ?? ''} onChange={e => setPrice('surveillance', e.target.value)} />
                      <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={p.recertification ?? ''} onChange={e => setPrice('recertification', e.target.value)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {editingId && (
            <CbDocumentsSection cbId={editingId} canWrite={canEditOrDelete} t={t} user={user} />
          )}

          <Select
            label={t('dashboard.status')}
            name="status"
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">{t('admin.active') || 'Active'}</option>
            <option value="inactive">{t('admin.inactive') || 'Inactive'}</option>
          </Select>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? t('common.save') : t('certBody.addBody')}
            </Button>
          </div>
        </form>
      </Modal>

      <BulkImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={importCb}
        abOptions={abOptions}
        countryOptions={countryOptions.length > 0 ? countryOptions : countryOptionsFallback}
        isoOptions={isoOptions}
        iafOptions={iafOptions}
        t={t}
      />
    </div>
  );
}

// --- Bulk import: paste lists copied from an accreditation schedule ---
// Matches pasted text against the existing option lists (accreditation bodies,
// countries, ISO standards, IAF codes) and creates a single CB on confirm.
const splitItems = (text) =>
  (text || '')
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function resolveTokens(text, options, kind) {
  const tokens = splitItems(text);
  const matched = [];
  const unmatched = [];
  const seen = new Set();

  for (const tok of tokens) {
    let opt = null;
    if (kind === 'iaf') {
      const m = tok.match(/\d{1,2}/);
      if (m) {
        const code = m[0].padStart(2, '0');
        opt = options.find(o => o.value === code);
      }
    } else if (kind === 'iso') {
      const compact = norm(tok).replace(/\s+/g, '');
      opt = options.find(o => norm(o.label).replace(/\s+/g, '') === compact)
        || options.find(o => norm(o.label).includes(norm(tok)));
    } else if (kind === 'country') {
      const tn = norm(tok);
      opt = options.find(o => norm(o.label) === tn)
        || (tn.length >= 4 ? options.find(o => norm(o.label).includes(tn)) : null);
    } else { // accreditation body — match acronym or name within "ACR — Name"
      const tn = norm(tok);
      opt = options.find(o => norm(o.label).split('—').some(part => part.trim() === tn))
        || options.find(o => norm(o.label).includes(tn));
    }

    if (opt) {
      if (!seen.has(opt.value)) { seen.add(opt.value); matched.push(opt); }
    } else {
      unmatched.push(tok);
    }
  }
  return { matched, unmatched };
}

function MatchSummary({ result, t }) {
  return (
    <div style={{ marginTop: 4, fontSize: '0.75rem' }}>
      <span style={{ color: 'var(--color-accent, #3ECF8E)', fontWeight: 600 }}>
        {t('certBody.matched', { count: result.matched.length })}
      </span>
      {result.unmatched.length > 0 && (
        <>
          <span style={{ color: 'var(--color-text-tertiary)' }}> · </span>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>
            {t('certBody.notFound', { count: result.unmatched.length })}
          </span>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {result.unmatched.map((u, i) => (
              <span key={i} style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
              }}>
                {u}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BulkImportModal({ isOpen, onClose, onImport, abOptions, countryOptions, isoOptions, iafOptions, t }) {
  const [name, setName] = useState('');
  const [acronym, setAcronym] = useState('');
  const [website, setWebsite] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [abText, setAbText] = useState('');
  const [countryText, setCountryText] = useState('');
  const [isoText, setIsoText] = useState('');
  const [iafText, setIafText] = useState('');
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState('');

  const preview = useMemo(() => ({
    ab: resolveTokens(abText, abOptions, 'ab'),
    countries: resolveTokens(countryText, countryOptions, 'country'),
    iso: resolveTokens(isoText, isoOptions, 'iso'),
    iaf: resolveTokens(iafText, iafOptions, 'iaf'),
  }), [abText, countryText, isoText, iafText, abOptions, countryOptions, isoOptions, iafOptions]);

  const reset = () => {
    setName(''); setAcronym(''); setWebsite(''); setCurrency('USD');
    setAbText(''); setCountryText(''); setIsoText(''); setIafText('');
    setErr('');
  };

  const close = () => { reset(); onClose(); };

  const handleImport = async () => {
    setErr('');
    if (!name.trim()) { setErr(t('certBody.importNoName')); return; }
    if (preview.ab.matched.length === 0) { setErr(t('certBody.importNoAB')); return; }

    setImporting(true);
    try {
      await onImport({
        name, acronym, website, currency,
        accreditation_body_ids: preview.ab.matched.map(o => o.value),
        country_ids: preview.countries.matched.map(o => o.value),
        iso_standards: preview.iso.matched.map(o => o.value),
        iaf_codes: preview.iaf.matched.map(o => o.value),
      });
      close();
    } catch (e) {
      console.error('Import CB error:', e);
      setErr(e.message || t('certBody.saveFailed'));
    } finally {
      setImporting(false);
    }
  };

  const taStyle = { minHeight: 70, resize: 'vertical', fontFamily: 'inherit' };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('certBody.importBody')} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('certBody.importIntro')}
        </p>

        {err && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
            borderRadius: 6,
            fontSize: '0.85rem',
          }}>
            {err}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label={t('certBody.bodyNameRequired')} value={name} onChange={e => setName(e.target.value)} required />
          <Input label={t('certBody.acronym')} value={acronym} onChange={e => setAcronym(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Input label={t('admin.website')} type="url" placeholder="https://..." value={website} onChange={e => setWebsite(e.target.value)} />
          <Select label={t('certBody.currency')} value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AED">AED</option>
            <option value="INR">INR</option>
          </Select>
        </div>

        <div>
          <Textarea label={t('certBody.pasteABs')} style={taStyle} value={abText} onChange={e => setAbText(e.target.value)} placeholder="EGAC&#10;UAF" />
          <MatchSummary result={preview.ab} t={t} />
        </div>

        <div>
          <Textarea label={t('certBody.pasteCountries')} style={taStyle} value={countryText} onChange={e => setCountryText(e.target.value)} placeholder="India, Thailand, Egypt..." />
          <MatchSummary result={preview.countries} t={t} />
        </div>

        <div>
          <Textarea label={t('certBody.pasteISO')} style={taStyle} value={isoText} onChange={e => setIsoText(e.target.value)} placeholder="ISO 9001:2015&#10;ISO 14001" />
          <MatchSummary result={preview.iso} t={t} />
        </div>

        <div>
          <Textarea label={t('certBody.pasteIAF')} style={taStyle} value={iafText} onChange={e => setIafText(e.target.value)} placeholder="01, 03, 13, 31..." />
          <MatchSummary result={preview.iaf} t={t} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button type="button" variant="ghost" onClick={close}>{t('common.cancel')}</Button>
          <Button type="button" variant="primary" loading={importing} onClick={handleImport}>
            {t('certBody.importBody')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- CB Accreditation Schedule Documents (per-CB) ---
function CbDocumentsSection({ cbId, canWrite, t, user }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cb_documents')
      .select('*')
      .eq('cb_id', cbId)
      .order('uploaded_at', { ascending: false });
    if (!error && data) setDocs(data);
    setLoading(false);
  };

  useEffect(() => { if (cbId) load(); }, [cbId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const { data: row, error: insErr } = await supabase
        .from('cb_documents')
        .insert([{
          cb_id: cbId,
          file_name: file.name,
          file_size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          document_type: 'accreditation_schedule',
          uploaded_by: user?.id || null,
        }])
        .select()
        .single();
      if (insErr) throw insErr;

      const path = `${cbId}/${row.id}`;
      const { error: upErr } = await supabase.storage
        .from('cb-documents')
        .upload(path, file, { upsert: true });
      if (upErr) {
        await supabase.from('cb_documents').delete().eq('id', row.id);
        throw upErr;
      }
      setDocs(prev => [row, ...prev]);
    } catch (ex) {
      console.error('CB doc upload error:', ex);
      setErr(ex.message || t('certBody.docUploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc) => {
    try {
      const path = `${cbId}/${doc.id}`;
      const { data, error } = await supabase.storage.from('cb-documents').download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (ex) {
      console.error('CB doc download error:', ex);
      alert(t('certBody.docDownloadFailed') + ': ' + ex.message);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(t('certBody.confirmDeleteDoc', { name: doc.file_name }))) return;
    try {
      await supabase.storage.from('cb-documents').remove([`${cbId}/${doc.id}`]);
      const { error } = await supabase.from('cb_documents').delete().eq('id', doc.id);
      if (error) throw error;
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (ex) {
      console.error('CB doc delete error:', ex);
      alert(t('certBody.docDeleteFailed') + ': ' + ex.message);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0, color: 'var(--color-text-secondary)' }}>
          {t('certBody.accreditationSchedule')}
        </h4>
        {canWrite && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploading ? 'wait' : 'pointer', padding: '6px 12px', borderRadius: 6, background: 'var(--color-accent, #3ECF8E)', color: '#fff', fontSize: '0.8rem', fontWeight: 500, opacity: uploading ? 0.7 : 1 }}>
            <Upload size={12} />
            {uploading ? t('common.uploading') : t('certBody.uploadDoc')}
            <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {err && (
        <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, fontSize: '0.8rem', marginBottom: 8 }}>
          {err}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>{t('common.loading')}</p>
      ) : docs.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', margin: 0 }}>{t('certBody.noDocs')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.85rem' }}>
              <FileText size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              <span style={{ flex: 1 }}>{d.file_name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{d.file_size || '—'}</span>
              <button type="button" onClick={() => handleDownload(d)} title={t('common.download')} style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, padding: 4, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <Download size={12} />
              </button>
              {canWrite && (
                <button type="button" onClick={() => handleDelete(d)} title={t('common.delete')} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, padding: 4, cursor: 'pointer', color: '#ef4444' }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
