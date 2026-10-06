> Part of the design set for the School Management System. The project contract is `docs/PROJECT_PLAN.md`; where this document and the plan disagree, the plan wins (see its Decisions log, section 5).

# School Management System — REST API & RBAC Design (v1)

Stack (fixed): Node.js 24, Express 5, mysql2/promise (raw parameterized SQL), firebase-admin, zod, helmet, cors, morgan, express-rate-limit (register route only), dotenv, swagger-ui-express (+ `yaml` to parse `docs/openapi.yaml` — swagger-ui-express needs a JS object). JavaScript ESM. Layers: routes -> controller -> service -> repository.

This document is the single reference for the API surface, the access rules and the code layout. Anything not written here is not a feature.

---

## 0. Assumptions about the schema (details the brief leaves open)

| # | Assumption | Why it matters |
|---|------------|----------------|
| A1 | `students.id` and `teachers.id` are their own AUTO_INCREMENT PKs; `user_id` is a UNIQUE FK to `users.id`. API `studentId` / `teacherId` always mean these ids, never `users.id`. | `req.user.studentId` / `teacherId` are distinct from `req.user.id`. |
| A2 | `students.gender` is `ENUM('male','female','other')`, nullable. | Validation enum. |
| A3 | `attendance` has `UNIQUE(student_id, class_subject_id, attendance_date)`; `grades` has `UNIQUE(assessment_id, student_id)`; `class_subjects` has `UNIQUE(class_id, subject_id)`; `classes` has `UNIQUE(academic_year, name)`; `users.email`, `users.firebase_uid`, `students.student_number`, `teachers.employee_number`, `subjects.code` are UNIQUE. Unique keys are named `uq_<table>_<meaning>` in the schema and surface verbatim in `details.key` as `table.keyname`: `users.uq_users_email`, `subjects.uq_subjects_code`, `classes.uq_classes_year_name`, `class_subjects.uq_class_subjects_class_subject`, `enrollments.uq_enrollments_one_active`. | Bulk upserts use `INSERT ... ON DUPLICATE KEY UPDATE`; duplicates map to 409 carrying the key name. |
| A4 | "One active enrollment per student" is enforced in the DB with a generated column `active_flag TINYINT AS (IF(status='active',1,NULL)) STORED` + `UNIQUE(student_id, active_flag)` named `uq_enrollments_one_active` (NULLs never collide). The service checks first (friendly 409 message); the constraint is the backstop (`ER_DUP_ENTRY` on `enrollments.uq_enrollments_one_active` → 409). | Race-safe without application locks. |
| A5 | `class_subjects.teacher_id` is NOT NULL (a class-subject *is* a teacher assignment). | No "unassigned subject" state. |
| A6 | Every FK is `ON DELETE RESTRICT`, including `grades.assessment_id` (so deletes of referenced rows fail with `ER_ROW_IS_REFERENCED_2` → 409). `DELETE /assessments/:id` is the one place that removes dependants on purpose: it deletes the grades and then the assessment inside one transaction, after the UI confirm that shows `gradedCount`. | Nothing is erased implicitly by the database; see Q2 (resolved). |
| A7 | Every table has `id`, `created_at`, `updated_at` (`ON UPDATE CURRENT_TIMESTAMP`). | `createdAt` / `updatedAt` appear in every resource. |
| A8 | `req.user` carries one extra field beyond the brief: `activeClassId` (class of the student's active enrollment, or `null`). It is loaded in the same auth query (LEFT JOIN) and saves one query on every student request. | Student scoping. |

---

## 1. Conventions

### 1.1 URLs, naming, types

- Base path: `/api/v1`. Docs UI: `/api/docs` (outside the versioned path; see §9). Health: `GET /api/v1/health`.
- Paths: kebab-case plural nouns (`/class-subjects`). No verbs in paths except the two named sub-resources `sheet` (attendance) and `summary` (attendance/grades) and `bulk` / `transfer` (enrollments) — these are the only exceptions and are listed here on purpose.
- JSON is camelCase in and out. DB is snake_case. Conversion happens in exactly one place: `src/config/db.js` camelizes every row returned by `query()`. Writes use explicit column lists in repositories (no automatic decamelize, no `SET ?` object spreading).
- Ids are positive integers. The literal `me` is accepted wherever a `studentId`, `teacherId` or `authorId` appears (path param or query filter) — see §2.1 decision 1.
- Dates: `YYYY-MM-DD`. Times: `HH:MM` (24h). Timestamps: ISO-8601 UTC (`2026-10-03T07:30:00.000Z`).
  - Pool config: `dateStrings: ['DATE'], timezone: 'Z'` → DATE columns arrive as plain strings (no TZ shift), DATETIME/TIMESTAMP arrive as JS `Date` and serialize to ISO UTC automatically.
  - The pool's `typeCast` (§6.3) returns TIME columns as `HH:MM` strings and TINYINT(1) columns as booleans, so repositories select columns plainly — no SQL-side formatting or `IF(...)` for either.
  - "Today", the ISO weekday and the current academic year (dashboards, attendance date checks, teacher visibility defaults) are computed in `APP_TIMEZONE` (env; default = the machine's time zone) by `utils/dates.js`, never ad hoc from `new Date()`. The current academic year follows the August rule: from month `ACADEMIC_YEAR_START_MONTH` (default 8) onwards it is `YYYY-(YYYY+1)`, before it `(YYYY-1)-YYYY`.
- Request bodies: `application/json`, max 1 MB. All body schemas are `.strict()` — unknown keys are rejected (catches frontend typos immediately instead of silently ignoring them).
- PATCH = partial update; body must contain at least one known field. Fields not sent are untouched. `null` is sent explicitly to clear a nullable field.
- Write endpoints return the same shape as the corresponding read (`POST /subjects` returns what `GET /subjects/:id` returns) so the client never needs a follow-up fetch.
- Status codes: `200` read / update / upsert / delete, `201` create, `400/401/403/404/409/500/503` per the catalogue. DELETE returns `200 { success: true, data: { id } }` (never 204 — every response carries the envelope).
- DELETE of a missing id → 404 (not silently 200) so broken client state is visible.

### 1.2 Response envelope

Success:

```json
{ "success": true, "data": <object | array>, "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
```

`meta` is present only on paginated list responses. `data` is an array on lists, an object otherwise. `data` is never `null` on success.

Error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "request validation failed", "details": { "issues": [ { "path": "body.email", "message": "Invalid email" } ] } } }
```

`details` is optional and, when present, is always an object (never a bare array/string). Its keys are documented per error below. The request id is NOT in the body; it is in the `X-Request-Id` response header on every response (success and error).

### 1.3 Error code catalogue

| HTTP | code | When | `details` keys |
|------|------|------|----------------|
| 400 | `VALIDATION_ERROR` | zod failure (body/query/params), malformed JSON, payload too large, `me` used by a caller without that profile kind, FK target missing (`ER_NO_REFERENCED_ROW_2`), business-rule input errors (e.g. student not enrolled in the class being marked, score > maxScore) | `issues: [{path, message}]` for zod; `field` for FK; `invalidStudentIds`, `maxScore` etc. for business rules |
| 401 | `UNAUTHORIZED` | missing/malformed `Authorization` header, `verifyIdToken` failure (expired, revoked, wrong project) | `reason` = Firebase error code (e.g. `auth/id-token-expired`) so the client knows whether to refresh |
| 403 | `USER_NOT_REGISTERED` | token valid (the caller *is* authenticated) but no `users` row with that `firebase_uid` — the account is not provisioned. The frontend treats it like `ACCOUNT_DISABLED`: sign out and show the message | `firebaseUid` |
| 403 | `FORBIDDEN` | role not allowed by `authorize(...)`, ownership check failed in a service, filter targets data outside the caller's scope, admin-only filter used by non-admin, admin changing own status | `reason` (short machine-readable string, e.g. `not_class_subject_owner`) |
| 403 | `ACCOUNT_DISABLED` | `users.is_active = false` | — |
| 404 | `NOT_FOUND` | resource id does not exist within the caller's visibility; unknown route | `resource`, `id` |
| 409 | `CONFLICT` | `ER_DUP_ENTRY`; `ER_ROW_IS_REFERENCED_2` ("cannot delete, in use"); business conflicts: student already has an active enrollment, invalid enrollment status transition, transfer without an active enrollment or into the same class, deactivating a teacher who still has assignments, deactivating the last active admin, `maxScore` below existing grades, Firebase `auth/email-already-exists` | `key` (dup, as `table.keyname`), `constraint` (in use), `reason` for business conflicts (`invalid_status_transition`, `no_active_enrollment`, `same_class`, `teacher_has_assignments`), `activeEnrollmentId`, `maxExistingScore`, … |
| 409 | `SCHEDULE_CONFLICT` | schedule overlaps another schedule for the same class, same teacher or same room on that day | `conflicts: [{ type: 'class'\|'teacher'\|'room', scheduleId, classSubjectId, className, subjectName, dayOfWeek, startTime, endTime, room }]` |
| 429 | `RATE_LIMITED` | too many `POST /auth/register` calls from one IP (5 per 15 minutes, §7); no other route uses it | `retryAfterSeconds` (also sent as the `Retry-After` header) |
| 500 | `INTERNAL_ERROR` | anything unmapped | `stack` and original `message` in development only |
| 503 | `SERVICE_UNAVAILABLE` | **addition to the brief**, used only by `GET /health` when the DB ping fails and by the error handler for DB connection errors (`ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST`, `ETIMEDOUT`). Remove it if the catalogue must stay exactly as specified (then use 500 `INTERNAL_ERROR`). | `component: 'db'` |

Rule: **the catalogue is closed** (eleven codes). New error situations reuse one of these codes with a more specific `message` / `details.reason`; a new code requires editing this table, `ApiError.js` and `ERROR_CODES` in `constants/shared.js` on both sides.

### 1.4 MySQL error mapping (`src/utils/mysqlErrorMap.js`)

Applied by the global error handler to any error with a numeric `errno` / `ER_*` code. zod should prevent all of these; **if one of these shows up in logs, a zod rule is missing** — fix the schema, not the mapping.

| MySQL `code` (errno) | → HTTP / code | message | details (parsed from `err.sqlMessage`) |
|---|---|---|---|
| `ER_DUP_ENTRY` (1062) | 409 `CONFLICT` | `duplicate value for <key>` | `key` from `/for key '([^']+)'/` → `table.keyname`, e.g. `users.uq_users_email`, `class_subjects.uq_class_subjects_class_subject`, `enrollments.uq_enrollments_one_active` |
| `ER_ROW_IS_REFERENCED_2` (1451) | 409 `CONFLICT` | `cannot delete, in use` | `constraint` from ``/CONSTRAINT `([^`]+)`/`` |
| `ER_NO_REFERENCED_ROW_2` (1452) | 400 `VALIDATION_ERROR` | `referenced record does not exist` | `field` = camelCase of column from ``/FOREIGN KEY \(`(\w+)`\)/`` → `classId` |
| `ER_BAD_NULL_ERROR` (1048) | 400 `VALIDATION_ERROR` | `field cannot be null` | `field` |
| `ER_DATA_TOO_LONG` (1406) | 400 `VALIDATION_ERROR` | `value too long` | `field` |
| `WARN_DATA_TRUNCATED` (1265), `ER_TRUNCATED_WRONG_VALUE_FOR_FIELD` (1366) | 400 `VALIDATION_ERROR` | `invalid value for field` (bad ENUM / type) | `field` |
| `ER_CHECK_CONSTRAINT_VIOLATED` (3819) | 400 `VALIDATION_ERROR` | `check constraint violated` | `constraint` |
| `ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST`, `ETIMEDOUT`, `ER_CON_COUNT_ERROR` | 503 `SERVICE_UNAVAILABLE` | `database unavailable` | `component: 'db'` |
| anything else with `errno` | 500 `INTERNAL_ERROR` | `internal server error` | dev only: `sqlMessage`, `sql` (params already interpolated by mysql2 are **not** logged in prod) |

Firebase Admin errors (`err.code` starts with `auth/`), mapped in `src/utils/firebaseErrorMap.js`:

| Firebase code | → |
|---|---|
| `auth/email-already-exists` | 409 `CONFLICT`, `details.key = 'users.uq_users_email'` (same key as the MySQL duplicate, so the frontend maps one key to the email field) |
| `auth/invalid-email`, `auth/invalid-password`, `auth/invalid-phone-number` | 400 `VALIDATION_ERROR` |
| `auth/id-token-expired`, `auth/id-token-revoked`, `auth/argument-error`, `auth/invalid-id-token` | 401 `UNAUTHORIZED`, `details.reason = <code>` |
| `auth/user-not-found` (during deactivate/update) | 500 `INTERNAL_ERROR` with message `firebase user missing for registered account` — this is data drift; it must be loud |
| other | 500 `INTERNAL_ERROR` |

### 1.5 List endpoints — common query params

Every `GET` on a collection accepts:

| Param | Type / default | Rule |
|---|---|---|
| `page` | int ≥ 1, default `1` | |
| `limit` | int 1..100, default `20` | values > 100 → 400 (not clamped — clamping hides client bugs) |
| `search` | string 1..100 | case-insensitive `LIKE %term%` over the resource's **search columns** (listed per endpoint). `%` and `_` in the term are escaped (`escapeLike`). Multiple words are matched as one substring (no tokenizing in v1). |
| `sortBy` | enum, whitelisted per resource | the whitelist maps API field → SQL column (`{ lastName: 'u.last_name' }`); anything else → 400 |
| `sortOrder` | `asc` \| `desc` | default `asc` when `sortBy` is given; when `sortBy` is omitted the resource **default sort** applies (field + order, listed per endpoint) |
| resource filters | listed per endpoint | exact match unless stated (`dateFrom`/`dateTo` inclusive ranges) |

`meta = { page, limit, total, totalPages }` where `total` comes from a second `SELECT COUNT(*)` with the identical WHERE clause/params (no `SQL_CALC_FOUND_ROWS`, it is deprecated). `totalPages = Math.max(1, Math.ceil(total / limit))`.

Boolean filters are the strings `true` / `false`. Non-paginated reads (`/sheet`, `/summary`, `/dashboard`, `/:id`) never return `meta`.

### 1.6 Scoping rules for list filters (applies to every scoped endpoint)

1. **Omitted filter ⇒ caller's own scope.** A student calling `GET /attendance` with no filter gets their own records; a teacher gets records of class-subjects they can view.
2. **Explicit filter outside scope ⇒ 403 `FORBIDDEN`** (never silently narrowed). Silent narrowing hides frontend bugs; a 403 with `reason` is debuggable.
3. **Admin ⇒ no scoping**, all filters honored.

Teacher visibility ("visible") = class-subjects the teacher teaches **or** any class-subject of a class where the teacher is homeroom teacher. Teacher management ("owns") = class-subjects where `class_subjects.teacher_id = teacherId` only. Reads use *visible*, writes use *owns*.

Student visibility = own student row, own enrollments/attendance/grades, and the class-subjects/schedules/announcements of `activeClassId`.

---

## 2. Endpoint catalogue

### 2.1 The "pick one pattern" decisions

**Decision 1 — "my" resources: `me` is an id alias, not a route namespace.**
There is exactly one me-specific route pair: `GET /auth/me` and `PATCH /auth/me` (identity + self-service contact fields). Everywhere else the caller uses the canonical collection and may write `me` in place of their own id: `GET /students/me`, `GET /attendance?studentId=me`, `GET /class-subjects?teacherId=me`, `GET /announcements?authorId=me`. One helper, `resolveMe(user, value, kind)` (`kind` ∈ `student` | `teacher` | `user`), maps `me` → `req.user.studentId` / `teacherId` / `id` and throws 400 `VALIDATION_ERROR` (`"'me' cannot be resolved: caller has no <kind> profile"`) when the caller has no such profile. Because of §1.6 rule 1, `me` is mostly a readability convenience — omitting the filter already scopes to the caller. No `/me/attendance`, no `/students/:id/attendance`. Rationale: one URL per resource, one scoping implementation in the service, no duplicate OpenAPI entries.

**Decision 2 — whole-roster attendance: the "sheet" resource.**
An attendance sheet is identified by `(classSubjectId, date)`. `GET /attendance/sheet?classSubjectId=5&date=2026-10-03` returns the active roster of the class with the existing marks merged in (unmarked students have `status: null`). `PUT /attendance/sheet` with body `{ classSubjectId, date, records: [{ studentId, status, remarks? }] }` (the sheet uses `date`; flat attendance records keep the column name `attendanceDate`) upserts all rows in one transaction (`INSERT ... ON DUPLICATE KEY UPDATE status, remarks, marked_by`) and returns the refreshed sheet. The PUT is idempotent and **upsert-only**: students omitted from `records` are left untouched (a partial body must never erase marks). Single-row corrections use `PATCH /attendance/:id`; removing a wrong row is admin-only `DELETE /attendance/:id`. There is no `POST /attendance` — a sheet with one record covers it.

**Decision 3 — dashboards: one endpoint, role-switched payload.**
`GET /dashboard` reads `req.user.role` and returns one of three documented shapes (§2.14), each with a `role` discriminator. The service is `dashboard.service.js` with three functions (`adminDashboard`, `teacherDashboard`, `studentDashboard`) and the repository holds only aggregate queries. No `/dashboard/admin` etc. — the frontend calls one URL after login, no matter who is signed in.

Supporting rules used throughout the table:

- **Nested vs flat paths:** a path is nested only when the child is keyed by a single parent id and is meaningless without it (`/assessments/:id/grades`). Composite-key views use a flat path with query params (`/attendance/sheet?classSubjectId&date`). Everything else is a flat collection with filters.
- **No `POST /students`, `POST /teachers`:** accounts are created only via `POST /auth/register` (student) and `POST /users` (admin, any role). No `DELETE /users|students|teachers`: deactivation via `PATCH /users/:id/status`.
- **Roster vs enrollment records:** `GET /students?classId=` answers "who is in this class" (people); `GET /enrollments?classId=` answers "what enrollment records exist" (status, history). Both exist because they return different resources.
- **Bulk grade entry:** `PUT /assessments/:id/grades` mirrors the attendance sheet (upsert-only, returns the refreshed roster-with-scores). Nested because an assessment is a single parent.

Legend — Roles: **A** admin, **T** teacher, **S** student, **any** = any authenticated active user, **public** = no token. Ownership column is the rule the service enforces beyond the role gate (admin never has an ownership rule).

### 2.2 auth (3)

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| POST | `/auth/register` | public | — | Self-registration. Creates Firebase user + `users` + `students` rows in one `createUserAccount` call with `role` forced to `student`. `studentNumber` auto-generated as `STU-YYYY-NNNN` (YYYY = admission year, NNNN = per-year sequence, `MAX + 1` inside the transaction with one retry on duplicate); `admissionDate` defaults to today. Client then signs in with the Firebase client SDK (no token is returned). Gated by `ALLOW_PUBLIC_REGISTRATION` env (404 `NOT_FOUND` when off) and rate limited to 5 requests per 15 minutes per IP (429 `RATE_LIMITED`, §7). | body: `email, password, firstName, lastName, phone?, dateOfBirth?, gender?, address?, guardianName?, guardianPhone?` |
| GET | `/auth/me` | any | self | Identity + embedded role profile (`profile` = student or teacher row, `null` for admin) + `currentEnrollment` for students. | — |
| PATCH | `/auth/me` | any | self | Self-service contact update. All roles: `phone`. Students additionally: `address, guardianName, guardianPhone`. Names, DOB, numbers are admin-only (`PATCH /students/:id`). Non-student sending student fields → 400. | body (≥1): `phone?, address?, guardianName?, guardianPhone?` |

### 2.3 users (5) — all admin

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/users` | A | — | List accounts (no profile embedded). | filters: `role, isActive`; search: first_name, last_name, email; sortBy: `lastName\|firstName\|email\|role\|createdAt` (default `lastName asc`) |
| POST | `/users` | A | — | Create an account with any role via `createUserAccount`. Profile object is required for `student`/`teacher`, forbidden for `admin` (zod discriminated union on `role`). `studentNumber`/`employeeNumber` optional → auto-generated (`STU-YYYY-NNNN` / `EMP-YYYY-NNNN`, YYYY = admission / hire year, NNNN = per-year sequence as `MAX + 1` inside the transaction, one retry on duplicate); an admin may supply one that matches the format. `admissionDate` / `hireDate` default to today. Returns the `/auth/me` shape for that user. | body: `email, password, role, firstName, lastName, phone?, profile{…}` |
| GET | `/users/:id` | A | — | Account + profile (same shape as `/auth/me`). | |
| PATCH | `/users/:id` | A | — | Update name/phone. Email and role changes are out of scope v1 (Q3). | body (≥1): `firstName?, lastName?, phone?` |
| PATCH | `/users/:id/status` | A | cannot target self (403 `FORBIDDEN`, `details.reason = 'self_status_change'`) | Activate/deactivate. One more refusal, checked before anything is written: deactivating a teacher who still has `class_subjects` or homeroom classes in the current academic year → 409 `CONFLICT`, `details.reason = 'teacher_has_assignments'` (reassign first — rosters must never show an inactive teacher). There is no "last admin" guard: the caller must be an active admin and cannot target self, so at least one active admin always remains. Order: MySQL `is_active` (source of truth) → Firebase `updateUser({disabled})` → on deactivate also `revokeRefreshTokens(uid)`. If the Firebase step fails the MySQL change stays (middleware already blocks the user) and a 500 is returned; the call is idempotent, retry it. | body: `isActive: boolean` |

