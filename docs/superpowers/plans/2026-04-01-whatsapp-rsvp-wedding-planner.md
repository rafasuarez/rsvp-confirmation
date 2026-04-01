# WhatsApp RSVP Wedding Planner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WhatsApp-based RSVP management system for non-technical Wedding Planners to collect guest attendance, companion count, and dietary requirements via automated conversational flows — deployable on Heroku, scalable toward SaaS.

**Architecture:** pnpm monorepo with `apps/api` (Node.js + Express + TypeScript) and `apps/web` (Next.js 14 admin dashboard) sharing types via `packages/shared`. PostgreSQL via Prisma, BullMQ + Redis for async webhook processing, WhatsApp Business Cloud API for all messaging.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, Next.js 14 (App Router), Prisma 5, PostgreSQL 16, BullMQ 5, Redis 7, Zod 3, shadcn/ui, pnpm workspaces, Docker Compose (local), Heroku (production)

---

## Part 1 — Product Architecture

---

### 1. Product Summary

**What the app does:** A web-based admin tool for Wedding Planners that automates RSVP collection via WhatsApp. The planner imports a guest list, triggers an automated conversational flow, and tracks responses through a simple dashboard — without writing a single line of code or manually contacting guests.

**Who the user is:** A non-technical Wedding Planner. Not a developer. Not a technical operator. Someone who uses Excel, Gmail, and WhatsApp. They should feel like they are using a slightly smarter Google Form, not a developer tool.

**Problem being solved:**
- Wedding Planners today send RSVPs via WhatsApp manually — one guest at a time
- Tracking responses across 50–300 guests in a spreadsheet is error-prone and time-consuming
- Follow-ups require hours of manual re-messaging
- No central view of who has confirmed, declined, or not responded

**Why simplicity is the main design driver:** The Final User has zero tolerance for technical complexity. Every screen with a configuration option they don't understand is a support request. Every workflow that requires more than 3 clicks is something they'll abandon. If the product is powerful but confusing, it will not be adopted. Simplicity is not a nice-to-have — it is the primary product constraint.

---

### 2. Operating Principles

**Engineering Principles:**
- Small, focused files. 200–400 lines typical, 800 max. Split when you smell it getting fat.
- Immutability everywhere. Never mutate objects; return new ones.
- No deep nesting. Max 3 levels. Extract early returns.
- Functions do one thing. If you need "and" to describe a function, split it.
- Side effects at the edges. State machine logic is pure. I/O happens in services and jobs.
- Errors are handled explicitly — no swallowed exceptions.
- No `console.log` in production code. Use `pino` structured logging.
- Zod validates at all system boundaries (API input, webhook payloads, env vars).

**Product Principles:**
- One action = one screen. Don't combine unrelated actions.
- Safe defaults. Destructive actions require explicit confirmation.
- Language the planner uses — not developer language. "Guests who haven't replied" not "PENDING state".
- No raw state names in the UI. Map `AWAITING_ATTENDANCE` → "Waiting for response".

**What we are NOT building yet (Phase 1):**
- Multi-tenant / multiple planners per account
- Configurable conversation flows (hardcoded in Phase 1)
- WhatsApp interactive buttons/lists (text-based replies only in Phase 1)
- Billing or subscription management
- Email notifications to the planner
- Analytics or charts
- Mobile app
- Multi-language UI (UI is Spanish for Phase 1; conversations support es/en per guest)

---

### 3. Assumptions and Constraints

| Area | Assumption |
|------|------------|
| WhatsApp API | WhatsApp Business Platform Cloud API (Meta). Phone number registered and approved. Template messages pre-approved for consent request. |
| Consent | Consent to contact is pre-obtained by the couple and provided to the planner along with the guest list. The platform tracks this as an internal auditable flag — it does NOT initiate contact without recording consent. |
| Guest data | Guest list provided as CSV: `first_name, last_name, phone, email (optional)`. Phone in any common format; normalized to E.164 on import. |
| Database | PostgreSQL is the single source of truth. No eventual consistency patterns in Phase 1. |
| Deployment | Heroku (Basic/Standard dynos). Heroku Postgres (Essential). Heroku Redis (Mini). |
| Local dev | Docker Compose via OrbStack provides postgres + redis. App processes run natively (not in Docker) for fast hot-reload. |
| Non-technical operator | The Wedding Planner does not have SSH access, does not run commands, does not read logs. All operations happen through the web UI. |
| WhatsApp message window | Template messages (pre-approved) to initiate. Session messages (free-form) within 24h conversation window. RSVP flow must complete within one session or re-initiate with a template. |
| Rate limits | WhatsApp Cloud API: up to 1,000 conversations per phone number per day on free tier. Sufficient for wedding-scale events (50–300 guests). |

---

### 4. User Roles

**Wedding Planner (Primary Operator)**
- Creates events, imports guests, launches campaigns, views responses, sends reminders
- Accesses only through the web dashboard
- Non-technical; needs plain language throughout

**Guests (External Users)**
- Interact exclusively via WhatsApp on their phone
- Never see the dashboard
- Can opt out at any time by replying STOP

**Future: Super Admin (Phase 4 — SaaS)**
- Manages multiple Wedding Planner accounts
- Access to billing, usage, and system health
- Not built in Phase 1–3

**Future: Event-specific Collaborator (Phase 4)**
- A second planner who can view (read-only) a specific event's responses
- Not built in Phase 1–3

---

### 5. Core User Flows

#### Flow A: Create an Event
1. Planner logs in → lands on Dashboard
2. Clicks "New Event"
3. Fills in: Event Name, Wedding Date, Venue (optional)
4. Saves → redirected to Event Detail page
5. Event is created with status Active

#### Flow B: Import Guest List
1. On Event Detail → clicks "Import Guests"
2. Downloads the CSV template (pre-formatted)
3. Fills in template: `first_name, last_name, phone, email`
4. Uploads CSV file
5. System validates rows: shows preview with error highlights (invalid phones, duplicates)
6. Planner confirms import
7. Guests are created with state `PENDING` and a `ConsentRecord` with status `PENDING`
8. Planner sees guest count updated on Event Detail

#### Flow C: Launch RSVP Campaign
1. On Event Detail → clicks "Send RSVP Messages"
2. Confirmation modal: "You are about to send messages to X guests. This cannot be undone."
3. Planner confirms
4. System queues outbound jobs for all PENDING guests
5. Each guest receives the pre-approved WhatsApp template message requesting consent to proceed with RSVP
6. Consent is implicitly granted when the guest replies affirmatively (tracked as `GRANTED`)
7. Conversation advances automatically

#### Flow D: Guest Responds (Automated)
1. Guest receives template: "Hola [Name], soy el asistente de [Planner]. ¿Confirmo tu asistencia a la boda de [Couple] el [Date]? Responde SÍ o NO."
2. Guest replies "Sí" → ConsentRecord set to GRANTED → conversation advances
3. Bot asks: "¿Cuántas personas asistirán contigo? (incluye tu pareja/acompañante)"
4. Guest replies "2" → stored as confirmedPartySize
5. Bot asks: "¿Tienes alguna restricción alimentaria? (sin gluten, vegano, alergias...)"
6. Guest replies "Sin gluten" → stored as dietaryNotes
7. Bot sends: "¡Perfecto! Hemos registrado tu confirmación. ¡Nos vemos el [Date]!"
8. ConversationState → COMPLETE, RsvpResponse created/updated

**Guest replies NO (to attendance):**
- Bot sends: "Entendido. Lo sentimos que no puedas venir. ¡Gracias por responder!"
- ConversationState → COMPLETE, isAttending = false

**Guest replies STOP:**
- ConsentRecord → REVOKED, ConversationState → OPT_OUT
- No further messages sent

**Guest gives invalid reply:**
- Bot resends the same question with a gentle clarification (max 3 retries)
- After 3 retries → moves to next step with null value (forgiving approach)

#### Flow E: Review RSVP Results
1. Planner opens Event Detail → sees summary: X Confirmed / Y Declined / Z Pending / W Opted Out
2. Clicks "View Responses" → full paginated table
3. Can filter by: Confirmed / Declined / Pending / Opted Out
4. Can export as CSV (Name, Phone, Attending, Party Size, Dietary Notes)
5. Can click any guest to see their full conversation history

#### Flow F: Send Reminder
1. Planner clicks "Send Reminder"
2. Selects target: "All who haven't responded" (default)
3. Sets optional message (or uses default template)
4. Confirms send
5. System queues reminder jobs for target guests only

#### Flow G: Edit Conversation Steps (Phase 3)
1. Planner opens Event Settings → "Customize Questions"
2. Sees list of steps: Consent, Attendance, Companions, Dietary, Confirmation
3. Can edit the question text per step (no adding/removing steps in Phase 3)
4. Saves → changes apply to future conversations only

---

### 6. Phased Implementation Plan

#### Phase 0 — Foundation (Week 1)
**Objective:** Working local dev environment. Database connected. Webhook endpoint reachable. Team can develop.

**User Value:** None visible to planner yet. Internal validation that the stack works end-to-end.

**Features:**
- pnpm monorepo initialized (`apps/api`, `apps/web`, `packages/shared`)
- TypeScript configured across all packages
- Docker Compose: postgres + redis running locally
- Prisma schema defined, initial migration applied
- Express app bootstrapped: health check endpoint, env validation
- Next.js app bootstrapped: login page shell
- WhatsApp webhook endpoint: verification challenge + HMAC validation
- `ngrok`/`cloudflared` local tunnel for webhook testing
- `PROJECT_CONTEXT.md` committed to repo

