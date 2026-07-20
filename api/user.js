import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, verifySession } from './_verifyAdmin.js';
import {
  ContractError,
  getContractForPartner,
  getActiveTemplate,
  saveTemplate,
  acceptContract,
} from './_contract.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { sendWhatsApp } from './_notifyWhatsApp.js';
import { getRegionFromCountry } from '../src/utils/roles.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const url = req.url || '';
      const action = url.split('action=')[1]?.split('&')[0];
      if (action === 'get-meta') return await getMeta(req, res);
      return res.status(400).json({ error: 'Unknown GET action' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const action = req.body?.action;
    if (action === 'update-profile') return await updateProfile(req, res);
    if (action === 'update-role') return await updateRole(req, res);
    if (action === 'set-active') return await setActive(req, res);
    if (action === 'save-permission-override') return await savePermissionOverride(req, res);
    // Consultancy partner contracts (phase23). Folded in here rather than
    // added as api/contract.js — api/ is at exactly 12 non-underscore routes,
    // the Vercel Hobby ceiling, and a 13th breaks the deployment.
    if (action === 'get-contract') return await getContract(req, res);
    if (action === 'accept-contract') return await postAcceptContract(req, res);
    if (action === 'get-contract-template') return await getContractTemplate(req, res);
    if (action === 'save-contract-template') return await postSaveContractTemplate(req, res);
    if (action === 'consultancy-kpi') return await getConsultancyKpi(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('User route error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

async function updateProfile(req, res) {
  const {
    userId, full_name, role, company_name, region, email,
    stakeholder_type, approval_status,
    activity, number_of_employees, country, contact_number,
    custom_fields,
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (company_name !== undefined) updates.company_name = company_name;
  if (region !== undefined) updates.region = region;
  if (email !== undefined) updates.email = email;
  if (stakeholder_type !== undefined) updates.stakeholder_type = stakeholder_type;
  if (approval_status !== undefined) updates.approval_status = approval_status;
  if (custom_fields && typeof custom_fields === 'object') updates.custom_fields = custom_fields;
  // Country is now the primary geo field shown across the admin UI. Persist it,
  // and keep `region` in sync under the hood (RBAC scoping still runs on region)
  // by deriving it from the country whenever the caller didn't set region itself.
  // Only overwrite region when the country actually resolves to one — otherwise
  // an edit to an unmapped country would NULL a valid region and fail the
  // regional-admin scoping open.
  if (country !== undefined) {
    updates.country = country;
    if (region === undefined) {
      const derived = getRegionFromCountry(country);
      if (derived) updates.region = derived;
    }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (email) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { email });
  }

  const metaUpdates = {};
  if (full_name !== undefined) metaUpdates.name = full_name;
  if (company_name !== undefined) metaUpdates.company_name = company_name;
  if (region !== undefined) metaUpdates.region = region;
  if (activity !== undefined) metaUpdates.activity = activity;
  if (number_of_employees !== undefined) metaUpdates.number_of_employees = number_of_employees;
  if (country !== undefined) metaUpdates.country = country;
  if (contact_number !== undefined) metaUpdates.contact_number = contact_number;

  if (Object.keys(metaUpdates).length > 0) {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: metaUpdates,
    });
  }

  return res.status(200).json({ success: true });
}

async function updateRole(req, res) {
  const { userId, newRole } = req.body;

  if (!userId || !newRole) {
    return res.status(400).json({ error: 'Missing required fields: userId, newRole' });
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { role: newRole },
  });

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  return res.status(200).json({ success: true });
}

// Activate / Deactivate a user account.
// Super-admin only. Flips profiles.is_active AND bans/unbans the auth user so a
// deactivated account cannot log in. Authorization is enforced HERE (not on the
// other actions) so the token-less OAuth profile bootstrap keeps working.
async function setActive(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { userId, isActive } = req.body;
  if (!userId || typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'Missing required fields: userId, isActive (boolean)' });
  }
  if (userId === auth.caller.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  // Block / restore login. ban_duration: 'none' lifts an existing ban.
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? 'none' : '876000h', // ~100 years = effectively permanent
  });
  if (authError) {
    return res.status(400).json({ error: `Status saved but login toggle failed: ${authError.message}` });
  }

  // Notify (best-effort): the affected user in-app + WhatsApp, and the admin team.
  try {
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, region, phone')
      .eq('id', userId)
      .maybeSingle();

    const who = target?.full_name || target?.email || 'A user';
    const userTitle = isActive ? 'Account reactivated' : 'Account deactivated';
    const userMessage = isActive
      ? 'Your CertifyCX account has been reactivated. You can log in again.'
      : 'Your CertifyCX account has been deactivated. Contact a CertifyCX administrator for help.';

    await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, type: 'system', title: userTitle, message: userMessage })
      .then(() => {}, (e) => console.error('setActive: notification insert failed', e?.message));

    if (target?.phone) {
      await sendWhatsApp({ to: target.phone, text: `${userTitle}: ${userMessage}` });
    }

    await notifyAdmins(supabaseAdmin, {
      title: userTitle,
      message: `${who} was ${isActive ? 'reactivated' : 'deactivated'} by an admin.`,
      region: target?.region || null,
    });
  } catch (e) {
    console.error('setActive: notify failed', e?.message);
  }

  return res.status(200).json({ success: true, is_active: isActive });
}

