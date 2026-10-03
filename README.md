# School Management System

A web application for managing a school: student, teacher and administrator accounts, Firebase Authentication, MySQL database, Express REST API, student enrollment and profiles, subjects and classes, teacher assignment, attendance, grades, class schedules, announcements, role-specific dashboards, search and filtering, role-based access control and Swagger API documentation.

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite 8, React Router 8, TanStack Query 5, Tailwind CSS 4, Firebase JS SDK (email/password) |
| Backend | Node.js 24, Express 5, mysql2, firebase-admin, zod, Swagger UI |
| Database | MySQL 8.0 |
| Identity | Firebase Authentication (Spark plan, no cost) |

Everything used by this project is free: no paid services, no credit card.

> Status: under construction. The full setup guide, demo credentials and troubleshooting table are added when the first runnable version lands. The design is documented in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Repository layout

```
backend/    Express API, MySQL schema and seed, scripts, tests, OpenAPI spec
frontend/   React single-page app
docs/       Project plan and design documents
```
