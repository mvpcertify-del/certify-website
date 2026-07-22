import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Download,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import { Button, Input, Select, Textarea } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import './AdminBilling.css';

// Standalone billing desk for Super Admin / Country Admin.
//
// Issuing an invoice or a receipt was previously reachable only by drilling into
// one application's detail view, so nobody could see what had been billed across
// clients. This page is that missing overview plus the same two issuance
// actions, driven by the already-existing `issue-invoice` / `issue-receipt`
// endpoints on /api/checkout.
//
// The lists are read straight from Postgres with the anon key: RLS on `invoices`
// and `payment_receipts` (phase20) is SELECT-only and already scopes a regional
// admin to their own region, so no extra API route is needed to list them.

// Payment methods offered on the billing forms. Values are the human-readable
// strings stored verbatim on the invoice/receipt row and printed on the PDF, so
// they stay in English (the PDF is a financial record, not localised UI); only
// the dropdown label goes through i18n. Kept in sync with ApplicationDetails.
const BILLING_PAYMENT_METHODS = [
  { value: 'Credit / Debit Card', labelKey: 'payment.methodCard' },
  { value: 'Bank Transfer', labelKey: 'payment.methodBankTransfer' },
  { value: 'Cash', labelKey: 'payment.methodCash' },
  { value: 'PayPal', labelKey: 'payment.methodPaypal' },
  { value: 'MoneyGram', labelKey: 'payment.methodMoneygram' },
];

const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'cancelled'];

const TAB_INVOICES = 'invoices';
const TAB_RECEIPTS = 'receipts';

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

const outstandingOf = (inv) =>
  Math.max(0, Number(inv?.total || 0) - Number(inv?.amount_paid || 0));

const blankInvoiceForm = {
  applicationId: '',
  billToName: '',
  billToEmail: '',
  billToCountry: '',
  billToAddress: '',
  description: '',
  subtotal: '',
  discountAmount: '',
  discountLabel: '',
  paymentMethod: '',
  paymentTerms: '',
  notes: '',
  issueDate: today(),
  dueDate: '',
  invoiceNumber: '',
  // Deliberately false: these PDFs go to real external clients, so an admin has
  // to opt in to sending one rather than firing it off by simply saving.
  send: false,
};

const blankReceiptForm = {
  invoiceId: '',
  customerName: '',
  amount: '',
  paymentMethod: '',
  paymentDate: today(),
  receiptNumber: '',
  memo: '',
  send: false, // same opt-in rule as the invoice form above
};

