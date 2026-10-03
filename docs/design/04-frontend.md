> Part of the design set for the School Management System. The project contract is `docs/PROJECT_PLAN.md`; where this document and the plan disagree, the plan wins (see its Decisions log, section 5).

# 04 — Frontend Design: School Management System (React SPA)

Status: design spec for implementation. Companion to `01-free-tier-and-versions.md` (pinned versions), `03-api-and-rbac-design.md` (the API contract this UI consumes — resource shapes, error catalogue, RBAC matrix) and `05-risks-and-qa.md`. Where this document and `03` disagree, `03` wins and this document is wrong.

## 0. Stack and versions (pinned, from `01`)

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite ^8.3 + `@vitejs/plugin-react` ^6.1 | Node 24 (local 24.16). JS + JSX only, no TypeScript. |
| UI runtime | React ^19.3 / react-dom ^19.3 | |
| Routing | `react-router` ^8.4, **data mode** (`createBrowserRouter` + `<RouterProvider>`) | `RouterProvider` is imported from `react-router/dom`, everything else from `react-router`. **Do not install `react-router-dom`** (removed in v8). No framework mode, no `@react-router/dev`, no loaders for data — TanStack Query owns server state; the router owns only the URL. Fallback if tooling objects: `react-router` ^7.18 (same imports work). |
| Server state | `@tanstack/react-query` ^5.104 (+ `@tanstack/react-query-devtools`, dev only) | `isPending`/`isError` naming, `placeholderData: keepPreviousData` for lists. |
| Styling | `tailwindcss` ^4.3 + `@tailwindcss/vite` ^4.3 | No `tailwind.config.js`, no PostCSS config; `@import "tailwindcss"` + `@theme` tokens in `src/index.css`. |
| Auth | `firebase` ^12.19, modular (`firebase/app`, `firebase/auth`) — email/password only | Optional Auth Emulator in dev. |
| Forms | `react-hook-form` ^7.89 + `zod` ^4.6 + `@hookform/resolvers` ^5 | zod **4** syntax: `z.email()`, `z.iso.date()`, `.min(8, 'message')` shorthand still valid, `{ error }` instead of `{ message }`. Same major as the backend. |
| HTTP | Hand-written `fetch` wrapper `src/lib/apiClient.js` | Throws `ApiError`; no axios. |
| Icons | `lucide-react` (MIT) | Only icon dependency. |
| Dates | Native `Intl` + helpers in `src/utils/date.js` | No date library. API strings: `YYYY-MM-DD` dates, `HH:MM` (tolerate `HH:MM:SS`) times, ISO-8601 `Z` datetimes. |
| Lint/format | ESLint 9 flat config + Prettier 3 + `prettier-plugin-tailwindcss` | All free. |

### 0.1 Resource shapes the UI binds to (verbatim from `03` §2 — change there first)

- **Me** (`GET /auth/me`): `{ id, firebaseUid, email, firstName, lastName, phone, role: 'admin'|'teacher'|'student', isActive, studentId|null, teacherId|null, profile: StudentRow | TeacherRow | null, currentEnrollment?: {...}|null (students), createdAt }`.
- **User** (`/users`, no profile embedded): `{ id, email, firstName, lastName, phone, role, isActive, createdAt }`. Role and email are **immutable** after creation (`03` Q3); status via `PATCH /users/:id/status { isActive }`; an admin cannot change their own status (403).
- **Student**: `{ id, userId, studentNumber, firstName, lastName, email, phone, dateOfBirth, gender ('male'|'female'|'other'|null), address, guardianName, guardianPhone, admissionDate, isActive, currentEnrollment: { id, classId, className, gradeLevel, academicYear, status } | null }`. `admissionDate` is when the student joined the school; class membership lives in enrollments.
- **Teacher**: `{ id, userId, employeeNumber, firstName, lastName, email, phone, department, qualification, hireDate, isActive }`.
- **Subject**: `{ id, code, name, description, isActive }`. A retired subject (`isActive: false`) stays on existing classes but is hidden from new assignments.
- **Class**: `{ id, name, gradeLevel (1..12), academicYear ('YYYY-YYYY'), homeroomTeacher: { id, firstName, lastName } | null, studentCount }`. No capacity field; the name carries the stream ("Grade 10 - A").
- **ClassSubject** (= a teacher assignment; `teacherId` is NOT NULL — there is no "unassigned subject" state): `{ id, classId, className, academicYear, subjectId, subjectCode, subjectName, teacherId, teacher: { id, firstName, lastName } }`.
- **Enrollment**: `{ id, studentId, student: { id, studentNumber, firstName, lastName }, classId, class: { id, name, gradeLevel, academicYear }, status: 'active'|'completed'|'transferred'|'withdrawn', enrolledOn, leftOn|null }`. Transitions are one-way (`active → completed|withdrawn` via `PATCH /enrollments/:id { status }`; `leftOn` is set when a row closes). Transfer = `POST /enrollments/transfer { studentId, classId }` — one backend transaction that closes the active row as `transferred` and opens the new one; the UI never writes `transferred` itself.
- **Attendance sheet** (`GET/PUT /attendance/sheet`): roster of the class-subject's class with marks for one date; unmarked rows have `attendanceId/status/remarks = null`. Statuses `present|absent|late|excused`. Flat rows via `GET /attendance`; aggregates via `GET /attendance/summary` (`rate = (present + late) / total`).
- **Assessment**: `{ id, classSubjectId, classSubject: { classId, className, subjectId, subjectName, teacherId }, title, type: 'quiz'|'test'|'exam'|'assignment'|'project'|'other', maxScore (≤ 1000, 2 dp), term: 'term1'|'term2'|'term3', assessedOn ('YYYY-MM-DD', required), gradedCount, enrolledCount }`. `type` and `term` are the shared `ASSESSMENT_TYPES` / `TERMS` constants (labels "Term 1/2/3" in the UI).
- **Grades**: roster-with-scores `GET /assessments/:id/grades → { assessmentId, assessment, records: [{ studentId, studentNumber, firstName, lastName, gradeId, score, percentage, remarks, gradedBy, updatedAt }] }` (null when ungraded); `PUT /assessments/:id/grades { grades: [{ studentId, score, remarks? }] }` (1..200 rows, only rows that have a score); flat `GET /grades`; `GET /grades/summary` (points-weighted `percentage`, `groupBy=classSubject|student`); `DELETE /grades/:id`.
- **Schedule**: `{ id, classSubjectId, classSubject: { classId, className, academicYear, subjectId, subjectName, teacher }, dayOfWeek (1=Mon…7=Sun), startTime, endTime, room|null }`.
- **Announcement**: `{ id, author: { id, firstName, lastName, role }, title, body, audience: 'all'|'students'|'teachers', classId|null, className|null, publishedAt, expiresAt|null, status: 'active'|'scheduled'|'expired' }`. Teachers must set `classId` (a visible class); the `status` list filter is admin-only.
- **Dashboard** (`GET /dashboard`, no params): three shapes discriminated by `role` — see §2.6.
- **`me` alias**: wherever an id filter/param names the caller (`studentId`, `teacherId`, `authorId`, `/students/:id`, `/teachers/:id`) the string `me` is accepted. Omitting a scope filter already yields the caller's own scope; **sending a filter outside the caller's scope is a 403**, never a silent narrowing.
- **Lists**: `page` (≥1), `limit` (1..100, default 20 — >100 is a 400), `search`, `sortBy` (whitelisted per resource — unknown → 400), `sortOrder`; `meta = { page, limit, total, totalPages }`. Non-paginated reads (`/sheet`, `/summary`, `/dashboard`, `/:id`) have no `meta`.

### 0.2 Error contract (from `03` §1.3 — `details` is always an object when present)

