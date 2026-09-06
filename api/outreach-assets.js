// ============================================================================
// Outreach briefing documents — the per-standard attachment library (phase32)
// ============================================================================
// The client asked (27 Aug) that a referral partner be able to send a proposal
// letter "+ Attach file" to their leads, and supplied exactly ONE file: a
// four-page ISO 21001 briefing note.
//
// One file is not a feature. A partner pitching ISO 45001 must not receive an
// ISO 21001 briefing stapled to their letter, and hard-coding the single PDF
// would guarantee exactly that. So the attachment is looked up BY STANDARD,
// and this endpoint is where a Super Admin fills the library in over time —
// no code change, no redeploy, one upload per standard.
//
// A standard with no document simply sends the letter without an attachment
// (see api/referrals.js, sendOutreach). That is the honest fallback: it is
// better to send a good letter with nothing attached than a good letter with
// the wrong document attached.
//
// Auth: Super Admin only, for every write. A regional admin cannot change what
// goes out under the company's name globally, and a partner certainly cannot.
// Reads are served straight from Postgres by the browser — the table's RLS
// grants SELECT to any authenticated user, because "does ISO 45001 have a
// briefing note?" is not a secret and the partner's send form needs the answer.
//
// The BYTES are private. The bucket has no public flag and no storage.objects
// policy, so the only reader is the service role, at send time. Sales
// collateral is not confidential, but a public bucket is an enumerable,
// hotlinkable directory of every document the company has ever produced, and
// there is no reason to offer one.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { verifyAdmin, verifySession } from './_verifyAdmin.js';
import { ISO_CATALOG } from '../src/utils/isoCatalog.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BUCKET = 'outreach-assets';

// The document arrives base64-encoded inside the JSON body, which is the
// simplest path that keeps the bucket free of any browser-facing policy. The
// ceiling is set by the platform, not by taste: a Vercel serverless function
// rejects a request body over 4.5 MB, and base64 inflates bytes by ~33%. 3 MB
// of PDF encodes to ~4 MB, which clears it with room for the rest of the JSON.
//
// It is also the right size for the job — this is an email attachment. Mail
// servers commonly bounce messages over 10 MB total, and a 3 MB brochure is
// already a big ask of a stranger's inbox. The client's own ISO 21001 note is
// 409 KB.
const MAX_BYTES = 3 * 1024 * 1024;

