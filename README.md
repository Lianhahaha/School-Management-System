# Skole

[![Backend tests](https://github.com/Lianhahaha/School-Management-System/actions/workflows/backend-tests.yml/badge.svg)](https://github.com/Lianhahaha/School-Management-System/actions/workflows/backend-tests.yml)

Skole is a web-based school management system: student, teacher and administrator accounts, enrollment, classes and subjects, teacher assignment, attendance, grades, timetables, announcements and a separate dashboard for each role. Identity is handled by **Firebase Authentication**, all data lives in **MySQL**, and everything is exposed through a documented **REST API**.

**Live demo:** <https://skoleph.web.app> (sign in with a [demo account](#demo-accounts)). It runs on free tiers: the API sleeps after 15 idle minutes, so the first request after a pause can take about a minute, and the free MySQL service can be switched off after long inactivity. The local setup below needs none of that.

Skole can be installed like an app: on Android, Chrome or Edge use the browser's install button or **Install app** in the account menu; on an iPhone use Share → **Add to Home Screen**.

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite 8, React Router 8, TanStack Query 5, Tailwind CSS 4, Firebase JS SDK (email/password) |
| Backend | Node.js 24, Express 5, mysql2, firebase-admin, zod, Swagger UI |
| Database | MySQL 8.0 |
| Identity | Firebase Authentication (Spark plan) |

**Everything used here is free: no paid service, no credit card.** MySQL and both Node apps run on your machine; Firebase Authentication's Spark plan costs nothing and never asks for a card.

## What it does

| Required feature | Where to see it |
|---|---|
| Student, teacher and admin accounts | Admin → Users (create any role, deactivate, delete an unused account); students can also self-register on the sign-up page; Admin → Students → Import creates up to 200 students from a CSV file (template included), each checked before anything is created and each given their own temporary password, listed in a file to download |
| Firebase Authentication | Sign in / sign up / forgot password; the API verifies the Firebase ID token on every request |
| MySQL database | 17 tables with foreign keys, unique keys and checks: [backend/database/schema.sql](backend/database/schema.sql) |
| Backend REST API | 74 endpoints under `/api/v1`, one JSON envelope, one error catalogue |
| Student enrollment and profiles | Admin → Students (enroll, transfer, profile, history); students edit their own contact details; at the end of a school year, Admin → Classes → a class → Students → **End of school year** closes the year for all or some students and enrolls them in next year's class in one step; after that a student enrolls themselves from their dashboard in a section of the next grade level if they passed every subject, of the same grade level if they failed three or more, and waits for the school office after remedial classes if they failed one or two (DepEd promotion rules) |
| Subjects and class management | Admin → Subjects, Classes |
| Teacher assignment | Class detail → Subjects & Teachers |
| Attendance tracking | Teachers mark the students of each lesson, day by day; students see their own percentage, one school year at a time (earlier years too); a week-by-week rate chart for each class, lesson and student |
| Grade management | Assessments with a maximum score, grade sheets, per-subject results for students; each assessment belongs to the 1st Semester, 2nd Semester or Summer; subjects are graded the DepEd K-12 way by default (written work, performance tasks and the quarterly assessment, transmuted to 60–100, 75 passes, with descriptors from Outstanding to Did Not Meet Expectations), or on points, or weighted by assessment type (Admin → Subjects); a score-spread chart on every grade sheet and each student's results over time per subject; students pick a school year and semester ("AY 2025-2026 · 2nd Semester"), see an overview and each subject's breakdown, and can print the report card of any year |
| Class schedules | Weekly timetables per class, teacher and student, with clash detection (class, teacher, room) |
| Announcements | School-wide or per class, per audience, with publish and expiry dates; a "New" label until the reader marks one, or all, as read |
| Separate dashboards | Admin, teacher and student each get their own content, not three skins of one page; admins and teachers see the students who need attention (attendance under 80 % or an average under 75 %) |
| Search and filtering | Every list: search, whitelisted sorting, pagination and filters, kept in the URL |
| Role-based access control | Route guards in the UI, `authorize` + ownership rules in the API (the API is the enforcement point) |
| API documentation | Swagger UI at <http://localhost:3000/api/docs> |

The full requirement-to-implementation matrix, with a way to verify each row, is in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md#2-requirement-coverage-matrix).

Beyond the brief, kept small and built on the same API:

| Extra | Where to see it |
|---|---|
| Notifications | The bell in the top bar, with a red count: students hear about new or changed grades, absences and a new class; teachers about lessons and homeroom classes they get; admins about students who signed up and need a class; new announcements are listed there too |
| Activity history | Admin → Activity: who changed what and when (grades with the previous score, attendance marks, enrollments, accounts, classes, timetable, announcements, calendar), searchable by name and filterable by area and day |
| School calendar | Admin → Calendar: holidays (no classes, attendance can't be marked) and school events; every role sees the calendar, the next 30 days on its dashboard and this week's entries on its timetable |
| Live updates | The page you are looking at refreshes itself about every 20 seconds (and when you return to the tab), so other people's changes appear without a reload; the sheets a teacher is editing are left alone |
| Light and dark themes | Switch in the top bar (and on the sign-in page); the choice is remembered on the device, and the system setting is followed until you pick one |
| Search everywhere | Admins press Ctrl+K (⌘K on a Mac) to find a student, teacher, class or subject from any page |
| CSV and printing | Lists of grades and attendance download as CSV; report cards and timetables print cleanly |
| Install as an app | See above: the browser's install button, or Add to Home Screen on an iPhone |

## Quick start (Windows, $0)

### 1. Install once

- [Node.js 24 LTS](https://nodejs.org) (22.22 or newer also works; `node -v` to check)
- [MySQL Community Server 8.0](https://dev.mysql.com/downloads/mysql/) (8.0.19 or newer). Remember the `root` password you choose; the Windows service is called `MySQL80`.
- Git, and a Google account for Firebase.

### 2. Create the free Firebase project (about 5 minutes)

1. <https://console.firebase.google.com> → **Create a project** → turn **Google Analytics off**. Never click Upgrade.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable** → Save.
3. **Project settings (gear) → General → Your apps → `</>` Web** → register an app (leave Firebase Hosting unticked). Keep the four values it shows: `apiKey`, `authDomain`, `projectId`, `appId`.
4. **Project settings → Service accounts → Generate new private key.** Save the downloaded file as `backend/firebase-service-account.json` (exactly that name; it is git-ignored and must never be committed or pasted into `.env`).

### 3. Configure and install

```powershell
cd backend
npm install
Copy-Item .env.example .env        # then set DB_PASSWORD to your MySQL root password

cd ..\frontend
npm install
Copy-Item .env.example .env        # paste the four Firebase web values from step 2.3
```

Both `.env` files must belong to the **same** Firebase project.

### 4. Check, create the database, load demo data

```powershell
cd ..\backend
npm run doctor        # every line should be a green tick; it tells you what to fix otherwise
npm run db:migrate    # creates the database and the 17 tables
npm run db:seed       # 13 demo accounts (Firebase + MySQL), subjects, classes, timetable, attendance, grades
```

`npm run db:reset` drops the database and does both steps again. `db:seed` is safe to run twice.

### 5. Run

From the repo root, once: `npm install`. Then one command starts both:

```powershell
npm run dev                    # API on http://localhost:3000 (docs: /api/docs) and app on http://localhost:5173
```

Or run them separately in two terminals:

```powershell
cd backend;  npm run dev
cd frontend; npm run dev
```

Open <http://localhost:5173> and sign in with a demo account.

## Demo accounts

These come from `npm run db:seed` on a local database. The live site no longer has the demo students (`student1` to `student8`); students there register themselves at `/register`. A new administrator for an empty database comes from `npm run db:create-admin -- <email> <password>`.

Password for every account: `Password123!` (change it with `SEED_PASSWORD` in `backend/.env` before seeding).

| Account | Name | Role and what to look at |
|---|---|---|
| `admin@school.test` | Amara Johnson | Admin: school-wide counts, users, students, classes, subjects, timetable, all announcements |
| `admin2@school.test` | Noah Bennett | Second admin, so you can safely deactivate an admin and see the effect |
| `teacher1@school.test` | Alice Morgan | Teacher: Maths and Computer Science, homeroom of Grade 10 - A; today's lessons, pending grading |
| `teacher2@school.test` | Brian Chen | Teacher: English and History |
| `teacher3@school.test` | Carla Diaz | Teacher: Science, homeroom of Grade 10 - B |
| `student1@school.test` | Daniel Okafor | Student in Grade 10 - A: timetable, attendance, grades, class announcements |
| `student4@school.test` | Grace Kim | Student in Grade 10 - A who was transferred in from 10 - B (enrollment history) |
| `student5@school.test` | Hiro Tanaka | Student in Grade 10 - B |

`student1` to `student8` and `teacher1` to `teacher3` all exist; the full list is in [backend/scripts/seed.js](backend/scripts/seed.js). A new student can also register at `/register`; the account is a student and starts without a class until an admin enrolls it (self-enrollment starts from their second school year, once there is a finished year to judge).

## Trying the API

Open <http://localhost:3000/api/docs>, then:

```powershell
cd backend
npm run token --silent -- teacher1@school.test     # prints a Firebase ID token (valid 1 hour)
```

Click **Authorize** in Swagger UI, paste the token, and call any endpoint. The same token works with curl: `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/dashboard`.

## Quality checks

```powershell
cd backend
npm test               # constants check + API test suite (needs MySQL; no Firebase, no network)
npm run lint
npm run check:secrets  # fails if a key or .env file would be committed

cd ..\frontend
npm run check          # lint + production build
```

The backend tests use a separate `school_management_test` database and an in-memory fake of Firebase, so they never touch your real data or your Firebase project.

GitHub runs the same backend checks (lint, secrets check, `npm test` against MySQL 8) on every push and pull request: see [.github/workflows/backend-tests.yml](.github/workflows/backend-tests.yml) and the **Actions** tab. Every push to `main` also deploys the frontend ([deploy-frontend.yml](.github/workflows/deploy-frontend.yml)); Render deploys the API on its own.

## Project tour

```
backend/
  database/    schema.sql (17 tables) and seed.sql (demo data)
  docs/        openapi.yaml, the spec behind /api/docs
  scripts/     migrate, seed, create-admin, doctor, get-token, check-constants, check-secrets
  src/
    modules/   one folder per feature: routes → controller → service → repository (+ zod schemas)
    middleware/ config/ utils/ constants/
  tests/       node:test + supertest against the real app
frontend/
  src/
    features/  one folder per feature: api, hooks, schemas, components, pages
    components/ hooks/ lib/ utils/ config/ app/
docs/          ARCHITECTURE.md (start here), PROJECT_PLAN.md (requirements, decisions), design/
DESIGN.md      the visual design system: colours for both themes, type, components, rules
```

A bug is found by following one path: the URL names the route file, the route names its controller, the controller calls a service, the service calls a repository. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the design with an ER diagram; [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) records every decision and why.

## Design decisions and known limits

These are deliberate choices, not oversights. The reasons are in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md#14-implementation-notes-where-the-built-code-deliberately-differs-from-the-plan).

- **Email addresses are not verified before first use.** A student who registers can sign in straight away, so the demo works without a mailbox. Accounts created by an admin, the CSV import or the seed are marked verified. An admin can delete an account that was registered by mistake and has no history.
- **Deactivation takes effect on the next request.** The API reads the account from MySQL on every request, so a deactivated user is refused at once, even though their Firebase token stays valid for up to an hour.
- **Attendance rate = (present + late) / all marks.** An excused absence counts as a missed lesson; the status keeps the reason on record.
- **A subject's grade follows DepEd Order No. 8, s. 2015 unless an admin chooses otherwise.** Quizzes, tests and assignments count as written work, projects as performance tasks and exams as the quarterly assessment. A component with nothing graded yet is left out until it has grades, so a result early in the term is not dragged down by an exam that has not happened.
- **Grading rules belong to a subject, not to a year.** Changing the method, the group or a weight recalculates the subject's results in every year, past ones too, and the subject form says so. An assessment type with nothing graded yet is left out and the other weights are scaled up, so an ungraded exam neither helps nor hurts a result in the middle of a term.
- **Past academic years stay editable** by the lesson's teacher and by admins, for late corrections. Every change is in the activity log with the previous value. A date must fall inside the class's academic year.
- **Semesters are names, not new data.** The API and the database keep the terms `term1`, `term2` and `term3`; the app shows them as 1st Semester, 2nd Semester and Summer.
- **Students only enroll themselves into what their last finished year allows.** The server works out the standing again on every self-enrollment, so a student cannot pick another grade level or a section that was not offered. A student with no finished year, no grades in it, or 1–2 failed subjects is placed by the school office.
- **End of school year closes enrollments on the day it runs.** Run it after the last school day: from that day the students leave the class's attendance and grade sheets (earlier days stay editable) and appear in next year's class. A completed enrollment cannot be reopened, so the action is refused for a year that has not started.
- **Two people editing one sheet do not overwrite each other.** When an attendance or grade sheet changed since it was loaded, the second save is refused (409 `sheet_changed`) and the page offers a reload.
- **Imported students get a random temporary password each**, shown once in a file to download; nothing in the request sets a shared password.
- **Local development shares the Firebase project with the live site.** Outside production the API never deletes a Firebase user it does not know, because it may be a live user.
- **`npm run db:migrate` creates missing tables and applies the upgrades listed in [scripts/migrate.js](backend/scripts/migrate.js)**; it does not change existing columns. `--fresh` drops the database first and is refused for a database that is not on this machine unless `--allow-remote-drop` is added.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running. Start the `MySQL80` service (`services.msc`, or `net start MySQL80` in an administrator terminal). |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_PASSWORD` in `backend/.env`. Wrap the value in double quotes if it contains `#` or spaces. |
| `Firebase service account file not found` | Save the key from Firebase console → Service accounts as `backend/firebase-service-account.json`. |
| Every request returns 401 / "token audience" | `frontend/.env` and the service account belong to different Firebase projects. `npm run doctor` shows both ids. |
| `auth/operation-not-allowed` on sign-in | Enable Email/Password under Authentication → Sign-in method. |
| Signed in, but the API answers `USER_NOT_REGISTERED` | The Firebase user has no row in MySQL (it was created in the console). Run `npm run db:seed`, register from the app, or create the user from Admin → Users. |
| `ACCOUNT_DISABLED` | An admin deactivated the account; reactivate it from Admin → Users. |
| Creating a user answers "already has a sign-in in the shared Firebase project" | Local development shares the Firebase project with the live site, so an email that signs in there is left alone. Use another email, or create the account on the live site. |
| `EADDRINUSE` on 3000 or 5173 | Another process holds the port. Stop it, or move the API: in PowerShell `$env:PORT='3001'; $env:API_PORT='3001'; npm run dev` (`API_PORT` points the frontend's proxy at the same port). |
| `EPERM` / `EBUSY` during `npm install` | OneDrive is syncing `node_modules`. Move the project outside OneDrive (for example `C:\dev\school-management-system`) or pause syncing. |
| `Cannot find module` | Run `npm install` in the folder you are starting from. |
| Weekday or "today" looks off by one | Set `APP_TIMEZONE` in `backend/.env` to the school's IANA zone (for example `Asia/Manila`) and restart. |

## Deploying for free (optional)

Not required to run or review the project: everything above works on one machine. To put it online at no cost, the three parts go to three free services (limits as checked on 2026-10-04; free tiers change, so confirm the provider's current terms):

| Part | Service | Free-tier limits that matter |
|---|---|---|
| Database | [Aiven for MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), **Free** plan | 1 GB, one service per organization, may be powered off after long inactivity (switch it back on in the console) |
| API | [Render](https://render.com/docs/free) web service from `render.yaml` | sleeps after 15 idle minutes (the next request takes about a minute), 750 free hours a month |
| Frontend | Firebase Hosting (Spark plan) from `firebase.json` | static files only |

1. **Database.** Create the Aiven MySQL service on the Free plan, download its CA certificate to `backend/database-ca.pem`, and put its connection details in a git-ignored `backend/.env.cloud` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`, `DB_SSL_CA_PATH=./database-ca.pem`). Then:
   ```powershell
   cd backend
   node --env-file=.env.cloud scripts/migrate.js
   node --env-file=.env.cloud scripts/seed.js
   ```
   Any database that shares the Firebase project shares its logins. Seeding a second database links the demo accounts' existing Firebase users (it resets their password to `SEED_PASSWORD`), so both databases keep working. Outside production the API never deletes a Firebase user it does not know, because it may belong to the other database: creating an account for such an email answers 409 `email_in_use`.
2. **API.** In Render choose **New > Blueprint**, pick this repository, and enter the secret variables listed in `render.yaml` (database details, `DB_SSL_CA` as one line with a literal backslash and `n` for each line break, `FIREBASE_SERVICE_ACCOUNT_BASE64` = the service-account JSON base64-encoded, and `CORS_ORIGINS` = the frontend's address). Check `https://<service>.onrender.com/api/v1/health`.
3. **Frontend.** Put `VITE_API_BASE_URL=https://<service>.onrender.com/api/v1` in `frontend/.env.production`, then:
   ```powershell
   cd frontend
   npm run build
   cd ..
   npx firebase-tools deploy --only hosting
   ```
   The site is served at `https://<site-id>.web.app`, where the site id is the `site` in `firebase.json` (`skoleph` here; create another with `npx firebase-tools hosting:sites:create <name>`). Firebase Authentication trusts it automatically, but add the new address to the API's `CORS_ORIGINS` on Render.

### Keeping the live site healthy

- **Releases.** The frontend is released by GitHub Actions only after the backend tests pass for that commit ([deploy-frontend.yml](.github/workflows/deploy-frontend.yml)). Set Render to do the same: service → Settings → Build & Deploy → Auto-Deploy → **After CI Checks Pass**.
- **Schema changes.** `migrate.js` creates missing tables and runs the upgrades listed in it; it never alters an existing table on its own. A change to an existing table gets an entry in its `UPGRADES` list, and runs on the hosted database before the code that needs it: `node --env-file=.env.cloud scripts/migrate.js`.
- **Resetting the demo data.** The demo is shared, and some actions cannot be undone (a completed school year, a deleted account). To start over: `node --env-file=.env.cloud scripts/migrate.js --fresh --allow-remote-drop`, then `node --env-file=.env.cloud scripts/seed.js`. **This deletes every row in the hosted database.**
- **Local work and live sign-ins.** While local development shares the Firebase project with the live site, seeding a local database resets the demo accounts' passwords and signs them out everywhere, the live site included. A second free Firebase project for local work (step 2 of the quick start, with its own `.env` values) keeps the two apart.
- **Secrets.** `.env.cloud`, the service-account key and the CA certificate are git-ignored. Keep them out of synced folders (OneDrive, Dropbox) too.
- **Mock school for manual testing.** `node --env-file=.env.cloud scripts/mock-data.js add` (from `backend/`) fills the database with a tagged mock school: 39 sign-ins (`admin@mock.skole.test`, teachers such as `dizon@mock.skole.test`, students such as `juan.delacruz@mock.skole.test`; password `MockPass123!`), classes for last, this and next school year, timetables, attendance since August, grades in every period, announcements, calendar entries and notifications. `status` lists it, and `remove` deletes every mock row and sign-in, plus anything done to mock records while testing. Use `--env-file=.env` for the local database.
- **Before a demo.** Open the API's `/api/v1/health` a minute ahead so the free server is awake, and check in the Aiven console that the database is powered on.