### 2.4 students (3)

Student shape: `{ id, userId, studentNumber, firstName, lastName, email, phone, dateOfBirth, gender, address, guardianName, guardianPhone, admissionDate, isActive, currentEnrollment: { id, classId, className, gradeLevel, academicYear, status } | null, createdAt, updatedAt }`. `admissionDate` is NOT NULL in the DB (the service defaults it to today when omitted on create); "enrollment" always means class membership in this API, never the admission date.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/students` | A, T | T: only students with an active enrollment in a class the teacher can view; `classId` outside that → 403 | Directory / roster / admin search. | filters: `classId` (active enrollment), `gradeLevel`, `gender`, `isActive`, `hasActiveEnrollment` (`false` = unenrolled students, used by the enrollment UI); search: first_name, last_name, student_number, email; sortBy: `lastName\|firstName\|studentNumber\|admissionDate\|createdAt` (default `lastName asc`) |
| GET | `/students/:id` | A, T, S | T: student in a visible class; S: own id or `me` | Full student profile. | `:id` accepts `me` |
| PATCH | `/students/:id` | A | — | Admin edit of user + student fields in one call (1:1 extension). | body (≥1): `firstName?, lastName?, phone?, studentNumber?, dateOfBirth?, gender?, address?, guardianName?, guardianPhone?, admissionDate?` (`admissionDate` not nullable) |

### 2.5 teachers (3)

Teacher shape: `{ id, userId, employeeNumber, firstName, lastName, email, phone, department, qualification, hireDate, isActive, createdAt, updatedAt }`. `department` (≤ 100) and `qualification` (≤ 150) are nullable strings; `hireDate` is NOT NULL in the DB and the service defaults it to today when omitted on create.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/teachers` | A | — | Staff list (used by assignment/homeroom pickers). | filters: `department, isActive`; search: first_name, last_name, employee_number, department; sortBy: `lastName\|firstName\|employeeNumber\|department\|hireDate` (default `lastName asc`) |
| GET | `/teachers/:id` | A, T | T: own id or `me` | Teacher profile. | `:id` accepts `me` |
| PATCH | `/teachers/:id` | A | — | Admin edit of user + teacher fields. | body (≥1): `firstName?, lastName?, phone?, employeeNumber?, department?, qualification?, hireDate?` (`hireDate` not nullable) |

### 2.6 subjects (5)

