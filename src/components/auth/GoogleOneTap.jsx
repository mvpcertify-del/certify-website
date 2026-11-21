import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GOOGLE_CLIENT_ID } from '../../config/loginMode';

// Google One Tap: the small "Sign in to certify.cx with google.com / Continue as <name>" popup that Google shows
// for the account already signed in to the browser. It renders nothing itself. The Google token it returns is
// handed to Supabase (signInWithIdToken), then the person goes to /auth/callback, the same place the normal
// "Continue with Google" button ends, so the emailed-code step (when code login is on) and the profile checks
// are unchanged.

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    const s = existing || Object.assign(document.createElement('script'), { src: GSI_SRC, async: true, defer: true });
    s.addEventListener('load', resolve, { once: true });
    s.addEventListener('error', reject, { once: true });
    if (!existing) document.head.appendChild(s);
  });
}

const sha256Hex = async (text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
};

export default function GoogleOneTap({ stakeholderType = 'client' }) {
  const navigate = useNavigate();
  const { user, signInWithGoogleIdToken } = useAuth();
  const signedIn = !!user;
  const handler = useRef(signInWithGoogleIdToken);
  useEffect(() => { handler.current = signInWithGoogleIdToken; });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || signedIn) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await loadGsi();
        if (cancelled) return;
        // The nonce ties the Google token to this page load. Google gets the hash, Supabase gets the original.
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: await sha256Hex(nonce),
          use_fedcm_for_prompt: true,
          cancel_on_tap_outside: false,
          callback: async (response) => {
            const result = await handler.current(response.credential, nonce, stakeholderType);
            if (result.success) navigate('/auth/callback', { replace: true });
          },
        });
        window.google.accounts.id.prompt();
      } catch { /* blocked script or no network: the normal buttons still work */ }
    })();
    return () => { cancelled = true; try { window.google?.accounts?.id?.cancel(); } catch { /* ignore */ } };
  }, [signedIn, stakeholderType, navigate]);

  return null;
}
