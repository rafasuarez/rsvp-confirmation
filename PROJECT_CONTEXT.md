# PROJECT_CONTEXT.md

## Current Phase
Phase 0 — Foundation (completed 2026-04-01)
Phase 1 — MVP backend API (completed 2026-04-01, 111 tests)
Phase 1 — Admin dashboard (completed 2026-04-01, Next.js 14 + shadcn/ui)

## What This Is
WhatsApp-based RSVP management system for Wedding Planners.
Non-technical operator tool. Not a developer product.

## Architecture Summary
- pnpm monorepo: apps/api (Express), apps/web (Next.js 14), packages/shared
- PostgreSQL via Prisma (source of truth)
- BullMQ + Redis (async message processing)
- WhatsApp Business Cloud API (messaging)
- Heroku deployment (web + worker dynos)
- Docker Compose (local postgres + redis)

## Key Architectural Decisions

### Why Express over Next.js API routes for the backend?
Webhooks require a long-lived process (not serverless). BullMQ workers share the same process.
Express gives direct middleware control needed for HMAC validation and session management.

### Why hardcoded conversation steps in Phase 1?
FlowStep table exists in schema but is not used until Phase 3.
Hardcoded steps are faster to build, easier to test, and sufficient for MVP.
The pure state machine design makes the Phase 3 upgrade a small change in the service layer.

### Why separate consent_records table?
Consent lifecycle is independent of guest data. GDPR requires explicit tracking.
A ConsentRecord row exists for every guest. Only GRANTED status allows RSVP messages.
REVOKED status permanently blocks all future messages.

### Why BullMQ and not direct webhook processing?
WhatsApp requires HTTP 200 within 30 seconds. Processing a message and sending a reply
can take > 30s under load. BullMQ decouples receipt from processing. Also enables retries.

### Why sessions over JWT?
Simple single-user tool in Phase 1. Sessions are easier to revoke. connect-pg-simple
uses the existing Postgres instance — no additional store needed. JWT added complexity
only pays off with multi-device or API key scenarios (Phase 4+).

### Why raw body preservation for webhook?
HMAC-SHA256 validation requires the exact raw bytes of the request body. Using
`express.raw()` on the webhook route (before `express.json()`) preserves the Buffer.
JSON.parse is done manually after HMAC validation passes.

## Assumptions
- See docs/superpowers/plans/2026-04-01-whatsapp-rsvp-wedding-planner.md §3
- Guest consent to be contacted is pre-obtained by the couple before planner imports list
- WhatsApp templates are pre-approved before Phase 1 launch

## Open Questions
- [ ] Which WhatsApp template names to use? (must be pre-approved in Meta dashboard)
- [ ] Should the initial consent message be in the guest's language or always Spanish?
- [ ] What is the max retry count for unreachable guests? (Currently: 3)
- [ ] Does the planner need email notifications when a campaign finishes?

## Risks
- See docs/superpowers/plans/2026-04-01-whatsapp-rsvp-wedding-planner.md §15

## Recent Changes
- 2026-04-01: Initial PROJECT_CONTEXT.md created. Full implementation plan written.
- 2026-04-01: Phase 0 implemented — monorepo scaffold, Prisma schema, Express bootstrap, webhook endpoint, Next.js shell.
- 2026-04-01: Phase 1 backend API implemented — auth, events CRUD, guest CSV import, conversation state machine, WhatsApp send service, BullMQ workers, conversation service layer, campaign launch, RSVP responses API. 111 tests passing.
- 2026-04-01: Phase 1 admin dashboard implemented — Next.js 14 App Router, shadcn/ui, login page, events list/create, event detail with stats, CSV import wizard, paginated responses table with filter + CSV export. Production build passing.

## Next Steps (Phase 2 — WhatsApp Integration)
1. **CRITICAL:** Submit WhatsApp template messages to Meta for approval (1–5 days to approve) if not done
2. Wire `send-message.job.ts` to real WhatsApp Cloud API (`WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`)
3. Wire `process-inbound.job.ts` state machine transitions to send next message in sequence
4. End-to-end RSVP flow test on a real WhatsApp number with a staging event
5. Heroku deploy — Phase 1 staging (web + worker dynos)
6. Add scheduled retry job for `UNREACHABLE` guests (max 3 retries, configurable backoff)
7. Email/push notification to planner when campaign completes