Subject shape: `{ id, code, name, description, isActive, createdAt, updatedAt }`. A subject that is already used by class-subjects cannot be deleted; it is retired with `isActive: false`, which hides it from new assignments (`POST /class-subjects` rejects it) while existing history keeps working.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/subjects` | any | — | Reference list. | filters: `isActive` (omitted = all); search: code, name; sortBy: `code\|name\|createdAt` (default `code asc`) |
| POST | `/subjects` | A | — | Create; duplicate `code` → 409 `details.key = subjects.uq_subjects_code`. | body: `code, name, description?` |
| GET | `/subjects/:id` | any | — | | |
| PATCH | `/subjects/:id` | A | — | Edit, or retire / reactivate with `isActive` (the way to take a subject that is in use out of circulation). | body (≥1): `code?, name?, description?, isActive?` |
| DELETE | `/subjects/:id` | A | — | Hard delete, allowed only when unused: 409 `CONFLICT` "cannot delete, in use" when referenced by class_subjects (retire it with `PATCH { isActive: false }` instead). | |

### 2.7 classes (5)

Class shape: `{ id, name, gradeLevel, academicYear, homeroomTeacher: { id, firstName, lastName } | null, studentCount, createdAt, updatedAt }` (`studentCount` = active enrollments). A class is `name` ("Grade 10 - A"), `gradeLevel` (1..12), `academicYear` and an optional homeroom teacher; the group letter is part of the name, there is no separate column for it.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/classes` | any | — | Reference list (harmless metadata, so no scoping). | filters: `academicYear, gradeLevel, homeroomTeacherId` (accepts `me`); search: name; sortBy: `name\|gradeLevel\|academicYear\|createdAt` (default `academicYear desc, name asc`) |
| POST | `/classes` | A | — | Create; `(academicYear, name)` duplicate → 409 `details.key = classes.uq_classes_year_name`; inactive homeroom teacher → 400. | body: `name, gradeLevel, academicYear, homeroomTeacherId?` |
| GET | `/classes/:id` | any | — | | |
| PATCH | `/classes/:id` | A | — | | body (≥1): `name?, gradeLevel?, academicYear?, homeroomTeacherId?` (nullable) |
| DELETE | `/classes/:id` | A | — | 409 when enrollments / class_subjects / announcements reference it. | |

### 2.8 class-subjects — teacher assignment (5)

Class-subject shape: `{ id, classId, className, academicYear, subjectId, subjectCode, subjectName, teacherId, teacher: { id, firstName, lastName }, createdAt, updatedAt }`.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/class-subjects` | any | T: visible only; S: `activeClassId` only (no active enrollment → empty list) | What is taught in which class by whom. | filters: `classId, subjectId, teacherId` (accepts `me`), `academicYear`; search: subject name/code, class name; sortBy: `className\|subjectName\|teacherLastName\|createdAt` (default `className asc, subjectName asc`) |
| POST | `/class-subjects` | A | — | Assign a teacher to a subject in a class. Duplicate `(classId, subjectId)` → 409 `details.key = class_subjects.uq_class_subjects_class_subject`; inactive teacher or retired subject (`isActive = false`) → 400. | body: `classId, subjectId, teacherId` |
| GET | `/class-subjects/:id` | any | T visible / S own class | | |
| PATCH | `/class-subjects/:id` | A | — | Reassign teacher only. Changing class/subject = delete + create (keeps attendance/grades history honest). | body: `teacherId` |
| DELETE | `/class-subjects/:id` | A | — | 409 when attendance / assessments / schedules reference it. | |

### 2.9 enrollments (6)

Enrollment shape: `{ id, studentId, student: { id, studentNumber, firstName, lastName }, classId, class: { id, name, gradeLevel, academicYear }, status, enrolledOn, leftOn, createdAt, updatedAt }`. `status` ∈ `active` | `completed` | `transferred` | `withdrawn`; `leftOn` is `null` while active and holds the closing date otherwise (DB CHECK). `(studentId, classId)` is unique, so a student has at most one row per class and a closed row is re-opened rather than duplicated.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/enrollments` | any | T: classes visible; S: own (`studentId` forced) | Enrollment records incl. history. | filters: `studentId` (accepts `me`), `classId, status, academicYear`; sortBy: `createdAt\|status\|studentLastName` (default `createdAt desc`) |
| POST | `/enrollments` | A | — | Enroll one student (status `active`, `enrolledOn` = today, `leftOn` = null). If a closed row already exists for the same `(studentId, classId)` it is re-opened instead of inserting a duplicate. Student already active elsewhere → 409 `details: { activeEnrollmentId, classId }` (use `POST /enrollments/transfer`); inactive student → 400. | body: `studentId, classId` |
| POST | `/enrollments/bulk` | A | — | Enroll many students in one class, all-or-nothing transaction. Any student already active → 409 `details.alreadyActive: [{ studentId, enrollmentId, classId }]`, nothing written. | body: `classId, studentIds[1..200]` (unique) → 201 `{ classId, created, enrollments: [...] }` |
| POST | `/enrollments/transfer` | A | — | Move a student to another class in one transaction: close the active enrollment as `transferred` with `leftOn` = today, then insert a new active row for `classId` (or re-open the existing closed row for that class, since `(studentId, classId)` is unique) with `enrolledOn` = today. The close runs first because the one-active-enrollment index requires it. No active enrollment → 409 `CONFLICT`, `details.reason = 'no_active_enrollment'` (use `POST /enrollments` instead); target equals the current class → 409 `CONFLICT`, `details.reason = 'same_class'`. Returns the new enrollment shape with 201. | body: `studentId, classId` |
| GET | `/enrollments/:id` | any | T visible class / S own | | |
| PATCH | `/enrollments/:id` | A | — | Close an enrollment. Allowed: `active → completed`, `active → withdrawn`; both set `leftOn` = today. Anything else — re-activation, closing an already closed row — → 409 `CONFLICT`, `details.reason = 'invalid_status_transition'`. `transferred` is set only by `POST /enrollments/transfer`. No DELETE. | body: `status` ∈ `completed` \| `withdrawn` |

### 2.10 attendance (6)

Attendance row shape: `{ id, studentId, student: { id, studentNumber, firstName, lastName }, classSubjectId, classSubject: { classId, className, subjectId, subjectName }, attendanceDate, status, remarks, markedBy: { id, firstName, lastName }, createdAt, updatedAt }`.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/attendance` | any | T: visible class-subjects; S: own | Flat records (history views, exports). | filters: `studentId` (accepts `me`), `classSubjectId, classId, status, dateFrom, dateTo`; sortBy: `attendanceDate\|status\|studentLastName` (default `attendanceDate desc`) |
| GET | `/attendance/sheet` | A, T | T: visible class-subject | Roster of the class-subject's class (active enrollments) + marks for the date. Unmarked → `attendanceId/status/remarks = null`. | query (both required): `classSubjectId, date` |
| PUT | `/attendance/sheet` | A, T | T: **owns** class-subject | Bulk upsert (Decision 2). Every `studentId` must be actively enrolled in the class-subject's class, else 400 `details.invalidStudentIds`. `date` may not be in the future (APP_TIMEZONE). `markedBy` = caller on insert and on update. Returns the refreshed sheet. | body: `classSubjectId, date, records[1..200]: { studentId, status, remarks? }` (studentIds unique) |
| GET | `/attendance/summary` | any | T visible / S own | Counts per status + rate. `rate = (present + late) / total` (4 decimals; `null` when total = 0). | filters: `studentId` (accepts `me`), `classSubjectId, classId, dateFrom, dateTo`, `groupBy` ∈ `none` (default) \| `student` \| `classSubject` → `data` is one object, or an array of `{ studentId/classSubjectId, label, total, present, absent, late, excused, rate }` |
| PATCH | `/attendance/:id` | A, T | T owns class-subject | Single correction; sets `markedBy` = caller. | body (≥1): `status?, remarks?` |
| DELETE | `/attendance/:id` | A | — | Remove a wrong row. | |

### 2.11 assessments + grades (10)

Assessment shape: `{ id, classSubjectId, classSubject: { classId, className, subjectId, subjectName, teacherId }, title, type, maxScore, term, assessedOn, gradedCount, enrolledCount, createdAt, updatedAt }`. `type` ∈ `quiz` | `test` | `exam` | `assignment` | `project` | `other`; `term` ∈ `term1` | `term2` | `term3` (UI labels "Term 1/2/3"); `assessedOn` is never null — the service defaults it to today when omitted on create.
Grade shape: `{ id, assessmentId, assessment: { id, title, type, maxScore, term, assessedOn, classSubjectId, subjectName, className }, studentId, student: { id, studentNumber, firstName, lastName }, score, percentage, remarks, gradedBy: { id, firstName, lastName }, createdAt, updatedAt }` (`percentage = round(score / maxScore * 100, 2)`).

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/assessments` | any | T visible; S own class | List assessments. | filters: `classSubjectId, classId, type, term, dateFrom, dateTo`; search: title; sortBy: `assessedOn\|title\|type\|createdAt` (default `assessedOn desc`) |
| POST | `/assessments` | A, T | T owns class-subject | Create. | body: `classSubjectId, title, type, maxScore, term, assessedOn?` (omitted → today in `APP_TIMEZONE`) |
| GET | `/assessments/:id` | any | T visible; S own class | | |
| PATCH | `/assessments/:id` | A, T | T owns | `classSubjectId` is immutable. Lowering `maxScore` below an existing score → 409 `details.maxExistingScore`. | body (≥1): `title?, type?, maxScore?, term?, assessedOn?` (not nullable) |
| DELETE | `/assessments/:id` | A, T | T owns | Deletes the assessment's grades and then the assessment in one transaction (A6: the FK stays `RESTRICT`; the two-step delete is explicit). The UI confirms first, showing `gradedCount`. | |
| GET | `/assessments/:id/grades` | A, T | T visible | Roster-with-scores: `{ assessmentId, assessment, records: [{ studentId, studentNumber, firstName, lastName, gradeId, score, percentage, remarks, gradedBy, updatedAt }] }` (null for ungraded). | |
| PUT | `/assessments/:id/grades` | A, T | T owns | Bulk upsert grades (mirror of the attendance sheet). `0 ≤ score ≤ maxScore` else 400 `details: { studentId, score, maxScore }`; student must be actively enrolled in the class else 400 `invalidStudentIds`; `gradedBy` = caller. Returns the refreshed roster-with-scores. | body: `grades[1..200]: { studentId, score, remarks? }` |
| GET | `/grades` | any | T visible; S own | Flat grade records (student gradebook, teacher/admin filters). | filters: `studentId` (accepts `me`), `assessmentId, classSubjectId, classId, term, type`; sortBy: `assessedOn\|score\|createdAt` (default `assessedOn desc`) |
| GET | `/grades/summary` | any | T visible; S own | Points-weighted aggregate: `percentage = SUM(score) / SUM(maxScore) * 100` over graded assessments only. | filters: `studentId` (accepts `me`), `classSubjectId, classId, term`, `groupBy` ∈ `classSubject` (default; rows per subject for a student) \| `student` (rows per student for a class-subject; A/T only) → `[{ studentId?, classSubjectId?, label, assessmentsGraded, totalScore, totalMaxScore, percentage }]` |
| DELETE | `/grades/:id` | A, T | T owns the grade's class-subject | Remove a grade entered for the wrong student. | |

### 2.12 schedules (5)

Schedule shape: `{ id, classSubjectId, classSubject: { classId, className, academicYear, subjectId, subjectName, teacher: { id, firstName, lastName } }, dayOfWeek, startTime, endTime, room, createdAt, updatedAt }`. `dayOfWeek`: 1 = Monday … 7 = Sunday (ISO-8601).

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/schedules` | any | T visible; S own class | Timetable rows; the client groups by `dayOfWeek`. | filters: `classId, teacherId` (accepts `me`), `classSubjectId, dayOfWeek, room, academicYear`; sortBy: `dayOfWeek\|startTime` (default `dayOfWeek asc, startTime asc`) |
| POST | `/schedules` | A | — | Create. Overlap check (`start < other.end AND end > other.start`, same `dayOfWeek`) against the same class, the same teacher and the same room (case-insensitive trimmed, skipped when `room` is null) → 409 `SCHEDULE_CONFLICT` listing every conflict. | body: `classSubjectId, dayOfWeek, startTime, endTime, room?` |
| GET | `/schedules/:id` | any | T visible; S own class | | |
| PATCH | `/schedules/:id` | A | — | Same conflict check excluding itself. | body (≥1): `classSubjectId?, dayOfWeek?, startTime?, endTime?, room?` |
| DELETE | `/schedules/:id` | A | — | | |

### 2.13 announcements (5)

Announcement shape: `{ id, author: { id, firstName, lastName, role }, title, body, audience, classId, className, publishedAt, expiresAt, status: 'active'|'scheduled'|'expired', createdAt, updatedAt }`.

Visibility: **active** = `publishedAt <= now AND (expiresAt IS NULL OR expiresAt > now)`.
- S: active AND `audience IN ('all','students')` AND (`classId IS NULL` OR `classId = activeClassId`).
- T: active AND ( (`classId IS NULL` AND `audience IN ('all','teachers')`) OR `classId` in visible classes ) — plus everything they authored regardless of status.
- A: everything; `status` filter decides.

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/announcements` | any | visibility above | Feed. | filters: `audience, classId, authorId` (accepts `me`), `status` ∈ `active` (default) \| `scheduled` \| `expired` \| `all` — **admin only** (non-admin sending it → 403); search: title, body; sortBy: `publishedAt\|title\|createdAt` (default `publishedAt desc`) |
| POST | `/announcements` | A, T | T: `classId` required and class visible | Publish. `publishedAt` defaults to now; `expiresAt` must be after `publishedAt`. | body: `title, body, audience, classId?, publishedAt?, expiresAt?` |
| GET | `/announcements/:id` | any | visibility above | | |
| PATCH | `/announcements/:id` | A, T | T: author only | | body (≥1): `title?, body?, audience?, classId?, publishedAt?, expiresAt?` |
| DELETE | `/announcements/:id` | A, T | T: author only | Hard delete. | |

