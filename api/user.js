import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, verifySession, callerCanManageTarget } from './_verifyAdmin.js';
import {
  ContractError,
  getContractForPartner,
  getActiveTemplate,
  saveTemplate,
  acceptContract,
} from './_contract.js';
import { notifyAdmins } from './_notifyAdmins.js';
// Three handlers that used to be their own /api routes. They moved in here on
// 8 Sep because Vercel's Hobby plan allows at most 12 Serverless Functions per
// deployment and this project had reached 15 — every deploy since 27 August
// failed at "Deploying outputs", which is why finished work never went live.
// A file under api/ whose name starts with "_" is a helper, not a route, so
// these three now cost nothing against that limit. All three were only ever
// called from the browser, so moving them changes no external integration.
import { approveRegistration } from './_approveRegistration.js';
import { deleteUser } from './_deleteUser.js';
import { resendVerification } from './_resendVerification.js';
import { sendWhatsApp } from './_notifyWhatsApp.js';
import { sendWelcomeDirect } from './_sendWelcomeDirect.js';
import {
  ContractorContractError,
  generateReference,
  validateContractInput,
  buildContractorContractPdf,
  uploadContractorContractPdf,
} from './_contractorContract.js';
import { signedUrlFor } from './_billing.js';
import { applyContractorTaskDecision } from './_contractorTaskScoring.js';
import {
  ContractorPaymentError,
  validatePaymentInput,
  notifyFinance,
  notifyContractorPaymentDecision,
} from './_contractorPayments.js';
import { ROLES, getRegionFromCountry } from '../src/utils/roles.js';
import { sanitizeAuditorTags } from '../src/utils/auditorOptions.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_ROLES = Object.values(ROLES);