**Technical Scope:**
- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.json`
- `docker-compose.yml` (postgres 16-alpine, redis 7-alpine)
- `apps/api/prisma/schema.prisma` — full schema (all tables, even unused in Phase 1)
- `apps/api/src/config/env.ts` — Zod-validated env
- `apps/api/src/server.ts` — Express factory
- `GET/POST /webhook/whatsapp` — verify + store raw payload
- `GET /health` endpoint
- `.env.example` committed

**Deferred:** Auth, UI, guest import, actual WhatsApp message sending, queue workers

**Acceptance Criteria:**
- `docker compose up -d && pnpm dev` starts all services without errors
- `GET /health` returns 200
- WhatsApp webhook verification handshake succeeds in Meta Developer Console
- A test message sent from WhatsApp appears as a row in `webhook_events` table
- `prisma migrate dev` runs cleanly

---

#### Phase 1 — MVP (Weeks 2–5)
**Objective:** A Wedding Planner can log in, create an event, import guests, launch a campaign, and collect RSVPs — end to end.

**User Value:** Full RSVP workflow works. First real event can be run.

**Features:**
- Admin login/logout (session-based, bcrypt)
- Create/view/edit events
- Import guests via CSV upload (validate, preview, confirm)
- View guest list with status badges
- Launch campaign (send consent template to all PENDING guests)
- Automated conversation: Consent → Attendance → Companions → Dietary → Complete
- Guest conversation state machine (hardcoded steps)
- View RSVP responses table
- Export responses as CSV
- View individual guest conversation history
- Opt-out handling (STOP keyword)
- BullMQ workers for outbound message sending and inbound processing
- WhatsApp message delivery status tracking (delivered, read, failed)

**Technical Scope:**
- `apps/api/src/domains/auth/` — login, logout, session middleware
- `apps/api/src/domains/events/` — CRUD + launch campaign
- `apps/api/src/domains/guests/` — CRUD + CSV import pipeline
- `apps/api/src/domains/conversations/` — state machine + service
- `apps/api/src/domains/whatsapp/` — send message service (Cloud API)
- `apps/api/src/jobs/` — outbound-messages queue, inbound-processing queue, worker
- `apps/web/` — login page, event list, event detail, guest list, import page, responses page
- `packages/shared/src/` — ConversationStep enum, API response types

**Deferred:** Reminders, configurable flows, multi-language UI, analytics

**Acceptance Criteria:**
- Planner can log in with email/password
- Can create an event and import a 10-guest CSV without errors
- Launch sends WhatsApp messages to all 10 guests within 60 seconds
- Replying "Sí" from a test WhatsApp number advances conversation to next step
- Replying "STOP" marks the guest as opted out with no further messages
- Planner can see responses table with correct state per guest
- CSV export downloads with correct data

---

#### Phase 2 — Operational Improvements (Weeks 6–8)
**Objective:** Make the system reliable and usable for real events with 50–300 guests.

**User Value:** Planner can run real events with confidence. Less manual follow-up needed.

**Features:**
- Scheduled reminders (UI to schedule, worker to execute)
- Guest status dashboard summary (counts by state)
- Retry logic for failed messages (exponential backoff)
- Invalid phone detection and UI flag
- Planner can manually reset a guest's conversation to PENDING
- Planner can manually mark a guest's response (override)
- Basic event dashboard stats: % responded, % attending, total companions
- Email notification to planner when campaign completes (all guests contacted)
- Message delivery status display per guest

**Technical Scope:**
- `apps/api/src/domains/reminders/` — schedule + BullMQ job
- `apps/api/src/jobs/send-reminder.job.ts`
- `apps/web` — reminder scheduling UI, stats cards, manual override UI
- Retry queue configuration in `queues.ts`
- `POST /events/:eventId/guests/:guestId/reset` endpoint

**Deferred:** Configurable flow text, multi-tenant, analytics charts

**Acceptance Criteria:**
- Planner can schedule a reminder for "guests who haven't replied"
- Reminder fires within 5 minutes of scheduled time
- Stats cards show correct counts
- A guest with a failed phone shows a "Invalid number" badge in the UI

---

#### Phase 3 — Configurable Flows (Weeks 9–12)
**Objective:** Planner can customize conversation question text without engineering involvement.

**User Value:** Planners can personalize the tone and language of their conversations. Reduces support requests about "can you change the wording?"

**Features:**
- Per-event conversation step editor in dashboard
- Edit question text per step (Attendance, Companions, Dietary, Confirmation)
- Preview how messages look before saving
- Multi-language per-guest support (es/en/pt question sets)
- `FlowStep` table used to drive conversation (replaces hardcoded strings)
- Planner can add a custom final message ("See you at the reception!")

**Technical Scope:**
- `apps/api/src/domains/flow-steps/` — CRUD
- `apps/web` — flow step editor UI with preview
- Update `conversations.machine.ts` to read steps from DB (with in-memory cache, 5min TTL)
- Migration: seed default FlowStep rows for existing events

**Deferred:** Adding/removing/reordering steps, conditional branching, media messages

**Acceptance Criteria:**
- Planner edits Dietary question text → next guest who reaches that step receives the new text
- English-language guests receive English questions (guest.language = "en")
- Default steps are pre-seeded when a new event is created

---

#### Phase 4 — SaaS Readiness (Future)
**Objective:** Platform can support multiple independent Wedding Planner accounts with billing.

**User Value:** Product becomes a paid SaaS. Each planner has isolated data.

**Features:**
- Organization model (multiple planners per org)
- Billing integration (Stripe)
- Plan limits (max guests per event, max events)
- Usage dashboard (messages sent per month)
- Admin super-user panel
- Each event can use a different WhatsApp Phone Number ID (per-client WA business accounts)
- API key authentication for potential integrations

**Technical Scope:**
- `organizations` table, update all queries for multi-tenant isolation
- Stripe webhooks + subscription management
- Plan enforcement middleware
- Super admin UI

**Deferred to actual Phase 4 sprint planning.**

---

### 7. Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (Next.js 14)                 │
│                    apps/web — port 3000                         │
│   Login → Events → Guests → Import → Responses → Reminders     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API calls (fetch)
                            │ /api/v1/*
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS API (Node.js)                        │
│                    apps/api — port 3001                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │  /auth   │ │ /events  │ │ /guests  │ │   /responses     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              /webhook/whatsapp                          │    │
│  │   GET: verify token   POST: HMAC validate → store       │    │
│  │   → WebhookEvent (RECEIVED) → enqueue job               │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────┬───────────────────────────────────────┬─────────────────┘
        │ Prisma                                │ BullMQ enqueue
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────────────┐
│   PostgreSQL 16   │               │         Redis 7           │
│  (Heroku Postgres │               │   (Heroku Redis Mini)     │
│   / local Docker) │               │   BullMQ job queues       │
└───────────────────┘               └──────────┬────────────────┘
                                               │ dequeue
                                               ▼
                            ┌──────────────────────────────────┐
                            │        BullMQ WORKER             │
                            │      apps/api — worker.ts        │
                            │                                  │
                            │  outbound-messages queue:        │
                            │    → Call WhatsApp Cloud API     │
                            │    → Update Message status       │
                            │                                  │
                            │  inbound-processing queue:       │
                            │    → Parse message intent        │
                            │    → Run state machine           │
                            │    → Update ConversationState    │
                            │    → Enqueue response message    │
                            │                                  │
                            │  reminders queue:                │
                            │    → Find target guests          │
                            │    → Enqueue per-guest messages  │
                            └───────────────┬──────────────────┘
                                            │ HTTPS POST
                                            ▼
                            ┌──────────────────────────────────┐
                            │   WhatsApp Business Cloud API    │
                            │   (Meta) — graph.facebook.com    │
                            │                                  │
                            │   ← Webhooks (messages/status)   │
                            │   → Send messages (template +    │
                            │     session text)                │
                            └──────────────────────────────────┘
```

**Heroku Topology:**
- `web` dyno: Express API + Next.js standalone server (split to two dynos when scaling)
- `worker` dyno: BullMQ worker process (scale independently: `heroku ps:scale worker=2`)
- `release` phase: `prisma migrate deploy` before traffic routing on every deploy

**Local Docker Topology:**
- `docker compose up -d` starts postgres:16-alpine + redis:7-alpine
- `pnpm dev` starts Next.js dev server + Express with `tsx watch` on host
- `cloudflared tunnel` or `ngrok` exposes localhost:3001 for WhatsApp webhook

---

### 8. Database Design (PostgreSQL via Prisma)

#### `admin_users`
Wedding planner accounts.
- `id` (cuid), `email` (unique), `password_hash`, `name`
- **Audit:** `created_at`, `updated_at`
- **SaaS path:** Add `organization_id` FK in Phase 4

#### `events`
A single wedding or ceremony.
- `id`, `admin_user_id` (FK), `name`, `slug` (unique), `event_date`, `venue`, `description`, `is_active`
- `wa_ba_id`, `wa_phone_number_id` — per-event WhatsApp config (enables multi-WA-account in Phase 4)
- **Relations:** has many `guests`, `reminders`, `webhook_events`, `flow_steps`

#### `guests`
One row per invited person per event.
- `id`, `event_id` (FK), `phone` (E.164), `name`, `email`, `party_size`, `language`, `notes`, `import_batch`
- **Constraint:** `UNIQUE(event_id, phone)` — same guest can appear in multiple events
- **Relations:** has one `consent_record`, `conversation_state`, `rsvp_response`; has many `messages`

#### `consent_records`
GDPR-friendly consent tracking. Separate table by design — consent lifecycle is independent of guest data lifecycle.
- `id`, `guest_id` (FK, unique), `status` (PENDING | GRANTED | REVOKED)
- `granted_at`, `revoked_at`, `mechanism` (whatsapp_reply | manual), `ip_address`, `raw_payload`
- **Rule:** No outbound WhatsApp message (except consent template) may be sent when status ≠ GRANTED
- **Audit:** `created_at`, `updated_at`

#### `conversation_states`
State machine state per guest.
- `id`, `guest_id` (FK, unique), `state` (ConversationStep enum), `current_step_index`, `retry_count`
- `last_message_at`, `last_inbound_at`, `expires_at`, `metadata` (JSON for transient step data)
- **States:** PENDING → INITIAL_SENT → AWAITING_ATTENDANCE → AWAITING_COMPANIONS → AWAITING_DIETARY → COMPLETE | OPT_OUT | UNREACHABLE
- **Audit:** `created_at`, `updated_at`

#### `rsvp_responses`
Final collected answers. Populated as conversation progresses.
- `id`, `guest_id` (FK, unique), `is_attending` (nullable bool), `confirmed_party_size` (nullable int)
- `dietary_notes` (nullable text), `additional_notes`, `submitted_at` (when COMPLETE reached)
- **Audit:** `created_at`, `updated_at`

#### `messages`
Immutable audit log of every message sent or received.
- `id`, `guest_id` (FK), `direction` (INBOUND | OUTBOUND), `wa_message_id` (unique, nullable)
- `content`, `content_type` (text | template | interactive), `template_name`
- `status` (QUEUED | SENT | DELIVERED | READ | FAILED | INVALID)
- `error_code`, `error_message`, `sent_at`, `delivered_at`, `read_at`, `raw_payload` (JSON)
- **Index:** `guest_id`, `wa_message_id`

