import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import StatusBadge from '../../components/ui/StatusBadge';
import { Button, Select } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import CustomFieldRenderer, { validateCustomFields } from '../../components/CustomFieldRenderer';
import { ArrowLeft, CheckCircle, FileText, Download, Building, Users, Target, Activity, Globe, ClipboardCheck, XCircle, CheckCircle2, AlertCircle, Award, ShieldCheck, Upload, Trash2, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES, REGIONS } from '../../utils/roles';
import './ApplicationDetails.css';

const ISO_REQUIRED_DOCUMENTS = {
  'ISO 9001:2015 (Quality Management)': [
    'Quality Management System Manual',
    'Quality Policy Statement',
    'Documented Procedures (Control of Documents, Internal Audit, Corrective Actions)',
    'Process Flow Charts',
    'Internal Audit Reports',
    'Management Review Meeting Minutes',
  ],
  'ISO/IEC 27001:2022 (Information Security)': [
    'Information Security Policy',
    'Risk Assessment Report',
    'Statement of Applicability (SoA)',
    'Information Security Procedures Manual',
    'Asset Inventory',
    'Business Continuity Plan',
  ],
  'ISO 14001:2015 (Environmental Management)': [
    'Environmental Policy',
    'Environmental Aspects & Impacts Register',
    'Legal Compliance Register',
    'Environmental Management Program',
    'Waste Management Procedures',
    'Emergency Preparedness Plan',
  ],
  'ISO 45001:2018 (Occupational Health & Safety)': [
    'OH&S Policy',
    'Hazard Identification & Risk Assessment',
    'Legal Compliance Register',
    'Emergency Response Procedures',
    'Incident Investigation Reports',
    'Worker Consultation Records',
  ],
  'ISO 22000:2018 (Food Safety)': [
    'Food Safety Policy',
    'HACCP Plan',
    'Prerequisite Programs (PRPs)',
    'Flow Diagrams of Food Processes',
    'Hazard Analysis Records',
    'Traceability Procedures',
  ],
  'ISO 13485:2016 (Medical Devices)': [
    'Quality Manual for Medical Devices',
    'Design & Development Files',
    'Risk Management File (ISO 14971)',
    'Regulatory Requirements Register',
    'Complaint Handling Procedures',
    'Post-Market Surveillance Records',
  ],
};

function getRequiredDocs(isoName) {
  if (!isoName) return [];
  for (const [key, docs] of Object.entries(ISO_REQUIRED_DOCUMENTS)) {
    if (isoName.includes(key.split(' (')[0])) return docs;
  }
  return ISO_REQUIRED_DOCUMENTS[isoName] || [];
}

