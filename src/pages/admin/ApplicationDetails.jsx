import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import StatusBadge from '../../components/ui/StatusBadge';
import { Button, Select, Input, Textarea } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import CustomFieldRenderer, { validateCustomFields } from '../../components/CustomFieldRenderer';
import { ArrowLeft, CheckCircle, FileText, Download, Building, Users, Target, Activity, Globe, ClipboardCheck, XCircle, CheckCircle2, AlertCircle, Award, ShieldCheck, Upload, Trash2, CreditCard, Receipt, Wallet } from 'lucide-react';
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

// Payment methods offered on the billing forms. Values are the human-readable
// strings stored verbatim on the invoice/receipt row and printed on the PDF, so
// they stay in English (the PDF is a financial record, not localised UI); only
// the dropdown label goes through i18n.
const BILLING_PAYMENT_METHODS = [
  { value: 'Credit / Debit Card', labelKey: 'payment.methodCard' },
  { value: 'Bank Transfer', labelKey: 'payment.methodBankTransfer' },
  { value: 'Cash', labelKey: 'payment.methodCash' },
  { value: 'PayPal', labelKey: 'payment.methodPaypal' },
  { value: 'MoneyGram', labelKey: 'payment.methodMoneygram' },
];

// The admin Payment Status dropdown. One control expresses both the status and
// the method ("Paid — Cash"), because that is how the client asked for it; the
// value is `status:method` and is split apart again before it reaches the DB.
// 'pending' and 'awaiting_verification' are not in the client's list, but the
// checkout flow really writes them — they are offered so that saving an
// unrelated change on such an order does not silently rewrite its payment state.
const PAYMENT_CHOICES = [
  // Placeholder only — legacy orders carry no payment_status and must still
  // render. It is `disabled` because saving it back would write NULL, and the
  // client dashboard reads a NULL payment_status as "no payment gate" and would
  // reveal the assigned Certification Body on an unpaid order. To say "not
  // paid", the admin picks Unpaid.
  { value: '',                      labelKey: 'admin.paymentStatusNotSet', disabled: true },
  { value: 'unpaid',                labelKey: 'admin.paymentStatus_unpaid' },
  { value: 'awaiting_verification', labelKey: 'admin.paymentStatus_awaiting_verification' },
  { value: 'pending',               labelKey: 'admin.paymentStatus_pending' },
  { value: 'paid:card',             labelKey: 'admin.paymentStatus_paidCard' },
  { value: 'paid:cash',             labelKey: 'admin.paymentStatus_paidCash' },
  { value: 'paid:bank_transfer',    labelKey: 'admin.paymentStatus_paidBank' },
];

const PAYMENT_METHOD_LABEL_KEYS = {
  card: 'payment.methodCard',
  cash: 'payment.methodCash',
  bank_transfer: 'payment.methodBankTransfer',
  paypal: 'payment.methodPaypal',
  moneygram: 'payment.methodMoneygram',
};

// Collapse (payment_status, payment_method) into one dropdown value. 'verified'
// is the legacy offline-verified status — it means paid, so it displays as the
// matching Paid option; it is only written back as 'paid' if the admin actually
// picks a different option.
function paymentChoiceOf(app) {
  const status = app?.payment_status || '';
  if (status !== 'paid' && status !== 'verified') return status;
  return `paid:${app?.payment_method || 'card'}`;
}

const today = () => new Date().toISOString().slice(0, 10);

