# rsvp-confirmation

WhatsApp-based RSVP management system for Wedding Planners.  
Non-technical operators import a guest list, trigger an automated conversational flow, and track responses through a simple dashboard — no manual messaging required.

---

## Status

| Phase | Status |
|-------|--------|
| Phase 0 — Foundation | ✅ Complete |
| Phase 1 — MVP (auth, events, guests, state machine, workers) | 🔄 In progress |
| Phase 2 — Operational improvements | Planned |
| Phase 3 — Configurable flows | Planned |
| Phase 4 — SaaS | Future |

See [Implementation Plan](docs/superpowers/plans/2026-04-01-whatsapp-rsvp-wedding-planner.md) and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for architecture decisions and next steps.

---

## Architecture

```
apps/api      — Express + TypeScript (port 3001)
apps/web      — Next.js 14 admin dashboard (port 3000)
packages/shared — Shared TypeScript types
```

- **Database:** PostgreSQL 16 via Prisma 5
- **Queue:** BullMQ 5 + Redis 7
- **Messaging:** WhatsApp Business Cloud API (Meta)
- **Auth:** bcrypt + express-session + connect-pg-simple
- **Deployment:** Heroku (web + worker dynos)
- **Local infra:** Docker Compose (postgres + redis)

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- [OrbStack](https://orbstack.dev/) or Docker Desktop

### First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and fill in values
cp apps/api/.env.example apps/api/.env
# Required values: SESSION_SECRET, WA_VERIFY_TOKEN, WA_APP_SECRET, WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID
# DATABASE_URL and REDIS_URL are pre-filled for Docker Compose

# 3. Start backing services
docker compose up -d

# 4. Run database migrations
pnpm --filter api db:migrate

# 5. Seed a dev admin user
pnpm --filter api db:seed

# 6. Start all services
pnpm dev
# → Express API on :3001
# → Next.js dashboard on :3000
```

### Expose webhook for WhatsApp testing

```bash
cloudflared tunnel --url http://localhost:3001
# Copy the https://xxxx.trycloudflare.com URL
# In Meta Developer Console → WhatsApp → Configuration → Webhook:
#   Callback URL: https://xxxx.trycloudflare.com/api/v1/webhook/whatsapp
#   Verify token: (WA_VERIFY_TOKEN from .env)
```

### Useful commands

```bash
pnpm dev                      # Start API + web in dev mode
pnpm test                     # Run all tests
pnpm --filter api test        # API tests only
pnpm --filter api db:studio   # Open Prisma Studio (DB GUI) on :5555
pnpm --filter api db:migrate  # Apply new migrations
docker compose up -d          # Start postgres + redis
docker compose down           # Stop backing services
```

---

## Project Structure

```
apps/api/src/
  config/         ← env, db, redis, logger, queue singletons
  middleware/     ← auth, error-handler, rate-limit
  domains/
    auth/         ← login, logout, session
    events/       ← event CRUD + campaign launch
    guests/       ← guest CRUD + CSV import pipeline
    conversations/← state machine + service layer
    whatsapp/     ← send message service (Cloud API)
    webhooks/     ← webhook router + HMAC validation
    rsvp/         ← responses read + CSV export
  jobs/
    queues.ts            ← BullMQ queue instances
    worker.ts            ← worker entry point (Heroku worker dyno)
    send-message.job.ts  ← outbound message handler
    process-inbound.job.ts ← inbound message handler

packages/shared/src/
  types/          ← ConversationStep enum, ApiResponse types
```

---

## Environment Variables

See `apps/api/.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Min 32 chars, random — `openssl rand -hex 32` |
| `WA_VERIFY_TOKEN` | Token set in Meta Developer Console |
| `WA_APP_SECRET` | From Meta App settings (for HMAC validation) |
| `WA_ACCESS_TOKEN` | System user permanent token |
| `WA_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `WA_API_VERSION` | Default: `v19.0` |
| `NODE_ENV` | `development` / `production` |
| `PORT` | Default: `3001` |

---

## API Routes (Phase 1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/v1/auth/login` | — | Email/password login |
| `POST` | `/api/v1/auth/logout` | ✓ | Destroy session |
| `GET` | `/api/v1/auth/me` | ✓ | Current user |
| `GET` | `/api/v1/events` | ✓ | List events |
| `POST` | `/api/v1/events` | ✓ | Create event |
| `GET` | `/api/v1/events/:id` | ✓ | Get event |
| `PATCH` | `/api/v1/events/:id` | ✓ | Update event |
| `POST` | `/api/v1/events/:id/launch` | ✓ | Launch RSVP campaign |
| `GET` | `/api/v1/events/:id/guests` | ✓ | List guests |
| `POST` | `/api/v1/events/:id/guests/import` | ✓ | Preview CSV import |
| `POST` | `/api/v1/events/:id/guests/import/confirm` | ✓ | Commit CSV import |
| `GET` | `/api/v1/events/:id/responses` | ✓ | RSVP responses |
| `GET` | `/api/v1/events/:id/responses/export` | ✓ | CSV export |
| `GET` | `/api/v1/events/:id/responses/stats` | ✓ | Response stats |
| `GET` | `/api/v1/webhook/whatsapp` | — | Webhook verification |
| `POST` | `/api/v1/webhook/whatsapp` | — | Receive messages |

---

## Conversation Flow

```
Guest receives template → replies YES
  → INITIAL_SENT → AWAITING_ATTENDANCE
  → replies YES → AWAITING_COMPANIONS
  → replies "2" → AWAITING_DIETARY
  → replies "sin gluten" → COMPLETE
```

STOP at any point → `ConsentRecord.status = REVOKED`, no further messages.

---

## Deployment (Heroku)

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-redis:mini
heroku config:set SESSION_SECRET=$(openssl rand -hex 32)
# ... set WA_* vars
git push heroku main
heroku ps:scale worker=1
```

See [Heroku Deployment Plan](docs/superpowers/plans/2026-04-01-whatsapp-rsvp-wedding-planner.md#heroku-deployment-plan) for full instructions.
