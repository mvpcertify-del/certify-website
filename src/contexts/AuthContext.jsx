import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
          // Non-client stakeholder signups require admin approval, matching email signup
          const approvalStatus = needsRoleBootstrap
            ? (stakeholderType !== 'client' ? 'pending' : 'approved')
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
          await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
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
        if (mounted) setLoading(false);
      }
    };

    // 1. Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (mounted) setSession(currentSession);
      await loadPermissionOverrides();
      if (currentSession?.user) {
        fetchProfile(currentSession.user);
      } else {
        if (mounted) setLoading(false);
      }
    });

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (mounted) setSession(currentSession);
        if (currentSession?.user) {
          // If a new session comes in, ensure we are loading while fetching the profile
          if (mounted) setLoading(true);
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
      // Supabase returns this when the user hasn't confirmed their email yet
      if (error.message === 'Email not confirmed') {
        return {
          success: false,
          error: 'Please verify your email address before logging in. Check your inbox for the confirmation link.',
        };
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
          error: 'Your registration has been declined. Please contact support at mvpcertify@gmail.com for more information.',
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
    // Stakeholder registrations (via shareable links / landing page) require admin approval
    const needsApproval = !!stakeholder_type && stakeholder_type !== 'client';
    const approvalStatus = needsApproval ? 'pending' : 'approved';

    // Route signup through the service-role API. The user is created with
    // email_confirm: false so Supabase sends a verification email via SMTP.
    // Users must confirm their email before they can log in.
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

    // User must verify their email before they can log in.
    // Return emailVerification flag so the UI shows "check your email".
    // emailSendFailed=true means user is created but the verification email
    // didn't ship (Resend issue, etc.) — UI should offer a "resend" button.
    return {
      success: true,
      data: { user: createdUser },
      needsApproval,
      emailVerification: true,
      emailSendFailed: !!signupJson.emailSendFailed,
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
      [ROLES.SUPER_ADMIN]: '/admin/dashboard',
      [ROLES.REGIONAL_ADMIN]: '/admin/dashboard',
      [ROLES.AUDITOR]: '/auditor/dashboard',
      [ROLES.CERTIFICATION_BODY]: '/cert-body/dashboard',
      [ROLES.CLIENT]: '/client/dashboard',
      [ROLES.REFERRAL]: '/referrals',
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