#### `webhook_events`
Idempotency + full audit of every incoming Meta webhook.
- `id`, `event_id` (nullable FK), `source` (whatsapp), `wa_message_id`
- `type` (messages | statuses), `status` (RECEIVED | PROCESSING | PROCESSED | FAILED | DUPLICATE)
- `processing_error`, `raw_payload` (JSON), `received_at`, `processed_at`
- **Constraint:** `UNIQUE(source, wa_message_id)` — prevents double-processing on Meta retries
- **Index:** `status`, `received_at`

#### `flow_steps`
Configurable conversation steps (Phase 3; schema defined from day 1).
- `id`, `event_id` (FK), `step_key` (matches ConversationStep enum), `order`, `is_active`
- `message_templates` (JSON: `{ "es": "...", "en": "..." }`)
- `validation_rules` (JSON: `{ "type": "yes_no" | "number" | "free_text", "maxLength": 500 }`)
- **Constraint:** `UNIQUE(event_id, step_key)`
- **Phase 1:** Not used. Conversations use hardcoded strings. Schema exists for Phase 3 migration.

#### `reminders`
Scheduled follow-up campaigns.
- `id`, `event_id` (FK), `name`, `scheduled_at`, `status` (PENDING | PROCESSING | SENT | FAILED | CANCELLED)
- `sent_count`, `target_scope` (all_pending | not_attending | no_response), `processed_at`
- **Index:** `status, scheduled_at` — worker queries this to find due reminders

#### Consent Tracking Design Note
`ConsentRecord.status = PENDING` is the default state when a guest is imported. The consent template message (the very first WhatsApp message) is the consent request. When the guest replies affirmatively, `status` moves to `GRANTED` and the RSVP conversation begins. If the guest replies STOP at any point, `status` moves to `REVOKED` and the system permanently blocks further messages to that guest in that event. A planner cannot "re-grant" consent on behalf of a guest — only the guest can, by initiating a new conversation.

---

### 9. Conversation Flow Design

#### Comparison of Approaches

| Approach | Simplicity | Configurability | Phase 1 Fit | Phase 3 Fit |
|----------|-----------|-----------------|-------------|-------------|
| Hardcoded logic | ★★★★★ | ✗ | ✓ | ✗ |
| Fully DB-driven | ★★ | ★★★★★ | ✗ (overkill) | ✓ |
| **Hybrid** | ★★★★ | ★★★ | ✓ | ✓ |

**Recommendation:**

**Phase 1:** Hardcoded step logic. The `conversations.machine.ts` file contains the state transitions. Message strings live in `apps/api/src/domains/conversations/default-messages.ts` as typed constants. No DB reads needed to process a message. Fast, testable, zero configuration complexity.

**Phase 3 upgrade:** The `FlowStep` table is already in the schema. The service layer switches to reading step messages from DB (cached in memory for 5 minutes). The state machine logic (`conversations.machine.ts`) remains unchanged — it still transitions states the same way. Only the message *text* becomes configurable. This is the minimal configurability that solves the actual user problem.

**What stays hardcoded forever:** State transitions, validation rules (what counts as a valid "yes" or a valid number), retry limits, terminal states. These are product logic, not content.

#### State Machine (Pure Function)

```
File: apps/api/src/domains/conversations/conversations.machine.ts

transition(state: ConversationStep, input: NormalizedInput): TransitionResult

NormalizedInput:
  { intent: 'YES' }                   // sí/yes/1/ok/claro
  { intent: 'NO' }                    // no/nope/0/no puedo
  { intent: 'STOP' }                  // stop/para/baja/cancelar
  { intent: 'NUMBER', value: number } // digit string 1–20
  { intent: 'FREE_TEXT', raw: string }// anything else

TransitionResult:
  { nextState: ConversationStep, actions: TransitionAction[] }

TransitionAction (no side effects inside machine):
  SEND_MESSAGE(templateKey)   → service layer sends WhatsApp message
  SAVE_ATTENDANCE(bool)       → service layer writes rsvp_response
  SAVE_COMPANIONS(number)     → service layer writes rsvp_response
  SAVE_DIETARY(string)        → service layer writes rsvp_response
  MARK_OPT_OUT                → service layer updates consent_record + state
  MARK_COMPLETE               → service layer writes submitted_at
  MARK_UNREACHABLE            → service layer updates state
  SEND_CLARIFICATION(reason)  → service layer sends clarification message
  INCREMENT_RETRY             → service layer increments retry_count
```

#### Input Normalization (`whatsapp.parser.ts`)
Before entering the machine, raw WhatsApp reply text is normalized:
- Lowercase + trim
- "sí", "si", "s", "yes", "y", "1", "claro", "ok", "vale", "confirmo" → `YES`
- "no", "n", "0", "no puedo", "no iré" → `NO`
- "stop", "para", "baja", "cancelar", "no más" → `STOP`
- Strings matching `/^\d{1,2}$/` → `NUMBER`
- Everything else → `FREE_TEXT`

---

### 10. Admin UX Design

**Design Principles for Non-Technical User:**
- Max 3 clicks to any action
- No jargon: "Not replied yet" not "PENDING". "Invalid phone" not "E.164 validation error".
- All destructive actions (launch campaign, delete event) require a confirmation modal with count of affected records
- Errors display in plain language with a suggested action
- Default state of every screen shows the most useful information without interaction
- Color coding: green (attending), red (declined), orange (pending), grey (opted out)

**Screens (Phase 1):**

| Screen | Path | Purpose |
|--------|------|---------|
| Login | `/login` | Email + password |
| Dashboard | `/dashboard` | Event cards with progress rings (% responded) |
| New Event | `/events/new` | 3-field form: Name, Date, Venue |
| Event Detail | `/events/:id` | Stats strip + 4 action buttons + guest table preview |
| Guest List | `/events/:id/guests` | Sortable table with status badges. Filter tabs. |
| Import Guests | `/events/:id/guests/import` | Drag-drop CSV. Preview table. Error highlights. |
| Responses | `/events/:id/responses` | RSVP answers table. Filter. Export CSV button. |
| Guest Detail (modal/drawer) | — | Full message history. Manual override toggle. |

**Event Detail page layout:**
```
[Event Name]  [Date]  [Venue]

[ 24 Confirmed ]  [ 8 Declined ]  [ 12 Pending ]  [ 2 Opted Out ]

[Send RSVP Messages ▶]  [Send Reminder ▶]  [Export CSV ↓]  [Settings ⚙]

[Guest Table Preview — top 10 rows — "View All" link]
```

**Import flow (key UX decisions):**
- Show a downloadable CSV template link above the upload area — planner should not need to guess the format
- After upload, show a preview table: ✓ rows that are valid, ⚠ rows with warnings (duplicate phone), ✗ rows with errors (invalid phone format)
- Only valid rows are importable. Error rows are skipped with a report.
- One-click "Import X valid guests" button — no wizard steps

**No technical jargon in the UI:**
- `AWAITING_ATTENDANCE` → "Waiting for reply"
- `COMPLETE` (attending) → "Confirmed ✓"
- `COMPLETE` (not attending) → "Declined"
- `OPT_OUT` → "Opted out"
- `UNREACHABLE` → "Couldn't reach"
- `INITIAL_SENT` → "Message sent"
- `PENDING` → "Not contacted yet"

---

### 11. Security and Best Practices

**Environment Management:**
- All secrets in environment variables. Never hardcoded. Never in git.
- `.env.example` committed with all variable names but no values.
- Zod validates all required env vars on startup — server refuses to start if any are missing.
- Heroku Config Vars for production. Never `.env` file in production.

**HTTPS:**
- Heroku provides TLS termination automatically. Express configured to trust proxy: `app.set('trust proxy', 1)`.
- All session cookies: `secure: true`, `httpOnly: true`, `sameSite: 'strict'`.

**Database Security:**
- Prisma parameterized queries only. No raw SQL with user input.
- DATABASE_URL includes SSL mode: `?sslmode=require` in production.
- Heroku Postgres uses SSL by default.
- No direct DB access from the web process's client side.

**Webhook Security:**
- HMAC-SHA256 signature validation on every POST to `/webhook/whatsapp` using `X-Hub-Signature-256`.
- Constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- Webhook verification token stored in env, never in code.
- Raw request body must be preserved as Buffer before JSON parsing for HMAC validation (use `express.raw()` on webhook route, not `express.json()`).

**Auth:**
- `bcrypt` with cost factor 12 for password hashing.
- Express sessions stored in PostgreSQL via `connect-pg-simple`.
- Session secret: minimum 32 chars, rotated via env var.
- Rate limiting on `/api/v1/auth/login`: 5 attempts per 15 minutes per IP.

**Audit Logs:**
- Every inbound webhook stored in `webhook_events` before processing.
- Every message (inbound + outbound) stored in `messages`.
- Consent changes logged with timestamp, mechanism, and raw payload.
- Admin actions (launch campaign, delete guest) logged via Pino with structured fields.

**Opt-Out Handling:**
- STOP keyword (and equivalents) is checked BEFORE any other state machine logic.
- `ConsentRecord.status = REVOKED` blocks all future outbound messages at the service layer.
- Opt-out is irreversible via UI — only the guest can re-initiate by messaging first.
- Opted-out guests are never included in reminder campaigns.

**Data Minimization:**
- Only collect what's needed for the RSVP: name, phone, attendance, companions, dietary notes.
- `raw_payload` fields in `messages` and `webhook_events` are for auditing/debugging; not exposed in UI.
- Guest email is optional and not used for any messaging.
- No profile photos, social data, or sensitive personal information.

**Error Handling:**
- Global Express error handler returns structured JSON: `{ success: false, error: "message" }`.
- No stack traces in production error responses.
- All BullMQ job failures logged with `pino` including job ID, attempt number, and error.
- Failed jobs after max retries are moved to BullMQ's dead-letter queue (monitored separately).

**Logging/Monitoring (Phase 1):**
- `pino` structured JSON logging with log level controlled by `LOG_LEVEL` env var.
- Heroku log drain to Papertrail (free tier) for log persistence beyond Heroku's 1500-line buffer.
- Health check endpoint `GET /health` returns DB connectivity status — used by Heroku's health checks.

---

### 12. Local Development Setup (OrbStack/Docker)

