import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import DashboardBoxes from '../../components/ui/DashboardBoxes';
import { Button, Input, Select, Textarea } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import RowActions from '../../components/ui/RowActions';
import { Building2, CheckCircle2, Globe2, Mail } from 'lucide-react';

// The groupings the client's fund list is organised by. Hardcoded rather than
// derived from the rows so the dropdown keeps offering a region even when no
// fund currently sits in it — an empty result is a real answer here.
//
// Israel is deliberately absent: the client asked on 10 Sep that those funds be
// removed, and offering a filter that can only ever return nothing would read
// as a bug.
const REGIONS = [
  'North America',
  'Latin America',
  'Europe',
  'Middle East & Africa',
  'Asia',
  'India',
];

const EMPTY = {
  fund_name: '',
  region: '',
  country: '',
  geography: '',
  stage: '',
  sector: '',
  leads: '',
  check_range: '',
  recent_activity: '',
  website: '',
  fund_linkedin: '',
  key_partner: '',
  partner_linkedin: '',
  notes: '',
  contact_email: '',
  source: '',
  is_active: true,
};

// Hosts are stored bare ("mayfield.com"), so a value used verbatim as an href
// resolves relative to the app and navigates to a dead in-app route. Every link
// on this screen goes through here.
function ExternalLink({ value }) {
  if (!value) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
  const trimmed = String(value).trim();
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
      {trimmed}
    </a>
  );
}

function Plain({ value }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
  }
  return <span>{value}</span>;
}

