# School Management System — Project Plan

Status: implemented. Sections 1–15 are the plan the build followed; section 16 records where the code deliberately differs.
Date: 2026-10-03 (plan), updated 2026-10-04.

This document is the contract for the whole project. The detailed design documents in `docs/design/` expand on it; where a detailed document disagrees with this plan, this plan wins (the decisions in section 5 list every such case).

---

## 1. What is being built

Assignment: **School Management System with Backend API + Firebase + MySQL** (web application), with 14 required features (section 2).

Deliverable: a Git repository that a reviewer can clone and run on their own machine from the README in about 15 minutes, containing:

- `backend/` — Node.js + Express 5 REST API, MySQL 8 database, Firebase Admin SDK for token verification and account provisioning, Swagger UI at `/api/docs`.
- `frontend/` — React + Vite single-page app with Firebase Authentication (email/password) and three separate role areas (`/admin`, `/teacher`, `/student`).
- Seeded demo data (1 admin + 1 spare admin, 3 teachers, 8 students, 5 subjects, 2 classes, a full weekly timetable, two weeks of attendance, assessments with grades, announcements) so every dashboard has content on first login.
- README with the exact zero-cost setup path, demo credentials, troubleshooting table.

Hard constraints:

- Total cost: **$0**, no credit card anywhere (verified in section 3).
- Every item in the required list must be visibly implemented and demonstrable (section 2 maps each one to code and to a verification step).
- One pattern per layer, no duplicated logic, folder hierarchy that tells you where a bug lives (sections 7, 9, 10).

---

## 2. Requirement coverage matrix

| # | Required feature | Database | Backend | Frontend | How a reviewer verifies it |
|---|---|---|---|---|---|
| 1 | Student, teacher, and administrator accounts | `users.role` ENUM + 1:1 `students` / `teachers` profile tables | `POST /users` (admin, any role), `POST /auth/register` (public, student only), `PATCH /users/:id/status`, `DELETE /users/:id` (only while unused) | Admin → Users page: create user of any role, activate/deactivate | Create a teacher as admin, log in as that teacher in a private window |
| 2 | Firebase Authentication | `users.firebase_uid` UNIQUE | `authenticate` middleware verifies the Firebase ID token on every request; Admin SDK creates/disables users | Firebase JS SDK login, register, forgot password, logout | Register, log out, log in, reload page: session survives; wrong password shows a generic error |
| 3 | MySQL database | 12 InnoDB tables, 18 FKs, 15 UNIQUE keys, 11 CHECK constraints, 1 generated column | `mysql2` pool, parameterized SQL only, repository layer | — | `npm run db:migrate` creates the schema from `schema.sql`; Workbench shows the ERD |
| 4 | Backend REST API | — | 75 endpoints under `/api/v1` (64 designed, see section 16), one JSON envelope, closed error catalogue | all data via `apiClient` | Swagger UI "Try it out" with a token |
| 5 | Student enrollment and profile management | `students`, `enrollments` (one active row per student, enforced by a unique index) | students CRUD, `POST /enrollments`, `/enrollments/bulk`, `/enrollments/transfer`, `PATCH /enrollments/:id` | Students list (enroll / transfer), Student detail (profile, enrollment history, attendance, grades), Profile page (self-service contact fields) | Enroll a new student, try to enroll them in a second class (409), transfer them |
| 6 | Subjects and class management | `subjects`, `classes` (UNIQUE per academic year) | subjects CRUD, classes CRUD | Subjects page, Classes list + Class detail (tabs) | Create a class for `2026-2027`; try `2026/2027` (400); delete a used subject (409) |
| 7 | Teacher assignment | `class_subjects (class_id, subject_id) → teacher_id`, UNIQUE per class+subject | `/class-subjects` CRUD (assign, reassign teacher, remove) | Class detail → "Subjects & Teachers" tab | Assign Physics to Grade 10-A with teacher1; assign again (409); teacher1 sees it under "My classes" |
| 8 | Attendance tracking | `attendance` UNIQUE (student, class_subject, date), `marked_by` audit | `GET/PUT /attendance/sheet` (whole roster per lesson per day, idempotent upsert), `/attendance`, `/attendance/summary` | Attendance marking page (teacher/admin), student attendance page with percentage | Mark a roster, save again with one change (no duplicate error), another teacher's lesson via API (403) |
| 9 | Grade management | `assessments` (max_score once) + `grades` UNIQUE (assessment, student) | assessments CRUD, `GET/PUT /assessments/:id/grades`, `/grades`, `/grades/summary` | Assessments page, Grade sheet, student grades per subject and term | Create "Quiz 1" max 20, enter 25 (400), enter 18 (saved), student sees 18/20 |
| 10 | Class schedules | `schedules` (ISO weekday, start/end TIME, room), CHECK end > start | schedules CRUD with class / teacher / room overlap detection (409 `SCHEDULE_CONFLICT` listing every conflict) | Weekly timetable per class, per teacher, per student; slot modal shows conflicts inline | Add an overlapping slot for the same class, same teacher, same room: three distinct conflicts; adjacent slot succeeds |
| 11 | Announcements | `announcements` (audience ENUM, optional class, publish/expiry window) | announcements CRUD with role + class visibility rules | Admin and teacher announcement pages (create/edit/delete), student feed | Admin posts to `teachers`; teacher posts to class 10-A; student in 10-B sees neither |
| 12 | Separate student, teacher, and admin dashboards | aggregate queries | `GET /dashboard` returns one of three role-specific payloads | `AdminDashboardPage`, `TeacherDashboardPage`, `StudentDashboardPage` with different content, not three skins | Log in as each demo user |
| 13 | Search and filtering | indexes on names, numbers, codes, dates, class/status | every list endpoint: `page`, `limit`, `search`, `sortBy` (whitelisted), `sortOrder`, resource filters; `meta.total` honours filters | shared `useListParams` + `DataTable`; filters live in the URL | Change `search`, `sortBy`, `page` in the URL bar; `sortBy=evil` returns 400 |
| 14 | Role-based access control | `users.role`, `is_active` | `authenticate` + `authorize(...roles)` + ownership assertions in services (teacher owns a lesson, student reads only own data) | route guards per area, nav per role, forbidden actions not rendered; backend remains the enforcement point | As student, open `/admin/users` (403 page); `curl` `GET /users` with a student token (403 JSON) |
| (also listed) | Basic API documentation | — | `backend/docs/openapi.yaml` served by Swagger UI at `/api/docs`; raw spec at `/api/docs/openapi.json` | linked from the README (not from the app UI) | Open Swagger UI, authorize with a token, call `GET /students` |

---

## 3. Stack and cost verification (checked against live sources on 2026-10-03)

### 3.1 Versions to pin (caret on the major.minor shown)