**Prerequisites:**
- OrbStack or Docker Desktop installed
- Node.js 20 (via `nvm` or `volta`)
- pnpm 9+

**`docker-compose.yml`** starts:
- `postgres:16-alpine` on port 5432 with volume `postgres_data`
- `redis:7-alpine` on port 6379 with volume `redis_data`
- Both with health checks. App processes wait for healthy containers.

**Setup Flow:**
```bash
# 1. Clone and install dependencies
git clone <repo>
cd topaz-ibis
pnpm install

# 2. Copy env template and fill in values
cp .env.example .env
# Edit .env: add WA_ACCESS_TOKEN, WA_APP_SECRET, WA_VERIFY_TOKEN, etc.

# 3. Start backing services
docker compose up -d

# 4. Run database migrations
cd apps/api && npx prisma migrate dev

# 5. Start all services in dev mode
pnpm dev
# → Next.js on :3000, Express on :3001, BullMQ worker in same process (dev only)

# 6. (Optional) Expose webhook for WhatsApp testing
cloudflared tunnel --url http://localhost:3001
# or: ngrok http 3001
# → Copy the https:// URL, set as webhook URL in Meta Developer Console
```

**Developer Workflow:**
- `apps/api` uses `tsx watch` for hot-reload
- `apps/web` uses Next.js dev server with Fast Refresh
- `pnpm --filter api test` runs API unit tests
- `pnpm --filter web test` runs frontend component tests
- `pnpm test` runs all tests from root
- `npx prisma studio` opens a DB GUI on port 5555

**Webhook Testing:**
- Use `cloudflared` (free, no signup) or `ngrok` to create a public tunnel
- Set tunnel URL + `/webhook/whatsapp` as the webhook URL in Meta App Dashboard
- Subscribe to `messages` and `message_statuses` webhook fields
- Send a WhatsApp message from your personal number to the test number
- Observe the row in `webhook_events` table via Prisma Studio

---

### 13. Heroku Deployment Plan

**Add-ons:**
- `heroku-postgresql:essential-0` (or `mini`) — PostgreSQL, automatic backups
- `heroku-redis:mini` — Redis for BullMQ queues

**Dynos:**
- `web`: Express API + Next.js standalone (1x Basic in Phase 1)
- `worker`: BullMQ worker process (1x Basic in Phase 1, scale to 2 for Phase 2+)

**`Procfile`:**
```
web: node apps/api/dist/main.js & node apps/web/.next/standalone/server.js
worker: node apps/api/dist/jobs/worker.js
release: cd apps/api && npx prisma migrate deploy
```

**Environment Variables (Heroku Config Vars):**
```
DATABASE_URL          (auto-set by Heroku Postgres)
REDIS_URL             (auto-set by Heroku Redis)
SESSION_SECRET        (generate: openssl rand -hex 32)
WA_VERIFY_TOKEN       (set in Meta Developer Console)
WA_APP_SECRET         (from Meta App settings)
WA_ACCESS_TOKEN       (system user permanent token)
WA_API_VERSION        v19.0
NODE_ENV              production
PORT                  (auto-set by Heroku)
NEXT_PUBLIC_API_URL   https://your-app.herokuapp.com
LOG_LEVEL             info
```

**Deployment Flow:**
```bash
# Initial setup
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-redis:mini
heroku config:set SESSION_SECRET=$(openssl rand -hex 32)
# ... set remaining config vars

# Deploy
git push heroku main
# → release phase runs: prisma migrate deploy
# → web + worker dynos start

# Scale worker
heroku ps:scale worker=1

# Check logs
heroku logs --tail

# DB access (emergency only)
heroku run "cd apps/api && npx prisma studio" --no-tty
```

**Release Phase:** `prisma migrate deploy` runs before traffic is routed to new dynos. This is Prisma's production-safe migration command (non-interactive, no data destruction). Migrations that cannot be applied without downtime must be done manually.

**Build process:** `pnpm build` in root calls `turbo build` (or sequential `pnpm --filter api build && pnpm --filter web build`). `apps/web` is built with `output: 'standalone'` in `next.config.ts` for smaller Heroku slug.

---

### 14. Cost Model

**Fixed Monthly Infrastructure Costs (Heroku):**

| Component | Plan | Est. Monthly Cost |
|-----------|------|------------------|
| `web` dyno | Basic (1x) | ~$7 |
| `worker` dyno | Basic (1x) | ~$7 |
| Heroku Postgres | Essential-0 (1GB) | ~$5 |
| Heroku Redis | Mini (25MB) | ~$3 |
| **Infrastructure total** | | **~$22/month** |

**Variable Costs (WhatsApp Business Platform):**

WhatsApp pricing is conversation-based (24-hour conversation windows), not per-message. Meta's pricing changes by region and plan tier. Structure your estimate as:

