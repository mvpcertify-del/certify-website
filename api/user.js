import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from './_verifyAdmin.js';

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