### 2.14 dashboard (1)

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/dashboard` | any | payload is built from `req.user` only; no params accepted | Role-specific aggregate (Decision 3). | — |

Payload shapes (`today` and the current academic year are computed in `APP_TIMEZONE` with the August rule — `ACADEMIC_YEAR_START_MONTH`, §1.1; all lists are capped, no pagination). The teacher payload's `classSubjects`, `homeroomClasses` and `todaySchedule` are limited to classes of the current academic year, so last year's timetable never shows up as "today":

```jsonc
// admin
{
  "role": "admin",
  "counts": { "students": 240, "teachers": 18, "classes": 12, "subjects": 9, "activeEnrollments": 236, "unenrolledStudents": 4 },
  "attendanceToday": { "date": "2026-10-03", "total": 980, "present": 900, "absent": 40, "late": 30, "excused": 10, "rate": 0.9490 },
  "enrollmentsByGrade": [ { "gradeLevel": 7, "students": 80 } ],
  "upcomingAssessments": [ { "id": 31, "title": "Unit 2 Exam", "type": "exam", "assessedOn": "2026-10-07", "className": "Grade 7 - A", "subjectName": "Mathematics" } ],   // next 7 days, max 10
  "recentAnnouncements": [ { "id": 9, "title": "...", "audience": "all", "className": null, "publishedAt": "2026-10-01T08:00:00.000Z" } ]   // max 5
}
// teacher
{
  "role": "teacher",
  "teacher": { "id": 5, "firstName": "Ana", "lastName": "Reyes", "department": "Science" },
  "classSubjects": [ { "id": 12, "classId": 3, "className": "Grade 7 - A", "subjectName": "Biology", "academicYear": "2026-2027", "studentCount": 32 } ],   // current academic year only
  "homeroomClasses": [ { "id": 3, "name": "Grade 7 - A", "academicYear": "2026-2027", "studentCount": 32 } ],   // current academic year only
  "todaySchedule": [ { "scheduleId": 44, "classSubjectId": 12, "className": "Grade 7 - A", "subjectName": "Biology", "startTime": "08:00", "endTime": "09:00", "room": "B-204", "attendanceMarked": true } ],   // today's ISO weekday in APP_TIMEZONE, current academic year only
  "attendanceToday": { "sessionsScheduled": 4, "sessionsMarked": 2 },
  "pendingGrading": [ { "assessmentId": 31, "title": "Unit 2 Exam", "className": "Grade 7 - A", "subjectName": "Biology", "assessedOn": "2026-09-30", "graded": 20, "enrolled": 32 } ],   // graded < enrolled, max 10
  "recentAnnouncements": [ ... ]   // visible to the teacher, max 5
}
// student
{
  "role": "student",
  "student": { "id": 12, "studentNumber": "STU-2026-0040", "firstName": "Liam", "lastName": "Cruz" },
  "currentEnrollment": { "classId": 3, "className": "Grade 7 - A", "gradeLevel": 7, "academicYear": "2026-2027", "homeroomTeacher": { "id": 5, "firstName": "Ana", "lastName": "Reyes" } },   // or null
  "todaySchedule": [ { "scheduleId": 44, "classSubjectId": 12, "subjectName": "Biology", "teacher": { "id": 5, "firstName": "Ana", "lastName": "Reyes" }, "startTime": "08:00", "endTime": "09:00", "room": "B-204" } ],
  "attendanceSummary": { "dateFrom": "2026-06-01", "dateTo": "2026-10-03", "total": 120, "present": 110, "absent": 4, "late": 5, "excused": 1, "rate": 0.9583 },   // current class's academic year
  "gradeSummary": [ { "classSubjectId": 12, "subjectName": "Biology", "assessmentsGraded": 4, "percentage": 87.5 } ],
  "recentGrades": [ { "gradeId": 501, "assessmentId": 31, "title": "Quiz 3", "type": "quiz", "subjectName": "Biology", "score": 18, "maxScore": 20, "percentage": 90, "assessedOn": "2026-10-01" } ],   // max 5
  "upcomingAssessments": [ { "id": 33, "title": "Unit 2 Exam", "type": "exam", "subjectName": "Biology", "assessedOn": "2026-10-07" } ],   // max 5
  "recentAnnouncements": [ ... ]   // max 5
}
```

### 2.15 system (1)

| Method | Path | Roles | Ownership rule | Purpose | Notable params / body |
|---|---|---|---|---|---|
| GET | `/health` | public | — | Liveness + DB ping (§8). | — |

**Endpoint count:** auth 3 · users 5 · students 3 · teachers 3 · subjects 5 · classes 5 · class-subjects 5 · enrollments 6 · attendance 6 · assessments+grades 10 · schedules 5 · announcements 5 · dashboard 1 · health 1 = **63**.

---

## 3. Request / response examples (8 key endpoints)

All examples omit `X-Request-Id` (present on every response) and `createdAt`/`updatedAt` unless relevant.

### 3.1 `POST /api/v1/auth/register` (public)

Request:

```json
{
  "email": "liam.cruz@example.com",
  "password": "Str0ngPass!",
  "firstName": "Liam",
  "lastName": "Cruz",
  "phone": "+63 917 123 4567",
  "dateOfBirth": "2013-04-21",
  "gender": "male",
  "guardianName": "Maria Cruz",
  "guardianPhone": "+63 917 765 4321"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": 40, "firebaseUid": "f1R3b4s3Uid…", "email": "liam.cruz@example.com",
    "firstName": "Liam", "lastName": "Cruz", "phone": "+63 917 123 4567",
    "role": "student", "isActive": true, "studentId": 12, "teacherId": null,
    "profile": {
      "id": 12, "studentNumber": "STU-2026-0040", "dateOfBirth": "2013-04-21", "gender": "male",
      "address": null, "guardianName": "Maria Cruz", "guardianPhone": "+63 917 765 4321",
      "admissionDate": "2026-10-03", "currentEnrollment": null
    },
    "createdAt": "2026-10-03T07:30:00.000Z"
  }
}
```

Duplicate email `409`:

```json
{ "success": false, "error": { "code": "CONFLICT", "message": "email already registered", "details": { "key": "users.uq_users_email" } } }
```

Validation failure `400`:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "request validation failed",
  "details": { "issues": [ { "path": "body.password", "message": "String must contain at least 8 character(s)" }, { "path": "body.dateOfBirth", "message": "expected YYYY-MM-DD" } ] } } }
```

### 3.2 `GET /api/v1/auth/me`

Request header: `Authorization: Bearer <firebase-id-token>`.

Response `200` (teacher):

```json
{
  "success": true,
  "data": {
    "id": 7, "firebaseUid": "t3AcH3rUid…", "email": "ana.reyes@school.test",
    "firstName": "Ana", "lastName": "Reyes", "phone": null,
    "role": "teacher", "isActive": true, "studentId": null, "teacherId": 5,
    "profile": { "id": 5, "employeeNumber": "EMP-2024-0007", "department": "Science", "qualification": "MSc Biology", "hireDate": "2024-06-01" },
    "createdAt": "2024-06-01T01:00:00.000Z"
  }
}
```

Failure modes: no/invalid token → `401 UNAUTHORIZED` (`details.reason: "auth/id-token-expired"`); valid token, unknown uid → `403 USER_NOT_REGISTERED` (authenticated but not provisioned); `is_active = false` → `403 ACCOUNT_DISABLED`.

### 3.3 `POST /api/v1/users` (admin creates a teacher)

```json
{
  "email": "ana.reyes@school.test",
  "password": "TempPass#2026",
  "role": "teacher",
  "firstName": "Ana",
  "lastName": "Reyes",
  "profile": { "employeeNumber": "EMP-2024-0007", "department": "Science", "qualification": "MSc Biology", "hireDate": "2024-06-01" }
}
```

For `role: "teacher"` the `profile` object takes `employeeNumber?, department?, qualification?, hireDate?`; for `role: "student"` it takes `studentNumber?, dateOfBirth?, gender?, address?, guardianName?, guardianPhone?, admissionDate?`. Omitted numbers are generated (`EMP-2024-0007` above could have been left out), omitted `hireDate` / `admissionDate` default to today. For `role: "admin"`, `profile` must be absent. Response `201` = the `/auth/me` shape of the new user (see 3.2). Service flow: email pre-check in MySQL → Firebase `createUser` → transaction (`users` + profile row) → on failure `deleteUser(uid)` then rethrow.

### 3.4 `POST /api/v1/class-subjects` (admin assigns a teacher)

```json
{ "classId": 3, "subjectId": 2, "teacherId": 5 }
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": 12, "classId": 3, "className": "Grade 7 - A", "academicYear": "2026-2027",
    "subjectId": 2, "subjectCode": "BIO7", "subjectName": "Biology",
    "teacherId": 5, "teacher": { "id": 5, "firstName": "Ana", "lastName": "Reyes" },
    "createdAt": "2026-10-03T07:40:00.000Z", "updatedAt": "2026-10-03T07:40:00.000Z"
  }
}
```

Same class + subject again → `409 CONFLICT`, `message: "duplicate value for class_subjects.uq_class_subjects_class_subject"`, `details: { "key": "class_subjects.uq_class_subjects_class_subject" }`. Non-existent `teacherId` → `400 VALIDATION_ERROR`, `details: { "field": "teacherId" }` (FK mapping). Inactive teacher → `400 VALIDATION_ERROR`, `message: "teacher is inactive"`; retired subject → `400`, `message: "subject is inactive"`.

### 3.5 `PUT /api/v1/attendance/sheet` (teacher marks a roster)

```json
{
  "classSubjectId": 12,
  "date": "2026-10-03",
  "records": [
    { "studentId": 12, "status": "present" },
    { "studentId": 13, "status": "late", "remarks": "arrived 08:15" },
    { "studentId": 14, "status": "absent" }
  ]
}
```

Response `200` (same shape as `GET /attendance/sheet?classSubjectId=12&date=2026-10-03`):

```json
{
  "success": true,
  "data": {
    "classSubjectId": 12,
    "classSubject": { "classId": 3, "className": "Grade 7 - A", "subjectId": 2, "subjectName": "Biology", "teacherId": 5 },
    "date": "2026-10-03",
    "records": [
      { "studentId": 12, "studentNumber": "STU-2026-0040", "firstName": "Liam", "lastName": "Cruz", "attendanceId": 901, "status": "present", "remarks": null, "markedBy": { "id": 7, "firstName": "Ana", "lastName": "Reyes" } },
      { "studentId": 13, "studentNumber": "STU-2026-0041", "firstName": "Mia", "lastName": "Santos", "attendanceId": 902, "status": "late", "remarks": "arrived 08:15", "markedBy": { "id": 7, "firstName": "Ana", "lastName": "Reyes" } },
      { "studentId": 14, "studentNumber": "STU-2026-0042", "firstName": "Noah", "lastName": "Lim", "attendanceId": 903, "status": "absent", "remarks": null, "markedBy": { "id": 7, "firstName": "Ana", "lastName": "Reyes" } },
      { "studentId": 15, "studentNumber": "STU-2026-0043", "firstName": "Zoe", "lastName": "Tan", "attendanceId": null, "status": null, "remarks": null, "markedBy": null }
    ]
  }
}
```

Teacher who does not own class-subject 12 → `403 FORBIDDEN`, `details: { "reason": "not_class_subject_owner" }`. A `studentId` not actively enrolled in class 3 → `400 VALIDATION_ERROR`, `message: "students not enrolled in this class"`, `details: { "invalidStudentIds": [99] }`. Future date → `400`, `message: "date cannot be in the future"`.

