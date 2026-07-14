import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input, Select, Button } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { ROLES } from '../../utils/roles';
import { ISO_CATALOG_LIST } from '../../utils/isoCatalog';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';

const NEW_CLIENT = '__new__';

// Single-package model (the old Bronze/Silver/Gold tiers were removed).
const PACKAGES = ['Standard'];

const STATUS_OPTIONS = [
  'pending', 'awaiting_payment', 'in_review',
  'audit_scheduled', 'audited', 'approved', 'rejected',
];

export default function AdminApplications() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  // Super admins search by country; regional admins are hard-scoped to their
  // region below (region is still the RBAC key, derived from country).
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  // --- Add Application (Super Admin) ---
  const [showCreate, setShowCreate] = useState(false);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const blankForm = {
    clientId: '',
    new_full_name: '', new_email: '', new_password: '', new_country: '',
    company_name: '', industry: '', scope: '',
    recommended_iso: '', selected_package: 'Standard',
    employee_count: '', locations_count: '',
    status: 'in_review',
  };
  const [form, setForm] = useState(blankForm);

  const fetchApplications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('*, auditor:profiles!assigned_auditor_id(full_name), client:profiles!client_id(region, country)')
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch CB names from certification_bodies registry
      const cbIds = [...new Set(data.map(a => a.assigned_cb_id).filter(Boolean))];
      let cbMap = {};
      if (cbIds.length > 0) {
        const { data: cbRegistry } = await supabase
          .from('certification_bodies')
          .select('id, name, acronym')
          .in('id', cbIds);
        if (cbRegistry) cbMap = Object.fromEntries(cbRegistry.map(cb => [cb.id, cb.acronym ? `${cb.name} (${cb.acronym})` : cb.name]));
      }
      setApplications(data.map(app => ({
        ...app,
        auditor_name: app.auditor?.full_name || 'Unassigned',
        cb_name: cbMap[app.assigned_cb_id] || 'Unassigned',
        region: app.client?.region || null,
        country: app.client?.country || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Load the client list for the "Add Application" picker (super admin only).
  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, company_name, region')
        .eq('role', ROLES.CLIENT)
        .order('created_at', { ascending: false });
      if (data) setClients(data);
    })();
  }, [isSuperAdmin]);

  let filtered = applications;
  // Regional admins stay locked to their own region (RBAC), regardless of the
  // country search box which only super admins see. Fail-closed: no resolved
  // region means no applications, never the full unscoped list.
  if (isRegionalAdmin) filtered = user?.region ? filtered.filter(a => a.region === user.region) : [];
  if (countryFilter.trim()) filtered = filtered.filter(a => (a.country || '').toLowerCase().includes(countryFilter.trim().toLowerCase()));
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);

  const openCreate = () => {
    setForm(blankForm);
    setError('');
    setShowCreate(true);
  };

  const onClientChange = (value) => {
    const picked = clients.find(c => c.id === value);
    setForm(p => ({
      ...p,
      clientId: value,
      // Prefill company name from the chosen client (only when still blank).
      company_name: value === NEW_CLIENT
        ? p.company_name
        : (p.company_name || picked?.company_name || ''),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!form.clientId) { setError(t('application.selectClientRequired')); return; }
    if (form.clientId === NEW_CLIENT) {
      if (!form.new_full_name || !form.new_email || !form.new_password) {
        setError(t('admin.fillRequired')); return;
      }
      if (form.new_password.length < 6) {
        setError(t('admin.passwordMinLength')); return;
      }
    }
    if (!form.company_name || !form.industry || !form.scope) {
      setError(t('admin.fillRequired')); return;
    }

    setSaving(true);
    try {
      // 1. Resolve the client id — create the client first if needed.
      let clientId = form.clientId;
      if (clientId === NEW_CLIENT) {
        const res = await apiPost('/api/create-user', {
          role: 'client',
          full_name: form.new_full_name,
          email: form.new_email,
          password: form.new_password,
          country: form.new_country || null,
          company_name: form.company_name || null,
        });
        clientId = res?.user?.id;
        if (!clientId) throw new Error('Client creation failed');
      }

      // 2. Insert the application on the client's behalf.
      const payload = {
        client_id: clientId,
        company_name: form.company_name,
        industry: form.industry,
        scope: form.scope,
        status: form.status,
        selected_package: form.selected_package,
      };
      if (form.recommended_iso) payload.recommended_iso = form.recommended_iso;
      if (form.employee_count) payload.employee_count = parseInt(form.employee_count, 10);
      if (form.locations_count) payload.locations_count = parseInt(form.locations_count, 10);

      const { data: created, error: insertError } = await supabase
        .from('applications')
        .insert(payload)
        .select('id')
        .single();
      if (insertError) throw insertError;

      setShowCreate(false);
      setSuccess(t('admin.applicationCreated'));
      // Drop the admin straight into the detail view so they can process it fast.
      navigate(`/admin/applications/${created.id}`);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const columns = [
    { key: 'company_name', label: t('dashboard.company') },
    { key: 'recommended_iso', label: t('dashboard.certificate') },
    { key: 'auditor_name', label: t('dashboard.assignedAuditor') },
    { key: 'cb_name', label: t('dashboard.assignedCB') },
    { key: 'country', label: t('admin.country'), render: (val) => val || '—' },
    { key: 'status', label: t('dashboard.status'), render: (val) => <StatusBadge status={val} /> },
    { key: 'action', label: t('dashboard.action'), render: (_, row) => (
      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/applications/${row.id}`)}>{t('common.manage')}</Button>
    )},
  ];

  const statusLabel = (s) => ({
    pending: t('admin.pending'),
    awaiting_payment: t('admin.awaitingPayment'),
    in_review: t('admin.inReview'),
    audit_scheduled: t('admin.auditScheduled'),
    audited: t('admin.audited'),
    approved: t('admin.approved'),
    rejected: t('admin.rejected'),
  })[s] || s;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.allApplications')}</h1>
          <p className="page-subtitle">{t('admin.applicationsFound', { count: filtered.length })}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Select
            id="filter-status"
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">{t('admin.allStatuses')}</option>
            <option value="pending">{t('admin.pending')}</option>
            <option value="awaiting_payment">{t('admin.awaitingPayment')}</option>
            <option value="in_review">{t('admin.inReview')}</option>
            <option value="audit_scheduled">{t('admin.auditScheduled')}</option>
            <option value="audited">{t('admin.audited')}</option>
            <option value="approved">{t('admin.approved')}</option>
            <option value="rejected">{t('admin.rejected')}</option>
          </Select>
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
          {isSuperAdmin && (
            <Button variant="primary" size="md" onClick={openCreate}>
              <Plus size={18} /> {t('admin.addApplication')}
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
      {error && !showCreate && (
        <div className="auth-form__error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p>{t('admin.loadingApps')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('admin.noAppsFound')}
        />
      )}

      {/* Add Application Modal — Super Admin creates on behalf of a client */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t('admin.addApplication')}>
        <form onSubmit={handleCreate} className="admin-users__form">
          {error && (
            <div className="auth-form__error"><AlertCircle size={16} /><span>{error}</span></div>
          )}

          <Select
            label={t('application.selectClient')}
            id="app-client"
            name="clientId"
            value={form.clientId}
            onChange={(e) => onClientChange(e.target.value)}
            required
          >
            <option value="">{t('application.selectClientPlaceholder')}</option>
            <option value={NEW_CLIENT}>+ {t('admin.createNewClient')}</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {(c.company_name || c.full_name || c.email)}{c.email ? ` — ${c.email}` : ''}
              </option>
            ))}
          </Select>

          {form.clientId === NEW_CLIENT && (
            <>
              <Input label={`${t('admin.fullName')}`} id="app-new-name" name="new_full_name"
                value={form.new_full_name}
                onChange={(e) => setForm(p => ({ ...p, new_full_name: e.target.value }))} required />
              <Input label={t('auth.email')} type="email" id="app-new-email" name="new_email"
                value={form.new_email}
                onChange={(e) => setForm(p => ({ ...p, new_email: e.target.value }))} required />
              <Input label={t('auth.password')} type="password" id="app-new-password" name="new_password"
                placeholder={t('admin.passwordMinLength')} value={form.new_password}
                onChange={(e) => setForm(p => ({ ...p, new_password: e.target.value }))} required />
              <Input label={t('admin.country')} id="app-new-country" name="new_country"
                placeholder={t('admin.countryPlaceholder')} value={form.new_country}
                onChange={(e) => setForm(p => ({ ...p, new_country: e.target.value }))} />
            </>
          )}

          <Input label={t('application.companyName')} id="app-company" name="company_name"
            value={form.company_name}
            onChange={(e) => setForm(p => ({ ...p, company_name: e.target.value }))} required />
          <Input label={t('application.industry')} id="app-industry" name="industry"
            value={form.industry}
            onChange={(e) => setForm(p => ({ ...p, industry: e.target.value }))} required />
          <Input label={t('application.scopeOfOps')} id="app-scope" name="scope"
            value={form.scope}
            onChange={(e) => setForm(p => ({ ...p, scope: e.target.value }))} required />

          <Select label={t('dashboard.certificate')} id="app-iso" name="recommended_iso"
            value={form.recommended_iso}
            onChange={(e) => setForm(p => ({ ...p, recommended_iso: e.target.value }))}>
            <option value="">{t('admin.selectStandard')}</option>
            {ISO_CATALOG_LIST.map(iso => (
              <option key={iso.slug} value={iso.code}>{iso.code}</option>
            ))}
          </Select>

          <Select label={t('admin.package')} id="app-package" name="selected_package"
            value={form.selected_package}
            onChange={(e) => setForm(p => ({ ...p, selected_package: e.target.value }))}>
            {PACKAGES.map(pkg => <option key={pkg} value={pkg}>{pkg}</option>)}
          </Select>

          <Input label={t('application.employeeCount')} type="number" id="app-employees" name="employee_count"
            value={form.employee_count}
            onChange={(e) => setForm(p => ({ ...p, employee_count: e.target.value }))} />
          <Input label={t('application.locationsCount')} type="number" id="app-locations" name="locations_count"
            value={form.locations_count}
            onChange={(e) => setForm(p => ({ ...p, locations_count: e.target.value }))} />

          <Select label={t('dashboard.status')} id="app-status" name="status"
            value={form.status}
            onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>

          <div className="admin-users__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>{t('admin.addApplication')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
