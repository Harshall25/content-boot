# WorkMesh

A Jira-style board for planning your work: tasks, learning, projects, articles, videos and courses
move through **To Do → In Progress → Completed**. No sign-up: each board is opened with its own
access key.

**Stack:** Spring Boot 4 · Hibernate 7 · HikariCP · PostgreSQL (Neon) · React 19 + Vite

## Prerequisites

- **Java 21**
- **Node.js 22**
- A **PostgreSQL** database. A free [Neon](https://neon.tech) project works.

## 1. Set up the database

For a new, empty database, run [`src/main/resources/schema.sql`](src/main/resources/schema.sql)
once (Neon: *SQL Editor* → paste → *Run*).

For a database created by an older version of this project, run the files in
[`src/main/resources/db/`](src/main/resources/db/) in order instead.

## 2. Configure the connection

Copy the example config and fill in your database details:

```bash
cp src/main/resources/application.properties.example src/main/resources/application.properties
```

Or keep the placeholders and set environment variables instead:

| Variable | Example |
|---|---|
| `DB_URL` | `jdbc:postgresql://ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `DB_USERNAME` | `neondb_owner` |
| `DB_PASSWORD` | your password |

`application.properties` is git-ignored. Never commit real credentials.

## 3. Run the backend

```bash
./mvnw spring-boot:run
```

(Windows: `.\mvnw.cmd spring-boot:run`, or just press Run on `ContentCalendarApplication` in IntelliJ.)

The API starts on **http://localhost:8080**.

## 4. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The dev server forwards `/api` requests to the backend, so both must be running.

## 5. First use

Click **Create a new access key**, then save the key somewhere safe. It is the only way back
into your board: there is no password and no recovery. A device stays signed in for 30 days,
after which you enter the key again.

## Production build

```bash
cd frontend && npm run build      # static files in frontend/dist/
./mvnw -B package -DskipTests     # runnable jar in target/
```

## Project structure

```
src/main/java/me/harshal/content_calendar/
  auth/          access keys and the request interceptor
  config/        Spring MVC config
  controller/    REST endpoints (/api/content, /api/users)
  hibernate/     entities, repositories, SessionFactory config
  model/         records and enums shared with the API
src/main/resources/
  schema.sql     full schema for a fresh database
  db/            migrations for existing databases
frontend/src/    React app (Board, modals, onboarding, styles)
docs/            design docs for future features
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Could not resolve placeholder 'DB_PASSWORD'` | Create `application.properties` (step 2) or set the environment variables. |
| `This connection has been closed` on startup (Neon) | Use the host **without** `-pooler`: HikariCP is already a connection pool. |
| `Schema-validation: missing column / table` | The database is behind the code: run the files in `src/main/resources/db/`. |
| `violates check constraint ..._check` after adding an enum value | Run `db/migration-003-drop-enum-checks.sql`. |
| `Port 8080 was already in use` | Another instance is still running. Stop it, or start with `--server.port=8081` and update `frontend/vite.config.js`. |

## Roadmap

Planned features (collaboration, comments, mentions, notifications, email, GitHub PR linking,
Notion-like pages) are designed in [`docs/future-features/`](docs/future-features/README.md).