// The two roles a regional (country) admin may never assign — assigning one
// would be self-escalation. `callerCanManageTarget` (shared, in _verifyAdmin.js)
// enforces the same set for who a regional admin may act ON.
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN];

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
    if (action === 'approve-registration') return await approveRegistration(req, res);
    if (action === 'delete-user') return await deleteUser(req, res);
    if (action === 'resend-verification') return await resendVerification(req, res);
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
    // Auditor professional profile (phase24). Same reason as the contract
    // actions above: api/ is at the Vercel Hobby 12-route ceiling.
    if (action === 'add-auditor-document') return await addAuditorDocument(req, res);
    if (action === 'save-auditor-qualifications') return await saveAuditorQualifications(req, res);
    if (action === 'list-auditor-documents') return await listAuditorDocuments(req, res);
    // Contractor onboarding (phase41, 28 Oct) — both bootstrap-window actions,
    // same reasoning as the auditor ones above (no session yet).
    if (action === 'add-contractor-document') return await addContractorDocument(req, res);
    // Contractor contracts (phase42, 28 Oct) — admin-authored per contractor,
    // tri-party signed. See api/_contractorContract.js.
    if (action === 'create-contractor-contract') return await createContractorContract(req, res);
    if (action === 'send-contractor-contract') return await sendContractorContract(req, res);
    if (action === 'list-contractor-contracts') return await listContractorContracts(req, res);
    if (action === 'sign-contractor-contract') return await signContractorContract(req, res);
    if (action === 'finalize-contractor-contract') return await finalizeContractorContract(req, res);
    if (action === 'get-contractor-contract-pdf-url') return await getContractorContractPdfUrl(req, res);
    // Contractor tasks (phase43, 28 Oct) — manual assign/submit/review for
    // now; automatic KPI scoring + email notifications are a later phase.
    if (action === 'create-contractor-task') return await createContractorTask(req, res);
    if (action === 'list-contractor-tasks') return await listContractorTasks(req, res);
    if (action === 'submit-contractor-task') return await submitContractorTask(req, res);
    if (action === 'review-contractor-task') return await reviewContractorTask(req, res);
    if (action === 'get-contractor-task-evidence-url') return await getContractorTaskEvidenceUrl(req, res);
    // Contractor payments (phase44, 28 Oct) — Finance approval queue.
    if (action === 'create-contractor-payment') return await createContractorPayment(req, res);
    if (action === 'list-contractor-payments') return await listContractorPayments(req, res);
    if (action === 'approve-contractor-payment') return await decideContractorPayment(req, res, 'approved');
    if (action === 'reject-contractor-payment') return await decideContractorPayment(req, res, 'rejected');
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('User route error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// Country → region, with the admin-managed `countries` table winning over the
// static map — the same precedence src/utils/roles.js#getRegionFromCountryAsync
// applies in the browser. It matters because the organization-details modal used
// to resolve the region itself and post it; now that only the server derives it,
// deriving it from the static map alone would quietly move a client into a
// different region than the one an admin configured for their country.
async function resolveRegionFromCountry(country) {
  if (!country) return null;
  const name = String(country).trim();
  if (!name) return null;
  try {
    const { data } = await supabaseAdmin
      .from('countries')
      .select('region_id')
      .ilike('name', name)
      .maybeSingle();
    if (data?.region_id) return data.region_id;
  } catch {
    // Table missing or unreachable — fall through to the static map.
  }
  return getRegionFromCountry(name);
}

async function updateProfile(req, res) {
  const {
    userId, full_name, company_name,
    activity, number_of_employees, country, contact_number,
    custom_fields,
    // phase24
    phone, city,
    auditor_standards, auditor_levels, auditor_sectors,
  } = req.body;
  // Privileged fields are `let` because authorization below may strip them.
  let { role, region, email, stakeholder_type, approval_status, commission_percent_override } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // This handler previously ran with NO authorization at all. Anyone on the
  // internet could POST {action:'update-profile', userId:<any>, role:'super_admin'}
  // and take over the platform, or change a victim's `email` — which is also
  // written to auth.users below, making a password-reset takeover trivial.
  // A comment on setActive() claimed the gap existed so the "token-less OAuth
  // profile bootstrap" could work; that bootstrap runs immediately AFTER the
  // Google session exists, so it can and now does send its token like every
  // other caller. Nothing legitimate needed the hole.
  const session = await verifySession(req);
  if (session.error) {
    return res.status(session.status).json({ error: session.error });
  }
  const { caller } = session;

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region, email, stakeholder_type, approval_status, commission_percent_override')
    .eq('id', userId)
    .maybeSingle();

  const isSelf = caller.id === userId;
  const isSuper = caller.role === 'super_admin';
  // A country admin edits their own region only, and fails closed on a null
  // region — the same scoping every admin list view applies.
  const isRegional = caller.role === 'regional_admin'
    && !!caller.region
    && !!target
    && caller.region === target.region;

  if (!isSelf && !isSuper && !isRegional) {
    return res.status(403).json({ error: 'Forbidden: you cannot edit that profile' });
  }

  // The one legitimate case where a user sets their own role: a Google OAuth
  // account whose profile row has no role yet. Narrow it to exactly that — an
  // existing role can never be self-rewritten, and only 'client' is reachable.
  const isOAuthRoleBootstrap = isSelf && !target?.role && role === 'client';

  // ONLY a super admin may change these. Being a regional admin is not enough:
  // a country admin passing their OWN userId satisfies `isRegional` trivially
  // (their region always equals their region), so gating on it would have let
  // them POST role:'super_admin' about themselves. They also must not rewrite
  // an in-region user's email — that value is pushed into auth.users below, so
  // it is a password-reset account takeover — nor move somebody out of their
  // own scope, which create-user.js clamps for the same reason.
  // commission_percent_override is here too: it is what getReferrerTier() in
  // api/checkout.js pays out on every future sale, so letting a non-super
  // admin (or the partner themselves) set it would be a direct payroll
  // escalation, not just a profile edit.
  const PRIVILEGED = { role, region, email, stakeholder_type, approval_status, commission_percent_override };
  if (!isSuper) {
    const attempted = Object.entries(PRIVILEGED).filter(
      ([field, value]) => value !== undefined && value !== target?.[field],
    );
    // The bootstrap is allowed to set exactly `role`, and nothing else.
    const disallowed = isOAuthRoleBootstrap
      ? attempted.filter(([field]) => field !== 'role')
      : attempted;
    if (disallowed.length) {
      // Refuse loudly. Silently dropping the field would show the admin a
      // success toast for a change that never happened.
      return res.status(403).json({
        error: `Forbidden: only a super admin can change ${disallowed.map(([f]) => f).join(', ')}`,
      });
    }
    if (!isOAuthRoleBootstrap) role = undefined;
    region = undefined;
    email = undefined;
    stakeholder_type = undefined;
    approval_status = undefined;
    commission_percent_override = undefined;
  }

  // updateRole() validates its input; this path wrote profiles.role with no
  // check at all, so any string could land in the column.
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Unknown role' });
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
  // null clears an agreed rate back to the flat default; any other value must
  // be a plausible commission percentage, not a number typed into a form by
  // mistake (getReferrerTier() in api/checkout.js applies this on every sale).
  if (commission_percent_override !== undefined) {
    if (commission_percent_override === null) {
      updates.commission_percent_override = null;
    } else {
      const pct = Number(commission_percent_override);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: 'commission_percent_override must be a number between 0 and 100' });
      }
      updates.commission_percent_override = pct;
    }
  }
  // phone and city were accepted here and then dropped on the floor: they were
  // pulled out of the body, copied into auth user_metadata, and never written
  // to the profiles columns the UI actually reads. Editing either from an admin
  // modal silently did nothing. The single `phone` column holds the dial code
  // concatenated with the number ("+971 50 123 4567") — see splitPhone.
  // Empty string in a nullable text column means "somebody cleared this",
  // which is NULL — not a blank value the UI then renders as an empty cell.
  if (phone !== undefined) updates.phone = phone || null;
  else if (contact_number !== undefined) updates.phone = contact_number || null;
  if (city !== undefined) updates.city = city || null;
  // Country is now the primary geo field shown across the admin UI. Persist it,
  // and keep `region` in sync under the hood (RBAC scoping still runs on region)
  // by deriving it from the country whenever the caller didn't set region itself.
  // Only overwrite region when the country actually resolves to one — otherwise
  // an edit to an unmapped country would NULL a valid region and fail the
  // regional-admin scoping open.
  if (country !== undefined) {
    updates.country = country;
    if (region === undefined) {
      const derived = await resolveRegionFromCountry(country);
      if (derived) updates.region = derived;
    }
  }

  // Auditor qualifications belong to auditors only. The role is read from the
  // stored row (or an explicit role change in this same call), never inferred
  // from the presence of the keys, so these columns can't be used to decorate
  // a client or a CB.
  const wantsAuditorFields = auditor_standards !== undefined
    || auditor_levels !== undefined
    || auditor_sectors !== undefined;
  if (wantsAuditorFields) {
    const { data: existing } = await supabaseAdmin
      .from('profiles').select('role').eq('id', userId).maybeSingle();
    if ((role || existing?.role) === 'auditor') {
      if (auditor_standards !== undefined) updates.auditor_standards = sanitizeAuditorTags(auditor_standards);
      if (auditor_levels !== undefined) updates.auditor_levels = sanitizeAuditorTags(auditor_levels);
      if (auditor_sectors !== undefined) updates.auditor_sectors = sanitizeAuditorTags(auditor_sectors);
    }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' });

  if (error) {
    if (/auditor_(standards|levels|sectors)/.test(error.message || '')) {
      return res.status(500).json({
        error: 'The auditor profile columns are missing. Run supabase/phase24_auditor_profile.sql, then try again.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  // A Google OAuth signup never touches api/create-user.js — it lands here to
  // get its first role instead (see isOAuthRoleBootstrap above), so it never
  // got the welcome email every email+password signup receives. Fire it on
  // exactly that transition (no role -> 'client'): naturally once-only, since
  // target.role is 'client' on every later call and isOAuthRoleBootstrap goes
  // false. Best-effort — sendWelcomeDirect swallows its own failures.
  if (isOAuthRoleBootstrap && target?.email) {
    await sendWelcomeDirect({ email: target.email, name: full_name, role: 'client' });
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
  else if (phone !== undefined) metaUpdates.contact_number = phone;
  if (city !== undefined) metaUpdates.city = city;

  if (Object.keys(metaUpdates).length > 0) {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: metaUpdates,
    });
  }

  return res.status(200).json({ success: true });
}

async function updateRole(req, res) {
  // Any admin may reach this; ownership is enforced per-target below. Was
  // super-admin-only, but the client asked country admins to manage the users
  // in their region (25 Jul).
  const auth = await verifyAdmin(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const caller = auth.caller;

  const { userId, newRole } = req.body;

  if (!userId || !newRole) {
    return res.status(400).json({ error: 'Missing required fields: userId, newRole' });
  }

  if (!VALID_ROLES.includes(newRole)) {
    return res.status(400).json({ error: 'Unknown role' });
  }

  if (userId === caller.id) {
    return res.status(400).json({ error: 'You cannot change your own role.' });
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region')
    .eq('id', userId)
    .maybeSingle();
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (!callerCanManageTarget(caller, target)) {
    return res.status(403).json({ error: 'Forbidden: you cannot manage that user' });
  }

  // A regional admin may not promote anyone into an admin role — that is the
  // one lever that would let them escalate their own reach.
  if (caller.role !== ROLES.SUPER_ADMIN && ADMIN_ROLES.includes(newRole)) {
    return res.status(403).json({ error: 'Only a super admin can assign an admin role' });
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
// deactivated account cannot log in.
async function setActive(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const caller = auth.caller;

  const { userId, isActive } = req.body;
  if (!userId || typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'Missing required fields: userId, isActive (boolean)' });
  }
  if (userId === caller.id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region')
    .eq('id', userId)
    .maybeSingle();
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (!callerCanManageTarget(caller, target)) {
    return res.status(403).json({ error: 'Forbidden: you cannot manage that user' });
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
  // Was completely unauthenticated. This table is the live RBAC override map —
  // an anonymous POST could grant any role any permission across the platform.
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { role, permission, enabled, clear } = req.body;
  // Who made the change is taken from the verified token, never from the body —
  // an audit column a caller can write is not an audit column.
  const updatedBy = auth.caller.id;

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
    const data = await getContractForPartner(supabaseAdmin, caller);
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

// ---------------------------------------------------------------------------
// Auditor professional profile (phase24)
// ---------------------------------------------------------------------------
const AUDITOR_DOC_TYPES = ['certificate', 'audit_log', 'cv', 'other'];
const AUDITOR_DOC_BUCKET = 'auditor-documents';
// Contractor onboarding documents + contract (phase41, 28 Oct). A contractor
// account is created 'pending' (AuthContext.signup) and is never logged in
// during registration, so — same reasoning as the auditor bootstrap window
// above — these uploads and the contract acceptance below run unauthenticated,
// bounded to a short window right after account creation.
const CONTRACTOR_DOC_TYPES = ['id_copy', 'cv', 'photo', 'other'];
const CONTRACTOR_DOC_BUCKET = 'contractor-documents';
// Vercel caps a request body at 4.5 MB and base64 inflates the payload by a
// third, so the raw file has to stay well under that. Kept in step with
// MAX_UPLOAD_MB in ProfileManagementTable.jsx.
const MAX_DOC_BYTES = 3 * 1024 * 1024;

// A self-registering auditor is created with email_confirm:false and is never
// signed in, so at the moment the wizard uploads their certificate there is no
// session and no token to verify. Leaving the write open unauthenticated would
// be an anonymous upload endpoint; instead the token-less call is accepted only
// inside this window — a brand-new, still-unverified auditor account, for a few
// minutes, for a handful of files. The id is a random v4 UUID that is not
// enumerable and is only ever handed to the browser that just created it.
const BOOTSTRAP_WINDOW_MS = 30 * 60 * 1000;
const BOOTSTRAP_MAX_DOCS = 8;

// Decide whether this caller may write to this auditor's record.
// The auditorId in the body is never trusted on its own — it is always checked
// against the identity in the verified token.
//
// allowBootstrap: false turns off the token-less registration-window branch
// below. That branch was written for the WRITE path — a brand-new auditor
// adding their own first documents before they have a session — and its
// blast radius is "an unauthenticated holder of a fresh UUID may append a
// file". Reusing it unchanged for a READ (listAuditorDocuments) would widen
// that to "may read back and get signed download URLs for every document
// already on file", which is a materially different exposure (security
// review, 16 Oct). Callers that only need to read pass { allowBootstrap: false }.
// Returns { target, actorId } or { error, status }.
async function resolveAuditorWriteAccess(req, auditorId, { allowBootstrap = true } = {}) {
  if (!auditorId || typeof auditorId !== 'string') {
    return { error: 'Missing auditorId', status: 400 };
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region, created_at')
    .eq('id', auditorId)
    .maybeSingle();

  if (!target) return { error: 'Auditor not found', status: 404 };
  if (target.role !== 'auditor') {
    return { error: 'That user is not an auditor', status: 400 };
  }

  const session = await verifySession(req);
  if (session.caller) {
    const { caller } = session;
    if (caller.id === auditorId) return { target, actorId: caller.id };
    if (caller.role === 'super_admin') return { target, actorId: caller.id };
    // A country admin manages auditors in their own region only, exactly as
    // every admin list view is scoped. Fail closed on a null region.
    if (caller.role === 'regional_admin' && caller.region && caller.region === target.region) {
      return { target, actorId: caller.id };
    }
    return { error: 'Forbidden: you cannot manage that auditor', status: 403 };
  }

  // A caller who presented a token and failed verification is a rejected
  // caller, not a new registration — never let an expired session fall through
  // into the bootstrap path.
  if (req.headers?.authorization || req.headers?.Authorization) {
    return { error: session.error || 'Unauthorized', status: session.status || 401 };
  }

  if (!allowBootstrap) {
    return { error: 'Unauthorized: sign in to view this auditor\'s documents', status: 401 };
  }

  // No session at all — registration bootstrap only (see the note above).
  //
  // This used to also reject once email_confirmed_at was set. That signal is
  // gone: email verification was removed (25 Jul), so every user is now created
  // already-confirmed and email_confirmed_at is populated from the first
  // moment. The bootstrap window is now bounded purely by created_at (a few
  // minutes) and the per-auditor document cap below — both unchanged.
  if (Date.now() - new Date(target.created_at).getTime() > BOOTSTRAP_WINDOW_MS) {
    return { error: 'Unauthorized: sign in to update this auditor', status: 401 };
  }
  const { count } = await supabaseAdmin
    .from('auditor_documents')
    .select('id', { count: 'exact', head: true })
    .eq('auditor_id', auditorId);
  if ((count || 0) >= BOOTSTRAP_MAX_DOCS) {
    return { error: 'Unauthorized: sign in to update this auditor', status: 401 };
  }

  return { target, actorId: null };
}

// Same bootstrap-window reasoning as resolveAuditorWriteAccess above, applied
// to a contractor. There is no READ caller for this one yet (no admin screen
// exists to list contractor documents in this phase), so allowBootstrap is
// not parameterized here the way the auditor version is.
//
// As with the auditor version, the unauthenticated branch's only access
// control is contractorId being an unguessable v4 UUID handed only to the
// browser that just created the account — see the fuller justification on
// resolveAuditorWriteAccess above.
async function resolveContractorWriteAccess(req, contractorId) {
  if (!contractorId || typeof contractorId !== 'string') {
    return { error: 'Missing contractorId', status: 400 };
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region, created_at')
    .eq('id', contractorId)
    .maybeSingle();

  if (!target) return { error: 'Contractor not found', status: 404 };
  if (target.role !== ROLES.CONTRACTOR) {
    return { error: 'That user is not a contractor', status: 400 };
  }

  const session = await verifySession(req);
  if (session.caller) {
    const { caller } = session;
    if (caller.id === contractorId) return { target, actorId: caller.id };
    if (caller.role === ROLES.SUPER_ADMIN) return { target, actorId: caller.id };
    if (caller.role === ROLES.REGIONAL_ADMIN && caller.region && caller.region === target.region) {
      return { target, actorId: caller.id };
    }
    return { error: 'Forbidden: you cannot manage that contractor', status: 403 };
  }

  if (req.headers?.authorization || req.headers?.Authorization) {
    return { error: session.error || 'Unauthorized', status: session.status || 401 };
  }

  if (Date.now() - new Date(target.created_at).getTime() > BOOTSTRAP_WINDOW_MS) {
    return { error: 'Unauthorized: sign in to update this contractor', status: 401 };
  }
  const { count } = await supabaseAdmin
    .from('contractor_documents')
    .select('id', { count: 'exact', head: true })
    .eq('contractor_id', contractorId);
  if ((count || 0) >= BOOTSTRAP_MAX_DOCS) {
    return { error: 'Unauthorized: sign in to update this contractor', status: 401 };
  }

  return { target, actorId: null };
}

// Attach a certificate / audit log / CV to an auditor.
// The bytes arrive base64-encoded and are written with the service role rather
// than uploaded from the browser: an admin acting on somebody else's behalf has
// a different auth.uid() than the folder owner, and a self-registering auditor
// has no session at all — so a browser-side upload would need a storage policy
// far wider than either case deserves. One authorization decision, made here.
async function addAuditorDocument(req, res) {
  const { auditorId, docType, fileName, mimeType, sizeBytes, storagePath, dataBase64 } = req.body;

  const access = await resolveAuditorWriteAccess(req, auditorId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const type = AUDITOR_DOC_TYPES.includes(docType) ? docType : 'other';
  // The name reaches a storage key and a filesystem download; strip anything
  // that could traverse a path or confuse a Content-Disposition header.
  const safeName = String(fileName || 'document')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120) || 'document';

  let path;
  if (dataBase64) {
    // atob + Uint8Array rather than Buffer: the repo's ESLint config models
    // browser globals only, so Buffer trips no-undef in every api/ file that
    // uses it. Both exist on the Vercel Node runtime; this one lints clean.
    let bytes;
    try {
      bytes = Uint8Array.from(atob(String(dataBase64)), c => c.charCodeAt(0));
    } catch {
      return res.status(400).json({ error: 'File data could not be decoded' });
    }
    if (!bytes.length) return res.status(400).json({ error: 'File is empty' });
    if (bytes.length > MAX_DOC_BYTES) {
      return res.status(413).json({
        error: `File is too large. The limit is ${Math.floor(MAX_DOC_BYTES / (1024 * 1024))} MB.`,
      });
    }

    path = `${auditorId}/${type}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(AUDITOR_DOC_BUCKET)
      .upload(path, bytes, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });
    if (upErr) {
      console.error('addAuditorDocument: storage upload failed', upErr);
      // The bucket went missing from every migration until phase24, which is
      // exactly why these uploads had been failing invisibly. Say so.
      const missingBucket = /bucket/i.test(upErr.message || '');
      return res.status(500).json({
        error: missingBucket
          ? `Storage bucket "${AUDITOR_DOC_BUCKET}" does not exist. Run supabase/phase24_auditor_profile.sql.`
          : 'Could not store the document. Please try again.',
      });
    }
  } else if (storagePath) {
    // A caller that uploaded the object itself may only claim a path inside
    // that auditor's own folder — otherwise a row could point at anyone's file.
    // The prefix check alone is not enough: "<id>/../<victim>/cv.pdf" starts
    // with the right folder and still escapes it, so reject traversal outright.
    const claimed = String(storagePath);
    if (!claimed.startsWith(`${auditorId}/`) || claimed.includes('..') || claimed.includes('\\')) {
      return res.status(400).json({ error: 'storagePath must be inside the auditor folder' });
    }
    path = claimed;
  } else {
    return res.status(400).json({ error: 'Missing dataBase64 or storagePath' });
  }

  const { data: row, error } = await supabaseAdmin
    .from('auditor_documents')
    .insert({
      auditor_id: auditorId,
      doc_type: type,
      file_name: safeName,
      storage_path: path,
      mime_type: mimeType || null,
      size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
      uploaded_by: access.actorId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('addAuditorDocument: insert failed', error);
    const missingTable = /auditor_documents/.test(error.message || '');
    return res.status(500).json({
      error: missingTable
        ? 'The auditor_documents table is missing. Run supabase/phase24_auditor_profile.sql.'
        : 'Could not record the document. Please try again.',
    });
  }

  return res.status(200).json({ success: true, id: row.id, storagePath: path });
}

// Attach an ID copy / CV / photo to a contractor — bootstrap-window upload,
// same shape as addAuditorDocument above (no session exists yet for a
// self-registering, still-'pending' contractor).
async function addContractorDocument(req, res) {
  const { contractorId, docType, fileName, mimeType, sizeBytes, dataBase64 } = req.body;

  const access = await resolveContractorWriteAccess(req, contractorId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const type = CONTRACTOR_DOC_TYPES.includes(docType) ? docType : 'other';
  const safeName = String(fileName || 'document')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120) || 'document';

  if (!dataBase64) return res.status(400).json({ error: 'Missing dataBase64' });
  let bytes;
  try {
    bytes = Uint8Array.from(atob(String(dataBase64)), c => c.charCodeAt(0));
  } catch {
    return res.status(400).json({ error: 'File data could not be decoded' });
  }
  if (!bytes.length) return res.status(400).json({ error: 'File is empty' });
  if (bytes.length > MAX_DOC_BYTES) {
    return res.status(413).json({
      error: `File is too large. The limit is ${Math.floor(MAX_DOC_BYTES / (1024 * 1024))} MB.`,
    });
  }

  const path = `${contractorId}/${type}-${Date.now()}-${safeName}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(CONTRACTOR_DOC_BUCKET)
    .upload(path, bytes, { contentType: mimeType || 'application/octet-stream', upsert: false });
  if (upErr) {
    console.error('addContractorDocument: storage upload failed', upErr);
    const missingBucket = /bucket/i.test(upErr.message || '');
    return res.status(500).json({
      error: missingBucket
        ? `Storage bucket "${CONTRACTOR_DOC_BUCKET}" does not exist. Run supabase/phase41_contractors.sql.`
        : 'Could not store the document. Please try again.',
    });
  }

  const { data: row, error } = await supabaseAdmin
    .from('contractor_documents')
    .insert({
      contractor_id: contractorId,
      doc_type: type,
      file_name: safeName,
      storage_path: path,
      mime_type: mimeType || null,
      size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
      uploaded_by: access.actorId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('addContractorDocument: insert failed', error);
    const missingTable = /contractor_documents/.test(error.message || '');
    return res.status(500).json({
      error: missingTable
        ? 'The contractor_documents table is missing. Run supabase/phase41_contractors.sql.'
        : 'Could not record the document. Please try again.',
    });
  }

  return res.status(200).json({ success: true, id: row.id, storagePath: path });
}

// ---------------------------------------------------------------------------
// Contractor contracts (phase42, 28 Oct) — tri-party, per-contractor
// agreements. See api/_contractorContract.js for the shared validation/PDF
// logic and the full design rationale.
// ---------------------------------------------------------------------------
function contractorContractFailure(res, err, context) {
  if (err instanceof ContractorContractError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`${context} failed:`, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// Admin-only (super_admin, or regional_admin scoped to the contractor's own
// region — same rule used throughout this file). Only an APPROVED contractor
// can have a contract authored for them: the documents (ID/CV/photo) have to
// be on file and reviewed first.
async function assertContractorContractAdmin(req, contractorId) {
  const auth = await verifyAdmin(req);
  if (auth.error) return { error: auth.error, status: auth.status };

  const { data: contractor } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region, approval_status')
    .eq('id', contractorId)
    .maybeSingle();
  if (!contractor || contractor.role !== ROLES.CONTRACTOR) {
    return { error: 'Contractor not found', status: 404 };
  }
  if (contractor.approval_status !== 'approved') {
    return { error: 'This contractor has not been approved yet.', status: 409 };
  }
  if (auth.caller.role === ROLES.REGIONAL_ADMIN
      && (!auth.caller.region || auth.caller.region !== contractor.region)) {
    return { error: 'Forbidden: that contractor is outside your region.', status: 403 };
  }
  return { caller: auth.caller, contractor };
}

async function createContractorContract(req, res) {
  try {
    const { contractorId } = req.body;
    const access = await assertContractorContractAdmin(req, contractorId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const fields = validateContractInput(req.body);

    const { data: row, error } = await supabaseAdmin
      .from('contractor_contracts')
      .insert({
        reference: generateReference(),
        contractor_id: contractorId,
        status: 'draft',
        created_by: access.caller.id,
        ...fields,
      })
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, contract: row });
  } catch (err) {
    return contractorContractFailure(res, err, 'createContractorContract');
  }
}

// Moves a draft to pending_signatures and records WCA GLOBAL's signature.
// WCA GLOBAL is a fixed company, not a dynamic account in this system (client
// confirmation, 28 Oct) — the admin sending the contract IS acting on its
// behalf, so that signature is recorded here rather than requiring a second,
// nonexistent WCA GLOBAL login to come back and sign separately.
async function sendContractorContract(req, res) {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ error: 'Missing contractId' });

    const { data: contract } = await supabaseAdmin
      .from('contractor_contracts').select('*').eq('id', contractId).maybeSingle();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const access = await assertContractorContractAdmin(req, contract.contractor_id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    if (contract.status !== 'draft') {
      return res.status(409).json({ error: `Contract is already ${contract.status}.` });
    }

    const { error: updErr } = await supabaseAdmin
      .from('contractor_contracts')
      .update({ status: 'pending_signatures', updated_at: new Date().toISOString() })
      .eq('id', contractId);
    if (updErr) throw updErr;

    const { error: sigErr } = await supabaseAdmin
      .from('contractor_contract_signatures')
      .insert({
        contract_id: contractId,
        party_role: 'wca_global',
        signed_name: 'WCA GLOBAL',
        signed_by: access.caller.id,
        accepted_ip: clientIpFor(req),
      });
    // 23505 = already recorded (a retried send) — not an error.
    if (sigErr && sigErr.code !== '23505') throw sigErr;

    await supabaseAdmin.from('notifications').insert({
      user_id: contract.contractor_id,
      type: 'system',
      title: 'Contract ready to sign',
      message: `A contract (${contract.reference}) has been sent to you for review and signature.`,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return contractorContractFailure(res, err, 'sendContractorContract');
  }
}

// Lists contracts for the caller's own account (contractor) or, for an admin,
// for a given contractorId in the body.
// Same region-scoping rule assertContractorContractAdmin enforces for the
// write paths, reused by the two read endpoints below. A super_admin may
// read any contractor's contracts; a regional_admin only one in their own
// region (security review, 28 Oct — the read paths had checked the caller's
// ROLE but not their region, letting a regional_admin reach a contractor
// outside their scope).
async function regionAllowsContractorRead(caller, contractorId) {
  if (caller.role === ROLES.SUPER_ADMIN) return true;
  if (caller.role !== ROLES.REGIONAL_ADMIN) return false;
  const { data: contractor } = await supabaseAdmin
    .from('profiles').select('region').eq('id', contractorId).maybeSingle();
  return !!(caller.region && contractor?.region && caller.region === contractor.region);
}

async function listContractorContracts(req, res) {
  try {
    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;

    let contractorId = caller.id;
    if (req.body?.contractorId && req.body.contractorId !== caller.id) {
      if (!(await regionAllowsContractorRead(caller, req.body.contractorId))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      contractorId = req.body.contractorId;
    } else if (caller.role !== ROLES.CONTRACTOR && !req.body?.contractorId) {
      return res.status(400).json({ error: 'Missing contractorId' });
    }

    const { data: contracts, error } = await supabaseAdmin
      .from('contractor_contracts')
      .select('*, contractor_contract_signatures(*)')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return res.status(200).json({ success: true, contracts: contracts || [] });
  } catch (err) {
    return contractorContractFailure(res, err, 'listContractorContracts');
  }
}

// The contractor signs their own contract, from their own dashboard — always
// a real session, never the bootstrap window (a contract can't exist until
// after approval, by which point the contractor can log in normally).
async function signContractorContract(req, res) {
  try {
    const { contractId, signedName } = req.body;
    if (!contractId) return res.status(400).json({ error: 'Missing contractId' });

    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;
    if (caller.role !== ROLES.CONTRACTOR) {
      return res.status(403).json({ error: 'Only the contractor may sign their own contract.' });
    }

    const name = String(signedName || '').trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: 'Missing signedName' });

    const { data: contract } = await supabaseAdmin
      .from('contractor_contracts').select('*').eq('id', contractId).maybeSingle();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (contract.contractor_id !== caller.id) {
      return res.status(403).json({ error: 'That is not your contract.' });
    }
    if (contract.status !== 'pending_signatures') {
      return res.status(409).json({ error: `Contract is not ready to sign (status: ${contract.status}).` });
    }

    // Re-checked here, not just at send/finalize time (security review, 28
    // Oct): an admin revoking approval after a contract was sent must stop
    // the contractor from still producing a signed artifact in the interim.
    const { data: ownProfile } = await supabaseAdmin
      .from('profiles').select('approval_status').eq('id', caller.id).maybeSingle();
    if (ownProfile?.approval_status !== 'approved') {
      return res.status(403).json({ error: 'Your account is not currently approved.' });
    }

    const { error } = await supabaseAdmin
      .from('contractor_contract_signatures')
      .insert({
        contract_id: contractId,
        party_role: 'contractor',
        signed_name: name,
        signed_by: caller.id,
        accepted_ip: clientIpFor(req),
      });
    if (error && error.code !== '23505') throw error;

    await notifyAdmins(supabaseAdmin, {
      title: 'Contractor signed their contract',
      message: `${name} signed contract ${contract.reference}. Review and finalize it to activate.`,
    }).catch(() => {});

    return res.status(200).json({ success: true, alreadySigned: error?.code === '23505' });
  } catch (err) {
    return contractorContractFailure(res, err, 'signContractorContract');
  }
}

// Admin-only. Requires the contractor's signature already on file; records
// the Platform's (3rd-party) signature, generates the final PDF, and marks
// the contract signed.
async function finalizeContractorContract(req, res) {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ error: 'Missing contractId' });

    const { data: contract } = await supabaseAdmin
      .from('contractor_contracts').select('*').eq('id', contractId).maybeSingle();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const access = await assertContractorContractAdmin(req, contract.contractor_id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    if (contract.status !== 'pending_signatures') {
      return res.status(409).json({ error: `Contract is not pending signatures (status: ${contract.status}).` });
    }

    const { data: signatures } = await supabaseAdmin
      .from('contractor_contract_signatures').select('*').eq('contract_id', contractId);
    const hasRole = (role) => (signatures || []).some((s) => s.party_role === role);
    if (!hasRole('contractor')) {
      return res.status(409).json({ error: 'The contractor has not signed yet.' });
    }

    const { error: sigErr } = await supabaseAdmin
      .from('contractor_contract_signatures')
      .insert({
        contract_id: contractId,
        party_role: 'platform',
        signed_name: 'Certify.cx',
        signed_by: access.caller.id,
        accepted_ip: clientIpFor(req),
      });
    if (sigErr && sigErr.code !== '23505') throw sigErr;

    const { data: allSignatures } = await supabaseAdmin
      .from('contractor_contract_signatures').select('*').eq('contract_id', contractId);

    let pdfPath = contract.pdf_storage_path || null;
    try {
      const bytes = await buildContractorContractPdf(contract, access.contractor, allSignatures);
      pdfPath = await uploadContractorContractPdf(supabaseAdmin, {
        contractId, reference: contract.reference, bytes,
      }) || pdfPath;
    } catch (e) {
      // The signature records are the legally meaningful artefact and are
      // already committed — a PDF render failure must not undo them.
      console.error('Contractor contract PDF generation failed (signatures stand):', e);
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('contractor_contracts')
      .update({ status: 'signed', pdf_storage_path: pdfPath, updated_at: new Date().toISOString() })
      .eq('id', contractId)
      .select()
      .single();
    if (updErr) throw updErr;

    await supabaseAdmin.from('notifications').insert({
      user_id: contract.contractor_id,
      type: 'system',
      title: 'Contract signed',
      message: `Your contract (${contract.reference}) is now fully signed and active.`,
    });

    return res.status(200).json({ success: true, contract: updated });
  } catch (err) {
    return contractorContractFailure(res, err, 'finalizeContractorContract');
  }
}

// Returns a short-lived download URL for a finalized contract's PDF. Same
// access rule as listContractorContracts: the contractor themselves, or an
// admin.
async function getContractorContractPdfUrl(req, res) {
  try {
    const { contractId } = req.body;
    if (!contractId) return res.status(400).json({ error: 'Missing contractId' });

    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;

    const { data: contract } = await supabaseAdmin
      .from('contractor_contracts').select('contractor_id, pdf_storage_path').eq('id', contractId).maybeSingle();
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const isOwner = contract.contractor_id === caller.id;
    if (!isOwner && !(await regionAllowsContractorRead(caller, contract.contractor_id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!contract.pdf_storage_path) {
      return res.status(404).json({ error: 'No PDF has been generated for this contract yet.' });
    }

    const url = await signedUrlFor(supabaseAdmin, contract.pdf_storage_path, 300, 'contractor-contract-pdfs');
    return res.status(200).json({ success: true, url });
  } catch (err) {
    return contractorContractFailure(res, err, 'getContractorContractPdfUrl');
  }
}

// Shared IP-capture helper — same preference order as api/_contract.js's
// clientIp (x-real-ip, then the last hop of x-forwarded-for, then the socket)
// since this module can't import that one without creating a dependency
// between two independently-reviewed legal-signature code paths.
function clientIpFor(req) {
  const realIp = req?.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim().slice(0, 100);
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    const hops = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1].slice(0, 100);
  }
  return req?.socket?.remoteAddress?.slice(0, 100) || 'unknown';
}

// ---------------------------------------------------------------------------
// Contractor tasks (phase43, 28 Oct) — admin assigns, contractor submits
// evidence, admin reviews. Deliberately manual review for now: automatic
// 0%/100% scoring against the deadline and the contractor/admin email
// notifications are a separate, later phase (client confirmation, 28 Oct —
// build this in small pieces, not all at once).
// ---------------------------------------------------------------------------
const TASK_EVIDENCE_BUCKET = 'contractor-task-evidence';

async function createContractorTask(req, res) {
  try {
    const { contractorId, contractId, taskDescription, kpiTarget, deadlineDate } = req.body;
    const access = await assertContractorContractAdmin(req, contractorId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const description = String(taskDescription || '').trim().slice(0, 5000);
    if (!description) return res.status(400).json({ error: 'Missing taskDescription' });
    if (!deadlineDate) return res.status(400).json({ error: 'Missing deadlineDate' });

    // A task may optionally be pinned to one of this contractor's own
    // contracts — reject one that belongs to somebody else rather than
    // silently recording a false link.
    if (contractId) {
      const { data: contract } = await supabaseAdmin
        .from('contractor_contracts').select('contractor_id').eq('id', contractId).maybeSingle();
      if (!contract || contract.contractor_id !== contractorId) {
        return res.status(400).json({ error: 'That contract does not belong to this contractor.' });
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from('contractor_tasks')
      .insert({
        contractor_id: contractorId,
        contract_id: contractId || null,
        assigned_by: access.caller.id,
        task_description: description,
        kpi_target: kpiTarget ? String(kpiTarget).trim().slice(0, 500) : null,
        deadline_date: deadlineDate,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    await supabaseAdmin.from('notifications').insert({
      user_id: contractorId,
      type: 'system',
      title: 'New task assigned',
      message: `${description.slice(0, 140)}${description.length > 140 ? '…' : ''} — due ${deadlineDate}.`,
    });

    return res.status(200).json({ success: true, task: row });
  } catch (err) {
    return contractorContractFailure(res, err, 'createContractorTask');
  }
}

// Same access shape as listContractorContracts: the contractor's own tasks,
// or an admin's (region-scoped for regional_admin) view of one contractor's.
async function listContractorTasks(req, res) {
  try {
    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;

    let contractorId = caller.id;
    if (req.body?.contractorId && req.body.contractorId !== caller.id) {
      if (!(await regionAllowsContractorRead(caller, req.body.contractorId))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      contractorId = req.body.contractorId;
    } else if (caller.role !== ROLES.CONTRACTOR && !req.body?.contractorId) {
      return res.status(400).json({ error: 'Missing contractorId' });
    }

    const { data: tasks, error } = await supabaseAdmin
      .from('contractor_tasks')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('deadline_date', { ascending: true });
    if (error) throw error;

    return res.status(200).json({ success: true, tasks: tasks || [] });
  } catch (err) {
    return contractorContractFailure(res, err, 'listContractorTasks');
  }
}

// The contractor submits their own evidence — always a real session, a task
// can't exist before the contractor was approved and could log in.
async function submitContractorTask(req, res) {
  try {
    const { taskId, workLink, completionDate, evidenceNote, fileName, mimeType, dataBase64 } = req.body;
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;
    if (caller.role !== ROLES.CONTRACTOR) {
      return res.status(403).json({ error: 'Only the assigned contractor may submit this task.' });
    }

    const { data: task } = await supabaseAdmin
      .from('contractor_tasks').select('*').eq('id', taskId).maybeSingle();
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.contractor_id !== caller.id) {
      return res.status(403).json({ error: 'That is not your task.' });
    }
    if (task.status === 'completed') {
      return res.status(409).json({ error: 'This task has already been marked completed.' });
    }

    const patch = {
      status: 'submitted',
      updated_at: new Date().toISOString(),
    };
    if (workLink) patch.work_link = String(workLink).trim().slice(0, 2000);
    if (completionDate) patch.completion_date = completionDate;
    if (evidenceNote) patch.evidence_note = String(evidenceNote).trim().slice(0, 2000);

    if (dataBase64) {
      let bytes;
      try {
        bytes = Uint8Array.from(atob(String(dataBase64)), (c) => c.charCodeAt(0));
      } catch {
        return res.status(400).json({ error: 'File data could not be decoded' });
      }
      if (bytes.length > MAX_DOC_BYTES) {
        return res.status(413).json({
          error: `File is too large. The limit is ${Math.floor(MAX_DOC_BYTES / (1024 * 1024))} MB.`,
        });
      }
      const safeName = String(fileName || 'evidence')
        .replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'evidence';
      const path = `${caller.id}/${taskId}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(TASK_EVIDENCE_BUCKET)
        .upload(path, bytes, { contentType: mimeType || 'application/octet-stream', upsert: false });
      if (upErr) {
        console.error('submitContractorTask: evidence upload failed', upErr);
        return res.status(500).json({ error: 'Could not store the evidence file. Please try again.' });
      }
      patch.evidence_storage_path = path;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('contractor_tasks').update(patch).eq('id', taskId).select().single();
    if (error) throw error;

    await notifyAdmins(supabaseAdmin, {
      title: 'Contractor submitted a task',
      message: `Task "${task.task_description.slice(0, 100)}" was submitted for review.`,
    }).catch(() => {});

    return res.status(200).json({ success: true, task: updated });
  } catch (err) {
    return contractorContractFailure(res, err, 'submitContractorTask');
  }
}

// Admin-only, region-scoped. Marks a submitted task completed (100%) or
// missed (0%) by explicit human review — not automatic yet (see module note
// above).
async function reviewContractorTask(req, res) {
  try {
    const { taskId, decision } = req.body; // decision: 'completed' | 'missed'
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });
    if (!['completed', 'missed'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'completed' or 'missed'" });
    }

    const { data: task } = await supabaseAdmin
      .from('contractor_tasks').select('*').eq('id', taskId).maybeSingle();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const access = await assertContractorContractAdmin(req, task.contractor_id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    if (task.status === 'completed' || task.status === 'missed') {
      return res.status(409).json({ error: `This task was already decided (${task.status}).` });
    }

    const updated = await applyContractorTaskDecision(supabaseAdmin, task, decision);

    return res.status(200).json({ success: true, task: updated });
  } catch (err) {
    return contractorContractFailure(res, err, 'reviewContractorTask');
  }
}

// Short-lived download URL for an evidence file — same access rule as the
// contract PDF endpoint.
async function getContractorTaskEvidenceUrl(req, res) {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' });

    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;

    const { data: task } = await supabaseAdmin
      .from('contractor_tasks').select('contractor_id, evidence_storage_path').eq('id', taskId).maybeSingle();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isOwner = task.contractor_id === caller.id;
    if (!isOwner && !(await regionAllowsContractorRead(caller, task.contractor_id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!task.evidence_storage_path) {
      return res.status(404).json({ error: 'No evidence file on this task.' });
    }

    const url = await signedUrlFor(supabaseAdmin, task.evidence_storage_path, 300, TASK_EVIDENCE_BUCKET);
    return res.status(200).json({ success: true, url });
  } catch (err) {
    return contractorContractFailure(res, err, 'getContractorTaskEvidenceUrl');
  }
}

// ---------------------------------------------------------------------------
// Contractor payments (phase44, 28 Oct) — two-step approval. An admin raises
// a request (the admin-approval step the client asked for — an admin
// wouldn't raise one for unapproved work); a separate Finance-role user then
// approves or rejects the money. The contractor can see the request itself
// while it's pending ("Awaiting Finance"), but it only counts as credit, and
// only emails them, once Finance decides. See api/_contractorPayments.js.
// ---------------------------------------------------------------------------
function contractorPaymentFailure(res, err, context) {
  if (err instanceof ContractorPaymentError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`${context} failed:`, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

async function createContractorPayment(req, res) {
  try {
    const { contractorId, contractId, taskId, amount, currency, description } = req.body;
    const access = await assertContractorContractAdmin(req, contractorId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const fields = validatePaymentInput({ amount, currency, description });

    // Optional links must actually belong to this contractor — same
    // defensive check createContractorTask does for contractId.
    if (contractId) {
      const { data: c } = await supabaseAdmin
        .from('contractor_contracts').select('contractor_id').eq('id', contractId).maybeSingle();
      if (!c || c.contractor_id !== contractorId) {
        return res.status(400).json({ error: 'That contract does not belong to this contractor.' });
      }
    }
    if (taskId) {
      const { data: t } = await supabaseAdmin
        .from('contractor_tasks').select('contractor_id').eq('id', taskId).maybeSingle();
      if (!t || t.contractor_id !== contractorId) {
        return res.status(400).json({ error: 'That task does not belong to this contractor.' });
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from('contractor_payments')
      .insert({
        contractor_id: contractorId,
        contract_id: contractId || null,
        task_id: taskId || null,
        created_by: access.caller.id,
        status: 'pending_finance',
        ...fields,
      })
      .select()
      .single();
    if (error) throw error;

    await notifyFinance(supabaseAdmin, {
      title: 'New payment request awaiting approval',
      message: `${fields.currency} ${fields.amount.toLocaleString()} for "${fields.description}".`,
      details: [['Amount', `${fields.currency} ${fields.amount.toLocaleString()}`], ['For', fields.description]],
    });

    return res.status(200).json({ success: true, payment: row });
  } catch (err) {
    return contractorPaymentFailure(res, err, 'createContractorPayment');
  }
}

// Contractor: their own payments (any status, so they can see a rejection
// reason too). Admin: one contractor's, region-scoped. Finance: every
// request — not region-scoped, matching notifyFinance's reasoning.
async function listContractorPayments(req, res) {
  try {
    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;

    let contractorId = caller.id;
    if (req.body?.contractorId && req.body.contractorId !== caller.id) {
      const allowed = caller.role === ROLES.FINANCE
        || (await regionAllowsContractorRead(caller, req.body.contractorId));
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
      contractorId = req.body.contractorId;
    } else if (caller.role === ROLES.FINANCE && !req.body?.contractorId) {
      // Finance's approval queue: every pending request, across contractors.
      const { data: payments, error } = await supabaseAdmin
        .from('contractor_payments').select('*').eq('status', 'pending_finance')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ success: true, payments: payments || [] });
    } else if (caller.role !== ROLES.CONTRACTOR && !req.body?.contractorId) {
      return res.status(400).json({ error: 'Missing contractorId' });
    }

    const { data: payments, error } = await supabaseAdmin
      .from('contractor_payments')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return res.status(200).json({ success: true, payments: payments || [] });
  } catch (err) {
    return contractorPaymentFailure(res, err, 'listContractorPayments');
  }
}

async function decideContractorPayment(req, res, decision) {
  try {
    const { paymentId, rejectionReason } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

    const session = await verifySession(req);
    if (session.error) return res.status(session.status).json({ error: session.error });
    const { caller } = session;
    if (caller.role !== ROLES.FINANCE && caller.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Only Finance may decide a payment request.' });
    }

    const { data: payment } = await supabaseAdmin
      .from('contractor_payments').select('*').eq('id', paymentId).maybeSingle();
    if (!payment) return res.status(404).json({ error: 'Payment request not found' });

    const patch = {
      status: decision,
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (decision === 'rejected') {
      patch.rejection_reason = String(rejectionReason || '').trim().slice(0, 1000) || null;
    }

    // The status check has to be IN the update's WHERE clause, not a separate
    // read-then-write — two concurrent decide calls (a double-click, or two
    // Finance accounts racing) could otherwise both pass a prior read of
    // status='pending_finance' and both write, the second silently
    // overwriting the first's decision (security review, 28 Oct). Zero rows
    // back means someone else already decided it between the read above and
    // here.
    const { data: updated, error } = await supabaseAdmin
      .from('contractor_payments')
      .update(patch)
      .eq('id', paymentId)
      .eq('status', 'pending_finance')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return res.status(409).json({ error: 'This request was already decided by someone else.' });
    }

    const { data: contractor } = await supabaseAdmin
      .from('profiles').select('email, full_name, notifications_enabled').eq('id', payment.contractor_id).maybeSingle();

    await supabaseAdmin.from('notifications').insert({
      user_id: payment.contractor_id,
      type: 'system',
      title: decision === 'approved' ? 'Payment approved' : 'Payment request not approved',
      message: `${payment.currency} ${Number(payment.amount).toLocaleString()} — ${payment.description}`,
    });
    await notifyContractorPaymentDecision(supabaseAdmin, updated, contractor);

    return res.status(200).json({ success: true, payment: updated });
  } catch (err) {
    return contractorPaymentFailure(res, err, 'decideContractorPayment');
  }
}

// List an auditor's uploaded certificates/CV with short-lived download links.
// Added so the admin View popup (AdminAuditors) can show "full details, not a
// summary" — the Edit form lets an admin ADD documents but never showed what
// was already on file. Same access rule as addAuditorDocument: the auditor
// themselves, the super admin, or a regional admin scoped to that auditor's
// region. Signed with the service role, same reasoning as the upload path —
// an admin viewing someone else's files has a different auth.uid() than the
// folder owner, so a direct client-side createSignedUrl would need a storage
// policy wider than any of these callers should have.
const DOC_SIGNED_URL_TTL = 60 * 5;

async function listAuditorDocuments(req, res) {
  const { auditorId } = req.body;
  if (!auditorId) return res.status(400).json({ error: 'Missing auditorId parameter' });

  const access = await resolveAuditorWriteAccess(req, auditorId, { allowBootstrap: false });
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { data: docs, error } = await supabaseAdmin
    .from('auditor_documents')
    .select('id, doc_type, file_name, storage_path, mime_type, size_bytes, created_at')
    .eq('auditor_id', auditorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listAuditorDocuments: query failed', error);
    return res.status(500).json({ error: 'Could not load the auditor\'s documents.' });
  }

  const withUrls = await Promise.all((docs || []).map(async (doc) => {
    const { data: signed } = await supabaseAdmin.storage
      .from(AUDITOR_DOC_BUCKET)
      .createSignedUrl(doc.storage_path, DOC_SIGNED_URL_TTL, { download: doc.file_name });
    return { ...doc, url: signed?.signedUrl || null };
  }));

  return res.status(200).json({ documents: withUrls });
}

// Persist the three qualification arrays.
// Only the self-registration wizard needs this: it has no session, so it cannot
// use update-profile's admin-shaped path, and the arrays are not carried by
// AuthContext.signup(). Admin edits go through update-profile as usual.
async function saveAuditorQualifications(req, res) {
  const { auditorId, standards, levels, sectors } = req.body;

  const access = await resolveAuditorWriteAccess(req, auditorId);
  if (access.error) return res.status(access.status).json({ error: access.error });

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      auditor_standards: sanitizeAuditorTags(standards),
      auditor_levels: sanitizeAuditorTags(levels),
      auditor_sectors: sanitizeAuditorTags(sectors),
    })
    .eq('id', auditorId);

  if (error) {
    console.error('saveAuditorQualifications failed', error);
    return res.status(500).json({
      error: /auditor_(standards|levels|sectors)/.test(error.message || '')
        ? 'The auditor profile columns are missing. Run supabase/phase24_auditor_profile.sql.'
        : 'Could not save the auditor qualifications.',
    });
  }

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
