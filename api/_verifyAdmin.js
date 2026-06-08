import { createClient } from '@supabase/supabase-js';

// Shared service-role client for token verification + profile lookups.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify the caller's Supabase access token (sent as `Authorization: Bearer`)
 * and confirm they hold an admin role.
 *
 * Returns one of:
 *   { caller: { id, role, region } }                 — authorized
 *   { error: '<message>', status: 401 | 403 }         — rejected
 *
 * Options:
 *   requireSuperAdmin (default false) — when true, only `super_admin` passes.
 *                                       Otherwise super_admin OR regional_admin.
 *
 * The handler is responsible for turning a rejection into a JSON response, e.g.
 *   const auth = await verifyAdmin(req, { requireSuperAdmin: true });
 *   if (auth.error) return res.status(auth.status).json({ error: auth.error });
 */
export async function verifyAdmin(req, { requireSuperAdmin = false } = {}) {
  const header =
    req.headers?.authorization || req.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return { error: 'Unauthorized: missing access token', status: 401 };
  }

  // Validate the JWT against Supabase Auth.
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { error: 'Unauthorized: invalid or expired session', status: 401 };
  }

  // Read the authoritative role from the profile row (not from client claims).
  const { data: profile } = await supabaseAdmin
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
}

export { supabaseAdmin };