| HTTP / code | `details` | Frontend handling |
|---|---|---|
| 400 `VALIDATION_ERROR` | `issues: [{ path: 'body.email', message }]` (zod) · `field` (FK / DB) · business keys: `invalidStudentIds`, `studentId, score, maxScore`, … | `applyServerErrors` maps `issues` + `field` to form fields; business keys → root alert with `message` |
| 401 `UNAUTHORIZED` (`details.reason`) | token missing/expired/invalid | one forced token refresh + retry, then sign out |
| 403 `USER_NOT_REGISTERED` (`details.firebaseUid`) | Firebase user with no `users` row (the token is authenticated; the account is not provisioned) | sign out + notice |
| 403 `ACCOUNT_DISABLED` | — | sign out + notice |
| 403 `FORBIDDEN` (`details.reason`: `role_not_allowed`, `not_class_subject_owner`, `class_not_visible`, …) | | toast; never sign out |
| 404 `NOT_FOUND` | | inline `NotFoundState` on detail pages; special case on `/register` (registration disabled) |
| 409 `CONFLICT` (`details.key` e.g. `users.email`, `subjects.code`, `class_subjects.uq_class_subject`; or `activeEnrollmentId`, `alreadyActive[]`, `maxExistingScore`; or `details.reason`: `no_active_enrollment`, `same_class`, `teacher_has_assignments`, `last_admin`) | | field error when `key` maps to a form field, else root alert / toast with the server message |
| 409 `SCHEDULE_CONFLICT` (`details.conflicts: [{ type: 'class'|'teacher'|'room', className, subjectName, dayOfWeek, startTime, endTime, room }]`) | | rendered as a conflict list inside the slot modal |
| 429 `RATE_LIMITED` (`details.retryAfterSeconds`) | public `POST /auth/register` (5 attempts per 15 minutes per IP) | root alert on the register form "Too many attempts. Try again in N minutes." (`N = Math.ceil(retryAfterSeconds / 60)`) |
| 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE` | | toast / `ErrorState`; `X-Request-Id` response header shown in dev |

The codes that force a sign-out live in one constant: `FORCE_SIGN_OUT_CODES = ['USER_NOT_REGISTERED', 'ACCOUNT_DISABLED']` (`src/constants/ui.js`). The full code list is the shared `ERROR_CODES` constant in `src/constants/shared.js` (eleven codes, byte-identical with the backend's copy).

---

## 1. Authentication flow

### 1.1 Principle

Firebase answers **"who are you?"** (identity, ID token). The backend answers **"what are you here?"** (role, `isActive`, student/teacher profile, current enrollment). The UI never trusts a role that did not come from `GET /auth/me`, never reads `firebaseUser.displayName`, and combines identity and profile in exactly one place: `AuthProvider`.

### 1.2 `AuthProvider` (src/app/providers/AuthProvider.jsx)

State exposed through context:

```
status:       'initializing' | 'anonymous' | 'resolving' | 'authenticated' | 'profile-error'
firebaseUser: User | null              // only used for the token
me:           MeDto | null             // GET /auth/me payload
role:         me?.role ?? null
authNotice:   { tone, message } | null // shown once on /login after a forced sign-out
```

Flow:

1. One `useEffect` subscribes to `onAuthStateChanged(auth, …)` and returns the unsubscribe.
   - `user === null` → `status='anonymous'`, `firebaseUser=null`, `queryClient.clear()` (drops every cached row of the previous user).
   - `user` present → `status='resolving'`, `firebaseUser=user`.
2. Profile query (TanStack, so any component can invalidate it):
   ```js
   const meQuery = useQuery({
     queryKey: authKeys.me(),                      // ['auth', 'me']
     queryFn: getMe,                               // api.get('/auth/me').then(r => r.data)
     enabled: !!firebaseUser,
     retry: false,                                 // 401/403 must not be retried; network retry is manual
     staleTime: 5 * 60_000,
     refetchOnWindowFocus: true,                   // picks up isActive/profile changes made by an admin
   });
   ```
3. Status derivation:
   - `isSuccess` → `status='authenticated'`, `me=data`. Defensive: `data.isActive === false` is treated like `ACCOUNT_DISABLED`.
   - `isError`:
     - `FORCE_SIGN_OUT_CODES.includes(error.code)` → `forceSignOut(messageFor(error.code))`:
       `USER_NOT_REGISTERED` → "Your account exists but is not registered in the school system. Contact the administrator."
       `ACCOUNT_DISABLED` → "Your account has been disabled. Contact the administrator."
     - `error.code === 'NETWORK_ERROR'` or `error.status >= 500` → `status='profile-error'` — **not** a sign-out. `SplashScreen` shows "Can't reach the server" + **Retry** (`meQuery.refetch()`) + **Sign out**.
     - any other 401 (`UNAUTHORIZED` after the client's own refresh retry) → `forceSignOut('Your session has expired. Please sign in again.')`.
   - `forceSignOut(message)` = `setAuthNotice({ tone: 'error', message })` → `signOut(auth)`; step 1 handles the rest. `LoginPage` renders `authNotice` and clears it on unmount.
4. Context API: `{ status, firebaseUser, me, role, logout, refreshMe }`.
   - `logout()` = `signOut(auth)` → listener clears the cache → guards redirect to `/login`. Toast "Signed out".
   - `refreshMe()` = `queryClient.invalidateQueries({ queryKey: authKeys.me() })` — called after `PATCH /auth/me` and after any 403.
5. `useAuth()` (`features/auth/hooks.js`) throws `Error('useAuth outside AuthProvider')` if misused.

Every data query in the app is mounted under `RequireAuth`, so `status === 'authenticated'` is guaranteed before any `useQuery` runs — no per-query `enabled: status === 'authenticated'` is needed, and `apiClient` throws `NO_SESSION` loudly if that invariant is ever broken.

### 1.3 Token handling

- `apiClient` awaits `auth.currentUser.getIdToken()` on every request. The SDK returns the cached token and transparently refreshes near expiry — no timers, no token in React state.
- On HTTP 401 whose code is not in `FORCE_SIGN_OUT_CODES`, `apiClient` retries **once** with `getIdToken(true)`. If the retry is also 401 it calls `signOut(auth)` and rethrows; `AuthProvider` redirects. Covers expiry, clock skew and `revokeRefreshTokens` after deactivation.
- Deactivation is enforced per request by the backend (`ACCOUNT_DISABLED`), so a deactivated user is signed out on their next click regardless of UI state.

### 1.4 Route guards (src/app/guards/)

Layout-route components rendering `<Outlet/>` or `<Navigate/>`:

| Guard | Behaviour |
|---|---|
| `RequireAuth` | `initializing`/`resolving` → `<SplashScreen/>`; `profile-error` → `<SplashScreen variant="error"/>` (Retry / Sign out); `anonymous` → `<Navigate to="/login" replace state={{ from: location }}/>`; `authenticated` → `<Outlet/>`. |
| `RequireRole roles={[...]}` | Nested under `RequireAuth`. `roles.includes(role)` → `<Outlet/>`, else `<Navigate to="/403" replace/>`. |
| `PublicOnly` | Wraps `/login`, `/register`, `/forgot-password`. `authenticated` → `<Navigate to={state?.from ?? roleHome(role)} replace/>` (only if `from` starts with `roleHome(role)`); `initializing`/`resolving` → `<SplashScreen/>` so the login form never flashes; `anonymous` → `<Outlet/>`. |

`roleHome(role)` (`src/utils/roles.js`) → `/admin` | `/teacher` | `/student`. The index route `/` is `<RoleRedirect/>` (inside `RequireAuth`): `<Navigate to={roleHome(role)} replace/>`.

Guards are layout routes, so every page under `/admin/*` is protected by construction — a new page cannot be added unguarded.

### 1.5 Login page (`/login`)

- Schema: `email: z.email('Enter a valid email')`, `password: z.string().min(1, 'Password is required')`.
- Submit → `signInWithEmailAndPassword(auth, email, password)`. Nothing else: `onAuthStateChanged` → `/auth/me` → `PublicOnly` redirect does the navigation.
- Firebase error map (`features/auth/firebaseErrors.js`):
  - `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`, `auth/invalid-email` → "Incorrect email or password." (never reveal which)
  - `auth/too-many-requests` → "Too many attempts. Try again later or reset your password."
  - `auth/user-disabled` → "This account has been disabled."
  - `auth/network-request-failed` → "Network error. Check your connection."
  - `auth/operation-not-allowed` → "Email/password sign-in is not enabled for this Firebase project." (setup bug — say so)
  - default → "Sign-in failed. Please try again." + `console.error(code)`.
- Renders `authNotice` (forced sign-out) above the form. Links: "Forgot password?", "New student? Create an account" (hidden when the register probe says registration is closed — see 1.6).
- Loading: submit button spinner + disabled; inputs disabled.

### 1.6 Register page (`/register`) — students only

1. Fields (exactly the `POST /auth/register` body): firstName, lastName, email, password (min 8, max 128), confirmPassword (client-only, `refine` equal → "Passwords don't match"), and an optional collapsible "Student details": phone, dateOfBirth (`z.iso.date()`, past), gender (select), address, guardianName, guardianPhone. `studentNumber` is generated by the backend.
2. `POST /auth/register` with `auth: false` (no token). Backend creates the Firebase user + `users` + `students` rows.
3. On 201 → `signInWithEmailAndPassword(auth, email, password)` → normal flow lands on `/student` (not enrolled yet — the student dashboard handles `currentEnrollment === null`). Toast "Welcome, {firstName}!".
4. Errors: `409 CONFLICT` with `details.key === 'users.email'` → `setError('email', 'An account with this email already exists.')`; `VALIDATION_ERROR` → `applyServerErrors`; `429 RATE_LIMITED` → root alert "Too many attempts. Try again in N minutes." with `N = Math.ceil(details.retryAfterSeconds / 60)` (the form stays filled; submit re-enabled after the alert is dismissed); `404 NOT_FOUND` → the page swaps to a `RegistrationClosed` state ("Self-registration is disabled. Ask an administrator to create your account.") and `/login` hides the register link (the probe is just this same 404 remembered in a module-level flag after the first attempt — no extra endpoint).
5. If step 3 fails after step 2 succeeded (network) → navigate to `/login` with notice "Account created. Please sign in."

### 1.7 Forgot password (`/forgot-password`)

- Single email field → `sendPasswordResetEmail(auth, email)`.
- Always the same success state: "If an account exists for {email}, a reset link has been sent." Firebase email-enumeration protection is on by default for new projects; if it is off and `auth/user-not-found` is thrown, it is swallowed and the same message shown. Surfaced errors: `auth/invalid-email`, `auth/too-many-requests`, `auth/network-request-failed`.
- Link back to login.

### 1.8 Logout

Topbar user menu → "Sign out" → `logout()`. No confirmation (non-destructive).

### 1.9 Sequence (happy path and failures)

```
App mount ─► AuthProvider: initializing ─► onAuthStateChanged(user)
   user=null ──► anonymous ──► RequireAuth → /login
   user      ──► resolving ──► GET /auth/me (Authorization: Bearer <idToken>)
                      200 ──► authenticated ──► RoleRedirect → /admin | /teacher | /student
                      401 UNAUTHORIZED ──► getIdToken(true) + retry ──► still 401 → signOut + notice
                      403 USER_NOT_REGISTERED ──► signOut + notice → /login
                      403 ACCOUNT_DISABLED    ──► signOut + notice → /login
                      network / 5xx           ──► profile-error splash (Retry / Sign out)
```

---
## 2. Route map

Router: `createBrowserRouter` in `src/app/router.jsx`, rendered by `<RouterProvider>` from `react-router/dom`. Guards and `AppShell` are layout routes; pages are leaf routes, `React.lazy` + `Suspense` with a `PageSkeleton` fallback (one chunk per page). A router-level `errorElement` (`RouteErrorPage`) catches render errors and failed lazy chunks ("A new version is available — Reload").

### 2.1 Public (`PublicOnly` → `AuthLayout` centred card)

| Path | Page component | Purpose |
|---|---|---|
| `/login` | `LoginPage` | Email/password sign-in; shows forced-sign-out notice. |
| `/register` | `RegisterPage` | Student self-registration → auto sign-in; "registration closed" state on 404. |
| `/forgot-password` | `ForgotPasswordPage` | Firebase password-reset email. |

### 2.2 Shared (`RequireAuth` → `AppShell`, any role)

| Path | Page component | Purpose |
|---|---|---|
| `/` | `RoleRedirect` | `<Navigate>` to `/admin`, `/teacher` or `/student`. |
| `/profile` | `ProfilePage` | Account card (name, email, role, member since) + role section (student: student number, DOB, admission date, class, guardian; teacher: employee number, department, qualification, hire date) + **editable contact form** → `PATCH /auth/me` (phone for everyone; address/guardian for students) + "Send me a password reset email". |
| `/403` | `ForbiddenPage` | "You don't have access to this page" + "Go to my dashboard" (`roleHome`). |
| `*` | `NotFoundPage` | 404; rendered inside the shell when authenticated, bare otherwise. |

### 2.3 Admin area — `/admin` (`RequireRole roles={['admin']}`) — 13 pages

| Path | Page component | Purpose |
|---|---|---|
| `/admin` | `AdminDashboardPage` | School-wide counts, today's attendance, enrollment by grade, upcoming assessments, recent announcements, quick-create. |
| `/admin/users` | `UsersListPage` | All accounts; role + status filters, search; create-user modal (any role); edit name/phone; activate/deactivate. |
| `/admin/students` | `StudentsListPage` | Students; class / grade / enrollment filters, search; Enroll / Transfer action; link to detail. |
| `/admin/students/:studentId` | `StudentDetailPage` | Tabs: Profile (edit), Enrollments (history, withdraw/complete, enroll), Attendance (summary + records), Grades (per subject). |
| `/admin/teachers` | `TeachersListPage` | Teachers; department / status filters, search; create-teacher modal; link to detail. |
| `/admin/teachers/:teacherId` | `TeacherDetailPage` | Profile (edit) + Assignments (class-subjects taught, homeroom classes) + weekly timetable. |
| `/admin/subjects` | `SubjectsPage` | Subject CRUD (modal), delete with confirm (409 when in use), retire / reactivate for subjects that are in use. |
| `/admin/classes` | `ClassesListPage` | Classes; academic-year + grade filters, search; create/edit modal (homeroom teacher). |
| `/admin/classes/:classId` | `ClassDetailPage` | Tabs: **Subjects & Teachers** (add subject with its teacher, change teacher, remove), **Students** (roster, enroll many, withdraw), **Schedule** (weekly timetable, add/edit/delete slots). |
| `/admin/attendance` | `AttendanceMarkPage` | Class → class-subject → date → sheet (roster + marks) → Save. Admin can pick any class. |
| `/admin/grades` | `AssessmentsPage` | Class → class-subject → assessments; create/edit/delete. |
| `/admin/grades/assessments/:assessmentId` | `GradeSheetPage` | Roster-with-scores → enter/clear scores → Save. |
| `/admin/announcements` | `AnnouncementsPage` | All announcements incl. scheduled/expired (status filter); create/edit/delete with audience + optional class + publish/expiry dates. |

### 2.4 Teacher area — `/teacher` (`RequireRole roles={['teacher']}`) — 8 pages

| Path | Page component | Purpose |
|---|---|---|
| `/teacher` | `TeacherDashboardPage` | Today's periods with "Mark attendance" / "Marked", sessions-marked counter, pending grading, my classes, announcements. |
| `/teacher/classes` | `MyClassesPage` | Two groups: **Teaching** (own class-subjects) and **Homeroom** (classes where I am homeroom teacher — read-only visibility). |
| `/teacher/classes/:classSubjectId` | `ClassSubjectPage` | Roster, this subject's weekly slots, attendance rate per student, quick actions. |
| `/teacher/schedule` | `TeacherSchedulePage` | Weekly grid of own slots (`teacherId=me`), today highlighted. |
| `/teacher/attendance` | `AttendanceMarkPage` | Own class-subject → date → sheet → Save (`?classSubjectId=&date=` prefilled from the dashboard). |
| `/teacher/grades` | `AssessmentsPage` | Own class-subject → assessments; create/edit/delete own. |
| `/teacher/grades/assessments/:assessmentId` | `GradeSheetPage` | Grade sheet for an owned assessment. |
| `/teacher/announcements` | `AnnouncementsPage` | Announcements visible to me (+ everything I authored) and create for one of my visible classes (`classId` required). |

`AttendanceMarkPage`, `AssessmentsPage`, `GradeSheetPage`, `AnnouncementsPage` are **one component each**, mounted on two routes; they read `role` from `useAuth()` to choose the class-subject source and which actions render. No duplicated pages.

### 2.5 Student area — `/student` (`RequireRole roles={['student']}`) — 6 pages

| Path | Page component | Purpose |
|---|---|---|
| `/student` | `StudentDashboardPage` | Identity hero (class, homeroom teacher), attendance ring, today's timetable, grade summary per subject, recent grades, upcoming assessments, announcements. |
| `/student/class` | `MyClassPage` | Current class card + subjects with teachers; `NotEnrolledState` when no active enrollment. |
| `/student/schedule` | `StudentSchedulePage` | Weekly grid of the class timetable. |
| `/student/attendance` | `StudentAttendancePage` | Summary tiles (`/attendance/summary`) + records list with date-range / subject / status filters. |
| `/student/grades` | `StudentGradesPage` | Per subject: points-weighted percentage (`/grades/summary`) + assessment rows (`/grades`), term filter. |
| `/student/announcements` | `StudentAnnouncementsPage` | Read-only feed (backend already scopes to audience + my class). |

Page count: public 3 · shared 4 (`RoleRedirect`, `Profile`, `403`, `404`) · admin 13 · teacher 8 · student 6 → **34 route entries, 30 distinct page components** (4 shared by admin and teacher).

### 2.6 The three dashboards are different products, not three skins

Each binds to its `GET /dashboard` payload (`03` §2.14) one-to-one — no client-side aggregation.

| | Admin — "Is the school running?" | Teacher — "What do I do today?" | Student — "How am I doing?" |
|---|---|---|---|
| Primary block | **6 KPI tiles** from `counts` (students, teachers, classes, subjects, active enrollments, unenrolled students — the last one amber when > 0, links to Students filtered `hasActiveEnrollment=false`) | **Today timeline** from `todaySchedule`: vertical list, each period `08:00–09:00 · Grade 7 - A · Biology · B-204` with chip `Marked` (green) or button `Mark now` → `/teacher/attendance?classSubjectId=&date=today`; current period highlighted | **Identity hero**: initials, name, `studentNumber`, class badge, academic year, homeroom teacher — or `NotEnrolledState` |
| Second block | **Attendance today** from `attendanceToday`: rate ring + present/absent/late/excused counts | **Progress strip** from `attendanceToday`: "2 of 4 sessions marked" | **Attendance ring** from `attendanceSummary` (rate; ≥ 0.90 green, ≥ 0.75 amber, else red; percentage text always shown) |
| Third block | **Enrollment by grade** from `enrollmentsByGrade`: horizontal CSS bars (no chart lib) | **Pending grading** from `pendingGrading`: `Unit 2 Exam · Grade 7 - A · Biology · 20/32 graded` → grade sheet | **Grade summary** from `gradeSummary`: one row per subject with percentage bar |
| Lists | `upcomingAssessments` (next 7 days) · `recentAnnouncements` | **My classes** chips from `classSubjects` (+ `homeroomClasses` group) · `recentAnnouncements` | `todaySchedule` mini-timetable · `recentGrades` (5) · `upcomingAssessments` · `recentAnnouncements` |
| Actions | Quick-create: user, class, announcement (same modals as the list pages) · "API docs" | Mark attendance per period · "Create assessment" | none — read-only links to full pages |

### 2.7 Navigation per role (`src/components/layout/navConfig.js`)

```js
export const NAV = {
  admin: [
    ['Dashboard', '/admin', LayoutDashboard], ['Users', '/admin/users', Users], ['Students', '/admin/students', GraduationCap],
    ['Teachers', '/admin/teachers', BookUser], ['Subjects', '/admin/subjects', BookOpen], ['Classes', '/admin/classes', School],
    ['Attendance', '/admin/attendance', ClipboardCheck], ['Grades', '/admin/grades', Award], ['Announcements', '/admin/announcements', Megaphone],
  ],
  teacher: [
    ['Dashboard', '/teacher', LayoutDashboard], ['My classes', '/teacher/classes', School], ['Schedule', '/teacher/schedule', CalendarDays],
    ['Attendance', '/teacher/attendance', ClipboardCheck], ['Grades', '/teacher/grades', Award], ['Announcements', '/teacher/announcements', Megaphone],
  ],
  student: [
    ['Dashboard', '/student', LayoutDashboard], ['My class', '/student/class', School], ['Schedule', '/student/schedule', CalendarDays],
    ['Attendance', '/student/attendance', ClipboardCheck], ['Grades', '/student/grades', Award], ['Announcements', '/student/announcements', Megaphone],
  ],
};
```
Sidebar footer (all roles): **API docs** (external link to `VITE_API_DOCS_URL`, `target="_blank" rel="noreferrer"`), Profile, Sign out. The sidebar renders `NAV[role]` only; RBAC is still enforced by `RequireRole` when a URL is typed by hand, and by the backend when a request is forged.

---
## 3. Per-feature UX spec

### 3.0 Conventions that apply to every page (implemented once, in shared components)

- **Page header**: `<PageHeader title description actions/>` — `h1`, optional description, right-aligned primary action(s); sets `document.title`. Breadcrumb only on detail pages (`Classes / Grade 7 - A`).
- **Loading**: lists → `DataTable` shows 8 skeleton rows on first load (`isPending`); refetches keep the old rows dimmed (`isFetching`). Detail pages → `PageSkeleton`. Buttons → inner spinner, `disabled`, `aria-busy`.
- **Error**: first-load query error → `<ErrorState title="Couldn't load students" message={error.message} onRetry={refetch}/>` in place of content. Background refetch error → toast (via `QueryCache.onError`). Mutation error → toast `error.message`, except `VALIDATION_ERROR`/field-mapped `CONFLICT` which render inline in the form.
- **Empty**: `<EmptyState icon title description action/>` in two flavours chosen by the page: *nothing exists* ("No students yet" + primary action) when `meta.total === 0 && !hasActiveFilters`; otherwise *no match* ("No students match your filters" + "Clear filters").
- **Search**: `SearchInput`, debounced 350 ms, writes `search` to the URL, resets `page`. Placeholder names the searched columns, copied from `03` per endpoint ("Search name, student number, email").
- **Filters**: `Select`s bound to URL params; "Clear filters" appears when any is active. Filter names are the API's filter names, verbatim.
- **Sorting**: header click sets `sortBy`/`sortOrder` from the resource's whitelist (`03` §2); when the user has not sorted, `sortBy` is omitted and the backend default applies. `aria-sort` on `<th>`.
- **Pagination**: "Showing 21–40 of 132", Prev/Next, ≤ 7 page buttons, limit select 10/20/50 (never above the API's 100).
- **Forms**: `react-hook-form` + `zodResolver`; `<FormField label hint error required>` wraps `Input/Select/Textarea`. Submit disabled while `isSubmitting`; server errors via `applyServerErrors`. Client zod schemas mirror `03` §4 (same lengths; regexes and enums imported from `constants/shared.js`, which is byte-identical with the backend's copy) so the server rarely gets to complain.
- **Modals**: forms live in `Modal` (native `<dialog>`). Title is the verb + noun ("Create user", "Edit subject"). Closing a dirty form with > 3 fields asks "Discard changes?".
- **Destructive actions**: always `ConfirmDialog` naming the object and the consequence; danger button labelled with the verb. Backend 409 on a blocked delete → toast with the server message, row stays.
- **Toasts**: success toasts name the object ("Liam Cruz enrolled in Grade 7 - A"); error toasts show `error.message`, with `[code] · request <X-Request-Id>` appended in dev. 4 s / 8 s auto-dismiss; `role="status"` / `role="alert"`.
- **Hidden vs disabled**: actions a role can *never* perform are not rendered (RBAC matrix `03` §5 is the source). Actions allowed but currently impossible are rendered disabled with a tooltip ("You can view this sheet but only its teacher can save it").
- **Validation copy**: full sentences, no field-name echo ("Enter a valid email"). Shared zod pieces in `src/lib/validators.js`: `email`, `password`, `name`, `phone`, `dateYMD`, `timeHM`, `academicYear`, `studentNumber`, `employeeNumber`, `subjectCode`, `positiveInt` — the regexes (`DATE_REGEX`, `TIME_REGEX`, `ACADEMIC_YEAR_REGEX`, `STUDENT_NUMBER_REGEX`, `EMPLOYEE_NUMBER_REGEX`, `SUBJECT_CODE_REGEX`) and `PASSWORD_MIN_LENGTH` come from `constants/shared.js`, so they are the backend's by construction.

### 3.1 Admin

#### 3.1.1 AdminDashboardPage — as §2.6. Each KPI tile links to its list; "Unenrolled students" links to `/admin/students?hasActiveEnrollment=false`. Quick-create opens `UserFormModal`, `ClassFormModal`, `AnnouncementFormModal` — the same components the list pages use.

#### 3.1.2 UsersListPage (`/admin/users`)
- Columns: Name (sort `lastName`), Email (sort), Role (`RoleBadge`: admin violet, teacher blue, student green), Status (`Active`/`Disabled`), Created (sort `createdAt`), Actions. Backend default sort `lastName asc`.
- Search: first name, last name, email. Filters: `role`, `isActive` (`true`/`false`).
- Header: **Create user** → `UserFormModal` (create mode). Body = `POST /users` discriminated on role:
  - common: firstName, lastName, email, temporary password (min 8; hint "The user can change it via Forgot password"), phone?, role (select; locked when opened from Students/Teachers pages).
  - `role==='student'` → `profile`: studentNumber? (hint "Leave empty to auto-generate (format STU-YYYY-NNNN)", validated with `STUDENT_NUMBER_REGEX` from `constants/shared.js`), dateOfBirth?, gender?, address?, guardianName?, guardianPhone?, admissionDate? (backend defaults to today). Enrolling into a class is a **separate** step (students list → Enroll), not part of account creation.
  - `role==='teacher'` → `profile`: employeeNumber? (hint "Leave empty to auto-generate (format EMP-YYYY-NNNN)", `EMPLOYEE_NUMBER_REGEX`), department?, qualification?, hireDate? (backend defaults to today).
  - `role==='admin'` → no profile section (and the key is not sent — backend forbids it).
  - Errors: `409 CONFLICT key=users.email` → email field; `key` ending in `student_number`/`employee_number` → that field.
- Edit (row action) → same modal in edit mode with only firstName, lastName, phone (`PATCH /users/:id`). Email and role are shown read-only with hint "Email and role can't be changed; deactivate and create a new account instead" (`03` Q3).
- **Deactivate / Activate** (row action) → confirm ("Deactivate Ana Reyes? She is signed out on her next request and can't sign in until reactivated. A teacher with current class assignments and the last administrator can't be deactivated.") → `PATCH /users/:id/status { isActive }`. Two server-side refusals (409) surface as a root alert in the dialog / toast with the server message: `details.reason === 'teacher_has_assignments'` ("Reassign this teacher's subjects first" — link to the teacher's Assignments) and `details.reason === 'last_admin'` ("You can't deactivate the last administrator"). The row for the signed-in admin has the button disabled (tooltip "You can't change your own status"; backend also returns 403 `self_status_change`). No delete anywhere.

#### 3.1.3 StudentsListPage (`/admin/students`)
- Columns: Student no (sort `studentNumber`), Name (sort `lastName`, link to detail), Email, Class (`currentEnrollment.className` badge or gray "Not enrolled"), Guardian phone, Status (`isActive`), Actions. Default `lastName asc`.
- Search: first name, last name, student number, email. Filters: `classId` (`ClassSelect`), `gradeLevel`, `hasActiveEnrollment` (`true`/`false`), `isActive`.
- Header: **Add student** → `UserFormModal lockedRole="student"`.
- Row action: **Enroll** (when `currentEnrollment` is null) → `EnrollStudentModal` → `POST /enrollments { studentId, classId }`; `409 details.activeEnrollmentId` (race) → root alert "This student is already enrolled; refresh". **Transfer** (when enrolled) → same modal with the current class shown; confirm copy "Liam will be transferred from Grade 7 - A to Grade 7 - B." → `useTransferStudent` is a single mutation, `POST /enrollments/transfer { studentId, classId }` — the backend closes the old enrollment as `transferred` and opens the new one in one transaction, so there is no half-done state to recover from. `409 CONFLICT` with `details.reason === 'no_active_enrollment'` (the student was withdrawn meanwhile) or `'same_class'` → root alert with the server message. Success toast "Liam Cruz transferred to Grade 7 - B".
- `ClassSelect` shows `name · academicYear · studentCount students`.

#### 3.1.4 StudentDetailPage (`/admin/students/:studentId`)
Header: name, student number, class badge, status; actions **Edit profile**, **Enroll/Transfer**. Tabs via `?tab=`:
- **Profile**: `StudentProfileForm` → `PATCH /students/:id` (firstName, lastName, phone, studentNumber, dateOfBirth, gender, address, guardianName, guardianPhone, admissionDate). One call — the backend updates `users` + `students`.
- **Enrollments**: `EnrollmentHistoryTable` (`GET /enrollments?studentId=`): class, year, status badge (`active` green, `completed` blue, `transferred` gray, `withdrawn` amber), since (`enrolledOn`), left (`leftOn`, "—" while active). Row actions on `active`: **Withdraw** (`PATCH /enrollments/:id { status: 'withdrawn' }`) and **Mark completed** (`PATCH /enrollments/:id { status: 'completed' }`), both behind a confirm. Nothing on closed rows (transitions are one-way; `transferred` rows are written only by `POST /enrollments/transfer`).
- **Attendance**: `AttendanceSummaryCards` (`GET /attendance/summary?studentId=`) + `AttendanceList` (`GET /attendance?studentId=` with date range/status filters) — the same components as the student's own page.
- **Grades**: `GradesBySubject` (`GET /grades/summary?studentId=` + `GET /grades?studentId=`) — same component as the student's own page.
- API 404 → `NotFoundState` with "Back to students".

#### 3.1.5 TeachersListPage / TeacherDetailPage
- List: Employee no (sort), Name (sort `lastName`), Email, Department (sort), Hire date (sort), Status, Actions. Search: name, employee number, department. Filters: `department` (free text → use search), `isActive`.
- Header: **Add teacher** → `UserFormModal lockedRole="teacher"`.
- Detail: `TeacherProfileForm` → `PATCH /teachers/:id` (firstName, lastName, phone, employeeNumber, department, qualification?, hireDate); **Assignments** (`GET /class-subjects?teacherId=`): class, subject, academic year → link to class detail; **Homeroom of** (`GET /classes?homeroomTeacherId=`); **Timetable** (`WeeklyTimetable` with `GET /schedules?teacherId=`).

#### 3.1.6 SubjectsPage (`/admin/subjects`)
- Columns: Code (sort, default `code asc`), Name (sort), Description (truncated), Status (`Active` / `Retired`), Actions. Search: code, name. Filter: `isActive` (`true`/`false`; no filter shows both).
- `SubjectFormModal`: code (`SUBJECT_CODE_REGEX` `^[A-Z0-9-]{2,20}$`, auto-uppercased on blur), name (1..100), description (≤ 1000). `409 key=subjects.code` → code field "A subject with this code already exists".
- Delete → confirm; `409 CONFLICT` "in use" → toast with the server message ("Retire it instead"), row stays.
- **Retire / Reactivate** (row action) → confirm ("Retire Biology? It stays on the classes that already have it but can't be added to new ones.") → `PATCH /subjects/:id { isActive }`. This is the path for subjects that cannot be deleted because they are in use. `SubjectSelect` (used by the add-subject modal) lists active subjects only, so a retired subject disappears from new assignments while its history stays intact.

#### 3.1.7 ClassesListPage (`/admin/classes`)
- Columns: Name (sort), Grade (sort `gradeLevel`), Academic year (sort), Homeroom teacher, Students (`studentCount`), Actions (View, Edit, Delete). Default `academicYear desc, name asc` (backend).
- Filters: `academicYear` (options from the `academicYearOptions()` helper in `constants/ui.js`, a few years around the current one), `gradeLevel` (`GRADE_LEVELS`, 1–12). Search: name.
- `ClassFormModal`: name (1..100, e.g. "Grade 10 - A" — the name carries the stream letter), gradeLevel (select, 1–12), academicYear (`YYYY-YYYY`, consecutive — same refine as backend), homeroomTeacherId? (`TeacherSelect`, searchable, active teachers only, clearable). `409 (name, academicYear)` → name field "A class with this name already exists for that year". Delete confirm; 409 when referenced → toast.

#### 3.1.8 ClassDetailPage (`/admin/classes/:classId`)
Header: name, year, grade, homeroom teacher, `studentCount` students; actions Edit, Delete. Tabs `?tab=subjects|students|schedule`:

- **Subjects & Teachers** (`ClassSubjectsTab`, data `GET /class-subjects?classId=`) — **the teacher-assignment UI**. A class-subject *is* an assignment, so there is no unassigned state:
  - Table: Subject (`subjectCode · subjectName`), Teacher, Weekly periods (count from `GET /schedules?classId=` grouped by `classSubjectId`), Actions.
  - **Add subject** → `AddClassSubjectModal`: subject (`SubjectSelect`, active subjects only, excludes subjects already in the class) + teacher (`TeacherSelect`, active only) → `POST /class-subjects { classId, subjectId, teacherId }`. `409 key=class_subjects.uq_class_subject` → subject field "This subject is already in the class". Inactive teacher 400 → teacher field.
  - **Change teacher** (row) → `ChangeTeacherModal` (`TeacherSelect`, current pre-selected) → `PATCH /class-subjects/:id { teacherId }`. Attendance/grades history stays with the class-subject.
  - **Remove** (row) → confirm ("Remove Biology from Grade 7 - A? This fails if attendance, assessments or schedule slots exist for it.") → `DELETE /class-subjects/:id`; 409 → toast with server message.
- **Students** (`ClassStudentsTab`, data `GET /students?classId=`): roster table (student no, name, guardian phone, status) with search; **Enroll students** → `EnrollStudentsModal`: multi-select fed by `GET /students?hasActiveEnrollment=false&search=` (checkbox list, selected count, max 200) → `POST /enrollments/bulk { classId, studentIds }` (all-or-nothing). `409 details.alreadyActive[]` → root alert listing the names (the modal still has them in memory) with "Deselect them and retry". Row action **Withdraw** → confirm ("Withdraw Liam Cruz from Grade 7 - A? The enrollment is closed today and kept in the history.") → `PATCH /enrollments/:id { status:'withdrawn' }` (the enrollment id comes from `GET /enrollments?classId=&status=active`, fetched alongside). Moving a student to another class is **Transfer** on the Students list, not withdraw + enroll.
- **Schedule** (`ClassScheduleTab`): `WeeklyTimetable` (Mon–Fri; "Show weekend" toggle auto-on if any slot has day 6/7) with slots coloured per subject; click a slot → edit; **Add slot** → `ScheduleSlotModal`: classSubject (this class's subjects, label `subjectName · teacher`), dayOfWeek (1–7 labels), startTime/endTime (`<input type="time" step="300">`, zod `timeHM`, refine `endTime > startTime` → "End time must be after start time" — string compare is correct for zero-padded `HH:MM`), room? (≤ 50). `POST /schedules` / `PATCH /schedules/:id`. **`409 SCHEDULE_CONFLICT`** keeps the modal open and renders `details.conflicts` as a list: `Teacher · Grade 8 - B · Mathematics · Tue 08:00–09:00 · Room B-204` (type badge per row). Delete slot → confirm → `DELETE /schedules/:id`.

#### 3.1.9 AttendanceMarkPage (`/admin/attendance`, `/teacher/attendance`)
- `ClassSubjectSelectorBar` writes `classId`, `classSubjectId`, `date` to the URL:
  - Admin: `ClassSelect` → `ClassSubjectSelect` (`GET /class-subjects?classId=`, label `subjectName · teacher`). Teacher: one `ClassSubjectSelect` fed by `GET /class-subjects` with no filter (= visible: taught + homeroom), grouped "Teaching" / "Homeroom", labels `className · subjectName`.
  - Date: `<input type="date" max={todayYMD()}>`, default today. Future dates are rejected client-side ("Attendance can't be marked for a future date") and by the backend (400).
- `AttendanceSheet` (`GET /attendance/sheet?classSubjectId=&date=` — roster + marks in one call; `enabled` only when both are set):
  - Local draft `{ [studentId]: { status, remarks } }` initialised from the sheet; unmarked rows default to `present` (hint under the toolbar: "Unmarked students are saved as Present"). Row: initials, name, student number, `RadioGroup` of P/A/L/E pills (real `<input type="radio" name={studentId}>`, letter + text + colour), remarks input (shown when status ≠ present, ≤ 255).
  - Toolbar: "Mark all present", counters `28 present · 2 absent · 1 late · 1 excused`, **Save attendance** (disabled until the draft differs from the loaded sheet).
  - Save → `PUT /attendance/sheet { classSubjectId, date, records:[{ studentId, status, remarks }] }` (the sheet field is `date`, the same name as the `GET /attendance/sheet?date=` query; flat records from `GET /attendance` keep `attendanceDate`) — **every roster row is sent** (the sheet is the unit of truth) → toast "Attendance saved · Grade 7 - A · Biology · 14 Mar 2025" → invalidate `attendanceKeys.all`, `dashboardKeys.all`. Returned sheet replaces the draft.
  - Banner when any row has `attendanceId`: "Already marked by Ana Reyes (updated 09:12). Saving overwrites it." `400 details.invalidStudentIds` (roster changed meanwhile) → root alert + "Reload sheet".
  - **Visible-but-not-owned** (teacher viewing a homeroom class's subject they don't teach: `classSubject.teacherId !== me.teacherId`): sheet renders read-only, Save disabled with tooltip "Only the subject's teacher can save attendance". Admin always may save.
  - Empty: nothing selected → `EmptyState "Pick a class and subject"`; empty roster → "No students enrolled in this class".
  - Navigation away with a dirty draft → `useUnsavedChangesBlocker` confirm.

#### 3.1.10 AssessmentsPage (`/admin/grades`, `/teacher/grades`)
- Same `ClassSubjectSelectorBar` (no date). URL `classSubjectId`.
- `AssessmentsTable` (`GET /assessments?classSubjectId=`): Title (sort), Type badge (sort; label from `ASSESSMENT_TYPES`), Term (label "Term 1/2/3" from `TERMS`), Date (sort `assessedOn`, default desc), Max score, Graded `gradedCount/enrolledCount` (amber when incomplete), Actions (Open grade sheet, Edit, Delete). Filters: `term` (select built from `TERMS`), `type` (select built from `ASSESSMENT_TYPES`).
- **Create assessment** → `AssessmentFormModal`: title (1..150), type (select from the shared `ASSESSMENT_TYPES`: `quiz|test|exam|assignment|project|other`), term (select from the shared `TERMS`: `term1|term2|term3`, labels "Term 1/2/3" — never free text), maxScore (number > 0, ≤ 1000, step 0.01, default 100), assessedOn (`<input type="date">`, required, form default today). `POST /assessments`. `409 key=assessments.uq_class_subject_term_title` → title field "An assessment with this title already exists for this term". Edit = same modal minus classSubjectId → `PATCH`; `409 details.maxExistingScore` → maxScore field "A recorded score of 45 is higher than this max".
- Delete → confirm "Deleting removes its 20 recorded grades" (uses `gradedCount`; backend cascades) → `DELETE /assessments/:id`.
- Teacher sees create/edit/delete only for class-subjects they own (`classSubject.teacherId === me.teacherId`); homeroom-visible ones are read-only.

#### 3.1.11 GradeSheetPage (`/admin/grades/assessments/:id`, `/teacher/…`)
- Header from `GET /assessments/:id/grades`: title, `className · subjectName`, type, term, date, max score; **Back** keeps `classSubjectId` in the URL.
- `GradeSheet`: rows from `records` — name, student number, `<input type="number" inputmode="decimal" min=0 max={maxScore} step="0.01">`, remarks (≤ 255), current `percentage`, `gradedBy`. Live validation "Score must be between 0 and {maxScore}". Enter moves focus to the next score input (one `onKeyDown`).
- **Save grades** → `PUT /assessments/:id/grades { grades }` with **only rows that have a score** (blank = still ungraded; the API requires `score` per row and ≥ 1 row). Disabled until dirty or when no row is filled. `400 { studentId, score, maxScore }` → that row's field; `400 invalidStudentIds` → root alert + reload. Toast "Grades saved (22 of 32 graded)". Returned roster replaces the draft.
- **Clear grade** (row action on a row with `gradeId`) → confirm → `DELETE /grades/:id` (a score cannot be "unset" through the PUT).
- Footer stats computed from `records`: graded count, mean percentage, highest, lowest. Unsaved-changes blocker as in attendance. Visible-but-not-owned → read-only, same tooltip.

#### 3.1.12 AnnouncementsPage (`/admin/announcements`, `/teacher/announcements`)
- Card list (`AnnouncementCard`): title, `AudienceBadge`, class badge when `className`, author name + role, "published 2 h ago" (`<time>` with full datetime), `status` badge for non-active (admin only sees those), body clamped to 3 lines with "Read more".
- Filters: admin — `status` (`active` default | `scheduled` | `expired` | `all`), `audience`, `classId`; teacher — `classId` (own visible classes), "Mine" toggle (`authorId=me`). Search: title, body. Sort: `publishedAt desc` (backend default).
- **New announcement** → `AnnouncementFormModal`: title (1..150), body (Textarea 1..5000 with counter), audience (`all|students|teachers`), class (admin: optional, any class; teacher: **required**, visible classes only), publishedAt? (`datetime-local` → ISO with offset; default now), expiresAt? (refine `> publishedAt` → "Expiry must be after the publish time"). `POST /announcements`.
- Edit / Delete: admin on any; teacher only when `author.id === me.id` (others render without buttons; backend returns 403 otherwise). Delete confirm (hard delete).
- Student/teacher read views reuse `AnnouncementCard` with no actions.

### 3.2 Teacher

Scope rule enforced in the UI (mirrors `03` §1.6): **read** pages call list endpoints with no scope filter (the backend returns the teacher's *visible* set: taught + homeroom); **write** actions are shown only where `classSubject.teacherId === me.teacherId` (*owns*). A 403 is still handled (toast + `refreshMe()`), but should never be reachable from rendered buttons.

#### 3.2.1 TeacherDashboardPage — as §2.6; `todaySchedule[].attendanceMarked` drives the `Marked`/`Mark now` chip; `attendanceToday.sessionsMarked/sessionsScheduled` the progress strip; `pendingGrading` links to `/teacher/grades/assessments/:assessmentId`. Empty states: "No periods today" / "Nothing to grade".

#### 3.2.2 MyClassesPage (`/teacher/classes`)
- Data: `GET /class-subjects` (visible) + `GET /schedules?teacherId=me` for next-period hints. Cards grouped under **Teaching** (`teacherId === me.teacherId`) and **Homeroom** (`GET /classes?homeroomTeacherId=me`; cards list that class's subjects with their teachers, read-only).
- Card: `className`, `subjectName`, next period ("Tue 10:00 · B-204"), buttons Roster · Attendance · Grades (the last two only in the Teaching group). Client-side search. No pagination (one teacher has few assignments).
- Empty: "You haven't been assigned to any class yet. Ask an administrator."

#### 3.2.3 ClassSubjectPage (`/teacher/classes/:classSubjectId`)
- `GET /class-subjects/:id` (403/404 → inline `ForbiddenState`/`NotFoundState`), roster `GET /students?classId=`, per-student rate `GET /attendance/summary?classSubjectId=&groupBy=student`, slots `GET /schedules?classSubjectId=`.
- Header actions (owned only): Mark attendance, New assessment (`AssessmentFormModal` with `classSubjectId` fixed).
- Roster table: name, student number, guardian phone, attendance rate (`rate` formatted %, "—" when null).

#### 3.2.4 TeacherSchedulePage — `WeeklyTimetable` with `GET /schedules?teacherId=me`; slot = `className · room`, colour per subject; today column highlighted; `@media print` hides the shell.

#### 3.2.5 Attendance, Grades, Announcements — §3.1.9–3.1.12 with `role==='teacher'` (visible selectors, owned writes, announcements with required class, edit/delete own only).

### 3.3 Student

All student pages key off `me.currentEnrollment`. When it is `null`, every class-dependent page renders one component, `NotEnrolledState` ("You're not enrolled in a class yet. Your school administrator will enroll you."), and no class query is fired (`enabled: !!me.currentEnrollment`). Student requests never send `studentId`/`classId` filters — omitted filters already mean "mine", and a wrong explicit id would be a 403.

#### 3.3.1 StudentDashboardPage — as §2.6, bound 1:1 to the student payload (`student`, `currentEnrollment`, `todaySchedule`, `attendanceSummary`, `gradeSummary`, `recentGrades`, `upcomingAssessments`, `recentAnnouncements`).

#### 3.3.2 MyClassPage (`/student/class`) — class card from `me.currentEnrollment` (name, grade, year, homeroom teacher from the dashboard payload or `GET /classes/:classId`) + subjects table from `GET /class-subjects` (backend scopes to `activeClassId`): `subjectCode · subjectName`, teacher, periods/week (from `GET /schedules`).

#### 3.3.3 StudentSchedulePage — `WeeklyTimetable` with `GET /schedules` (scoped); slot = `subjectName · teacher · room`.

#### 3.3.4 StudentAttendancePage
- Summary tiles from `GET /attendance/summary?dateFrom=&dateTo=`: Present, Absent, Late, Excused (count + share), overall `rate` ("—" when `null`). Per-subject breakdown table from `groupBy=classSubject`.
- Records: `DataTable` on `GET /attendance` — Date (sort `attendanceDate` desc), Subject, Status badge, Remarks, Marked by. Filters: `dateFrom`/`dateTo` (`<input type="date">`, refine from ≤ to), `classSubjectId` (own subjects), `status`. Default range: the academic year start of `currentEnrollment.academicYear` → today.
- Empty: "No attendance records in this period".

#### 3.3.5 StudentGradesPage
- Term filter: a `Select` built from the shared `TERMS` constant (`term1|term2|term3`, labels "Term 1/2/3") plus "All"; the value goes to the API's `term` filter verbatim.
- Per subject card: header from `GET /grades/summary?term=` (`label`, `assessmentsGraded`, `totalScore/totalMaxScore`, `percentage` bar); rows from `GET /grades?term=&classSubjectId=` (lazy per expanded card, or one `GET /grades?term=` grouped client-side by `assessment.classSubjectId` — choose the single call; `groupBy(rows, r => r.assessment.classSubjectId)` lives in `utils/grades.js` and is also used by the admin's Student detail Grades tab).
- Row: title, type badge, date, `score / maxScore`, `percentage`, remarks, graded by. Ungraded assessments are not rows here (they only exist in `GET /assessments`); the card footer links "Upcoming: Unit 2 Exam · 7 Oct" from `GET /assessments?term=`.
- Empty: "No grades recorded for this term yet".

#### 3.3.6 StudentAnnouncementsPage — `AnnouncementCard` feed from `GET /announcements` (scoped: active, audience all/students, my class or school-wide), search, standard pagination ("Load more" = `page + 1`, appended client-side; one list pattern, no `useInfiniteQuery`).

### 3.4 Profile (`/profile`, all roles)
- **Account**: name, email (read-only — Firebase identity), `RoleBadge`, member since.
- **Role details** (read-only): student → studentNumber, dateOfBirth, gender, admissionDate, class (`currentEnrollment.className`), with hint "Ask your administrator to change these"; teacher → employeeNumber, department, qualification, hireDate.
- **Contact details** (editable, `PATCH /auth/me`): phone (all roles); students additionally address, guardianName, guardianPhone. Zod `patchOf` semantics client-side: the submit button is disabled until a field changes and only changed fields are sent. Success → toast + `refreshMe()`.
- **Security**: "Send me a password reset email" → `sendPasswordResetEmail(auth, me.email)` → toast. Chosen over `updatePassword` because Firebase requires a recent sign-in for that (re-authentication flow) — one flow for everyone, zero extra code.

---
## 4. Folder hierarchy

### 4.1 The one rule

> **If a file mentions a school resource (student, class, grade, …) it lives in `src/features/<that-resource>/`. If it knows nothing about any resource, it lives in `src/components`, `src/hooks`, `src/utils`, `src/lib` or `src/config`.**
> Features may import another feature's `api.js`, `hooks.js` and `components/*`, never its `pages/*`. Nothing outside `src/app` imports from `src/app`.

Corollaries: `DataTable` has no idea what a student is; `StudentsTable` does not exist (the page passes `columns`). `formatDate` takes a string, not a student. `WeeklyTimetable` lives in `features/schedules/components` because it understands `dayOfWeek/startTime` — a resource concept — even though three roles use it.

### 4.2 Tree

```
frontend/
├── .env.example
├── eslint.config.js
├── .prettierrc
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx                        # createRoot(<App/>) only
    ├── index.css                       # @import "tailwindcss"; @theme tokens; base styles
    ├── app/
    │   ├── App.jsx                     # <Providers><RouterProvider router={router}/></Providers> — RouterProvider from 'react-router/dom'
    │   ├── router.jsx                  # createBrowserRouter route tree (lazy pages, RouteErrorPage as errorElement)
    │   ├── providers/
    │   │   ├── Providers.jsx           # QueryClientProvider > AuthProvider > ToastProvider (+ Devtools in dev)
    │   │   └── AuthProvider.jsx        # §1.2 state machine; exports AuthContext
    │   └── guards/
    │       ├── RequireAuth.jsx
    │       ├── RequireRole.jsx
    │       ├── PublicOnly.jsx
    │       └── RoleRedirect.jsx
    ├── config/
    │   ├── env.js                      # reads + validates import.meta.env.VITE_*, throws at boot if missing
    │   └── firebase.js                 # initializeApp, getAuth, optional connectAuthEmulator; exports { auth }
    ├── lib/
    │   ├── apiClient.js                # request(), ApiError, api.get/post/patch/put/delete
    │   ├── queryClient.js              # new QueryClient with defaults + QueryCache/MutationCache onError → toast
    │   ├── formErrors.js               # applyServerErrors(error, setError, { fieldMap, knownFields }) — issues / field / key mapping (§5.6)
    │   └── validators.js               # zod pieces built on the regexes in constants/shared.js: email, password, name, phone, dateYMD, timeHM, academicYear, studentNumber, employeeNumber, subjectCode, positiveInt
    ├── constants/
    │   ├── shared.js                   # byte-identical copy of backend/src/constants/shared.js (the backend's `npm run check:constants` compares them): ROLES, GENDERS, ENROLLMENT_STATUSES, ATTENDANCE_STATUSES, ASSESSMENT_TYPES, TERMS, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_STATUSES, DAYS_OF_WEEK, SORT_ORDERS, PAGINATION, DATE_REGEX, TIME_REGEX, ACADEMIC_YEAR_REGEX, STUDENT_NUMBER_REGEX, EMPLOYEE_NUMBER_REGEX, SUBJECT_CODE_REGEX, PASSWORD_MIN_LENGTH, ERROR_CODES (eleven codes), API_BASE_PATH — pure ESM, no env, no React
    │   └── ui.js                       # UI-only: labels and select options for every shared enum (ROLE_OPTIONS, GRADE_LEVEL_OPTIONS, TERM_OPTIONS "Term 1/2/3", …), badge tones/colours, FORCE_SIGN_OUT_CODES = ['USER_NOT_REGISTERED', 'ACCOUNT_DISABLED'], PAGE_SIZES = [10, 20, 50], GRADE_LEVELS 1..12, academicYearOptions(), SCHOOL_HOURS { start: '07:00', end: '17:00' }
    ├── utils/
    │   ├── date.js                     # formatDate(ymd), formatDateTime(iso), formatTime(t → t.slice(0,5)), todayYMD(), todayDayOfWeek() (ISO 1..7), relativeTime(iso), toIsoWithOffset(datetimeLocal)
    │   ├── schedule.js                 # dayLabel(n), timeToMinutes('HH:MM'), slotsToGrid(slots)
    │   ├── roles.js                    # roleLabel(role), roleTone(role), roleHome(role)
    │   ├── names.js                    # fullName({ firstName, lastName }), initials(...)
    │   ├── format.js                   # formatPercent(rate | null → '—'), formatScore(score, maxScore)
    │   ├── grades.js                   # groupBy(rows, keyFn) for grades-by-subject; aggregates always come from /grades/summary, never recomputed
    │   └── listParams.js               # toApiParams(params) strips '', null, undefined
    ├── hooks/
    │   ├── useDebounce.js
    │   ├── useListParams.js            # §6.1 — URL-synced page/limit/search/sort/filters
    │   ├── useDisclosure.js            # {isOpen, open, close, toggle} for modals
    │   ├── useConfirm.js               # imperative confirm(): Promise<boolean> backed by ConfirmDialog
    │   └── useUnsavedChangesBlocker.js # wraps react-router useBlocker + beforeunload
    ├── components/
    │   ├── ui/
    │   │   ├── Button.jsx              # variants: primary|secondary|ghost|danger; size; isLoading
    │   │   ├── Input.jsx               # forwardRef; aria-invalid when error
    │   │   ├── Select.jsx              # native <select>, options=[{value,label}], placeholder
    │   │   ├── Textarea.jsx
    │   │   ├── Checkbox.jsx
    │   │   ├── RadioGroup.jsx          # fieldset + legend; used by AttendanceSheet rows
    │   │   ├── FormField.jsx           # label + control + hint + error (id wiring)
    │   │   ├── Table.jsx               # primitives: Table, THead, TBody, Tr, Th(sortable), Td
    │   │   ├── DataTable.jsx           # §6.2 columns-config table with loading/empty/error/sort
    │   │   ├── Pagination.jsx
    │   │   ├── SearchInput.jsx
    │   │   ├── Modal.jsx               # native <dialog>; title, description, footer slot
    │   │   ├── ConfirmDialog.jsx
    │   │   ├── Badge.jsx               # tone: gray|green|amber|red|blue|violet
    │   │   ├── Spinner.jsx
    │   │   ├── Skeleton.jsx
    │   │   ├── EmptyState.jsx
    │   │   ├── ErrorState.jsx
    │   │   ├── Tabs.jsx                # URL-synced via ?tab=
    │   │   ├── Card.jsx
    │   │   ├── StatTile.jsx            # label, value, hint, icon, tone
    │   │   ├── Tooltip.jsx             # title-attr based; no JS positioning library
    │   │   ├── Dropdown.jsx            # row-actions menu (keyboard navigable)
    │   │   └── Toast.jsx               # ToastProvider, useToast(), ToastViewport
    │   └── layout/
    │       ├── AppShell.jsx            # sidebar + topbar + <Outlet/>; mobile drawer state
    │       ├── Sidebar.jsx             # renders NAV[role], active link styling, API docs link
    │       ├── Topbar.jsx              # hamburger, page title slot, user menu (Profile, Sign out)
    │       ├── NavItem.jsx
    │       ├── UserMenu.jsx
    │       ├── PageHeader.jsx
    │       ├── PageSkeleton.jsx
    │       ├── SplashScreen.jsx        # used by guards while auth resolves; variant="error" (Retry / Sign out)
    │       ├── DevProjectBanner.jsx    # dev only: GET /health firebaseProjectId vs VITE_FIREBASE_PROJECT_ID mismatch warning
    │       ├── AuthLayout.jsx          # centred card for public pages
    │       └── navConfig.js            # NAV per role (§2.7)
    └── features/
        ├── auth/
        │   ├── api.js                  # getMe(), register(payload) [auth:false], updateMe(body) → PATCH /auth/me
        │   ├── hooks.js                # useAuth() (context), useLogin(), useRegister(), useForgotPassword(), useUpdateMe()
        │   ├── keys.js                 # authKeys
        │   ├── firebaseErrors.js       # mapFirebaseError(code) → message
        │   ├── schemas.js              # loginSchema, registerSchema, forgotSchema
        │   ├── components/
        │   │   ├── LoginForm.jsx
        │   │   ├── RegisterForm.jsx
        │   │   └── ForgotPasswordForm.jsx
        │   └── pages/
        │       ├── LoginPage.jsx
        │       ├── RegisterPage.jsx
        │       └── ForgotPasswordPage.jsx
        ├── dashboard/
        │   ├── api.js                  # getDashboard()
        │   ├── hooks.js                # useDashboard()
        │   ├── keys.js
        │   ├── components/
        │   │   ├── KpiGrid.jsx              # admin — counts
        │   │   ├── AttendanceTodayCard.jsx  # admin — attendanceToday (rate ring + counts)
        │   │   ├── EnrollmentByGradeBars.jsx# admin — enrollmentsByGrade (CSS bars)
        │   │   ├── UpcomingAssessments.jsx  # admin + student — upcomingAssessments
        │   │   ├── TodayTimeline.jsx        # teacher (Mark now / Marked) + student (read-only) — todaySchedule
        │   │   ├── SessionsMarkedStrip.jsx  # teacher — attendanceToday.sessionsMarked/sessionsScheduled
        │   │   ├── PendingGrading.jsx       # teacher — pendingGrading
        │   │   ├── MyClassesChips.jsx       # teacher — classSubjects + homeroomClasses
        │   │   ├── StudentHero.jsx          # student — student + currentEnrollment
        │   │   ├── AttendanceRing.jsx       # student — attendanceSummary.rate
        │   │   ├── GradeSummaryList.jsx     # student — gradeSummary
        │   │   ├── RecentGrades.jsx         # student — recentGrades
        │   │   └── RecentAnnouncements.jsx  # all roles — recentAnnouncements (uses announcements/AnnouncementCard compact)
        │   └── pages/
        │       ├── AdminDashboardPage.jsx
        │       ├── TeacherDashboardPage.jsx
        │       └── StudentDashboardPage.jsx
        ├── users/
        │   ├── api.js                  # listUsers, createUser (POST /users), updateUser (PATCH name/phone), setUserStatus (PATCH /users/:id/status)
        │   ├── hooks.js                # useUsers(params), useCreateUser, useUpdateUser, useSetUserStatus
        │   ├── keys.js
        │   ├── schemas.js              # createUserSchema = z.discriminatedUnion('role', …) with nested profile per role; editUserSchema
        │   ├── components/
        │   │   ├── UserFormModal.jsx
        │   │   ├── RoleBadge.jsx
        │   │   └── UserStatusBadge.jsx
        │   └── pages/UsersListPage.jsx
        ├── students/
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── StudentProfileForm.jsx
        │   │   └── StudentSummaryHeader.jsx
        │   └── pages/
        │       ├── StudentsListPage.jsx
        │       └── StudentDetailPage.jsx
        ├── teachers/
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── TeacherProfileForm.jsx
        │   │   ├── TeacherAssignmentsTable.jsx  # class-subjects taught + homeroom classes
        │   │   └── TeacherSelect.jsx            # async searchable select of active teachers (class form, add/change teacher modals)
        │   └── pages/
        │       ├── TeachersListPage.jsx
        │       └── TeacherDetailPage.jsx
        ├── subjects/
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── SubjectFormModal.jsx
        │   │   └── SubjectSelect.jsx            # select of active subjects (isActive=true), excludes ids already in the class
        │   └── pages/SubjectsPage.jsx
        ├── classes/
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── ClassFormModal.jsx
        │   │   ├── ClassSubjectsTab.jsx     # uses classSubjects hooks + components
        │   │   ├── ClassStudentsTab.jsx     # uses enrollments hooks + components
        │   │   ├── ClassScheduleTab.jsx     # uses schedules components
        │   │   └── ClassSelect.jsx          # async select of classes (shared by attendance/grades selector bars)
        │   └── pages/
        │       ├── ClassesListPage.jsx
        │       ├── ClassDetailPage.jsx
        │       └── MyClassPage.jsx          # student
        ├── classSubjects/                   # teacher assignment
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── AddClassSubjectModal.jsx # subject + teacher → POST /class-subjects (a class-subject IS the assignment)
        │   │   ├── ChangeTeacherModal.jsx   # PATCH /class-subjects/:id { teacherId }
        │   │   ├── ClassSubjectSelect.jsx   # by classId (admin) or no filter = visible set (teacher), grouped Teaching / Homeroom
        │   │   └── ClassSubjectSelectorBar.jsx  # class → class-subject (→ date) bar used by attendance & grades
        │   └── pages/
        │       ├── MyClassesPage.jsx        # teacher
        │       └── ClassSubjectPage.jsx     # teacher
        ├── enrollments/
        │   ├── api.js | hooks.js | keys.js | schemas.js   # useEnroll, useEnrollMany (bulk), useSetEnrollmentStatus (completed | withdrawn), useTransferStudent (single mutation → POST /enrollments/transfer)
        │   └── components/
        │       ├── EnrollStudentModal.jsx   # single student → class
        │       ├── EnrollStudentsModal.jsx  # class → many students
        │       └── EnrollmentHistoryTable.jsx
        ├── attendance/
        │   ├── api.js | hooks.js | keys.js              # getSheet / saveSheet (/attendance/sheet), listAttendance, getSummary (/attendance/summary)
        │   ├── components/
        │   │   ├── AttendanceSheet.jsx
        │   │   ├── AttendanceStatusRadio.jsx
        │   │   ├── AttendanceSummaryCards.jsx
        │   │   ├── AttendanceList.jsx
        │   │   └── AttendanceStatusBadge.jsx
        │   └── pages/
        │       ├── AttendanceMarkPage.jsx   # admin + teacher
        │       └── StudentAttendancePage.jsx
        ├── grades/                          # assessments + grades
        │   ├── api.js | hooks.js | keys.js | schemas.js   # assessments CRUD, getRoster / saveGrades (/assessments/:id/grades), listGrades, getGradeSummary, deleteGrade
        │   ├── components/
        │   │   ├── AssessmentFormModal.jsx
        │   │   ├── AssessmentsTable.jsx
        │   │   ├── GradeSheet.jsx
        │   │   └── GradesBySubject.jsx      # student view + admin student detail tab
        │   └── pages/
        │       ├── AssessmentsPage.jsx      # admin + teacher
        │       ├── GradeSheetPage.jsx       # admin + teacher
        │       └── StudentGradesPage.jsx
        ├── schedules/
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── WeeklyTimetable.jsx      # grid; props: slots, renderSlot, onSlotClick, highlightToday
        │   │   ├── TimetableSlot.jsx
        │   │   └── ScheduleSlotModal.jsx
        │   └── pages/
        │       ├── TeacherSchedulePage.jsx
        │       └── StudentSchedulePage.jsx
        ├── announcements/
        │   ├── api.js | hooks.js | keys.js | schemas.js
        │   ├── components/
        │   │   ├── AnnouncementCard.jsx
        │   │   ├── AnnouncementFormModal.jsx
        │   │   └── AudienceBadge.jsx
        │   └── pages/
        │       ├── AnnouncementsPage.jsx    # admin + teacher
        │       └── StudentAnnouncementsPage.jsx
        ├── profile/
        │   ├── components/ContactDetailsForm.jsx  # phone (+ address/guardian for students) → useUpdateMe()
        │   └── pages/ProfilePage.jsx        # reads `me` from useAuth(); no extra fetch
        └── misc/
            └── pages/
                ├── ForbiddenPage.jsx
                ├── NotFoundPage.jsx
                └── RouteErrorPage.jsx       # router errorElement: render errors + failed lazy chunks ("Reload")
```

### 4.3 Per-feature file contract (identical in every feature)

| File | Contains | Must not contain |
|---|---|---|
| `keys.js` | `xKeys = { all, lists(), list(params), details(), detail(id) }` plus resource-specific keys (`sheet(params)`, `summary(params)`, `roster(id)`) | anything else |
| `api.js` | one exported async function per endpoint, returning `r.data` or `{ items: r.data, meta: r.meta }`; the only place that knows URL paths | React, hooks, toasts |
| `hooks.js` | `useQuery`/`useMutation` wrappers; mutations invalidate keys and fire success toasts | JSX, fetch |
| `schemas.js` | zod schemas + `defaultValues` factories for forms | fetch |
| `components/` | feature-specific UI | route params (`useParams`) — pages read the URL and pass props |
| `pages/` | compose hooks + components; read URL; one default export | fetch, zod |

---
## 5. Data-fetching conventions

### 5.1 `apiClient.js`

```js
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { env } from '../config/env';
import { FORCE_SIGN_OUT_CODES } from '../constants/ui';

export class ApiError extends Error {
  constructor({ status, code, message, details = null, requestId = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;        // HTTP status; 0 for network failure
    this.code = code;            // backend error.code, or synthetic NETWORK_ERROR | NO_SESSION | HTTP_ERROR | INVALID_RESPONSE
    this.details = details;      // backend error.details (always an object when present)
    this.requestId = requestId;  // X-Request-Id response header, for support/debugging
  }
}

function buildUrl(path, params) {
  const url = new URL(path, env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl : env.apiBaseUrl + '/'); // works for absolute and for '/api/v1' (proxy)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url;
}

async function getToken(force) {
  const user = auth.currentUser;
  if (!user) throw new ApiError({ status: 0, code: 'NO_SESSION', message: 'You are not signed in.' });
  return user.getIdToken(force);
}

async function request(path, { method = 'GET', body, params, auth: needsAuth = true, _retried = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (needsAuth) headers.Authorization = `Bearer ${await getToken(_retried)}`;

  let res;
  try {
    res = await fetch(buildUrl(path.replace(/^\//, ''), params), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the server. Check your connection.' });
  }

  const requestId = res.headers.get('X-Request-Id');
  const json = res.status === 204 ? { success: true, data: null } : await res.json().catch(() => null);

  if (!res.ok || !json || json.success === false) {
    const err = new ApiError({
      status: res.status,
      code: json?.error?.code ?? (json ? 'HTTP_ERROR' : 'INVALID_RESPONSE'),
      message: json?.error?.message ?? `Request failed (${res.status})`,
      details: json?.error?.details ?? null,
      requestId,
    });
    const forceOut = FORCE_SIGN_OUT_CODES.includes(err.code);
    if (res.status === 401 && needsAuth && !forceOut) {
      if (!_retried) return request(path, { method, body, params, auth: needsAuth, _retried: true }); // one forced token refresh
      await signOut(auth);                                                                          // still 401 → session is dead
    }
    throw err;                      // USER_NOT_REGISTERED / ACCOUNT_DISABLED are thrown as-is; AuthProvider signs out with a message
  }
  return json;                      // { success: true, data, meta? }
}

export const api = {
  get:    (path, opts)       => request(path, { ...opts, method: 'GET' }),
  post:   (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch:  (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  put:    (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts)       => request(path, { ...opts, method: 'DELETE' }),
};
```

Feature `api.js` example (students) — the **only** layer that knows URL paths and unwraps the envelope:

```js
export const listStudents  = (params)   => api.get('/students', { params }).then((r) => ({ items: r.data, meta: r.meta }));
export const getStudent    = (id)       => api.get(`/students/${id}`).then((r) => r.data);
export const updateStudent = (id, body) => api.patch(`/students/${id}`, body).then((r) => r.data);
```
Hooks and components never see `success`, `meta` wrappers or paths.

### 5.2 Query key factory (one `keys.js` per feature)

```js
export const studentKeys = {
  all: ['students'],
  lists: () => [...studentKeys.all, 'list'],
  list: (params) => [...studentKeys.lists(), params],       // params = useListParams().apiParams (plain object)
  details: () => [...studentKeys.all, 'detail'],
  detail: (id) => [...studentKeys.details(), String(id)],   // always String — route params are strings
};
```
Sheets and summaries follow the same idea: `attendanceKeys.sheet({ classSubjectId, date })`, `attendanceKeys.summary(params)`, `gradeKeys.roster(assessmentId)`.

### 5.3 Hooks (`hooks.js`)

```js
export function useStudents(params) {
  return useQuery({ queryKey: studentKeys.list(params), queryFn: () => listStudents(params), placeholderData: keepPreviousData });
}
export function useStudent(id) {
  return useQuery({ queryKey: studentKeys.detail(id), queryFn: () => getStudent(id), enabled: !!id });
}
export function useUpdateStudent(id) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body) => updateStudent(id, body),
    onSuccess: (student) => {
      qc.invalidateQueries({ queryKey: studentKeys.all });
      toast.success(`${fullName(student)} updated`);
    },
  });
}
```
- `placeholderData: keepPreviousData` on every list — no skeleton flash when paging/filtering; the table dims while `isFetching`.
- `enabled` guards every query that depends on a selection (`!!classSubjectId && !!date`) or on enrollment (`!!me.currentEnrollment`).
- Default `staleTime: 30_000`; mutations invalidate explicitly, so a write is never followed by stale data.
- Option sources (`ClassSelect`, `SubjectSelect`, `TeacherSelect`): `limit: 100` (the API maximum), `staleTime: 5 min`, searchable → re-query with `search` when the user types (debounced).

### 5.4 Invalidation matrix (coarse on purpose — correctness over cleverness)

| Mutation | Invalidate |
|---|---|
| `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status` | `userKeys.all`, `studentKeys.all` / `teacherKeys.all` by role, `dashboardKeys.all` |
| `PATCH /auth/me` | `authKeys.me()` |
| `PATCH /students/:id` / `PATCH /teachers/:id` | that feature's `all` |
| `POST /enrollments`, `/enrollments/bulk`, `/enrollments/transfer`, `PATCH /enrollments/:id` | `enrollmentKeys.all`, `studentKeys.all`, `classKeys.all`, `dashboardKeys.all` |
| subjects CRUD | `subjectKeys.all`, `classSubjectKeys.all` |
| classes CRUD | `classKeys.all`, `dashboardKeys.all` |
| `POST/PATCH/DELETE /class-subjects` | `classSubjectKeys.all`, `scheduleKeys.all`, `teacherKeys.all`, `dashboardKeys.all` |
| schedules CRUD | `scheduleKeys.all`, `dashboardKeys.all` |
| `PUT /attendance/sheet` | `attendanceKeys.all`, `dashboardKeys.all` |
| assessments CRUD, `PUT /assessments/:id/grades`, `DELETE /grades/:id` | `gradeKeys.all`, `dashboardKeys.all` |
| announcements CRUD | `announcementKeys.all`, `dashboardKeys.all` |

No optimistic updates. `mutateAsync` only where the caller needs the result or sequencing (register → sign-in; form submit → close modal). Transfer is one request, so it needs no client-side sequencing.

### 5.5 `queryClient.js` — global error surfacing

```js
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => (err.status === 0 || err.status >= 500) && count < 2,  // never retry 4xx
      refetchOnWindowFocus: false,                                                 // auth/me opts in
    },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (err, query) => { if (query.state.data !== undefined) toastBus.error(err); },   // background refetch only; first load renders ErrorState inline
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      if (err.code === 'VALIDATION_ERROR' || err.code === 'CONFLICT') return;      // forms render these inline (applyServerErrors)
      if (err.status === 403) queryClient.invalidateQueries({ queryKey: authKeys.me() });
      toastBus.error(err);
    },
  }),
});
```
`toastBus` is a tiny emitter in `Toast.jsx`; `ToastProvider` subscribes. `toastBus.error(err)` formats `err.message` and, in dev, `[${err.code}] · ${err.requestId}`. The rule, applied once: **queries → inline `ErrorState` on first load, toast afterwards; mutations → toast, except validation/conflict → inline in the form.**

### 5.6 Mapping server errors to form fields (`lib/formErrors.js`)

```js
const stripSource = (p) => p.replace(/^(body|query|params)\./, '');          // 'body.profile.guardianPhone' → 'profile.guardianPhone'
const keyToField = (key) => key.split('.').pop().replace(/^uq_\w+?_/, '')     // 'users.email' → 'email'
  .replace(/_([a-z])/g, (_, c) => c.toUpperCase());                          // 'student_number' → 'studentNumber'

export function applyServerErrors(error, setError, { fieldMap = {}, knownFields = null } = {}) {
  const set = (field, message) => {
    const name = fieldMap[field] ?? field;
    if (knownFields && !knownFields.includes(name)) return setError('root.server', { message: `${message} (${field})` });
    setError(name, { type: 'server', message });
  };
  if (!(error instanceof ApiError)) return setError('root.server', { message: 'Something went wrong.' });

  if (error.code === 'VALIDATION_ERROR') {
    const d = error.details ?? {};
    if (Array.isArray(d.issues) && d.issues.length) { d.issues.forEach((i) => set(stripSource(i.path), i.message)); return; }
    if (d.field) return set(d.field, error.message);
    return setError('root.server', { message: error.message });               // business-rule details (invalidStudentIds, …) are not field-shaped
  }
  if (error.code === 'CONFLICT' && typeof error.details?.key === 'string') return set(keyToField(error.details.key), error.message);
  setError('root.server', { message: error.message });
}
```
- `issues[].path` arrives as `body.x.y` → stripped to `x.y`, which is exactly a react-hook-form field name for nested objects (`profile.guardianPhone`); array paths `grades.3.score` are valid RHF names too.
- `CONFLICT.details.key` (`users.email`, `subjects.code`, `class_subjects.uq_class_subject`) maps to a field when the last segment is one; `uq_*` keys fall through to `root.server`, which the modal shows as an alert — nothing is lost silently.
- Every form: `onSubmit = (values) => mutation.mutateAsync(values).then(onClose).catch((e) => applyServerErrors(e, setError, { knownFields }))`, with `knownFields = Object.keys(schema.shape)` so a path the form does not render still becomes visible.

### 5.7 Devtools

`<ReactQueryDevtools initialIsOpen={false}/>` is rendered only when `import.meta.env.DEV`; the production bundle excludes it.

---
## 6. Shared list page pattern

Every list page = `useListParams` (URL state) + `useXxx(apiParams)` (server state) + `PageHeader` + `FilterBar` + `DataTable` + `Pagination` + one modal. Nothing else.

### 6.1 `useListParams` (src/hooks/useListParams.js)

```js
import { useSearchParams } from 'react-router';
import { PAGINATION } from '../constants/shared';     // PAGINATION.DEFAULT_LIMIT = 20, PAGINATION.MAX_LIMIT = 100
import { toApiParams } from '../utils/listParams';   // drops '', null, undefined

export function useListParams({ filters = [] } = {}) {
  const [sp, setSp] = useSearchParams();

  const params = {
    page: Math.max(1, Number(sp.get('page')) || 1),
    limit: Number(sp.get('limit')) || PAGINATION.DEFAULT_LIMIT, // 10 | 20 | 50 (PAGE_SIZES in constants/ui.js) — never above PAGINATION.MAX_LIMIT
    search: sp.get('search') ?? '',
    sortBy: sp.get('sortBy') ?? null,                         // null → not sent → backend default sort for the resource
    sortOrder: sp.get('sortOrder') ?? null,
    ...Object.fromEntries(filters.map((f) => [f, sp.get(f) ?? ''])),
  };

  // patch semantics: '' / null / undefined deletes the key; anything but a page change resets to page 1
  const update = (patch) =>
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) (v === '' || v == null ? next.delete(k) : next.set(k, String(v)));
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });

  const hasActiveFilters = params.search !== '' || filters.some((f) => params[f] !== '');

  return {
    params,                                   // for rendering controls
    apiParams: toApiParams(params),           // for the query key and the request
    hasActiveFilters,
    setPage:   (page) => update({ page }),
    setLimit:  (limit) => update({ limit }),
    setSearch: (search) => update({ search }),
    setSort:   (sortBy, sortOrder) => update({ sortBy, sortOrder }),
    setFilter: (key, value) => update({ [key]: value }),
    clearFilters: () => update(Object.fromEntries(['search', ...filters].map((k) => [k, '']))),
  };
}
```
Why the URL: refresh/back/forward keep the view, deep links are shareable (`/admin/students?classId=3`), the dashboard can link into filtered lists, and the query key derives from the URL so each view is cached separately.

### 6.2 `DataTable` (src/components/ui/DataTable.jsx)

```jsx
<DataTable
  columns={[{ key, header, cell?, sortKey?, align?, width?, hideBelow? }]}  // cell(row) → node; defaults to row[key]
  rows={items}
  rowKey="id"                       // string | (row) => key
  isLoading={isPending}             // first load → 8 skeleton rows
  isFetching={isFetching}           // refetch → opacity-60 + aria-busy; rows stay
  error={error} onRetry={refetch}   // → <ErrorState/> replaces the body
  sort={{ sortBy, sortOrder }} onSortChange={(sortKey, order) => …}   // only columns with sortKey are clickable; sortKey must be in the API whitelist
  emptyState={<EmptyState …/>}      // the page decides "none yet" vs "no match"
/>
```
Header click cycles asc → desc on `sortKey`; `aria-sort` on `<th>`; horizontal scroll wrapper (`tabIndex=0`) on small screens; `hideBelow: 'md' | 'lg'` drops low-priority columns on phones. The component has **zero** domain knowledge.

`Pagination` takes `meta` + `onPageChange` + `onLimitChange`; renders nothing when `totalPages <= 1` and `limit === PAGINATION.DEFAULT_LIMIT`.

### 6.3 StudentsListPage composed (~40 lines)

```jsx
export default function StudentsListPage() {
  const list = useListParams({ filters: ['classId', 'gradeLevel', 'hasActiveEnrollment', 'isActive'] });
  const { data, isPending, isFetching, error, refetch } = useStudents(list.apiParams);
  const classOptions = useClassOptions();                   // [{ value, label }] — limit 100, 5-min stale
  const createModal = useDisclosure();
  const [enrollTarget, setEnrollTarget] = useState(null);   // student being enrolled / transferred

  const columns = [
    { key: 'studentNumber', header: 'Student no', sortKey: 'studentNumber' },
    { key: 'name', header: 'Name', sortKey: 'lastName', cell: (s) => <Link to={`${s.id}`}>{fullName(s)}</Link> },
    { key: 'email', header: 'Email', hideBelow: 'md' },
    { key: 'class', header: 'Class', cell: (s) => s.currentEnrollment
        ? <Badge tone="blue">{s.currentEnrollment.className}</Badge> : <Badge tone="gray">Not enrolled</Badge> },
    { key: 'guardianPhone', header: 'Guardian phone', hideBelow: 'lg' },
    { key: 'isActive', header: 'Status', cell: (s) => <UserStatusBadge isActive={s.isActive}/> },
    { key: 'actions', header: '', align: 'right', cell: (s) => (
        <Button size="sm" variant="secondary" onClick={() => setEnrollTarget(s)}>{s.currentEnrollment ? 'Transfer' : 'Enroll'}</Button>) },
  ];

  return (
    <>
      <PageHeader title="Students" description="All registered students and their current class"
        actions={<Button onClick={createModal.open}>Add student</Button>} />

      <FilterBar onClear={list.hasActiveFilters ? list.clearFilters : undefined}>
        <SearchInput value={list.params.search} onChange={list.setSearch} placeholder="Search name, student number, email" />
        <Select value={list.params.classId} onChange={(v) => list.setFilter('classId', v)} options={classOptions} placeholder="All classes" />
        <Select value={list.params.gradeLevel} onChange={(v) => list.setFilter('gradeLevel', v)} options={GRADE_LEVEL_OPTIONS} placeholder="Any grade" />
        <Select value={list.params.hasActiveEnrollment} onChange={(v) => list.setFilter('hasActiveEnrollment', v)}
          options={[{ value: 'true', label: 'Enrolled' }, { value: 'false', label: 'Not enrolled' }]} placeholder="Enrollment" />
      </FilterBar>

      <DataTable columns={columns} rows={data?.items ?? []} rowKey="id"
        isLoading={isPending} isFetching={isFetching} error={error} onRetry={refetch}
        sort={{ sortBy: list.params.sortBy, sortOrder: list.params.sortOrder }} onSortChange={list.setSort}
        emptyState={list.hasActiveFilters
          ? <EmptyState title="No students match" action={<Button variant="ghost" onClick={list.clearFilters}>Clear filters</Button>} />
          : <EmptyState title="No students yet" description="Add the first student to get started." action={<Button onClick={createModal.open}>Add student</Button>} />} />

      <Pagination meta={data?.meta} onPageChange={list.setPage} onLimitChange={list.setLimit} />

      <UserFormModal open={createModal.isOpen} onClose={createModal.close} lockedRole="student" />
      <EnrollStudentModal student={enrollTarget} open={!!enrollTarget} onClose={() => setEnrollTarget(null)} />
    </>
  );
}
```
Users, Teachers, Subjects, Classes and the admin Announcements list are this file with different `columns`, `filters`, hook and modal. A reviewer diffing two list pages sees only domain differences.

---
## 7. Environment and configuration

### 7.1 `.env.example` (committed; real values go in `frontend/.env`, git-ignored)

```dotenv
# Firebase web config — public by design (identifies the project), but never hard-coded: one Firebase project per environment.
# Must be the SAME project as the backend's service account (see 05 §1); the dev banner checks this via GET /health.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=

# Backend. Defaults in code: VITE_API_BASE_URL=/api/v1 and VITE_API_DOCS_URL=/api/docs — relative paths served through the
# Vite dev proxy (/api → http://127.0.0.1:3000), so a fresh clone has no CORS at all. Both lines below can stay empty in dev.
VITE_API_BASE_URL=/api/v1
# VITE_API_BASE_URL=http://localhost:3000/api/v1     # direct / deployed build (requires CORS_ORIGINS on the backend to include the frontend origin)
VITE_API_DOCS_URL=/api/docs

# Dev only: Firebase Auth emulator (firebase emulators:start --only auth)
VITE_USE_AUTH_EMULATOR=false
VITE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
```
`src/config/env.js` reads each key once, applies the defaults (`/api/v1`, `/api/docs`, emulator off), and throws a readable error at boot for the Firebase keys (`Missing env: VITE_FIREBASE_API_KEY — copy .env.example to .env and restart npm run dev`), rendered by `main.jsx` as a plain full-page message instead of Firebase's `auth/invalid-api-key` stack. The backend's `npm run doctor` reads `frontend/.env` to check the Firebase project id matches the service account.

### 7.2 `src/config/firebase.js`

```js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { env } from './env';

const app = initializeApp({ apiKey: env.firebase.apiKey, authDomain: env.firebase.authDomain, projectId: env.firebase.projectId, appId: env.firebase.appId });
export const auth = getAuth(app);
if (env.useAuthEmulator) connectAuthEmulator(auth, env.authEmulatorUrl, { disableWarnings: true });
```
Default persistence (`browserLocalPersistence`) keeps users signed in across tabs and restarts — expected for a school portal.

### 7.3 `vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,                                      // a busy port is a loud error, not a silent move to 5174 (which breaks CORS allow-lists)
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },  // 127.0.0.1, not localhost (IPv6 ::1 pitfall)
  },
  build: { sourcemap: true },
});
```
`index.html`: `<div id="root">`, viewport meta, `<title>School Manager</title>`. SPA fallback for static hosting (Firebase Hosting free tier / Netlify / Vercel): rewrite `/* → /index.html`. The proxy only exists in `vite dev`; a deployed build needs an absolute `VITE_API_BASE_URL` and backend CORS.

### 7.4 Tailwind v4 (`src/index.css`)

```css
@import "tailwindcss";

@theme {
  --color-brand-50: oklch(97% 0.02 250);
  --color-brand-600: oklch(50% 0.17 250);
  --color-brand-700: oklch(43% 0.17 250);
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-card: 0.75rem;
}

@layer base {
  :root { color-scheme: light; }
  body { @apply bg-gray-50 text-gray-900 antialiased; }
  :focus-visible { @apply outline-2 outline-offset-2 outline-brand-600; }
}
```
No `tailwind.config.js`, no PostCSS config, no `@tailwind base` directives (v3 syntax — silently does nothing in v4). Class merging via a 3-line `cx()`; component variants are plain object maps.

### 7.5 ESLint + Prettier

`eslint.config.js` (flat):
```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettier,
];
```
`.prettierrc`: `{ "singleQuote": true, "semi": true, "printWidth": 110, "trailingComma": "all", "plugins": ["prettier-plugin-tailwindcss"] }`.
Scripts: `dev`, `build`, `preview`, `lint` (`eslint .`), `format` (`prettier --write .`), `check` (`npm run lint && npm run build`). Commit `package-lock.json`; README uses `npm ci`. `"engines": { "node": ">=22.12" }` + `.nvmrc` `24`.

### 7.6 Dependencies (all MIT/free; carets on the majors pinned in `01`)

`react@^19.3 react-dom@^19.3 react-router@^8.4 @tanstack/react-query@^5.104 firebase@^12.19 react-hook-form@^7.89 zod@^4.6 @hookform/resolvers@^5 lucide-react`
Dev: `vite@^8.3 @vitejs/plugin-react@^6.1 tailwindcss@^4.3 @tailwindcss/vite@^4.3 @tanstack/react-query-devtools@^5 eslint@^9 @eslint/js globals eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-config-prettier prettier@^3 prettier-plugin-tailwindcss`

---

## 8. Accessibility and UX basics checklist

- [ ] Every control has a `<label htmlFor>`; `FormField` wires `id`, `aria-describedby` (hint + error), `aria-invalid`, `aria-required`.
- [ ] Field errors are plain text under the field; only the form-level root alert has `role="alert"` (avoids screen-reader spam).
- [ ] `Modal` = native `<dialog>` + `showModal()`: focus trap, Esc, top layer and inert background come free. Focus goes to the first field on open and back to the trigger on close (store `document.activeElement`); `aria-labelledby` → title.
- [ ] `ConfirmDialog`: initial focus on **Cancel** for destructive actions; the danger button carries the verb ("Delete", "Withdraw", "Deactivate", "Retire").
- [ ] All actions are `<button>`/`<a>` (never clickable `<div>`); `Dropdown` supports Arrow/Home/End/Esc; sortable headers are `<button>`s inside `<th aria-sort>`.
- [ ] Attendance status is a real radio group per student (`fieldset` + visually hidden `legend` "Attendance for Liam Cruz"); pills show letter + text, never colour alone.
- [ ] Contrast ≥ 4.5:1 for text, ≥ 3:1 for badges/large text — verified once in the `Badge` tone map (`-700` text on `-50` background) and reused.
- [ ] Status never by colour alone: badges have text; timetable slots have text; the attendance ring shows the percentage.
- [ ] Skip link as the first element in `AppShell`; `<main id="main" tabIndex={-1}>`; focus moves to `main` on route change; `document.title` per page.
- [ ] Responsive: sidebar is a fixed column ≥ `lg`, an off-canvas drawer below (hamburger with `aria-expanded`/`aria-controls`; Esc, backdrop and navigation close it). Tables scroll horizontally in a focusable wrapper; `hideBelow` drops low-priority columns. `WeeklyTimetable` becomes a per-day stacked list below `md`.
- [ ] Touch targets ≥ 40 px; native `<select>`, `<input type="date|time|datetime-local|number">` for mobile pickers and keyboards.
- [ ] Loading announced: `aria-busy` on tables; toasts in an `aria-live="polite"` region (`role="status"`), errors `role="alert"`.
- [ ] `prefers-reduced-motion`: drawer and toast transitions disabled.
- [ ] Enter submits forms; the primary button is `type="submit"`, Cancel is `type="button"`.
- [ ] Dates render as `14 Mar 2025` (`Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' })`) inside `<time dateTime="2025-03-14">`.

---

## 9. Pitfalls specific to this frontend

1. **Firebase web config is public by design** — security comes from Firebase Auth and the backend verifying ID tokens — but it still comes from `VITE_*` env so dev/staging/prod use different projects and nothing is committed. Frontend and backend **must point at the same Firebase project** or every API call is a 401 (`aud` mismatch, `05` §1): in dev, `App` fetches `GET /health` once and shows a red banner when `firebaseProjectId !== VITE_FIREBASE_PROJECT_ID`. Add the deployed domain to Firebase **Authorized domains** or sign-in fails with `auth/unauthorized-domain`; enable the Email/Password provider or it fails with `auth/operation-not-allowed`.
2. **Auth state flicker**: `auth.currentUser` is `null` on first render even for signed-in users. Nothing is decided before the first `onAuthStateChanged` callback — hence `status='initializing'` + `SplashScreen` in both `RequireAuth` and `PublicOnly`. Test: hard-reload a protected route; no login flash.
3. **Two identities**: Firebase user ≠ backend user. `firebaseUser` is used for the token only; everything rendered comes from `me`. `me.id` is `users.id`; `me.studentId`/`me.teacherId` are the profile ids used in filters and ownership checks — never mix them.
4. **Deactivation while signed in**: the backend answers `ACCOUNT_DISABLED` on the next request and also revokes refresh tokens, so the user is signed out on their next click; `/auth/me` also refetches on window focus. Roles and emails are immutable in v1 (`03` Q3), so there is no stale-role case to handle.
5. **Token expiry on long-open tabs**: `getIdToken()` refreshes automatically; one 401 can still slip through after hours idle — the single forced-refresh retry in `apiClient` absorbs it. Never cache the token string in state.
6. **Dates and times**: dates are `YYYY-MM-DD` strings end to end. Never `new Date('2025-03-14')` for display — it parses as UTC and shifts a day in negative-offset zones; `formatDate` splits the string and builds `new Date(y, m - 1, d)`. `todayYMD()` uses local `getFullYear/getMonth/getDate`, not `toISOString().slice(0, 10)`. `<input type="date">`/`type="time"` produce exactly `YYYY-MM-DD`/`HH:MM` — pass through untouched. Times arrive from the API as `HH:MM` already (the backend's mysql2 `typeCast` strips the seconds in one place); `formatTime` still does `slice(0, 5)` so it stays tolerant of `HH:MM:SS` as defensive code, and only `HH:MM` is ever sent. `dayOfWeek` is ISO 1–7 Monday-first; JS `getDay()` is 0–6 Sunday-first → `((getDay() + 6) % 7) + 1` in exactly one util. `publishedAt`/`expiresAt` are ISO datetimes with offset: `toIsoWithOffset()` converts the `datetime-local` value.
7. **Vite env**: only `VITE_*` reaches the client, only from `frontend/.env*`, inlined at **build** time (rebuild to change); `import.meta.env`, never `process.env`. A typo is silently `undefined` — `env.js` validates at boot.
8. **CORS vs proxy**: with the dev proxy there is no CORS. Without it, `Authorization` triggers a preflight the backend must answer (`cors` mounted before auth); a 401 on OPTIONS or a mismatched origin (`5174`, `127.0.0.1` vs `localhost`) shows up in the UI as `NETWORK_ERROR` "Cannot reach the server" — check the Network tab for a red OPTIONS before assuming the API is down. Proxy target is `127.0.0.1`, not `localhost` (IPv6 `::1` resolution on Node ≥ 17).
9. **React Query devtools** only under `import.meta.env.DEV`; check `vite build` output once to be sure they are not in the bundle.
10. **Query keys**: pass `apiParams` (plain object of strings/numbers), never `URLSearchParams`, functions or class instances.
11. **Strict query schemas**: the backend rejects unknown query params and non-whitelisted `sortBy` with 400. `useListParams` only emits the filters a page declares, and `DataTable` only sorts on columns with a `sortKey` from the whitelist in `03` §2 — do not invent `sortBy=email` on students.
12. **Bulk saves have different "unit of truth"**: the attendance sheet sends **every roster row** (unmarked default to `present`); the grade sheet sends **only rows with a score** (`score` is required per row; blank means still ungraded; removing a score is `DELETE /grades/:id`). Both require ≥ 1 row — Save is disabled otherwise. Both return the refreshed sheet, which replaces the local draft.
13. **Conflicts must stay in context**: `409 SCHEDULE_CONFLICT` renders `details.conflicts` inside the slot modal; `409 CONFLICT` with a field-shaped `details.key` goes under the field; `details.alreadyActive[]` / `activeEnrollmentId` and the transfer reasons (`no_active_enrollment`, `same_class`) go to the root alert of the enroll modal. A generic toast would lose the information needed to fix the input.
14. **Scope filters**: a student or teacher must not send `studentId`/`classId` filters they do not own — the backend answers 403 instead of narrowing. Student pages send no scope filters at all; teacher pages use `teacherId=me` (owned) or no filter (visible).
15. **Register race**: right after `POST /auth/register`, `/auth/me` could in theory answer `USER_NOT_REGISTERED` before the row is visible — the backend writes in one transaction before responding, so it is not expected; if it ever is, retry `/auth/me` once after 1 s only on the register path (`justRegistered` flag) before signing out.
16. **Lazy chunks after a deploy**: a tab opened before a redeploy fails to load new chunk hashes; the router `errorElement` shows "A new version is available — Reload".
17. **Role-shared pages** (`AttendanceMarkPage`, …) branch on `role` only for data source and action visibility, never for paths; internal links are built with `roleHome(role)` so a teacher is never sent to `/admin/...`.
18. **`queryClient.clear()` on sign-out** is mandatory, otherwise the next user on the same browser briefly sees the previous user's cached dashboard.
19. **OneDrive + spaces in the path** (`05` §5): run `npm ci`/`vite` from a path outside OneDrive or pause sync; quote every path in scripts.

---

## 10. Resolved decisions (formerly open questions; the plan's Decisions log in `PROJECT_PLAN.md` §5 is the authority)

1. **Term values** — resolved (plan D6): `term` is the shared ENUM `term1|term2|term3` (`TERMS` in `constants/shared.js`, labels "Term 1/2/3"); the assessment form and the student grades filter are selects built from it, never free text.
2. **Time format in responses** — resolved (plan D16): the backend's mysql2 `typeCast` returns TIME as `HH:MM`; `formatTime` keeps `slice(0, 5)` as defensive code only.
3. **Unregistered-user code** — resolved (plan D2): `403 USER_NOT_REGISTERED` is the only code for a valid token with no `users` row; the frontend keys off `FORCE_SIGN_OUT_CODES`.
4. **Dev API base** — resolved (plan D15): the code default for `VITE_API_BASE_URL` is `/api/v1` (Vite proxy) and `VITE_API_DOCS_URL` defaults to `/api/docs`; an absolute URL is set only for a deployed build or when running without the proxy.
5. **Teacher announcements** — resolved: mirror the API — all three audiences available, `classId` required for teachers.
6. **Class transfer atomicity** — resolved (plan D4): one call, `POST /enrollments/transfer { studentId, classId }`, in a single backend transaction (old row → `transferred`, new row opened); there is no half-done state to recover from.