export default function ApplicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const canAssign = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.REGIONAL_ADMIN;
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const isAuditor = user?.role === ROLES.AUDITOR;
  const isCB = user?.role === ROLES.CERTIFICATION_BODY;
  const canUploadDocs = canAssign;

  const [application, setApplication] = useState(null);
  const [auditors, setAuditors] = useState([]);
  const [cbs, setCbs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [auditReport, setAuditReport] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Admin form states
  const [status, setStatus] = useState('');
  const [assignedAuditor, setAssignedAuditor] = useState('');
  const [assignedCb, setAssignedCb] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Auditor form states
  const [auditDecision, setAuditDecision] = useState('');
  const [auditComment, setAuditComment] = useState('');
  const [submittingAudit, setSubmittingAudit] = useState(false);
  const [reviewComments, setReviewComments] = useState({});

  // CB form states
  const [cbComment, setCbComment] = useState('');
  const [submittingCbDecision, setSubmittingCbDecision] = useState(false);
  const [decisionModal, setDecisionModal] = useState(null); // 'approved' | 'rejected' | null
  const [decisionFields, setDecisionFields] = useState([]);
  const [decisionValues, setDecisionValues] = useState({});
  const [decisionError, setDecisionError] = useState('');

  // Admin upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('*, client:profiles!client_id(full_name, email, region, company_name)')
          .eq('id', id)
          .single();

        if (appError) throw appError;

        const regionFilter = isRegionalAdmin ? user.region : null;

        let audQuery = supabase.from('profiles').select('id, full_name, region').eq('role', ROLES.AUDITOR);
        if (regionFilter) audQuery = audQuery.eq('region', regionFilter);
        const { data: audData } = await audQuery;

        // CB dropdown is populated from the registry (certification_bodies table),
        // NOT from user profiles. Regional admins see all registry entries since
        // the registry is global, not region-scoped.
        const { data: cbData } = await supabase
          .from('certification_bodies')
          .select('id, name, acronym, country, status')
          .eq('status', 'active')
          .order('name');

        const { data: docData } = await supabase
          .from('documents')
          .select('*')
          .eq('application_id', id)
          .order('uploaded_at', { ascending: false });

        // Fetch audit report for this application
        const { data: reportData } = await supabase
          .from('reports')
          .select('*, auditor:profiles!auditor_id(full_name)')
          .eq('application_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (appData) {
          // Fetch client's auth metadata for phone and contact role
          try {
            const metaRes = await fetch(`/api/user?action=get-meta&userId=${appData.client_id}`);
            if (metaRes.ok) {
              const metaData = await metaRes.json();
              appData.client_metadata = metaData.user_metadata || {};
            }
          } catch {} // non-critical, proceed without metadata

          setApplication(appData);
          setStatus(appData.status || 'pending');
          setAssignedAuditor(appData.assigned_auditor_id || '');
          setAssignedCb(appData.assigned_cb_id || '');
          setInternalNotes(appData.internal_notes || '');
        }

        if (audData) setAuditors(audData);
        if (cbData) setCbs(cbData);
        if (reportData) setAuditReport(reportData);
        if (docData) {
          setDocuments(docData);
          const comments = {};
          docData.forEach(d => { comments[d.id] = d.reviewer_comment || ''; });
          setReviewComments(comments);
        }

      } catch (err) {
        console.error('Error fetching application details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, user, isRegionalAdmin]);

  // --- Admin Save ---
  const handleSave = async () => {
    setSaving(true);
    const prevStatus = application?.status;
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status, assigned_auditor_id: assignedAuditor || null, assigned_cb_id: assignedCb || null, internal_notes: internalNotes })
        .eq('id', id);
      if (error) throw error;
      setApplication(prev => ({ ...prev, status, assigned_auditor_id: assignedAuditor || null, assigned_cb_id: assignedCb || null, internal_notes: internalNotes }));
      // Notify the client when their audit gets scheduled (only on transition).
      if (status === 'audit_scheduled' && prevStatus !== 'audit_scheduled') {
        apiPost('/api/notify-event', { applicationId: id, event: 'audit_scheduled' }).catch(() => {});
      }
      showToast(t('admin.appUpdated'));
    } catch (err) {
      console.error('Error updating application', err);
      alert(t('admin.failedUpdateApp'));
    } finally { setSaving(false); }
  };

  // Manually confirm receipt of an offline payment (MoneyGram / bank transfer).
  // Only super/regional admins; flips payment_status from
  // 'awaiting_verification' to 'verified'.
  const handleVerifyPayment = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('applications')
        .update({ payment_status: 'verified' })
        .eq('id', id);
      if (error) throw error;
      setApplication(prev => ({ ...prev, payment_status: 'verified' }));
      showToast(t('admin.paymentVerified'));
    } catch (err) {
      console.error('Error verifying payment', err);
      alert(t('admin.failedUpdateApp'));
    } finally { setSaving(false); }
  };

  // --- Auditor: Review Document ---
  const handleDocumentReview = async (docId, newStatus) => {
    try {
      const { error } = await supabase.from('documents').update({ status: newStatus, reviewer_comment: reviewComments[docId] || null }).eq('id', docId);
      if (error) throw error;
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus, reviewer_comment: reviewComments[docId] || null } : d));
      showToast(t(`admin.doc${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`));
    } catch (err) {
      console.error('Error reviewing document:', err);
      alert(t('admin.failedDocUpdate'));
    }
  };

  // --- Auditor: Submit Audit ---
  const handleSubmitAudit = async () => {
    if (!auditDecision) { alert(t('admin.selectAuditDecision')); return; }
    setSubmittingAudit(true);
    try {
      const { error: reportError } = await supabase.from('reports').upsert({
        application_id: id, auditor_id: user.id, status: auditDecision, report_url: auditComment || null,
      }, { onConflict: 'application_id,auditor_id', ignoreDuplicates: false });

      if (reportError) {
        const { error: insertError } = await supabase.from('reports').insert({
          application_id: id, auditor_id: user.id, status: auditDecision, report_url: auditComment || null,
        });
        if (insertError) throw insertError;
      }

      const { error: appError } = await supabase.from('applications').update({ status: 'audited' }).eq('id', id);
      if (appError) throw appError;

      setApplication(prev => ({ ...prev, status: 'audited' }));
      setStatus('audited');
      // Let the client know their audit is done and final review has started.
      apiPost('/api/notify-event', { applicationId: id, event: 'audit_completed' }).catch(() => {});
      showToast(t('admin.auditSubmittedSuccess'));
    } catch (err) {
      console.error('Error submitting audit:', err);
      alert(t('admin.failedAuditSubmit') + ' ' + err.message);
    } finally { setSubmittingAudit(false); }
  };

  // --- CB: Open Decision Modal (fetches custom fields for this trigger) ---
  const openDecisionModal = async (decision) => {
    setDecisionError('');
    setDecisionValues({});
    setDecisionModal(decision);
    const { data } = await supabase
      .from('custom_application_fields')
      .select('*')
      .eq('is_active', true)
      .contains('trigger_on', [decision])
      .order('display_order', { ascending: true });
    setDecisionFields(data || []);
  };

  const closeDecisionModal = () => {
    setDecisionModal(null);
    setDecisionFields([]);
    setDecisionValues({});
    setDecisionError('');
  };

  // --- CB: Certification Decision ---
  const handleCbDecision = async () => {
    const decision = decisionModal;
    if (!decision) return;

    const { valid, errorField } = validateCustomFields(decisionFields, decisionValues);
    if (!valid) {
      setDecisionError(t('auth.validationCustomField', { field: errorField }));
      return;
    }

    setSubmittingCbDecision(true);
    try {
      const payload = {
        status: decision,
        ...(cbComment ? { internal_notes: `[CB Decision] ${cbComment}` } : {}),
        ...(decision === 'approved' ? { approval_data: decisionValues } : { rejection_data: decisionValues }),
      };
      const { error } = await supabase
        .from('applications')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      setApplication(prev => ({ ...prev, status: decision }));
      setStatus(decision);
      closeDecisionModal();
      showToast(decision === 'approved' ? t('admin.certApprovedSuccess') : t('admin.certRejectedSuccess'));

      // On approval, kick off certificate issuance. Failure here is
      // non-blocking — staff can re-trigger from the application page.
      if (decision === 'approved') {
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess?.session?.access_token;
          const resp = await fetch('/api/issue-certificate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ applicationId: id }),
          });
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            console.error('Certificate issuance failed:', body.error || resp.status);
          }
        } catch (issueErr) {
          console.error('Certificate issuance error (non-blocking):', issueErr);
        }
      }
    } catch (err) {
      console.error('Error submitting CB decision:', err);
      alert(t('admin.failedDecisionSubmit') + ' ' + err.message);
    } finally { setSubmittingCbDecision(false); }
  };

  const handleDownload = async (doc) => {
    try {
      // Derive storage path from convention: {application_id}/{document_id}
      const storagePath = `${id}/${doc.id}`;
      const { data, error } = await supabase.storage.from('application-documents').download(storagePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document', err);
      alert(t('admin.noFileContent'));
    }
  };

  const handleAdminUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const { data: docRow, error: insErr } = await supabase.from('documents').insert([{
        application_id: id,
        client_id: application?.client_id || null,
        file_name: file.name,
        file_size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        document_type: 'admin_upload',
        uploaded_by: user.id,
        uploader_role: user.role,
      }]).select().single();
      if (insErr) throw insErr;

      const storagePath = `${id}/${docRow.id}`;
      const { error: upErr } = await supabase.storage
        .from('application-documents')
        .upload(storagePath, file, { upsert: true });

      if (upErr) {
        await supabase.from('documents').delete().eq('id', docRow.id);
        throw upErr;
      }
      setDocuments(prev => [docRow, ...prev]);
      showToast(t('admin.docUploaded'));
    } catch (err) {
      console.error('Admin upload error:', err);
      setUploadError(err.message || t('admin.failedDocUpload'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAdminDeleteDoc = async (doc) => {
    if (!window.confirm(t('admin.confirmDeleteDoc', { name: doc.file_name }))) return;
    try {
      const storagePath = `${id}/${doc.id}`;
      await supabase.storage.from('application-documents').remove([storagePath]);
      const { error: delErr } = await supabase.from('documents').delete().eq('id', doc.id);
      if (delErr) throw delErr;
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      showToast(t('admin.docDeleted'));
    } catch (err) {
      console.error('Delete doc error:', err);
      alert(t('admin.failedDocDelete') + ': ' + err.message);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const getRegionLabel = (regionId) => {
    if (!regionId) return '—';
    const r = REGIONS.find(reg => reg.id === regionId);
    return r ? r.label : regionId;
  };

  const getDocStatusColor = (s) => {
    if (s === 'approved') return 'var(--color-accent, #3ECF8E)';
    if (s === 'rejected') return '#ef4444';
    return 'var(--color-text-tertiary)';
  };

  const getAuditDecisionLabel = (s) => {
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'needs_changes') return 'Needs Changes';
    return s || '—';
  };

  if (loading) return <div className="page-container"><p>{t('admin.loadingAppDetails')}</p></div>;

  if (!application) {
    return (
      <div className="page-container">
        <p>{t('admin.appNotFound')}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>{t('admin.goBack')}</Button>
      </div>
    );
  }

  const backPath = isAuditor ? '/auditor/dashboard' : isCB ? '/cert-body/dashboard' : '/admin/applications';
  const backLabel = isAuditor ? t('admin.backToDashboard') : isCB ? t('admin.backToDashboard') : t('admin.backToApplications');
  const alreadyCertified = application.status === 'approved' || application.status === 'rejected';

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      {toast && (
        <div className="cert-request__toast"><CheckCircle size={16} /><span>{toast}</span></div>
      )}

      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex' }}>
        <button className="back-btn" onClick={() => navigate(backPath)}>
          <ArrowLeft size={16} /> {backLabel}
        </button>
      </div>

      <div className="app-details-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>{application.company_name}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>{t('admin.applicationId', { id: application.id.slice(0, 8) })}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <div className="app-details-grid">
        {/* LEFT CARD: Client Details */}
        <div className="app-card">
          <h3 className="app-card-title">{t('admin.clientDetails')}</h3>
          <div className="details-list">
            <div className="detail-item"><Building size={16} className="detail-icon" /><div><label>{t('dashboard.industry')}</label><p>{application.industry || '—'}</p></div></div>
            <div className="detail-item"><Target size={16} className="detail-icon" /><div><label>{t('dashboard.scope')}</label><p>{application.scope || '—'}</p></div></div>
            <div className="detail-item"><Users size={16} className="detail-icon" /><div><label>{t('admin.employees')}</label><p>{application.employee_count || '—'}</p></div></div>
            <div className="detail-item"><Globe size={16} className="detail-icon" /><div><label>{t('admin.region')}</label><p>{getRegionLabel(application.client?.region)}</p></div></div>
            <div className="detail-item"><Activity size={16} className="detail-icon" /><div><label>{t('admin.recommendedISO')}</label><p>{application.recommended_iso || '—'}</p></div></div>
            <div className="detail-item"><FileText size={16} className="detail-icon" /><div><label>{t('admin.selectedPackage')}</label><p>{application.selected_package ? application.selected_package.replace(/_/g, ' ') : '—'}</p></div></div>
            {application.payment_method && (
              <div className="detail-item"><CreditCard size={16} className="detail-icon" /><div>
                <label>{t('admin.paymentMethod')}</label>
                <p>
                  {{ card: t('payment.methodCard'), paypal: t('payment.methodPaypal'), moneygram: t('payment.methodMoneygram'), bank_transfer: t('payment.methodBankTransfer') }[application.payment_method] || application.payment_method}
                  {application.payment_status && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: application.payment_status === 'verified' ? '#dcfce7' : application.payment_status === 'awaiting_verification' ? '#fef3c7' : '#e2e8f0', color: application.payment_status === 'verified' ? '#166534' : application.payment_status === 'awaiting_verification' ? '#92400e' : '#475569' }}>
                      {t(`admin.paymentStatus_${application.payment_status}`)}
                    </span>
                  )}
                </p>
              </div></div>
            )}
          </div>
          {canAssign && application.payment_status === 'awaiting_verification' && (
            <button
              onClick={handleVerifyPayment}
              disabled={saving}
              style={{ marginTop: 12, width: '100%', padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <CheckCircle2 size={16} /> {t('admin.verifyPayment')}
            </button>
          )}
          <div className="contact-info">
            <h4>{t('admin.contactInfo')}</h4>
            <p><strong>Name:</strong> {application.client?.full_name || '—'}</p>
            <p><strong>Email:</strong> {application.client?.email || '—'}</p>
            {application.client_metadata?.contact_number && (
              <p><strong>{t('admin.phone')}</strong> {application.client_metadata.contact_number}</p>
            )}
            {application.client_metadata?.activity && (
              <p><strong>{t('admin.roleActivity')}</strong> {application.client_metadata.activity}</p>
            )}
            {application.client?.company_name && (
              <p><strong>Company:</strong> {application.client.company_name}</p>
            )}
          </div>
        </div>

        {/* RIGHT CARD: Role-specific controls */}
        <div className="app-card">

          {/* ===== AUDITOR CONTROLS ===== */}
          {isAuditor && (
            <>
              <h3 className="app-card-title">{t('admin.auditControls')}</h3>
              {application.status === 'audited' ? (
                <div className="audit-completed-banner"><CheckCircle2 size={20} /><span>{t('admin.auditSubmitted')}</span></div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('admin.auditDecision')}</label>
                    <Select value={auditDecision} onChange={(e) => setAuditDecision(e.target.value)}>
                      <option value="">{t('admin.selectDecision')}</option>
                      <option value="approved">{t('admin.approved')}</option>
                      <option value="rejected">{t('admin.rejected')}</option>
                      <option value="needs_changes">{t('admin.needsChanges')}</option>
                    </Select>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('admin.auditorComments')}</label>
                    <textarea className="form-textarea" rows={4} value={auditComment} onChange={(e) => setAuditComment(e.target.value)} placeholder={t('admin.auditorCommentsPlaceholder')} />
                  </div>
                  <Button variant="primary" onClick={handleSubmitAudit} disabled={submittingAudit || !auditDecision} className="w-full" style={{ width: '100%', justifyContent: 'center' }}>
                    <ClipboardCheck size={18} /> {submittingAudit ? t('common.submitting') : t('admin.submitAudit')}
                  </Button>
                </>
              )}
            </>
          )}

          {/* ===== CB CONTROLS ===== */}
          {isCB && (
            <>
              <h3 className="app-card-title">{t('admin.certDecision')}</h3>

              {/* Audit Report Summary */}
              <div className="cb-audit-summary">
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('admin.auditorReport')}
                </h4>
                {auditReport ? (
                  <div className="cb-audit-report-card">
                    <div className="cb-report-row">
                      <span>{t('admin.auditor')}</span>
                      <strong>{auditReport.auditor?.full_name || '—'}</strong>
                    </div>
                    <div className="cb-report-row">
                      <span>{t('admin.decision')}</span>
                      <StatusBadge status={auditReport.status} label={getAuditDecisionLabel(auditReport.status)} />
                    </div>
                    {auditReport.report_url && (
                      <div className="cb-report-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span>{t('admin.comments')}</span>
                        <p style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>{auditReport.report_url}</p>
                      </div>
                    )}
                    <div className="cb-report-row">
                      <span>{t('dashboard.date')}</span>
                      <strong>{auditReport.created_at ? new Date(auditReport.created_at).toLocaleDateString() : '—'}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="cb-no-report">
                    <AlertCircle size={16} />
                    <span>{t('admin.noAuditReport')}</span>
                  </div>
                )}
              </div>

              {/* Certification Decision Actions */}
              {alreadyCertified ? (
                <div className="audit-completed-banner" style={application.status === 'rejected' ? { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' } : {}}>
                  {application.status === 'approved' ? <Award size={20} /> : <XCircle size={20} />}
                  <span>{application.status === 'approved' ? t('admin.certApproved') : t('admin.certRejected')}</span>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: '1.25rem', marginTop: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('admin.commentsOptional')}</label>
                    <textarea className="form-textarea" rows={3} value={cbComment} onChange={(e) => setCbComment(e.target.value)} placeholder={t('admin.certNotesPlaceholder')} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                      variant="primary"
                      onClick={() => openDecisionModal('approved')}
                      disabled={submittingCbDecision}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <ShieldCheck size={18} /> {submittingCbDecision ? t('common.processing') : t('admin.approveCert')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDecisionModal('rejected')}
                      disabled={submittingCbDecision}
                      style={{ flex: 1, justifyContent: 'center', color: '#ef4444', borderColor: '#ef4444' }}
                    >
                      <XCircle size={18} /> {t('common.reject')}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ===== ADMIN CONTROLS ===== */}
          {canAssign && (
            <>
              <h3 className="app-card-title">{t('admin.workflowControls')}</h3>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('admin.appStatus')}</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="pending">{t('admin.pending')}</option>
                  <option value="awaiting_payment">{t('admin.awaitingPayment')}</option>
                  <option value="in_review">{t('admin.inReview')}</option>
                  <option value="audit_scheduled">{t('admin.auditScheduled')}</option>
                  <option value="audited">{t('admin.audited')}</option>
                  <option value="approved">{t('admin.approved')}</option>
                  <option value="rejected">{t('admin.rejected')}</option>
                </Select>
              </div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  {t('admin.assignAuditor')} {isRegionalAdmin && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{t('admin.regionOnly', { region: getRegionLabel(user.region) })}</span>}
                </label>
                <Select value={assignedAuditor} onChange={(e) => setAssignedAuditor(e.target.value)}>
                  <option value="">{t('admin.selectAuditor')}</option>
                  {auditors.map(aud => (
                    <option key={aud.id} value={aud.id}>{aud.full_name || aud.id.slice(0, 8)}{aud.region ? ` (${getRegionLabel(aud.region)})` : ''}</option>
                  ))}
                </Select>
              </div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  {t('admin.assignCB')} {isRegionalAdmin && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{t('admin.regionOnly', { region: getRegionLabel(user.region) })}</span>}
                </label>
                <Select value={assignedCb} onChange={(e) => setAssignedCb(e.target.value)}>
                  <option value="">{t('admin.selectCB')}</option>
                  {cbs.map(cb => (
                    <option key={cb.id} value={cb.id}>
                      {cb.name || cb.id.slice(0, 8)}
                      {cb.acronym ? ` (${cb.acronym})` : ''}
                      {cb.country ? ` — ${cb.country}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              {/* Audit Report visible to admin */}
              {auditReport && (
                <div className="cb-audit-summary" style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {t('admin.auditorReport')}
                  </h4>
                  <div className="cb-audit-report-card">
                    <div className="cb-report-row">
                      <span>{t('admin.auditor')}</span>
                      <strong>{auditReport.auditor?.full_name || '—'}</strong>
                    </div>
                    <div className="cb-report-row">
                      <span>Decision</span>
                      <StatusBadge status={auditReport.status} label={getAuditDecisionLabel(auditReport.status)} />
                    </div>
                    {auditReport.report_url && (
                      <div className="cb-report-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span>Comments</span>
                        <p style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>{auditReport.report_url}</p>
                      </div>
                    )}
                    <div className="cb-report-row">
                      <span>Date</span>
                      <strong>{auditReport.created_at ? new Date(auditReport.created_at).toLocaleDateString() : '—'}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('admin.internalNotes')}</label>
                <textarea className="form-textarea" rows={4} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder={t('admin.internalNotesPlaceholder')} />
              </div>
              <Button variant="primary" onClick={handleSave} disabled={saving} className="w-full" style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* REQUIRED DOCUMENTS CHECKLIST */}
      {getRequiredDocs(application.recommended_iso).length > 0 && (
        <div className="app-card" style={{ marginTop: '1.5rem' }}>
          <h3 className="app-card-title">{t('admin.requiredDocsFor', { iso: application.recommended_iso })}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            {t('admin.requiredDocsDesc')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {getRequiredDocs(application.recommended_iso).map((docName, i) => {
              const uploaded = documents.some(d => d.file_name?.toLowerCase().includes(docName.split(' ')[0].toLowerCase()));
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: uploaded ? 'rgba(62,207,142,0.08)' : 'var(--color-bg-primary, #f9fafb)', borderRadius: '8px', border: `1px solid ${uploaded ? 'rgba(62,207,142,0.25)' : 'var(--color-border)'}` }}>
                  {uploaded ? <CheckCircle2 size={16} style={{ color: 'var(--color-accent, #3ECF8E)', flexShrink: 0 }} /> : <AlertCircle size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
                  <span style={{ fontSize: '0.85rem', color: uploaded ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{docName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DOCUMENTS SECTION */}
      <div className="app-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h3 className="app-card-title" style={{ margin: 0 }}>{isAuditor ? t('admin.documentReview') : t('dashboard.uploadedDocs')}</h3>
          {canUploadDocs && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploading ? 'wait' : 'pointer', padding: '8px 14px', borderRadius: 8, background: 'var(--color-accent, #3ECF8E)', color: '#fff', fontSize: '0.85rem', fontWeight: 500, opacity: uploading ? 0.7 : 1 }}>
              <Upload size={14} />
              {uploading ? t('common.uploading') : t('admin.uploadDocument')}
              <input type="file" onChange={handleAdminUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          )}
        </div>
        {uploadError && (
          <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {uploadError}
          </div>
        )}
        {documents.length === 0 ? (
          <p className="no-docs">{t('admin.noDocsAttached')}</p>
        ) : (
          <div className="documents-review-list">
            {documents.map(doc => (
              <div key={doc.id} className="document-review-card">
                <div className="document-review-header">
                  <div className="doc-info">
                    <FileText size={20} className="doc-icon" />
                    <div>
                      <span className="doc-name">{doc.file_name || 'Document'}</span>
                      <span className="doc-meta">{doc.file_size || '—'} {doc.document_type ? `· ${doc.document_type}` : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {doc.status && (
                      <span className="doc-status-badge" style={{ color: getDocStatusColor(doc.status) }}>
                        {doc.status === 'approved' && <CheckCircle2 size={14} />}
                        {doc.status === 'rejected' && <XCircle size={14} />}
                        {doc.status === 'pending' && <AlertCircle size={14} />}
                        {doc.status || 'pending'}
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDownload(doc)}><Download size={14} /> Download</Button>
                    {canUploadDocs && (
                      <Button variant="outline" size="sm" onClick={() => handleAdminDeleteDoc(doc)} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>

                {isAuditor && application.status !== 'audited' && (
                  <div className="document-review-actions">
                    <div style={{ flex: 1 }}>
                      <input className="form-input" style={{ width: '100%', fontSize: '0.8rem' }} placeholder={t('admin.reviewComment')}
                        value={reviewComments[doc.id] || ''} onChange={(e) => setReviewComments(prev => ({ ...prev, [doc.id]: e.target.value }))} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDocumentReview(doc.id, 'approved')} style={{ color: 'var(--color-accent, #3ECF8E)', borderColor: 'var(--color-accent, #3ECF8E)' }}>
                      <CheckCircle2 size={14} /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDocumentReview(doc.id, 'rejected')} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                )}

                {doc.reviewer_comment && (
                  <div className="doc-reviewer-comment"><strong>Review comment:</strong> {doc.reviewer_comment}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!decisionModal}
        onClose={closeDecisionModal}
        title={decisionModal === 'approved' ? t('admin.approveCert') : t('common.reject')}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {decisionError && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, fontSize: '0.85rem' }}>
              {decisionError}
            </div>
          )}
          {decisionFields.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
              {decisionModal === 'approved' ? t('admin.confirmApproveCert') : t('admin.confirmRejectCert')}
            </p>
          ) : (
            decisionFields.map(f => (
              <CustomFieldRenderer
                key={f.id}
                field={f}
                value={decisionValues[f.field_key]}
                onChange={(v) => setDecisionValues(prev => ({ ...prev, [f.field_key]: v }))}
              />
            ))
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={closeDecisionModal} disabled={submittingCbDecision}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCbDecision}
              loading={submittingCbDecision}
              style={decisionModal === 'rejected' ? { background: '#ef4444', borderColor: '#ef4444' } : {}}
            >
              {decisionModal === 'approved' ? t('admin.approveCert') : t('common.reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