- Cost driver: **Number of unique conversations opened per month**
- 1 RSVP campaign = 1 conversation per guest
- A 200-guest event = ~200 conversations (or fewer if they don't reply)
- Status updates (delivered/read receipts) do not count as new conversations

For pricing, refer to: [Meta WhatsApp Business Pricing](https://business.whatsapp.com/products/platform-pricing)

**Estimate Per Event:**
```
Guests: 200
Conversations opened: ~160 (80% reach rate estimated)
Template messages (consent request): 200
Session messages (RSVP flow): ~140 * 4 = 560
Reminders (1 follow-up): ~60

Total conversations: ~160
Cost: [conversations] * [regional rate per conversation]
```

**Cost Drivers:**
- Number of guests per event (primary driver)
- Reply rate (higher reply rate = more session messages but same conversation cost)
- Number of reminders (each opens a new conversation window if 24h has lapsed)
- WhatsApp number tier (free tier: 1,000 free user-initiated conversations/month)

**SaaS Pricing Model (Phase 4):**
- Charge per event or per guest
- Mark up WhatsApp conversation costs + infra cost + margin
- Recommended: flat fee per event (e.g., €49 per event up to 300 guests)

---

### 15. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Poor UX for non-technical planner | High | High | User test with a real Wedding Planner before Phase 1 ships. Zero technical jargon in UI. |
| Overengineering Phase 1 | Medium | High | Enforce "what we are NOT building yet" list. Reject scope creep. Ship hardcoded flows. |
| WhatsApp template rejection by Meta | Medium | High | Pre-submit templates during Phase 0. Have 2 fallback template wordings ready. Keep templates simple. |
| WhatsApp API rate limits exceeded | Low | Medium | BullMQ rate-limited queue (max N jobs/second). Spread large campaigns over time. |
| Conversation state corruption | Medium | High | State transitions are pure functions (unit tested). DB writes are atomic. Idempotency key prevents double-processing. |
| Webhook delivery failure (Meta side) | Low | Medium | Meta retries webhooks. Idempotency key in `webhook_events` ensures safe retry processing. |
| Data loss (Heroku Postgres) | Low | Critical | Enable Heroku Postgres automatic daily backups. Document restore procedure. |
| Guest sends unexpected message format | High | Low | State machine handles `FREE_TEXT` intent gracefully. Max 3 retries then moves on. Never crashes. |
| Consent compliance challenge | Low | High | `consent_records` table tracks every consent state change with timestamp and mechanism. Never send RSVP messages to REVOKED guests. |
| Redis outage (BullMQ down) | Low | Medium | BullMQ jobs are persisted in Redis. If Redis recovers, jobs resume. For Phase 1, manual re-send via UI is acceptable fallback. |
| Developer leaves project | Medium | Medium | Clean architecture, documented in `PROJECT_CONTEXT.md`, no magic patterns. Onboarding time minimized. |

---

### 16. Delivery Backlog

#### Phase 0 — Foundation

| # | Title | Priority | Category | Dependencies |
|---|-------|----------|----------|--------------|
| P0-1 | Initialize pnpm monorepo with apps/api, apps/web, packages/shared | P0 | infra | — |
| P0-2 | Configure TypeScript 5 across all packages | P0 | infra | P0-1 |
| P0-3 | Set up Docker Compose (postgres + redis) | P0 | infra | P0-1 |
| P0-4 | Define complete Prisma schema | P0 | backend | P0-3 |
| P0-5 | Run initial Prisma migration | P0 | backend | P0-4 |
| P0-6 | Bootstrap Express app with env validation (Zod) | P0 | backend | P0-2 |
| P0-7 | Implement GET/POST /webhook/whatsapp (verify + store) | P0 | backend | P0-6 |
| P0-8 | Set up Pino structured logging | P0 | backend | P0-6 |
| P0-9 | GET /health endpoint | P0 | backend | P0-6 |
| P0-10 | Bootstrap Next.js 14 app with shadcn/ui | P0 | frontend | P0-2 |
| P0-11 | Commit PROJECT_CONTEXT.md to repo | P0 | product | — |
| P0-12 | Configure local tunnel (cloudflared) for webhook testing | P0 | infra | P0-7 |

#### Phase 1 — MVP

| # | Title | Priority | Category | Dependencies |
|---|-------|----------|----------|--------------|
| P1-1 | Auth: POST /auth/login, POST /auth/logout, GET /auth/me | P0 | backend | P0-6 |
| P1-2 | Auth: Login page (Next.js) | P0 | frontend | P1-1 |
| P1-3 | Auth: requireAuth middleware | P0 | backend | P1-1 |
| P1-4 | Events CRUD API | P0 | backend | P1-3 |
| P1-5 | Events: Event list + create form (Next.js) | P0 | frontend | P1-4 |
| P1-6 | Events: Event detail page | P0 | frontend | P1-4 |
| P1-7 | Guests: CRUD API + requireEventOwner middleware | P0 | backend | P1-4 |
| P1-8 | Guests: CSV import pipeline (parse, validate, preview) | P0 | backend | P1-7 |
| P1-9 | Guests: Import page with drag-drop + preview table | P0 | frontend | P1-8 |
| P1-10 | Guests: Guest list page with status badges | P0 | frontend | P1-7 |
| P1-11 | WhatsApp: Send message service (Cloud API HTTP client) | P0 | backend | P0-6 |
| P1-12 | Conversation: Hardcoded default messages (es/en) | P0 | backend | — |
| P1-13 | Conversation: Pure state machine (conversations.machine.ts) | P0 | backend | P1-12 |
| P1-14 | Conversation: Service layer (DB writes + job enqueue) | P0 | backend | P1-13, P1-11 |
| P1-15 | BullMQ: Queue setup + send-message.job.ts | P0 | backend | P0-3 |
| P1-16 | BullMQ: process-inbound.job.ts | P0 | backend | P1-14 |
| P1-17 | BullMQ: worker.ts entry point | P0 | backend | P1-15, P1-16 |
| P1-18 | Campaign launch: POST /events/:id/launch | P0 | backend | P1-15 |
| P1-19 | Campaign launch: "Send Messages" button + confirmation modal | P0 | frontend | P1-18 |
| P1-20 | Webhook: Route inbound messages to inbound-processing queue | P0 | backend | P1-16 |
| P1-21 | Webhook: Handle delivery status updates → update Message row | P0 | backend | P0-7 |
| P1-22 | RSVP: Responses table page | P0 | frontend | P1-14 |
| P1-23 | RSVP: CSV export endpoint + button | P1 | backend | P1-22 |
| P1-24 | Guest detail: Message history drawer | P1 | frontend | P1-10 |
| P1-25 | Opt-out: STOP handling in state machine + consent revocation | P0 | backend | P1-13 |
| P1-26 | Input: Message intent normalization (whatsapp.parser.ts) | P0 | backend | P1-13 |
| P1-27 | Heroku: Deploy Phase 1 to staging app | P1 | infra | All P0 items |

#### Phase 2 — Operational Improvements

| # | Title | Priority | Category | Dependencies |
|---|-------|----------|----------|--------------|
| P2-1 | Reminders: API + BullMQ job | P0 | backend | Phase 1 |
| P2-2 | Reminders: Schedule UI | P0 | frontend | P2-1 |
| P2-3 | Stats: Event dashboard summary cards | P0 | frontend | Phase 1 |
| P2-4 | Stats: GET /events/:id/responses/stats endpoint | P0 | backend | Phase 1 |
| P2-5 | Retry logic: Exponential backoff for failed sends | P1 | backend | Phase 1 |
| P2-6 | Invalid phone: Detection + UI badge | P1 | backend | Phase 1 |
| P2-7 | Manual reset: POST /guests/:id/reset | P1 | backend | Phase 1 |
| P2-8 | Manual override: Mark guest response manually | P1 | frontend | P2-7 |
| P2-9 | Delivery status: Display per-guest in guest list | P1 | frontend | Phase 1 |

#### Phase 3 — Configurable Flows

| # | Title | Priority | Category | Dependencies |
|---|-------|----------|----------|--------------|
| P3-1 | FlowSteps: CRUD API | P0 | backend | Phase 2 |
| P3-2 | FlowSteps: Seed default steps when event is created | P0 | backend | P3-1 |
| P3-3 | FlowSteps: Step editor UI | P0 | frontend | P3-1 |
| P3-4 | Conversations: Switch to DB-driven message lookup (cached) | P0 | backend | P3-2 |
| P3-5 | Multi-language: per-guest language selection in import | P1 | backend | P3-4 |

---

### 17. Recommended Tech Stack

| Layer | Choice | Justification |
|-------|--------|---------------|
| **Frontend** | Next.js 14 (App Router) + TypeScript | Full-stack capable, excellent DX, App Router simplifies data fetching. Server Components reduce client JS. |
| **UI Components** | shadcn/ui + Tailwind CSS | Copy-paste components, accessible by default, no component library lock-in. Planner UI is simple — no need for heavy design system. |
| **Backend** | Node.js 20 + Express 4 + TypeScript | Familiar, battle-tested, excellent ecosystem. Long-lived process model suits BullMQ and WebSocket (future). |
| **ORM** | Prisma 5 | Best-in-class TypeScript types. Migration system is simple and production-safe. Prisma Studio for visual DB access during dev. |
| **Database** | PostgreSQL 16 | ACID transactions, excellent JSON support, row-level locking for idempotency. Heroku Postgres is mature. |
| **Queue** | BullMQ 5 + Redis 7 | Built for Node.js. Persistent jobs (survive restarts). Delayed jobs (reminders). Rate limiting built-in. Dead-letter queue. |
| **Validation** | Zod 3 | Used at API input, env vars, and webhook payload parsing. TypeScript inference from schemas eliminates duplicate type definitions. |
| **Auth** | bcrypt + express-session + connect-pg-simple | Simple session-based auth is appropriate for a single-user tool in Phase 1. No OAuth complexity until Phase 4 multi-tenant. |
| **Logging** | Pino | Structured JSON logging, fastest Node.js logger, native Heroku log drain support. |
| **Package Manager** | pnpm 9 workspaces | Disk-efficient, fast installs, native workspace support, deterministic lockfile. |
| **Testing** | Vitest (unit) + Supertest (API integration) | Vitest is fast and Jest-compatible. Supertest enables in-process API testing without a running server. |
| **Hosting** | Heroku | PaaS with zero infra management. Heroku Postgres and Redis are fully managed. Suitable for indie product / MVP. Migrate to Railway or Render if costs become a concern. |
| **Local infra** | Docker Compose / OrbStack | OrbStack is faster than Docker Desktop on Mac. Docker Compose keeps postgres + redis reproducible. |
| **Tunnel** | cloudflared | Free, no signup, creates a stable HTTPS tunnel for WhatsApp webhook development. |

**Not chosen and why:**
- `Fastify` over Express: Marginal performance gains not worth unfamiliarity for most developers
- `Drizzle` over Prisma: Prisma Studio and migration tooling are more polished for a non-solo team
- `GraphQL`: Overkill for a simple CRUD + webhook product
- `tRPC`: Adds monorepo coupling complexity not warranted for Phase 1
- `Nest.js`: Too much boilerplate for this scale; opinionated framework adds learning curve

---

### 18. PROJECT_CONTEXT.md

This file lives at the root of the repo. It is committed to version control. It is updated every time a significant architectural decision is made, a phase completes, or an assumption changes. It is the single source of truth for "what is this project and why does it look like this."

```markdown
# PROJECT_CONTEXT.md

## Current Phase
Phase 0 — Foundation (in progress as of 2026-04-01)

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

## Next Steps
1. Complete Phase 0: monorepo setup, Docker, Prisma migration, webhook endpoint
2. Submit WhatsApp template messages for Meta approval (do this NOW — takes days)
3. Begin Phase 1: auth, events CRUD, guest import
```

---

### 19. Clean Code & Scalability Requirements

**Code Organization:**
```
apps/api/src/
  config/          ← env, db, redis singletons
  middleware/       ← auth, validation, rate-limit, error-handler
  domains/          ← feature folders (NOT layer folders)
    [feature]/
      [feature].router.ts     ← Express routes only (delegate to service)
      [feature].service.ts    ← Business logic + orchestration
      [feature].queries.ts    ← Prisma calls isolated here
      [feature].schemas.ts    ← Zod schemas for request/response
  jobs/             ← BullMQ queue instances + job handlers + worker entry
```

**Rules enforced by structure:**
- Routers never call Prisma directly — they call services
- Services never define Zod schemas — schemas live in `.schemas.ts`
- Queries files are the only files that import `prismaClient`
- The state machine (`conversations.machine.ts`) has zero imports from Prisma, BullMQ, or fetch

**Naming Conventions:**
- Files: `kebab-case.ts`
- Variables/functions: `camelCase`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` for true constants, `camelCase` for config objects
- Database columns: `snake_case` (Prisma @map decorators align to TypeScript camelCase)

**Separation of Concerns:**
- HTTP layer (routers): parse request, validate input, call service, format response
- Service layer: business logic, orchestration, no HTTP knowledge
- Query layer: data access, Prisma calls, no business logic
- Job layer: async execution, no HTTP context
- State machine: pure transitions, no I/O

**Testability:**
- State machine: unit tested with `vitest` — zero external dependencies
- Services: integration tested with a real test database (not mocks)
- Routers: tested via `supertest` — tests the full HTTP layer
- WhatsApp service: mocked in tests (external HTTP call)
- No class-based services (functions are easier to test and compose)

**Future Extensibility:**
- `FlowStep` table in schema from day 1 — no breaking migration needed for Phase 3
- `Event.wa_phone_number_id` field from day 1 — multi-WA-number support requires no schema change
- `AdminUser` → `Organization` migration planned in `PROJECT_CONTEXT.md` — developers are aware
- BullMQ queues are named constants (`QUEUE_NAMES`) — adding a new queue is one file change

---

### 20. Recommended First Build Path

**What to build FIRST (in order):**

1. **Monorepo scaffold** (1 day) — Without this, nothing else can progress. pnpm workspaces, TypeScript configs, shared package.
2. **Docker Compose + Prisma schema** (0.5 day) — Database is the foundation. Apply the full schema once. Don't revisit it for Phase 1.
3. **Webhook endpoint** (0.5 day) — Submit for Meta verification immediately. This takes time to propagate. Do not wait.
4. **WhatsApp template submission** (parallel, non-code) — Submit consent template to Meta NOW. Approval takes 1–5 business days. If you wait until Phase 1 is "done", you'll be blocked.
5. **Auth + session** (1 day) — Required for any admin UI route. Simple bcrypt + express-session.
6. **Events CRUD** (1 day) — The foundational entity. Guest import depends on it.
7. **Guest CSV import** (1.5 days) — The most complex piece of Phase 1 that has no dependencies on WhatsApp. Build and test this independently.
8. **State machine (pure)** (1 day) — Build and unit test with 100% coverage before connecting to any I/O. This is the core product logic.
9. **BullMQ queues + send message service** (1 day) — Connect outbound sending.
10. **Inbound processing job** (1 day) — Connect the full loop: webhook → queue → state machine → send reply.
11. **Admin dashboard (Next.js)** (3 days) — Once the backend loop works end-to-end, build the UI.

**What to validate early:**
- Send a real WhatsApp message from the system to a test number — Day 3 at the latest
- Receive a reply and have the state machine advance — Day 5 at the latest
- Complete a full RSVP flow on a test phone — before building the dashboard
- Import a real CSV file from a test planner — before Phase 1 ships

**What to delay:**
- Reminders (Phase 2) — don't block on this
- Configurable flows (Phase 3) — hardcode everything in Phase 1
- Beautiful UI — functional first, polished second
- Error pages / loading states — add in Phase 2
- Analytics / charts — never until explicitly requested

---

### 21. Anti-Patterns to Avoid

1. **Adding configuration options the planner will never use.** Every option they don't understand is a support request. If in doubt, hardcode it and make it configurable later when someone actually asks.

2. **Using Next.js API routes for the webhook handler.** Serverless cold starts will cause WhatsApp's 30-second timeout to trigger. The webhook MUST live in the long-lived Express process.

3. **Processing webhooks synchronously.** Return 200 first, process after. Doing DB writes + state machine + WhatsApp API calls in the webhook handler will timeout on load.

4. **Not validating HMAC on webhooks.** This is a security hole. Any request to `/webhook/whatsapp` that skips HMAC validation can inject arbitrary messages into the system.

5. **Storing session secret or WhatsApp tokens in the repo.** Even in `.env` files that are gitignored. Use `.env.example` with placeholder values only.

6. **Mutating Prisma result objects.** Spread or reconstruct. Never `result.field = newValue`.

7. **Calling Prisma from inside the state machine.** The machine is a pure function. All I/O goes through the service layer. This is what makes the machine unit-testable.

8. **Skipping the `webhook_events` idempotency check.** Meta delivers webhooks at-least-once. Without `UNIQUE(source, wa_message_id)`, a guest will receive the same message twice when Meta retries.

9. **Hardcoding WhatsApp template names.** Put them in env vars or a constants file. Templates change during Meta approval cycles.

10. **Building Phase 3 features in Phase 1.** The `FlowStep` table is in the schema but NOT used in Phase 1. Do not wire it up early "just in case". The hardcoded approach is faster, safer, and easier to test.

11. **Displaying technical state names in the UI.** `AWAITING_ATTENDANCE` means nothing to a Wedding Planner. Map every state to plain-language labels in the frontend layer.

12. **Sending a message to a guest with `ConsentStatus = REVOKED`.** This must be blocked at the service layer with an explicit check, not just filtered in the UI.

13. **Making the `worker` dyno share state with the `web` dyno via in-memory variables.** They are separate processes. All shared state goes through PostgreSQL or Redis.

14. **Not running `prisma migrate deploy` in the `release` phase.** Running it manually is forgettable and risky. The release phase ensures migrations always run before traffic hits the new code.

15. **Importing CSV without a preview step.** Planners make mistakes. Importing 200 guests with wrong phone formats is painful to recover from. Always show a preview with row-level validation before committing the import.

---

## Part 2 — Implementation Tasks

---

### Phase 0: Foundation

#### Task 1: Initialize pnpm Monorepo

**Files to create:**
- `pnpm-workspace.yaml`
- `package.json` (root)
- `tsconfig.base.json` (root)
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`
- `.gitignore`
- `.env.example`

- [ ] **Step 1.1: Create root workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// package.json (root)
{
  "name": "topaz-ibis",
  "private": true,
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "scripts": {
    "dev": "concurrently \"pnpm --filter api dev\" \"pnpm --filter web dev\"",
    "build": "pnpm --filter shared build && pnpm --filter api build && pnpm --filter web build",
    "test": "pnpm --filter api test && pnpm --filter web test",
    "db:migrate": "pnpm --filter api db:migrate",
    "db:studio": "pnpm --filter api db:studio"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "typescript": "^5.4.5"
  }
}
```

```json
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 1.2: Create packages/shared**

```json
// packages/shared/package.json
{
  "name": "@topaz/shared",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

```typescript
// packages/shared/src/index.ts
export * from './types/conversation'
export * from './types/api'
```

```typescript
// packages/shared/src/types/conversation.ts
export enum ConversationStep {
  PENDING = 'PENDING',
  INITIAL_SENT = 'INITIAL_SENT',
  AWAITING_ATTENDANCE = 'AWAITING_ATTENDANCE',
  AWAITING_COMPANIONS = 'AWAITING_COMPANIONS',
  AWAITING_DIETARY = 'AWAITING_DIETARY',
  COMPLETE = 'COMPLETE',
  OPT_OUT = 'OPT_OUT',
  UNREACHABLE = 'UNREACHABLE',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum ConsentStatus {
  PENDING = 'PENDING',
  GRANTED = 'GRANTED',
  REVOKED = 'REVOKED',
}
```

```typescript
// packages/shared/src/types/api.ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number
    page: number
    limit: number
  }
}
```

- [ ] **Step 1.3: Create apps/api skeleton**

```json
// apps/api/package.json
{
  "name": "@topaz/api",
  "version": "0.0.1",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@topaz/shared": "workspace:*",
    "@prisma/client": "^5.14.0",
    "bullmq": "^5.12.0",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "express-session": "^1.18.0",
    "connect-pg-simple": "^9.0.1",
    "bcrypt": "^5.1.1",
    "ioredis": "^5.4.1",
    "pino": "^9.2.0",
    "pino-pretty": "^11.1.0",
    "zod": "^3.23.8",
    "multer": "^1.4.5-lts.1",
    "csv-parse": "^5.5.6",
    "libphonenumber-js": "^1.11.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/bcrypt": "^5.0.2",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.14.2",
    "prisma": "^5.14.0",
    "tsx": "^4.15.1",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
```

```json
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 1.4: Create apps/web skeleton**

```bash
# Run from repo root:
pnpm create next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

Then update `apps/web/next.config.ts`:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',  // Required for Heroku deployment
}

export default nextConfig
```

- [ ] **Step 1.5: Create .gitignore and .env.example**

```gitignore
# .gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.next/
```

```bash
# .env.example
DATABASE_URL="postgresql://postgres:password@localhost:5432/rsvp_dev"
REDIS_URL="redis://localhost:6379"
SESSION_SECRET="change-me-minimum-32-characters-long"
SESSION_MAX_AGE_MS="86400000"
WA_VERIFY_TOKEN="your-webhook-verify-token"
WA_APP_SECRET="your-whatsapp-app-secret"
WA_ACCESS_TOKEN="your-permanent-access-token"
WA_API_VERSION="v19.0"
WA_PHONE_NUMBER_ID="your-phone-number-id"
NODE_ENV="development"
PORT="3001"
NEXT_PUBLIC_API_URL="http://localhost:3001"
BULLMQ_CONCURRENCY="5"
LOG_LEVEL="debug"
```

- [ ] **Step 1.6: Install dependencies**

```bash
cd /path/to/topaz-ibis
pnpm install
```

Expected: All packages install without errors. `pnpm -r build` succeeds for `packages/shared`.

- [ ] **Step 1.7: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore .env.example apps/ packages/
git commit -m "feat: initialize pnpm monorepo with api, web, and shared packages"
```

---

#### Task 2: Docker Compose + Prisma Schema

**Files to create:**
- `docker-compose.yml`
- `apps/api/prisma/schema.prisma`

- [ ] **Step 2.1: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: rsvp_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 2.2: Create Prisma schema**

Create `apps/api/prisma/schema.prisma` with the full schema defined in §8 of this document (all tables: admin_users, events, guests, consent_records, conversation_states, rsvp_responses, messages, webhook_events, flow_steps, reminders — with all enums).

The full schema is defined in the architecture output above. Copy it verbatim.

- [ ] **Step 2.3: Start Docker services and run migration**

```bash
docker compose up -d
# Wait ~10 seconds for postgres to be healthy

cp .env.example .env
# .env should already have: DATABASE_URL="postgresql://postgres:password@localhost:5432/rsvp_dev"

cd apps/api
npx prisma migrate dev --name init
```

Expected output:
```
Applying migration `20260401000000_init`
✔ Generated Prisma Client
```

- [ ] **Step 2.4: Verify schema via Prisma Studio**

```bash
npx prisma studio
```

Open http://localhost:5555. Verify all tables exist: admin_users, events, guests, consent_records, conversation_states, rsvp_responses, messages, webhook_events, flow_steps, reminders.

- [ ] **Step 2.5: Commit**

```bash
git add docker-compose.yml apps/api/prisma/
git commit -m "feat: add docker compose services and complete prisma schema"
```

---

#### Task 3: Express App Bootstrap + Env Validation

**Files to create:**
- `apps/api/src/config/env.ts`
- `apps/api/src/config/database.ts`
- `apps/api/src/config/redis.ts`
- `apps/api/src/config/logger.ts`
- `apps/api/src/middleware/error-handler.ts`
- `apps/api/src/server.ts`
- `apps/api/src/main.ts`

- [ ] **Step 3.1: Write failing test for env validation**

Create `apps/api/src/config/env.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('env config', () => {
  it('throws if DATABASE_URL is missing', () => {
    const originalEnv = process.env.DATABASE_URL
    delete process.env.DATABASE_URL

    expect(() => {
      vi.resetModules()
      require('./env')
    }).toThrow()

    process.env.DATABASE_URL = originalEnv
  })
})
```

Run: `cd apps/api && pnpm test`
Expected: FAIL — `env.ts` does not exist yet.

- [ ] **Step 3.2: Implement env.ts**

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE_MS: z.coerce.number().default(86400000),
  WA_VERIFY_TOKEN: z.string().min(1),
  WA_APP_SECRET: z.string().min(1),
  WA_ACCESS_TOKEN: z.string().min(1),
  WA_API_VERSION: z.string().default('v19.0'),
  WA_PHONE_NUMBER_ID: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  BULLMQ_CONCURRENCY: z.coerce.number().default(5),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
```

- [ ] **Step 3.3: Run test to verify it passes**

```bash
cd apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 3.4: Implement database.ts, redis.ts, logger.ts**

```typescript
// apps/api/src/config/database.ts
import { PrismaClient } from '@prisma/client'
import { env } from './env'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

```typescript
// apps/api/src/config/redis.ts
import Redis from 'ioredis'
import { env } from './env'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
})
```

```typescript
// apps/api/src/config/logger.ts
import pino from 'pino'
import { env } from './env'

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})
```

- [ ] **Step 3.5: Implement error-handler.ts**

```typescript
// apps/api/src/middleware/error-handler.ts
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../config/logger'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : 'Internal server error'
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ success: false, error: message })
}
```

- [ ] **Step 3.6: Implement server.ts and main.ts**

```typescript
// apps/api/src/server.ts
import express from 'express'
import { errorHandler } from './middleware/error-handler'

export function createApp(): express.Application {
  const app = express()

  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use(errorHandler)

  return app
}
```

```typescript
// apps/api/src/main.ts
import { createApp } from './server'
import { env } from './config/env'
import { logger } from './config/logger'

const app = createApp()

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API server started')
})
```

- [ ] **Step 3.7: Verify health endpoint**

```bash
cd apps/api && pnpm dev
```

In another terminal:
```bash
curl http://localhost:3001/health
```

Expected: `{"success":true,"status":"ok","timestamp":"..."}`

- [ ] **Step 3.8: Commit**

```bash
git add apps/api/src/
git commit -m "feat: bootstrap express app with env validation and health endpoint"
```

---

#### Task 4: WhatsApp Webhook Endpoint

**Files to create:**
- `apps/api/src/domains/whatsapp/whatsapp.verify.ts`
- `apps/api/src/domains/whatsapp/whatsapp.router.ts`
- `apps/api/src/domains/whatsapp/whatsapp.verify.test.ts`

- [ ] **Step 4.1: Write failing tests for HMAC verification**

```typescript
// apps/api/src/domains/whatsapp/whatsapp.verify.test.ts
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { verifyWebhookSignature } from './whatsapp.verify'

describe('verifyWebhookSignature', () => {
  const appSecret = 'test-app-secret'
  const payload = Buffer.from('{"test":"payload"}')

  it('returns true for a valid signature', () => {
    const hmac = crypto.createHmac('sha256', appSecret).update(payload).digest('hex')
    const signature = `sha256=${hmac}`
    expect(verifyWebhookSignature({ payload, signature, appSecret })).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    expect(
      verifyWebhookSignature({ payload, signature: 'sha256=invalid', appSecret })
    ).toBe(false)
  })

  it('returns false when signature header is missing', () => {
    expect(
      verifyWebhookSignature({ payload, signature: undefined, appSecret })
    ).toBe(false)
  })
})
```

Run: `pnpm test`. Expected: FAIL — module not found.

- [ ] **Step 4.2: Implement whatsapp.verify.ts**

```typescript
// apps/api/src/domains/whatsapp/whatsapp.verify.ts
import crypto from 'crypto'

interface VerifyParams {
  payload: Buffer
  signature: string | undefined
  appSecret: string
}

export function verifyWebhookSignature({ payload, signature, appSecret }: VerifyParams): boolean {
  if (!signature) return false

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(payload).digest('hex')}`

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
```

Run: `pnpm test`. Expected: PASS (3 tests).

- [ ] **Step 4.3: Implement whatsapp.router.ts**

```typescript
// apps/api/src/domains/whatsapp/whatsapp.router.ts
import { Router } from 'express'
import type { Request, Response } from 'express'
import { env } from '../../config/env'
import { prisma } from '../../config/database'
import { logger } from '../../config/logger'
import { verifyWebhookSignature } from './whatsapp.verify'

export const whatsappRouter = Router()

// Meta webhook verification challenge
whatsappRouter.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === env.WA_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified successfully')
    res.status(200).send(challenge)
    return
  }

  logger.warn({ mode, token }, 'WhatsApp webhook verification failed')
  res.sendStatus(403)
})

