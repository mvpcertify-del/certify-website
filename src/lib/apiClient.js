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
import i18n from '../i18n/i18n';

/**
 * POST JSON to an /api route with the caller's auth token attached.
 * Resolves to the parsed JSON body on success.
 * Throws an Error with a human-readable message on any non-2xx or non-JSON
 * response (never throws a raw "Unexpected token" SyntaxError).
 *
 * @param {string} path  e.g. '/api/user'
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
    // "Failed to fetch" is what the browser says and it tells the user nothing.
    // The real text is kept in the console for whoever is debugging.
    console.error(`apiPost ${path}: network error`, networkErr);
    throw new Error(i18n.t('common.networkError'));
  }

  // Read as text first so a non-JSON error body never crashes the parse.
  const raw = await response.text();
  let data = {};
  let bodyWasJson = false;
  if (raw) {
    try {
      data = JSON.parse(raw);
      bodyWasJson = true;
    } catch {
      // Body was not JSON. This used to become the user's error message:
      //   data = { error: raw.trim().slice(0, 300) }
      // On 9 Sep a referral partner pressed Send on Marketing Tools and was
      // shown 300 characters of a Cloudflare error page — "<!DOCTYPE html>
      // <!--[if lt IE 7]> <html class="no-js ie6 oldie" ..." — as if it were
      // advice. Every screen in the app renders a caught message this way
      // (roughly thirty of them), so the guard belongs here, once, rather than
      // in each of them.
      //
      // The raw body still goes to the console: whoever is debugging needs it,
      // and the person trying to send an email does not.
      console.error(`apiPost ${path}: non-JSON response (HTTP ${response.status})`, raw.slice(0, 1000));
      data = {};
    }
  }

  if (!response.ok) {
    // Only a message the SERVER meant for a human is shown. A body that failed
    // to parse leaves `data` empty, so this falls through to the translated
    // line below rather than surfacing markup.
    const serverMessage = bodyWasJson
      ? (typeof data.error === 'string' ? data.error : null)
        || (typeof data.message === 'string' ? data.message : null)
      : null;

    // 502/503/504 are the platform or the CDN, not the request: "try again"
    // is genuinely the right advice and blaming the user's input would be
    // wrong. Anything else gets the generic line with its status, which is
    // what a support conversation actually needs.
    const fallback = [502, 503, 504].includes(response.status)
      ? i18n.t('common.serverBusy')
      : i18n.t('common.requestFailed', { status: response.status });

    throw new Error(serverMessage || fallback);
  }

  return data;
}
