# Caching rules in `vercel.json`

`vercel.json` is strict JSON and cannot carry comments, so the reasoning for the
`headers` block lives here.

## `/assets/(.*)` → `public, max-age=31536000, immutable`

Vite emits every JavaScript and CSS chunk with a content hash in its filename
(`index-D9hoJC8c.js`, `vendor-react-DlZRo9fP.js`). A given URL under `/assets/`
can therefore never change content — if the code changes, the filename changes.

Marking them `immutable` lets a returning visitor start the app straight from
disk cache instead of re-validating roughly 600 kB of JavaScript against the
network on every visit. This is the single biggest win for the "Certify.cx takes
a long time to open" report, because the people who open it most often are the
admins who open it several times a day.

It cannot serve stale code: a deploy produces new filenames, and `index.html`
(which names them) is not cached.

## `/brand-mark.png` → `public, max-age=86400, must-revalidate`

The brand mark is the tab icon, the first-paint splash image in `index.html`,
and the image in every link preview. It is **not** content-hashed — it is served
from `public/` at a fixed path — so it gets a one-day cache with revalidation
rather than `immutable`. Replacing the logo then takes at most a day to reach
everyone, instead of a year.

## Why `index.html` is not listed

Vercel already serves HTML with no-cache semantics, and header rules match the
**request** path rather than the rewritten destination — a request for
`/admin/auditors` is rewritten to `/index.html` but would never match a rule
whose `source` is `/index.html`. Listing it would look like protection that
isn't there.

`index.html` must stay uncached regardless: it is the file that names the
current hashed chunks, so a cached copy taken before a deploy points at chunk
files that no longer exist. That is the failure `main.jsx`'s `vite:preloadError`
handler and `App.jsx`'s `lazy()` wrapper exist to recover from.
