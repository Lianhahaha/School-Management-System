> Part of the design set for the School Management System. The project contract is `docs/PROJECT_PLAN.md`; where this document and the plan disagree, the plan wins (see its Decisions log, section 5).

# Fact-check: free tiers and current versions (verified 2026-10-03)

Scope: School Management System test project (Node/Express 5 + mysql2 + firebase-admin + zod + swagger-ui-express; React + Vite + React Router + TanStack Query + Tailwind + firebase JS SDK). Hard constraint: $0, no credit card. Dev box: Windows 11, Node v24.16.0, npm 11.13.0, MySQL 8.0 local (service MySQL80), no Docker. Java found locally: OpenJDK 25.0.3 (BellSoft) on PATH, plus Zulu 21 and Adoptium 17.

Method: package versions/engines/publish dates pulled live from the npm registry (`npm view ... dist-tags engines time`); published tarballs of firebase-admin@14.5.0 and firebase-tools@15.32.1 were unpacked and inspected; everything else from the cited primary pages. Third-party sources are marked as such.

---

## Claim 1 - Firebase Spark plan exists; Email/Password auth is free with no card

| Claim | Verdict | Evidence | Source |
|---|---|---|---|
| Spark (no-cost) plan exists in 2026, no credit card | TRUE | Pricing table still has a Spark column; "No payment method needed". | https://firebase.google.com/pricing |
| Email/Password auth free on Spark | TRUE | "Other Authentication services": check in Spark column. "Monthly active users: 50K MAUs" (Spark); SAML/OIDC "50 MAUs". | https://firebase.google.com/pricing |
| Phone auth free on Spark | FALSE | Pricing: Phone Auth Spark = "Not applicable". Limits page: "Verification code SMS messages: Pay as you go (Blaze) plan only." | https://firebase.google.com/docs/auth/limits |
| Identity Platform upgrade requires Blaze | FALSE (but avoid) | Upgrade is a toggle in Authentication > Settings; "does not require migrating to Blaze". On Spark an upgraded project is capped at "Tier 1 Daily Active Users: 3000 per day", "Tier 2 Daily Active Users: 2 per day". Blaze: 50K MAU free then $0.0025-$0.0055/MAU. Legacy (non-upgraded) auth has no documented MAU cap. | https://firebase.google.com/docs/auth#identity-platform , https://firebase.google.com/docs/auth/limits |
| Cloud Storage now needs Blaze | TRUE (irrelevant to Auth) | "This requirement went into effect starting February 03, 2026"; Spark projects cannot provision a bucket and existing Spark buckets "lose read/write access". Page states it does not affect Authentication or Hosting. | https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 |
| Admin SDK createUser / verifyIdToken / custom claims affected by any of the above | FALSE | No per-operation pricing exists for Auth; only MAU pricing (Identity Platform on Blaze) and rate quotas apply. Identity Toolkit API: "Operations per service account: 500 requests/second", "Operations per project: 1000 requests/second, 10 million requests/day". | https://firebase.google.com/docs/auth/limits , https://firebase.google.com/pricing |
| Spark email quotas (relevant to email/password flows) | NOTE | Spark/day: address verification emails 1,000; password reset emails 150; email-link sign-in 5 (Blaze: 25,000). | https://firebase.google.com/docs/auth/limits |
| Email enumeration protection default | NOTE | "If you created your project on or after September 15, 2023, email enumeration protection is enabled by default." Wrong password and unknown user both return INVALID_LOGIN_CREDENTIALS; fetchSignInMethodsForEmail returns nothing. | https://docs.cloud.google.com/identity-platform/docs/admin/email-enumeration-protection |

## Claim 2 - firebase-admin Node SDK

