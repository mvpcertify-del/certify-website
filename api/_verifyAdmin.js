import { createClient } from '@supabase/supabase-js';

// Lazily create the service-role client INSIDE a function (not at module top
// level). If an env var is missing, the throw happens when a handler calls
// getAdmin() — inside its try/catch — so the caller returns readable JSON
// instead of crashing the whole function (Vercel FUNCTION_INVOCATION_FAILED).
let _admin = null;
export function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Server misconfigured: missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  _admin = createClient(url, key);
  return _admin;
}

/**
 * Verify the caller's Supabase access token and return who they are, WITHOUT
 * requiring an admin role. Use for actions a signed-in user performs on their
 * own behalf — e.g. a consultancy partner accepting their contract.
 *
 * The identity comes from the verified token, never from the request body, so
 * a caller cannot act as somebody else by editing the payload.
 *
 * Returns:
 *   { caller: { id, role, region, stakeholder_type, approval_status } }
 *   { error: '<message>', status: 401|500 }
 */
export async function verifySession(req) {
  try {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return { error: 'Unauthorized: missing access token', status: 401 };
    }

    const admin = getAdmin();

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return { error: 'Unauthorized: invalid or expired session', status: 401 };
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, region, stakeholder_type, approval_status')
      .eq('id', userData.user.id)
      .maybeSingle();

    return {
      caller: {
        id: userData.user.id,
        role: profile?.role || null,
        region: profile?.region || null,
        stakeholder_type: profile?.stakeholder_type || null,
        approval_status: profile?.approval_status || null,
      },
    };
  } catch (err) {
    return { error: `Auth check failed: ${err.message}`, status: 500 };
  }
}

/**
 * Verify the caller's Supabase access token (Authorization: Bearer) and confirm
 * they hold an admin role.
 *
 * Returns:
 *   { caller: { id, role, region } }            — authorized
 *   { error: '<message>', status: 401|403|500 } — rejected
 *
 * Options: requireSuperAdmin (default false) — when true, only super_admin passes.
 * Never throws; a config/network failure is returned as { error, status: 500 }.
 */
export async function verifyAdmin(req, { requireSuperAdmin = false } = {}) {
  try {
    const header =
      req.headers?.authorization || req.headers?.Authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return { error: 'Unauthorized: missing access token', status: 401 };
    }

    const admin = getAdmin();

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return { error: 'Unauthorized: invalid or expired session', status: 401 };
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, region')
      .eq('id', userData.user.id)
      .maybeSingle();

    const role = profile?.role || null;
    const isSuper = role === 'super_admin';
    const isRegional = role === 'regional_admin';

    if (requireSuperAdmin && !isSuper) {
      return { error: 'Forbidden: super admin access required', status: 403 };
    }
    if (!isSuper && !isRegional) {
      return { error: 'Forbidden: admin access required', status: 403 };
    }

    return { caller: { id: userData.user.id, role, region: profile?.region || null } };
  } catch (err) {
    return { error: `Auth check failed: ${err.message}`, status: 500 };
  }
}

// Can `caller` act on `target` (deactivate / delete / re-role)?
//
// A super admin may act on anyone. A regional (country) admin may act ONLY on
// a non-admin user inside their own region — the model the client asked for on
// 25 Jul ("a country admin manages the users in their country"). Fails closed
// on a null caller region, and never lets a regional admin touch a super_admin
// or another regional_admin. Self-checks are the caller's responsibility (they
// carry their own message).
//
// Shared here so api/user.js (deactivate, re-role) and _deleteUser.js apply
// the exact same rule and cannot drift apart.
const _ADMIN_ROLES = ['super_admin', 'regional_admin'];

export function callerCanManageTarget(caller, target) {
  if (!caller || !target) return false;
  if (caller.role === 'super_admin') return true;
  if (caller.role === 'regional_admin') {
    return !!caller.region
      && target.region === caller.region
      && !_ADMIN_ROLES.includes(target.role);
  }
  return false;
}