export default function AdminBilling() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const myRegion = user?.region || null;

  const [tab, setTab] = useState(TAB_INVOICES);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [people, setPeople] = useState({});
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modal, setModal] = useState(null); // 'invoice' | 'receipt' | null
  const [invoiceForm, setInvoiceForm] = useState(blankInvoiceForm);
  const [receiptForm, setReceiptForm] = useState(blankReceiptForm);
  const [appSearch, setAppSearch] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ---- Data loading -------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, rcpRes, appRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_receipts').select('*').order('created_at', { ascending: false }),
        supabase
          .from('applications')
          .select('id, company_name, recommended_iso, client_id, client:profiles!client_id(full_name, email, company_name, country, region)')
          .order('created_at', { ascending: false }),
      ]);
      if (invRes.error) throw invRes.error;
      if (rcpRes.error) throw rcpRes.error;

      const inv = invRes.data || [];
      const rcp = rcpRes.data || [];
      setInvoices(inv);
      setReceipts(rcp);
      // The application list is only needed to populate the "new invoice"
      // picker — a failure there must not blank out the billing tables.
      // RLS on `applications` is broad for staff (every other admin list view
      // narrows it in JS), so a country admin is scoped here too. Without it
      // the picker would name out-of-region clients even though the server
      // would go on to refuse the issuance with a 403.
      const apps = appRes.error ? [] : (appRes.data || []);
      setApplications(isRegionalAdmin
        ? apps.filter(a => myRegion && a.client?.region === myRegion)
        : apps);

      // Resolve client names in one extra round-trip rather than an embedded
      // join: both tables have two FKs to `profiles` (client_id and created_by),
      // which makes an implicit embed ambiguous.
      const ids = [...new Set([...inv, ...rcp].map(r => r.client_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name, email, company_name').in('id', ids);
        setPeople(Object.fromEntries((profs || []).map(p => [p.id, p])));
      } else {
        setPeople({});
      }
    } catch (err) {
      setError(err.message || t('billing.loadFailed'));
      setInvoices([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [t, isRegionalAdmin, myRegion]);

  useEffect(() => { load(); }, [load]);

  // ---- Derived ------------------------------------------------------------
  const currency = invoices[0]?.currency || receipts[0]?.currency || 'USD';

  const summary = useMemo(() => {
    // Cancelled invoices are excluded from the money totals — they are not owed.
    const live = invoices.filter(i => i.status !== 'cancelled');
    const invoiced = live.reduce((s, i) => s + Number(i.total || 0), 0);
    const paid = live.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
    return {
      invoiced,
      paid,
      outstanding: Math.max(0, invoiced - paid),
      invoiceCount: invoices.length,
      receiptCount: receipts.length,
    };
  }, [invoices, receipts]);

  const invoiceNumberById = useMemo(
    () => Object.fromEntries(invoices.map(i => [i.id, i.invoice_number])),
    [invoices]
  );

  const clientLabel = useCallback((row, fallback) => {
    const p = row.client_id ? people[row.client_id] : null;
    return fallback || p?.company_name || p?.full_name || p?.email || '—';
  }, [people]);

  const matches = useCallback((row, extra = []) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = row.client_id ? people[row.client_id] : null;
    return [...extra, p?.full_name, p?.email, p?.company_name]
      .some(v => (v || '').toLowerCase().includes(q));
  }, [search, people]);

  const filteredInvoices = useMemo(() => invoices.filter(inv =>
    (!statusFilter || inv.status === statusFilter) &&
    matches(inv, [inv.invoice_number, inv.bill_to_name, inv.bill_to_email, inv.description])
  ), [invoices, statusFilter, matches]);

  const filteredReceipts = useMemo(() => receipts.filter(rcp =>
    matches(rcp, [rcp.receipt_number, rcp.customer_name, rcp.memo, invoiceNumberById[rcp.invoice_id]])
  ), [receipts, matches, invoiceNumberById]);

  // At most one invoice per application (partial unique index on
  // invoices.application_id), so already-invoiced orders are shown as disabled
  // rather than letting the admin submit something Postgres will reject.
  const invoicedAppIds = useMemo(
    () => new Set(invoices.map(i => i.application_id).filter(Boolean)),
    [invoices]
  );

  const pickableApplications = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications.filter(a => {
      if (!q) return true;
      return [a.company_name, a.recommended_iso, a.client?.full_name, a.client?.email]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [applications, appSearch]);

  const openInvoices = useMemo(
    () => invoices.filter(i => i.status !== 'cancelled' && outstandingOf(i) > 0),
    [invoices]
  );

  // ---- Actions ------------------------------------------------------------
  const handleDownload = async (row) => {
    setError('');
    if (!row.storage_path) {
      setError(t('billing.fileUnavailable'));
      return;
    }
    try {
      const { data, error: sErr } = await supabase.storage
        .from('billing-documents')
        .createSignedUrl(row.storage_path, 300);
      if (sErr || !data?.signedUrl) throw sErr || new Error(t('adminBilling.downloadFailed'));
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (err) {
      setError(err.message || t('adminBilling.downloadFailed'));
    }
  };

  const closeModal = () => {
    setModal(null);
    setModalError('');
    setSubmitting(false);
  };

  const openInvoiceModal = () => {
    setInvoiceForm({ ...blankInvoiceForm, issueDate: today() });
    setAppSearch('');
    setModalError('');
    setNotice('');
    setModal('invoice');
  };

  // Prefill the bill-to block from whichever application the admin picks, so
  // the common case is a two-field form (description + subtotal).
  const handleApplicationChange = (applicationId) => {
    const app = applications.find(a => a.id === applicationId);
    setInvoiceForm(prev => ({
      ...prev,
      applicationId,
      billToName: app?.company_name || app?.client?.company_name || app?.client?.full_name || prev.billToName,
      billToEmail: app?.client?.email || prev.billToEmail,
      billToCountry: app?.client?.country || prev.billToCountry,
      description: prev.description || app?.recommended_iso || '',
    }));
  };

  const openReceiptModal = (invoice = null) => {
    const inv = invoice || null;
    setReceiptForm({
      ...blankReceiptForm,
      paymentDate: today(),
      invoiceId: inv?.id || '',
      customerName: inv?.bill_to_name || '',
      amount: inv ? String(outstandingOf(inv) || '') : '',
      memo: inv?.invoice_number || '',
    });
    setModalError('');
    setNotice('');
    setModal('receipt');
  };

  const handleReceiptInvoiceChange = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    setReceiptForm(prev => ({
      ...prev,
      invoiceId,
      customerName: inv?.bill_to_name || prev.customerName,
      amount: inv ? String(outstandingOf(inv) || '') : prev.amount,
      memo: inv?.invoice_number || prev.memo,
    }));
  };

  const handleIssueInvoice = async () => {
    const f = invoiceForm;
    if (!f.billToName.trim() || !f.description.trim() || f.subtotal === '' || Number.isNaN(Number(f.subtotal))) {
      setModalError(t('billing.invoiceRequiredFields'));
      return;
    }
    const app = applications.find(a => a.id === f.applicationId);
    setSubmitting(true);
    setModalError('');
    try {
      const result = await apiPost('/api/checkout', {
        action: 'issue-invoice',
        applicationId: f.applicationId || null,
        clientId: app?.client_id || null,
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
      closeModal();
      await load();
      if (result.alreadyExisted) setNotice(t('billing.invoiceAlreadyExisted'));
      else if (f.send && !result.emailSent) setNotice(t('billing.invoiceCreatedNoEmail'));
      else setNotice(t('billing.invoiceCreated'));
    } catch (err) {
      setModalError(err.message || t('billing.issueFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueReceipt = async () => {
    const f = receiptForm;
    if (!f.customerName.trim() || !(Number(f.amount) > 0)) {
      setModalError(t('billing.receiptRequiredFields'));
      return;
    }
    // Take the order/client reference off the invoice itself so the server-side
    // region scope check has something to resolve for a regional admin.
    const inv = invoices.find(i => i.id === f.invoiceId);
    setSubmitting(true);
    setModalError('');
    try {
      const result = await apiPost('/api/checkout', {
        action: 'issue-receipt',
        invoiceId: f.invoiceId || null,
        applicationId: inv?.application_id || null,
        clientId: inv?.client_id || null,
        customerName: f.customerName.trim(),
        amount: Number(f.amount),
        paymentMethod: f.paymentMethod || null,
        paymentDate: f.paymentDate || null,
        memo: f.memo.trim() || null,
        receiptNumber: f.receiptNumber.trim() || null,
        send: f.send,
      });
      closeModal();
      await load();
      setNotice(f.send && !result.emailSent
        ? t('billing.receiptCreatedNoEmail')
        : t('billing.receiptCreated'));
    } catch (err) {
      setModalError(err.message || t('billing.issueFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render -------------------------------------------------------------
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('adminBilling.title')}</h1>
          <p className="page-subtitle">{t('adminBilling.subtitle')}</p>
        </div>
        <div className="adbill__header-actions">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> {t('adminBilling.refresh')}
          </Button>
          <Button variant="primary" size="sm" onClick={openInvoiceModal}>
            <Plus size={14} /> {t('adminBilling.newInvoice')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openReceiptModal(null)} disabled={openInvoices.length === 0}>
            <Wallet size={14} /> {t('adminBilling.newReceipt')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="adbill__alert adbill__alert--error">
          <AlertCircle size={16} className="adbill__alert-icon" />
          <p>{error}</p>
        </div>
      )}
      {notice && (
        <div className="adbill__alert adbill__alert--info">
          <p>{notice}</p>
        </div>
      )}

      {/* Summary — computed from the rows already loaded, not a second source */}
      <div className="adbill__summary">
        <div className="adbill__stat adbill__stat--money">
          <span className="adbill__stat-label">{t('adminBilling.totalInvoiced')}</span>
          <span className="adbill__stat-value">{formatMoney(summary.invoiced, currency)}</span>
        </div>
        <div className="adbill__stat adbill__stat--money">
          <span className="adbill__stat-label">{t('adminBilling.totalPaid')}</span>
          <span className="adbill__stat-value">{formatMoney(summary.paid, currency)}</span>
        </div>
        <div className="adbill__stat adbill__stat--due">
          <span className="adbill__stat-label">{t('adminBilling.outstanding')}</span>
          <span className="adbill__stat-value">{formatMoney(summary.outstanding, currency)}</span>
        </div>
        <div className="adbill__stat">
          <span className="adbill__stat-label">{t('adminBilling.invoiceCount')}</span>
          <span className="adbill__stat-value">{summary.invoiceCount}</span>
        </div>
        <div className="adbill__stat">
          <span className="adbill__stat-label">{t('adminBilling.receiptCount')}</span>
          <span className="adbill__stat-value">{summary.receiptCount}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="adbill__tabs">
        <button
          className={`adbill__tab ${tab === TAB_INVOICES ? 'adbill__tab--active' : ''}`}
          onClick={() => setTab(TAB_INVOICES)}
        >
          <FileText size={16} /> {t('adminBilling.tabInvoices')} ({summary.invoiceCount})
        </button>
        <button
          className={`adbill__tab ${tab === TAB_RECEIPTS ? 'adbill__tab--active' : ''}`}
          onClick={() => setTab(TAB_RECEIPTS)}
        >
          <Receipt size={16} /> {t('adminBilling.tabReceipts')} ({summary.receiptCount})
        </button>
      </div>

      {/* Filters */}
      <div className="adbill__filters">
        <div className="adbill__search">
          <Search size={18} className="adbill__search-icon" />
          <input
            type="text"
            className="adbill__search-input"
            placeholder={t('adminBilling.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === TAB_INVOICES && (
          <select
            className="adbill__status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('adminBilling.allStatuses')}</option>
            {INVOICE_STATUSES.map(s => (
              <option key={s} value={s}>{t(`billing.status_${s}`)}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="adbill__loading">{t('common.loading')}</p>
      ) : tab === TAB_INVOICES ? (
        filteredInvoices.length === 0 ? (
          <div className="adbill__empty">
            <FileText size={48} color="var(--color-text-tertiary)" />
            <h3>{invoices.length === 0 ? t('adminBilling.noInvoices') : t('adminBilling.noMatches')}</h3>
            <p>{t('adminBilling.noInvoicesHint')}</p>
          </div>
        ) : (
          <div className="adbill__table-wrap">
            <table className="adbill__table">
              <thead>
                <tr>
                  <th>{t('adminBilling.colNumber')}</th>
                  <th>{t('adminBilling.colClient')}</th>
                  <th>{t('adminBilling.colDescription')}</th>
                  <th>{t('adminBilling.colIssued')}</th>
                  <th>{t('adminBilling.colDue')}</th>
                  <th>{t('adminBilling.colTotal')}</th>
                  <th>{t('adminBilling.colPaid')}</th>
                  <th>{t('adminBilling.colStatus')}</th>
                  <th>{t('adminBilling.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="adbill__strong">{inv.invoice_number}</td>
                    <td>
                      <div className="adbill__client">
                        <span className="adbill__client-name">{clientLabel(inv, inv.bill_to_name)}</span>
                        {inv.bill_to_email && <span className="adbill__client-sub">{inv.bill_to_email}</span>}
                      </div>
                    </td>
                    <td className="adbill__desc">{inv.description || '—'}</td>
                    <td>{formatDay(inv.issue_date)}</td>
                    <td>{formatDay(inv.due_date)}</td>
                    <td className="adbill__money">{formatMoney(inv.total, inv.currency)}</td>
                    <td className="adbill__money">{formatMoney(inv.amount_paid, inv.currency)}</td>
                    <td><StatusBadge status={inv.status} label={t(`billing.status_${inv.status}`, inv.status)} /></td>
                    <td>
                      <div className="adbill__row-actions">
                        <Button size="sm" variant="outline" onClick={() => handleDownload(inv)} disabled={!inv.storage_path}>
                          <Download size={14} /> {t('common.download')}
                        </Button>
                        {outstandingOf(inv) > 0 && inv.status !== 'cancelled' && (
                          <Button size="sm" variant="ghost" onClick={() => openReceiptModal(inv)}>
                            <Wallet size={14} /> {t('billing.recordPayment')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        filteredReceipts.length === 0 ? (
          <div className="adbill__empty">
            <Receipt size={48} color="var(--color-text-tertiary)" />
            <h3>{receipts.length === 0 ? t('adminBilling.noReceipts') : t('adminBilling.noMatches')}</h3>
            <p>{t('adminBilling.noReceiptsHint')}</p>
          </div>
        ) : (
          <div className="adbill__table-wrap">
            <table className="adbill__table">
              <thead>
                <tr>
                  <th>{t('adminBilling.rColNumber')}</th>
                  <th>{t('adminBilling.rColCustomer')}</th>
                  <th>{t('adminBilling.rColAmount')}</th>
                  <th>{t('adminBilling.rColMethod')}</th>
                  <th>{t('adminBilling.rColDate')}</th>
                  <th>{t('adminBilling.rColInvoice')}</th>
                  <th>{t('adminBilling.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map(rcp => (
                  <tr key={rcp.id}>
                    <td className="adbill__strong">{rcp.receipt_number}</td>
                    <td>{clientLabel(rcp, rcp.customer_name)}</td>
                    <td className="adbill__money">{formatMoney(rcp.amount, rcp.currency)}</td>
                    <td>{rcp.payment_method || '—'}</td>
                    <td>{formatDay(rcp.payment_date)}</td>
                    <td>{invoiceNumberById[rcp.invoice_id] || '—'}</td>
                    <td>
                      <Button size="sm" variant="outline" onClick={() => handleDownload(rcp)} disabled={!rcp.storage_path}>
                        <Download size={14} /> {t('common.download')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ---- New Invoice ---- */}
      <Modal isOpen={modal === 'invoice'} onClose={closeModal} title={t('billing.createInvoice')} size="lg">
        <div className="adbill__form">
          {modalError && (
            <div className="adbill__alert adbill__alert--error">
              <AlertCircle size={16} className="adbill__alert-icon" />
              <p>{modalError}</p>
            </div>
          )}

          <Input
            label={t('adminBilling.findApplication')}
            placeholder={t('adminBilling.findApplicationPlaceholder')}
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
          />
          <Select
            label={t('adminBilling.selectApplication')}
            value={invoiceForm.applicationId}
            onChange={(e) => handleApplicationChange(e.target.value)}
          >
            <option value="">{t('adminBilling.noApplicationLink')}</option>
            {pickableApplications.map(a => {
              const done = invoicedAppIds.has(a.id);
              const who = a.company_name || a.client?.company_name || a.client?.full_name || a.client?.email || a.id.slice(0, 8);
              return (
                <option key={a.id} value={a.id} disabled={done}>
                  {who}{a.recommended_iso ? ` — ${a.recommended_iso}` : ''}{done ? ` (${t('adminBilling.alreadyInvoiced')})` : ''}
                </option>
              );
            })}
          </Select>

          <div className="adbill__grid">
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
          <div className="adbill__grid">
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

          <label className="adbill__check">
            <input type="checkbox" checked={invoiceForm.send}
              onChange={(e) => setInvoiceForm(p => ({ ...p, send: e.target.checked }))} />
            {t('billing.sendByEmail')}
          </label>
          <p className="adbill__hint">{t('adminBilling.emailOptInHint')}</p>

          <div className="adbill__form-actions">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="primary" onClick={handleIssueInvoice} loading={submitting}>
              {t('billing.issueInvoice')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---- Record Payment ---- */}
      <Modal isOpen={modal === 'receipt'} onClose={closeModal} title={t('billing.recordPayment')} size="md">
        <div className="adbill__form">
          {modalError && (
            <div className="adbill__alert adbill__alert--error">
              <AlertCircle size={16} className="adbill__alert-icon" />
              <p>{modalError}</p>
            </div>
          )}

          <Select label={t('billing.againstInvoice')} value={receiptForm.invoiceId}
            onChange={(e) => handleReceiptInvoiceChange(e.target.value)}>
            <option value="">{t('billing.noInvoiceLink')}</option>
            {openInvoices.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_number} — {inv.bill_to_name} — {formatMoney(outstandingOf(inv), inv.currency)} {t('billing.outstandingSuffix')}
              </option>
            ))}
          </Select>

          <div className="adbill__grid">
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

          <label className="adbill__check">
            <input type="checkbox" checked={receiptForm.send}
              onChange={(e) => setReceiptForm(p => ({ ...p, send: e.target.checked }))} />
            {t('billing.sendByEmail')}
          </label>
          <p className="adbill__hint">{t('adminBilling.emailOptInHint')}</p>

          <div className="adbill__form-actions">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="primary" onClick={handleIssueReceipt} loading={submitting}>
              {t('billing.issueReceipt')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
