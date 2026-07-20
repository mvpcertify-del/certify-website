import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from './_verifyAdmin.js';
import { stampEffectiveDate } from './_contract.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, action } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ error: 'Missing userId or action' });
    }

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approved" or "rejected"' });
    }

    // Verify the admin making the request against their session token, not
    // against a body field. The previous check ran only `if (adminId)`, so
    // omitting adminId skipped authorisation entirely and let anyone approve
    // (or reject) any registration with a single request.
    const { caller, error: authError, status: authStatus } = await verifyAdmin(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const approvedAt = new Date().toISOString();

    // Update the approval_status
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        approval_status: action,
        approved_by: caller.id,
        approved_at: approvedAt,
      })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // A consultancy's contract is "effective from date of approval by Certify.cx
    // Administrator" (client, 21 Jul). A partner who signed before being
    // approved has an acceptance with no dates; this is the moment they are
    // known, so fill them in and start the 12-month term. Best-effort: the
    // approval itself must not fail because of this.
    if (action === 'approved') {
      try {
        await stampEffectiveDate(supabaseAdmin, userId, approvedAt);
      } catch (e) {
        console.error('stampEffectiveDate failed:', e?.message);
      }
    }

    // Fetch user info for notification
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, stakeholder_type')
      .eq('id', userId)
      .maybeSingle();

    // Create notification for the user
    const notifTitle = action === 'approved'
      ? 'Registration Approved'
      : 'Registration Declined';
    const notifMessage = action === 'approved'
      ? 'Your CertifyCX registration has been approved! You can now log in and access your dashboard.'
      : 'Your CertifyCX registration has been declined. Please contact support at mvpcertify@gmail.com for more information.';

    await supabaseAdmin.from('notifications').insert([{
      user_id: userId,
      type: 'system',
      title: notifTitle,
      message: notifMessage,
    }]);

    return res.status(200).json({
      success: true,
      action,
      user: userProfile?.full_name || userId,
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
