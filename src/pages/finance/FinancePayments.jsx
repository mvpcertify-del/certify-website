import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { Button, Textarea } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import './FinancePayments.css';

// Finance's approval queue (phase44, 28 Oct) — the second of the two
// required approval steps for a contractor payment. An admin already raised
// the request (api/_contractorPayments.js); this screen is purely "approve
// the money or don't" — Finance never authors or edits the amount.
export default function FinancePayments() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [rejecting, setRejecting] = useState(null); // payment object
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPost('/api/user', { action: 'list-contractor-payments' });
      setPayments(res?.payments || []);
    } catch (e) {
      setError(e?.message || 'Could not load payment requests.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const approve = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await apiPost('/api/user', { action: 'approve-contractor-payment', paymentId });
      await fetchPayments();
    } catch (e) {
      setError(e?.message || 'Could not approve this request.');
    }
    setActionLoading(null);
  };

  const openReject = (payment) => {
    setRejecting(payment);
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    setActionLoading(rejecting.id);
    try {
      await apiPost('/api/user', { action: 'reject-contractor-payment', paymentId: rejecting.id, rejectionReason });
      setRejecting(null);
      await fetchPayments();
    } catch (e) {
      setError(e?.message || 'Could not reject this request.');
    }
    setActionLoading(null);
  };

  return (
    <div className="finpay">
      <h1>{t('financePayments.title', 'Payment Approvals')}</h1>
      <p className="finpay__subtitle">
        {t('financePayments.subtitle', 'Contractor payment requests awaiting Finance approval.')}
      </p>

      {error && <div className="finpay__error">{error}</div>}

      {loading ? <p>{t('common.loading')}</p> : payments.length === 0 ? (
        <p className="finpay__empty">{t('financePayments.none', 'No payment requests waiting.')}</p>
      ) : (
        <div className="finpay__list">
          {payments.map((p) => (
            <div key={p.id} className="finpay__card">
              <div className="finpay__top">
                <span className="finpay__amount">{p.currency} {Number(p.amount).toLocaleString()}</span>
                <span className="finpay__pill"><Clock size={13} /> {t('financePayments.pending', 'Pending')}</span>
              </div>
              <p className="finpay__desc">{p.description}</p>
              <p className="finpay__meta">{t('financePayments.requested', 'Requested')} {new Date(p.created_at).toLocaleDateString()}</p>
              <div className="finpay__actions">
                <Button size="sm" loading={actionLoading === p.id} onClick={() => approve(p.id)}>
                  <CheckCircle2 size={14} /> {t('financePayments.approve', 'Approve')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openReject(p)}>
                  <XCircle size={14} /> {t('financePayments.reject', 'Reject')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!rejecting} onClose={() => setRejecting(null)} title={t('financePayments.rejectTitle', 'Reject Payment Request')}>
        <div className="finpay__form">
          <Textarea
            label={t('financePayments.reasonLabel', 'Reason (shown to the contractor)')}
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <Button loading={actionLoading === rejecting?.id} onClick={confirmReject} fullWidth>
            {t('financePayments.confirmReject', 'Confirm Rejection')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