| Layer | Package | Version | Notes that affect code |
|---|---|---|---|
| Runtime | Node.js | 24.x (installed 24.16.0, Active LTS) | `import.meta.dirname` available; `--env-file` available |
| Backend | express | ^5.2 | async errors forwarded automatically (no wrapper); `req.query` is a read-only getter; wildcard routes must be named (`/*splat`); `res.send(status)` removed |
| Backend | mysql2 | ^3.24 | supports MySQL 8 `caching_sha2_password`; options `dateStrings`, `decimalNumbers`, `typeCast`, `multipleStatements` |
| Backend | firebase-admin | ^14.5 | **no `admin.auth()` namespace**; use `initializeApp`/`cert` from `firebase-admin/app` and `getAuth` from `firebase-admin/auth` |
| Backend | zod | ^4.6 | v4 API: `z.email()`, `z.iso.date()`, `{ error }` instead of `{ message }`, `z.treeifyError` |
| Backend | swagger-ui-express, yaml | ^5.0, ^2 | spec loaded from YAML at startup so a YAML error fails the boot |
| Backend | helmet, cors, morgan, express-rate-limit | ^8.3, ^2.8, ^1.10, ^8.7 | env files are loaded by Node (`--env-file-if-exists`), no dotenv |
| Backend (dev) | supertest, node:test | ^7 | no Jest; Node's built-in runner |
| Frontend | react, react-dom | ^19.3 | |
| Frontend | vite, @vitejs/plugin-react | ^8.3, ^6.1 | Rolldown bundler; keep the pair matched |
| Frontend | react-router | ^8.4 | **do not install `react-router-dom`** (removed); `RouterProvider` from `react-router/dom`, everything else from `react-router`; data mode, no framework mode |
| Frontend | @tanstack/react-query | ^5.104 | `isPending`, `gcTime`, `placeholderData: keepPreviousData` |
| Frontend | tailwindcss, @tailwindcss/vite | ^4.3 | no `tailwind.config.js`, no PostCSS; `@import "tailwindcss"` + `@theme` |
| Frontend | firebase | ^12.19 | modular SDK; never `firebase@next` |
| Frontend | react-hook-form, @hookform/resolvers, zod | ^7.89, ^5, ^4.6 | same zod major as the backend |
| Frontend | lucide-react | latest | only icon dependency |
| Tooling | eslint ^10 (flat config), prettier ^3, prettier-plugin-tailwindcss | | |
| Local services | MySQL Server 8.0 (service `MySQL80`, installed), Firebase project on the Spark plan | | MySQL 8.0 is out of Oracle support since 2026-04-30; fine for local use |

### 3.2 Cost check