### 3.6 `POST /api/v1/assessments` then `PUT /api/v1/assessments/31/grades`

Create:

```json
{ "classSubjectId": 12, "title": "Unit 2 Exam", "type": "exam", "maxScore": 50, "term": "term1", "assessedOn": "2026-10-07" }
```

Response `201`:

```json
{ "success": true, "data": { "id": 31, "classSubjectId": 12, "classSubject": { "classId": 3, "className": "Grade 7 - A", "subjectId": 2, "subjectName": "Biology", "teacherId": 5 }, "title": "Unit 2 Exam", "type": "exam", "maxScore": 50, "term": "term1", "assessedOn": "2026-10-07", "gradedCount": 0, "enrolledCount": 32, "createdAt": "…", "updatedAt": "…" } }
```

Bulk grades:

```json
{ "grades": [ { "studentId": 12, "score": 45 }, { "studentId": 13, "score": 38.5, "remarks": "missed Q4" }, { "studentId": 14, "score": 50 } ] }
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "assessmentId": 31,
    "assessment": { "id": 31, "title": "Unit 2 Exam", "type": "exam", "maxScore": 50, "term": "term1", "assessedOn": "2026-10-07", "classSubjectId": 12, "subjectName": "Biology", "className": "Grade 7 - A" },
    "records": [
      { "studentId": 12, "studentNumber": "STU-2026-0040", "firstName": "Liam", "lastName": "Cruz", "gradeId": 501, "score": 45, "percentage": 90, "remarks": null, "gradedBy": { "id": 7, "firstName": "Ana", "lastName": "Reyes" }, "updatedAt": "…" },
      { "studentId": 13, "studentNumber": "STU-2026-0041", "firstName": "Mia", "lastName": "Santos", "gradeId": 502, "score": 38.5, "percentage": 77, "remarks": "missed Q4", "gradedBy": { "id": 7, "firstName": "Ana", "lastName": "Reyes" }, "updatedAt": "…" },
      { "studentId": 14, "studentNumber": "STU-2026-0042", "firstName": "Noah", "lastName": "Lim", "gradeId": 503, "score": 50, "percentage": 100, "remarks": null, "gradedBy": { "id": 7, "firstName": "Ana", "lastName": "Reyes" }, "updatedAt": "…" },
      { "studentId": 15, "studentNumber": "STU-2026-0043", "firstName": "Zoe", "lastName": "Tan", "gradeId": null, "score": null, "percentage": null, "remarks": null, "gradedBy": null, "updatedAt": null }
    ]
  }
}
```

Score out of range → `400 VALIDATION_ERROR`, `message: "a score is above the maximum of 50"`, `details: { "studentId": 14, "score": 55, "maxScore": 50 }` (the whole batch is rejected; nothing is written).

### 3.7 `POST /api/v1/schedules` with a conflict

```json
{ "classSubjectId": 12, "dayOfWeek": 1, "startTime": "08:00", "endTime": "09:00", "room": "B-204" }
```

Response `409`:

```json
{
  "success": false,
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "this period clashes with 2 other periods",
    "details": {
      "conflicts": [
        { "type": "teacher", "scheduleId": 40, "classSubjectId": 18, "className": "Grade 8 - B", "subjectName": "Chemistry", "dayOfWeek": 1, "startTime": "08:30", "endTime": "09:30", "room": "B-201" },
        { "type": "room",    "scheduleId": 41, "classSubjectId": 21, "className": "Grade 9 - A", "subjectName": "Physics",   "dayOfWeek": 1, "startTime": "07:30", "endTime": "08:30", "room": "B-204" }
      ]
    }
  }
}
```

Success `201` returns the schedule shape (§2.12). `endTime <= startTime` → `400 VALIDATION_ERROR` (`path: "body.endTime"`).

### 3.8 `GET /api/v1/students?search=cruz&classId=3&gradeLevel=7&sortBy=lastName&sortOrder=asc&page=1&limit=20`

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": 12, "userId": 40, "studentNumber": "STU-2026-0040", "firstName": "Liam", "lastName": "Cruz",
      "email": "liam.cruz@example.com", "phone": "+63 917 123 4567", "dateOfBirth": "2013-04-21", "gender": "male",
      "address": null, "guardianName": "Maria Cruz", "guardianPhone": "+63 917 765 4321", "admissionDate": "2026-10-03", "isActive": true,
      "currentEnrollment": { "id": 77, "classId": 3, "className": "Grade 7 - A", "gradeLevel": 7, "academicYear": "2026-2027", "status": "active" },
      "createdAt": "2026-10-03T07:30:00.000Z", "updatedAt": "2026-10-03T07:30:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

`limit=500` → `400 VALIDATION_ERROR` (`path: "query.limit"`). `sortBy=email` → `400` (`"query.sortBy"`, not in whitelist). Teacher passing a `classId` they cannot view → `403 FORBIDDEN`, `details: { "reason": "class_not_visible" }`.

---

## 4. Validation rules (zod) per resource

zod v4 syntax is assumed (`z.email()`, `z.iso.date()`, `z.iso.datetime()`); the v3 equivalents are `z.string().email()`, `.regex(...)`, `.datetime()`.

Every enum is built from `src/constants/shared.js` (byte-identical to `frontend/src/constants/shared.js`, checked by `npm run check:constants`): `z.enum(ROLES)`, `z.enum(GENDERS)`, `z.enum(ENROLLMENT_STATUSES)`, `z.enum(ATTENDANCE_STATUSES)`, `z.enum(ASSESSMENT_TYPES)`, `z.enum(TERMS)`, `z.enum(ANNOUNCEMENT_AUDIENCES)`, `z.enum(SORT_ORDERS)`. The regexes (`DATE_REGEX`, `TIME_REGEX`, `ACADEMIC_YEAR_REGEX`, `STUDENT_NUMBER_REGEX`, `EMPLOYEE_NUMBER_REGEX`, `SUBJECT_CODE_REGEX`) come from the same file, so no enum literal or pattern is typed twice.

### 4.1 Shared primitives — `src/utils/zod/common.js`

| Name | Definition | Notes |
|---|---|---|
| `id` | `z.coerce.number().int().positive()` | path params and ids in filters |
| `idOrMe` | `z.union([z.literal('me'), id])` | only for `studentId`, `teacherId`, `authorId`, `homeroomTeacherId` |
| `dateStr` | `z.iso.date()` (regex `^\d{4}-\d{2}-\d{2}$` + real calendar date) | `YYYY-MM-DD` |
| `timeStr` | `z.string().regex(/^([01]\d\|2[0-3]):[0-5]\d$/)` | `HH:MM`; stored as `TIME 'HH:MM:00'`, read back as `HH:MM` by the pool's `typeCast` |
| `isoDateTime` | `z.iso.datetime({ offset: true })` | announcements |
| `email` | `z.email().trim().toLowerCase().max(255)` | normalized before DB and Firebase |
| `password` | `z.string().min(8).max(128)` | Firebase enforces ≥ 6; we enforce 8 |
| `phone` | `z.string().trim().regex(/^\+?[0-9()\-\s]{7,20}$/)` | nullable where optional |
| `name` | `z.string().trim().min(1).max(100)` | first/last names, guardian name |
| `academicYear` | `z.string().regex(ACADEMIC_YEAR_REGEX).refine(v => { const [a,b] = v.split('-').map(Number); return b === a + 1 }, 'second year must be first + 1')` | `2026-2027` |
| `studentNumber` | `z.string().trim().toUpperCase().regex(STUDENT_NUMBER_REGEX)` with `STUDENT_NUMBER_REGEX = /^STU-\d{4}-\d{4,}$/` | `STU-YYYY-NNNN` (YYYY = admission year, NNNN = per-year sequence); optional on create (generated), never null |
| `employeeNumber` | `z.string().trim().toUpperCase().regex(EMPLOYEE_NUMBER_REGEX)` with `EMPLOYEE_NUMBER_REGEX = /^EMP-\d{4}-\d{4,}$/` | `EMP-YYYY-NNNN` (YYYY = hire year); same rules |
| `dayOfWeek` | `z.coerce.number().int().min(1).max(7)` | 1 = Monday |
| `boolQuery` | `z.enum(['true','false']).transform(v => v === 'true')` | query booleans |
| `listQuery(sortable, searchable = true)` | builds `{ page: coerce int ≥1 default 1, limit: coerce int 1..100 default 20, search?: trim 1..100, sortBy?: z.enum(sortable), sortOrder?: z.enum(SORT_ORDERS) }` | one builder for all lists; each resource passes its whitelist |
| `patchOf(shape)` | `z.object(shape).partial().strict().refine(o => Object.keys(o).length > 0, 'at least one field is required')` | all PATCH bodies |
| `uniqueBy(key)` | `.refine(arr => new Set(arr.map(r => r[key])).size === arr.length, 'duplicate ' + key)` | bulk arrays |

All body schemas are `.strict()`. Query schemas are `.strict()` too (an unknown filter name is a bug, not a no-op). Params schemas are `z.object({ id })` or `z.object({ id: idOrMe })`.

### 4.2 Per resource