// Receive messages and status updates
// IMPORTANT: Uses express.raw() — must be registered BEFORE express.json() in server.ts
whatsappRouter.post(
  '/whatsapp',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.get('X-Hub-Signature-256')

    if (!verifyWebhookSignature({ payload: req.body, signature, appSecret: env.WA_APP_SECRET })) {
      logger.warn({ signature }, 'Invalid webhook signature')
      res.sendStatus(403)
      return
    }

    // Return 200 immediately — process async
    res.sendStatus(200)

    try {
      const payload = JSON.parse(req.body.toString())
      const changes = payload?.entry?.[0]?.changes?.[0]?.value

      if (!changes) return

      const messages = changes.messages ?? []
      const statuses = changes.statuses ?? []

      // Store each inbound message as a webhook event (idempotency)
      for (const message of messages) {
        await prisma.webhookEvent.upsert({
          where: { source_waMessageId: { source: 'whatsapp', waMessageId: message.id } },
          create: {
            source: 'whatsapp',
            waMessageId: message.id,
            type: 'messages',
            status: 'RECEIVED',
            rawPayload: payload,
          },
          update: {
            status: 'DUPLICATE',
          },
        })
      }

      // Store status updates (no idempotency needed — idempotent by nature)
      for (const status of statuses) {
        logger.info({ waMessageId: status.id, status: status.status }, 'Message status update')
        // TODO Phase 1: update Message row status
      }
    } catch (error) {
      logger.error({ error }, 'Error processing webhook payload')
    }
  }
)

