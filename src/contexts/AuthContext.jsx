import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiPost } from '../lib/apiClient';
import { ROLES, getRegionFromCountryAsync, setCustomPermissionOverrides } from '../utils/roles';

// Fetch role×permission overrides and install them into the roles module so
// hasPermission() reflects runtime toggles everywhere in the app.
async function loadPermissionOverrides() {
  try {
    const { data, error } = await supabase
      .from('custom_permissions')
      .select('role, permission, enabled');
    if (error || !data) return;
    const map = {};
    for (const row of data) {
      if (!map[row.role]) map[row.role] = {};
      map[row.role][row.permission] = !!row.enabled;
    }
    setCustomPermissionOverrides(map);
  } catch {
    // Table may not exist yet (pre-migration) — fall back to baseline.
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------
  // Initialize Session
  // ---------------------------------------------------
  useEffect(() => {
    let mounted = true;
    // Becomes true once the very first profile load resolves. After that we
    // never flip the global `loading` flag again — see the auth listener below.
    let initialized = false;

    // Started NOW, not after the session resolves. Every authenticated page
    // used to wait on three requests in a row before rendering anything:
    // getSession, then this, then the profile read. This one depends on
    // neither of the others, so it runs alongside them and one full round trip
    // comes off the wait. fetchProfile still awaits it before clearing
    // `loading`, so the guarantee that permission overrides are installed
    // before the first authenticated render is unchanged.
    const overridesReady = loadPermissionOverrides();

    // If the visitor took the anonymous gap analysis before signing up, the
    // score is sitting in localStorage. Persist it into their profile the first
    // time we see them as a client without a saved score.
    const hydrateAnonGapScore = async (sessionUser, profile) => {
      if (!profile || profile.role !== 'client') return profile;
      if (profile.gap_analysis_score != null) return profile;
      let raw = null;
      try { raw = localStorage.getItem('gap_analysis_score_anon'); } catch { /* ignore */ }
      if (raw == null) return profile;
      const score = Number(raw);
      if (Number.isNaN(score)) return profile;
      const { error } = await supabase
        .from('profiles')
        .update({ gap_analysis_score: score })
        .eq('id', sessionUser.id);
      if (error) return profile;
      try { localStorage.removeItem('gap_analysis_score_anon'); } catch { /* ignore */ }
      // Mirror to the per-user cache key the dashboard reads as a fallback.
      try { localStorage.setItem(`gap_analysis_score_${sessionUser.id}`, String(score)); } catch { /* ignore */ }
      return { ...profile, gap_analysis_score: score };
    };

    // Helper to fetch profile
    const fetchProfile = async (sessionUser) => {
      try {
        let { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sessionUser.id)
          .maybeSingle();
        profile = await hydrateAnonGapScore(sessionUser, profile);

        // For OAuth users (e.g. Google), ensure profile has role and approval_status.
        // Also backfill full_name for existing Google users whose profile was
        // created with a missing or email-as-name value (the previous bug that
        // displayed "user@example.com" in place of the Google account name).
        const isGoogleOAuth = sessionUser.app_metadata?.provider === 'google';
        const meta = sessionUser.user_metadata || {};
        const googleName = meta.name || meta.full_name || '';
        const profileNameLooksBroken =
          !!profile &&
          (!profile.full_name ||
            profile.full_name.trim() === '' ||
            profile.full_name === sessionUser.email);
        const needsRoleBootstrap = profile && !profile.role && isGoogleOAuth;
        const needsNameBackfill = profile && isGoogleOAuth && profileNameLooksBroken && !!googleName;

        if (needsRoleBootstrap || needsNameBackfill) {
          // Read pending stakeholder context set before the OAuth redirect (e.g. /register/referral)
          let pendingType = null;
          try {
            pendingType = sessionStorage.getItem('pendingStakeholderType');
          } catch { /* sessionStorage may be unavailable */ }
          const stakeholderType = pendingType || profile.stakeholder_type || 'client';
          // All self-registered users (clients and stakeholders alike) are
          // approved on sign-up — email confirmation is the only login gate.
          const approvalStatus = needsRoleBootstrap
            ? 'approved'
            : profile.approval_status;
          const payload = {
            action: 'update-profile',
            userId: sessionUser.id,
            full_name: googleName || profile.full_name || '',
          };
          if (needsRoleBootstrap) {
            payload.role = 'client';
            payload.company_name = null;
            payload.region = null;
            payload.stakeholder_type = stakeholderType;
            payload.approval_status = approvalStatus;
          }
          // Must carry the access token: /api/user verifies the caller and only
          // allows this one self-bootstrap (a profile with no role yet, moving
          // to 'client'). The Google session already exists by this point.
          await apiPost('/api/user', payload);
          try { sessionStorage.removeItem('pendingStakeholderType'); } catch { /* ignore */ }
          // Re-fetch profile after update
          let { data: updatedProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", sessionUser.id)
            .maybeSingle();
          // Now that the role is set, the anon gap-analysis score (if any)
          // can finally be hydrated into the profile.
          updatedProfile = await hydrateAnonGapScore(sessionUser, updatedProfile);
          if (updatedProfile && mounted) {
            setUser({ ...sessionUser, ...updatedProfile });
          } else if (mounted) {
            setUser(sessionUser);
          }
        } else if (profile && mounted) {
          setUser({ ...sessionUser, ...profile });
        } else if (mounted) {
          setUser(sessionUser); // Fallback if no profile yet
        }
      } catch (err) {
        console.error("Profile fetch error", err);
      } finally {
        // hasPermission() must already reflect the runtime overrides by the
        // time a route renders, so the two run in parallel but this one waits.
        await overridesReady;
        if (mounted) setLoading(false);
        initialized = true;
      }
    };

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) setSession(currentSession);
      if (currentSession?.user) {
        fetchProfile(currentSession.user);
      } else {
        // Signed out: nothing is permission-gated, so don't hold the public
        // pages behind the overrides request.
        if (mounted) setLoading(false);
      }
    });

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (mounted) setSession(currentSession);
        if (currentSession?.user) {
          // Refresh the profile in the background. We only show the full-screen
          // `loading` state for the FIRST resolution. Supabase fires this
          // listener with TOKEN_REFRESHED every time the browser tab regains
          // focus; flipping `loading` there would unmount the whole app via
          // <ProtectedRoute> and wipe any open form (e.g. the CB add/edit modal),
          // which looked to users like an unexpected logout / lost data.
          if (mounted && !initialized) setLoading(true);
          fetchProfile(currentSession.user);
        } else {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ---------------------------------------------------
  // Auth actions
  // ---------------------------------------------------

  const signInWithGoogle = async (redirectPath = '/auth/callback', stakeholderType = null) => {
    // Persist stakeholder context so it survives the OAuth round-trip and
    // can be applied when the new profile is provisioned on return.
    try {
      if (stakeholderType) {
        sessionStorage.setItem('pendingStakeholderType', stakeholderType);
      } else {
        sessionStorage.removeItem('pendingStakeholderType');
      }
    } catch { /* sessionStorage may be unavailable */ }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${redirectPath}`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Email verification was removed (client, 25 Jul). New users are created
      // already-confirmed, so this error should no longer occur — but if a
      // legacy unconfirmed account still trips it (before the one-time backfill
      // runs), do NOT block them for verification: surface a generic sign-in
      // failure instead of sending them to look for a link that never comes.
      if (error.message === 'Email not confirmed') {
        return { success: false, error: 'Could not sign you in. Please check your details and try again.' };
      }
      return { success: false, error: error.message };
    }

    // Check approval_status from profile before allowing login
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('approval_status, is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Your account has been deactivated. Please contact a CertifyCX administrator.',
        };
      }

      if (profile?.approval_status === 'pending') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Your registration is pending approval. A CertifyCX administrator will review and verify your account shortly.',
        };
      }

      if (profile?.approval_status === 'rejected') {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Your registration has been declined. Please contact support at support@certify.cx for more information.',
        };
      }
    }

    return { success: true, data };
  };

  const signup = async ({
    name, email, password,
    company_name, activity, number_of_employees,
    number_of_locations, website, city, country,
    contact_number, contact_role, certification_types,
    referral_code, role, stakeholder_type,
    custom_fields,
  }) => {
    const region = await getRegionFromCountryAsync(country, supabase);
    const assignedRole = role || ROLES.CLIENT;
    // Client rule: auditors, affiliates/referrals, CBs and consultancies can log
    // in as soon as they finish registering and confirm their email — there is
    // no separate admin-approval gate. Email verification (email_confirm:false
    // on the created user) is the only barrier to first login.
    //
    // Contractor is the one exception (client, 28 Oct — "Each approved
    // contractor will have access to the dashboard"): self-registration
    // uploads documents and signs the agreement, but login() itself refuses
    // a 'pending' profile until a Super Admin approves it.
    const needsApproval = assignedRole === ROLES.CONTRACTOR;
    const approvalStatus = needsApproval ? 'pending' : 'approved';

    // Route signup through the service-role API. The user is created already
    // confirmed — email verification was removed (client, 25 Jul), so there is
    // no "check your email" step and the caller can sign in immediately.
    const signupRes = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selfSignup: true,
        email, password, name, role: assignedRole,
        company_name, activity,
        number_of_employees, number_of_locations, website,
        city, country, region, contact_number, contact_role,
        stakeholder_type: stakeholder_type || 'client',
        approval_status: approvalStatus,
        custom_fields: custom_fields || null,
      }),
    });
    const signupJson = await signupRes.json().catch(() => ({}));

    if (!signupRes.ok || !signupJson.success) {
      return { success: false, error: signupJson.error || 'Signup failed' };
    }

    const createdUser = signupJson.user;

    // Record referral if user signed up via a referral link (non-blocking)
    if (referral_code && createdUser?.id) {
      fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record',
          referralCode: referral_code,
          referredId: createdUser.id,
          referredEmail: email,
        }),
      }).catch(() => {});
    }

    // No verification step. The caller signs in right after this returns (see
    // SignUp.jsx). needsApproval stays for the pay-first client path, which is
    // a separate admin gate, not email verification.
    return {
      success: true,
      data: { user: createdUser },
      needsApproval,
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const getRoleDashboard = (role) => {
    const map = {
      // Super Admin lands on the new Main Dashboard overview first; the
      // Certification dashboard remains one click away in the sidebar.
      [ROLES.SUPER_ADMIN]: '/main-dashboard',
      [ROLES.REGIONAL_ADMIN]: '/admin/dashboard',
      [ROLES.AUDITOR]: '/auditor/dashboard',
      [ROLES.CERTIFICATION_BODY]: '/cert-body/dashboard',
      [ROLES.CLIENT]: '/client/dashboard',
      // Partners land on the Referral Program Dashboard from 6 Sep — the box
      // grid the client asked for, mirroring the Super Admin above. The client
      // list they used to land on is one box away.
      [ROLES.REFERRAL]: '/referral-dashboard',
      [ROLES.CONSULTANCY]: '/referral-dashboard',
      // Lands on their contract (phase42, 28 Oct) — the first thing a newly
      // approved contractor needs to do is review and sign it. Full KPI/task
      // dashboard is a later phase.
      [ROLES.CONTRACTOR]: '/contractor/contract',
    };
    return map[role] || '/dashboard';
  };

  // ---------------------------------------------------
  // Context value
  // ---------------------------------------------------
  const refreshPermissions = async () => {
    await loadPermissionOverrides();
    // Bump a state field so consumers reading hasPermission() re-render.
    setUser(u => (u ? { ...u } : u));
  };

  const value = {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    login,
    signup,
    signInWithGoogle,
    logout,
    resetPassword,
    updatePassword,
    getRoleDashboard,
    refreshPermissions,
    supabase,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
