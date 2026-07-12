import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import Modal from './ui/Modal';
import { Input, Textarea, Button } from './ui/FormElements';
import { apiPost } from '../lib/apiClient';
import './ConsultationModal.css';

// "Book a Consultation" popup. Shown after the gap-analysis test (and reusable
// anywhere). Public — no auth required. Submits to the book-consultation action
// on /api/checkout, which only alerts admins (never emails the requester).
export default function ConsultationModal({ isOpen, onClose, isoInterest = '' }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', preferredTime: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    // Reset so a reopened popup is fresh.
    setForm({ name: '', email: '', phone: '', company: '', preferredTime: '', message: '' });
    setError('');
    setDone(false);
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError(t('consultation.errName')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError(t('consultation.errEmail')); return; }

    setSubmitting(true);
    try {
      await apiPost('/api/checkout', {
        action: 'book-consultation',
        contact: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          preferredTime: form.preferredTime.trim(),
          message: form.message.trim(),
          isoInterest,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || t('consultation.errGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('consultation.title')} size="md">
      {done ? (
        <div className="consultation__done">
          <CheckCircle2 size={44} className="consultation__done-icon" />
          <h3>{t('consultation.successTitle')}</h3>
          <p>{t('consultation.successBody')}</p>
          <Button variant="primary" fullWidth onClick={close}>{t('common.close')}</Button>
        </div>
      ) : (
        <form className="consultation__form" onSubmit={handleSubmit}>
          <p className="consultation__intro">
            <CalendarClock size={16} /> {t('consultation.subtitle')}
          </p>

          {error && <div className="consultation__error">{error}</div>}

          <div className="consultation__grid">
            <Input label={t('consultation.name')} id="cons-name" value={form.name} onChange={setField('name')} required />
            <Input label={t('consultation.email')} id="cons-email" type="email" value={form.email} onChange={setField('email')} required />
            <Input label={t('consultation.phone')} id="cons-phone" value={form.phone} onChange={setField('phone')} />
            <Input label={t('consultation.company')} id="cons-company" value={form.company} onChange={setField('company')} />
          </div>

          <Input label={t('consultation.preferredTime')} id="cons-time" value={form.preferredTime} onChange={setField('preferredTime')} placeholder={t('consultation.preferredTimePlaceholder')} />
          <Textarea label={t('consultation.message')} id="cons-message" rows={3} value={form.message} onChange={setField('message')} />

          <div className="consultation__actions">
            <Button type="button" variant="secondary" onClick={close} disabled={submitting}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={submitting}>{t('consultation.submit')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