export default function AdminInvestors() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [items, setItems] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [missingEmailOnly, setMissingEmailOnly] = useState(false);
  const regionRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [showView, setShowView] = useState(false);
  const [viewingRow, setViewingRow] = useState(null);

  const fetchData = async () => {
    setFetching(true);
    // Grouped by region then alphabetical inside it — this list is read as a
    // territory-by-territory review, not as a feed of recent additions.
    const { data, error: selErr } = await supabase
      .from('investors')
      .select('*')
      .order('region', { ascending: true })
      .order('fund_name', { ascending: true });
    if (selErr) {
      console.error('Load investors error:', selErr);
      setError(t('investors.loadFailed'));
    } else {
      setError('');
      setItems(data || []);
    }
    setFetching(false);
  };

  // Load once on mount. fetchData is intentionally out of the dep array: it is
  // recreated every render, and listing it would refetch the whole table on
  // every keystroke in the search box.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (region !== 'all' && row.region !== region) return false;
      if (activeOnly && !row.is_active) return false;
      if (missingEmailOnly && row.contact_email) return false;
      if (!q) return true;
      return [row.fund_name, row.country, row.geography, row.sector, row.key_partner, row.notes, row.contact_email]
        .some((f) => f && String(f).toLowerCase().includes(q));
    });
  }, [items, search, region, activeOnly, missingEmailOnly]);

  const activeCount = items.filter((r) => r.is_active).length;
  const emailCount = items.filter((r) => r.contact_email).length;
  const regionCount = new Set(items.map((r) => r.region).filter(Boolean)).size;

  const boxes = [
    {
      key: 'total',
      icon: Building2,
      color: '#3ecf8e',
      value: items.length,
      label: t('investors.total'),
      desc: t('investors.totalDesc'),
      onClick: () => { setActiveOnly(false); setRegion('all'); setSearch(''); },
    },
    {
      key: 'active',
      icon: CheckCircle2,
      color: '#0ea5e9',
      value: activeCount,
      label: t('investors.active'),
      desc: t('investors.activeDesc'),
      onClick: () => { setActiveOnly(true); setRegion('all'); },
    },
    {
      // The client's stated plan is to email every fund in here (10 Sep). The
      // research file carries websites and LinkedIn profiles but not one email
      // address, so this box is the honest measure of how far that plan is
      // from possible — and it drops to the rows still missing one.
      key: 'withEmail',
      icon: Mail,
      color: '#8b5cf6',
      value: emailCount,
      label: t('investors.withEmail'),
      desc: t('investors.withEmailDesc'),
      onClick: () => { setMissingEmailOnly(true); setRegion('all'); setSearch(''); },
    },
    {
      key: 'regions',
      icon: Globe2,
      color: '#f59e0b',
      value: regionCount,
      label: t('investors.regions'),
      desc: t('investors.regionsDesc'),
      // No single region to select, so this box hands the user the control that
      // does choose one rather than pretending to be a filter of its own.
      onClick: () => regionRef.current?.focus(),
    },
  ];

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormData({
      fund_name: row.fund_name || '',
      region: row.region || '',
      country: row.country || '',
      geography: row.geography || '',
      stage: row.stage || '',
      sector: row.sector || '',
      leads: row.leads || '',
      check_range: row.check_range || '',
      recent_activity: row.recent_activity || '',
      website: row.website || '',
      fund_linkedin: row.fund_linkedin || '',
      key_partner: row.key_partner || '',
      partner_linkedin: row.partner_linkedin || '',
      notes: row.notes || '',
      contact_email: row.contact_email || '',
      source: row.source || '',
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
    setSaving(true);
    setError('');
    try {
      // Blank optional text is stored as NULL, so an emptied field reads as
      // "unknown" everywhere instead of as a fund with an empty-string website.
      // Written to tolerate a non-string: the form seeds every field with
      // `|| ''` today, so nothing null reaches here, but a field added later
      // without that guard would otherwise throw on `.trim()` at save time —
      // in front of the admin, after they had filled the form in.
      const clean = (v) => {
        const s = v == null ? '' : String(v).trim();
        return s === '' ? null : s;
      };
      const { error: upErr } = await supabase
        .from('investors')
        .update({
          fund_name: formData.fund_name.trim(),
          region: clean(formData.region),
          country: clean(formData.country),
          geography: clean(formData.geography),
          stage: clean(formData.stage),
          sector: clean(formData.sector),
          leads: clean(formData.leads),
          check_range: clean(formData.check_range),
          recent_activity: clean(formData.recent_activity),
          website: clean(formData.website),
          fund_linkedin: clean(formData.fund_linkedin),
          key_partner: clean(formData.key_partner),
          partner_linkedin: clean(formData.partner_linkedin),
          notes: clean(formData.notes),
          contact_email: clean(formData.contact_email),
          source: clean(formData.source),
          is_active: !!formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);
      if (upErr) throw upErr;
      await fetchData();
      setNotice(t('investors.saved'));
      closeModal();
    } catch (err) {
      console.error('Save investor error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(t('investors.confirmDelete', { fund: row.fund_name }))) return;
    try {
      const { error: delErr } = await supabase.from('investors').delete().eq('id', row.id);
      if (delErr) throw delErr;
      setItems((prev) => prev.filter((r) => r.id !== row.id));
      setNotice(t('investors.deleted'));
    } catch (err) {
      setError(err.message);
    }
  };

  // Deliberately short: sector, notes and recent activity are paragraphs and
  // would collapse the useful columns. They are carried in the detail popup.
  const columns = [
    { key: 'fund_name', label: t('investors.fund'), render: (v) => <strong>{v}</strong> },
    { key: 'country', label: t('investors.country'), render: (v) => <Plain value={v} /> },
    { key: 'region', label: t('investors.region'), render: (v) => <Plain value={v} /> },
    { key: 'stage', label: t('investors.stage'), render: (v) => <Plain value={v} /> },
    { key: 'check_range', label: t('investors.checkRange'), render: (v) => <Plain value={v} /> },
    { key: 'key_partner', label: t('investors.keyPartner'), render: (v) => <Plain value={v} /> },
    {
      key: 'contact_email',
      label: t('investors.contactEmail'),
      render: (v) => (v ? <a href={`mailto:${v}`}>{v}</a> : <Plain value={v} />),
    },
    {
      key: 'actions',
      label: t('common.edit'),
      render: (_, row) => (
        <RowActions
          isActive={!!row.is_active}
          showView
          showToggle={false}
          onView={() => { setViewingRow(row); setShowView(true); }}
          onEdit={() => openEdit(row)}
          onDelete={() => handleDelete(row)}
        />
      ),
    },
  ];

  // The fields the table cannot carry. DetailModal appends these after the
  // shared columns, so View shows the whole record without a second table.
  const detailExtras = viewingRow ? [
    { label: t('investors.country'), value: viewingRow.country },
    { label: t('investors.geography'), value: viewingRow.geography },
    { label: t('investors.leads'), value: viewingRow.leads },
    { label: t('investors.sector'), value: viewingRow.sector },
    { label: t('investors.recentActivity'), value: viewingRow.recent_activity },
    { label: t('investors.website'), value: <ExternalLink value={viewingRow.website} /> },
    { label: t('investors.fundLinkedin'), value: <ExternalLink value={viewingRow.fund_linkedin} /> },
    { label: t('investors.partnerLinkedin'), value: <ExternalLink value={viewingRow.partner_linkedin} /> },
    { label: t('investors.notes'), value: viewingRow.notes },
    {
      label: t('investors.contactEmail'),
      value: viewingRow.contact_email
        ? <a href={`mailto:${viewingRow.contact_email}`}>{viewingRow.contact_email}</a>
        : <Plain value={null} />,
    },
    {
      label: t('investors.status'),
      value: viewingRow.is_active ? t('common.active') : t('common.inactive'),
    },
  ] : [];

  if (!user || loading) {
    return <div className="page-container"><p>{t('investors.loading')}</p></div>;
  }

  if (!isSuperAdmin) {
    return <div className="page-container"><p>{t('common.noAccess')}</p></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('investors.title')}</h1>
          <p className="page-subtitle">{t('investors.subtitle')}</p>
        </div>
      </div>

      <DashboardBoxes boxes={boxes} loading={fetching} />

      {(error || notice) && (
        <div style={{
          padding: '10px 12px',
          borderRadius: 6,
          fontSize: '0.85rem',
          marginBlock: 'var(--spacing-md)',
          background: error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.10)',
          border: `1px solid ${error ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          color: error ? '#ef4444' : '#047857',
        }}>
          {error || notice}
        </div>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
        marginBlockEnd: 'var(--spacing-lg)',
      }}>
        <div style={{ flex: '2 1 260px' }}>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('investors.searchPlaceholder')}
            aria-label={t('investors.searchPlaceholder')}
          />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <Select
            ref={regionRef}
            value={region}
            onChange={(e) => { setRegion(e.target.value); setActiveOnly(false); }}
            aria-label={t('investors.region')}
          >
            <option value="all">{t('investors.allRegions')}</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
      </div>

      {fetching ? (
        <p>{t('investors.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('investors.empty')}
        />
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={t('investors.editTitle')} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label={t('investors.fund')}
            value={formData.fund_name}
            onChange={(e) => setFormData({ ...formData, fund_name: e.target.value })}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Select
              label={t('investors.region')}
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Input
              label={t('investors.country')}
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
            <Input
              label={t('investors.geography')}
              value={formData.geography}
              onChange={(e) => setFormData({ ...formData, geography: e.target.value })}
            />
            <Input
              label={t('investors.stage')}
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
            />
            <Input
              label={t('investors.checkRange')}
              value={formData.check_range}
              onChange={(e) => setFormData({ ...formData, check_range: e.target.value })}
            />
            <Input
              label={t('investors.leads')}
              value={formData.leads}
              onChange={(e) => setFormData({ ...formData, leads: e.target.value })}
            />
            <Input
              label={t('investors.keyPartner')}
              value={formData.key_partner}
              onChange={(e) => setFormData({ ...formData, key_partner: e.target.value })}
            />
            {/* The one field the research file could not supply. It leads the
                contact block because filling it in is the prerequisite for the
                outreach the client wants to run. */}
            <Input
              label={t('investors.contactEmail')}
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            />
            <Input
              label={t('investors.website')}
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
            <Input
              label={t('investors.fundLinkedin')}
              value={formData.fund_linkedin}
              onChange={(e) => setFormData({ ...formData, fund_linkedin: e.target.value })}
            />
            <Input
              label={t('investors.partnerLinkedin')}
              value={formData.partner_linkedin}
              onChange={(e) => setFormData({ ...formData, partner_linkedin: e.target.value })}
            />
          </div>
          <Textarea
            label={t('investors.sector')}
            rows={3}
            value={formData.sector}
            onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
          />
          <Textarea
            label={t('investors.recentActivity')}
            rows={2}
            value={formData.recent_activity}
            onChange={(e) => setFormData({ ...formData, recent_activity: e.target.value })}
          />
          <Textarea
            label={t('investors.notes')}
            rows={4}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <span>{t('investors.status')}</span>
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBlockStart: 8 }}>
            <Button type="button" variant="ghost" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={saving}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingRow?.fund_name || t('common.view')}
        columns={columns}
        row={viewingRow}
        extraFields={detailExtras}
      />
    </div>
  );
}