| Resource / endpoint | Body rules | Query / param rules |
|---|---|---|
| **auth.register** | `email`, `password`, `firstName: name`, `lastName: name`, `phone?`, `dateOfBirth?: dateStr` (must be in the past, age ≤ 100), `gender?: z.enum(GENDERS)`, `address?: string ≤ 255`, `guardianName?: name`, `guardianPhone?: phone` | — |
| **auth.me PATCH** | `patchOf({ phone: phone.nullable(), address: string≤255.nullable(), guardianName: name.nullable(), guardianPhone: phone.nullable() })`; service rejects student-only keys for non-students (400) | — |
| **users.create** | `z.discriminatedUnion('role', [...])`: common `email, password, firstName, lastName, phone?`; `role: 'student'` → `profile: { studentNumber?: studentNumber, dateOfBirth?, gender?: z.enum(GENDERS), address?, guardianName?, guardianPhone?, admissionDate?: dateStr }` (required object, may be `{}`; an omitted `studentNumber` is generated, an omitted `admissionDate` becomes today); `role: 'teacher'` → `profile: { employeeNumber?: employeeNumber, department?: string≤100, qualification?: string≤150, hireDate?: dateStr }` (omitted `hireDate` becomes today); `role: 'admin'` → no `profile` key allowed | list: `role?: z.enum(ROLES)`, `isActive?: boolQuery`, `listQuery(['lastName','firstName','email','role','createdAt'])` |
| **users PATCH** | `patchOf({ firstName: name, lastName: name, phone: phone.nullable() })` | `params.id: id` |
| **users status** | `z.object({ isActive: z.boolean() }).strict()` | `params.id: id` |
| **students PATCH** | `patchOf({ firstName, lastName, phone.nullable(), studentNumber, dateOfBirth, gender.nullable(), address.nullable(), guardianName.nullable(), guardianPhone.nullable(), admissionDate })` (`admissionDate` not nullable) | list: `classId?: id`, `gradeLevel?: coerce int 1..12`, `gender?`, `isActive?: boolQuery`, `hasActiveEnrollment?: boolQuery`, `listQuery(['lastName','firstName','studentNumber','admissionDate','createdAt'])`; `params.id: idOrMe` |
| **teachers PATCH** | `patchOf({ firstName, lastName, phone.nullable(), employeeNumber, department.nullable(), qualification: string≤150.nullable(), hireDate })` (`hireDate` not nullable) | list: `department?: string≤100`, `isActive?`, `listQuery(['lastName','firstName','employeeNumber','department','hireDate'])`; `params.id: idOrMe` |
| **subjects** | create: `code: trim().toUpperCase().regex(SUBJECT_CODE_REGEX)` (`/^[A-Z0-9-]{2,20}$/`), `name: string 1..100`, `description?: string≤1000 nullable`; patch: `patchOf(same + isActive: z.boolean())` | list: `isActive?: boolQuery` (omitted = all), `listQuery(['code','name','createdAt'])` |
| **classes** | create: `name: string 1..100`, `gradeLevel: int 1..12`, `academicYear`, `homeroomTeacherId?: id nullable`; patch: `patchOf(same)` | list: `academicYear?`, `gradeLevel?: coerce int 1..12`, `homeroomTeacherId?: idOrMe`, `listQuery(['name','gradeLevel','academicYear','createdAt'])` |
| **class-subjects** | create: `classId: id, subjectId: id, teacherId: id`; patch: `z.object({ teacherId: id }).strict()` | list: `classId?, subjectId?, teacherId?: idOrMe, academicYear?`, `listQuery(['className','subjectName','teacherLastName','createdAt'])` |
| **enrollments** | create: `studentId: id, classId: id`; bulk: `classId: id, studentIds: z.array(id).min(1).max(200)` + unique; transfer: `studentId: id, classId: id`; patch: `status: z.enum(['completed','withdrawn'])` (`active` and `transferred` are not accepted — re-activation is not allowed and transfers go through `/enrollments/transfer`) | list: `studentId?: idOrMe, classId?, status?: z.enum(ENROLLMENT_STATUSES), academicYear?`, `listQuery(['createdAt','status','studentLastName'])` |
| **attendance sheet PUT** | `classSubjectId: id`, `date: dateStr` (service: not after today in APP_TIMEZONE), `records: z.array({ studentId: id, status: z.enum(ATTENDANCE_STATUSES), remarks?: string≤255 nullable }).min(1).max(200)` + `uniqueBy('studentId')` | sheet GET: `classSubjectId: id` (required), `date: dateStr` (required), `.strict()` |
| **attendance PATCH** | `patchOf({ status: z.enum(ATTENDANCE_STATUSES), remarks: string≤255.nullable() })` | list: `studentId?: idOrMe, classSubjectId?, classId?, status?, dateFrom?: dateStr, dateTo?: dateStr` (+ refine `dateFrom <= dateTo`), `listQuery(['attendanceDate','status','studentLastName'])`; summary: same filters + `groupBy?: enum none/student/classSubject` |
| **assessments** | create: `classSubjectId: id`, `title: string 1..150`, `type: z.enum(ASSESSMENT_TYPES)` (quiz/test/exam/assignment/project/other), `maxScore: z.number().positive().max(1000)` (2 decimals: `.multipleOf(0.01)`), `term: z.enum(TERMS)` (term1/term2/term3), `assessedOn?: dateStr` (optional in the body, defaulted to today by the service; `null` is rejected because the column is NOT NULL); patch: `patchOf(same minus classSubjectId)` | list: `classSubjectId?, classId?, type?: z.enum(ASSESSMENT_TYPES), term?: z.enum(TERMS), dateFrom?, dateTo?`, `listQuery(['assessedOn','title','type','createdAt'])` |
| **grades PUT** | `grades: z.array({ studentId: id, score: z.number().min(0).multipleOf(0.01), remarks?: string≤255 nullable }).min(1).max(200)` + unique studentId; **upper bound (`score <= maxScore`) is checked in the service** because it depends on the assessment row | `params.id: id` |
| **grades list / summary** | — | `studentId?: idOrMe, assessmentId?, classSubjectId?, classId?, term?, type?`, `listQuery(['assessedOn','score','createdAt'])`; summary: `studentId?, classSubjectId?, classId?, term?, groupBy?: enum classSubject/student` |
| **schedules** | create: `classSubjectId: id`, `dayOfWeek`, `startTime: timeStr`, `endTime: timeStr`, `room?: string≤50 nullable`, refine `endTime > startTime` (string compare works for zero-padded HH:MM); patch: `patchOf(same)` with the same refine applied in the service on the merged row | list: `classId?, teacherId?: idOrMe, classSubjectId?, dayOfWeek?, room?, academicYear?`, `listQuery(['dayOfWeek','startTime'])` |
| **announcements** | create: `title: string 1..150`, `body: string 1..5000`, `audience: z.enum(ANNOUNCEMENT_AUDIENCES)`, `classId?: id nullable`, `publishedAt?: isoDateTime` (default now), `expiresAt?: isoDateTime nullable`, refine `expiresAt > publishedAt`; patch: `patchOf(same)` (cross-field refine re-run in service on merged row) | list: `audience?, classId?, authorId?: idOrMe, status?: enum active/scheduled/expired/all`, `listQuery(['publishedAt','title','createdAt'])` |
| **dashboard / health** | — | `.strict()` empty query (any param → 400) |

Where a rule needs DB data (score ≤ maxScore, enrollment membership, ownership, future date in APP_TIMEZONE), it lives in the **service** and still surfaces as `400 VALIDATION_ERROR` with the same `details` style, so the client handles both kinds identically.

---

## 5. RBAC matrix

`Y` = allowed on any record · `own` = allowed only within the caller's scope (§1.6: teacher *visible*/*owns*, student self) · `N` = 403.

| Capability | admin | teacher | student |
|---|---|---|---|
| Register (public, forced role student) | — | — | — (unauthenticated) |
| Read own identity `/auth/me` | Y | Y | Y |
| Update own contact fields `/auth/me` | Y (phone) | Y (phone) | Y (phone, address, guardian*) |
| List / read / create / update users, change status | Y | N | N |
| Change own account status | N (403) | N | N |
| List students | Y | own (visible classes) | N |
| Read a student profile | Y | own (visible classes) | own (self) |
| Update student profile (full) | Y | N | N |
| List teachers | Y | N | N |
| Read a teacher profile | Y | own (self) | N |
| Update teacher profile | Y | N | N |
| Read subjects / classes | Y | Y | Y |
| Create / update / delete / retire subjects, create / update / delete classes | Y | N | N |
| Read class-subjects | Y | own (visible) | own (active class) |
| Create / reassign / delete class-subjects | Y | N | N |
| Read enrollments | Y | own (visible classes) | own (self) |
| Create enrollments (single, bulk, transfer), change status | Y | N | N |
| Read attendance records / summary | Y | own (visible) | own (self) |
| Read attendance sheet (roster + marks) | Y | own (visible) | N |
| Mark attendance (PUT sheet), correct a row (PATCH) | Y | own (**owns**) | N |
| Delete an attendance row | Y | N | N |
| Read assessments | Y | own (visible) | own (active class) |
| Create / update / delete assessments | Y | own (owns) | N |
| Read roster-with-scores `/assessments/:id/grades` | Y | own (visible) | N |
| Enter grades (PUT), delete a grade | Y | own (owns) | N |
| Read grades / grade summary | Y | own (visible) | own (self) |
| Read schedules | Y | own (visible) | own (active class) |
| Create / update / delete schedules | Y | N | N |
| Read announcements | Y (all statuses) | own (targeted + authored) | own (targeted, active) |
| Use `status` filter on announcements | Y | N | N |
| Create announcements | Y (any audience, optional class) | own (visible class, `classId` required) | N |
| Update / delete announcements | Y | own (authored) | N |
| Dashboard | Y (admin payload) | Y (teacher payload) | Y (student payload) |
| Health | public | public | public |

Enforcement split: the **role column** is `authorize(...)` on the route; every **own** cell is a named assertion in `access.service.js` (`assertCanViewClassSubject`, `assertCanManageClassSubject`, `assertCanViewClass`, `assertCanViewStudent`, `assertIsSelf`, `assertIsAuthor`) called at the top of the service function, before any write.

---

## 6. Backend folder hierarchy

The backend lives in `backend/` next to `frontend/` (repository layout in the plan, §10). Module-per-folder (everything about attendance is in one folder) with the four fixed layers inside each module plus a `*.schemas.js` file for zod.

```text
backend/                              # .gitignore, .gitattributes and README.md live at the repository root
├── package.json                      # "type": "module"; scripts: dev, start, test, lint, format, db:migrate, db:seed, db:reset, check:constants, check:secrets, doctor, token
├── .env.example                      # §6.4 — placeholders only
├── firebase-service-account.json     # git-ignored; downloaded from the Firebase console; located via FIREBASE_SERVICE_ACCOUNT_PATH
├── docs/
│   └── openapi.yaml                  # hand-written spec (§9)
├── database/
│   ├── schema.sql                    # CREATE DATABASE IF NOT EXISTS + 12 tables, indexes, FKs, generated active_flag column — idempotent, no DROP
│   └── seed.sql                      # non-user demo data (subjects, classes, assignments, enrollments, schedules, attendance, assessments, grades, announcements); ids resolved by natural keys (emails, subject codes, class names), dates relative to today
├── scripts/
│   ├── migrate.js                    # runs schema.sql through a dedicated multipleStatements connection (creates the database; no mysql CLI needed); --fresh drops it first
│   ├── seed.js                       # Firebase users + users/profile rows first (idempotent, re-links firebase_uid by email), then database/seed.sql; refuses to run twice
│   ├── doctor.js                     # env, service account, project-id parity with frontend/.env, DB reachable, tables present, ports free
│   ├── check-constants.js            # src/constants/shared.js byte-equal to frontend/src/constants/shared.js + ENUM parity with schema.sql
│   └── get-token.js                  # prints a Firebase ID token for a demo account (Swagger "Authorize"), using the public web API key
├── tests/                            # node:test + supertest; the app is built with a fake Firebase verifier (cases listed in the plan, §12)
└── src/
    ├── server.js                     # entry: loadEnv -> service-account check -> db.ping -> Firebase probe -> app.listen; SIGTERM -> pool.end
    ├── app.js                        # builds the express app: middleware order (§7), mounts /api/docs, /api/v1, notFound, errorHandler
    ├── routes.js                     # api router: /health, /auth (public register), authenticate, then every module router
    ├── constants/
    │   └── shared.js                 # identical to frontend/src/constants/shared.js (enums, regexes, ERROR_CODES, PAGINATION); pure ESM, no env, no React
    ├── config/
    │   ├── env.js                    # zod-validated process.env + parsed service-account JSON -> frozen `env` object; fails fast (§8)
    │   ├── db.js                     # mysql2 pool (typeCast, dateStrings, UTC session), query(), withTransaction(), camelize-on-read
    │   ├── firebase.js               # firebase-admin initializeApp(cert(env.firebaseServiceAccount)); exports `auth`
    │   └── swagger.js                # loads docs/openapi.yaml with `yaml`, exports swagger-ui router
    ├── middleware/
    │   ├── requestId.js              # X-Request-Id in/out, req.id
    │   ├── httpLogger.js             # morgan with custom tokens :id :user (§8)
    │   ├── authenticate.js           # Bearer -> verifyIdToken -> users lookup -> req.user
    │   ├── authorize.js              # authorize(...roles)
    │   ├── validate.js               # validate({ params, query, body }) -> req.validated
    │   ├── notFound.js               # 404 NOT_FOUND for unknown routes
    │   └── errorHandler.js           # the single place that turns any error into the envelope (§7)
    ├── utils/
    │   ├── ApiError.js               # class + static factories (validation, unauthorized, notRegistered, forbidden, accountDisabled, notFound, conflict, scheduleConflict, rateLimited, internal, unavailable)
    │   ├── respond.js                # ok(res, data, { status = 200, meta })
    │   ├── pagination.js             # parsePagination({page,limit,sortBy,sortOrder}, sortMap, defaultOrder) -> { limit, offset, orderBySql }; buildMeta()
    │   ├── resolveMe.js              # resolveMe(user, value, kind)
    │   ├── dates.js                  # todayInAppTz(), dayOfWeekInAppTz(), isAfterToday(), currentAcademicYear() (August rule, ACADEMIC_YEAR_START_MONTH)
    │   ├── sql.js                    # escapeLike(), whereBuilder() -> { sql, params }
    │   ├── mysqlErrorMap.js          # §1.4
    │   ├── firebaseErrorMap.js       # §1.4
    │   ├── logger.js                 # tiny leveled console logger (JSON in prod), no dependency
    │   └── zod/
    │       └── common.js             # §4.1 primitives
    └── modules/
        ├── access/                   # ownership policy, no routes
        │   ├── access.service.js     # scopeFor(user), assertCanViewClassSubject, assertCanManageClassSubject, assertCanViewClass, assertCanViewStudent, assertIsSelf, assertIsAuthor
        │   └── access.repository.js  # the EXISTS queries behind the assertions
        ├── auth/
        │   ├── auth.routes.js        # registerLimiter (express-rate-limit, §7) on POST /register only
        │   ├── auth.controller.js
        │   ├── auth.service.js       # register (calls users.service.createUserAccount with role 'student'), getMe, updateMe
        │   └── auth.schemas.js
        ├── users/
        │   ├── users.routes.js
        │   ├── users.controller.js
        │   ├── users.service.js      # createUserAccount (Firebase + tx + compensation, number generation), setStatus (self / teacher-assignment guards), list, get, update
        │   ├── users.repository.js   # findAuthContextByFirebaseUid, findAccountById, insertUser, ...
        │   └── users.schemas.js
        ├── students/        (students.routes.js, .controller.js, .service.js, .repository.js, .schemas.js)
        ├── teachers/        (same 5 files)
        ├── subjects/        (same 5 files)
        ├── classes/         (same 5 files)
        ├── classSubjects/   (same 5 files)                      # URL: /class-subjects
        ├── enrollments/     (same 5 files)                      # single, bulk and transfer
        ├── attendance/      (same 5 files)                      # sheet + summary live here
        ├── assessments/     (same 5 files)
        ├── grades/          (grades.routes.js exports gradesRouter (/grades) AND assessmentGradesRouter (/assessments/:assessmentId/grades, mergeParams), + controller/service/repository/schemas)
        ├── schedules/       (same 5 files; conflict detection in schedules.service.js + findOverlaps in repository)
        ├── announcements/   (same 5 files)
        ├── dashboard/
        │   ├── dashboard.routes.js
        │   ├── dashboard.controller.js
        │   ├── dashboard.service.js  # adminDashboard / teacherDashboard / studentDashboard
        │   └── dashboard.repository.js # aggregate queries only
        └── health/
            ├── health.routes.js
            └── health.controller.js  # pings db via db.ping()
```