// PDF only. The letter says "I have attached a short briefing note"; a .docx
// or a .pptx would be both off-message and a far more dangerous thing to mail
// to strangers from a shared domain.
const ALLOWED_TYPE = 'application/pdf';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const action = req.body?.action;

  try {
    if (action === 'list') return await listAssets(req, res);
    if (action === 'partner-list') return await listForPartner(req, res);
    if (action === 'partner-download') return await downloadForPartner(req, res);
    if (action === 'upload') return await uploadAsset(req, res);
    if (action === 'delete') return await deleteAsset(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    // Log the detail server-side; never hand raw Postgres/PostgREST text to the
    // caller — combined with a crafted input it is a schema-probing leak.
    console.error(`outreach-assets action "${action}" error:`, error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

// ---- List what the library currently holds ---------------------------------
async function listAssets(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { data, error } = await supabaseAdmin
    .from('outreach_assets')
    .select('id, standard_slug, file_name, byte_size, created_at, updated_at')
    .order('standard_slug');

  if (error) {
    console.error('outreach-assets list error:', error.message);
    return res.status(500).json({ error: 'Could not load the document library.' });
  }

  return res.status(200).json({ assets: data || [] });
}

// ---- The partner's own view of the library ---------------------------------
//
// Who counts as an audience for the partner library: the partners it was
// written for, plus the admins who manage it. Not "any signed-in user" — the
// bytes are sales collateral rather than a secret, but a client account has no
// business enumerating the company's whole outreach library, and a role check
// costs nothing here.
const canUsePartnerLibrary = (role) =>
  role === 'referral' || role === 'consultancy'
  || role === 'super_admin' || role === 'regional_admin';

//
// Added 6 Sep for the Marketing Material box on the Referral Program Dashboard:
// the client asked that a partner be able to see, and send, the collateral —
// "if they are targeting a School or University: ISO 21001 Email content + PDF
// attachment". Until now a partner could only learn a document existed by
// opening the proposal composer and picking a standard.
//
// Separate from `list` rather than relaxing it: `list` is an admin management
// view and its shape is free to grow with admin-only columns (who uploaded it,
// storage path). This one returns the four fields a partner needs and nothing
// else, so widening the admin view can never widen what a partner sees.
async function listForPartner(req, res) {
  const auth = await verifySession(req);
  if (auth.error) return res.status(auth.status).json({ error: 'Please sign in again' });
  if (!canUsePartnerLibrary(auth.caller?.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { data, error } = await supabaseAdmin
    .from('outreach_assets')
    .select('standard_slug, file_name, byte_size, updated_at')
    .order('standard_slug');

  if (error) {
    console.error('outreach-assets partner-list error:', error.message);
    return res.status(500).json({ error: 'Could not load the materials.' });
  }

  return res.status(200).json({ assets: data || [] });
}

// ---- A time-limited link to one document -----------------------------------
//
// The bucket stays private. A signed URL is minted per request and expires, so
// nothing here turns the library into the enumerable public directory the
// header of this file rules out. The partner is authenticated; the link they
// receive is not a permanent one they can post anywhere.
const SIGNED_URL_TTL_SECONDS = 300;

async function downloadForPartner(req, res) {
  const auth = await verifySession(req);
  if (auth.error) return res.status(auth.status).json({ error: 'Please sign in again' });
  if (!canUsePartnerLibrary(auth.caller?.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { standardSlug } = req.body || {};
  // Validated against the catalogue, not merely non-empty: the slug reaches a
  // storage path, and "any string the browser sent" is the wrong thing to put
  // there even when the lookup below would fail anyway.
  if (!standardSlug || !ISO_CATALOG[standardSlug]) {
    return res.status(400).json({ error: 'Unknown standard' });
  }

  const { data: asset } = await supabaseAdmin
    .from('outreach_assets')
    .select('file_name, storage_path')
    .eq('standard_slug', standardSlug)
    .maybeSingle();

  if (!asset?.storage_path) {
    return res.status(404).json({ error: 'There is no document for that standard yet.' });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: asset.file_name,
    });

  if (error || !data?.signedUrl) {
    console.error('outreach-assets sign error:', error?.message);
    return res.status(500).json({ error: 'Could not open that document.' });
  }

  return res.status(200).json({ url: data.signedUrl, fileName: asset.file_name });
}

// ---- Upload (or replace) the document for one standard ---------------------
async function uploadAsset(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { standardSlug, fileName, contentBase64 } = req.body || {};

  // The slug is the join between this library and the letter. Validating it
  // against the real catalogue — rather than accepting any string — is what
  // stops the table filling with typo'd rows that no send will ever match.
  if (!standardSlug || !ISO_CATALOG[standardSlug]) {
    return res.status(400).json({ error: 'Unknown standard' });
  }
  if (typeof contentBase64 !== 'string' || !contentBase64) {
    return res.status(400).json({ error: 'No file received' });
  }

  let bytes;
  try {
    bytes = Buffer.from(contentBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'The file could not be read' });
  }
  if (!bytes.length) return res.status(400).json({ error: 'The file is empty' });
  if (bytes.length > MAX_BYTES) {
    return res.status(413).json({ error: `The document must be under ${MAX_BYTES / (1024 * 1024)} MB.` });
  }

  // Check the magic number, not the filename. An extension is a claim made by
  // whoever uploads; "%PDF-" is the file telling us what it is.
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return res.status(400).json({ error: 'That file is not a PDF' });
  }

  // The stored name is derived from the slug, never from the uploaded
  // filename — a user-supplied name is a path-traversal input, and a stable
  // key is what makes a re-upload replace rather than accumulate.
  const storagePath = `${standardSlug}.pdf`;

  // The name the RECIPIENT sees, which does come from the upload. Stripped of
  // any directory component and length-capped; it is echoed into email text.
  const safeName = String(fileName || `${standardSlug}.pdf`)
    .replace(/[\\/]/g, '')
    .replace(/[\r\n]/g, '')
    .trim()
    .slice(0, 120) || `${standardSlug}.pdf`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: ALLOWED_TYPE, upsert: true });

  if (upErr) {
    console.error('outreach-assets upload error:', upErr.message);
    return res.status(500).json({ error: 'Could not store the document.' });
  }

  const { data, error } = await supabaseAdmin
    .from('outreach_assets')
    .upsert(
      {
        standard_slug: standardSlug,
        file_name: safeName,
        storage_path: storagePath,
        byte_size: bytes.length,
        content_type: ALLOWED_TYPE,
        uploaded_by: auth.caller?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'standard_slug' },
    )
    .select('id, standard_slug, file_name, byte_size, updated_at')
    .single();

  if (error) {
    console.error('outreach-assets upsert error:', error.message);
    return res.status(500).json({ error: 'Could not save the document record.' });
  }

  return res.status(200).json({ ok: true, asset: data });
}

// ---- Remove the document for one standard ----------------------------------
async function deleteAsset(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { standardSlug } = req.body || {};
  if (!standardSlug || !ISO_CATALOG[standardSlug]) {
    return res.status(400).json({ error: 'Unknown standard' });
  }

  // Row first, then object. If the object removal fails the row is already
  // gone, so no letter can reference a file that may not be there; an orphaned
  // object costs a few hundred KB. The other order can leave a row pointing at
  // nothing, which fails at send time in front of a partner.
  const { error } = await supabaseAdmin
    .from('outreach_assets')
    .delete()
    .eq('standard_slug', standardSlug);

  if (error) {
    console.error('outreach-assets delete error:', error.message);
    return res.status(500).json({ error: 'Could not remove the document.' });
  }

  await supabaseAdmin.storage.from(BUCKET).remove([`${standardSlug}.pdf`]).catch(() => {});

  return res.status(200).json({ ok: true });
}
