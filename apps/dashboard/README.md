# Marketingovo Control Panel

React 19 and Vite dashboard for the local Marketingovo daemon. The production
dashboard is served from the same `127.0.0.1:3210` origin as `/api/v1`, so CORS
is neither required nor enabled.

```bash
corepack enable
pnpm install
pnpm --filter @marketingovo/dashboard dev
```

The Vite server listens on `127.0.0.1:4318` and proxies `/api` to the local
daemon on `127.0.0.1:3210`. The proxy rewrites the request origin to the daemon
origin so development mutations pass the same strict CSRF check used in the
bundled product. Keep `VITE_API_BASE_URL` same-origin; the daemon intentionally
does not enable CORS.

The normal product entry point is `pnpm marketingovo serve`, which prints a
one-time dashboard URL. Its token exists only in the URL fragment, is exchanged
for an HttpOnly SameSite session, and is immediately removed from the address
bar. Mutations use an in-memory CSRF token. No credential, service token, or
OAuth value is stored in browser storage.

The dashboard consumes the versioned `/api/v1` runtime and never fabricates
metric values. Fresh, stale, missing, unavailable, and failed states remain
distinct. Credential forms submit write-only values and render only masked
metadata returned by the daemon.

## Languages

The console ships in English, Azerbaijani, German, Russian, Dutch, and
Spanish. The picker lives in the top command bar (`--lang=`) and in
Settings → Language; the choice is stored per device in `localStorage` and
falls back to the browser language, then English. Locale catalogs live in
`src/i18n/messages/<code>/` as one file per page namespace. English is the
reference: every other locale must satisfy its exact key tree (enforced by
`tsc`), keep every `{placeholder}` marker (enforced by `src/tests/i18n.test.tsx`),
and leave brand names, code literals, and API data untranslated. Numbers and
dates format through `Intl` with the active locale. Data, generated reports,
and agent surfaces are not translated.