// Fix: need to import express inside the router file
import express from 'express'
```

- [ ] **Step 4.4: Register webhook router in server.ts**

```typescript
// apps/api/src/server.ts — updated
import express from 'express'
import { errorHandler } from './middleware/error-handler'
import { whatsappRouter } from './domains/whatsapp/whatsapp.router'

export function createApp(): express.Application {
  const app = express()

  // Webhook route must be BEFORE express.json() — uses raw body for HMAC
  app.use('/webhook', whatsappRouter)

  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use(errorHandler)

  return app
}
```

- [ ] **Step 4.5: Test webhook verification manually**

```bash
# Start tunnel
cloudflared tunnel --url http://localhost:3001
# Copy the https://xxxx.trycloudflare.com URL

# In Meta Developer Console:
# App → WhatsApp → Configuration → Webhook
# Callback URL: https://xxxx.trycloudflare.com/webhook/whatsapp
# Verify token: (value from WA_VERIFY_TOKEN in .env)
# Click "Verify and Save"
```

Expected: Meta shows "Verified ✓"

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/domains/whatsapp/
git commit -m "feat: add whatsapp webhook endpoint with HMAC verification and idempotent storage"
```

---

#### Task 5: Commit PROJECT_CONTEXT.md

- [ ] **Step 5.1: Create PROJECT_CONTEXT.md at repo root**

Create the file using the template defined in §18 of this document.

- [ ] **Step 5.2: Commit**

```bash
git add PROJECT_CONTEXT.md
git commit -m "docs: add PROJECT_CONTEXT.md with architecture decisions and open questions"
```

**Phase 0 complete.** All acceptance criteria should now pass:
- `docker compose up -d && pnpm dev` starts without errors ✓
- `GET /health` returns 200 ✓
- WhatsApp webhook verification succeeds in Meta Console ✓
- A test message appears as a row in `webhook_events` ✓
- `prisma migrate dev` runs cleanly ✓

---

### Phase 1: MVP

> Phase 1 tasks are defined at the feature level. Each task follows the same pattern: failing test → implementation → passing test → commit. Phase 1 tasks to be broken into step-level detail during execution using `superpowers:subagent-driven-development`.

#### Task 6: Auth — Login/Logout/Session

**Files:**
- `apps/api/src/domains/auth/auth.schemas.ts`
- `apps/api/src/domains/auth/auth.service.ts`
- `apps/api/src/domains/auth/auth.queries.ts`
- `apps/api/src/domains/auth/auth.router.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/config/session.ts`

**Tests:**
- `apps/api/src/domains/auth/auth.service.test.ts`
- `apps/api/src/domains/auth/auth.router.test.ts`

- [x] Write failing tests for login (wrong password returns 401, correct returns 200 + sets session)
- [x] Implement session config with connect-pg-simple
- [x] Implement auth.queries: findAdminUserByEmail
- [x] Implement auth.service: verifyPassword (bcrypt.compare)
- [x] Implement auth.router: POST /login, POST /logout, GET /me
- [x] Implement requireAuth middleware (401 if no session)
- [x] Register auth router in server.ts
- [x] Run tests, verify all pass (8/8)
- [x] Create a seed script: `apps/api/prisma/seed.ts` — creates one admin user for development

---

#### Task 7: Events CRUD

**Files:**
- `apps/api/src/domains/events/events.schemas.ts`
- `apps/api/src/domains/events/events.queries.ts`
- `apps/api/src/domains/events/events.service.ts`
- `apps/api/src/domains/events/events.router.ts`
- `apps/api/src/middleware/require-event-owner.ts`

**Tests:** `apps/api/src/domains/events/events.router.test.ts`

- [x] Write failing tests: list events (empty → []), create event, get event by id, 404 for missing id
- [x] Implement schemas, queries, service, router
- [x] Implement requireEventOwner middleware
- [x] Register router: `app.use('/api/v1/events', requireAuth, eventsRouter)`
- [x] Run tests, verify all pass (9/9)

---

#### Task 8: Guest Import Pipeline

**Files:**
- `apps/api/src/domains/guests/guests.schemas.ts`
- `apps/api/src/domains/guests/guests.queries.ts`
- `apps/api/src/domains/guests/guests.service.ts`
- `apps/api/src/domains/guests/guests.import.ts`
- `apps/api/src/domains/guests/guests.router.ts`

**Tests:** `apps/api/src/domains/guests/guests.import.test.ts`

- [x] Write failing tests for CSV parsing: valid row → guest object; invalid phone → error row; duplicate phone → warning row
- [x] Implement phone normalization using `libphonenumber-js` (normalize to E.164)
- [x] Implement CSV parse pipeline: parse → validate → normalize → split valid/invalid
- [x] Implement POST /import: multer upload, parse, return preview (no DB write yet)
- [x] Implement POST /import/confirm: write valid rows to DB, create ConsentRecord (PENDING) + ConversationState (PENDING) + RsvpResponse for each (atomic transaction)
- [x] Run tests, verify all pass (9/9)

---

#### Task 9: Conversation State Machine

**Files:**
- `apps/api/src/domains/conversations/conversations.machine.ts`
- `apps/api/src/domains/conversations/default-messages.ts`
- `apps/api/src/domains/conversations/message-normalizer.ts`

**Tests:** `apps/api/src/domains/conversations/conversations.machine.test.ts`

- [x] Write failing tests for ALL state transitions (28 machine tests + 38 normalizer tests)
- [x] Implement message-normalizer.ts (pure, zero I/O imports)
- [x] Implement conversations.machine.ts as pure function (zero I/O imports)
- [x] Implement default-messages.ts with Spanish and English message strings
- [x] Run all tests (66/66). ALL PASS

---

#### Task 10: WhatsApp Send Service + BullMQ Setup

**Files:**
- `apps/api/src/domains/whatsapp/whatsapp.service.ts`
- `apps/api/src/domains/whatsapp/whatsapp.schemas.ts`
- `apps/api/src/jobs/queues.ts`
- `apps/api/src/jobs/send-message.job.ts`
- `apps/api/src/jobs/process-inbound.job.ts`
- `apps/api/src/jobs/worker.ts`

**Tests:** `apps/api/src/domains/whatsapp/whatsapp.service.test.ts` (mocked HTTP)

