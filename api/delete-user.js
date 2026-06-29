import { verifyAdmin, getAdmin } from './_verifyAdmin.js';
import { notifyAdmins } from './_notifyAdmins.js';

// ---------------------------------------------------------------------------
// Why deletion failed before:
//   profiles.id REFERENCES auth.users(id) has NO ON DELETE CASCADE, and ~15
//   tables reference the user (profiles.id / auth.users.id) with default
//   NO ACTION. If those references aren't cleared first, the profile delete and
//   then auth.admin.deleteUser fail.
//
//   The frontend also used to blow up parsing Vercel's plain-text 500
//   ("A server error has occurred" / FUNCTION_INVOCATION_FAILED). That was a
//   crash/timeout: the cleanup ran ~20 DB calls SEQUENTIALLY, which can exceed
//   the function time limit. We now run all independent cleanup in PARALLEL.
//
// Strategy:
//   - Ownership/authorship columns (created_by, updated_by, auditor_id,
//     approved_by, assigned_*_id, uploaded_by) -> NULL (preserve records).
//   - Rows the user owns as client/subject -> deleted.
//   - All of the above run concurrently (Promise.allSettled, never rejects).
//   - Then delete the profile row, then the auth user (authoritative step).
//
// Application-scoped children (ordering matters):
//   `reports`, `documents`, `payments`, `coupon_redemptions` all FK to
//   applications(id) with NO cascade. The user's own rows are cleared above by
//   client_id, BUT `reports` has no client_id — it links to the application via
//   application_id only. So deleting the user's applications hits
//   reports_application_id_fkey. We therefore fetch the user's application ids
//   and delete every application-scoped child by application_id FIRST, then the
//   applications themselves. (`certificates` is ON DELETE CASCADE — no action.)
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Authorization: only a super admin may delete a user account.
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

    const admin = getAdmin();

    // Capture who we're deleting BEFORE the rows are gone, so we can alert
    // admins afterwards with a meaningful message.
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('full_name, email, role, region')
      .eq('id', userId)
      .maybeSingle();

    // Run every independent cleanup concurrently. allSettled never rejects, so
    // a missing table / already-gone row can't abort the batch or crash us.
    const cleanups = [
      ['profiles.approved_by', admin.from('profiles').update({ approved_by: null }).eq('approved_by', userId)],
      ['applications.assigned_auditor_id', admin.from('applications').update({ assigned_auditor_id: null }).eq('assigned_auditor_id', userId)],
      ['applications.assigned_cb_id', admin.from('applications').update({ assigned_cb_id: null }).eq('assigned_cb_id', userId)],
      ['certification_bodies.created_by', admin.from('certification_bodies').update({ created_by: null }).eq('created_by', userId)],
      ['accreditation_bodies.created_by', admin.from('accreditation_bodies').update({ created_by: null }).eq('created_by', userId)],
      ['discount_coupons.created_by', admin.from('discount_coupons').update({ created_by: null }).eq('created_by', userId)],
      ['custom_application_fields.created_by', admin.from('custom_application_fields').update({ created_by: null }).eq('created_by', userId)],
      ['custom_user_fields.created_by', admin.from('custom_user_fields').update({ created_by: null }).eq('created_by', userId)],
      ['custom_permissions.updated_by', admin.from('custom_permissions').update({ updated_by: null }).eq('updated_by', userId)],
      ['documents.uploaded_by', admin.from('documents').update({ uploaded_by: null }).eq('uploaded_by', userId)],
      ['cb_documents.uploaded_by', admin.from('cb_documents').update({ uploaded_by: null }).eq('uploaded_by', userId)],
      ['reports.auditor_id', admin.from('reports').update({ auditor_id: null }).eq('auditor_id', userId)],
      ['notifications', admin.from('notifications').delete().eq('user_id', userId)],
      ['sara_leads', admin.from('sara_leads').delete().eq('user_id', userId)],
      ['coupon_redemptions', admin.from('coupon_redemptions').delete().eq('client_id', userId)],
      ['payments', admin.from('payments').delete().eq('client_id', userId)],
      ['documents(client)', admin.from('documents').delete().eq('client_id', userId)],
      ['referrals(referrer)', admin.from('referrals').delete().eq('referrer_id', userId)],
      ['referrals(referred)', admin.from('referrals').delete().eq('referred_id', userId)],
    ];

    const results = await Promise.allSettled(cleanups.map(([, p]) => p));
    results.forEach((r, i) => {
      const label = cleanups[i][0];
      if (r.status === 'rejected') {
        console.warn(`[delete-user] ${label} threw:`, r.reason?.message || r.reason);
      } else if (r.value?.error) {
        console.warn(`[delete-user] ${label}:`, r.value.error.message);
      }
    });

    // Application-scoped children must go before the applications themselves.
    // `reports` is the one that breaks otherwise (it links via application_id,
    // not client_id, so it isn't cleared by the client_id sweep above).
    const { data: ownedApps } = await admin
      .from('applications')
      .select('id')
      .eq('client_id', userId);
    const appIds = (ownedApps || []).map(a => a.id);

    if (appIds.length > 0) {
      const childCleanups = [
        ['reports(by application)', admin.from('reports').delete().in('application_id', appIds)],
        ['documents(by application)', admin.from('documents').delete().in('application_id', appIds)],
        ['payments(by application)', admin.from('payments').delete().in('application_id', appIds)],
        ['coupon_redemptions(by application)', admin.from('coupon_redemptions').delete().in('application_id', appIds)],
      ];
      const childResults = await Promise.allSettled(childCleanups.map(([, p]) => p));
      childResults.forEach((r, i) => {
        const label = childCleanups[i][0];
        if (r.status === 'rejected') {
          console.warn(`[delete-user] ${label} threw:`, r.reason?.message || r.reason);
        } else if (r.value?.error) {
          console.warn(`[delete-user] ${label}:`, r.value.error.message);
        }
      });

      // Now the applications can be removed without tripping a child FK.
      const { error: appsError } = await admin.from('applications').delete().in('id', appIds);
      if (appsError) {
        return res.status(409).json({
          error: `Could not delete applications (a record still references them): ${appsError.message}`,
        });
      }
    }

    // Delete the profile row.
    const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
    if (profileError) {
      return res.status(409).json({
        error: `Could not delete profile (a record still references this user): ${profileError.message}`,
      });
    }

    // Delete the auth user — authoritative step.
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      return res.status(400).json({ error: `Failed to delete auth user: ${authError.message}` });
    }

    // Alert admins that an account was removed (best-effort, after the fact).
    const who = targetProfile?.full_name || targetProfile?.email || 'A user';
    await notifyAdmins(admin, {
      title: 'User deleted',
      message: `${who}${targetProfile?.role ? ` (${targetProfile.role})` : ''} was deleted by an admin.`,
      region: targetProfile?.region || null,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
