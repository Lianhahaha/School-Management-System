# Skole

Skole is a web-based school management system: student, teacher and administrator accounts, enrollment, classes and subjects, teacher assignment, attendance, grades, timetables, announcements and a separate dashboard for each role. Identity is handled by **Firebase Authentication**, all data lives in **MySQL**, and everything is exposed through a documented **REST API**.

**Live demo:** <https://school-management-system-b0a2a.web.app> (sign in with a [demo account](#demo-accounts)). It runs on free tiers: the API sleeps after 15 idle minutes, so the first request after a pause can take about a minute, and the free MySQL service can be switched off after long inactivity. The local setup below needs none of that.

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
| Student, teacher and admin accounts | Admin → Users (create any role, deactivate, delete an unused account); students can also self-register on the sign-up page |
| Firebase Authentication | Sign in / sign up / forgot password; the API verifies the Firebase ID token on every request |
| MySQL database | 12 tables with foreign keys, unique keys and checks: [backend/database/schema.sql](backend/database/schema.sql) |
| Backend REST API | 64 endpoints under `/api/v1`, one JSON envelope, one error catalogue |
| Student enrollment and profiles | Admin → Students (enroll, transfer, profile, history); students edit their own contact details |
| Subjects and class management | Admin → Subjects, Classes |
| Teacher assignment | Class detail → Subjects & Teachers |
| Attendance tracking | Teachers mark a roster per lesson and day; students see their own percentage |
| Grade management | Assessments with a maximum score, grade sheets, per-subject results for students |
| Class schedules | Weekly timetables per class, teacher and student, with clash detection (class, teacher, room) |
| Announcements | School-wide or per class, per audience, with publish and expiry dates |
| Separate dashboards | Admin, teacher and student each get their own content, not three skins of one page |
| Light and dark themes | Switch in the top bar (and on the sign-in page); the choice is remembered on the device, and the system setting is followed until you pick one |
| Search and filtering | Every list: search, whitelisted sorting, pagination and filters, kept in the URL |
| Role-based access control | Route guards in the UI, `authorize` + ownership rules in the API (the API is the enforcement point) |
| API documentation | Swagger UI at <http://localhost:3000/api/docs> |

The full requirement-to-implementation matrix, with a way to verify each row, is in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md#2-requirement-coverage-matrix).

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
npm run db:migrate    # creates the database and the 12 tables
npm run db:seed       # 13 demo accounts (Firebase + MySQL), subjects, classes, timetable, attendance, grades
```

`npm run db:reset` drops the database and does both steps again. `db:seed` is safe to run twice.

### 5. Run

Two terminals:

```powershell
cd backend;  npm run dev       # API on http://localhost:3000   (docs: /api/docs)
cd frontend; npm run dev       # app on http://localhost:5173
```

Open <http://localhost:5173> and sign in with a demo account.

## Demo accounts

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

`student1` to `student8` and `teacher1` to `teacher3` all exist; the full list is in [backend/scripts/seed.js](backend/scripts/seed.js). A new student can also register at `/register`; the account is a student and starts without a class until an admin enrolls it.

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

## Project tour

```
backend/
  database/    schema.sql (12 tables) and seed.sql (demo data)
  docs/        openapi.yaml, the spec behind /api/docs
  scripts/     migrate, seed, doctor, get-token, check-constants, check-secrets
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
| `EADDRINUSE` on 3000 or 5173 | Another process holds the port. Stop it, or change `PORT` in `backend/.env` (and the proxy target in `frontend/vite.config.js`). |
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
   Any database that shares the Firebase project shares its logins: seeding a second database re-links the accounts, so run `npm run db:seed` on the other one afterwards.
2. **API.** In Render choose **New > Blueprint**, pick this repository, and enter the secret variables listed in `render.yaml` (database details, `DB_SSL_CA` as one line with a literal backslash and `n` for each line break, `FIREBASE_SERVICE_ACCOUNT_BASE64` = the service-account JSON base64-encoded, and `CORS_ORIGINS` = the frontend's address). Check `https://<service>.onrender.com/api/v1/health`.
3. **Frontend.** Put `VITE_API_BASE_URL=https://<service>.onrender.com/api/v1` in `frontend/.env.production`, then:
   ```powershell
   cd frontend
   npm run build
   cd ..
   npx firebase-tools deploy --only hosting
   ```
   The site is served at `https://<project-id>.web.app`; Firebase Authentication already trusts that domain.