- [x] Write failing test: sendTextMessage calls correct Cloud API URL with correct body
- [x] Implement whatsapp.service.ts: sendTextMessage, sendTemplateMessage (uses fetch, base URL from env)
- [x] Run test (mock fetch). PASS (10/10)
- [x] Implement send-message.job.ts: calls whatsapp.service, updates Message row status
- [x] Implement process-inbound.job.ts: delegates to conversations.service.processInboundConversation
- [x] Implement worker.ts: registers both workers, graceful shutdown
- [x] Webhook handler already enqueues inbound-processing job (done in Phase 0)

---

#### Task 11: Conversation Service Layer

**Files:**
- `apps/api/src/domains/conversations/conversations.queries.ts`
- `apps/api/src/domains/conversations/conversations.service.ts`

**Tests:** `apps/api/src/domains/conversations/conversations.service.test.ts` (integration, real DB)

- [x] Write failing unit tests for processInboundConversation (7 test cases, mocked DB)
- [x] Implement conversations.queries: getGuestWithState, updateConversationState, upsertRsvpResponse, revokeConsent, createOutboundMessage, markWebhookEventProcessed/Failed
- [x] Implement conversations.service: processInboundConversation (loads state, calls machine, executes all action types)
- [x] Run tests. PASS (7/7)

---

#### Task 12: Campaign Launch

**Files:** Add to `apps/api/src/domains/events/events.router.ts`

**Tests:** Add to `apps/api/src/domains/events/events.router.test.ts`

- [x] Write failing test: POST /events/:id/launch enqueues jobs for all PENDING guests
- [x] Add findPendingGuests query (guests with state=PENDING or no conversationState)
- [x] Add launchCampaign service: creates Message row, upserts ConversationState→INITIAL_SENT, enqueues per guest
- [x] Run tests. PASS (2/2 new, 11 total events tests)

---

#### Task 13: RSVP Responses API

**Files:**
- `apps/api/src/domains/rsvp/rsvp.queries.ts`
- `apps/api/src/domains/rsvp/rsvp.service.ts`
- `apps/api/src/domains/rsvp/rsvp.router.ts`

- [x] Implement GET /events/:id/responses (paginated, with status filter)
- [x] Implement GET /events/:id/responses/export (CSV download, 8 columns, plain-language status labels)
- [x] Implement GET /events/:id/responses/stats ({ total, attending, declined, pending, optedOut, unreachable, complete })
- [x] Registered with requireAuth + requireEventOwner

---

#### Task 14: Admin Dashboard (Next.js) — NEXT TO BUILD

**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
**API base URL:** `process.env.NEXT_PUBLIC_API_URL` (default: `http://localhost:3001`)
**Auth:** Cookie-based session (set by Express `/api/v1/auth/login`). Use `credentials: 'include'` on all fetch calls.

**Files to create:**
- `apps/web/src/lib/api-client.ts` — typed fetch wrapper
- `apps/web/src/app/(auth)/login/page.tsx` — login page
- `apps/web/src/app/(dashboard)/layout.tsx` — authenticated layout (redirect to /login if no session)
- `apps/web/src/app/(dashboard)/dashboard/page.tsx` — event cards list
- `apps/web/src/app/(dashboard)/events/new/page.tsx` — create event form
- `apps/web/src/app/(dashboard)/events/[eventId]/page.tsx` — event detail (stats + action buttons)
- `apps/web/src/app/(dashboard)/events/[eventId]/guests/page.tsx` — guest list with status badges
- `apps/web/src/app/(dashboard)/events/[eventId]/guests/import/page.tsx` — CSV import (drag-drop, preview, confirm)
- `apps/web/src/app/(dashboard)/events/[eventId]/responses/page.tsx` — RSVP table + export

**api-client.ts spec:**
```typescript
// Base URL: process.env.NEXT_PUBLIC_API_URL
// All requests: credentials: 'include', Content-Type: application/json
// Returns ApiResponse<T> shape: { success: boolean, data?: T, error?: string }
// On 401: redirect to /login (client-side)
// On !ok: throw Error(response.error ?? 'Request failed')
//
// export const api = {
//   auth: { login(body), logout(), me() },
//   events: { list(), create(body), get(id), update(id, body), launch(id) },
//   guests: { list(eventId), importPreview(eventId, file), importConfirm(eventId, body) },
//   responses: { list(eventId, params), stats(eventId), exportCsv(eventId) },
// }
```

**Login page:**
- Email + password form
- On submit: POST /auth/login → redirect to /dashboard on success
- Show error message on 401
- Route: `/login`

**Dashboard layout:**
- Server component: call GET /auth/me. If 401 → redirect('/login')
- Wraps all dashboard pages with a nav sidebar: "Events" link
- Shows current user name in header

**Dashboard page (`/dashboard`):**
- Fetches GET /events
- Renders event cards: name, date, venue, "View →" link
- "New Event" button → /events/new
- Empty state: "No events yet. Create your first event."

**New Event page (`/events/new`):**
- 3-field form: Event Name, Wedding Date (date picker), Venue (optional)
- On submit: POST /events → redirect to /events/:id
- Validation errors inline

**Event Detail page (`/events/:eventId`):**
- Stats strip: fetches GET /responses/stats — shows Confirmed / Declined / Pending / Opted Out counts
- 3 action buttons:
  - "Send RSVP Messages" → calls POST /events/:id/launch with confirmation modal ("Send to X guests?")
  - "Export CSV" → GET /responses/export (downloads file)
  - "View Guests" → /events/:id/guests
  - "View Responses" → /events/:id/responses
- Shows event name, date, venue

**Guest List page (`/events/:eventId/guests`):**
- Table: Name, Phone, Status badge (plain-language labels), Created At
- Status badge colors: green=Confirmed, red=Declined, orange=Waiting, grey=Opted Out/Unreachable, blue=Message Sent
- Status label mapping (from ConversationStep):
  - PENDING → "Not contacted"
  - INITIAL_SENT → "Message sent"
  - AWAITING_ATTENDANCE → "Waiting for reply"
  - AWAITING_COMPANIONS → "Waiting for companions"
  - AWAITING_DIETARY → "Waiting for dietary"
  - COMPLETE (attending) → "Confirmed ✓"
  - COMPLETE (not attending) → "Declined"
  - OPT_OUT → "Opted out"
  - UNREACHABLE → "Unreachable"
- "Import Guests" button → /events/:id/guests/import

**Import page (`/events/:eventId/guests/import`):**
- Step 1: File drop zone (accepts .csv only)
- On file select: POST /import (multipart) → show preview table
- Preview table columns: Name, Phone, Status (✓ valid / ⚠ duplicate / ✗ invalid)
- Shows count: "X valid, Y with warnings, Z invalid"
- "Import X valid guests" button → POST /import/confirm → redirect to /guests
- "Download CSV template" link (hardcoded example CSV)

**Responses page (`/events/:eventId/responses`):**
- Table: Name, Phone, Status, Attending, Party Size, Dietary Notes, Submitted At
- Filter tabs: All | Confirmed | Declined | Pending | Opted Out
- "Export CSV" button → GET /responses/export
- Pagination: 50 per page, prev/next buttons

**Implementation notes:**
- Use shadcn/ui components: Button, Card, Table, Badge, Dialog (confirmation modal), Input, Label
- Use `next/navigation` `useRouter` for client-side redirects
- Server components for data fetching where possible; Client components only for forms and interactivity
- No TypeScript `any` — use the shared `ApiResponse<T>` type from `packages/shared`
- Tailwind for all styling — no CSS files
- No loading skeletons needed in Phase 1 (add in Phase 2)
- No error boundaries needed in Phase 1

**Steps:**
- [ ] Set up shadcn/ui in apps/web (run `npx shadcn@latest init`)
- [ ] Implement api-client.ts
- [ ] Implement login page + layout auth guard
- [ ] Implement dashboard + new event form
- [ ] Implement event detail page with stats + launch button
- [ ] Implement guest list page
- [ ] Implement import page
- [ ] Implement responses page
- [ ] Run `pnpm --filter web build` — zero errors
- [ ] Commit: `feat: add complete admin dashboard UI`

---

#### Task 15: Heroku Deploy — Phase 1

- [ ] Create `Procfile`
- [ ] Set all Heroku Config Vars
- [ ] `git push heroku main`
- [ ] Verify release phase ran migrations
- [ ] Verify `GET /health` returns 200 on production URL
- [ ] Run one full RSVP flow end-to-end on production
- [ ] Commit: `chore: add Procfile for heroku deployment`

---

### Phase 2–4: Task Stubs

> Phase 2, 3, and 4 tasks will be detailed at execution time. The backlog in §16 defines all features. Use `superpowers:subagent-driven-development` to execute each phase's tasks.

**Phase 2 entry criteria:** Phase 1 acceptance criteria pass on production. A real event has been run.

**Phase 3 entry criteria:** Phase 2 reminders and retry logic in production. At least one planner has requested custom question wording.

**Phase 4 entry criteria:** Multiple planners are paying customers. SaaS architecture has been validated by business.

---

## Verification Checklist

Before declaring Phase 0 complete:
- [ ] `docker compose up -d` starts both services with healthy status
- [ ] `pnpm dev` starts api on :3001 and web on :3000 without errors
- [ ] `curl localhost:3001/health` → `{"success":true,"status":"ok",...}`
- [ ] `prisma studio` shows all 10 tables
- [ ] WhatsApp webhook verification succeeds in Meta Developer Console
- [ ] Sending a WhatsApp message creates a row in `webhook_events` with status `RECEIVED`

Before declaring Phase 1 MVP complete:
- [ ] Planner can log in with seeded credentials
- [ ] Can create an event (name, date, venue)
- [ ] Can import a 10-row CSV (no errors on valid data, error rows shown on invalid data)
- [ ] Guest list shows all 10 guests with status "Not contacted yet"
- [ ] "Send RSVP Messages" button triggers messages to all 10 guests within 60 seconds
- [ ] Replying "Sí" advances the conversation (test with a real WhatsApp number)
- [ ] Replying through all steps results in ConversationState = COMPLETE and RsvpResponse populated
- [ ] Replying "STOP" sets the guest status to "Opted out" and blocks further messages
- [ ] Responses table shows correct data per guest
- [ ] CSV export downloads with correct content
- [ ] All unit tests pass: `pnpm test`
- [ ] Production deployment on Heroku is live