| Claim | Verdict | Evidence | Source |
|---|---|---|---|
| Current major | 14 | `latest` = 14.5.0 (published 2026-09-23). engines `node >= 22`. | https://www.npmjs.com/package/firebase-admin , https://firebase.google.com/support/release-notes/admin/node |
| v14 breaking changes | NOTE | 14.0.0 (8 June 2026): "Dropped support for Node.js 18 and 20", "Removed legacy namespace support. To import Admin SDK APIs you should use the ES module entry points", removed Instance ID API. Verified in the 14.5.0 tarball: the root `firebase-admin` export only exposes initializeApp/getApp/getApps/deleteApp/applicationDefault/cert/refreshToken/FirebaseError/SDK_VERSION - `admin.auth()` no longer exists. Use `require('firebase-admin/app')` + `require('firebase-admin/auth').getAuth()`; both `require` and `import` conditions are present in the exports map (CJS still fine). 13.0.0 (2024-11-12) dropped Node 14/16. | https://firebase.google.com/support/release-notes/admin/node |
| verifyIdToken works with a free console-downloaded service-account JSON | TRUE | Initialize with `cert(serviceAccountJson)` or GOOGLE_APPLICATION_CREDENTIALS; verification checks signature against Google public keys, expiry (about 1 hour); no per-call network round-trip unless `checkRevoked`. Key download is free. | https://firebase.google.com/docs/auth/admin/verify-id-tokens |
| SA key creation blocked by GCP policy? | FALSE for personal accounts | `iam.managed.disableServiceAccountKeyCreation` is "enforced for all organizations created on or after May 3, 2024"; a Gmail-owned Firebase project has no organization resource, so it is not covered. | https://docs.cloud.google.com/resource-manager/docs/secure-by-default-organizations |
| createUser / updateUser({disabled}) / setCustomUserClaims are free | TRUE | No cost rows exist; only quotas. Custom claims "must not exceed 1000 bytes"; "propagate to the user's ID token the next time a new one is issued" (force with `currentUser.getIdToken(true)`). | https://firebase.google.com/docs/auth/admin/custom-claims |
| Quotas relevant to seeding ~30 users | OK | "New account creation: 100 accounts/hour for each IP address" (doc does not scope it to client vs Admin SDK - stay under 100/hour), "Account configuration updates: 10 requests/second", Identity Toolkit 500 req/s per service account. Bulk alternative: `importUsers()` "Up to 1000 users can be imported in a single API call." 30 sequential createUser calls are far inside every limit. | https://firebase.google.com/docs/auth/limits , https://firebase.google.com/docs/auth/admin/import-users |

## Claim 3 - Firebase Local Emulator Suite / Auth emulator

