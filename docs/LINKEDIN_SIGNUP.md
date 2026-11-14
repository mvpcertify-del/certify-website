# LinkedIn registration and sign-in

Requested by the client (boss), Nov 2026: "Add LinkedIn registration for all stakeholders."

## What it does

A **Continue with LinkedIn** button on the login page, the client sign-up page and the partner registrations.
The person approves on LinkedIn, comes back signed in, and their profile is created from the registration door
they used (the page they started on). Name and email come from LinkedIn.

| Registration | LinkedIn alone | Why |
|---|---|---|
| Client (`/signup`) | Yes | Name and email are enough |
| Consultancy, Referral / affiliate, Certification body | Yes | Same |
| Auditor | **No** | Needs qualification files; keeps its own wizard |
| Contractor | **No** | Needs documents, an agreement and admin approval; keeps its own wizard |

The button is simply not shown on the auditor and contractor registrations. Everything else about approval is
unchanged (a contractor still waits for a Super Admin).

## Security

- The browser never picks its own role. It names the registration door; `api/_oauthSignup.js` decides, on the
  server, which role that earns (four doors, no admin role possible).
- Only for the person's own profile, only from LinkedIn, only with a confirmed email, and only while the profile
  has no role yet. Someone who already has a role can never change it this way.
- Covered by `tests/auth/oauth-signup.test.mjs`.

## Switch it on (one-time setup, by the account owner)

The button stays hidden until LinkedIn is connected.

1. **LinkedIn Developer Portal:** create an app, add the product **Sign In with LinkedIn using OpenID Connect**.
   Under Auth, add the redirect URL shown in Supabase (Authentication → Providers → LinkedIn (OIDC)),
   for this project `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase:** Authentication → Providers → **LinkedIn (OIDC)** → enable, paste the app's Client ID and Client
   Secret. Do not paste the secret anywhere else (not in chat, not in the repo).
3. **Supabase:** Authentication → URL Configuration → add `https://certify.cx/auth/callback` to the redirect URLs.
4. **Vercel:** add the environment variable `VITE_LINKEDIN_LOGIN_ENABLED=true` (Production, and Preview if wanted)
   and redeploy. The flag is read at build time.

To turn it off again, remove the variable and redeploy.

## Files

New: `api/_oauthSignup.js`, `src/components/auth/LinkedInButton.jsx`, `tests/auth/oauth-signup.test.mjs`.
Changed: `api/user.js` (first-sign-in profile setup), `api/_verifyAdmin.js` (email-confirmed flag),
`src/contexts/AuthContext.jsx` (`signInWithLinkedIn`, profile setup after the round-trip),
`src/config/loginMode.js` (flag, door list), `src/pages/auth/Login.jsx`, `src/pages/auth/SignUp.jsx`,
`src/pages/auth/Auth.css`, all nine locale files.
