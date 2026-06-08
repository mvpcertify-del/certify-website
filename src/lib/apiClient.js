// ============================================
// Certify.cx — Authenticated API client helper
// ============================================
// Single entry point for calling the serverless functions in /api.
//
// Why this exists:
//   1. Auth — attaches the current Supabase access token as a Bearer header so
//      protected endpoints (delete-user, set-active) can verify the caller.
//   2. Robust parsing — the platform (Vercel) returns PLAIN-TEXT bodies for
//      crashes/timeouts (e.g. "A server error has occurred."). Calling
//      response.json() on those throws "Unexpected token 'A'... is not valid
//      JSON" and hides the real failure. We read text first, then parse
//      defensively, so callers always get a readable Error message.

import { supabase } from './supabase';

/**
 * POST JSON to an /api route with the caller's auth token attached.
 * Resolves to the parsed JSON body on success.
 * Throws an Error with a human-readable message on any non-2xx or non-JSON
 * response (never throws a raw "Unexpected token" SyntaxError).
 *
 * @param {string} path  e.g. '/api/delete-user'
 * @param {object} body  request payload (serialized to JSON)
 */
export async function apiPost(path, body = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    // No session — request goes out unauthenticated and the server decides.
  }

  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(networkErr?.message || 'Network request failed');
  }

  // Read as text first so a non-JSON error body never crashes the parse.
  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      // Body was not JSON (platform 500/timeout, HTML error page, etc.).
      data = { error: raw.trim().slice(0, 300) };
    }
  }

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (HTTP ${response.status})`
    );
  }

  return data;
}
