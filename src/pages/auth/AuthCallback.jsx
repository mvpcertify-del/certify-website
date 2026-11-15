import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SignupCodeStep from '../../components/auth/SignupCodeStep';
import { OAUTH_GATE_KEY, oauthGateActive } from '../../config/loginMode';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import { PENDING_CHECKOUT_KEY } from '../public/StartCheckout';

// Read a pending checkout intent (set by /start-checkout) and resolve it into
// a navigation target. Returns null if there's nothing pending or malformed.
// Post-payment-first flow: forward to /client/start-payment which creates the
// stub application row and hands off to Stripe checkout.
function consumePendingCheckout() {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    const { iso, staff, locations } = JSON.parse(raw);
    const params = new URLSearchParams({
      iso: iso || 'iso-9001',
    });
    // Carry the extra-staff / extra-locations selection through the OAuth hop.
    if (staff) params.set('staff', String(staff));
    if (locations) params.set('locations', String(locations));
    return { path: `/client/start-payment?${params.toString()}` };
  } catch {
    return null;
  }
}

function ProviderCallback() {
  const { user, loading, getRoleDashboard, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Stakeholder registrations (referral/investor/consultancy) require admin approval.
      // Sign the user out and send them to login with a clear message so they aren't
      // dropped on a dashboard they can't use.
      if (user.approval_status === 'pending') {
        logout().finally(() => {
          navigate('/login?pending=1', { replace: true });
        });
        return;
      }
      if (user.approval_status === 'rejected') {
        logout().finally(() => {
          navigate('/login?rejected=1', { replace: true });
        });
        return;
      }

      // Honour a pending /start-checkout intent — clients only.
      if (user.role === ROLES.CLIENT) {
        const pending = consumePendingCheckout();
        if (pending) {
          navigate(pending.path, { replace: true });
          return;
        }
      }
      navigate(getRoleDashboard(user.role), { replace: true });
    } else if (!loading && !user) {
      // OAuth failed or was cancelled
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate, getRoleDashboard, logout]);

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <div className="auth-callback-spinner" />
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
        Signing you in...
      </p>
    </div>
  );
}

// Code login is on: Google / LinkedIn only proves who the person is. The provider session is dropped here
// and nobody is signed in (or registered) until they type the code emailed to the address the provider
// confirmed. Typing it creates the real session, and the callback above then takes over.
function CodeGate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { supabase, requestLoginOtp, verifyLoginOtp } = useAuth();
  const [phase, setPhase] = useState('connecting'); // connecting | code | done
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      let session = null;
      for (let i = 0; i < 40 && !session && !off; i += 1) {
        ({ data: { session } } = await supabase.auth.getSession());
        if (!session) await new Promise((r) => setTimeout(r, 250));
      }
      if (off) return;
      const address = session?.user?.email;
      if (!address) {
        try { sessionStorage.removeItem(OAUTH_GATE_KEY); } catch { /* ignore */ }
        navigate('/login', { replace: true });
        return;
      }
      setEmail(address);
      // The provider session alone must not be enough to get in.
      await supabase.auth.signOut({ scope: 'local' });
      const sent = await requestLoginOtp(address);
      if (off) return;
      if (!sent.success && !sent.rateLimited) setError(sent.error || '');
      setPhase('code');
    })();
    return () => { off = true; };
  }, [supabase, requestLoginOtp, navigate]);

  const verify = async (code) => {
    setError('');
    setLoading(true);
    // From here a real session is wanted, so the app may load (and, for a new person, create) the profile.
    try { sessionStorage.removeItem(OAUTH_GATE_KEY); } catch { /* ignore */ }
    const result = await verifyLoginOtp(email, code);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setPhase('done');
  };

  if (phase === 'done') return <ProviderCallback />;
  if (phase === 'connecting') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
        <div className="auth-callback-spinner" />
      </div>
    );
  }
  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        <div className="auth-layout__card">
          <div className="auth-form auth-form--login">
            <SignupCodeStep
              email={email}
              loading={loading}
              error={error}
              title={t('auth.oauthCodeTitle')}
              subtitle={t('auth.oauthCodeSubtitle', { email })}
              verifyLabel={t('auth.otpVerify')}
              onVerify={verify}
              onResend={() => requestLoginOtp(email)}
              onBack={() => { try { sessionStorage.removeItem(OAUTH_GATE_KEY); } catch { /* ignore */ } navigate('/login', { replace: true }); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  // Decided once, on arrival: the marker is cleared as soon as the code is typed.
  const [gated] = useState(() => oauthGateActive());
  return gated ? <CodeGate /> : <ProviderCallback />;
}
