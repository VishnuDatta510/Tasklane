# Manual steps

Everything a script cannot do for you, in the order you will hit it.
Items are marked **[required]**, **[required to deploy]**, or **[optional]**.

---

## What is already done

You do not need to redo any of this. It is recorded so you know what exists.

- Postgres 17 and Redis 7 are running as containers (`docker-compose.dev.yml`),
  with named volumes, so data survives `down` but not `down -v`.
- The database is migrated and seeded with a demo organization
  (Northwind Labs: 3 projects, 21 tasks, 6 people).
- `backend/.env` exists with a generated `SECRET_KEY`. It is gitignored.
- 78 backend tests pass; the frontend typechecks, lints, and builds.
- Both Docker images build (`docker compose build` exits 0).
- A Celery worker was run against Redis; assignment email and the overdue
  sweep both executed successfully.

---

## 1. Git — nothing is under version control yet **[required]**

This is the single most urgent item. There is no repository, so there is no
undo for anything in this directory.

```bash
cd "Org Dashboard"
git init
git add .
git status          # confirm no .env and no .venv are staged
git commit -m "TaskLane: Django + DRF backend and Next.js frontend"
```

`.gitignore` already excludes `.env`, `.venv/`, `node_modules/`, `.next/`,
`media/`, and `staticfiles/`. **Check `git status` before the first commit
anyway** — a secret committed once stays in history forever.

To push:

```bash
git remote add origin https://github.com/<you>/tasklane.git
git branch -M main
git push -u origin main
```

---

## 2. Ports — 8000 is taken on this machine **[required]**

Something else of yours (`diagnova`) is already serving on port 8000, so the API
dev server was configured to run on **8001** instead:

- `backend/.env` → the API is started with `python manage.py runserver 8001`
- `frontend/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:8001/api`

If you free port 8000, change **both** together, or the frontend will call a
port nothing is listening on. `docker-compose.yml` uses 8000 internally and can
stay as it is (containers have their own network).

---

## 3. Secrets **[required to deploy]**

| Variable | Where | What to do |
|---|---|---|
| `SECRET_KEY` | `backend/.env` | Already generated for dev. **Generate a different one for production** and never reuse it. |
| `DATABASE_URL` | `backend/.env` | Points at the local container. Replace with the managed database URL in production. |
| `REDIS_URL` | `backend/.env` | Same — replace with the managed Redis URL. |

Generate a production key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Store it in your host's secret manager (Fly secrets, Render environment groups,
GitHub Actions repository secrets). Never in a file you commit.

---

## 4. Email — currently prints to the console **[required to send real email]**

`EMAIL_BACKEND` is the console backend, so assignment and invitation emails are
written to the Celery worker's log instead of being delivered. That is correct
for development and useless in production.

To send real email, add to `backend/.env` (values from your provider):

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=<your api key>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=TaskLane <no-reply@yourdomain.com>
```

You will need to sign up with a provider (SendGrid, Postmark, Resend, Mailgun)
and verify a sending domain. **Nobody can do this step for you** — it requires
DNS records on a domain you own.

---

## 5. Celery — worker verified, Beat not **[mostly done]**

A real worker was run against Redis and both paths were confirmed end to end:
an assignment email (`send_assignment_email_task`) and the overdue sweep
(`flag_overdue_tasks`, returned `{'flagged': 1, 'cleared': 0}`). The retry
backoff and Celery **Beat** schedule are still unexercised.

Run a worker whenever you want background jobs to actually happen:

```bash
# terminal 1
cd backend && celery -A config worker --loglevel=info

# terminal 2 — assign a task to someone, then watch terminal 1
# You should see the task received and the email body printed.
```

Then check Beat:

```bash
cd backend && celery -A config beat --loglevel=info
```

Beat uses the database scheduler, so its schedule appears in
Django admin under **Periodic Tasks** after the first run.

---

## 6. Deployment **[required to deploy]**

Nothing is deployed. `docker-compose.yml`, both Dockerfiles, and the CI workflow
exist and the images build, but no hosting account is configured.

Whichever platform you pick, you must:

1. Create the app and a **managed Postgres** and **managed Redis** instance.
2. Set the environment variables from step 3, plus:
   - `DEBUG=False`
   - `ALLOWED_HOSTS=yourdomain.com`
   - `CORS_ALLOWED_ORIGINS=https://yourdomain.com`
   - `FRONTEND_URL=https://yourdomain.com`
3. Run `python manage.py migrate` on first deploy (the entrypoint does this
   automatically for the `web` service).
4. Create an admin user: `python manage.py createsuperuser`.
5. Point the frontend build at the deployed API. `NEXT_PUBLIC_API_URL` is
   **inlined at build time**, not read at runtime — you must rebuild the
   frontend image to change it.

`python manage.py check --deploy` passes with `DEBUG=False`, so the security
headers, HSTS, and cookie flags are already configured.

---

## 7. GitHub Actions **[optional until you push]**

`.github/workflows/ci.yml` runs lint, `makemigrations --check`, schema
generation, the test suite against real Postgres and Redis, `check --deploy`,
the frontend typecheck/lint/build, and both Docker builds.

It needs no secrets as written. It will not run until the repository exists on
GitHub (step 1).

---

## 8. File uploads **[required before production]**

Attachments are written to `backend/media/` on local disk. That works on one
machine and fails the moment you run more than one web container, because each
one has its own filesystem.

For production, switch to object storage:

```bash
pip install django-storages boto3
```

then set `STORAGES["default"]` in `backend/config/settings.py` to the S3
backend and supply bucket credentials. This is a real code change, not just
configuration.

---

## Known gaps

Stated plainly so nothing surprises you later.

- **Attachment upload is untested.** No test posts a file. The size and
  content-type validation has never executed. The type check compares the
  client-supplied `content_type` against the filename extension — it does not
  sniff the file's actual bytes, which a determined uploader can defeat.
- **`Task.number` allocation is racy.** `Task.save()` reads `MAX(number)` and
  writes `max + 1` with no lock. Two simultaneous creates in one project
  collide; the unique constraint turns that into a 409 rather than corruption,
  but there is no retry.
- **No refresh-token blacklist.** Signing out clears the browser's storage but
  cannot revoke the refresh token server-side; it stays valid for 7 days. Add
  `rest_framework_simplejwt.token_blacklist` if that matters to you.
- **Tokens live in `localStorage`**, which is readable by any XSS. A deliberate
  trade for a cross-origin SPA; httpOnly cookies would be stricter.
- **Two sources of truth for "overdue"** — the stored `Task.is_overdue` flag
  written by the hourly sweep, and the computed `Task.overdue` property. They
  can disagree for up to an hour.
- **No frontend tests.** No Jest, Vitest, or Playwright.
- **`delete_pattern`** (dashboard cache invalidation) is a `django-redis`
  extension. Under a different cache backend it silently degrades to TTL-only
  expiry.
- **Five ESLint warnings** for `react-hooks/set-state-in-effect` remain. They
  are false positives on async fetch effects; the rule is set to `warn` with the
  reasoning written into `frontend/eslint.config.mjs`. The genuine violations it
  caught were fixed.