### 6.1 Layer responsibilities (one line each)

- **routes** — declare `METHOD path`, attach `authorize(...)` and `validate(schemas)`, point at one controller function; no logic.
- **controller** — unpack `req.validated` + `req.user`, call exactly one service function, send the envelope with the right status; no business rules, no SQL, no Firebase.
- **service** — business rules, ownership assertions, `me` resolution, transactions (`withTransaction`), Firebase Admin calls, throws `ApiError`; knows nothing about `req`/`res`.
- **repository** — SQL only: parameterized queries, explicit column lists, returns camelCase plain objects or `null`/`[]`; never throws `ApiError`, never knows about roles.
- **schemas** — zod schemas for that module's params/query/body, built from `utils/zod/common.js`.
- **access module** — the only place ownership/visibility SQL exists; every service imports its assertions instead of writing its own checks.

### 6.2 The ONE rule

> **A file may import only from the layer directly below it inside its own module, from `src/utils` / `src/config`, or (services only) from another module's `*.service.js`. Nothing else.**

Consequences that keep the code debuggable: HTTP vocabulary (`req`, `res`, status codes) exists only in routes/controllers/middleware; SQL exists only in `*.repository.js` and `access.repository.js`; `ApiError` is thrown only by services, middleware and the two error maps; a repository is never called from another module (if attendance needs class-subject data it calls `classSubjects.service`, which is the only owner of that table's rules). When a bug reproduces, the layer tells you where to look: wrong status/shape → controller; wrong rule → service; wrong rows → repository.

### 6.3 Key shared contracts

```js
// src/config/db.js
function typeCast(field, next) {                                    // the ONE place TIME and TINYINT(1) are converted
  if (field.type === 'TIME') { const v = field.string(); return v ? v.slice(0, 5) : v; }                 // '08:00:00' -> '08:00'
  if (field.type === 'TINY' && field.length === 1) { const v = field.string(); return v === null ? null : v === '1'; }
  return next();
}
export const pool = mysql.createPool({ host, port, user, password, database, connectionLimit, waitForConnections: true,
  namedPlaceholders: false, dateStrings: ['DATE'], timezone: 'Z', decimalNumbers: true, supportBigNumbers: true, typeCast });
pool.on('connection', (c) => c.query("SET time_zone = '+00:00'"));  // every session in UTC so DATETIME round-trips unchanged
export async function query(sql, params = [], conn = pool) {        // use query(), not execute(): dynamic WHERE clauses
  const [rows] = await conn.query(sql, params);                     // would bloat the prepared-statement cache and
  return Array.isArray(rows) ? rows.map(camelizeKeys) : rows;       // `LIMIT ?` has known quirks with execute()
}
export async function withTransaction(fn) {                         // fn(conn) -> result; commit/rollback/release handled here
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const r = await fn(conn); await conn.commit(); return r; }
  catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
export const ping = () => pool.query('SELECT 1');
```

Repositories accept an optional trailing `conn` so the same function works inside and outside a transaction. `decimalNumbers: true` makes `DECIMAL` (scores, maxScore) arrive as numbers, not strings. `typeCast` is the only place TIME and TINYINT(1) values are converted: TIME columns arrive as `HH:MM` strings and flags such as `is_active` as booleans, so repositories select columns plainly. `withTransaction` is the only caller of `pool.getConnection` and always releases in `finally`; `multipleStatements` is enabled only on the dedicated connection the migrate/seed scripts open, never on the pool.

```js
// src/middleware/validate.js  — Express 5: req.query is a read-only getter, so parsed values go to req.validated
export const validate = (schemas) => (req, _res, next) => {
  const out = {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const r = schemas[key].safeParse(req[key] ?? {});
    if (!r.success) return next(ApiError.validation(r.error, key));   // issues paths prefixed "body.email" etc.
    out[key] = r.data;
  }
  req.validated = out;
  next();
};
```

Express 5 forwards rejected promises from async handlers to `next(err)` automatically — there is **no** `asyncHandler` wrapper in this codebase; adding one would be a redundancy.

```js
// controller shape (every controller function looks like this)
export async function create(req, res) {
  const data = await classSubjectsService.create(req.user, req.validated.body);
  ok(res, data, { status: 201 });
}
```

### 6.4 Environment variables — `.env.example`

```dotenv
# --- runtime ---
NODE_ENV=development            # development | test | production; controls stack traces in errors and log format
PORT=3000                       # the Vite dev server (5173) proxies /api here
# APP_TIMEZONE=Asia/Manila      # optional IANA tz for "today" / dayOfWeek / academic year; default = the machine's time zone (Intl.DateTimeFormat().resolvedOptions().timeZone)
ACADEMIC_YEAR_START_MONTH=8     # month the academic year starts in (August rule: 2026-08-01 .. 2027-07-31 = "2026-2027")
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173   # comma-separated allowed origins (only needed without the Vite proxy); "*" allowed only when NODE_ENV != production
LOG_LEVEL=debug                 # debug | info | warn | error
DOCS_ENABLED=true               # serve swagger UI at /api/docs
ALLOW_PUBLIC_REGISTRATION=true  # POST /auth/register; when false the route answers 404 NOT_FOUND

# --- MySQL ---
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=                    # quote the value if it contains #, $ or spaces, e.g. DB_PASSWORD="p#ss word"
DB_NAME=school_management       # tests use school_management_test
DB_CONNECTION_LIMIT=10

# --- Firebase Admin (service account) ---
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json   # git-ignored JSON downloaded from the Firebase console; resolved relative to backend/

# --- scripts only ---
SEED_PASSWORD=Password123!      # password given to every seeded demo account (admin@school.test, admin2@school.test, teacher1..3@school.test, student1..8@school.test)
```

`env.js` exports a frozen object with typed values (`PORT` and `ACADEMIC_YEAR_START_MONTH` as numbers, `CORS_ORIGINS` as an array, `APP_TIMEZONE` filled with the machine's time zone when absent, `isProd` boolean). It also resolves `FIREBASE_SERVICE_ACCOUNT_PATH` relative to `backend/`, reads the JSON file and validates that `type === 'service_account'` and that `project_id`, `private_key` and `client_email` are present, exporting the parsed object as `env.firebaseServiceAccount` (and `env.firebaseProjectId` for the startup banner and `/health`). A missing or malformed file is a startup error that prints the resolved path. Code never reads `process.env` directly outside `config/env.js`.

---

## 7. Middleware order (`src/app.js`) and the error-handler contract

```js
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.isProd ? 1 : false);

app.use(requestId);                                   // 1. X-Request-Id first so every later log line has it
app.use(helmet({ contentSecurityPolicy: false }));    // 2. security headers; CSP off because Swagger UI (the only HTML we serve) needs inline scripts
app.use(cors({ origin: env.CORS_ORIGINS, methods: ['GET','POST','PUT','PATCH','DELETE'],                 // 3.
               allowedHeaders: ['Authorization','Content-Type','X-Request-Id'], exposedHeaders: ['X-Request-Id'], credentials: false }));
app.use(express.json({ limit: '1mb' }));              // 4. bodies (JSON only; parse errors become 400 in the error handler)
app.use(httpLogger);                                  // 5. morgan (after requestId so :id resolves; logs on response finish)
if (env.DOCS_ENABLED) app.use('/api/docs', swaggerRouter);   // 6. no longer has to precede helmet now that CSP is off
app.use('/api/v1', apiRouter);                        // 7. see routes.js below
app.use(notFound);                                    // 8. 404 envelope for anything unmatched (incl. /api/v2, typos)
app.use(errorHandler);                                // 9. ALWAYS last; 4-arg signature
```

```js
// src/routes.js
const api = Router();
api.use('/health', healthRoutes);                     // public
api.use('/auth', authRoutes);                         // POST /register is public and goes through registerLimiter; GET/PATCH /me call authenticate per-route
api.use(authenticate);                                // ---- everything below needs a valid, registered, active user ----
api.use('/users', authorize('admin'), usersRoutes);   // whole module is admin-only, gate once here
api.use('/students', studentsRoutes);                 // mixed roles: authorize() per route inside the module router
api.use('/teachers', teachersRoutes);
api.use('/subjects', subjectsRoutes);
api.use('/classes', classesRoutes);
api.use('/class-subjects', classSubjectsRoutes);
api.use('/enrollments', enrollmentsRoutes);
api.use('/attendance', attendanceRoutes);
api.use('/assessments', assessmentsRoutes);
api.use('/assessments/:assessmentId/grades', assessmentGradesRouter);   // Router({ mergeParams: true })
api.use('/grades', gradesRouter);
api.use('/schedules', schedulesRoutes);
api.use('/announcements', announcementsRoutes);
api.use('/dashboard', dashboardRoutes);
```

Per-route order inside a module router is always `authorize(...)` → `validate({...})` → controller. `authorize` running before `validate` means an unauthorized caller gets 403, not a 400 about their body (no information leak about accepted fields).

Rate limiting exists for exactly one route. `registerLimiter` (`express-rate-limit`, declared in `auth.routes.js`) sits in front of `POST /auth/register` only: `windowMs: 15 * 60 * 1000, limit: 5`, keyed by IP (hence `trust proxy` above), `standardHeaders: 'draft-7', legacyHeaders: false`, and `skip: () => env.NODE_ENV === 'test'` so the test suite can register freely. Its `handler` throws `ApiError.rateLimited(retryAfterSeconds)`, so the response is the ordinary envelope — 429 `RATE_LIMITED`, `details: { retryAfterSeconds }` — plus the `Retry-After` header. No other route is rate limited.

`authenticate` (middleware/authenticate.js):
1. `Authorization: Bearer <token>` missing/malformed → 401 `UNAUTHORIZED` ("missing bearer token").
2. `auth.verifyIdToken(token)` (no `checkRevoked` — the MySQL `is_active` check below is the gate; `revokeRefreshTokens` on deactivate stops new tokens). Failure → 401 `UNAUTHORIZED`, `details.reason`.
3. `usersRepository.findAuthContextByFirebaseUid(uid)` — one query: `users LEFT JOIN students LEFT JOIN teachers LEFT JOIN enrollments(status='active')`. No row → 403 `USER_NOT_REGISTERED` (authenticated, not provisioned).
4. `is_active = 0` → 403 `ACCOUNT_DISABLED`.
5. `req.user = { id, firebaseUid, email, role, studentId, teacherId, activeClassId }` (nulls, not undefined, so logs are explicit).

`authorize(...roles)`: `req.user` missing → `ApiError.internal('authorize() used before authenticate()')` (a wiring bug must be loud); role not included → 403 `FORBIDDEN`, `details.reason = 'role_not_allowed'`.

### 7.1 Error-handler contract (`src/middleware/errorHandler.js`)

Input: any thrown/rejected value. Output: **always** the error envelope, correct status, `X-Request-Id` header, one log line. Decision order:

| # | Condition | Result |
|---|---|---|
| 1 | `err instanceof ApiError` | use `err.status / code / message / details` as-is |
| 2 | `err instanceof ZodError` (service-level parse) | 400 `VALIDATION_ERROR`, `details.issues` |
| 3 | `err.type === 'entity.parse.failed'` (body-parser) | 400 `VALIDATION_ERROR`, "malformed JSON body" |
| 4 | `err.type === 'entity.too.large'` | 400 `VALIDATION_ERROR`, "payload exceeds 1mb" |
| 5 | `typeof err.code === 'string' && err.code.startsWith('auth/')` | `firebaseErrorMap(err)` |
| 6 | `err.errno` or `err.code` in the MySQL table / connection codes | `mysqlErrorMap(err)` |
| 7 | otherwise | 500 `INTERNAL_ERROR`, message "internal server error" |

Logging: status ≥ 500 → `logger.error({ reqId, method, url, userId, code, message, stack })`; 4xx → `logger.warn` without stack (debug level includes `details`). In development (`!env.isProd`) the 500 envelope adds `details: { message: err.message, stack: err.stack.split('\n') }`; in production the body never contains internal messages, SQL or stacks. `res.headersSent` → delegate to `next(err)` (Express default) to avoid double responses. The handler never throws: its own failure is caught and a minimal hard-coded 500 envelope is written.

`ApiError` (utils/ApiError.js):

```js
export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; this.expose = true; }
  static validation(zodErrorOrMessage, part, details)     // 400 VALIDATION_ERROR (formats zod issues as { issues: [{ path: `${part}.${path}`, message }] }; part = params | query | body)
  static unauthorized(message, details)                   // 401 UNAUTHORIZED
  static notRegistered(firebaseUid)                       // 403 USER_NOT_REGISTERED
  static forbidden(reason, message)                       // 403 FORBIDDEN, details.reason
  static accountDisabled()                                // 403 ACCOUNT_DISABLED
  static notFound(resource, id)                           // 404 NOT_FOUND, details { resource, id }
  static conflict(message, details)                       // 409 CONFLICT
  static scheduleConflict(conflicts)                      // 409 SCHEDULE_CONFLICT
  static rateLimited(retryAfterSeconds)                   // 429 RATE_LIMITED, details { retryAfterSeconds } (register route only)
  static internal(message)                                // 500 INTERNAL_ERROR
  static unavailable(component)                           // 503 SERVICE_UNAVAILABLE
}
```

Rule: services never `throw new Error(...)` for expected situations and never construct `ApiError` with a code outside the catalogue — the static factories are the only constructors used, so `grep "ApiError\."` lists every failure path of a module.

---

## 8. Debuggability conveniences

- **Request id.** `requestId` middleware accepts an incoming `X-Request-Id` (if it matches `/^[A-Za-z0-9_-]{8,64}$/`) or generates `crypto.randomUUID()`; sets `req.id` and the response header on every response, including errors and 404s. The frontend can log it next to failed calls; the log line and the response share one id.
- **morgan format** (`middleware/httpLogger.js`): custom tokens `morgan.token('id', req => req.id)` and `morgan.token('user', req => req.user ? `${req.user.id}:${req.user.role}` : '-')`.
  - development: `:id :method :url :status :response-time ms :user` (colored `dev`-style, one line).
  - production: JSON line `{"t":":date[iso]","reqId":":id","method":":method","url":":url","status":":status","ms":":response-time","len":":res[content-length]","user":":user","ip":":remote-addr"}` so it is grep/jq-able. `GET /api/v1/health` is skipped in production (`skip`) to keep logs readable.
- **`GET /api/v1/health`** (public, no auth): runs `db.ping()` wrapped in `Promise.race` with a 2 s timeout. Up → `200 { success: true, data: { status: 'ok', db: 'up', firebaseProjectId, uptimeSeconds, version (package.json), timestamp } }` (`firebaseProjectId` comes from the service account so the frontend can warn about a project mismatch in dev). Down/timeout → `503 { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'database unreachable', details: { component: 'db' } } }`. It never checks Firebase (network call to Google on every probe is not acceptable); a Firebase misconfiguration is caught at startup instead (`firebase.js` initializes eagerly and `server.js` calls `auth.getUser('__startup_probe__')` expecting `auth/user-not-found` — any other error aborts startup).
- **Startup env validation** (`config/env.js`): a zod schema over `process.env` (`PORT` coerced int 1..65535, `NODE_ENV` enum, `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_NAME` required while `DB_PASSWORD` may be empty, `FIREBASE_SERVICE_ACCOUNT_PATH` required and the file it points to parsed and checked, `CORS_ORIGINS` → array, `APP_TIMEZONE` optional (default = machine time zone) and validated with `Intl.supportedValuesOf('timeZone')`, `ACADEMIC_YEAR_START_MONTH` int 1..12 default 8, `ALLOW_PUBLIC_REGISTRATION`/`DOCS_ENABLED` as `true|false`). On failure it prints one readable block and exits `1` before anything else loads:

  ```text
  ✖ Invalid environment configuration (.env):
    - DB_NAME: Required
    - FIREBASE_SERVICE_ACCOUNT_PATH: file not found (resolved to C:\dev\school-management-system\backend\firebase-service-account.json)
    - PORT: expected integer between 1 and 65535, received "abc"
  See .env.example for the full list.
  ```

  `server.js` also runs `db.ping()` before `listen` and exits with `✖ Cannot connect to MySQL at 127.0.0.1:3306 (ECONNREFUSED)` — so a broken setup fails in < 1 s with the cause, instead of on the first request.
- **Consistent `ApiError` usage.** Every expected failure is one of the static factories; every unexpected failure becomes a 500 with the request id in both the log and the header. Because `details.reason` strings are fixed identifiers (`not_class_subject_owner`, `class_not_visible`, `role_not_allowed`, `self_status_change`, `teacher_has_assignments`, `invalid_status_transition`, `no_active_enrollment`, `same_class`), the frontend can map them to messages and a tester can grep the backend for the exact origin.
- **Debug SQL.** `LOG_LEVEL=debug` makes `db.query()` log `{ reqId?, sql, params, ms, rows }` through `logger.debug` (params are shown, never interpolated). Off by default in production.
- **Deterministic seed.** `seed.js` (Firebase users + `users`/profile rows, idempotent, re-links `firebase_uid` by email) followed by `seed.sql` (everything else, ids resolved by natural keys) produces the same ids on a fresh database every run (`npm run db:reset` then `npm run db:seed`), so bug reports can say "student 12 in class 3" and everyone sees the same data. Demo accounts: `admin@school.test`, `admin2@school.test`, `teacher1..3@school.test`, `student1..8@school.test`, all with `SEED_PASSWORD`.

---

## 9. OpenAPI plan (`docs/openapi.yaml`, served at `/api/docs`)

- `openapi: 3.1.0`; `info.version` mirrors `package.json`; `servers: [{ url: /api/v1 }]` so paths in the file are written without the prefix (`/students/{id}`).
- **Tags** = modules, in the same order as §2: `auth, users, students, teachers, subjects, classes, class-subjects, enrollments, attendance, assessments, grades, schedules, announcements, dashboard, system`. Every operation has exactly one tag and an `operationId` = `<module>.<action>` (`attendance.putSheet`), which doubles as the controller function name — the spec and the code are greppable against each other.
- **`components.securitySchemes.bearerAuth`**: `type: http, scheme: bearer, bearerFormat: "Firebase ID token"`. Declared globally with `security: [{ bearerAuth: [] }]`; `POST /auth/register` and `GET /health` override with `security: []`.
- **`components.schemas`**: `Error` (the error envelope, `code` as an enum of the catalogue), `PaginationMeta`, `SuccessEnvelope` pattern expressed per response (`{ success: true, data: $ref }`), one schema per resource shape listed in §2 (`Account`, `Student`, `Teacher`, `Subject`, `Class`, `ClassSubject`, `Enrollment`, `AttendanceRecord`, `AttendanceSheet`, `AttendanceSummary`, `Assessment`, `Grade`, `GradeRoster`, `GradeSummaryRow`, `Schedule`, `Announcement`, `AdminDashboard`, `TeacherDashboard`, `StudentDashboard`, `Health`) and one `*Create` / `*Patch` schema per writable resource mirroring the zod rules (same enums, min/max, regex `pattern`).
- **`components.parameters`**: `Page`, `Limit`, `Search`, `SortOrder`, `IdPath`, `IdOrMePath`, plus one `SortBy<Resource>` enum parameter per list endpoint (whitelists are visible in the docs).
- **`components.responses`**: `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `ScheduleConflict`, `RateLimited` (referenced only by `POST /auth/register`), `ServiceUnavailable`, each `$ref: Error` with an example body. Every operation references the subset it can return — no operation lists a code it cannot produce.
- **Examples**: the eight bodies from §3 are included as `examples` on their operations.
- **Serving** (`config/swagger.js`): `yaml.parse(readFileSync('docs/openapi.yaml'))` once at startup (a syntax error in the yaml fails startup with the line number — the spec is part of the build); `swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: true } })` at `/api/docs`; raw spec at `GET /api/docs/openapi.json` for Postman/Insomnia import. The UI's "Authorize" button takes a Firebase ID token; `npm run token -- student1@school.test` (`scripts/get-token.js`, REST `signInWithPassword` with the public web API key) prints one for any demo account.
- **Consistency check** (a test in `tests/`, run by `npm test`): parses the yaml and compares the set of `METHOD path` in it with the Express router stack — cheap insurance that the docs stay complete.

---

## 10. Open questions / risks (all resolved — the decisions are recorded in the plan's Decisions log, §5)

| # | Question / risk | Recommendation |
|---|---|---|
| Q1 | **Public self-registration** creates real student accounts without approval and had no rate limit. | Resolved: keep it (the brief requires it) behind `ALLOW_PUBLIC_REGISTRATION` (default `true`), role hard-coded to `student`, strict body with no `role` key, and `express-rate-limit` on `POST /auth/register` only — 5 requests per 15 minutes per IP, 429 `RATE_LIMITED`, disabled when `NODE_ENV=test` (§7). The README notes that production would set the flag to `false` and use `POST /users`. |
| Q2 | **Deleting an assessment that has grades**: cascade or block with 409? | Resolved: the FK stays `ON DELETE RESTRICT` (A6) and `DELETE /assessments/:id` performs an explicit two-step delete — grades first, then the assessment — in one transaction, after the UI confirm that shows `gradedCount`. Same outcome as a cascade for the client; nothing is erased implicitly by the database. Everything else stays RESTRICT → 409. |
| Q3 | **Changing a user's role or email** after creation (profile rows, Firebase `updateUser({ email })`, two systems to keep consistent). | Resolved: role and email are immutable in v1 — deactivate the account and create a new one. No `PATCH /users/:id/email`; this removes the stale-role and two-system-consistency bug classes. |
| Q4 | **Homeroom teacher read scope** (visible = teaches OR homeroom) adds one `OR` to every teacher-scoped query. Drop it to simplify? | Resolved: keep homeroom visibility — it is one EXISTS fragment in `access.repository.js`, and a homeroom teacher who cannot see their own class's attendance is a realistic complaint from a reviewer. |
| Q5 | **Timezone for "today"**: server UTC vs school local day. Attendance dates and dashboard "today" differ by up to a day otherwise. | Resolved: `APP_TIMEZONE` env, default = the machine's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); "today", the ISO weekday and the current academic year (August rule, `ACADEMIC_YEAR_START_MONTH` default 8) all come from `utils/dates.js`. DATETIME stored as UTC, DATE as plain strings; clients always send attendance dates explicitly. |
| Q6 | **503 `SERVICE_UNAVAILABLE`** is an addition to the fixed catalogue (used by `/health` and DB connection errors). | Resolved: keep 503 `SERVICE_UNAVAILABLE` for `/health` and DB connection errors — a monitor must distinguish "DB down" from "code bug", and 500 for a health probe is misleading. It is part of the closed catalogue (§1.3) and of `ERROR_CODES` on both sides. |
| Q7 | **`POST /enrollments/bulk`** is the only bulk endpoint outside attendance/grades. Is it worth the extra code for a test project? | Resolved: include `POST /enrollments/bulk` — enrolling 30 students one by one is what a reviewer will try first, and the all-or-nothing transaction is 20 lines reusing the single-enroll checks. |
| Q8 | **Transfer between classes** as two calls (close the old enrollment, POST the new one) leaves a half-done state when the second call fails. | Resolved: added `POST /enrollments/transfer { studentId, classId }` (§2.9) — one transaction that closes the active row as `transferred` (`leftOn` = today) and inserts or re-opens the row for the new class (`enrolledOn` = today); 409 `no_active_enrollment` / `same_class`. `POST /enrollments` is not overloaded with hidden behaviour. |
