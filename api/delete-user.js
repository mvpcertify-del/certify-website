import { verifyAdmin, supabaseAdmin } from './_verifyAdmin.js';

// Best-effort cleanup — runs each step independently and logs (but does not
// abort) on error, so a table that doesn't exist in a given environment, or a
// row that's already gone, never blocks the whole deletion.
async function tryStep(label, promise) {
  try {
    const { error } = await promise;
    if (error) console.warn(`[delete-user] ${label}:`, error.message);
  } catch (err) {
    console.warn(`[delete-user] ${label} threw:`, err?.message || err);
  }
}

// ---------------------------------------------------------------------------
// Why the previous version failed ("A server error has occurred" / JSON parse):
//   profiles.id REFERENCES auth.users(id) has NO ON DELETE CASCADE, and ~15
//   tables reference the user (profiles.id / auth.users.id) with default
//   NO ACTION. The old handler cleaned up only a handful, so for accounts that
//   own many rows (e.g. a Certification Body like "Bureau Veritas") the profile
//   delete and then auth.admin.deleteUser failed every time.
//
// Fix strategy:
//   - Ownership / authorship columns (created_by, updated_by, auditor_id,
//     approved_by, assigned_*_id, uploaded_by) are NULLED so historical
//     records are preserved.
//   - Rows that belong TO the user as a client/subject (their applications,
//     documents, payments, redemptions, referrals, notifications, leads) are
//     deleted.
//   - Then the profile row, then the auth user (authoritative step).
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Authorization: only a super admin may delete a user account.
    // Kept INSIDE the try so a transient auth-server error returns JSON
    // (not Vercel's plain-text 500 that breaks the client JSON parser).
    const auth = await verifyAdmin(req, { requireSuperAdmin: true });
    if (auth.error) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }
    if (userId === auth.caller.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    // 1a. Null out authorship/ownership references (preserve the records).
    await tryStep('profiles.approved_by -> null',
      supabaseAdmin.from('profiles').update({ approved_by: null }).eq('approved_by', userId));
    await tryStep('applications.assigned_auditor_id -> null',
      supabaseAdmin.from('applications').update({ assigned_auditor_id: null }).eq('assigned_auditor_id', userId));
    await tryStep('applications.assigned_cb_id -> null',
      supabaseAdmin.from('applications').update({ assigned_cb_id: null }).eq('assigned_cb_id', userId));
    await tryStep('certification_bodies.created_by -> null',
      supabaseAdmin.from('certification_bodies').update({ created_by: null }).eq('created_by', userId));
    await tryStep('accreditation_bodies.created_by -> null',
      supabaseAdmin.from('accreditation_bodies').update({ created_by: null }).eq('created_by', userId));
    await tryStep('discount_coupons.created_by -> null',
      supabaseAdmin.from('discount_coupons').update({ created_by: null }).eq('created_by', userId));
    await tryStep('custom_application_fields.created_by -> null',
      supabaseAdmin.from('custom_application_fields').update({ created_by: null }).eq('created_by', userId));
    await tryStep('custom_user_fields.created_by -> null',
      supabaseAdmin.from('custom_user_fields').update({ created_by: null }).eq('created_by', userId));
    await tryStep('custom_permissions.updated_by -> null',
      supabaseAdmin.from('custom_permissions').update({ updated_by: null }).eq('updated_by', userId));
    await tryStep('documents.uploaded_by -> null',
      supabaseAdmin.from('documents').update({ uploaded_by: null }).eq('uploaded_by', userId));
    await tryStep('cb_documents.uploaded_by -> null',
      supabaseAdmin.from('cb_documents').update({ uploaded_by: null }).eq('uploaded_by', userId));
    await tryStep('reports.auditor_id -> null',
      supabaseAdmin.from('reports').update({ auditor_id: null }).eq('auditor_id', userId));

    // 1b. Delete rows the user owns as client/subject.
    await tryStep('notifications delete',
      supabaseAdmin.from('notifications').delete().eq('user_id', userId));
    await tryStep('sara_leads delete',
      supabaseAdmin.from('sara_leads').delete().eq('user_id', userId));
    await tryStep('coupon_redemptions delete',
      supabaseAdmin.from('coupon_redemptions').delete().eq('client_id', userId));
    await tryStep('payments delete',
      supabaseAdmin.from('payments').delete().eq('client_id', userId));
    await tryStep('documents (as client) delete',
      supabaseAdmin.from('documents').delete().eq('client_id', userId));
    await tryStep('applications (as client) delete',
      supabaseAdmin.from('applications').delete().eq('client_id', userId));
    await tryStep('referrals (as referrer) delete',
      supabaseAdmin.from('referrals').delete().eq('referrer_id', userId));
    await tryStep('referrals (as referred) delete',
      supabaseAdmin.from('referrals').delete().eq('referred_id', userId));

    // 2. Delete the profile row.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileError) {
      // Surface this as a real error — if the profile can't go, the auth
      // delete will fail too, and we want a readable reason, not a crash.
      return res.status(409).json({
        error: `Could not delete profile (a record still references this user): ${profileError.message}`,
      });
    }

    // 3. Delete the auth user. This is the authoritative step.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      return res.status(400).json({
        error: `Failed to delete auth user: ${authError.message}`,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