| Claim | Verdict | Evidence | Source |
|---|---|---|---|
| Auth emulator is free and works offline on Windows | TRUE | Emulator Suite is part of firebase-tools (npm). Offline: `firebase emulators:start --only auth --project demo-anything` - "demo-" projects need no real Firebase project; "no chance of data change, usage and billing". Client: `connectAuthEmulator(auth, "http://127.0.0.1:9099")`. Admin SDK: `FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"` - then "Firebase Admin SDKs will accept unsigned ID Tokens". Default Auth port 9099. | https://firebase.google.com/docs/emulator-suite/connect_auth , https://firebase.google.com/docs/emulator-suite/install_and_configure |
| Needs Java? | PARTIAL - not for Auth-only | Docs: "Node.js version 16.0 or higher. Java JDK version 11 or higher" and "The Realtime Database emulator, Cloud Firestore emulator, and part of Cloud Storage for Firebase emulator are based on Java." Code in the published firebase-tools 15.32.1: `requiresJava(emulator)` is true only when `Commands[emulator].binary === "java"` (database, firestore, storage); `checkJavaMajorVersion()` only runs `if (targets.some(requiresJava))`; `MIN_SUPPORTED_JAVA_MAJOR_VERSION = 21` ("firebase-tools no longer supports Java version before 21"). So: Auth-only = no Java; add Firestore/RTDB/Storage emulators = JDK 21+ (docs' "11" is stale). firebase-tools engines: `node >=20.0.0 || >=22.0.0 || >=24.0.0`. | https://github.com/firebase/firebase-tools/blob/v15.32.1/src/emulator/downloadableEmulators.ts , https://github.com/firebase/firebase-tools/blob/v15.32.1/src/emulator/commandUtils.ts , https://firebase.google.com/docs/emulator-suite/install_and_configure |
| Exact requirement for this project | - | firebase-tools 15.32.1 (2026-09-30), Node >= 20 (have 24.16). Java: none for `--only auth`; this machine has JDK 25/21/17 anyway, so the Firestore emulator would also work. | as above |

## Claim 4 - Express 5

| Claim | Verdict | Evidence | Source |
|---|---|---|---|
| Express 5 is npm `latest` | TRUE | dist-tags: `latest: 5.2.1` (published 2025-12-01), `latest-4: 4.22.3`. v5.1.0 became `latest` on 2025-03-31. Express 4 is in maintenance; EOL "no sooner than 2026-10-01". Express 5 EOL "no sooner than 2027-04-01". | https://www.npmjs.com/package/express , https://expressjs.com/en/blog/2025-03-31-v5-1-latest-release |
| Node requirement | - | engines `node >= 18`. | https://expressjs.com/en/guide/migrating-5.html |
| Async errors forwarded automatically | TRUE | "Rejected promises in middleware/handlers: errors are now automatically forwarded to error handling middleware" - `async (req,res)=>{...}` without try/catch is fine. | https://expressjs.com/en/guide/migrating-5.html |
| path-to-regexp syntax change | TRUE | Wildcards must be named: `/*splat` (or `/{*splat}`); optional segments use braces `/:file{.:ext}` (no `?`); regex characters inside string paths are not supported (use arrays or RegExp). `req.params` wildcard values are arrays. | https://expressjs.com/en/guide/migrating-5.html |
| req.query getter | TRUE | "req.query is now a getter"; not writable; default parser is "simple" (was "extended") - nested `?a[b]=1` is not parsed unless `app.set('query parser','extended')`. | https://expressjs.com/en/guide/migrating-5.html |
| res.send(status) removed | TRUE | `res.send(200)` -> `res.sendStatus(200)`; `res.json(obj, status)`/`res.send(body, status)` -> `res.status(s).json/send`; `res.redirect('back')`, `app.del`, `req.param()`, `res.sendfile` removed. Also: `req.body` is `undefined` without a body parser; `res.status()` only accepts integers 100-999; `express.urlencoded` `extended` defaults to false; `app.listen` callback receives an error argument; `express.static` `dotfiles` defaults to "ignore". Codemod: `npx codemod@latest @expressjs/v5-migration-recipe`. | https://expressjs.com/en/guide/migrating-5.html |

## Claim 5 - mysql2

| Claim | Verdict | Evidence | Source |
|---|---|---|---|
| Current version | 3.24.5 | published 2026-09-29; engines `node >= 8.0`. (Ignore stale `next: 3.0.0-rc.1` / `beta: 2.0.0-alpha1` tags.) | https://www.npmjs.com/package/mysql2 |
| Node 24 supported | TRUE | CI matrix `node-version: [18, 20, 22, 24]` against `mysql:8.3` and `mariadb:11.8`. | https://github.com/sidorares/node-mysql2/blob/master/.github/workflows/ci-linux.yml |
| caching_sha2_password (MySQL 8 default) | TRUE | Plugin implemented in `lib/auth_plugins/caching_sha2_password.js`: fast-auth path; over non-TLS it sends REQUEST_SERVER_KEY_PACKET to fetch the server RSA key automatically and RSA-OAEP-encrypts the password; options `serverPublicKey`, `overrideIsSecure`. MySQL: "In MySQL 8.0, caching_sha2_password is the default authentication plugin rather than mysql_native_password." Plain TCP to 127.0.0.1 works without SSL config. | https://github.com/sidorares/node-mysql2/blob/master/lib/auth_plugins/caching_sha2_password.js , https://dev.mysql.com/doc/refman/8.0/en/caching-sha2-pluggable-authentication.html |
| `dateStrings` option | TRUE | `dateStrings?: boolean | Array<'TIMESTAMP'|'DATETIME'|'DATE'>` - "Force date types ... to be returned as strings rather then inflated into JavaScript Date objects." | https://github.com/sidorares/node-mysql2/blob/master/typings/mysql/lib/Connection.d.ts |
| `namedPlaceholders` option | TRUE | `namedPlaceholders?: boolean` present (use `:name` tokens with an object of params). Also present: `decimalNumbers`, `supportBigNumbers`, `bigNumberStrings`, `timezone`, `typeCast`, `multipleStatements`, `rowsAsArray`. | same |
| MySQL 8.0 server status | NOTE | 8.0 Extended Support ended 2026-04-30; Oracle: "as of April 21, 2026, MySQL 8.0 is covered under Oracle Sustaining Support" (no new fixes). Last 8.0.46 (2026-04-07). Fine for a local test project; 8.4 LTS / 9.7 LTS are current. | https://endoflife.date/mysql , https://www.mysql.com/support/eol-notice.html |

## Claim 6 - Current stable versions (npm `latest` on 2026-10-03)

| Package | Verdict / version | Evidence | Source |
|---|---|---|---|
| React | 19.3.0 (not 18) | published 2026-09-09; React 19.3 blog post 2026-09-09; React 19 GA 2024-12-05; CRA sunset 2025-02-14. No React 18 releases listed. | https://react.dev/blog , https://www.npmjs.com/package/react |
| Vite | 8.3.2 | published 2026-10-01; Vite 8 released 2026-03-12 "with Rolldown as its single, unified, Rust-based bundler"; "requires Node.js 20.19+, 22.12+"; engines `^20.19.0 || >=22.12.0`. `previous` tag 7.3.6. | https://vite.dev/blog/announcing-vite8 , https://www.npmjs.com/package/vite |
| @vitejs/plugin-react | 6.1.1 | peer `vite ^8.0.0`; v6 "uses Oxc for React Refresh transforms, removing Babel". | https://www.npmjs.com/package/@vitejs/plugin-react , https://vite.dev/blog/announcing-vite8 |
| React Router | 8.4.0 (not 6/7) | v8.0.0 released 2026-06-17; `react-router-dom` package removed ("RouterProvider/HydratedRouter should be imported from react-router/dom; Everything else should be imported from react-router"); min Node 22.22.0, min React 19.2.7; ESM-only; Vite 7+ only matters for Framework mode. `version-7` tag = 7.18.4 (Node >=20, React >=18) if you need a fallback. | https://reactrouter.com/changelog , https://reactrouter.com/upgrading/v7 , https://www.npmjs.com/package/react-router |
| React Router modes for a plain Vite SPA | Use Declarative or Data mode | Three modes unchanged in v8. Declarative: `<BrowserRouter>` from "react-router". Data: `createBrowserRouter` + `<RouterProvider>` (from "react-router/dom") adds loaders/actions. Framework mode "wraps Data Mode with a Vite plugin" (`@react-router/dev`) - NOT needed, do not install it for a plain SPA. | https://reactrouter.com/start/modes |
| @tanstack/react-query | 5.104.1 | published 2026-10-02; peer `react ^18 || ^19`. | https://www.npmjs.com/package/@tanstack/react-query |
| Tailwind CSS | 4.3.3 | published 2026-07-16; `v3-lts` tag 3.4.19. | https://www.npmjs.com/package/tailwindcss |
| @tailwindcss/vite recommended | TRUE | Docs: `npm install tailwindcss @tailwindcss/vite`, add `tailwindcss()` to `vite.config`, CSS = `@import "tailwindcss";`. No tailwind.config.js, no postcss.config.js, no `@tailwind` directives, no `content` array. Peer `vite ^5.2.0 || ^6 || ^7 || ^8`. v3 config can be loaded with `@config "./tailwind.config.js"` if needed. | https://tailwindcss.com/docs/installation/using-vite , https://tailwindcss.com/docs/upgrade-guide |
| firebase JS SDK | 12.19.0 | published 2026-09-09; 12.0.0 (2025-07-17) requires Node 20+ and ES2020 (browser SDK; irrelevant to Vite). A `next` dist-tag `13.0.0-20260929204201` exists but no v13 release notes are published - do not use `firebase@next`. | https://firebase.google.com/support/release-notes/js , https://www.npmjs.com/package/firebase |
| zod | 4.6.5 | published 2026-09-13; zod@4.0.0 shipped 2025-07-08; root `"zod"` import is v4, `"zod/v3"` keeps v3, `"zod/mini"` tree-shakable variant. v4 changes: `message` -> `error` param (invalid_type_error/required_error removed); `.default()` short-circuits on undefined and must match output type (`.prefault()` for old behavior); `z.string().email()` -> `z.email()`; `.strict()/.passthrough()` -> `z.strictObject()/z.looseObject()`; `.merge()` -> `.extend()`; `z.record()` needs 2 args; `z.nativeEnum()` -> `z.enum()`; `error.format()/flatten()` deprecated -> `z.treeifyError()`. | https://zod.dev/v4/versioning , https://zod.dev/v4/changelog |
| swagger-ui-express | 5.0.1 | published 2024-05-31 (old but current); peer `express >=4.0.0 || >=5.0.0-beta`, dep `swagger-ui-dist >=5.0.0`. Open issue #384 (2025-06-04) only asks to widen the peer range; no runtime breakage reported. | https://www.npmjs.com/package/swagger-ui-express , https://github.com/scottie1984/swagger-ui-express/issues/384 |
| react-hook-form | 7.89.0 | published 2026-09-26; peer react ^16.8-^19; v8 only at `beta` (8.0.0-beta.4) - stay on 7. | https://www.npmjs.com/package/react-hook-form |
| helmet | 8.3.0 | published 2026-07-12; node >=18. | https://www.npmjs.com/package/helmet |
| cors | 2.8.6 | published 2026-01-22. | https://www.npmjs.com/package/cors |
| dotenv | 18.0.5 | published 2026-09-30; node >=12. v17.0.0 (2025-06-27) made the "injected env (N) from .env" log default-on; v18.0.0 (2026-09-17) moved it to stderr and removed tips; silence with `config({ quiet: true })` or `DOTENV_CONFIG_QUIET=true`. v18 adds a CLI (`dotenv run -- node index.js`). | https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md |
| firebase-tools | 15.32.1 | published 2026-09-30; node >=20. | https://www.npmjs.com/package/firebase-tools |
| Node 24 LTS status | TRUE (Active LTS) | v24 "Krypton": start 2025-05-06, LTS 2025-10-28, maintenance 2026-10-20, end 2028-04-30. v26: Current since 2026-05-05, LTS 2026-10-28. v25 EOL 2026-06-01. Latest 24.x = 24.21.0 (2026-09-08); local 24.16.0 satisfies every engine range above (firebase-admin >=22, react-router >=22.22, vite >=22.12). | https://github.com/nodejs/Release/blob/main/schedule.json , https://nodejs.org/dist/latest-v24.x/ , https://nodejs.org/en/about/previous-releases |

## Claim 7 - Free deployment options (optional; local-first)

| Option | Verdict (free, no card?) | Evidence | Source |
|---|---|---|---|
| Firebase Hosting (Vite SPA) | TRUE | Spark: "Storage: 10 GB", "Data transfer: 360 MB/day" (pricing) / "no cost up to 10 GB/month" (usage page); custom domain & SSL and multiple sites included; no payment method. Overage on Spark = deploys blocked / site disabled, never a bill. | https://firebase.google.com/pricing , https://firebase.google.com/docs/hosting/usage-quotas-pricing |
| Render free web service | TRUE | Free web services exist; "spins down a Free web service that goes 15 minutes without receiving any inbound traffic", restart "takes about one minute"; "750 Free instance hours to each workspace per calendar month"; no persistent disk, no shell, single instance. Render's own 2026 article: "No credit card is required." Free Postgres expires after 30 days (1 GB); free Key Value does not persist. | https://render.com/docs/free , https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026 |
| Koyeb | FALSE for no-card | Pricing FAQ: "One free web Service in the Frankfurt or Washington, D.C. regions with 512MB of RAM, 0.1 vCPU, and 2GB of SSD" per org, BUT "We require a credit card to prevent fraud and abuse" with a "$29 pre-authorization hold" and signup defaults to Pro ($29/mo, pro-rated charge). Pricing page lists no free plan. Koyeb was acquired by Mistral AI (2026-02-17). | https://www.koyeb.com/docs/faqs/pricing , https://www.koyeb.com/pricing , https://techcrunch.com/2026/02/17/mistral-ai-buys-koyeb-in-first-acquisition-to-back-its-cloud-ambitions/ |
| Fly.io | FALSE | "New organizations don't have a free tier or a monthly free usage allowance." Trial = "up to 2 hours of Machine runtime or 7 days" without card; afterwards "you'll need to add a credit card". Smallest always-on app $2.19/30 days. | https://docs.fly.io/about/pricing |
| Railway | PARTIAL | Trial: "one-time grant of $5", up to 30 days, no card. Then "Free plan, which provides $1 of free credit per month" (0.5 GB RAM, 1 vCPU) - not enough for an always-on API for a month. Hobby $5/mo needs a card. Trial volumes deleted 30 days after credits expire. | https://docs.railway.com/reference/pricing/free-trial , https://docs.railway.com/reference/pricing/plans |
| Vercel (Express as serverless) | TRUE (non-commercial) | Hobby "is free"; "restricts users to non-commercial, personal use only"; included: 1,000,000 function invocations, 4 CPU-hrs, 360 GB-hrs, 100 GB transfer; max function duration 300s; Express zero-config: export the app from `app.js`/`index.js`/`server.js` (or `src/`), app becomes one Fluid-compute function; `express.static()` is ignored (use `public/`). Vercel docs do not mention a card; Render's survey says "No credit card is required." | https://vercel.com/docs/plans/hobby , https://vercel.com/docs/frameworks/backend/express |
| Aiven free MySQL | TRUE | "1 CPU per VM", "1 GB" RAM, "1 GB storage"; "No credit card required. No 30-day trial."; "Free services do not have any time limitations"; "Service powers off after a period of inactivity (you'll be notified by email ...)"; docs-only support. | https://aiven.io/free-mysql-database , https://aiven.io/docs/platform/concepts/free-plan |
| TiDB Cloud Serverless -> "TiDB Cloud Starter" | TRUE with caveats | Free: "Row-based storage: 5 GiB", "Columnar storage: 5 GiB", "50 million RUs per month"; "No credit card is required"; max "five free TiDB Cloud Starter instances" per org; on quota exhaustion it "denies any new connection attempts" (no bill). MySQL 5.7/8.0 wire-compatible but NO stored procedures/functions, triggers, events, FULLTEXT, SPATIAL, descending indexes; AUTO_INCREMENT "not necessarily allocated sequentially"; default collation utf8mb4_bin. | https://docs.pingcap.com/tidbcloud/select-cluster-tier/ , https://docs.pingcap.com/tidbcloud/mysql-compatibility/ |
| Clever Cloud MySQL | PARTIAL (details unverified) | Pricing: "When you sign up you will get free credits ... with no payment card required." MySQL "DEV" plan described as free, "for testing purposes only ... no backups, extensions nor SLA" (search snippet of the add-on doc; the doc page did not render for the fetcher, so size/connection limits are unverified). | https://clever.cloud/pricing/ , https://www.clever.cloud/developers/doc/addons/mysql/ |
| filess.io | TRUE (tiny) | Hobby plan: "No credit card required", "10MB storage/db", "2 databases", MySQL 8.0/5.7, weekly backups. | https://www.filess.io/ |
| freesqldatabase.com | UNVERIFIED | Site returned HTTP 425 to the fetcher (3 attempts). Third-party write-ups: 5 MB, 1 database, remote access allowed, email signup. Treat as throwaway only. | https://www.freesqldatabase.com/freemysqldatabase/ , https://medium.com/geekculture/using-freesqldatabase-for-testing-mysql-cd15fed3a210 |
| db4free.net | FALSE (defunct) | db4free.net now 301-redirects to an unrelated site (taxcreditsforworkersandfamilies.org); whois shows the domain in redemption period (Mar 2026); uptime monitors show it down since Mar 2026. Do not plan on it. | https://www.whois.com/whois/db4free.net , https://isdownorblocked.com/check/db4free.net |

## Claim 8 - Firebase/GCP console steps that need billing (what NOT to click)

| Step | Needs billing? | Evidence | Source |
|---|---|---|---|
| "Upgrade" / "Modify plan" -> Blaze | YES | Blaze = pay-as-you-go, requires a Cloud Billing account (card). Never needed for Auth + Hosting. | https://firebase.google.com/pricing |
| Build > Storage > "Get started" | YES | Blaze required since 2026-02-03. | https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 |
| Build > Functions | YES | Spark column: "Not applicable". | https://firebase.google.com/pricing |
| App Hosting, Data Connect, Firebase ML, Firebase AI Logic | YES | Spark column: "Not applicable" for each. | https://firebase.google.com/pricing |
| Authentication > Sign-in method > Phone | YES | SMS "Pay as you go (Blaze) plan only". | https://firebase.google.com/docs/auth/limits |
| Authentication > Settings > "Upgrade to Identity Platform" | No card, but avoid | Free toggle, but caps Spark at 3,000 DAU and unlocks features (SMS MFA, blocking functions) that need Blaze/Functions. Leave it off. | https://firebase.google.com/docs/auth#identity-platform |
| Google Analytics toggle at project creation | NO | Spark: "No-cost". Optional; turning it off avoids creating a GA4 property and extra gtag config. | https://firebase.google.com/pricing |
| App Check (reCAPTCHA v3 / Enterprise) | NO, but skip | App Check "No-cost, subject to quotas"; reCAPTCHA Enterprise "no-cost for 10,000 assessments each month"; GCP setup says "you don't need to enable billing". Not needed for this project. | https://firebase.google.com/docs/app-check , https://docs.cloud.google.com/recaptcha/docs/set-up-google-cloud |
| Google Cloud console banner "Activate" / "Start free trial" ($300) | YES (card hold) | "you must provide a credit card or other payment method" (hold, not charge). Firebase Spark does not need it. | https://docs.cloud.google.com/free/docs/free-cloud-features |
| Project settings > Service accounts > "Generate new private key" | NO | Free; only org-policy-restricted in organizations created after 2024-05-03 (not personal projects). | https://docs.cloud.google.com/resource-manager/docs/secure-by-default-organizations |

---

## Recommended pinned versions (caret on major.minor; exact `latest` in parentheses)

Backend (`server/` or `apps/api`):
- node 24.x (have 24.16.0; 24.21.0 is current; Active LTS, Maintenance from 2026-10-20, EOL 2028-04-30)
- express ^5.2 (5.2.1)
- mysql2 ^3.24 (3.24.5)
- firebase-admin ^14.5 (14.5.0) - import from `firebase-admin/app` and `firebase-admin/auth`
- zod ^4.6 (4.6.5)
- swagger-ui-express ^5.0 (5.0.1) + hand-written OpenAPI JSON/YAML (or swagger-jsdoc)
- helmet ^8.3 (8.3.0)
- cors ^2.8 (2.8.6)
- dotenv ^18.0 (18.0.5) with `quiet: true`
- firebase-tools ^15.32 (15.32.1) as a devDependency (or `npx firebase-tools`)

Frontend (`client/` or `apps/web`):
- react ^19.3 / react-dom ^19.3 (19.3.0)
- vite ^8.3 (8.3.2)
- @vitejs/plugin-react ^6.1 (6.1.1)
- react-router ^8.4 (8.4.0) - do NOT install react-router-dom; `RouterProvider` from "react-router/dom". Fallback if any tooling objects: react-router ^7.18 (7.18.4).
- @tanstack/react-query ^5.104 (5.104.1)
- tailwindcss ^4.3 + @tailwindcss/vite ^4.3 (4.3.3)
- firebase ^12.19 (12.19.0)
- react-hook-form ^7.89 (7.89.0)

## Gotchas that could cost money or break the build

Money:
- Any "Upgrade" button in the Firebase console = Blaze = card. Auth (email/password) + Hosting + Emulators need none. Storage, Functions, App Hosting, Data Connect, ML, AI Logic, Phone auth are all Blaze-only on current Spark.
- Do not toggle "Upgrade to Identity Platform" in Authentication settings (3,000 DAU cap on Spark, features that need Blaze).
- Do not click Google Cloud's "Activate full account" / $300 free trial banner (card hold).
- Hosted DB fallbacks: Aiven (1 GB, powers off when idle, no card) and TiDB Starter (5 GiB, no card, throttles instead of billing) are the only hosted MySQL-compatible options verified to be card-free in 2026. Koyeb and Fly.io now require a card; Railway's permanent Free plan is $1/month of credit; db4free is dead.
- Never set `FIREBASE_AUTH_EMULATOR_HOST` in a deployed environment: the Admin SDK then accepts unsigned tokens.

Build/runtime:
- firebase-admin 14: `const admin = require('firebase-admin'); admin.auth()` no longer exists. Use `const { initializeApp, cert } = require('firebase-admin/app'); const { getAuth } = require('firebase-admin/auth');`. Requires Node >= 22.
- Express 5: `app.get('/*', ...)` throws - use `/*splat` or `/{*splat}`; optional params are `/users{/:id}` not `/users/:id?`; `req.query` is read-only and uses the "simple" parser; `req.body` is `undefined` until `express.json()` runs; `res.send(404)` -> `res.sendStatus(404)`; `express.urlencoded({ extended })` now defaults to false; unhandled async rejections go to your error middleware (so register a 4-arg error handler last).
- swagger-ui-express 5.0.1 installs cleanly with Express 5 (peer range allows 5.x) but mount it as `app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec))` - avoid path patterns with regex characters.
- React Router 8: ESM-only, needs React >= 19.2.7 (19.3.0 OK) and Node >= 22.22 (24.16 OK); `react-router-dom@7.18.4` still exists on npm - installing it alongside `react-router@8` duplicates the router and breaks context. Framework mode (`@react-router/dev`) is not needed for a Vite SPA.
- Vite 8 bundles with Rolldown; `@vitejs/plugin-react` 6 requires `vite ^8` and drops Babel (use `@rolldown/plugin-babel` only if you really need Babel plugins). Vite 7.x needs plugin-react 5.x instead - keep the pair matched.
- Tailwind 4: `@tailwind base/components/utilities` and `content: []` are gone; use `@import "tailwindcss"` + `@theme {}` in CSS. Renamed utilities: `shadow-sm`->`shadow-xs`, `shadow`->`shadow-sm`, `rounded-sm`->`rounded-xs`, `outline-none`->`outline-hidden`, bare `ring` is now 1px (`ring-3` for the old 3px). Default border/ring color is `currentColor` (add `border-gray-200` explicitly). Requires Safari 16.4+/Chrome 111+/Firefox 128+.
- zod 4: `{ message }` -> `{ error }`; `z.string().email()` deprecated -> `z.email()`; `.default()` now returns the default without parsing and must be of output type; `.merge` -> `.extend`; `z.record(z.string(), v)` needs the key schema; `error.flatten()/format()` deprecated -> `z.treeifyError(err)`. Many LLM-generated/StackOverflow snippets are v3 - check against https://zod.dev/v4/changelog.
- Firebase Auth email enumeration protection (default-on for new projects): a wrong password and an unknown email both surface as `auth/invalid-credential`; `fetchSignInMethodsForEmail` returns nothing. Write generic "invalid email or password" UI copy; do not branch on `auth/user-not-found` / `auth/wrong-password`.
- Spark email quotas: password-reset emails 150/day, verification emails 1,000/day, email-link sign-in 5/day. Do not build magic-link login.
- Custom claims (role) are <= 1000 bytes and only appear in the next ID token (<= 1 hour). After `setCustomUserClaims`, have the client call `getIdToken(true)` (or re-login) and make the API authorize from the verified token's claims, not from the client.
- Seeding ~30 users via Admin SDK `createUser` is far below every quota (100 accounts/hour/IP; 500 req/s per service account). Seed against the Auth emulator (`--project demo-xxx`) for local runs; `importUsers` batches 1000 if you ever need bulk.
- dotenv 17+ prints an "injected env ..." line on every start (stderr in v18) - pass `{ quiet: true }`.
- mysql2 + MySQL 8.0 `caching_sha2_password` over plain TCP works (automatic RSA key exchange); no `mysql_native_password` user needed. If you later target TiDB, avoid stored procedures, triggers, events, FULLTEXT and sequential-ID assumptions.
- `firebase@next` is a 13.0.0 pre-release - pin `^12.19`.
- Firebase Hosting for a React Router SPA needs the SPA rewrite (`"rewrites": [{"source":"**","destination":"/index.html"}]`) in `firebase.json`; on Vercel, `express.static()` is ignored (static files must live in `public/`) and the Express app becomes a single function (cold starts).
- Render free: first request after 15 idle minutes takes ~1 minute - say so in the README for graders.

## Windows-specific notes

- PowerShell execution policy: on Windows clients the effective default (when undefined) is Restricted - "Permits individual commands, but doesn't allow scripts" - so npm's `.ps1` shims (`firebase.ps1`, `vite.ps1`, `npx.ps1`) fail with "running scripts is disabled". Fix once: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, or call the `.cmd` shims / use Git Bash. https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies
- Use `127.0.0.1`, not `localhost`, in all connection strings (mysql2 `host`, `FIREBASE_AUTH_EMULATOR_HOST`, `connectAuthEmulator`, Vite proxy target). Node's DNS result order default is `verbatim`, so `localhost` can resolve to `::1` first on Windows while the service listens on IPv4 only; Firebase docs themselves use `http://127.0.0.1:9099`. Alternative: `node --dns-result-order=ipv4first`. https://nodejs.org/api/dns.html , https://firebase.google.com/docs/emulator-suite/connect_auth
- The repo currently lives under OneDrive (`C:\Users\My PC\OneDrive\Documents\...`). `node_modules` (tens of thousands of small files) inside a synced folder causes slow syncs, file locks and intermittent `EPERM`/`EBUSY` during `npm install`/`vite build`. Move the project to a non-synced path (e.g. `C:\dev\school-ms`) or at minimum keep `node_modules` out of OneDrive (junction to a local folder). Sources (third-party): https://www.linkedin.com/pulse/today-i-learnednever-work-nodejs-onedrive-folder-sham-haque , https://learn.microsoft.com/en-us/answers/questions/5399195/please-permit-us-to-select-what-subfolders-shouldn
- The user profile path contains a space (`My PC`); always quote paths in npm scripts and `.env` values.
- Java: not needed for `firebase emulators:start --only auth`. If you add the Firestore/RTDB/Storage emulators, firebase-tools 15.x enforces JDK 21+ (docs still say 11). This machine already has JDK 25.0.3 (BellSoft, first on PATH), Zulu 21 and Adoptium 17, so no action needed. https://github.com/firebase/firebase-tools/blob/v15.32.1/src/emulator/commandUtils.ts
- Node: 24.16.0 satisfies every engine range in the stack; optional update to 24.21.0 (2026-09-08). Node 24 moves from Active LTS to Maintenance LTS on 2026-10-20 and is supported until 2028-04-30 - no need to jump to Node 26 (LTS from 2026-10-28). https://github.com/nodejs/Release/blob/main/schedule.json
- Firebase CLI login opens a browser; if that fails use `firebase login --no-localhost` (copy/paste code). The standalone `firebase.exe` binary is an alternative to the npm install. https://www.npmjs.com/package/firebase-tools
- MySQL 8.0 service is `MySQL80`; `net start MySQL80` / `net stop MySQL80` need an elevated shell, and `mysql.exe` is typically not on PATH (default install dir `C:\Program Files\MySQL\MySQL Server 8.0\bin`). MySQL 8.0 itself is out of Oracle support since 2026-04-30 (fine for local dev). https://endoflife.date/mysql
- Default local ports to keep free: 3306 (MySQL), 9099 (Auth emulator), 5173 (Vite dev), plus whatever you pick for Express (e.g. 3000/8080).
