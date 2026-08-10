import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { Input, Select, Textarea, Button } from '../../components/ui/FormElements';
import { ROLES } from '../../utils/roles';
import { getIsoBySlug } from '../../utils/isoCatalog';
import { PACKAGE_LABEL } from '../../utils/pricing';
import './ApplicationForm.css';

const INDUSTRIES = [
  { value: 'Manufacturing', key: 'manufacturing' },
  { value: 'IT & Software', key: 'itSoftware' },
  { value: 'Construction', key: 'construction' },
  { value: 'Healthcare', key: 'healthcare' },
  { value: 'Food & Beverage', key: 'foodBeverage' },
  { value: 'Logistics', key: 'logistics' },
];

/** Parse employee range string (e.g. "51-200") into a representative number */
function parseEmployeeRange(range) {
  if (!range) return '';
  if (range.includes('+')) return range.replace('+', '');
  const parts = range.split('-');
  if (parts.length === 2) {
    return String(Math.round((parseInt(parts[0], 10) + parseInt(parts[1], 10)) / 2));
  }
  return range;
}

export default function ApplicationForm() {
  const { user, getRoleDashboard } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { applicationId } = useParams();

  // UPDATE-mode = post-payment registration. The stub row was created by
  // /client/start-payment before Stripe checkout; here we enrich it with
  // company details and flip status from 'awaiting_registration' to 'pending'.
  const isUpdateMode = Boolean(applicationId);
  const paymentJustSucceeded = searchParams.get('payment') === 'success';

  // A client can buy several certifications in one payment (dashboard picker,
  // 9 Aug). Each is its own application row; the extra ids ride in ?also= and
  // this one form completes all of them — the company details are the same for
  // every standard the same organization is certifying against.
  const alsoIds = (searchParams.get('also') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const paidApplicationIds = applicationId ? [applicationId, ...alsoIds] : [];

  // ISO can arrive from either router state (in-app navigation), a query param
  // (legacy OAuth round-trip), or the stub row when in UPDATE mode. There is a
  // single "Standard" package now, so the package label is fixed.
  const queryIso = searchParams.get('iso');
  const stateSelectedPackage = location.state?.package || PACKAGE_LABEL;
  const stateRecommendedIso = location.state?.recommendedIso
    || (queryIso ? getIsoBySlug(queryIso)?.code : null)
    || null;

  const isClient = user?.role === ROLES.CLIENT;
  const isAdmin = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.REGIONAL_ADMIN;

  const meta = user?.user_metadata || {};
  const prefilledEmployees = isClient ? parseEmployeeRange(meta.number_of_employees) : '';
  const prefilledLocations = isClient && meta.number_of_locations ? String(meta.number_of_locations) : '';
  const hasPrefilledEmployees = Boolean(prefilledEmployees);
  const hasPrefilledLocations = Boolean(prefilledLocations);

  const [formData, setFormData] = useState({
    companyName: '',
    industry: '',
    scope: '',
    employeeCount: prefilledEmployees || '',
    locationsCount: prefilledLocations || '',
    clientId: '',
  });

  // Stub row fetched in UPDATE mode (carries selected_package + recommended_iso).
  const [stubApp, setStubApp] = useState(null);
  const [paidStandards, setPaidStandards] = useState([]);
  const [loadingStub, setLoadingStub] = useState(isUpdateMode);

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedPackage = stubApp?.selected_package || stateSelectedPackage;
  const recommendedIso = stubApp?.recommended_iso || stateRecommendedIso;

  // Fetch the stub application in UPDATE mode.
  useEffect(() => {
    if (!isUpdateMode || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: rows, error: fetchError } = await supabase
        .from('applications')
        .select('id, client_id, selected_package, recommended_iso, status, company_name, industry, scope, employee_count, locations_count')
        .in('id', paidApplicationIds);
      if (cancelled) return;
      const data = (rows || []).find(r => r.id === applicationId) || null;
      // Show every standard that was paid for, in the order they were bought.
      setPaidStandards(
        paidApplicationIds
          .map(id => (rows || []).find(r => r.id === id)?.recommended_iso)
          .filter(Boolean)
      );
      if (fetchError || !data) {
        setError(t('application.appNotFound') || 'Application not found.');
        setLoadingStub(false);
        return;
      }
      if (data.client_id !== user.id && !isAdmin) {
        setError(t('common.accessDenied') || 'Access denied.');
        setLoadingStub(false);
        return;
      }
      setStubApp(data);
      setFormData(prev => ({
        ...prev,
        companyName: data.company_name || prev.companyName,
        industry: data.industry || prev.industry,
        scope: data.scope || prev.scope,
        employeeCount: data.employee_count != null ? String(data.employee_count) : prev.employeeCount,
        locationsCount: data.locations_count != null ? String(data.locations_count) : prev.locationsCount,
      }));
      setLoadingStub(false);
    })();
    return () => { cancelled = true; };
  }, [isUpdateMode, applicationId, user?.id, isAdmin, t]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoadingClients(true);
      let query = supabase
        .from('profiles')
        .select('id, name, email, company_name, region')
        .eq('role', 'client')
        .order('company_name', { ascending: true });
      if (user?.role === ROLES.REGIONAL_ADMIN && user?.region) {
        query = query.eq('region', user.region);
      }
      const { data } = await query;
      if (!cancelled && data) setClients(data);
      setLoadingClients(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, user?.role, user?.region]);
  
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let clientIdForRow;
    let companyNameForRow;

    if (isAdmin) {
      if (!formData.clientId) {
        setError(t('application.selectClientRequired'));
        setLoading(false);
        return;
      }
      const selectedClient = clients.find(c => c.id === formData.clientId);
      clientIdForRow = formData.clientId;
      companyNameForRow = selectedClient?.company_name || formData.companyName;
    } else {
      clientIdForRow = user.id;
      companyNameForRow = user?.company_name || formData.companyName;
    }

    if (!companyNameForRow || !formData.industry || !formData.scope || !formData.employeeCount || !formData.locationsCount) {
      setError(t('application.fillAllFields'));
      setLoading(false);
      return;
    }

    try {
      if (isUpdateMode) {
        // Post-payment registration: enrich the stub row and flip status.
        const updatePayload = {
          company_name: companyNameForRow,
          industry: formData.industry,
          scope: formData.scope,
          employee_count: parseInt(formData.employeeCount, 10),
          locations_count: parseInt(formData.locationsCount, 10),
          status: 'pending',
        };
        // Online checkout returns with ?payment=success — mark it paid so the
        // CB-visibility gate opens. Offline orders arrive with ?payment=pending
        // and keep payment_status='awaiting_verification' until an admin
        // verifies the transfer, so we must NOT touch it here.
        if (paymentJustSucceeded) {
          updatePayload.payment_status = 'paid';
        }
        // Every application paid for in the same transaction gets the same
        // company details and the same status. Row-level security still scopes
        // this to the buyer's own rows, so an id added to ?also= by hand
        // updates nothing.
        const { error: updateError } = await supabase
          .from('applications')
          .update(updatePayload)
          .in('id', paidApplicationIds);
        if (updateError) throw updateError;

        // Fire the lifecycle emails once the paid application is registered.
        // Best-effort + fire-and-forget: a mail hiccup must never block the
        // customer's redirect to their dashboard.
        if (paymentJustSucceeded) {
          paidApplicationIds.forEach((id) => {
            apiPost('/api/notify-event', { applicationId: id, event: 'payment_confirmed' }).catch(() => {});
            apiPost('/api/notify-event', { applicationId: id, event: 'application_received' }).catch(() => {});
          });
        }
      } else {
        const insertPayload = {
          client_id: clientIdForRow,
          company_name: companyNameForRow,
          industry: formData.industry,
          scope: formData.scope,
          employee_count: parseInt(formData.employeeCount, 10),
          locations_count: parseInt(formData.locationsCount, 10),
          status: 'pending',
          selected_package: selectedPackage || PACKAGE_LABEL,
        };
        if (recommendedIso) {
          insertPayload.recommended_iso = recommendedIso;
        }
        const { error: submitError } = await supabase
          .from('applications')
          .insert(insertPayload);

        if (submitError) throw submitError;
      }

      if (isAdmin) {
        navigate('/admin/applications');
        return;
      }

      if (!user?.company_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ company_name: formData.companyName })
          .eq('id', user.id);

        if (profileError) {
          console.error('Failed to update profile company name:', profileError);
        }

        // Force reload to update context and navigate
        window.location.href = getRoleDashboard(user?.role);
        return;
      }

      navigate(getRoleDashboard(user?.role));
    } catch (err) {
      console.error('Application submission error:', err);
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingStub) {
    return (
      <div className="page-container">
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('application.title')}</h1>
          <p className="page-subtitle">{t('application.subtitle')}</p>
        </div>
      </div>

      <div className="application-form__container">
        <form className="application-form" onSubmit={handleSubmit}>
          {paymentJustSucceeded && (
            <div className="alert alert-success" style={{
              marginBottom: '20px',
              padding: '14px 16px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}>
              <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{t('payment.registrationBannerTitle')}</strong>
                <div style={{ fontSize: '0.9rem', marginTop: 2, opacity: 0.9 }}>
                  {t('payment.registrationBannerDesc')}
                </div>
              </div>
            </div>
          )}
          {(selectedPackage || recommendedIso) && (
            <div className="alert alert-info" style={{
              marginBottom: '20px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--color-accent)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <CheckCircle2 size={18}/>
              <span>
                {t('application.applyingFor', { package: selectedPackage || 'Bronze' })}
                {/* A multi-standard purchase names every certification, not
                    just the row this URL happens to point at. */}
                {paidStandards.length > 1
                  ? ` — ${paidStandards.join(' · ')}`
                  : (recommendedIso ? ` — ${recommendedIso}` : '')}
              </span>
            </div>
          )}
          {error && <div className="application-form__error">{error}</div>}

          {isAdmin && (
            <Select
              id="clientId"
              label={t('application.selectClient')}
              value={formData.clientId}
              onChange={handleChange}
              required
              disabled={loading || loadingClients}
            >
              <option value="" disabled>
                {loadingClients ? t('common.loading') : t('application.selectClientPlaceholder')}
              </option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name || c.email}
                  {c.email ? ` — ${c.email}` : ''}
                </option>
              ))}
            </Select>
          )}

          <div className="application-form__row">
            {!isAdmin && !user?.company_name && (
              <Input
                id="companyName"
                label={t('application.companyName')}
                placeholder={t('application.companyNamePlaceholder')}
                value={formData.companyName}
                onChange={handleChange}
                required
                disabled={loading}
              />
            )}

            <div style={(isAdmin || user?.company_name) ? { gridColumn: '1 / -1' } : {}}>
              <Select
                id="industry"
                label={t('application.industry')}
                value={formData.industry}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="" disabled>{t('application.selectIndustry')}</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind.value} value={ind.value}>
                    {t(`application.industries.${ind.key}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Textarea
            id="scope"
            label={t('application.scopeOfOps')}
            placeholder={t('application.scopePlaceholder')}
            rows={4}
            value={formData.scope}
            onChange={handleChange}
            required
            disabled={loading}
          />

          {(!hasPrefilledEmployees || !hasPrefilledLocations) && (
            <div className="application-form__row">
              {!hasPrefilledEmployees && (
                <Input
                  id="employeeCount"
                  label={t('application.employeeCount')}
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={formData.employeeCount}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              )}

              {!hasPrefilledLocations && (
                <Input
                  id="locationsCount"
                  label={t('application.locationsCount')}
                  type="number"
                  min="1"
                  placeholder="e.g. 2"
                  value={formData.locationsCount}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              )}
            </div>
          )}

          <div className="application-form__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(getRoleDashboard(user?.role))}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading} variant="primary">
              {t('application.submitApplication')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
