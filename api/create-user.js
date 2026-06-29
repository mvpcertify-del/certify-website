import { createClient } from '@supabase/supabase-js';
import { sendVerificationEmail } from './_sendVerificationEmail.js';
import { notifyAdmins } from './_notifyAdmins.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Unified user-creation endpoint.
// - Admin path (default): requires full_name + role, creates the user on
//   behalf of an admin (regional_admin, auditor, certification_body, client).
// - Self-signup path (selfSignup: true): public registration. Accepts name +
//   extended stakeholder metadata. Always sets email_confirm: true so the
//   user can log in immediately (or after approval for stakeholder flows).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      email, password, role, region, company_name,
      // admin-path field
      full_name,
      // self-signup-path fields
      selfSignup, name,
      activity, number_of_employees, number_of_locations,
      website, city, country, contact_number, contact_role,
      stakeholder_type, approval_status,
      custom_fields,
    } = req.body;

    const displayName = full_name || name;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Missing required fields: email, password, name' });
    }

    const isSelfSignup = !!selfSignup;
    const assignedRole = role || (isSelfSignup ? 'client' : null);

    if (!assignedRole) {
      return res.status(400).json({ error: 'Missing required field: role' });
    }

    const allowedRoles = isSelfSignup
      ? ['client', 'auditor', 'certification_body', 'referral']
      : ['regional_admin', 'auditor', 'certification_body', 'client', 'referral'];

    if (!allowedRoles.includes(assignedRole)) {
      return res.status(400).json({
        error: `Invalid role. Allowed: ${allowedRoles.join(', ')}`,
      });
    }

    // Build user_metadata. Self-signup carries extra stakeholder details.
    const userMetadata = isSelfSignup
      ? {
          name: displayName,
          role: assignedRole,
          company_name: company_name || null,
          activity: activity || null,
          number_of_employees: number_of_employees || null,
          number_of_locations: number_of_locations || null,
          website: website || null,
          city: city || null,
          country: country || null,
          region: region || null,
          contact_number: contact_number || null,
          contact_role: contact_role || null,
          stakeholder_type: stakeholder_type || 'client',
          approval_status: approval_status || 'approved',
        }
      : {
          name: displayName,
          role: assignedRole,
          company_name: company_name || null,
          region: region || null,
          // Admin-created clients may be a stakeholder variant (referral /
          // investor / consultancy). Only attach when creating a client.
          ...(assignedRole === 'client' && stakeholder_type
            ? { stakeholder_type }
            : {}),
        };

    // email_confirm: false makes Supabase Auth fire its Send Email Hook,
    // which we route to /api/auth-email-hook → Resend. Users must verify
    // their email before they can log in.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: userMetadata,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Upsert profile (the DB trigger may have already inserted a row).
    const profileRow = isSelfSignup
      ? {
          id: authData.user.id,
          email,
          full_name: displayName,
          role: assignedRole,
          company_name: company_name || null,
          region: region || null,
          stakeholder_type: stakeholder_type || 'client',
          approval_status: approval_status || 'approved',
          // Persist the contact number on the profile so WhatsApp notifications
          // can reach the user (it otherwise lives only in auth metadata).
          ...(contact_number ? { phone: contact_number } : {}),
          ...(custom_fields && typeof custom_fields === 'object' ? { custom_fields } : {}),
        }
      : {
          id: authData.user.id,
          email,
          full_name: displayName,
          role: assignedRole,
          region: region || null,
          company_name: company_name || null,
          ...(contact_number ? { phone: contact_number } : {}),
          ...(assignedRole === 'client' && stakeholder_type
            ? { stakeholder_type }
            : {}),
          ...(custom_fields && typeof custom_fields === 'object' ? { custom_fields } : {}),
        };

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      if (!isSelfSignup) {
        return res.status(500).json({
          error: 'User created but profile update failed: ' + profileError.message,
        });
      }
    }

    // Send the verification email ourselves via Resend.
    // We don't rely on Supabase's built-in email path because this project's
    // GoTrue email rate limit was throttled to 2/h after a historical bounce
    // spike — see plan Phase 6. generateLink + Resend bypasses that limit.
    let emailSendFailed = false;
    if (isSelfSignup) {
      const sendResult = await sendVerificationEmail({
        supabaseAdmin,
        email,
        password,
        name: displayName,
      });
      if (!sendResult.ok) {
        emailSendFailed = true;
        console.error('create-user: verification email send failed', sendResult);
      }
    }

    // Alert admins to the new client registration / lead (best-effort).
    // In the current funnel a registered email IS the lead, so this covers
    // both the "new lead" and "new registration" admin alerts.
    if (assignedRole === 'client') {
      await notifyAdmins(supabaseAdmin, {
        title: 'New registration',
        message: `${displayName} (${email})${company_name ? ` — ${company_name}` : ''} just registered.`,
        region: region || null,
      });
    }

    return res.status(200).json({
      success: true,
      emailSendFailed,
      user: {
        id: authData.user.id,
        email,
        full_name: displayName,
        role: assignedRole,
        region: region || null,
        company_name: company_name || null,
        ...(assignedRole === 'client' && stakeholder_type ? { stakeholder_type } : {}),
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
