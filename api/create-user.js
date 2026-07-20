import { createClient } from '@supabase/supabase-js';
import { sendVerificationEmail } from './_sendVerificationEmail.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { verifyAdmin } from './_verifyAdmin.js';
import { getRegionFromCountry, getCreatableRoles } from '../src/utils/roles.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Unified user-creation endpoint.
// - Admin path (default): requires full_name + role, creates the user on
//   behalf of an admin. Callers must present an admin Bearer token.
// - Self-signup path (selfSignup: true): public registration. Accepts name +
//   extended stakeholder metadata.
//
// Both paths create the user with email_confirm: false and then send the
// verification link themselves via generateLink + Resend (see
// _sendVerificationEmail.js). supabaseAdmin.auth.admin.createUser() does NOT
// send any email of its own — email_confirm: false only leaves
// auth.users.email_confirmed_at NULL. Skipping our own send is what previously
// left admin-created users permanently unable to log in.
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

    // The admin path mints privileged accounts (regional_admin, auditor, CB).
    // Without this it was an unauthenticated endpoint: anyone could POST
    // { role: 'regional_admin' } and grant themselves admin access. Self-signup
    // stays public by design — it is the registration form.
    let caller = null;
    if (!isSelfSignup) {
      const auth = await verifyAdmin(req);
      if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
      }
      caller = auth.caller;
    }

    const assignedRole = role || (isSelfSignup ? 'client' : null);

    // Country is the geo field captured across the admin UI now; derive the
    // region from it for RBAC scoping when the caller didn't pass a region.
    // A non-super admin only ever creates inside their OWN region — the admin UI
    // already forces this, but the body is attacker-controlled, so the clamp has
    // to live here or a regional admin could plant users in other regions.
    const resolvedRegion = caller && caller.role !== 'super_admin'
      ? caller.region
      : (region || (country ? getRegionFromCountry(country) : null) || null);

    // A regional admin's whole access model is region scoping. If we couldn't
    // resolve a region (unmapped / misspelled country), refuse rather than
    // create an admin with a null region who would see EVERY region.
    if (assignedRole === 'regional_admin' && !resolvedRegion) {
      return res.status(400).json({
        error: 'Could not determine a region from that country. Please enter a recognized country for a Regional Admin.',
      });
    }

    if (!assignedRole) {
      return res.status(400).json({ error: 'Missing required field: role' });
    }

    // On the admin path the RBAC matrix in roles.js is the single source of
    // truth, so the server enforces exactly what the UI offers (a super admin
    // can mint any role; a regional admin only auditors and CBs — not another
    // Country Admin, and not a referral with commission entitlements).
    const allowedRoles = isSelfSignup
      ? ['client', 'auditor', 'certification_body', 'referral', 'consultancy']
      : getCreatableRoles(caller.role);

    if (!allowedRoles.includes(assignedRole)) {
      return res.status(403).json({
        error: `Forbidden: your role cannot create a ${assignedRole}.`,
      });
    }

    // approval_status decides whether login is allowed, so it must never be
    // taken from the request body on the public self-signup path — that made it
    // forgeable with a single curl. Current product rule (client, 15 Jul):
    // everyone is approved on registration and email verification is the only
    // gate. Change this line — not the client — if the rule ever changes.
    const resolvedApprovalStatus = isSelfSignup
      ? 'approved'
      : (approval_status || 'approved');

    // stakeholder_type is the stable identifier the platform counts, filters and
    // prices on — it survived consultancy's role moving twice (client → referral
    // in phase19 → consultancy in phase22). It used to be attached only when the
    // role was `client`, which was fine while every stakeholder variant WAS a
    // client. It no longer is: an admin picking the Consultancy role would
    // otherwise create a row with stakeholder_type NULL, which is counted in no
    // dashboard box, missed by the ?stakeholder=consultancy filter, and — worst —
    // skipped by the 25% commission override, since that is keyed on
    // stakeholder_type. Roles that ARE a stakeholder type imply their own.
    const SELF_DESCRIBING_STAKEHOLDER_ROLES = ['consultancy', 'referral'];
    const resolvedStakeholderType = SELF_DESCRIBING_STAKEHOLDER_ROLES.includes(assignedRole)
      ? assignedRole
      : (assignedRole === 'client' ? (stakeholder_type || 'client') : null);

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
          region: resolvedRegion,
          contact_number: contact_number || null,
          contact_role: contact_role || null,
          stakeholder_type: stakeholder_type || 'client',
          approval_status: resolvedApprovalStatus,
        }
      : {
          name: displayName,
          role: assignedRole,
          company_name: company_name || null,
          country: country || null,
          region: resolvedRegion,
          ...(resolvedStakeholderType ? { stakeholder_type: resolvedStakeholderType } : {}),
        };

    // email_confirm: false leaves email_confirmed_at NULL — the user cannot log
    // in until they click the link we send below. createUser() itself sends
    // nothing; the send is ours (see the verification block further down).
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
          country: country || null,
          region: resolvedRegion,
          stakeholder_type: stakeholder_type || 'client',
          approval_status: resolvedApprovalStatus,
          // Persist the contact number on the profile so WhatsApp notifications
          // can reach the user (it otherwise lives only in auth metadata).
          ...(contact_number ? { phone: contact_number } : {}),
          // The registration form collects a city (affiliates especially) — it
          // has to land on the profile, not just in auth metadata, or the
          // profile page and the admin lists show it blank.
          ...(city ? { city } : {}),
          ...(custom_fields && typeof custom_fields === 'object' ? { custom_fields } : {}),
        }
      : {
          id: authData.user.id,
          email,
          full_name: displayName,
          role: assignedRole,
          country: country || null,
          region: resolvedRegion,
          company_name: company_name || null,
          ...(contact_number ? { phone: contact_number } : {}),
          ...(city ? { city } : {}),
          ...(resolvedStakeholderType ? { stakeholder_type: resolvedStakeholderType } : {}),
          ...(custom_fields && typeof custom_fields === 'object' ? { custom_fields } : {}),
        };

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileRow, { onConflict: 'id' });

    // This upsert is the ONLY writer of the profiles row — there is no DB
    // trigger backstop. Without a profile the user has no role, so every route
    // locks them out; the account is unusable either way. Fail loudly on BOTH
    // paths and remove the orphaned auth user, otherwise the address is burned
    // (a retry hits "already registered") and self-signup would report success
    // while quietly creating a ghost account. This is how an unrun migration
    // turns into an invisible outage.
    if (profileError) {
      console.error('Profile upsert error:', profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch((delErr) => {
        console.error('Failed to clean up orphaned auth user:', delErr);
      });
      return res.status(500).json({
        error: 'Could not create the user profile. Please try again.',
      });
    }

    // Send the verification email ourselves via Resend.
    // We don't rely on Supabase's built-in email path because this project's
    // GoTrue email rate limit was throttled to 2/h after a historical bounce
    // spike — see plan Phase 6. generateLink + Resend bypasses that limit.
    //
    // This runs for BOTH paths. It used to be gated on isSelfSignup, which meant
    // an admin-created user (Country Admin, auditor, CB) never received a link,
    // could never confirm their email, and was locked out forever while the
    // dashboard still showed them as "Active".
    let emailSendFailed = false;
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

    // Alert admins to the new client registration / lead (best-effort).
    // In the current funnel a registered email IS the lead, so this covers
    // both the "new lead" and "new registration" admin alerts.
    if (assignedRole === 'client') {
      await notifyAdmins(supabaseAdmin, {
        title: 'New registration',
        message: `${displayName} (${email})${company_name ? ` — ${company_name}` : ''} just registered.`,
        region: resolvedRegion,
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
        country: country || null,
        region: resolvedRegion,
        company_name: company_name || null,
        ...(assignedRole === 'client' && stakeholder_type ? { stakeholder_type } : {}),
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
