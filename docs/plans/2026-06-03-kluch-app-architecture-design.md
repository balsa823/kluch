# Kluch — Application Architecture Design

**Date:** 2026-06-03
**Status:** Approved (brainstorming complete)
**Author:** Balsa + Claude

## Purpose

Kluch is a trusted operator for foreigners living in Montenegro — starting with
rentals (the wedge) and expanding into every service a foreigner needs. The
business plan launches **Telegram-bot-first**. This document defines the
technical architecture so that the same backend powers the Telegram bot today
and a web app + native mobile apps (iOS + Android) later — with **no rewrite**
between phases.

## Core principle: one backend, one database, many front doors

The Telegram bot, the web app, and the future mobile apps are all just
*interfaces* over a single backend and a single database. Business logic (rent,
listings, maintenance tickets, payments, translation) is written **once** and
reused by every interface.

```
  Telegram bot ─┐
  Web app      ─┼──►  Backend API (TypeScript)  ──►  Postgres (Supabase, managed)
  Mobile app   ─┘     business logic lives here       all data lives here
```

This is what makes Telegram-first cheap *and* future-proof: the web/mobile apps
inherit 100% of the backend built for the bot.

## Guiding constraints

- **Builder:** solo, working largely with AI assistance → optimize for a single
  mainstream language with maximum training data and tooling.
- **Cost-sensitive:** target ~$5–10/mo at launch.
- **No proprietary lock-in:** identity and data live in tables/services we can
  export and move. Specifically, we do **not** use Supabase Auth.
- **Web first, then mobile on all mobile OSs** from a single codebase.

## The stack

| Layer | Choice | Why |
|---|---|---|
| **Language** | **TypeScript** everywhere | One language for bot, web, and mobile. Most AI training data. Shared types end-to-end. |
| **Database** | **Supabase Postgres**, used as plain Postgres only | Managed + automatic backups; free to start. We ignore Supabase Auth → no lock-in. Fully portable via `pg_dump`. |
| **DB access (ORM)** | **Drizzle ORM** | Type-safe, lightweight, reads like SQL, no lock-in, very AI-friendly. |
| **Telegram bot** | **grammY** | Best modern TypeScript Telegram framework; excellent docs. |
| **Backend API** | **Hono** (alt: Fastify) | Lightweight TS server that runs the bot *and* serves the API for web/mobile. |
| **Identity — Phase 1** | Telegram user ID | Telegram authenticates users for free. Store `telegram_user_id` in our own `users` table. No passwords needed for the bot phase. |
| **Auth — Phase 2+** | **Better Auth** (alt: Lucia) | Portable TypeScript auth storing users in *our* Postgres tables. Supports Telegram login + email/OAuth. No lock-in. |
| **Web + Mobile** | **Expo** (React Native + Expo Router) | One codebase → **web + iOS + Android**. Makes "web now, all mobile OSs later" a single effort, not three. |
| **Backend hosting** | **Railway** (Hobby, ~$5/mo) | `git push` to deploy; always-on process; managed logs, metrics, and cron. Lowest ops; pairs cleanly with managed Supabase. Container is portable to Fly.io / Hetzner later. |
| **Static web hosting (Phase 2)** | Vercel or Hetzner | For the Expo web export / landing site. (Landing page already on Vercel.) |

### Why not these (decisions captured)

- **Bare Hetzner VM for the backend** — viable and cheapest, but we'd own
  backups/security/uptime. Railway gives near-zero ops at the same price. The
  *container* stays portable, so we can move to a VM later if cost demands.
- **Vercel for the backend/bot** — wrong tool: serverless has no always-on
  process, no easy background jobs (rent reminders), cold starts, and its free
  tier forbids commercial use (would require Pro at $20/mo). Vercel is for the
  static web frontend only.
- **Supabase Auth** — rejected to avoid lock-in. Supabase is used as plain
  Postgres; identity lives in our own tables.

## Repository shape (one monorepo)

```
kluch/
├── packages/
│   ├── db          → Drizzle schema + migrations            (shared)
│   └── core        → business logic (rent, tickets, etc.)   (shared by all front doors)
├── apps/
│   ├── bot         → grammY bot + Hono API                  (Phase 1, ship first)
│   └── app         → Expo universal app (web + iOS + Android) (Phase 2 → 3)
└── docs/
    └── plans/      → design & implementation docs
```

Tooling: pnpm workspaces (optionally Turborepo later). All-TypeScript means
types from `packages/db` and `packages/core` flow directly into the bot and the
app — change a schema, get a compile error everywhere it matters.

## Data flow example (paying rent via the bot)

1. User sends `/payrent` in Telegram.
2. grammY (in `apps/bot`) receives the update, identifies the user by
   `telegram_user_id`.
3. Calls a function in `packages/core` (`recordRentPayment`) — the same function
   the web app will later call via the API.
4. `packages/core` uses Drizzle (`packages/db`) to write to Supabase Postgres.
5. Bot replies with confirmation. The payment is now visible to every interface.

## Build phases

### Phase 1 — Telegram bot (now)
- Scaffold the monorepo (pnpm workspaces, TypeScript).
- Provision Supabase project; get the Postgres connection string (direct +
  pooled).
- Define initial schema in `packages/db` with Drizzle (users, properties,
  leases, payments, tickets — scoped to the MVP wedge).
- Implement `packages/core` business logic.
- Build the grammY bot + Hono API in `apps/bot`.
- Deploy to Railway via `git push`; set Telegram webhook.
- Add cron (Railway) for scheduled reminders.

### Phase 2 — Web app
- Add `apps/app` (Expo + Expo Router), targeting web first.
- Reuse `packages/core` and `packages/db`.
- Add **Better Auth** for web/mobile login (Telegram login + email/OAuth),
  storing users in our own tables.
- Expose the needed API endpoints from the Hono backend.
- Deploy the Expo web export (Vercel or Hetzner).

### Phase 3 — Mobile (iOS + Android)
- Build the *same* Expo codebase with `eas build` → native iOS + Android apps.
- Minimal new work: it's the same components and the same backend.

## Error handling & operational notes

- **Backups:** rely on Supabase automatic backups; periodically test a restore.
  Keep an independent `pg_dump` job (Railway cron) as a belt-and-suspenders copy.
- **Secrets:** store the bot token, DB connection string, and auth secrets as
  Railway environment variables — never in the repo.
- **DB connections:** use Supabase's pooled connection string for the
  serverless-ish paths; direct connection for migrations.
- **Webhook security:** verify Telegram's secret token on the webhook endpoint.
- **Portability checkpoints:** because data is plain Postgres and the backend is
  a container, we can move DB → Hetzner and backend → Fly.io/Hetzner at any time
  with no code rewrite.

## What we are explicitly NOT doing yet (YAGNI)

- No microservices — one backend process.
- No Kubernetes / custom infra — Railway handles it.
- No custom auth system in Phase 1 — Telegram identity is enough.
- No GraphQL — plain typed HTTP/JSON endpoints via Hono.
- No multi-region, no read replicas — single region (EU, close to Montenegro).

## Next step

Turn this design into a concrete, step-by-step implementation plan for **Phase 1
(the Telegram bot)** using the writing-plans workflow.
