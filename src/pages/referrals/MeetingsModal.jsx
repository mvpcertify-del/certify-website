import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import { Button, Select, Textarea } from '../../components/ui/FormElements';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MEETING_STAGES, stageLabel } from './meetingStages';

// The meeting log behind each client on the Clients screen (client, 28 Nov 2026: affiliates "update the results of
// the meetings in the CRM"). One entry per step: contacted, meeting booked, meeting held, and so on. The newest entry
// is the client's current stage and shows on the row. Rows live in referral_meetings (supabase/phase55): row-level
// security keeps a partner to their own clients, and super admins can see every log.
const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function MeetingsModal({ referral, onClose, onLatest }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('meeting_booked');
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!referral) return;
    const { data, error: e } = await supabase
      .from('referral_meetings')
      .select('id,stage,meeting_at,notes,created_at')
      .eq('referral_id', referral.id)
      .order('created_at', { ascending: false });
    if (e) setError(t('referrals.meetingsLoadFailed', 'The meeting log could not be loaded. Please try again.'));
    else { setItems(data || []); onLatest?.(referral.id, (data || [])[0] || null); }
    setLoading(false);
  }, [referral, onLatest, t]);

  // The parent remounts this with key=referral id, so the form starts clean for each client.
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setSaving(true); setError('');
    const { error: e } = await supabase.from('referral_meetings').insert({
      referral_id: referral.id,
      referrer_id: user.id,
      stage,
      meeting_at: when ? new Date(when).toISOString() : null,
      notes: notes.trim() || null,
    });
    if (e) setError(t('referrals.meetingsSaveFailed', 'The entry could not be saved. Please try again.'));
    else { setNotes(''); setWhen(''); await load(); }
    setSaving(false);
  };

  const remove = async (id) => {
    const { error: e } = await supabase.from('referral_meetings').delete().eq('id', id);
    if (e) setError(t('referrals.meetingsSaveFailed', 'The entry could not be saved. Please try again.'));
    else await load();
  };

  return (
    <Modal isOpen={Boolean(referral)} onClose={onClose} title={`${t('referrals.meetings', 'Meetings')}: ${referral?.referred_name || referral?.referred_email || ''}`}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Select label={t('referrals.meetingStage', 'Stage')} value={stage} onChange={(e) => setStage(e.target.value)}>
          {MEETING_STAGES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
        <label style={{ display: 'grid', gap: 6, fontSize: 14 }}>
          <span>{t('referrals.meetingWhen', 'Date and time (optional)')}</span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
        </label>
        <Textarea label={t('referrals.meetingNotes', 'Notes: what was agreed and the next step')} rows={3} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        {error && <div style={{ color: 'var(--color-danger)', fontSize: 14 }} role="alert">{error}</div>}
        <Button variant="primary" loading={saving} onClick={add}><Plus size={16} /> {t('referrals.meetingAdd', 'Add to log')}</Button>
      </div>

      <h4 style={{ margin: '22px 0 8px' }}>{t('referrals.meetingHistory', 'History')}</h4>
      {loading ? <p style={{ color: 'var(--color-text-secondary)' }}>…</p>
        : items.length === 0 ? <p style={{ color: 'var(--color-text-secondary)' }}>{t('referrals.meetingEmpty', 'Nothing logged yet.')}</p>
        : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {items.map((m) => (
              <li key={m.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <b>{stageLabel(m.stage)}</b>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}> · {m.meeting_at ? fmt(m.meeting_at) : fmt(m.created_at)}</span>
                  {m.notes && <div style={{ fontSize: 14, marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.notes}</div>}
                </div>
                <button type="button" onClick={() => remove(m.id)} aria-label={t('referrals.meetingDelete', 'Delete entry')}
                  style={{ background: 'none', border: 0, color: 'var(--color-text-tertiary)', cursor: 'pointer' }}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
    </Modal>
  );
}