| Item | Verdict | Evidence |
|---|---|---|
| Firebase Spark plan, Email/Password provider | Free, no card ("No payment method needed"; 50K monthly active users) | firebase.google.com/pricing |
| Firebase Admin SDK (`verifyIdToken`, `createUser`, `updateUser`, `revokeRefreshTokens`) and service-account key download | Free; only rate quotas (100 new accounts/hour/IP, far above the seed's 13) | firebase.google.com/docs/auth/limits |
| MySQL Community Server (local) | Free | already installed |
| All npm packages above | Free, MIT/Apache licences | npm registry |
| Optional later: Firebase Hosting (SPA), Render free web service (API, sleeps after 15 min), Aiven free MySQL or TiDB Cloud Starter | Free, no card | verified in `docs/design/01-stack-and-free-tier.md` |
| Not free, never used: Cloud Storage (Blaze since 2026-02-03), Cloud Functions, Phone auth, Identity Platform upgrade toggle, Google Cloud "$300 trial" banner, Koyeb, Fly.io, Railway | — | same document |

Firebase console rule for the README: create the project with Google Analytics off, enable only **Authentication → Sign-in method → Email/Password**, register one Web app, download one service-account key. Never click "Upgrade", "Storage → Get started", "Functions", "Phone", or "Upgrade to Identity Platform".

---

## 4. Architecture

```
Browser (React SPA, Vite)                      Firebase Authentication (Spark)
  |  signInWithEmailAndPassword  ───────────────▶  issues ID token (JWT, 1 h)
  |  Authorization: Bearer <idToken>
  ▼
Express 5 API  /api/v1  ─────────────────────────▶  firebase-admin verifyIdToken (public keys, cached)
  |  authenticate: token → users row by firebase_uid → role, is_active, studentId/teacherId/activeClassId
  |  authorize(roles) → validate(zod) → controller → service (rules, ownership) → repository (SQL)
  ▼
MySQL 8 (school_management)                    firebase-admin createUser / updateUser / revokeRefreshTokens
                                               (only from users.service: create account, change status)
```

Principles:

1. **Firebase answers "who are you"; MySQL answers "what are you here".** Identity (password, token) lives in Firebase. Role, active flag and all school data live in MySQL. Role is stored only in MySQL (no custom claims), is read on every request, and is immutable after account creation.
2. **One code path for account creation** (`users.service.createUserAccount`): check MySQL for the email → reuse an existing Firebase user with that email when the caller is trusted (admin or seed), otherwise create one → insert `users` + profile row in one transaction → if MySQL fails and this call created the Firebase user, delete it. Public registration calls the same function with `role` forced to `student`.
3. **Deactivation, never deletion, of people.** `is_active = 0` in MySQL (checked on every request, so a still-valid token stops working immediately) → Firebase `updateUser({ disabled: true })` → `revokeRefreshTokens`. Reactivation reverses it.
4. **`class_subjects` is the hub.** A teacher assignment *is* a row there; schedules, attendance and assessments reference it, never the class or teacher directly. Changing the teacher of a subject is a one-column update with all history intact.
5. **The database enforces every invariant it can** (unique keys, CHECKs, FK RESTRICT, generated-column uniqueness for "one active enrollment"); the service layer enforces the cross-table rules (score ≤ max score, student enrolled in the lesson's class, timetable overlap) inside the same transaction.
6. **Backend is the only enforcement point.** The UI hides what a role can never do, but every protected route is guarded by `authenticate` + `authorize` and every "own" rule by a named assertion in `modules/access`.

---

## 5. Decisions log (every conflict between the detailed designs, resolved)

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Language | JavaScript (ESM) on both sides, zod for runtime validation, JSDoc where helpful | No build step on the backend, fewer config files, fewer failure modes for a reviewer; zod gives the runtime safety that matters here (section 14 asks you to confirm) |
| D2 | Valid Firebase token but no MySQL row | `403 USER_NOT_REGISTERED` (not 401) | The token *is* authenticated; the account is not provisioned. Frontend treats `USER_NOT_REGISTERED` and `ACCOUNT_DISABLED` as "sign out + message" |
| D3 | Enrollment statuses | `active`, `completed`, `transferred`, `withdrawn` (no `dropped`) | Matches the validated schema and its CHECK constraints (`left_on` required once closed) |
| D4 | Class transfer | Single endpoint `POST /enrollments/transfer { studentId, classId }` — one transaction: close the active row as `transferred`, insert a new row (every enrollment is its own row, so re-joining a class keeps the earlier period) | Removes the half-done state a two-call transfer leaves behind; the DB order (close first, then insert) is exactly what the unique index requires |
| D5 | Assessment types | `quiz`, `test`, `exam`, `assignment`, `project`, `other` | Schema's set; `other` avoids forcing a wrong label |
| D6 | Term | ENUM `term1`, `term2`, `term3` in DB, zod and UI (labels "Term 1/2/3") | One shared constant instead of free text typed differently per teacher |
| D7 | Deleting an assessment with grades | FK stays RESTRICT; `DELETE /assessments/:id` deletes grades then the assessment in one transaction, after a UI confirm that shows the graded count | Nothing is erased implicitly; API behaviour is the same as a cascade |
| D8 | Student date field | `admission_date` / `admissionDate` (NOT NULL, defaults to today on creation) | "Enrollment" means class membership in this system; two meanings for one word is the bug source we are avoiding |
| D9 | Teacher profile fields | `employee_number`, `hire_date` (NOT NULL, defaults to today), `department` (nullable), `qualification` (nullable) | `department` is what lists filter on; `specialization` dropped as a synonym |
| D10 | `classes.section` | Dropped; a class has `name` ("Grade 10 - A"), `grade_level`, `academic_year`, optional homeroom teacher | Section was redundant with the name |
| D11 | Business numbers | `STU-YYYY-NNNN`, `EMP-YYYY-NNNN`; auto-generated per year (`MAX + 1`, retry once on duplicate); admin may supply one matching the format; CHECK constraints enforce the format | Readable, sortable, unambiguous |
| D12 | Database name | `school_management` (tests use `school_management_test`) | |
| D13 | Firebase credentials on the backend | One git-ignored file `backend/firebase-service-account.json`, path from env `FIREBASE_SERVICE_ACCOUNT_PATH` | Pasting a private key into `.env` mangles newlines; a file the reviewer drops in place cannot |
| D14 | Ports and origins | API on 3000, Vite on 5173 (`strictPort`), Vite dev proxy `/api → http://127.0.0.1:3000`; `CORS_ORIGINS` env kept for non-proxy use | No CORS on a fresh clone; `127.0.0.1` avoids the IPv6 `localhost` pitfall on Windows |
| D15 | Frontend API base | `VITE_API_BASE_URL` default `/api/v1` (proxied) | Same reason |
| D16 | mysql2 pool options | `dateStrings: ['DATE']`, `timezone: 'Z'`, `decimalNumbers: true`, `typeCast` that returns TIME as `HH:MM` and TINYINT(1) as boolean, `SET time_zone = '+00:00'` per connection, `namedPlaceholders: false` | DATE never shifts; DATETIME serialises as ISO UTC; times and booleans are converted in exactly one place |
| D17 | Attendance rate | `rate = (present + late) / total`, 4 decimals, `null` when nothing is marked; counts per status returned alongside | One definition, documented in OpenAPI |
| D18 | Grade summary | Points-weighted: `SUM(score) / SUM(max_score) × 100` over graded assessments | Standard gradebook behaviour; a 50-point exam counts more than a 10-point quiz |
| D19 | Attendance sheet field names | Query `?classSubjectId=&date=`, body `{ classSubjectId, date, records }`; flat records use `attendanceDate`, range filters `dateFrom`/`dateTo` | |
| D20 | Error catalogue | Closed set: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `USER_NOT_REGISTERED` 403, `ACCOUNT_DISABLED` 403, `NOT_FOUND` 404, `CONFLICT` 409, `SCHEDULE_CONFLICT` 409, `RATE_LIMITED` 429 (register endpoint only), `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503. Specific situations go in `details.reason` (`not_class_subject_owner`, `self_status_change`, `invalid_status_transition`, …) | Eleven codes are easy to keep identical on both sides; reasons are free to grow |
| D21 | Role changes | Not supported in v1: deactivate and create a new account (email also immutable) | Removes the stale-role bug class and the two-system consistency problem |
| D22 | Teacher deactivation | Refused with 409 (`details.reason = 'teacher_has_assignments'`) while the teacher has `class_subjects` or homeroom classes in the current academic year | Rosters must never show an inactive teacher |
| D23 | Admin guards | Admin cannot change own status (403 `self_status_change`) or delete themselves (403 `self`). A last-admin guard locks the active admin rows inside the transaction and refuses (409 `last_admin`) any change that would leave none, so two admins deactivating each other at once cannot lock the school out; the seed ships a second admin | Lockout prevention |
| D24 | Subjects | Hard delete allowed only when unused (409 otherwise) **and** `is_active` flag to retire a used subject (hidden from new assignments) | Both behaviours are expected by reviewers |
| D25 | "Today" and the current academic year | Backend computes "today" and ISO weekday in `APP_TIMEZONE` (env; default = machine time zone); current academic year = August rule (`ACADEMIC_YEAR_START_MONTH = 8` in `constants/shared.js`, the one value both sides read) in one helper used by dashboards, teacher visibility defaults, attendance date checks and the seed. Clients always send attendance dates explicitly | Without a "current year" rule, last year's timetable would appear in "today" |
| D26 | Shared constants | `backend/src/constants/shared.js` and `frontend/src/constants/shared.js` are byte-identical (pure ESM, no env, no React); `npm run check:constants` (backend) compares the two files and the ENUM lists parsed from `schema.sql` | Every enum is typed once per side and checked mechanically |
| D27 | Helmet | `helmet({ contentSecurityPolicy: false })` globally | The only HTML served is Swagger UI, which CSP breaks; everything else is JSON |
| D28 | Body limit | `express.json({ limit: '1mb' })` | Bulk attendance/grade bodies up to 200 rows |
| D29 | Public registration | `POST /auth/register` enabled by default (`ALLOW_PUBLIC_REGISTRATION=true`), rate limited (5 per 15 minutes per IP), body schema strict with no `role` field, role hard-coded to `student` | Lets the reviewer try the app without an admin; production would turn it off |
| D30 | Seed demo accounts | `admin@school.test`, `admin2@school.test`, `teacher1..3@school.test`, `student1..8@school.test`, password from `SEED_PASSWORD` (default `Password123!`) | Obviously fake, valid syntax for Firebase |
| D31 | Seeding mechanics | `npm run db:migrate` runs `schema.sql` through a dedicated `multipleStatements` connection (creates the database; no `mysql` CLI needed); `npm run db:seed` is a Node script: Firebase users + `users`/profile rows first (idempotent, re-links `firebase_uid` by email), then `seed.sql` for everything else (resolves ids by natural keys; refuses to run twice; `npm run db:reset` drops and rebuilds) | `mysql.exe` is not on PATH on Windows installs; a reviewer should never need it |
| D32 | Transactions and pool | Repositories accept an optional trailing `conn`; `withTransaction(fn)` is the only place that calls `getConnection` and always releases in `finally`; `multipleStatements` only in the migrate/seed scripts | Prevents the "API hangs after 10 requests" class of bug |
| D33 | Validated input location | `validate()` writes to `req.validated = { params, query, body }`; nothing ever assigns to `req.query` | Express 5 getter |
| D34 | Grade level | 1..12 in CHECK, zod and UI | |
| D35 | Repository location | Recommended: move out of OneDrive to `C:\dev\school-management-system`; GitHub is the backup | `node_modules` inside a synced folder causes `EPERM`/`EBUSY` and watcher flakiness (section 14, decision 1) |
| D36 | Grade weights (added 2026-10-05) | Optional per subject: `subject_grade_weights` holds a whole percent per assessment type (adding up to 100). A weighted subject's result = each type's points percentage × its weight, over the types that have grades; without weights D18 applies. A student's result over several subjects (report card "general average", `groupBy=student` across subjects) is the mean of the subject results | Report cards such as DepEd's weight written work, tasks and exams differently; every subject counts once in the general average |
| D37 | School calendar (added 2026-10-05) | `calendar_events`: school-wide entries of type `holiday` (no classes: `PUT /attendance/sheet` answers 400 `school_holiday`, the sheet shows why and is read-only) or `event` (informational); inclusive `starts_on`..`ends_on`, at most 366 days. Admins write, everyone reads; dashboards list the next 30 days, timetables mark this week's entries | Teachers should not be able to mark a no-class day, and students should see it on their schedule |
| D38 | Student import (added 2026-10-05) | `POST /imports/students` takes raw spreadsheet cells, so each row is checked on its own (formats, duplicates in the file, emails and student numbers in use, class name of the current year) and problems come back per row. A dry run writes nothing; a create call writes nothing unless every row passes, then creates each account through `createUserAccount` with one temporary password and enrolls it in its class. The browser parses the CSV and sends rows in batches of 20 for a progress bar | Setting up a school by hand means hundreds of forms; all-or-nothing checking keeps a half-imported file from happening, while per-row creation keeps one Firebase hiccup from losing the rest |
| D39 | Activity log (added 2026-10-05) | Table `activity_log`, append-only, no foreign keys (the actor's name and role are copied, so entries outlive accounts). Services call `activity.record()` after a change succeeds; the actor comes from the request context (`utils/requestContext`, an AsyncLocalStorage opened by `authenticate`), so no service signature changed. Best effort: a failed log write goes to the server log and never fails the request. Grade and attendance saves log only what changed, with the previous value; admins read it at `GET /activity` | A grade dispute needs "who changed this score, from what"; threading the actor through every service would have touched every signature for a cross-cutting concern |
| D40 | Notifications (added 2026-10-05) | Table `notifications` per recipient (FK RESTRICT; deleting an unused account deletes its notifications first). Written by the services after a change, best effort like the activity log, never to the person who acted: grades new or changed, absent or late marks, a new class or transfer (students), a lesson or homeroom class (teachers), a self sign-up (all active admins). Announcements are not copied per reader: the bell adds the app's existing "new announcements" count. The unread count is an ordinary query, so the 20-second live refresh keeps it current without push infrastructure | Free hosting has no push service; polling one cheap count fits the existing refresh loop |

---

## 6. Data model (summary; full DDL in `docs/design/02-database.md`)

MySQL 8.0, InnoDB, `utf8mb4_unicode_ci`, snake_case, `id INT UNSIGNED AUTO_INCREMENT`, `created_at`/`updated_at` on every table, every FK `ON DELETE RESTRICT`.

| Table | Purpose | Key rules |
|---|---|---|
| `users` | one row per person of any role; `firebase_uid` (UNIQUE, binary collation), `email` (UNIQUE), names, phone, `role`, `is_active` | deactivated, not deleted, once anything refers to it; an unused account can be deleted |
| `teachers` | 1:1 profile: `employee_number` UNIQUE, `hire_date`, `department`, `qualification` | `UNIQUE(user_id)` |
| `students` | 1:1 profile: `student_number` UNIQUE, `date_of_birth`, `gender`, `address`, guardian fields, `admission_date`; **no class column** | `UNIQUE(user_id)`; current class derived from `enrollments` |
| `subjects` | catalogue: `code` UNIQUE, `name`, `description`, `is_active` | |
| `classes` | section in one academic year: `name`, `grade_level`, `academic_year` (`YYYY-YYYY`, CHECK consecutive), `homeroom_teacher_id` | `UNIQUE(academic_year, name)` |
| `class_subjects` | **teacher assignment**: `class_id` + `subject_id` → `teacher_id` NOT NULL | `UNIQUE(class_id, subject_id)` |
| `enrollments` | student ↔ class with history: `status`, `enrolled_on`, `left_on`, generated `active_flag` | `UNIQUE(student_id, class_id)`; `UNIQUE(student_id, active_flag)` = at most one active enrollment per student; CHECKs tie `left_on` to status |
| `schedules` | weekly slot per class_subject: `day_of_week` 1..7 (Monday = 1), `start_time`, `end_time`, `room` | CHECK `end_time > start_time`; overlaps rejected by the service (class, teacher, room) |
| `attendance` | one mark per student per class_subject per date; `status`, `remarks`, `marked_by` | `UNIQUE(student_id, class_subject_id, attendance_date)`; writes are upserts |
| `assessments` | graded event per class_subject: `title`, `type`, `term`, `max_score` DECIMAL(6,2), `assessed_on` | `UNIQUE(class_subject_id, term, title)`; CHECK `max_score > 0` |
| `grades` | one score per student per assessment; `remarks`, `graded_by` | `UNIQUE(assessment_id, student_id)`; CHECK `score >= 0`; `score <= max_score` checked by the service in the same transaction |
| `announcements` | `author_id`, `title`, `body`, `audience`, optional `class_id`, `published_at`, `expires_at` | CHECK `expires_at > published_at`; visibility = audience matches role AND (no class OR my class) |

Shared enum values (section 11) are the only values these ENUM columns accept.

---

## 7. API (summary; full contract in `docs/design/03-api-and-rbac.md`)

### 7.1 Conventions

- Base path `/api/v1`; docs at `/api/docs`; health at `GET /api/v1/health` (public, pings the DB, reports `firebaseProjectId` so the frontend can warn about a project mismatch in dev).
- JSON camelCase in and out; DB snake_case; conversion in exactly one place (`config/db.js` camelizes rows on read; writes use explicit column lists).
- Envelope: success `{ success: true, data, meta? }`; error `{ success: false, error: { code, message, details? } }`; `X-Request-Id` header on every response; never 204.
- Dates `YYYY-MM-DD`, times `HH:MM`, timestamps ISO-8601 UTC.
- All body and query schemas are strict (unknown keys → 400). PATCH bodies need at least one field.
- Lists: `page` (≥1), `limit` (1..100, over → 400), `search` (LIKE with escaped `%`/`_` over documented columns), `sortBy` (per-resource whitelist, else 400), `sortOrder`; `meta = { page, limit, total, totalPages }`; `total` from a second COUNT with the same WHERE.
- Scoping: omitted filter = caller's own scope; explicit filter outside the caller's scope = 403 (never silently narrowed); admin unscoped. The literal `me` is accepted wherever a `studentId`, `teacherId` or `authorId` appears.
- Teacher *visible* set = class-subjects they teach or any class-subject of a class they are homeroom teacher of; teacher *owns* = `class_subjects.teacher_id = me`. Reads use visible, writes use owns.

### 7.2 Endpoints (64)

| Module | Endpoints | Roles |
|---|---|---|
| auth (3) | `POST /auth/register` (public, student only) · `GET /auth/me` · `PATCH /auth/me` (contact fields) | any |
| users (6) | `GET /users` · `POST /users` (any role, profile object per role) · `GET /users/:id` · `PATCH /users/:id` (name, phone) · `PATCH /users/:id/status` · `DELETE /users/:id` (409 `has_history` once referenced) | admin |
| students (3) | `GET /students` (filters `classId`, `gradeLevel`, `gender`, `isActive`, `hasActiveEnrollment`) · `GET /students/:id` (`me` allowed) · `PATCH /students/:id` | A, T (visible), S (self) / A |
| teachers (3) | `GET /teachers` · `GET /teachers/:id` (`me`) · `PATCH /teachers/:id` | A / A, T (self) / A |
| subjects (5) | `GET` · `POST` · `GET /:id` · `PATCH /:id` (incl. `isActive`) · `DELETE /:id` (409 when used) | read any; write admin |
| classes (5) | `GET` (filters `academicYear`, `gradeLevel`, `homeroomTeacherId`) · `POST` · `GET /:id` · `PATCH /:id` · `DELETE /:id` | read any; write admin |
| class-subjects (5) | `GET` (filters `classId`, `subjectId`, `teacherId`, `academicYear`) · `POST` (assign) · `GET /:id` · `PATCH /:id` (reassign teacher) · `DELETE /:id` | read scoped; write admin |
| enrollments (6) | `GET` · `POST` · `POST /bulk` (all-or-nothing) · `POST /transfer` · `GET /:id` · `PATCH /:id` (`completed` or `withdrawn`) | read scoped; write admin |
| attendance (6) | `GET` · `GET /sheet?classSubjectId&date` · `PUT /sheet` (bulk upsert, only listed students touched) · `GET /summary` (`groupBy` none/student/classSubject) · `PATCH /:id` · `DELETE /:id` | A, T (owns for writes), S (own reads) |
| assessments + grades (10) | `GET /assessments` · `POST` · `GET /:id` · `PATCH /:id` · `DELETE /:id` · `GET /assessments/:id/grades` (roster with scores) · `PUT /assessments/:id/grades` (bulk upsert) · `GET /grades` · `GET /grades/summary` · `DELETE /grades/:id` | A, T (owns for writes), S (own reads) |
| schedules (5) | `GET` (filters `classId`, `teacherId`, `classSubjectId`, `dayOfWeek`, `room`, `academicYear`) · `POST` · `GET /:id` · `PATCH /:id` · `DELETE /:id` (overlap check on write) | read scoped; write admin |
| announcements (5) | `GET` (visibility rules; `status` filter admin-only) · `POST` (teacher: `classId` required and visible) · `GET /:id` · `PATCH /:id` · `DELETE /:id` (teacher: author only) | A, T, S (read) |
| dashboard (1) | `GET /dashboard` → `{ role: 'admin' \| 'teacher' \| 'student', ... }` | any |
| system (1) | `GET /health` | public |

### 7.3 Request pipeline

`requestId` → `helmet` → `cors` → `express.json` → `morgan` → `/api/docs` → `/api/v1` router (`/health`, `/auth/register` public; `authenticate` for everything else; per-route `authorize(...)` → `validate({...})` → controller) → `notFound` → `errorHandler` (last; maps `ApiError`, zod, body-parser, Firebase `auth/*` and MySQL `ER_*` errors to the envelope; stack only outside production).

Startup: zod-validated env (fails with a readable list), service-account file validated, `SELECT 1` against MySQL, Firebase probe; the banner prints port, DB and Firebase project id.

---

## 8. RBAC matrix (condensed; `Y` any record, `own` within scope, `N` 403)

| Capability | admin | teacher | student |
|---|---|---|---|
| Manage users (create any role, deactivate) | Y | N | N |
| Read / update own identity and contact fields | Y | Y | Y |
| Students: list, read, edit | Y | own (visible classes), read only | own (self), read only |
| Teachers: list, read, edit | Y | own (self), read only | N |
| Subjects, classes: read | Y | Y | Y |
| Subjects, classes, assignments, enrollments, schedules: write | Y | N | N |
| Class-subjects, enrollments, schedules: read | Y | own (visible) | own (active class / self) |
| Attendance: mark / correct | Y | own (owns lesson) | N |
| Attendance: read records and summary | Y | own (visible) | own (self) |
| Assessments: create / edit / delete; grades: enter / delete | Y | own (owns lesson) | N |
| Assessments, grades: read | Y | own (visible) | own (self) |
| Announcements: create | Y (any audience, optional class) | own (visible class required) | N |
| Announcements: edit / delete | Y | own (authored) | N |
| Announcements: read | Y (all statuses) | targeted + authored | targeted, active only |
| Dashboard | admin payload | teacher payload | student payload |

Enforcement: role column = `authorize(...)` on the route; every `own` cell = a named assertion in `modules/access/access.service.js` (`assertCanViewClassSubject`, `assertCanManageClassSubject`, `assertCanViewClass`, `assertCanViewStudent`, `assertIsSelf`, `assertIsAuthor`) called before any write.

---

## 9. Frontend (summary; full spec in `docs/design/04-frontend.md`)

- **Auth state machine** in one `AuthProvider`: `initializing → anonymous | resolving → authenticated | profile-error`. `onAuthStateChanged` → `GET /auth/me` (TanStack Query, no retry on 4xx, refetch on window focus) → role. `USER_NOT_REGISTERED` / `ACCOUNT_DISABLED` → sign out with a message; network / 5xx → retry screen, no sign-out. `apiClient` retries a 401 once with a forced token refresh, then signs out.
- **Guards as layout routes**: `PublicOnly` (`/login`, `/register`, `/forgot-password`), `RequireAuth` → `AppShell`, `RequireRole` per area. A page cannot be added unguarded.
- **Routes**: public 3 · shared 4 (`/` role redirect, `/profile`, `/403`, `*`) · `/admin/*` 13 · `/teacher/*` 8 · `/student/*` 6 = 34 routes, 30 page components. `AttendanceMarkPage`, `AssessmentsPage`, `GradeSheetPage`, `AnnouncementsPage` are shared by admin and teacher and branch only on data source and action visibility.
- **Three dashboards, three products**: admin = "is the school running" (KPI tiles, today's attendance, enrollment by grade, upcoming assessments, announcements); teacher = "what do I do today" (today's periods with Mark now / Marked, sessions marked, pending grading, my classes); student = "how am I doing" (class card, attendance ring, grade summary per subject, today's timetable, recent grades, announcements). Each binds 1:1 to its `GET /dashboard` payload; no client-side aggregation.
- **One list pattern**: `useListParams` (page/limit/search/sort/filters in the URL) + feature hook + `DataTable` (columns config, skeletons, dimmed refetch, inline error, empty states) + `Pagination` + one modal. Every list page is this file with different columns.
- **Forms**: react-hook-form + zod (same regexes as the backend); server `VALIDATION_ERROR.issues` and `CONFLICT.details.key` mapped to fields by one helper; destructive actions always confirm; `SCHEDULE_CONFLICT` rendered inside the slot modal.
- **Data**: query-key factory per feature; mutations invalidate coarsely and toast; `queryClient.clear()` on sign-out.
- **Empty states everywhere**: a freshly registered student has no class, schedule, grades or attendance; every student page renders `NotEnrolledState` instead of crashing.
- Accessibility baseline: native `<dialog>`, real radio groups for attendance, labels and `aria-*` wired by `FormField`, keyboard-navigable menus, status never by colour alone, responsive sidebar drawer.

---

## 10. Repository layout

```
school-management-system/
├── .gitignore                      # node_modules, dist, .env*, !.env.example, *firebase-service-account*.json, *firebase-adminsdk*.json, desktop.ini, *.log
├── .gitattributes                  # * text=auto
├── README.md                       # setup ($0 path), demo credentials, project tour, troubleshooting
├── docs/
│   ├── PROJECT_PLAN.md             # this file
│   ├── ARCHITECTURE.md             # short reviewer-facing overview + ERD (written in phase 10)
│   └── design/                     # detailed design documents (01..05)
├── backend/
│   ├── package.json                # "type": "module"; scripts: dev, start, test, lint, format, db:migrate, db:seed, db:reset, check:constants, check:secrets, doctor
│   ├── .env.example
│   ├── firebase-service-account.json   # git-ignored; downloaded from the Firebase console
│   ├── database/
│   │   ├── schema.sql              # CREATE DATABASE + 17 tables (idempotent)
│   │   └── seed.sql                # non-user demo data, ids resolved by natural keys, dates relative to today
│   ├── docs/
│   │   └── openapi.yaml            # the API contract served at /api/docs
│   ├── scripts/
│   │   ├── migrate.js              # runs schema.sql (dedicated multipleStatements connection); --fresh drops first
│   │   ├── seed.js                 # Firebase users + users/profile rows, then seed.sql
│   │   ├── doctor.js               # env, service account, project-id parity with frontend/.env, DB reachable, tables present, ports free
│   │   ├── check-constants.js      # shared.js byte-equality + schema.sql ENUM parity
│   │   └── get-token.js            # prints a Firebase ID token for Swagger "Authorize" (uses the public web API key)
│   ├── tests/                      # node:test + supertest, app built with fake Firebase verifier
│   └── src/
│       ├── server.js               # loads env, validates startup, listens, graceful shutdown
│       ├── app.js                  # express app: middleware order, routers, 404, error handler
│       ├── routes.js               # mounts module routers under /api/v1
│       ├── constants/shared.js     # identical to frontend/src/constants/shared.js
│       ├── config/                 # env.js (zod), db.js (pool, query, withTransaction, typeCast, camelize), firebase.js, swagger.js
│       ├── middleware/             # requestId, httpLogger, authenticate, authorize, validate, notFound, errorHandler
│       ├── utils/                  # ApiError, respond, pagination, resolveMe, dates, sql (escapeLike, where builder), mysqlErrorMap, firebaseErrorMap, logger, zod/common
│       └── modules/
│           ├── access/             # access.service.js + access.repository.js — ownership rules and the dated-roster SQL fragment
│           ├── auth/               # auth.routes/controller/service/schemas
│           ├── users/              # users.service creates accounts (Firebase + MySQL, compensated); repository: auth lookup, history check
│           ├── students/ teachers/ subjects/ classes/ classSubjects/ enrollments/
│           ├── attendance/ assessments/ grades/ schedules/ announcements/
│           ├── dashboard/          # routes/controller/service/repository (aggregates only; no schemas)
│           └── health/             # routes/controller (pings the database)
└── frontend/
    ├── package.json                # scripts: dev, build, preview, lint, format, check
    ├── .env.example
    ├── index.html
    ├── vite.config.js              # react(), tailwindcss(), port 5173 strictPort, proxy /api → 127.0.0.1:3000
    ├── eslint.config.js, .prettierrc
    └── src/
        ├── main.jsx, index.css     # @import "tailwindcss"; @theme tokens
        ├── app/                    # App.jsx, router.jsx, providers/, guards/ (RequireAuth, RequireRole, PublicOnly, RoleRedirect), pages/ (403, 404, route error)
        ├── config/                 # env.js (validates VITE_*), firebase.js
        ├── lib/                    # apiClient.js, queryClient.js, queryKeys.js, envelope.js, formErrors.js, validators.js, theme.js, toastBus.js
        ├── constants/              # shared.js (identical to backend), ui.js (labels, tone classes)
        ├── utils/                  # date.js, schedule.js, roles.js, names.js, format.js, grades.js, listParams.js
        ├── hooks/                  # useDebounce, useListParams, useDisclosure, useConfirm, useDiscardConfirm, useUnsavedChangesBlocker, useTheme, ...
        ├── components/ui/          # Button, Input, Select, Textarea, Checkbox, RadioGroup, FormField, Table, DataTable, Pagination, SearchInput, Modal, ConfirmDialog, Badge, Spinner, Skeleton, EmptyState, ErrorState, Tabs, Card, StatTile, Tooltip, Dropdown, Toast
        ├── components/layout/      # AppShell, Sidebar, Topbar, NavItem, UserMenu, PageHeader, PageSkeleton, SplashScreen, DevProjectBanner, AuthLayout, navConfig.js
        └── features/               # auth, dashboard, users, students, teachers, subjects, classes, classSubjects, enrollments, attendance, grades, schedules, announcements, profile, health
            └── <feature>/          # keys.js, api.js, hooks.js, schemas.js, components/, pages/  (a feature has only the parts it needs)
```

Backend layer rule: a file imports only from the layer directly below it inside its module, from `utils`/`config`, or (services only) from another module's service. HTTP vocabulary lives in routes/controllers/middleware, SQL only in repositories, `ApiError` is thrown only by services, middleware and the two error maps. Wrong status or shape → controller; wrong rule → service; wrong rows → repository.

Frontend rule: if a file mentions a school resource it lives in `features/<resource>/`; if it knows nothing about any resource it lives in `components`, `hooks`, `utils`, `lib` or `config`. Features may import another feature's `api.js`, `hooks.js` and `components/`, never its `pages/`.

---

## 11. Cross-layer contract (values that must match in DB, API and UI)

`constants/shared.js` (identical on both sides, checked by `npm run check:constants`):

| Constant | Values |
|---|---|
| `ROLES` | `admin`, `teacher`, `student` |
| `GENDERS` | `male`, `female`, `other` |
| `ENROLLMENT_STATUSES` | `active`, `completed`, `transferred`, `withdrawn` |
| `ATTENDANCE_STATUSES` | `present`, `absent`, `late`, `excused` |
| `ASSESSMENT_TYPES` | `quiz`, `test`, `exam`, `assignment`, `project`, `other` |
| `TERMS` | `term1`, `term2`, `term3` |
| `ANNOUNCEMENT_AUDIENCES` | `all`, `students`, `teachers` |
| `ANNOUNCEMENT_STATUSES` (computed) | `active`, `scheduled`, `expired` (+ filter value `all`) |
| `DAYS_OF_WEEK` | 1..7, Monday = 1 (JS `getDay()` converted in one util: `((d + 6) % 7) + 1`) |
| `SORT_ORDERS` | `asc`, `desc` |
| `PAGINATION` | `DEFAULT_LIMIT 20`, `MAX_LIMIT 100` |
| `DATE_REGEX`, `TIME_REGEX`, `ACADEMIC_YEAR_REGEX`, `STUDENT_NUMBER_REGEX`, `EMPLOYEE_NUMBER_REGEX`, `SUBJECT_CODE_REGEX` | `YYYY-MM-DD`; `HH:MM`; `YYYY-YYYY` (consecutive checked in code); `STU-YYYY-NNNN`; `EMP-YYYY-NNNN`; `^[A-Z0-9-]{2,20}$` |
| `PASSWORD_MIN_LENGTH` | 8 (Firebase minimum is 6; both sides enforce 8) |
| `ERROR_CODES` | the eleven codes of decision D20 |
| `API_BASE_PATH` | `/api/v1` |

Other agreements: ids are positive integers (route params coerced); booleans in query strings are `true`/`false`; `null` clears a nullable field in PATCH; empty form strings are converted to `null` before submit; emails lower-cased on both sides.

---

## 12. Quality gates and security checklist

Baked into the implementation (not optional):

- Secrets: `.gitignore` committed first; service account only at the one ignored path; `npm run check:secrets` (`git grep private_key` must be empty) in the pre-submission gate; `.env.example` files contain placeholders only.
- Tokens: `Authorization: Bearer` only; `verifyIdToken` on every request; MySQL user row loaded on every request (`is_active` enforced immediately); project-id parity check in `doctor` and a dev-only banner in the UI.
- Input: zod on every params/query/body, strict objects (blocks mass assignment: `role` in the register body is a 400); parameterized SQL only; sort keys from whitelists; `LIMIT`/`OFFSET` interpolated only after integer validation; LIKE wildcards escaped.
- Ownership: every teacher write goes through `assertCanManageClassSubject`; every attendance/grade row is checked against the roster of that date (members on the day, plus anyone already marked); students never read by client-supplied ids outside their own.
- Errors: central handler; duplicate keys → 409 with the key name; FK deletes → 409 "in use"; unknown routes return the envelope; stack traces only outside production; request id in header and logs.
- Data: DATE as strings end to end; `decimalNumbers` so scores are numbers; ENUMs from shared constants; weekday ISO.
- Admin safety: self-status and self-delete guards, a locked last-active-admin check; seed ships a second admin.
- Reproducibility: lockfiles committed, `npm install` in the README, `engines.node >= 22.22`, Node scripts only (no shell scripts), paths quoted, `127.0.0.1` everywhere.
- Tests (`backend/tests`, run by `npm test`): health; auth middleware (401 missing/invalid token, 403 unregistered, 403 disabled); RBAC on three endpoints; register forces role `student` and compensates on MySQL failure; second active enrollment → 409; schedule conflicts (class, teacher, room, adjacent slot OK, self-update OK); list validation (`sortBy=evil` 400, `limit=1000` 400, `%` literal, `meta.total` under search); duplicate subject code → 409; `check:constants` passes; `openapi.yaml` parses and every path exists in the router.

Pre-submission gate (in order): `npm test` (backend) → `npm run lint` and `npm run build` (frontend) → `check:secrets` → clean clone into a fresh folder with a brand-new Firebase project and database name, follow the README literally → Swagger sweep → the 14 manual checks of section 2 as each demo role → push → confirm on GitHub that `.env`, `node_modules` and the service account are absent and the README renders.

---

## 13. Execution plan

Each phase ends with a verification step; the next phase starts only when it passes.

| Phase | Deliverables | Done when |
|---|---|---|
| 0. Preparation (you) | Confirm section 14 decisions; create the Firebase project ($0 path, section 15); move the folder if agreed | `backend/firebase-service-account.json` and the web config values exist |
| 1. Scaffold | `git init`, `.gitignore`, `.gitattributes`, README skeleton, both `package.json` with pinned versions and scripts, ESLint/Prettier, `constants/shared.js` on both sides, `.env.example` files, `check-constants.js` | `npm ci` succeeds in both folders; `npm run check:constants` passes; first commit contains no secrets |
| 2. Database | `schema.sql`, `migrate.js`, `seed.sql`, `seed.js` (Firebase + MySQL, idempotent), `doctor.js` | `db:migrate` → `db:seed` twice → `doctor` all PASS; row counts match the seed plan; every demo account can sign in (checked with `get-token.js`) |
| 3. Backend core | env, db (pool, typeCast, camelize, withTransaction), firebase, middleware chain, `ApiError`, error maps, health, auth module (register, me), users module (createUserAccount, status) | supertest: health, auth middleware cases, register forces student, admin creates teacher, deactivate blocks on next request |
| 4. Backend reference data | students, teachers, subjects, classes, class-subjects, enrollments (incl. bulk and transfer), access module | list/search/sort/filter on each; 409 on duplicates and in-use deletes; one-active-enrollment 409; transfer atomic |
| 5. Backend operations | attendance (sheet, summary), assessments + grades (roster, bulk, summary), schedules (conflicts), announcements (visibility), dashboard (three payloads) | ownership tests (teacher vs not-owner), score bounds, conflict matrix, announcement visibility per role, dashboard per seeded role |
| 6. API documentation | `docs/openapi.yaml` (tags per module, shared components, examples, `bearerAuth`), Swagger UI, `openapi.json`, route-vs-spec check | every router path appears in the spec; "Try it out" works with a token from `get-token.js` |
| 7. Frontend foundation | Vite + Tailwind + router + providers + guards + `apiClient` + `queryClient` + UI kit + layout + `useListParams` + `DataTable` + login/register/forgot-password/profile + dev project banner | log in as each role, land on the right area; hard reload shows no login flash; 403 page on a foreign URL; deactivated user is signed out on next click |
| 8. Frontend admin area | dashboard, users, students (+ detail), teachers (+ detail), subjects, classes (+ detail tabs: subjects & teachers, students, schedule), attendance, grades (+ grade sheet), announcements | every admin manual check in section 2 passes in the browser |
| 9. Frontend teacher and student areas | teacher dashboard, my classes, class-subject page, schedule, attendance, grades, announcements; student dashboard, my class, schedule, attendance, grades, announcements; empty states for an unenrolled student | the 14 manual checks pass as teacher1 and student1, and as a freshly registered student |
| 10. Hardening and delivery | remaining tests, `ARCHITECTURE.md` with ERD, README final (setup, credentials, tour, troubleshooting), lint/format pass, clean-clone rehearsal, pre-submission gate | gate of section 12 fully green |

Git: one commit per completed phase at minimum, conventional commit messages, no secrets, lockfiles committed. Pushing to GitHub happens when you say so.

---

## 14. Decisions that need your confirmation before phase 1

1. **Move the project out of OneDrive** to `C:\dev\school-management-system` (recommended: yes). `node_modules` inside a synced folder causes `EPERM`/`EBUSY` during installs and unreliable file watching. Git/GitHub becomes the backup. If you prefer to stay, pause OneDrive sync during installs and expect occasional flakiness.
2. **JavaScript (recommended) or TypeScript.** JavaScript with zod and ESLint keeps the backend free of a build step and keeps the reviewer's setup to `npm ci` + `npm run dev`. TypeScript would add type safety at the cost of a compile step, more configuration and more places where the first-run can fail.
3. **Public student self-registration on by default** (recommended: yes, with the flag `ALLOW_PUBLIC_REGISTRATION` documented). It lets the reviewer try the app before using the admin; the role is forced to `student` server-side.
4. **Time zone and academic year start.** Default: the machine's time zone and an academic year that starts in August (`2026-2027` today). Tell me if your school year starts in another month.
5. **Deployment.** Local-first is the deliverable. A free deployment (Firebase Hosting + Render + Aiven/TiDB) can be added afterwards as a bonus; not planned for now.
6. **Git.** I will initialise the repository in phase 1 and commit per phase. You create the GitHub remote and tell me when to push.

---

## 15. Setup you will do in the Firebase console (about 5 minutes, $0)

1. https://console.firebase.google.com → **Create a project** → name it (for example `school-mgmt-lian`) → turn **Google Analytics off** → Create. The plan shown is Spark (no-cost); never click Upgrade.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable** (leave "Email link" off) → Save.
3. **Project settings (gear) → General → Your apps → `</>` Web** → nickname `web` → do **not** tick Firebase Hosting → Register. Copy `apiKey`, `authDomain`, `projectId`, `appId` into `frontend/.env`.
4. **Project settings → Service accounts → Generate new private key** → save the file as `backend/firebase-service-account.json` (git-ignored; never rename it to anything else, never paste it into `.env`).
5. Do not touch Storage, Functions, Phone provider, App Check, or "Upgrade to Identity Platform".

Both `.env` files must point at the **same** Firebase project; `npm run doctor` checks this.

---

## 16. Implementation notes (where the built code deliberately differs from the design documents)

The code is the source of truth; `backend/docs/openapi.yaml` is checked against the routes by a test. Differences found while building and testing:

**API**
- `currentEnrollment` is a sibling of `profile` in `/auth/me`, `/users/:id` and `POST /users` (the design nested it inside `profile`).
- Several responses carry extra fields the design shapes omit (for example `enrolledOn`, `academicYear`/`teacherId` inside `classSubject`, `subjectName` on grade summaries).
- Enrollments, attendance and grades lists do not support free-text `search`; sending it is a 400.
- Deactivating a student also withdraws their active enrollment.
- Schedule writes answer 503 `SERVICE_UNAVAILABLE` (`details.component = 'timetable'`) when the timetable lock cannot be acquired.
- Class names are limited to 50 characters (the column is `VARCHAR(50)`); the design said 100.
- Extra `details.reason` values exist beyond the design list; the OpenAPI spec lists every one.
- `GET /students/:id` for a student the caller may not see answers 403, not 404, so ids cannot be probed.

**Frontend**
- Update and delete hooks take their target at call time (`mutate({ id, body })`, `mutate(id)`), so row actions work without binding a hook per row.
- Success toasts fire inside the mutation hooks; create/edit form hooks are silent and the form renders every error inline.
- No `toCreatePayload`/`toUpdatePayload` helpers: the zod schemas already produce the exact request body.
- Select inputs for classes, teachers and subjects are native selects fed by option hooks, not searchable async selects.
- `ClassSubjectSelectorBar`, `ClassSubjectSelect` and `useClassSubjectSelection` live in `features/classSubjects`; `NotEnrolledState` lives in `features/enrollments/components`. Grades, schedules, classes and the dashboard import them from there.
- Teachers only see their own classes in class pickers: the pickers ask for `GET /classes?visible=true`, which applies the caller's class scope (the plain list stays unscoped by design).

**QA round (2026-10-04)**
- Enrollment history: every enrollment is a new row (the `UNIQUE(student_id, class_id)` key was dropped), so leaving and re-joining a class keeps both periods. Enroll, bulk enroll and transfer refuse classes of a past academic year (400 `past_academic_year`).
- Rosters are dated: an attendance sheet lists the students who were in the class on that date plus anyone already marked; a grade sheet uses the assessment date the same way. One SQL fragment (`enrolledInClassOn` in `access.repository.js`) defines membership on a date. Attendance dates outside the class's academic year are refused (400 `outside_academic_year`).
- Pending grading excludes assessments dated after today; graded and enrolled counts both come from the dated roster.
- Reassigning a class-subject's teacher runs the timetable clash check under the same lock as slot writes (409 `SCHEDULE_CONFLICT`). The lock is per database and is released only after the write commits.
- A class's academic year or grade level cannot change while it has enrollments or subjects (409 `class_in_use`).
- `DELETE /users/:id` removes an account created by mistake while nothing refers to it (409 `has_history` otherwise). Creating an account whose email already has a Firebase user without a MySQL row deletes that Firebase user and creates a fresh one, so a pre-registered outsider cannot inherit it. Since the audit round below, this happens only outside development (a local database shares the Firebase project with the live site), and never for a Firebase user that a MySQL row links to.
- A token check that fails because Google's signing keys could not be fetched answers 503 (`details.component = 'auth'`) instead of 401, so a network blip does not sign everyone out.
- Search matches full names ("Liam Cruz"); unknown top-level API paths answer 404 to everyone.
- The academic-year start month is the shared constant only; the `ACADEMIC_YEAR_START_MONTH` env var is gone.
- Helpers that skip access checks (used only by the dashboard) carry an `Unscoped` suffix.
- Live updates: `AppShell` starts `lib/liveRefresh.js`, which re-fetches the active queries every 20 seconds while the tab is visible (and on return to the tab). It skips `/auth/me` and queries marked `meta: { live: false }` (the attendance and grade sheets), stays silent when a background fetch fails, and tables do not dim for it.
- Existing local databases keep the dropped unique key until `npm run db:reset` (or `ALTER TABLE enrollments DROP INDEX uq_enrollments_student_class`).

**Audit round (2026-10-08)**
- Attendance and grade sheets: each saved row carries the value the teacher saw (`previous`). Saves of one lesson or one assessment run one after the other under row locks, and a row that changed in between answers 409 `sheet_changed` with the students concerned. "Marked by" and "graded by" stay on the rows a save did not change.
- A deadlock, a lock-wait timeout or a full connection queue answers 503 with `details.reason = 'busy'` (worth retrying) instead of 500; a dropped database connection answers 503 as well.
- Bulk enrollment reads the new rows back in one query. When two requests enroll the same student at once, the unique index refuses the second and it answers the same 409 `already_enrolled` as the check.
- Sign-up answers one 409 `email_in_use` message whatever the reason, so it cannot be used to find out which emails have accounts; repeated failed sign-ups are rate-limited.
- The CSV import gives each new student a random temporary password (the request has no password field) and answers 201 only when it created someone.
- Account status changes run under row locks: two admins cannot deactivate each other into a school without an admin, and a teacher with classes this year or a later one cannot be deactivated. The activity log entry is written once MySQL has the change; a Firebase failure after that answers 503, and repeating the request finishes the Firebase step.
- The general average counts each subject once per academic year (a student who changed class mid-year). Assessment dates must fall inside the class's academic year (400 `outside_academic_year`).
- Timetable counts and the teacher's class pickers are no longer cut off at 100 rows.
- Input rules shared by the API and the forms: a name needs a letter, a phone number at least 7 digits, student and employee numbers at most 20 characters, and blank optional text is stored as null.
- Operations: `migrate --fresh` refuses a database that is not on this machine (or `NODE_ENV=production`) without `--allow-remote-drop`; `APP_TIMEZONE` and the length of `DB_NAME` are checked at start-up; an unhandled promise rejection is logged and the server exits with code 1 so the host restarts it.

**Open polish items (cosmetic, not required by the brief)**
- Transfer modal lacks the "from A to B" confirmation sentence; homeroom teacher picker is a plain select.
- A 409 when deactivating a teacher with assignments is shown as a toast without a link to the Assignments tab.