// Upsert / clear a role→permission override (custom_permissions table).
// Merged here from the former api/save-permission-override.js to stay within
// the Vercel Hobby 12-function limit. Called by AdminPermissions.jsx.
async function savePermissionOverride(req, res) {
  const { role, permission, enabled, updatedBy, clear } = req.body;

  if (!role || !permission) {
    return res.status(400).json({ error: 'role and permission are required' });
  }

  // `clear: true` removes the override so the baseline from roles.js applies.
  if (clear) {
    const { error } = await supabaseAdmin
      .from('custom_permissions')
      .delete()
      .eq('role', role)
      .eq('permission', permission);
    if (error) throw error;
    return res.status(200).json({ success: true, cleared: true });
  }

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean (or pass clear:true)' });
  }

  const { error } = await supabaseAdmin
    .from('custom_permissions')
    .upsert(
      {
        role,
        permission,
        enabled,
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'role,permission' }
    );

  if (error) throw error;
  return res.status(200).json({ success: true });
}

// ---------------------------------------------------------------------------
// Consultancy partner contracts (phase23)
// ---------------------------------------------------------------------------
// Shared error shape so a ContractError's own status/message reaches the client
// while anything unexpected stays generic.
function contractFailure(res, err, context) {
  if (err instanceof ContractError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`${context} failed:`, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// The partner's own view: current agreement + their signature, if any.
async function getContract(req, res) {
  const { caller, error, status } = await verifySession(req);
  if (error) return res.status(status).json({ error });

  try {
    const data = await getContractForPartner(
      supabaseAdmin, caller, req.body?.partnerType || 'consultancy',
    );
    return res.status(200).json(data);
  } catch (err) {
    return contractFailure(res, err, 'getContract');
  }
}

async function postAcceptContract(req, res) {
  const { caller, error, status } = await verifySession(req);
  if (error) return res.status(status).json({ error });

  try {
    const result = await acceptContract(supabaseAdmin, req.body, caller, req);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return contractFailure(res, err, 'acceptContract');
  }
}

// Admin: read the template for editing.
async function getContractTemplate(req, res) {
  const { error, status } = await verifyAdmin(req, { requireSuperAdmin: true });
  if (error) return res.status(status).json({ error });

  try {
    const template = await getActiveTemplate(supabaseAdmin, req.body?.partnerType || 'consultancy');
    return res.status(200).json({ template });
  } catch (err) {
    return contractFailure(res, err, 'getContractTemplate');
  }
}

// Admin: publish a new version. Never edits a signed version in place.
async function postSaveContractTemplate(req, res) {
  const { caller, error, status } = await verifyAdmin(req, { requireSuperAdmin: true });
  if (error) return res.status(status).json({ error });

  try {
    const result = await saveTemplate(supabaseAdmin, req.body, caller);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return contractFailure(res, err, 'saveContractTemplate');
  }
}

// Admin: the consultancy KPI board. The consultancy_kpi view is REVOKEd from
// anon/authenticated precisely so it can only be read here, behind this check —
// a view bypasses the RLS on profiles and referrals and would otherwise expose
// every partner's earnings.
async function getConsultancyKpi(req, res) {
  const { caller, error, status } = await verifyAdmin(req);
  if (error) return res.status(status).json({ error });

  let query = supabaseAdmin
    .from('consultancy_kpi')
    .select('*')
    .order('at_risk', { ascending: false })
    .order('total_paying_clients', { ascending: false });

  // A country admin sees only their own region, consistent with every other
  // admin list view. Fail closed when they have no region set.
  if (caller.role === 'regional_admin') {
    query = query.eq('region', caller.region || '__no_region__');
  }

  const { data, error: qErr } = await query;
  if (qErr) {
    console.error('getConsultancyKpi failed:', qErr);
    return res.status(500).json({ error: 'Could not load partner performance.' });
  }

  return res.status(200).json({ partners: data || [], target: 5 });
}

async function getMeta(req, res) {
  const url = req.url || '';
  const userId = url.split('userId=')[1]?.split('&')[0];
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;

  return res.status(200).json({
    user_metadata: data.user?.user_metadata || {},
  });
}