function formatMoney(amount, currency = 'USD') {
  const n = Number(amount || 0);
  return `${currency === 'USD' ? 'US$' : `${currency} `}${n.toFixed(2)}`;
}

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
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
  const [paymentChoice, setPaymentChoice] = useState('');

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

  // --- Billing (admin only) ---
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingModal, setBillingModal] = useState(null); // 'invoice' | 'receipt' | null
  const [billingSubmitting, setBillingSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(null);
  const [receiptForm, setReceiptForm] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('*, client:profiles!client_id(full_name, email, region, country, company_name, approval_status)')
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
          setPaymentChoice(paymentChoiceOf(appData));
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

  // --- Billing: load issued documents -------------------------------------
  // Signed URLs on each row are short-lived, so this always re-fetches rather
  // than caching; it is also called again after every successful issuance.
  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    setBillingError('');
    try {
      const data = await apiPost('/api/checkout', {
        action: 'list-billing-documents',
        applicationId: id,
      });
      setInvoices(data.invoices || []);
      setReceipts(data.receipts || []);
    } catch (err) {
      console.error('Error loading billing documents', err);
      setBillingError(err.message || t('billing.loadFailed'));
    } finally {
      setBillingLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (id && canAssign) loadBilling();
  }, [id, canAssign, loadBilling]);

  const outstandingOf = (inv) =>
    Math.max(0, Number(inv?.total || 0) - Number(inv?.amount_paid || 0));

  const openInvoiceModal = () => {
    setBillingError('');
    setInvoiceForm({
      billToName: application?.company_name || application?.client?.company_name || application?.client?.full_name || '',
      billToAddress: '',
      billToEmail: application?.client?.email || '',
      billToCountry: application?.client?.country || '',
      description: application?.recommended_iso || '',
      subtotal: application?.total_amount != null ? String(application.total_amount) : '',
      discountAmount: '',
      discountLabel: '',
      invoiceNumber: '',
      issueDate: today(),
      dueDate: '',
      paymentMethod: '',
      paymentTerms: '',
      notes: '',
      send: true,
    });
    setBillingModal('invoice');
  };

  const openReceiptModal = () => {
    setBillingError('');
    const target = invoices.find(inv => outstandingOf(inv) > 0) || invoices[0] || null;
    setReceiptForm({
      invoiceId: target?.id || '',
      customerName: target?.bill_to_name || application?.company_name || application?.client?.full_name || '',
      amount: target ? String(outstandingOf(target) || target.total || '') : '',
      paymentMethod: '',
      paymentDate: today(),
      memo: target?.invoice_number || '',
      receiptNumber: '',
      send: true,
    });
    setBillingModal('receipt');
  };

  // Re-prefill the amount / customer / memo when staff pick a different invoice.
  const handleReceiptInvoiceChange = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    setReceiptForm(prev => ({
      ...prev,
      invoiceId,
      customerName: inv?.bill_to_name || prev.customerName,
      amount: inv ? String(outstandingOf(inv) || inv.total || '') : prev.amount,
      memo: inv?.invoice_number || prev.memo,
    }));
  };

  const closeBillingModal = () => {
    setBillingModal(null);
    setBillingSubmitting(false);
  };

  const handleIssueInvoice = async () => {
    const f = invoiceForm;
    if (!f?.billToName?.trim() || !f?.description?.trim() || f?.subtotal === '' || Number.isNaN(Number(f?.subtotal))) {
      setBillingError(t('billing.invoiceRequiredFields'));
      return;
    }
    setBillingSubmitting(true);
    setBillingError('');
    try {
      const result = await apiPost('/api/checkout', {
        action: 'issue-invoice',
        applicationId: id,
        clientId: application?.client_id || null,
        billToName: f.billToName.trim(),
        billToAddress: f.billToAddress.trim() || null,
        billToEmail: f.billToEmail.trim() || null,
        billToCountry: f.billToCountry.trim() || null,
        description: f.description.trim(),
        subtotal: Number(f.subtotal),
        discountAmount: f.discountAmount === '' ? 0 : Number(f.discountAmount),
        discountLabel: f.discountLabel.trim() || null,
        paymentMethod: f.paymentMethod || null,
        paymentTerms: f.paymentTerms.trim() || null,
        notes: f.notes.trim() || null,
        issueDate: f.issueDate || null,
        dueDate: f.dueDate || null,
        invoiceNumber: f.invoiceNumber.trim() || null,
        send: f.send,
      });
      closeBillingModal();
      await loadBilling();
      if (result.alreadyExisted) {
        showToast(t('billing.invoiceAlreadyExisted'));
      } else if (f.send && !result.emailSent) {
        showToast(t('billing.invoiceCreatedNoEmail'));
      } else {
        showToast(t('billing.invoiceCreated'));
      }
    } catch (err) {
      console.error('Error issuing invoice', err);
      setBillingError(err.message || t('billing.issueFailed'));
    } finally {
      setBillingSubmitting(false);
    }
  };

  const handleIssueReceipt = async () => {
    const f = receiptForm;
    if (!f?.customerName?.trim() || !(Number(f?.amount) > 0)) {
      setBillingError(t('billing.receiptRequiredFields'));
      return;
    }
    setBillingSubmitting(true);
    setBillingError('');
    try {
      const result = await apiPost('/api/checkout', {
        action: 'issue-receipt',
        invoiceId: f.invoiceId || null,
        applicationId: id,
        clientId: application?.client_id || null,
        customerName: f.customerName.trim(),
        amount: Number(f.amount),
        paymentMethod: f.paymentMethod || null,
        paymentDate: f.paymentDate || null,
        memo: f.memo.trim() || null,
        receiptNumber: f.receiptNumber.trim() || null,
        send: f.send,
      });
      closeBillingModal();
      await loadBilling();
      if (f.send && !result.emailSent) {
        showToast(t('billing.receiptCreatedNoEmail'));
      } else {
        showToast(t('billing.receiptCreated'));
      }
    } catch (err) {
      console.error('Error issuing receipt', err);
      setBillingError(err.message || t('billing.issueFailed'));
    } finally {
      setBillingSubmitting(false);
    }
  };

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

      // Payment is deliberately NOT part of the update above: moving an order
      // into a paid state must also approve the client, burn their coupon and
      // email their dashboard link, which needs the service role. Sent only when
      // the admin actually changed the dropdown, so an untouched legacy
      // 'verified' row is never rewritten as 'paid'.
      let paymentPatch = null;
      const [choiceStatus, choiceMethod] = paymentChoice.split(':');
      // `choiceStatus` is only empty for the disabled placeholder, i.e. a legacy
      // order the admin left alone — nothing to send.
      if (choiceStatus && paymentChoice !== paymentChoiceOf(application)) {
        const result = await apiPost('/api/checkout', {
          action: 'set-payment-status',
          applicationId: id,
          paymentStatus: choiceStatus,
          paymentMethod: choiceMethod || null,
        });
        paymentPatch = {
          payment_status: result.payment_status ?? null,
          payment_method: result.payment_method ?? null,
        };
      }

      setApplication(prev => ({
        ...prev,
        status,
        assigned_auditor_id: assignedAuditor || null,
        assigned_cb_id: assignedCb || null,
        internal_notes: internalNotes,
        ...(paymentPatch || {}),
        // A paid order approves the client server-side; mirror it so the
        // "awaiting approval" prompt doesn't linger until the next reload.
        ...(paymentPatch?.payment_status === 'paid'
          ? { client: { ...prev.client, approval_status: 'approved' } }
          : {}),
      }));
      // Notify the client when their audit gets scheduled (only on transition).
      if (status === 'audit_scheduled' && prevStatus !== 'audit_scheduled') {
        apiPost('/api/notify-event', { applicationId: id, event: 'audit_scheduled' }).catch(() => {});
      }
      showToast(t('admin.appUpdated'));
    } catch (err) {
      console.error('Error updating application', err);
      alert(err.message || t('admin.failedUpdateApp'));
    } finally { setSaving(false); }
  };

  // Manually confirm receipt of an offline payment (cash / bank transfer).
  // Routed through the service-role endpoint (admin-gated) so it also approves
  // the client and emails their one-click dashboard access link — the moment a
  // pay-first offline buyer actually gains access.
  const handleVerifyPayment = async () => {
    setSaving(true);
    try {
      await apiPost('/api/checkout', { action: 'verify-offline-payment', applicationId: id });
      setApplication(prev => ({ ...prev, payment_status: 'verified' }));
      setPaymentChoice(paymentChoiceOf({ ...application, payment_status: 'verified' }));
      showToast(t('admin.paymentVerified'));
    } catch (err) {
      console.error('Error verifying payment', err);
      alert(err.message || t('admin.failedUpdateApp'));
    } finally { setSaving(false); }
  };

  // Approve a paid client and grant dashboard access. The client asked that a
  // client account be activated ONLY AFTER admin approval — card payers land
  // here as approval_status='pending' until this runs, which also emails their
  // one-click dashboard link.
  const handleApproveClient = async () => {
    setSaving(true);
    try {
      await apiPost('/api/checkout', { action: 'approve-client-access', applicationId: id });
      setApplication(prev => ({
        ...prev,
        client: { ...prev.client, approval_status: 'approved' },
      }));
      showToast(t('admin.clientApproved'));
    } catch (err) {
      console.error('Error approving client', err);
      alert(err.message || t('admin.failedUpdateApp'));
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
            <div className="detail-item"><Globe size={16} className="detail-icon" /><div><label>{t('admin.country')}</label><p>{application.client?.country || '—'}</p></div></div>
            <div className="detail-item"><Activity size={16} className="detail-icon" /><div><label>{t('admin.recommendedISO')}</label><p>{application.recommended_iso || '—'}</p></div></div>
            <div className="detail-item"><FileText size={16} className="detail-icon" /><div><label>{t('admin.selectedPackage')}</label><p>{application.selected_package ? application.selected_package.replace(/_/g, ' ') : '—'}</p></div></div>
            {application.payment_method && (
              <div className="detail-item"><CreditCard size={16} className="detail-icon" /><div>
                <label>{t('admin.paymentMethod')}</label>
                <p>
                  {{ card: t('payment.methodCard'), cash: t('payment.methodCash'), paypal: t('payment.methodPaypal'), moneygram: t('payment.methodMoneygram'), bank_transfer: t('payment.methodBankTransfer') }[application.payment_method] || application.payment_method}
                  {application.payment_status && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: application.payment_status === 'verified' ? '#dcfce7' : application.payment_status === 'awaiting_verification' ? '#fef3c7' : '#e2e8f0', color: application.payment_status === 'verified' ? '#166534' : application.payment_status === 'awaiting_verification' ? '#92400e' : '#475569' }}>
                      {t(`admin.paymentStatus_${application.payment_status}`, application.payment_status)}
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
          {/* Card payers are paid but stay pending until an admin grants access.
              Only show once payment has actually landed (paid) — an abandoned,
              unpaid order must not be approvable. Offline payers go through
              Verify Payment above instead. */}
          {canAssign
            && application.client?.approval_status === 'pending'
            && application.payment_status === 'paid' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
                <AlertCircle size={15} /> {t('admin.clientAwaitingApproval')}
              </div>
              <button
                onClick={handleApproveClient}
                disabled={saving}
                style={{ width: '100%', padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 10, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <CheckCircle2 size={16} /> {t('admin.approveClientAccess')}
              </button>
            </div>
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
                  {/* Client request 24 Jul: a stage between "waiting for the
                      money" and "the work has started". Distinct from the
                      Payment Status field below — that records HOW they paid;
                      this records where the ORDER has got to. */}
                  <option value="payment_received">{t('admin.paymentReceived')}</option>
                  <option value="in_review">{t('admin.inReview')}</option>
                  <option value="audit_scheduled">{t('admin.auditScheduled')}</option>
                  <option value="audited">{t('admin.audited')}</option>
                  <option value="approved">{t('admin.approved')}</option>
                  <option value="rejected">{t('admin.rejected')}</option>
                </Select>
              </div>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('admin.paymentStatusLabel')}</label>
                <Select value={paymentChoice} onChange={(e) => setPaymentChoice(e.target.value)}>
                  {PAYMENT_CHOICES.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>{t(opt.labelKey)}</option>
                  ))}
                  {/* Legacy rows may be paid by a method no longer offered
                      (PayPal / MoneyGram). Show the real one rather than
                      snapping the dropdown onto a method that wasn't used. */}
                  {!PAYMENT_CHOICES.some(o => o.value === paymentChoice) && (
                    <option value={paymentChoice}>
                      {t('admin.paymentStatus_paidWith', {
                        method: t(PAYMENT_METHOD_LABEL_KEYS[paymentChoice.split(':')[1]] || 'admin.paymentStatusNotSet'),
                      })}
                    </option>
                  )}
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

      {/* ===== BILLING (super admin / country admin only) ===== */}
      {canAssign && (
        <div className="app-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <h3 className="app-card-title" style={{ margin: 0 }}>{t('billing.title')}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="primary" size="sm" onClick={openInvoiceModal}>
                <Receipt size={14} /> {t('billing.createInvoice')}
              </Button>
              <Button variant="outline" size="sm" onClick={openReceiptModal} disabled={invoices.length === 0}>
                <Wallet size={14} /> {t('billing.recordPayment')}
              </Button>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '1rem' }}>
            {t('billing.description')}
          </p>

          {billingError && !billingModal && (
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              {billingError}
            </div>
          )}

          {billingLoading ? (
            <p className="no-docs">{t('common.loading')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Invoices */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('billing.invoices')}
                </h4>
                {invoices.length === 0 ? (
                  <p className="no-docs">{t('billing.noInvoices')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {invoices.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                        <FileText size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        <strong style={{ fontSize: '0.85rem' }}>{inv.invoice_number}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{formatDay(inv.issue_date)}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatMoney(inv.total, inv.currency)}</span>
                        <StatusBadge status={inv.status} label={t(`billing.status_${inv.status}`, inv.status)} />
                        <span style={{ flex: 1 }} />
                        {inv.url ? (
                          <Button variant="outline" size="sm" onClick={() => window.open(inv.url, '_blank', 'noopener')}>
                            <Download size={14} /> {t('common.download')}
                          </Button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>{t('billing.fileUnavailable')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipts */}
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('billing.receipts')}
                </h4>
                {receipts.length === 0 ? (
                  <p className="no-docs">{t('billing.noReceipts')}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {receipts.map(rcp => (
                      <div key={rcp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                        <Wallet size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        <strong style={{ fontSize: '0.85rem' }}>{rcp.receipt_number}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{formatDay(rcp.payment_date)}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{formatMoney(rcp.amount, rcp.currency)}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{rcp.payment_method || '—'}</span>
                        <span style={{ flex: 1 }} />
                        {rcp.url ? (
                          <Button variant="outline" size="sm" onClick={() => window.open(rcp.url, '_blank', 'noopener')}>
                            <Download size={14} /> {t('common.download')}
                          </Button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-tertiary)' }}>{t('billing.fileUnavailable')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Invoice */}
      <Modal
        isOpen={billingModal === 'invoice'}
        onClose={closeBillingModal}
        title={t('billing.createInvoice')}
        size="lg"
      >
        {invoiceForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {billingError && (
              <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, fontSize: '0.85rem' }}>
                {billingError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Input label={t('billing.billToName')} value={invoiceForm.billToName}
                onChange={(e) => setInvoiceForm(p => ({ ...p, billToName: e.target.value }))} />
              <Input label={t('billing.billToEmail')} type="email" value={invoiceForm.billToEmail}
                onChange={(e) => setInvoiceForm(p => ({ ...p, billToEmail: e.target.value }))} />
              <Input label={t('billing.billToCountry')} value={invoiceForm.billToCountry}
                onChange={(e) => setInvoiceForm(p => ({ ...p, billToCountry: e.target.value }))} />
              <Input label={t('billing.invoiceNumber')} placeholder={t('billing.invoiceNumberAuto')} value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm(p => ({ ...p, invoiceNumber: e.target.value }))} />
              <Input label={t('billing.issueDate')} type="date" value={invoiceForm.issueDate}
                onChange={(e) => setInvoiceForm(p => ({ ...p, issueDate: e.target.value }))} />
              <Input label={t('billing.dueDate')} type="date" value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <Textarea label={t('billing.billToAddress')} rows={2} value={invoiceForm.billToAddress}
              onChange={(e) => setInvoiceForm(p => ({ ...p, billToAddress: e.target.value }))} />
            <Textarea label={t('billing.descriptionField')} rows={2} value={invoiceForm.description}
              onChange={(e) => setInvoiceForm(p => ({ ...p, description: e.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Input label={t('billing.subtotal')} type="number" min="0" step="0.01" value={invoiceForm.subtotal}
                onChange={(e) => setInvoiceForm(p => ({ ...p, subtotal: e.target.value }))} />
              <Input label={t('billing.discountAmount')} type="number" min="0" step="0.01" value={invoiceForm.discountAmount}
                onChange={(e) => setInvoiceForm(p => ({ ...p, discountAmount: e.target.value }))} />
              <Input label={t('billing.discountLabel')} value={invoiceForm.discountLabel}
                onChange={(e) => setInvoiceForm(p => ({ ...p, discountLabel: e.target.value }))} />
              <Select label={t('billing.paymentMethod')} value={invoiceForm.paymentMethod}
                onChange={(e) => setInvoiceForm(p => ({ ...p, paymentMethod: e.target.value }))}>
                <option value="">{t('billing.noPaymentMethod')}</option>
                {BILLING_PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </Select>
            </div>
            <Textarea label={t('billing.paymentTerms')} rows={2} value={invoiceForm.paymentTerms}
              onChange={(e) => setInvoiceForm(p => ({ ...p, paymentTerms: e.target.value }))} />
            <Textarea label={t('billing.notes')} rows={2} value={invoiceForm.notes}
              onChange={(e) => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" checked={invoiceForm.send}
                onChange={(e) => setInvoiceForm(p => ({ ...p, send: e.target.checked }))} />
              {t('billing.sendByEmail')}
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={closeBillingModal} disabled={billingSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="primary" onClick={handleIssueInvoice} loading={billingSubmitting}>
                {t('billing.issueInvoice')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment */}
      <Modal
        isOpen={billingModal === 'receipt'}
        onClose={closeBillingModal}
        title={t('billing.recordPayment')}
        size="md"
      >
        {receiptForm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {billingError && (
              <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 6, fontSize: '0.85rem' }}>
                {billingError}
              </div>
            )}
            <Select label={t('billing.againstInvoice')} value={receiptForm.invoiceId}
              onChange={(e) => handleReceiptInvoiceChange(e.target.value)}>
              <option value="">{t('billing.noInvoiceLink')}</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {formatMoney(outstandingOf(inv), inv.currency)} {t('billing.outstandingSuffix')}
                </option>
              ))}
            </Select>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Input label={t('billing.customerName')} value={receiptForm.customerName}
                onChange={(e) => setReceiptForm(p => ({ ...p, customerName: e.target.value }))} />
              <Input label={t('billing.amount')} type="number" min="0" step="0.01" value={receiptForm.amount}
                onChange={(e) => setReceiptForm(p => ({ ...p, amount: e.target.value }))} />
              <Select label={t('billing.paymentMethod')} value={receiptForm.paymentMethod}
                onChange={(e) => setReceiptForm(p => ({ ...p, paymentMethod: e.target.value }))}>
                <option value="">{t('billing.noPaymentMethod')}</option>
                {BILLING_PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </Select>
              <Input label={t('billing.paymentDate')} type="date" value={receiptForm.paymentDate}
                onChange={(e) => setReceiptForm(p => ({ ...p, paymentDate: e.target.value }))} />
              <Input label={t('billing.receiptNumber')} placeholder={t('billing.invoiceNumberAuto')} value={receiptForm.receiptNumber}
                onChange={(e) => setReceiptForm(p => ({ ...p, receiptNumber: e.target.value }))} />
            </div>
            <Textarea label={t('billing.memo')} rows={2} value={receiptForm.memo}
              onChange={(e) => setReceiptForm(p => ({ ...p, memo: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" checked={receiptForm.send}
                onChange={(e) => setReceiptForm(p => ({ ...p, send: e.target.checked }))} />
              {t('billing.sendByEmail')}
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={closeBillingModal} disabled={billingSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="primary" onClick={handleIssueReceipt} loading={billingSubmitting}>
                {t('billing.issueReceipt')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
