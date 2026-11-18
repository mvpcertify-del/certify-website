import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/FormElements';
import { apiPost } from '../../lib/apiClient';
import '../auth/Auth.css';

// The unsubscribe link in the outreach emails. Opening the link changes nothing (mail scanners open links);
// the person presses the button, and only then is the address added to the do-not-email list.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [state, setState] = useState('ask'); // ask | done | invalid
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      const out = await apiPost('/api/notify-event', { action: 'outreach-unsubscribe', token });
      setState(out?.ok ? 'done' : 'invalid');
    } catch {
      setState('invalid');
    }
    setLoading(false);
  };

  if (state === 'done') {
    return (
      <div className="auth-form auth-form--login auth-form--compact">
        <div className="auth-form__success-icon"><CheckCircle size={48} /></div>
        <h2 className="auth-form__title">You are unsubscribed</h2>
        <p className="auth-form__subtitle">We will not email you again. Sorry to have bothered you.</p>
      </div>
    );
  }
  if (state === 'invalid' || !/^[0-9a-f]{32}$/i.test(token)) {
    return (
      <div className="auth-form auth-form--login auth-form--compact">
        <div className="auth-form__success-icon"><AlertCircle size={48} /></div>
        <h2 className="auth-form__title">This link is not valid</h2>
        <p className="auth-form__subtitle">It may have been used already or copied incorrectly. To stop our emails, reply to any of them with the word &quot;unsubscribe&quot;.</p>
      </div>
    );
  }
  return (
    <div className="auth-form auth-form--login auth-form--compact">
      <h2 className="auth-form__title">Unsubscribe from Certify.cx emails?</h2>
      <p className="auth-form__subtitle">You will not receive any more emails from us about ISO certification for your institution.</p>
      <Button type="button" variant="primary" size="lg" fullWidth loading={loading} onClick={confirm}>Yes, unsubscribe me</Button>
    </div>
  );
}
