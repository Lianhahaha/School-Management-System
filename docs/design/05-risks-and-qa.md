> Part of the design set for the School Management System. The project contract is `docs/PROJECT_PLAN.md`; where this document and the plan disagree, the plan wins (see its Decisions log, section 5).

# 05 - Risk Analysis and QA Plan (pre-code devil's advocate review)

Project: School Management System (Node 24 + Express 5 + mysql2 + firebase-admin backend; React + Vite frontend; Firebase Auth; MySQL 8.0).
Reviewer: skeptical principal engineer. Scope: critique the plan as given; redesign only where something is actually wrong.
Context facts verified on this machine (2026-10-03): Node v24.16.0, npm 11.13.0, `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe` exists but is not on PATH, Windows service `MySQL80` is Running, PowerShell execution policy is `RemoteSigned` (a reviewer's machine may be `Restricted`), project path is under OneDrive and contains spaces (`C:\Users\My PC\OneDrive\Documents\School management system`), folder is not yet a git repo.

Headline verdict: the architecture is sound and appropriately boring. Almost every realistic way this submission fails is NOT architectural; it is (1) the reviewer cannot get it running (Firebase wiring, MySQL credentials, missing README step), (2) a secret ends up in the repo, (3) a role/ownership check is missing on one endpoint, or (4) data visibly looks wrong (dates shifted, enum casing). The plan below is tuned to those four.

Design changes I insist on (details in the numbered items):
1. Move the working copy out of OneDrive (e.g. `C:\dev\school-management-system`); use git/GitHub as the backup, not OneDrive sync. (Item 5)
2. Add a Vite dev proxy (`/api` -> `http://127.0.0.1:3000`) so the frontend calls same-origin relative URLs by default; keep the CORS allow-list from env as the fallback. (Item 19)
3. Add `npm run doctor` (backend) and fail-fast startup checks with actionable messages (env schema, service-account file, project-id parity with frontend `.env`, DB reachable, tables present, ports free). (Items 1, 3, 4, 6)
4. Repositories accept an executor parameter (`db = pool`), transactions pass the connection explicitly, and `release()` lives in `finally`. (Item 8)
5. Never assign to `req.query` in Express 5; validated input goes on `req.validated`. (Item 7)
6. "Adopt orphan by email" when creating accounts from seed/admin, seed re-links `firebase_uid` by email on every run, and a valid token with no MySQL row returns `403 USER_NOT_REGISTERED` which the frontend treats as sign-out. (Item 12)
7. `class_subjects` UNIQUE must be `(class_id, subject_id)`, not `(class_id, subject_id, teacher_id)`, unless two teachers per subject per class is intentional. (Item 13 / Section F)
8. Roles are immutable after creation (deactivate + recreate). Removes the stale-role bug class. (Item 21)
9. Commit `package-lock.json` in both folders, add `"engines": {"node": ">=22.12"}`, README uses `npm ci`. Do a clean-clone run-through in a fresh folder with a fresh Firebase project before submitting. (Item 3)
10. Shared `constants/shared.js` on both sides plus `npm run check:constants` that imports both files and parses `schema.sql` ENUMs. (Section B)

---

## A. Top 25 failure modes (ranked by likelihood x impact)

Scale: L = likelihood (1-5), I = impact on the submission (1-5). Ranked by product, then by how hard it is to notice.

### 1. Firebase wiring mismatch between frontend, backend and console (L5 I5)
- Symptom: login succeeds in the browser (Firebase accepts the password) but every API call returns 401; backend log shows `Firebase ID token has incorrect "aud" (audience) claim. Expected "proj-a" but got "proj-b"`. Or: `Firebase: Error (auth/operation-not-allowed)` on login. Or backend crashes at start with `ENOENT ... firebase-service-account.json` / `Service account object must contain a string "project_id" property`.
- Root cause: the frontend web config (`VITE_FIREBASE_PROJECT_ID`, `apiKey`) and the backend service account JSON come from different Firebase projects (typical when `.env.example` ships the candidate's real web config and the reviewer generates their own service account). Email/Password provider not enabled. Service-account path relative to the wrong cwd.
- Prevention:
  - `.env.example` files contain placeholders only, never the candidate's real project values. Half-configured = guaranteed mismatch.
  - Backend reads the service account from `FIREBASE_SERVICE_ACCOUNT_PATH` resolved against the backend root (`path.resolve(import.meta.dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)`), default `./firebase-service-account.json`. Document the exact filename to rename the downloaded `<project>-firebase-adminsdk-xxxxx-xxxxxxxxxx.json` to.
  - Startup: validate the JSON has `type === 'service_account'`, `project_id`, `private_key`, `client_email`; print `Firebase project: <id>` in the startup banner.
  - `GET /health` returns `{ firebaseProjectId }` (not secret). In dev the frontend compares it with `import.meta.env.VITE_FIREBASE_PROJECT_ID` and renders a red banner "Frontend and backend point at different Firebase projects" instead of a silent 401 loop.
  - `npm run doctor` reads `../frontend/.env` and compares `VITE_FIREBASE_PROJECT_ID` with the service account `project_id`.
  - README has the exact console clicks for the $0 path (Section E) and says explicitly: "both `.env` files must reference the SAME Firebase project".
- Detect fast: `npm run doctor`; startup banner; the dev-only mismatch banner; curl `/health`.

### 2. Service-account JSON or `.env` committed to GitHub (L3 I5)
- Symptom: GitHub emails "Possible valid secrets detected"; Google may automatically disable the exposed key; backend later fails with `Credential implementation provided to initializeApp() ... failed to fetch a valid Google OAuth2 access token ... invalid_grant`. Even if nothing breaks, a reviewer who sees `"private_key"` in the repo stops reading.
- Root cause: `.gitignore` created after the first `git add`; a rename of the downloaded key file to something not matched by the ignore pattern; OneDrive copies with ` (1)` suffixes; `.env` committed "temporarily".
- Prevention:
  - First commit of the repo is `.gitignore` + README only. Root `.gitignore` includes: `node_modules/`, `dist/`, `.env`, `.env.*`, `!.env.example`, `*firebase-adminsdk*.json`, `**/firebase-service-account*.json`, `backend/secrets/`, `desktop.ini`, `Thumbs.db`, `*.log`.
  - A single canonical location for the key: `backend/firebase-service-account.json` (ignored by name) - no alternatives documented.
  - `npm run check:secrets` (root or backend) = `git grep -l "private_key" -- ':!*.md'` must return nothing; also run `git ls-files | findstr /i ".env firebase-adminsdk"` expecting empty. Include it in the pre-submission checklist; optionally as a `pre-commit` hook via a one-line `core.hooksPath` script (no dependency).
  - If it ever leaks: delete the key in Firebase console (Service accounts -> Manage service account permissions -> Keys), generate a new one, and rewrite history (`git filter-repo`) before making the repo public. Rotation is mandatory; deleting the file in a new commit is not enough.
- Detect fast: `git grep private_key $(git rev-list --all)` before pushing; GitHub secret scanning alerts (enabled by default on public repos).

### 3. README does not reproduce on a clean machine (L5 I4)
- Symptom: reviewer hits a step the candidate never did because the candidate's machine already had state: database already created, `.env` already present, Node version different, `npm install` resolving newer majors than the candidate tested, a path hardcoded to `C:\Users\My PC\...`, or "run both servers" without saying two terminals.
- Root cause: the README is written from memory, not executed. Lockfiles missing. Implicit cwd assumptions.
- Prevention:
  - Commit `backend/package-lock.json` and `frontend/package-lock.json`; README uses `npm ci` (exact versions); `"engines": { "node": ">=22.12" }` plus `.nvmrc`/`.node-version` with `24`.
  - Every command in the README is prefixed with the folder it runs in; every env var listed in `.env.example` has a comment.
  - Pre-submission gate: clone the repo into a fresh folder (`C:\tmp\review-run`), create a brand-new Firebase project and a new MySQL database name, follow the README literally with a stopwatch, fix every deviation. Ideally do it in a second Windows user account (catches global tools/env vars). Also run `npm run build` in frontend (Vite dev compiles lazily; `build` is the only thing that compiles every page).
  - `npm run doctor` and a seed that prints demo credentials at the end make the README shorter and self-verifying.
- Detect fast: the clean-clone rehearsal; the time it takes a colleague/friend to run it from the README without talking to you.

### 4. MySQL connectivity/auth on Windows (L5 I4)
- Symptom: `Error: connect ECONNREFUSED 127.0.0.1:3306` (service stopped), `Access denied for user 'root'@'localhost' (using password: YES)` (wrong password or `#`/`$` in password mangled by dotenv), `Access denied for user ''@'localhost' (using password: NO)` (env not loaded, see item 6), `ER_BAD_DB_ERROR: Unknown database 'school_management'` (migrate never ran), `connect ECONNREFUSED ::1:3306` (Node resolved `localhost` to IPv6 while MySQL is bound to IPv4 only), `ER_NOT_SUPPORTED_AUTH_MODE` (only with the legacy `mysql` package, not mysql2).
- Root cause: reviewer does not remember the root password set during the MySQL installer; `mysql` CLI not on PATH so README instructions using `mysql -u root -p` fail; DB creation requires a privileged connection.
- Prevention:
  - `.env.example` uses `DB_HOST=127.0.0.1` (not `localhost`), `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=` with a comment "wrap in double quotes if it contains # or spaces", `DB_NAME=school_management`.
  - `npm run db:migrate` connects WITHOUT a database, runs `CREATE DATABASE IF NOT EXISTS` then the schema, so the reviewer never needs the `mysql` CLI or Workbench. Provide the optional "dedicated user" SQL in the README for people who refuse to use root, with the full path to `mysql.exe` on Windows: `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p`.
  - mysql2 >= 3 supports `caching_sha2_password` (MySQL 8 default); do not tell users to switch to `mysql_native_password` unless they actually see an auth-plugin error.
  - Startup check runs `SELECT 1` and prints a specific hint per error code (ECONNREFUSED -> "Start the MySQL80 service: services.msc or `net start MySQL80` (admin)"; ER_ACCESS_DENIED_ERROR -> "check DB_USER/DB_PASSWORD"; ER_BAD_DB_ERROR -> "run npm run db:migrate").
- Detect fast: `npm run doctor`; the startup check fails before Express listens.

### 5. Project folder lives in OneDrive (L5 I3, but constant friction for the candidate)
- Symptom: `npm ERR! code EPERM ... syscall unlink ... esbuild.exe` or `EBUSY: resource busy or locked`, `ENOTEMPTY` during `npm ci`; Vite/`node --watch` restarts twice or misses changes; occasional `ENOENT` on files that exist (Files On-Demand placeholders); OneDrive creates `desktop.ini`; the path contains spaces, which still breaks the occasional tool/script; thousands of `node_modules` files uploaded to the cloud and the sync client pegging CPU.
- Root cause: OneDrive syncs and locks files while npm/esbuild/Vite write them. Spaces in `My PC` and `School management system` are an extra source of quoting bugs (your scratchpad path already shows the `MYPC~1` short-name workaround).
- Prevention: move the repo to `C:\dev\school-management-system` (no spaces, no OneDrive). Push to GitHub early and often; that is the backup. If you must stay in OneDrive: pause syncing during `npm ci`, mark the folder "Always keep on this device", add `desktop.ini` to `.gitignore`, and expect flakiness. Do not rely on junctions for `node_modules`; OneDrive handles them badly.
- Detect fast: any EPERM/EBUSY from npm; the OneDrive icon spinning after `npm ci`.

### 6. Environment variables not loaded (ESM hoisting, cwd, Vite prefix) (L4 I4)
- Symptom: backend connects as `''@'localhost'` or to `undefined` DB; `Failed to determine project ID`; frontend blank page with `Firebase: Error (auth/invalid-api-key)`; a `.env` change has no effect.
- Root cause: in ESM, `import dotenv from 'dotenv'; dotenv.config(); import { pool } from './db.js'` is hoisted - `db.js` evaluates before `config()` runs. `.env` resolved from cwd when the server is started from the repo root. Vite only exposes variables prefixed `VITE_`, only from `frontend/.env*`, and only to code that runs after the dev server (re)started.
- Prevention:
  - Backend: either `import 'dotenv/config'` as the FIRST import of `server.js`, or drop dotenv entirely and use Node's built-in loader in the npm scripts: `"dev": "node --watch --env-file-if-exists=.env src/server.js"` (Node >= 22.9; fine on 24). Since npm always runs scripts with cwd = `backend/`, the relative `.env` is stable. Document "run from backend/".
  - Validate env with zod at startup (`src/config/env.js`) and exit with a list of missing variables and the `.env.example` to copy.
  - Frontend: `src/lib/firebase.js` asserts every `VITE_FIREBASE_*` is present and renders a readable "frontend/.env is missing or incomplete; copy .env.example and restart `npm run dev`" screen instead of throwing inside Firebase init.
- Detect fast: startup env validation; `npm run doctor`.

### 7. Express 5 breaking changes (L4 I4, but found at startup)
- Symptom: `TypeError: Missing parameter name at 1: https://git.new/pathToRegexpError` at boot (from `app.get('*')`, `app.options('*', cors())`, `/users/:id?`, or regex in a path). `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter` from a validation middleware that does `req.query = parsed`. Every POST fails validation with "Required" because `req.body` is `undefined` when the client forgot `Content-Type: application/json`. Nested query params (`filters[status]=active`) do not parse because Express 5 defaults to the "simple" query parser.
- Root cause: path-to-regexp v8 (`*` must be named: `/{*splat}`; optional segments use braces: `/users{/:id}`; no inline regex), `req.query` is a getter, `req.body` has no default `{}`, `res.send(status)`/`res.redirect('back')`/`req.param()` removed.
- Prevention:
  - Validation middleware stores results on `req.validated = { body, query, params }`; controllers read only from there.
  - 404 handler is `app.use((req, res) => ...)` with no path; no `'*'` anywhere; preflight handled by `app.use(cors(opts))` mounted before routes (no `app.options('*')`).
  - Flat query params only (`status=active&classId=3`), which also matches the plan's `useListParams`.
  - If `req.body === undefined` on a JSON route, return `400 VALIDATION_ERROR` with hint "JSON body missing or Content-Type is not application/json" - helps the reviewer using curl.
  - Upside to exploit: Express 5 forwards rejected promises from async handlers to the error middleware, so no `asyncHandler` wrapper or `express-async-errors`. The error handler must still be registered LAST and have 4 parameters. Add `process.on('unhandledRejection')` logging for errors outside the request cycle.
- Detect fast: the app refuses to start on bad paths; a supertest that POSTs without a content type and expects 400.

### 8. Connection pool exhaustion / transaction misuse -> API hangs silently (L3 I5)
- Symptom: the first N requests (N = `connectionLimit`, default 10) work, then every request hangs forever with no error and no log line; or a write inside a transaction stalls 50 s and dies with `ER_LOCK_WAIT_TIMEOUT: Lock wait timeout exceeded`.
- Root cause: `pool.getConnection()` without `release()` on the error path; or a service that starts a transaction on `conn` but calls a repository that uses `pool` internally - that query runs on a different connection outside the transaction and blocks on the row lock the transaction holds. `queueLimit: 0` (unbounded) turns exhaustion into an infinite wait.
- Prevention:
  - Every repository function takes `db = pool` as its last argument; services pass `conn` inside transactions. One `withTransaction(async (conn) => {...})` helper owns `beginTransaction/commit/rollback/release` with `release()` in `finally`. Code review rule: `getConnection` appears only in that helper.
  - Pool options: `connectionLimit: 10, waitForConnections: true, queueLimit: 50, connectTimeout: 10000`; `decimalNumbers: true`, `dateStrings: ['DATE']` (see items 14, 17).
  - Never nest a transaction call inside another transaction.
- Detect fast: a smoke test that fires 25 sequential requests to a transactional endpoint with an induced failure (duplicate email) and asserts the 26th still responds; log `pool.pool._allConnections.length` in dev via `/health` (or `pool.pool._freeConnections.length`).

### 9. SQL injection surface: `multipleStatements`, string interpolation, sortBy, LIMIT (L3 I5)
- Symptom: `search=' OR 1=1 --` returns everything; `sortBy=(SELECT ...)` executes; or the benign version: `LIMIT '10'` syntax error, `Incorrect arguments to mysqld_stmt_execute` when `execute()` gets a string for `LIMIT ?`.
- Root cause: `multipleStatements: true` on the app pool amplifies any interpolation into stacked queries; `ORDER BY ${sortBy}` interpolated from user input (placeholders cannot parameterize identifiers); `req.query.limit` is a string.
- Prevention:
  - `multipleStatements: true` only on the dedicated connection created inside `scripts/migrate.js`, never on the pool.
  - Per-endpoint `SORTABLE = { fullName: 'u.full_name', createdAt: 'u.created_at' }`; zod `sortBy: z.enum(Object.keys(SORTABLE))`, `sortOrder: z.enum(['asc','desc'])`; the SQL uses `SORTABLE[sortBy]`, never the raw string.
  - `page`/`limit` through `z.coerce.number().int().min(1)`, `limit.max(100)`; after validation, interpolate `LIMIT ${limit} OFFSET ${offset}` as integers (safe because validated) - avoids both the quoted-string bug and the prepared-statement gotcha.
  - `search`: escape `%` and `_` (`s.replace(/[%_\\]/g, '\\$&')`) and bind `%${s}%` as a parameter.
  - Build WHERE clauses with an array of fragments + params; the same builder feeds the `COUNT(*)` query so `meta.total` honors filters.
  - No `DELIMITER` lines in `schema.sql` (that is a `mysql` CLI feature; mysql2 will throw a syntax error). No triggers/procedures.
- Detect fast: grep the repo for `${` inside SQL template strings other than whitelisted identifiers/LIMIT; supertest `sortBy=evil` expects 400.

### 10. RBAC/ownership gaps (IDOR) on one forgotten endpoint (L4 I5)
- Symptom: a student changes `studentId` in the URL and reads another student's grades; a teacher marks attendance or creates an assessment for a `class_subject` they do not teach; a teacher lists all users.
- Root cause: role gating done per router but ownership checks done per service inconsistently; "me" data fetched via generic endpoints with client-supplied IDs.
- Prevention:
  - Two middleware primitives: `authenticate` (token -> MySQL user with `role`, `isActive`, `studentId`, `teacherId`) and `authorize(...roles)`. Nothing else decides access.
  - Student- and teacher-facing reads use the literal `me` on the ordinary endpoints and never trust a client-supplied id outside the caller's scope: `GET /students/me`, `GET /attendance?studentId=me`, `GET /grades?studentId=me`, `GET /schedules` (scoped to the caller), `GET /class-subjects?teacherId=me`. An omitted filter means "my own scope"; an explicit filter outside it is a 403, never silently narrowed. Rosters come from `GET /enrollments` (scoped), `GET /attendance/sheet` and `GET /assessments/:id/grades` (ownership checked). Admin passes any id.
  - One helper `assertTeacherOwnsClassSubject(teacherId, classSubjectId, db)` called in every teacher write (attendance sheet, assessments, grades, class announcements) and in reads of rosters; admin bypasses. One helper `assertStudentEnrolledIn(studentId, classSubjectId)` before accepting attendance/grade rows.
  - Section C has the full policy matrix; the matrix is also pasted into `docs/` so the reviewer sees it was designed, not improvised.
- Detect fast: the RBAC smoke tests (Section D) with three fake users; manual: log in as `student1`, copy a URL from the admin area, expect 403 page not data.

### 11. Privilege escalation through the register body or PATCH mass assignment (L2 I5)
- Symptom: `POST /auth/register {"role":"admin"}` creates an admin; `PATCH /auth/me {"role":"admin","isActive":true}` works.
- Root cause: zod schema strips unknown keys by default (fine) but a developer spreads `req.body` into the INSERT, or reuses the admin `createUser` schema for register.
- Prevention: separate `registerSchema` (no `role` field, `.strict()` so `role` yields 400) and the service hardcodes `role: ROLES.STUDENT`; `updateMeSchema` allows only `fullName`, `phone`, etc.; repositories take explicit column lists, never `...body`.
- Detect fast: supertest in Section D asserts the stored role is `student`.

### 12. Firebase user <-> MySQL row drift: orphans, failed compensation, re-seeded DB, "account not provisioned" (L4 I4)
- Symptom: `POST /users` returns `auth/email-already-exists` although the user is not in MySQL (orphan from a previous failed insert or from `db:reset`); the reviewer logs in with a seeded account and the app shows a 403/blank; after switching Firebase projects every seeded login says "not provisioned".
- Root cause: two systems of record without a reconciliation rule; `firebase_uid` stored in MySQL goes stale when the Firebase project (and thus UIDs) changes; a crash between `createUser` and the MySQL commit leaves an orphan; the compensation (`deleteUser`) itself can fail.
- Prevention:
  - Account creation algorithm (seed and admin create): (1) check MySQL for the email -> 409 `CONFLICT` (`details.key = 'email'`); (2) `getUserByEmail` in Firebase -> if found, ADOPT the existing Firebase user (admin/seed are trusted); else `createUser`; (3) insert `users` + profile row in one transaction; (4) on failure delete the Firebase user only if this request created it. Public register never adopts: if the email exists in Firebase but not MySQL, return 409 `CONFLICT` with `details.reason = 'email_in_use'` ("contact admin").
  - Seed is keyed by email: `INSERT ... ON DUPLICATE KEY UPDATE firebase_uid = VALUES(firebase_uid), full_name = VALUES(full_name)` so re-running the seed after changing Firebase projects re-links accounts.
  - `authenticate`: valid token but no MySQL row -> `403 USER_NOT_REGISTERED`; inactive -> `403 ACCOUNT_DISABLED`. Frontend treats both as "sign out + show message", everything else as a normal 403 page (no sign-out).
  - `users.firebase_uid VARCHAR(128)` (not CHAR(28); emulator/imported UIDs differ).
- Detect fast: run `db:reset` then `db:seed` twice; log in; it must work both times. Delete a demo user in the Firebase console, re-seed, log in again - must work.

### 13. Seed script fragility: duplicates, FK order, Firebase bursts, hardcoded year, data model invariants (L4 I3)
- Symptom: second `npm run db:seed` dies with `ER_DUP_ENTRY: Duplicate entry 'admin@school.test' for key 'users.uq_users_email'`; `ER_NO_REFERENCED_ROW_2` because class_subjects were inserted before teachers; `auth/too-many-requests` or `QUOTA_EXCEEDED` after a `Promise.all` of 60 `createUser` calls; `auth/invalid-password` because a demo password is 5 chars; `db:migrate` with `DROP TABLE` in the wrong order fails with `ER_ROW_IS_REFERENCED_2`; dashboards empty because the seed hardcoded `academic_year='2025-2026'` while "current year" logic computes `2026-2027` (today is 2026-10-03).
- Root cause: non-idempotent inserts, parallel Firebase calls, FK ordering, time-dependent data.
- Prevention:
  - Seed order = dependency order: users -> teachers/students -> subjects -> classes -> class_subjects -> enrollments -> schedules -> assessments -> grades -> attendance -> announcements. Each uses a natural key with `ON DUPLICATE KEY UPDATE` or lookup-then-insert.
  - Firebase calls strictly sequential (`for ... of`, not `Promise.all`), ~15 users total, retry once with 2 s backoff on `auth/too-many-requests`. Passwords >= 8 chars (`Password123!`). `emailVerified: true` on seeded users.
  - `db:migrate` = `CREATE DATABASE IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS` (idempotent). `db:reset` = `DROP DATABASE IF EXISTS` + migrate + seed (destructive, prints a warning). Do not sprinkle `DROP TABLE` in `schema.sql`.
  - "Current academic year" lives in exactly one helper (August rule, `ACADEMIC_YEAR_START_MONTH`, decision D25) shared by dashboards, teacher visibility defaults and the seed, so demo data always looks current; dashboards additionally rely on `enrollments.status = 'active'`; attendance seeded for the last 10 weekdays relative to today.
  - Enforce invariants in the DB, not only in code: `class_subjects UNIQUE (class_id, subject_id)`; `enrollments`: `active_key TINYINT GENERATED ALWAYS AS (IF(status='active',1,NULL)) STORED, UNIQUE (student_id, active_key)` gives "one active enrollment per student" at the DB level (MySQL unique indexes allow multiple NULLs); `attendance UNIQUE (student_id, class_subject_id, attendance_date)`; `grades UNIQUE (assessment_id, student_id)`; `schedules CHECK (start_time < end_time)`, `CHECK (day_of_week BETWEEN 1 AND 7)`. Announcements need no audience CHECK: `audience` is only `all`, `students` or `teachers`, class targeting is the nullable `class_id`, and the rule "a teacher's announcement must carry a `classId`" is enforced by the service (it depends on the author's role, which the DB does not know). MySQL 8.0.16+ enforces CHECK.
  - Seed must detect a missing schema (`ER_NO_SUCH_TABLE`) and print "run npm run db:migrate first".
- Detect fast: run `db:seed` twice in CI/pre-submission; it must be a no-op the second time and end by printing the demo credentials.

### 14. Dates shift by one day (L4 I3, very visible)
- Symptom: attendance marked for March 1 shows as Feb 28 in the table; "today" is wrong after 7 pm or before 5 am depending on timezone; `Incorrect date value: '2026-03-01T00:00:00.000Z' for column 'attendance_date'` (MySQL rejects ISO strings with `Z`); created_at shows as `2026-03-01 10:00:00` and Safari fails to parse it.
- Root cause: `new Date('2026-03-01')` is parsed as UTC midnight and displayed in local time; `new Date().toISOString().slice(0,10)` yields the UTC date; JS Date objects or ISO strings sent for DATE columns; `dateStrings: true` turns TIMESTAMP into a non-ISO local string; a deep `camelize` helper recursing into `Date` objects turns them into `{}`.
- Prevention:
  - DATE columns are strings end to end: zod `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`; mysql2 `dateStrings: ['DATE']` (array form keeps DATETIME/TIMESTAMP as JS Dates, which `JSON.stringify` serializes as ISO-8601 UTC with `Z`, which every browser parses); frontend displays date-only strings via `parseISO`/manual `new Date(y, m-1, d)` or shows the string, never `new Date('YYYY-MM-DD')`.
  - "Today" in the UI is computed locally (`format(new Date(), 'yyyy-MM-dd')` with date-fns or manual getFullYear/getMonth/getDate). The backend never defaults dates; the client always sends them.
  - `camelize` must treat `Date`, `Buffer`, `null` as leaves.
- Detect fast: set Windows timezone to UTC-8 and UTC+12, mark attendance for today, reload - date must not move. Unit test for the camelize helper with a Date value.

### 15. Day-of-week and time-format mismatches (L4 I3)
- Symptom: Monday's lessons appear under Tuesday (or Sunday); "today's schedule" on the dashboard is empty on Mondays; `<input type="time">` posts `08:00` and the API/validation expects `08:00:00`; conflicts not detected because `'8:00'` vs `'08:00:00'` compare lexicographically wrong.
- Root cause: three conventions collide - ISO 1..7 (Mon=1), JS `getDay()` 0..6 (Sun=0), MySQL `DAYOFWEEK()` 1..7 (Sun=1) and `WEEKDAY()` 0..6 (Mon=0).
- Prevention: store `day_of_week TINYINT` as ISO 1..7 (Mon=1); shared constant `DAYS_OF_WEEK = [{value:1,label:'Monday'},...]` on both sides; the frontend computes today as `((d.getDay() + 6) % 7) + 1` in ONE util and passes `?dayOfWeek=` to the API (backend never computes "today"). TIME is `HH:MM:SS` inside MySQL but `HH:MM` everywhere in the API: the shared `TIME_REGEX` (`^([01]\d|2[0-3]):[0-5]\d$`) is what zod accepts, the pool `typeCast` returns TIME columns as `HH:MM` (decision D16), and MySQL accepts `HH:MM` on write, so `<input type="time">` values pass through unchanged. Overlap predicate: `s.start_time < :end AND s.end_time > :start` (adjacent slots allowed), filtered by same `day_of_week` and the same academic year (via class), excluding the slot being updated (`id <> :id`).
- Detect fast: seed a Monday 08:00-09:00 slot, open the dashboard on a Monday (or change the system clock), expect it listed; unit tests for the overlap predicate incl. the touching-boundary case.

### 16. ENUM/constant drift between MySQL, zod and UI (L4 I3)
- Symptom: `Data truncated for column 'status' at row 1` (errno 1265, an error under MySQL strict mode) when the UI sends `Present` and the ENUM is `present`; filters return nothing; labels show raw values.
- Root cause: the same list typed four times (schema.sql, backend zod, frontend select options, seed).
- Prevention: Section B - one `constants.js` per side with identical values, `check:constants` script that parses `schema.sql` ENUM lists and compares against both files; UI option lists generated from constants; zod enums built from constants (`z.enum(ATTENDANCE_STATUSES)`).
- Detect fast: `npm run check:constants` in `npm test`.

### 17. mysql2 type coercion surprises (L4 I2)
- Symptom: `score: "85.50"` string (DECIMAL) -> `score + 5` gives `"85.505"`, averages are `NaN`; `isActive: 1` so `isActive === true` is false and a checkbox never shows checked; `JSON_ARRAYAGG(...)` comes back as a string in some queries and as an array in others; `COUNT(*)` fine but `SUM()` of DECIMAL also string.
- Root cause: mysql2 returns DECIMAL as string unless `decimalNumbers: true`; TINYINT(1) is a number; JSON function results depend on protocol/flags.
- Prevention: pool option `decimalNumbers: true` (OK for scores with 2 decimals); map booleans explicitly in the repository mapper (`isActive: !!row.is_active`) or via `typeCast` for `TINY` columns of length 1; avoid JSON aggregation functions - do a second query or shape in JS; the central `camelize`/`mapRow` is the single place for coercions.
- Detect fast: `typeof` assertions in one repository unit test; Swagger "Try it out" shows the JSON types.

### 18. Error mapping gaps and leakage (L4 I3)
- Symptom: creating a duplicate subject code returns 500 with `Duplicate entry 'MATH' for key 'subjects.uq_subjects_code'` (leaks schema); deleting a referenced teacher returns 500; zod errors come back as a raw array in the wrong shape (zod 4 uses `error.issues`; `.errors`/`.format()` are deprecated); malformed JSON body returns an HTML stack trace; 404 for unknown routes is Express's default HTML, not the envelope.
- Root cause: no central translation of driver/library errors into the envelope.
- Prevention: one `errorHandler` that maps everything onto the closed catalogue (decision D20): `ZodError` -> 400 `VALIDATION_ERROR` with `details: issues.map(i => ({ path: i.path.join('.'), message: i.message }))`; `ER_DUP_ENTRY` -> 409 `CONFLICT` with `details.key` parsed from the key name (name all unique keys `uq_<table>_<column>` so the parse is trivial); `ER_NO_REFERENCED_ROW_2` -> 400 `VALIDATION_ERROR` (`details.reason = 'invalid_reference'`); `ER_ROW_IS_REFERENCED_2` -> 409 `CONFLICT` (`details.reason = 'in_use'`, message "assigned to classes; reassign or deactivate instead"); `WARN_DATA_TRUNCATED`/`ER_DATA_TOO_LONG`/`ER_TRUNCATED_WRONG_VALUE` -> 400 `VALIDATION_ERROR`; body-parser `entity.parse.failed` -> 400 `VALIDATION_ERROR` (`details.reason = 'invalid_json'`); `entity.too.large` -> 400 `VALIDATION_ERROR` (`details.reason = 'payload_too_large'`); firebase `auth/id-token-expired`, `auth/argument-error` and `auth/invalid-id-token` -> 401 `UNAUTHORIZED` with `details.reason` set to the Firebase code; `auth/email-already-exists` -> 409 `CONFLICT` (`details.key = 'email'`); the register rate limiter -> 429 `RATE_LIMITED`; anything else -> 500 `INTERNAL_ERROR` with a `requestId`, stack logged server-side, `details.stack` only when `NODE_ENV !== 'production'`. Catch-all 404 route returns the envelope with `NOT_FOUND`. Never return 204; always `200 + envelope` (a frontend `res.json()` on 204 throws `Unexpected end of JSON input`).
- Detect fast: supertest for duplicate code -> 409 `CONFLICT` with `details.key`; unknown route -> envelope; invalid JSON -> 400.

### 19. CORS, ports and localhost resolution (L4 I2)
- Symptom: `Access to fetch at 'http://localhost:3000/api/v1/auth/me' from origin 'http://localhost:5174' has been blocked by CORS policy`; OPTIONS preflight returns 401 because auth middleware ran before cors; `ECONNREFUSED ::1:3000` from a proxy.
- Root cause: Vite silently moves to 5174 when 5173 is busy; `Authorization` header triggers preflight; `localhost` resolving to IPv6 (`::1`) on Node 17+ while the server listens IPv4 only; `127.0.0.1` vs `localhost` treated as different origins.
- Prevention:
  - Vite `server.proxy = { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } }` and the frontend uses `import.meta.env.VITE_API_BASE_URL ?? '/api/v1'` -> no CORS in the default dev path at all.
  - Vite `server.port = 5173, strictPort: true` so a busy port is a loud error, not a silent move.
  - Backend `cors({ origin: CORS_ORIGINS.split(','), credentials: false })` with default `http://localhost:5173,http://127.0.0.1:5173`, mounted before everything except helmet; no `app.options('*')` (Express 5 path syntax).
  - Backend listens on `0.0.0.0`/default (dual-stack) and prints its URLs.
- Detect fast: open `/health` from the browser; DevTools network tab shows the OPTIONS response.

### 20. Dependency major-version drift vs. tutorial knowledge (L4 I3)
- Symptom: Tailwind styles do nothing (Tailwind v4 ignores `tailwind.config.js` `content` and `@tailwind base` directives; it wants `@import "tailwindcss"` and the `@tailwindcss/vite` plugin) or `Cannot apply unknown utility class`; zod 4 `.errors` undefined, `z.string().email()` deprecation; `@hookform/resolvers` 3.x with zod 4 behaving oddly (use resolvers >= 5 with zod 4); TanStack Query v5 `isLoading`/`onSuccess`/`cacheTime` gone (`isPending`, `gcTime`); react-router v8 (`react-router` is the only package; `react-router-dom` no longer exists, so every import comes from `react-router`); firebase-admin 14 modular imports (`firebase-admin/app`, `firebase-admin/auth`); helmet 8 defaults.
- Root cause: `npm install <pkg>` always takes the latest major; the candidate's mental model is one major behind.
- Prevention: decide majors up front and pin in `package.json` (caret on the chosen major): express ^5, mysql2 ^3, firebase-admin ^14, zod ^4 on BOTH sides, helmet ^8, cors ^2, morgan ^1, swagger-ui-express ^5, `yaml` ^2 (to load openapi.yaml), express-rate-limit ^7; frontend react ^19, react-router ^8, @tanstack/react-query ^5, tailwindcss ^4 + @tailwindcss/vite, react-hook-form ^7, @hookform/resolvers ^5, firebase ^12. Read each package's current README for 10 minutes before writing code. Commit lockfiles.
- Detect fast: `npm run build` (frontend) and `node --check` on every backend file via `npm test`; unstyled page = Tailwind wiring.

### 21. Frontend auth lifecycle races and stale state (L4 I3)
- Symptom: flash of the login page on reload then redirect to dashboard; first API calls return 401 because `auth.currentUser` is still null when queries fire; after `db:reset` the user is "logged in" to an account that no longer exists and the UI loops; deactivated user keeps working until the token expires; React StrictMode double-subscribes `onAuthStateChanged`.
- Root cause: Firebase restores the session asynchronously; queries not gated on auth readiness; no distinct handling of `ACCOUNT_DISABLED`/`USER_NOT_REGISTERED`; cached role never refreshed.
- Prevention: `AuthProvider` state machine `loading -> anonymous | authenticated(user+profile)`; `RequireAuth` renders a spinner while `loading`; all `useQuery` have `enabled: status === 'authenticated'`; the fetch wrapper awaits `getIdToken()` each call (SDK caches/refreshes; on 401 `UNAUTHORIZED` with `details.reason = 'auth/id-token-expired'` retry once with `getIdToken(true)`); `onAuthStateChanged` returns its unsubscribe from `useEffect`; `/auth/me` query `staleTime: 5 min, refetchOnWindowFocus: true`, and any 403 with code `ACCOUNT_DISABLED`/`USER_NOT_REGISTERED` -> `signOut()` + toast. Roles immutable (see insisted change 8) so no stale-role case exists; `isActive` is enforced per request on the backend regardless of UI state. Admin deactivation also calls `revokeRefreshTokens(uid)` and `updateUser(uid, { disabled: true })`.
- Detect fast: hard-reload on a protected route (no flash); deactivate `student1` while logged in in another browser profile - next click signs them out.

### 22. Admin lockout and confusing restricted deletes (L3 I3)
- Symptom: the reviewer tries "Deactivate" on their own admin account (reviewers do this) and loses access to the admin area; "Delete subject" on a seeded subject fails with a 500 or a cryptic FK message.
- Root cause: no self-status guard; hard deletes on referenced rows.
- Prevention: `PATCH /users/:id/status { isActive: false }` -> 403 `FORBIDDEN` with `details.reason = 'self_status_change'` for the caller's own account (so at least one active admin, the caller, always remains); subjects/classes/teachers use soft delete (`is_active`) or return 409 `CONFLICT` with a human sentence (`details.reason`, e.g. `teacher_has_assignments`); UI disables the button for self. Seed always creates one extra admin (`admin2@school.test`) so a reviewer can test deactivation of an admin safely.
- Detect fast: manual test in Section D; supertest for self-deactivate.

### 23. Windows-only assumptions that break for a macOS/Linux reviewer, and vice versa (L3 I3)
- Symptom: `'cross-env' is not recognized`; npm script with `VAR=x node ...` fails on Windows cmd; `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system` on a reviewer's PowerShell (`Restricted` policy); `Cannot find module './components/Button'` on Linux because the file is `components/button.jsx` (Windows is case-insensitive; `git mv` of only a case change does not register unless `core.ignorecase=false`); `Table 'school_management.Users' doesn't exist` on Linux because `lower_case_table_names=1` on Windows hid a casing bug; CRLF in a `.sh` file -> `bad interpreter`.
- Root cause: platform defaults.
- Prevention: no inline env assignments in npm scripts (use `--env-file`, or `cross-env` if unavoidable); `&&` in npm scripts is fine (npm uses cmd.exe on Windows) but each script should also work alone; `.gitattributes` with `* text=auto` and `*.sh text eol=lf`; all table/column names lowercase snake_case in SQL and code; all frontend folders/files consistently cased and imports copy-pasted from the file tree; README notes the PowerShell policy fix (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`) or using `npm.cmd`; avoid shell scripts entirely - use Node scripts.
- Detect fast: `git ls-files | sort -f | uniq -di` finds case-duplicate paths; a run in WSL/Git Bash if available; otherwise accept the residual risk and state "tested on Windows 11; Linux/macOS expected to work" in the README.

### 24. MySQL strict mode / `ONLY_FULL_GROUP_BY` / collation / MariaDB (L3 I3)
- Symptom: dashboard endpoint 500 with `Expression #2 of SELECT list is not in GROUP BY clause and contains nonaggregated column ... incompatible with sql_mode=only_full_group_by`; `Unknown collation: 'utf8mb4_0900_ai_ci'` on a reviewer using MariaDB/XAMPP; `NaN%` attendance when a student has zero records; `VALUES()` deprecation warnings from upserts.
- Root cause: MySQL 8 defaults (`STRICT_TRANS_TABLES, ONLY_FULL_GROUP_BY`), MySQL-only collation, division by zero returning NULL.
- Prevention: every aggregate query selects only grouped or aggregated columns (wrap others in `MAX()`/`ANY_VALUE()`); schema specifies `CHARACTER SET utf8mb4` without a collation (or `utf8mb4_unicode_ci`); `ROUND(100 * SUM(status='present') / NULLIF(COUNT(*),0), 1)` and the UI formats `null` as "-"; use `ON DUPLICATE KEY UPDATE col = VALUES(col)` (works everywhere; deprecation warning harmless on 8.0) rather than the 8.0.19 row-alias syntax; README states "MySQL 8.0+ required; MariaDB not tested".
- Detect fast: dashboard smoke test per role on the seeded DB; `SELECT @@sql_mode` in `doctor`.

### 25. Externals: clock skew, offline cert fetch, Firebase billing prompts, Hyper-V port reservations, helmet vs Swagger (L2 I4)
- Symptom: every token rejected with `Firebase ID token has expired` or an `iat` complaint while the browser just logged in (PC clock off by minutes); `Error fetching public keys for Google certs` / `getaddrinfo ENOTFOUND www.googleapis.com` behind a corporate proxy or offline; reviewer stops at a console screen asking to "Upgrade to Blaze"; `Error: listen EACCES: permission denied 0.0.0.0:3000` (Windows Hyper-V/WSL excluded port range includes 3000 on some machines) or `EADDRINUSE`; `/api/docs` renders blank because helmet's CSP blocked something.
- Root cause: Admin SDK validates `exp`/`iat` against local time and fetches Google public keys over HTTPS (cached ~6 h); Firebase console upsells; Windows reserves dynamic port ranges; helmet default CSP.
- Prevention:
  - README troubleshooting: Settings -> Time & language -> "Sync now" or `w32tm /resync` (admin). Token verification needs internet once per ~6 h.
  - Firebase $0 path documented click-by-click (Section E). Things that DO require Blaze and must NOT be clicked: Cloud Functions, Cloud Storage (new projects since Oct 2024), "Identity Platform" upgrade in Authentication settings (MFA/blocking functions/SAML), Extensions, Cloud Run. Everything this app uses (Auth Email/Password, service account key, web app config) is on Spark.
  - `PORT` env with default 3000 and README fallback `PORT=3001`; `netsh interface ipv4 show excludedportrange protocol=tcp` to see reservations; `netstat -ano | findstr :3000` + `taskkill /PID <pid> /F` for EADDRINUSE. `strictPort` on Vite.
  - helmet for a JSON API: `helmet({ contentSecurityPolicy: false })` (CSP protects HTML pages; the only HTML served is Swagger UI). Verify `/api/docs` in a browser after adding helmet; load `openapi.yaml` with the `yaml` package at startup so a YAML indentation error crashes at boot, not at the reviewer's click. OpenAPI `servers: [{ url: '/api/v1' }]` (relative) so "Try it out" works on any host/port. Define `bearerAuth` security scheme and ship `npm run token -- admin@school.test Password123!` (Identity Toolkit REST `accounts:signInWithPassword` with the public web API key read from `../frontend/.env`) so the reviewer can get an ID token for Swagger "Authorize" in 5 seconds.
- Detect fast: `/health` from a browser; `npm run doctor` checks clock vs `Date` header from google.com (optional) and port availability.

### Also worth knowing (lower rank)
- Firebase "email enumeration protection" is ON for new projects: wrong password AND unknown email both return `auth/invalid-credential`. Map `auth/invalid-credential`, `auth/invalid-email`, `auth/user-disabled`, `auth/too-many-requests`, `auth/network-request-failed` to human messages.
- Firebase password policy minimum is 6; use 8 in zod on both sides (stricter is fine, looser breaks).
- `import x from './sa.json'` in Node ESM throws `ERR_IMPORT_ATTRIBUTE_MISSING`; use `fs.readFileSync` + `JSON.parse`. `__dirname` does not exist in ESM; use `import.meta.dirname` (Node >= 20.11).
- Firebase Auth emulator vs real: do not build both unless you test both end to end. The real project is what the test asks for. If you add the emulator later: backend honors `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` automatically (init with `{ projectId }` only); frontend `connectAuthEmulator(auth, 'http://127.0.0.1:9099')` behind `VITE_FIREBASE_USE_EMULATOR=true`; requires `firebase-tools` + `--project demo-school`; emulator state resets on restart unless exported; the Auth emulator itself is Node-based (Firestore/RTDB emulators are the ones that need Java). Mark optional (Section F).
- A newly registered student has no enrollment, no grades, no schedule. Every student page must render an empty state, not crash on `activeEnrollment.class.name`. Same for a teacher with no class_subjects and a class with no students. The reviewer WILL register a fresh account first.
- `fetch` without `Content-Type: application/json` -> body ignored (see item 7). The API client sets it centrally.
- GitHub repo hygiene: meaningful commits, no `node_modules`, no `dist`, screenshots or a GIF in the README help a lot.

---

## B. Consistency traps between DB <-> API <-> UI

Every value below is typed in at least three places. Each row is a bug waiting to happen.

| Concept | DB (snake_case) | API (camelCase) | UI | Trap |
|---|---|---|---|---|
| Roles | `users.role ENUM('admin','teacher','student')` | `role` | route prefixes `/admin`, `/teacher`, `/student`; guards; nav | casing (`Admin`), route name != role value |
| Attendance status | `attendance.status ENUM('present','absent','late','excused')` | `status` | select options, badge colors | `Present` vs `present`; adding `excused` in UI only |
| Announcement audience | `announcements.audience ENUM('all','students','teachers')`, `class_id` nullable | `audience` (three values), optional `classId` | audience select plus an optional class select | `class` is not an audience value anywhere; class targeting is the separate `classId`; a teacher's post must carry one (service-enforced); UI sends `''` for classId -> `emptyToNull` |
| Assessment type | `assessments.type ENUM('quiz','test','exam','assignment','project','other')` | `type` | select | spelling (`assesment`), `test` vs `quiz` |
| Term | `assessments.term ENUM('term1','term2','term3')` | `term` | select, grade report grouping | `1`/`'1'`/`'Term 1'` mixing |
| Enrollment status | `enrollments.status ENUM('active','completed','transferred','withdrawn')` | `status` | badge, "transfer" action (`POST /enrollments/transfer`) | `inactive` vs `withdrawn`; a transfer closes the old row as `transferred`, never `withdrawn` |
| User active flag | `users.is_active TINYINT(1)` | `isActive` boolean | toggle, filter `status=active|inactive|all` | `1`/`0` vs `true`/`false`; filter param name |
| Day of week | `schedules.day_of_week TINYINT 1..7 (Mon=1)` | `dayOfWeek` number | labels Monday..Sunday; "today" calc | JS `getDay()` 0..6 Sun=0; MySQL `DAYOFWEEK()` Sun=1 |
| Time | `TIME` -> `'HH:MM'` via the pool `typeCast` | `startTime`/`endTime` `'HH:MM'` | `<input type="time">` gives `'HH:MM'` | one conversion place (`typeCast`); never let `'HH:MM:SS'` leak into the API |
| Date | `DATE` -> `'YYYY-MM-DD'` (dateStrings) | `date`/`attendanceDate` string | `<input type="date">` `'YYYY-MM-DD'` | never `new Date(str)`; never ISO with `Z` to DB |
| Datetime | `TIMESTAMP created_at` | ISO 8601 UTC string (`...Z`) | `new Date(iso).toLocaleString()` | `dateStrings: true` would produce non-ISO local strings |
| Academic year | `classes.academic_year VARCHAR(9)` `'2025-2026'` | `academicYear` | text input / select built from constant | `2025/26`; regex + refine second = first+1 in ONE shared regex |
| Pagination | `LIMIT/OFFSET` | `page`, `limit` (max 100), `search`, `sortBy`, `sortOrder` in; `meta: {page, limit, total, totalPages}` out | `useListParams` keys; `DataTable` reads `meta` | `perPage` vs `limit`; `order` vs `sortOrder`; `ASC` vs `asc` |
| Sort keys | whitelist map per endpoint (`fullName -> u.full_name`) | `sortBy` enum values | column header keys | header key not in whitelist -> 400 |
| Filter names | columns | `classId, subjectId, teacherId, studentId, classSubjectId, status, dateFrom, dateTo, academicYear, role, audience, dayOfWeek, isActive` | query keys | `class_id` leaking into the API |
| IDs | INT UNSIGNED | numbers | `<select>` values are strings | send `Number(value)` or `valueAsNumber`; backend bodies use `z.number().int().positive()`, query params `z.coerce.number()` |
| Optional fields | NULL | omitted or `null` | form yields `''` | `emptyToNull()` before submit on the frontend; zod `.nullable().optional()` |
| Scores | `grades.score DECIMAL(5,2)`, `assessments.max_score DECIMAL(5,2)` | numbers (`decimalNumbers: true`) | number inputs (`valueAsNumber`) | string math; `score <= maxScore` checked in service (cross-table) |
| Email | `users.email VARCHAR(255) UNIQUE` (ci collation) | lowercased | lowercased on submit | Firebase also case-insensitive; normalize once with `.toLowerCase()` in zod |
| Password rule | n/a | zod `min(8)` | zod `min(8)` | Firebase min is 6; both sides must agree |
| Envelope | n/a | `{success, data, meta}` / `{success:false, error:{code,message,details}}` | API client unwraps `data`, throws `ApiError(code, message, details, status)` | returning raw arrays on one endpoint |
| Error codes | n/a | closed catalogue of eleven: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `USER_NOT_REGISTERED` 403, `ACCOUNT_DISABLED` 403, `NOT_FOUND` 404, `CONFLICT` 409, `SCHEDULE_CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503; the specifics travel in `details.reason` (`self_status_change`, `not_enrolled`, `in_use`, a Firebase `auth/*` code, ...) or `details.key` (the duplicate column) | which codes trigger sign-out (`USER_NOT_REGISTERED`, `ACCOUNT_DISABLED`); which show inline on forms (`VALIDATION_ERROR`, `CONFLICT`) | inventing a twelfth code on one side; frontend comparing to strings instead of `ERROR_CODES` |
| HTTP status | n/a | 200/201 success (never 204), 400/401/403/404/409/429/500/503 | | 204 -> `res.json()` throws |
| Base path | n/a | `/api/v1` (Express mount, OpenAPI `servers`, Vite proxy) | `API_BASE` | `/api/v1/` trailing slash; `/api` vs `/api/v1` |
| Firebase project | service account `project_id` | `/health.firebaseProjectId` | `VITE_FIREBASE_PROJECT_ID` | different projects -> `aud` error |
| Dashboard payload | aggregates | `{ role: 'admin', counts: {...}, todayAttendance: {...}, latestAnnouncements: [...] }` etc. per role | three dashboard components | key renamed on one side |
| Schedule conflict details | | `error.details = { conflicts: [{ type: 'class'|'teacher'|'room', scheduleId, ... }] }` (every conflict listed) | shows each conflict inline | one side reading a single object or a differently named field while the other sends `conflicts[].type` |

Recommendation: ONE source of truth per side, mechanically checked.
- `backend/src/constants/shared.js` and `frontend/src/constants/shared.js` export identical plain objects: `ROLES`, `ATTENDANCE_STATUSES`, `ANNOUNCEMENT_AUDIENCES`, `ASSESSMENT_TYPES`, `TERMS`, `ENROLLMENT_STATUSES`, `DAYS_OF_WEEK`, `SORT_ORDERS`, `PAGINATION = { DEFAULT_LIMIT: 20, MAX_LIMIT: 100 }`, `ACADEMIC_YEAR_REGEX`, `DATE_REGEX`, `TIME_REGEX`, `PASSWORD_MIN_LENGTH`, `ERROR_CODES`, `API_BASE_PATH`. The frontend file must be pure (no `import.meta.env`, no React) so Node can import it.
- `backend/scripts/check-constants.mjs` (run by `npm test`): imports both files, deep-compares, then regex-scans `backend/db/schema.sql` for `` `col` ENUM('a','b') `` and asserts each ENUM set equals the corresponding constant (a small `ENUM_COLUMNS = { 'users.role': ROLES, ... }` map inside the script). Exit 1 with a diff on mismatch.
- Why not a shared package: no npm workspaces means a third install step or Vite `server.fs.allow` tweaks; a copied file plus a check is simpler for the reviewer and safer. Why not only `GET /meta/enums`: needs both servers running; fine as an optional dev-time console warning, not as the guarantee.
- zod enums are built FROM constants (`z.enum(ATTENDANCE_STATUSES)`), UI `<select>` options are built FROM constants with a `LABELS` map, seed imports the same constants. Nothing is typed twice.

---

## C. Security checklist (specific to this app)

Token and identity
- [ ] `Authorization: Bearer <idToken>` only; reject tokens from query strings; `verifyIdToken(token)` without `checkRevoked` (that is a network call per request); accept only `decoded.firebase.sign_in_provider === 'password'` if you want to be strict (optional).
- [ ] Project parity: service account `project_id` == frontend `VITE_FIREBASE_PROJECT_ID` (startup banner + doctor + dev banner).
- [ ] After verification, load the MySQL user by `firebase_uid` on EVERY request; no caching; `is_active = 0` -> `403 ACCOUNT_DISABLED`; no row -> `403 USER_NOT_REGISTERED`. This is the only thing that closes the "disabled user still has a valid token for up to 1 h" window.
- [ ] Deactivation = MySQL `is_active=0` + `updateUser(uid, {disabled:true})` + `revokeRefreshTokens(uid)`, in that order; reactivation reverses it.
- [ ] Role comes from MySQL only; no custom claims; roles immutable after creation.
- [ ] `/auth/register` is the ONLY unauthenticated write; it hardcodes role `student`, `.strict()` schema, rate limited (`express-rate-limit`: 5 per 15 min per IP; the limiter answers HTTP 429 with the standard error envelope and code `RATE_LIMITED`; disabled when `NODE_ENV=test`).

Authorization policy matrix (enforce in services via the two helpers; mirror in OpenAPI descriptions)

| Resource | admin | teacher | student |
|---|---|---|---|
| users (list/create/status via `PATCH /users/:id/status`) | all | - | - |
| /auth/me, PATCH /auth/me (contact fields only) | self | self | self |
| students, teachers, subjects, classes CRUD | all | read lists needed for own classes | - |
| class_subjects (assignments) | CRUD | read own (`GET /class-subjects?teacherId=me`) | read own class (scoped `GET /class-subjects` and `GET /schedules`) |
| enrollments | CRUD | read roster of own class_subjects | own only |
| attendance | all | write/read only for own class_subjects; students must be enrolled in that class | read own (`GET /attendance?studentId=me`) |
| assessments/grades | all | CRUD only for own class_subjects; grade rows only for enrolled students; `score <= maxScore` | read own grades |
| schedules | CRUD (conflict checks) | read own | read own class |
| announcements | CRUD, any audience, `classId` optional | create only with a `classId` for a class they teach (required for teachers, enforced by the service); read `all`/`teachers`/own classes | read `all`/`students`/own class |
| dashboard | admin payload | teacher payload | student payload |

Input and data
- [ ] zod on every body/params/query; bodies `.strict()` to block mass assignment; IDs as positive ints; dates/times via shared regexes; `limit <= 100`; `sortBy` enum whitelist; `search` escaped for LIKE.
- [ ] Parameterized SQL only; identifiers from whitelists; `multipleStatements` only in the migrate script; no `DELIMITER`.
- [ ] DB-level invariants (unique keys, CHECKs, FK RESTRICT) as the second line of defense.
- [ ] Transactions for multi-row writes (user+profile, enrollment transfer, attendance sheet).

Transport and headers
- [ ] `helmet()` (CSP disabled for this JSON API, documented why), `cors` allow-list from env, `express.json({ limit: '1mb' })` (bulk attendance/grade bodies up to 200 rows), `morgan('dev')` (never logs headers/bodies), `app.disable('x-powered-by')` (helmet does it).
- [ ] No cookies/sessions -> no CSRF surface; keep it that way (do not add `credentials: true` to cors without need).

Secrets
- [ ] Only Firebase web config (public by design) is in the frontend; still via `.env` with placeholders in `.env.example`.
- [ ] Service account JSON: fixed ignored filename, never in env strings (avoids `error:1E08010C:DECODER routines::unsupported` from mangled `\n`), never in OneDrive-shared screenshots; `check:secrets` before every push; rotate if ever exposed.
- [ ] `.env` ignored; `.env.example` complete with comments.

Error handling and logging
- [ ] Central error handler; generic 500 message; `sqlMessage`/stack only in non-production and only server-side logs; request id in 500 responses.
- [ ] 401 vs 403 used correctly (401 = no/invalid token; 403 = authenticated but not allowed/disabled/unregistered), because the frontend sign-out logic depends on it.
- [ ] No user enumeration from register beyond what Firebase already does (returning 409 `CONFLICT` with `details.reason = 'email_in_use'` is acceptable for a school admin tool; note it).

Operational
- [ ] Admin self-deactivation guard.
- [ ] Seed demo passwords documented as demo only; `NODE_ENV=production` disables `details.stack` and the dev banner.
- [ ] `npm audit` clean or explained; lockfiles committed.

---

## D. Requirement-to-verification matrix

The 14 required features in the order of the plan's coverage matrix (`docs/PROJECT_PLAN.md`, section 2), plus the API documentation item listed alongside them. Every row is a manual check to run as the named demo role before submission.

| # | Feature | Role | Where | Manual steps | Expected |
|---|---|---|---|---|---|
| 1 | Student, teacher, and administrator accounts | admin (+ the new user) | `/admin/users` | Create teacher `t9@school.test` (the same page creates any role); log in as t9 in a private window; back as admin deactivate t9 (`PATCH /users/:id/status { isActive: false }`); t9 clicks anything | t9 appears in the list with role teacher; after deactivation t9 is signed out with "account disabled"; t9 cannot log in (`auth/user-disabled`); admin cannot change own status (403 `FORBIDDEN`, `details.reason = 'self_status_change'`); deactivating the last active admin -> 409 `CONFLICT` (`details.reason = 'last_admin'`) |
| 2 | Firebase Authentication (register, login, forgot password, logout) | anon -> student | `/register`, `/login` | Register `newstudent@school.test` / `Password123!`; logout; login again; reload page; try a wrong password; request a password reset | Lands on `/student` dashboard with empty states; session survives reload; wrong password shows the generic "Invalid email or password"; the reset request succeeds; `GET /auth/me` returns role `student`; `POST /auth/register` with a `role` field -> 400 |
| 3 | MySQL database | reviewer | `backend/` | On a fresh MySQL run `npm run db:migrate`, then open the schema in Workbench | `school_management` is created from `schema.sql` with its tables, FKs, unique keys and CHECK constraints (no `mysql` CLI needed); the ERD shows the relationships; `npm run db:seed` twice is a no-op the second time |
| 4 | Backend REST API | any | `/api/v1` | `curl http://localhost:3000/api/v1/health`; call an endpoint with and without a token; call an unknown path | Every response uses the envelope and carries `X-Request-Id`; unknown route -> 404 `NOT_FOUND` envelope; every error code comes from the closed catalogue |
| 5 | Student enrollment and profile management | admin, student | `/admin/students`, `/admin/students/:id` -> Enroll / Transfer, `/student/profile` | Create a student, search by name, sort by student number, edit phone, page through the list with `limit=5`; enroll `newstudent` into Grade 10 A; enroll again into 10 B; use Transfer instead; as the student edit own phone | Server-side: URL carries `?page=2&limit=5&search=...`; `meta.total` matches filter; duplicate student number (`STU-YYYY-NNNN`) -> inline error from 409 `CONFLICT`; second active enrollment -> 409 `CONFLICT`; `POST /enrollments/transfer` closes the old row as `transferred` and opens the new one as `active` in one transaction; student dashboard shows the new class; `PATCH /auth/me` saves contact fields only |
| 6 | Subjects and class management | admin | `/admin/subjects`, `/admin/classes` | Create `PHY` Physics; try `phy` again; try delete `MATH` (used by seed); retire it with the active toggle instead; create `Grade 10 B` for `2026-2027`; try `2026/2027` | ci collation -> 409 `CONFLICT`; delete of a used subject -> 409 `CONFLICT` with a human sentence; a retired subject disappears from new assignments; `2026/2027` -> 400 `VALIDATION_ERROR`; class appears with 0 students |
| 7 | Teacher assignment | admin, teacher | `/admin/classes/:id` -> Subjects & Teachers, `/admin/teachers` | Assign Physics to Grade 10 A with teacher1; assign Physics again with teacher2; reassign to teacher2; create a teacher with a duplicate employee number | Second assignment -> 409 `CONFLICT` (one teacher per subject per class); reassign succeeds; teacher1 sees the assignment under `/teacher/classes` (`GET /class-subjects?teacherId=me`); duplicate employee number -> 409 `CONFLICT` with `details.key` |
| 8 | Attendance tracking | teacher, student, admin | `/teacher/attendance` | As teacher1 pick own class_subject + today; mark 2 absent, save (`PUT /attendance/sheet`); save again with one change; try another teacher's class_subject via API | Upsert, no duplicate error; API for a lesson not owned -> 403 `FORBIDDEN`; student sees own records and percentage (`GET /attendance?studentId=me`, `GET /attendance/summary`); admin sees the class summary |
| 9 | Grade management | teacher, student | `/teacher/grades` | Create assessment "Quiz 1" max 20; enter scores incl. 25 and -1; enter 18; enter a score for a non-enrolled student via API | 25 and -1 rejected (400 `VALIDATION_ERROR`); non-enrolled -> 400 `VALIDATION_ERROR` (`details.reason = 'not_enrolled'`); student sees Quiz 1 as 18/20 grouped by term and subject (`GET /grades?studentId=me`) |
| 10 | Class schedules | admin, teacher, student | `/admin/schedules` | Add Mon 08:00-09:00 Room 101 for Math/10A; add Mon 08:30-09:30 for 10A (any subject); add Mon 08:30 for teacher1 in 10B; add Mon 08:30 Room 101 for 10B with another teacher; add Mon 09:00-10:00 Room 101 10A | Three 409 `SCHEDULE_CONFLICT` whose `details.conflicts[].type` are class, teacher and room; the adjacent 09:00 slot succeeds; teacher and student weekly views (`GET /schedules`, scoped) show slots grouped Mon..Sun |
| 11 | Announcements | admin, teacher, student | `/admin/announcements`, `/teacher/announcements` | Admin posts `audience=teachers`; teacher1 posts to class 10A (`classId` required for teachers); student in 10A and student in 10B compare feeds | Student 10A sees the class post, not the teachers-only one; student 10B sees neither; teacher sees teachers-only + own class; a teacher post without `classId` -> 400 |
| 12 | Separate student, teacher, and admin dashboards | all | `/admin`, `/teacher`, `/student` | Log in as each demo user | Admin: counts + today's attendance + latest announcements; teacher: today's schedule (correct weekday) + pending attendance; student: today's schedule, attendance %, recent grades; numbers match the list pages; three different payloads from `GET /dashboard`, not three skins |
| 13 | Search and filtering | admin | any list | Change `sortBy`, `sortOrder`, `search`, `page` in the URL bar; filter students by class and status | Server honours them; `sortBy=evil` -> 400; `limit=1000` -> 400; `%` in `search` is literal; `meta.total` matches the filters |
| 14 | Role-based access control | all | guards + API | As student open `/admin/users` (URL bar); `curl -H "Authorization: Bearer <studentToken>" /api/v1/users`; as teacher `POST /api/v1/subjects`; as student `GET /api/v1/grades?studentId=<otherId>` | UI shows the 403 page (not a redirect to login); API 403 `FORBIDDEN` for all three; no token -> 401 `UNAUTHORIZED` |
| (also listed) | Basic API documentation | any | `/api/docs`, `/health` | Open Swagger UI; `npm run token -- admin@school.test Password123!`; Authorize; Try `GET /students` | 200 with envelope; every endpoint present; schemas match actual responses |

Setup reproducibility is not a listed requirement but is the gate the rest depends on: fresh clone, follow the README alone, running within ~15 minutes including Firebase project creation.

Minimal automated smoke tests worth writing (node:test + supertest; DB `school_management_test` migrated in `before`, tables truncated per file; the app factory `createApp({ verifyIdToken, firebaseAuth })` receives fakes so tests need no network):
1. `GET /health` -> 200, `data.status === 'ok'`, `data.db === 'ok'`.
2. Auth middleware: no header -> 401 `UNAUTHORIZED`; garbage token (fake verifier throws) -> 401 `UNAUTHORIZED` with `details.reason` set to the Firebase code; valid token for a uid not in MySQL -> 403 `USER_NOT_REGISTERED`; inactive user -> 403 `ACCOUNT_DISABLED`.
3. RBAC: student `GET /users` -> 403; teacher `POST /subjects` -> 403; admin `POST /subjects` -> 201; teacher `PUT /attendance/sheet` for a class_subject owned by another teacher -> 403; student `GET /grades?studentId=<otherId>` -> 403.
4. Schedule conflicts: class/teacher/room overlaps -> 409 `SCHEDULE_CONFLICT` with the right `details.conflicts[].type`; adjacent slot -> 201; updating a slot does not conflict with itself.
5. Register: body with `role: 'admin'` -> 400 (strict); DB row role is `student`; fake `createUser` called once; when the MySQL insert is forced to fail, fake `deleteUser` was called (compensation); the sixth attempt within 15 minutes from one IP -> 429 `RATE_LIMITED` (limiter enabled for that test only).
6. Enrollment: second active enrollment -> 409 `CONFLICT`; `POST /enrollments/transfer` leaves exactly one `active` row and one `transferred` row.
7. Lists: `sortBy=evil` -> 400; `limit=1000` -> 400; `search` with `%` is literal; `meta.total` respects `search`.
8. Errors: duplicate subject code -> 409 `CONFLICT` with `details.key === 'code'`; unknown route -> envelope `NOT_FOUND`; invalid JSON -> 400 `VALIDATION_ERROR`; POST without content type -> 400.
9. Admin guard: own status change -> 403 `FORBIDDEN` (`details.reason = 'self_status_change'`).
10. `check:constants` script passes; `openapi.yaml` parses; optional drift test: for each `paths` entry in the YAML, request it with `{id}` -> `1` as admin and assert status !== 404.

---

## E. "Runs first try" README skeleton (Windows-first, cross-platform notes inline)

```
# School Management System
Stack | Features | Screenshots (2-3) | Demo credentials | Quick start | API docs | Tests | Project structure | Design decisions | Troubleshooting
```

Quick start (ordered)

0. Prerequisites: Node >= 22.12 (tested on 24.x), npm >= 10, MySQL Server 8.0 running (Windows service `MySQL80`), Git, a Google account (free Firebase Spark plan; no billing, no card). ~15 minutes.
1. Clone: `git clone <url> school-management-system` then `cd school-management-system`. Windows note: if `npm` fails with "running scripts is disabled", run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in PowerShell once, or use `npm.cmd`.
2. MySQL: know your `root` password (set during the MySQL installer). Nothing else to prepare; the migrate script creates the database. Optional dedicated user (paste in MySQL Workbench or `& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p`):
   `CREATE USER 'school'@'localhost' IDENTIFIED BY 'school_pw'; GRANT ALL ON school_management.* TO 'school'@'localhost'; GRANT CREATE ON *.* TO 'school'@'localhost';`
3. Firebase project ($0 path, ~5 min): https://console.firebase.google.com -> "Create a project" -> name `school-mgmt-<yourname>` -> disable "Google Analytics" toggle -> Create (keep the "Spark (no-cost)" plan if shown; never click Upgrade). Then: Build -> Authentication -> Get started -> Sign-in method -> Email/Password -> Enable (leave "Email link" off) -> Save. Then: gear icon -> Project settings -> General -> "Your apps" -> `</>` Web -> nickname `web` -> do NOT tick Firebase Hosting -> Register -> copy the `firebaseConfig` values. Then: Project settings -> Service accounts -> "Generate new private key" -> Generate -> save the downloaded file as `backend/firebase-service-account.json` (this path is git-ignored).
   Note: if you received a credentials bundle with this submission, place its three files (`backend/.env`, `backend/firebase-service-account.json`, `frontend/.env`) and skip to step 6.
4. Backend env: `Copy-Item backend\.env.example backend\.env` (`cp` on macOS/Linux). Edit `DB_PASSWORD` (quote it if it contains `#`, `$` or spaces). Leave `DB_HOST=127.0.0.1`, `PORT=3000`, `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`, `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`.
5. Frontend env: `Copy-Item frontend\.env.example frontend\.env`; paste the six `VITE_FIREBASE_*` values from step 3. Leave `VITE_API_BASE_URL` at its default `/api/v1` (the dev server proxies `/api` to the backend). Both `.env` files must point at the SAME Firebase project.
6. Install: `cd backend; npm ci` then `cd ../frontend; npm ci` (npm ci uses the committed lockfiles).
7. Database: in `backend/`: `npm run db:migrate` (creates `school_management` and its tables) then `npm run db:seed` (creates demo Firebase users and data; safe to re-run). The seed prints the demo credentials. `npm run db:reset` drops the database and rebuilds it (migrate + seed) - destructive, only for starting over.
8. Check: `npm run doctor` in `backend/` - all lines must be PASS.
9. Run (two terminals): `backend/`: `npm run dev` -> http://localhost:3000/health ; `frontend/`: `npm run dev` -> http://localhost:5173 .
10. Open http://localhost:5173 and log in with a demo account. API docs: http://localhost:3000/api/docs (get a token with `npm run token -- admin@school.test Password123!`). Tests: `backend/`: `npm test` (uses `school_management_test`, created automatically).

Demo credentials (seeded): `admin@school.test`, `admin2@school.test`, `teacher1..3@school.test`, `student1..8@school.test`, all `Password123!` (or the `SEED_PASSWORD` you set). Suggested 5-minute tour = the manual steps from Section D.

Troubleshooting (exact text -> fix)

| You see | Fix |
|---|---|
| `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (once), or run `npm.cmd ...`, or use cmd.exe |
| `Error: connect ECONNREFUSED 127.0.0.1:3306` | MySQL is not running: open Services and start `MySQL80`, or run `net start MySQL80` in an admin terminal |
| `Access denied for user 'root'@'localhost' (using password: YES)` | Wrong `DB_PASSWORD` in `backend/.env`; wrap values containing `#`, `$`, spaces in double quotes; restart the backend |
| `Access denied for user ''@'localhost' (using password: NO)` or `Missing environment variables: ...` | `backend/.env` not found/loaded: it must be at `backend/.env`; start the server from `backend/` with `npm run dev` |
| `ER_BAD_DB_ERROR: Unknown database 'school_management'` or `Table 'school_management.users' doesn't exist` | Run `npm run db:migrate` (then `npm run db:seed`) in `backend/` |
| `ENOENT ... firebase-service-account.json` or `Service account object must contain a string "project_id" property` | Download the key (step 3) and save it exactly as `backend/firebase-service-account.json`; do not paste it into `.env` |
| `Firebase ID token has incorrect "aud" (audience) claim. Expected "X" but got "Y"` or red "projects differ" banner | `frontend/.env` and `backend/firebase-service-account.json` belong to different Firebase projects; fix one, restart both servers, log out/in |
| Login fails with `auth/operation-not-allowed` | Enable Email/Password in Firebase console -> Authentication -> Sign-in method |
| Blank page / console `Firebase: Error (auth/invalid-api-key)` | `frontend/.env` missing or values not prefixed `VITE_`; create it and restart `npm run dev` (Vite reads env at start) |
| Login works but app says "Your account is not set up (USER_NOT_REGISTERED)" | Seed not run against this Firebase project or DB was reset: run `npm run db:seed` again (it re-links accounts by email), then log out and in |
| `Error: listen EADDRINUSE: address already in use :::3000` or `EACCES: permission denied 0.0.0.0:3000` | Another process (or a Windows reserved port range) holds 3000: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`, or set `PORT=3001` in `backend/.env` and `VITE_API_BASE_URL=http://localhost:3001/api/v1` in `frontend/.env` |
| `Port 5173 is already in use` (Vite, strictPort) | Stop the other Vite instance, or change `server.port` and add the new origin to `CORS_ORIGINS` |
| Browser console: `blocked by CORS policy: No 'Access-Control-Allow-Origin'` | You are calling the API from an origin not in `CORS_ORIGINS` (e.g. 127.0.0.1 vs localhost, or a different port); add it or leave `VITE_API_BASE_URL` at `/api/v1` to use the proxy |
| `Firebase ID token has expired` / token `iat` errors right after login | Your PC clock is off: Settings -> Time & language -> Date & time -> "Sync now" (or `w32tm /resync` as admin) |
| `Error fetching public keys for Google certs` / `getaddrinfo ENOTFOUND www.googleapis.com` | Backend needs internet to fetch Google's signing keys (cached ~6 h); check connection/proxy |
| `npm ERR! code EPERM ... unlink ... esbuild.exe` or `EBUSY` during `npm ci` | Folder is synced by OneDrive or locked by antivirus: pause OneDrive, delete `node_modules`, retry; better: clone outside OneDrive |
| `'vite' is not recognized` / `Cannot find package 'express'` | Run `npm ci` inside `frontend/` or `backend/` respectively |
| `Unknown collation: 'utf8mb4_0900_ai_ci'` or other migrate errors on MariaDB | Use MySQL 8.0+; MariaDB is not supported |
| Swagger page blank | Check browser console; confirm backend started without a YAML parse error; hard refresh |

---

## F. Scope guard

Decided in scope by the plan (do not cut): room conflict detection alongside class and teacher conflicts, class-targeted announcements (`classId`), URL-synced list params (`useListParams`), all three role dashboards with live aggregates, deactivation mirrored to Firebase (`disabled: true` + `revokeRefreshTokens`), the forgot-password flow (`sendPasswordResetEmail`, free on Spark) and the single-transaction transfer endpoint (`POST /enrollments/transfer`).

Optional - cut first if time is short:
- Firebase Auth emulator support - appendix only; never the default path.
- `GET /meta/enums` (the `check:constants` script is the real guarantee), the OpenAPI drift test, a root `package.json` with `concurrently` - conveniences.
- Rate limiting beyond `/auth/register`; structured logging beyond the request id - optional.
- Dark mode, fancy timetable grid, charts - cosmetic; a clean table grouped by day is sufficient.

In the 14 items but at risk of looking superficial - strengthen:
- RBAC: must be enforced server-side with ownership (Section C matrix) and demonstrated via Swagger/curl; UI-only hiding will be called out by any reviewer who tries a URL.
- Attendance: needs BOTH a marking screen (bulk per class_subject per date, pre-filled with existing marks, upsert) AND a read view (student percentage per subject, admin/teacher per-date list). Marking only looks half-done.
- Grades: assessments normalized is good; the student view must group by term/subject and show `score/maxScore`; an admin/teacher "class gradebook" (students x assessments) table is what reviewers expect to see - at least a simple one.
- Schedule: conflict detection must return a specific 409 with what conflicts, and the UI must surface it inline; a weekly view per class and per teacher (grouped by day) is the minimum to be credible.
- User management: admin-creates-any-role, deactivate/reactivate, filter by role/status; show that register is student-only (reviewers test this).
- Enrollment: enforce "one active per student" at the DB level (generated column unique) and show the class on the student profile.
- API docs: every endpoint, with request/response examples and the error envelope documented once via `components`; `servers` relative; `bearerAuth` scheme. Hand-written YAML drifts - do the manual Swagger "Try it out" sweep before submission.
- Pagination/search/sort: server-side on ALL list endpoints (not just students), with `meta.total` correct under filters.
- Data model invariants: `class_subjects UNIQUE (class_id, subject_id)` (plan's `class+subject+teacher` key would allow two teachers for the same subject in one class - almost certainly not intended); CHECKs listed in item 13.
- Seed quality: realistic names, two classes, enough attendance/grades that dashboards are not empty, idempotent, prints credentials. The seed IS the demo; a thin seed makes a working app look empty.
- README: the single most reviewed artifact; rehearse it from a clean clone.

Pre-submission gate (do all, in order): move out of OneDrive -> `git init` with `.gitignore` first -> pin majors + commit lockfiles -> implement -> `npm test` (incl. `check:constants`) -> `npm run build` (frontend) -> `check:secrets` -> clean-clone rehearsal with a brand-new Firebase project and DB name on the README alone -> Swagger sweep -> Section D tour as each demo role -> push -> verify on GitHub that `.env`, `node_modules`, service account are absent and the README renders.
