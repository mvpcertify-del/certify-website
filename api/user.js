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
import { ROLES, getRegionFromCountry } from '../src/utils/roles.js';
import { sanitizeAuditorTags } from '../src/utils/auditorOptions.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_ROLES = Object.values(ROLES);

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
    // Auditor professional profile (phase24). Same reason as the contract
    // actions above: api/ is at the Vercel Hobby 12-route ceiling.
    if (action === 'add-auditor-document') return await addAuditorDocument(req, res);
    if (action === 'save-auditor-qualifications') return await saveAuditorQualifications(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('User route error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
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
  let { role, region, email, stakeholder_type, approval_status } = req.body;

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
    .select('id, role, region, email, stakeholder_type, approval_status')
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
  const PRIVILEGED = { role, region, email, stakeholder_type, approval_status };
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
      const derived = getRegionFromCountry(country);
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
  // Was completely unauthenticated: a bare POST could hand anyone super_admin.
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { userId, newRole } = req.body;

  if (!userId || !newRole) {
    return res.status(400).json({ error: 'Missing required fields: userId, newRole' });
  }

  if (!VALID_ROLES.includes(newRole)) {
    return res.status(400).json({ error: 'Unknown role' });
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

// ---------------------------------------------------------------------------
// Auditor professional profile (phase24)
// ---------------------------------------------------------------------------
const AUDITOR_DOC_TYPES = ['certificate', 'audit_log', 'cv', 'other'];
const AUDITOR_DOC_BUCKET = 'auditor-documents';
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
// Returns { target, actorId } or { error, status }.
async function resolveAuditorWriteAccess(req, auditorId) {
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

  // No session at all — registration bootstrap only (see the note above).
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(auditorId);
  if (authUser?.user?.email_confirmed_at) {
    return { error: 'Unauthorized: sign in to update this auditor', status: 401 };
  }
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
