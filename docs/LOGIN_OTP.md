# Email one-time-code login (and Google sign-in removed)

Requested by the client (boss), 12 Nov 2026: OTP-based login with a six-digit code sent to the user's registered email, and Google sign-in removed completely.

## How it works

| Step | What happens |
|---|---|
| Sign up | The person fills in the sign-up form (no password asked in code-login mode). The account is created, then the login page opens and the first code is emailed. |
| Sign in | Email address, then a six-digit code, then signed in. |
| The code | Generated, expired (set in Supabase), rate-limited and checked **by Supabase Auth** (`signInWithOtp` and `verifyOtp`). This app only asks for the address and then the code. |
| The email | Supabase's Send Email Hook (`api/auth-email-hook.js`) sends it through Resend using the new `loginOtpEmail` template. The email shows the code, not a link. |
| Account rules | After a correct code the same checks as before apply: a deactivated, pending or declined account is signed out again with a clear message. |
| Unknown address | A code is only ever sent to an address that already has an account (`shouldCreateUser: false`), and the page says the same thing either way, so it does not reveal who has an account. |

Not signed up through Google any more: the button, the OAuth code and the server-side "Google role bootstrap" in `api/user.js` are gone. People who used to sign in with Google keep their account (same email); they now sign in with a code sent to that email.

## The switch

Code login is controlled by the **build-time** variable `VITE_LOGIN_OTP_ENABLED`.

- `true`: code login on. Sign-up asks for no password. The Forgot-password link is hidden.
- anything else (the default): the old password login stays. Google is gone in both modes.

Changing it needs a Vercel environment change plus a **redeploy**.

**Rollback caveat:** an account created while code login is on has a random password nobody knows. If the switch is turned off later, those people sign in with "Forgot password" (the reset email still works).

## Settings to check in Supabase (Authentication)

1. **Providers, Email:** enabled. **OTP length: 6.** **OTP expiry: 600 seconds** (the email says 10 minutes; change `minutes` in `loginOtpEmail` if you pick a different value).
2. **Hooks:** the Send Email Hook already points at `/api/auth-email-hook` (it is how recovery emails are sent).
3. **Rate limits:** check the sign-in and email limits suit your traffic. Supabase also enforces a short wait between codes to the same address; the page shows a 60 second resend timer.

## Files

New: `src/config/loginMode.js`, `docs/LOGIN_OTP.md`, `tests/auth/login-otp.test.mjs`.
Changed: `src/pages/auth/Login.jsx` (two-step code login), `src/pages/auth/SignUp.jsx` (no password in code mode, then to login), `src/pages/auth/Auth.css`, `src/pages/public/StartCheckout.jsx`, `src/contexts/AuthContext.jsx` (`requestLoginOtp`, `verifyLoginOtp`, shared account checks; Google removed), `api/auth-email-hook.js`, `api/_emailTemplates.js` (`loginOtpEmail`), `api/user.js` (Google bootstrap removed), `src/i18n/locales/en.json`, `package.json` (`npm test`).

## Security note

This is **email-code sign-in**: possession of the mailbox is the proof. It avoids the weakness of bolting a code onto a password (Supabase's public password endpoint would still allow signing in without the code), because there is no password to use. It is not a second factor on top of a password. For admin accounts the strongest option, if the client wants it later, is an authenticator app (Supabase MFA).

## Tests

`npm test` runs the Odoo tests and the new auth tests (12): the code email, the hook's template choice, the six-digit rule, how a failed code request is classified, and the throw-away signup password.
