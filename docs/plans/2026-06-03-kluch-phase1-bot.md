# Kluch Phase 1 — Telegram Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the Kluch Phase 1 MVP — a Telegram-bot-first product for foreign renters in Montenegro, covering onboarding, maintenance tickets (with translation), an "Ask Kluch" concierge relay, manual-confirm rent, and an operator admin channel — on a shared backend/database that the future web and mobile apps will reuse unchanged.

**Architecture:** A pnpm-workspace TypeScript monorepo. Pure business logic lives in `packages/core` and is unit-tested in isolation; the database schema and client live in `packages/db` (Drizzle ORM + Postgres); the Telegram bot in `apps/bot` is a thin grammY layer that calls `packages/core`. The bot runs as one always-on long-polling process on Railway; Postgres is hosted on Supabase (used as plain Postgres — no Supabase Auth). Translation is abstracted behind a `Translator` interface (real DeepL impl + a fake for tests).

**Tech Stack:** TypeScript (ESM, NodeNext) · pnpm workspaces · Drizzle ORM + drizzle-kit + postgres.js · grammY (+ `@grammyjs/conversations`) · Hono (health/API) · Vitest · DeepL API · Supabase Postgres · Railway.

---

## How to use this plan

- Work **top to bottom**. Each task is bite-sized (2–5 min) and ends in a commit.
- **TDD discipline:** for `packages/core` and `packages/db`, write the failing test first, watch it fail, implement the minimum, watch it pass, commit. Bot handlers in `apps/bot` are kept thin (they only parse input and call tested core functions), so they are verified by manual run + the core tests behind them.
- Milestones 0–6 are written with full code (they establish every pattern). Milestones 7–11 reuse those exact patterns and are specified as concrete task lists with key snippets and test names — follow the established structure.
- Apply DRY / YAGNI ruthlessly. If a task feels unnecessary for the MVP, stop and flag it.

## Prerequisites (do these once, before Milestone 0)

These are account/tooling steps the human must do — they require interactive login or external dashboards. Suggest the user run shell commands with the `!` prefix in the session.

- [ ] **Node 20 LTS** installed and active (repo is on 18.16). Recommend `nvm install 20 && nvm use 20`.
- [ ] **pnpm** installed: `npm install -g pnpm` (or `corepack enable`).
- [ ] **Docker Desktop** running (for the local test Postgres).
- [ ] **Telegram bot token** — talk to `@BotFather` → `/newbot` → save the token.
- [ ] **Operator chat** — create a private Telegram group, add the bot, and get its numeric chat id (e.g. message the group and read it from `getUpdates`, or use `@RawDataBot`). This is `OPERATOR_CHAT_ID`.
- [ ] **Supabase project** — create at supabase.com; copy the **pooled** connection string (Settings → Database → Connection string → "Transaction" pooler) and the **direct** one (for migrations).
- [ ] **DeepL API key** — free tier at deepl.com/pro-api.
- [ ] **Railway account** — railway.app (connect GitHub).
- [ ] **Vercel caveat:** the live landing page (`index.html`) is served by Vercel from repo root. Adding a root `package.json` can make Vercel try to build the repo. In the Vercel project settings, set **Framework Preset = Other**, leave **Build Command empty**, and **Output Directory = `.`** so the static site keeps serving. Verify the landing page still loads after Milestone 0 is pushed.

---

## Milestone 0 — Monorepo foundation

### Task 0.1: Root workspace config

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`

**Step 1:** Create `.nvmrc`:

```
20
```

**Step 2:** Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

**Step 3:** Create root `package.json` (private, holds shared dev scripts):

```json
{
  "name": "kluch",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "db:up": "docker compose -f docker-compose.test.yml up -d",
    "db:down": "docker compose -f docker-compose.test.yml down"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "tsx": "^4.16.0"
  }
}
```

**Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml .nvmrc
git commit -m "chore: scaffold pnpm workspace root"
```

### Task 0.2: Shared TypeScript config

**Files:**
- Create: `tsconfig.base.json`

**Step 1:** Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add shared tsconfig base"
```

### Task 0.3: Env template and gitignore

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1:** Create `.env.example`:

```bash
# Postgres (Supabase). Use the POOLED string at runtime, DIRECT for migrations.
DATABASE_URL="postgresql://...pooler...:6543/postgres"
DIRECT_DATABASE_URL="postgresql://...direct...:5432/postgres"
# Local test DB (matches docker-compose.test.yml)
TEST_DATABASE_URL="postgresql://kluch:kluch@localhost:5433/kluch_test"
# Telegram
BOT_TOKEN="123456:ABC..."
OPERATOR_CHAT_ID="-1001234567890"
# DeepL
DEEPL_API_KEY="..."
DEEPL_API_URL="https://api-free.deepl.com/v2/translate"
```

**Step 2:** Ensure `.gitignore` contains (append any missing lines):

```
node_modules/
dist/
.env
.env.local
*.log
```

**Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add env template and ignore rules"
```

### Task 0.4: Local test Postgres

**Files:**
- Create: `docker-compose.test.yml`

**Step 1:** Create `docker-compose.test.yml`:

```yaml
services:
  postgres-test:
    image: postgres:16
    environment:
      POSTGRES_USER: kluch
      POSTGRES_PASSWORD: kluch
      POSTGRES_DB: kluch_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
```

**Step 2:** Bring it up and verify:

Run: `pnpm db:up && docker ps --filter name=postgres-test`
Expected: a running `postgres:16` container mapping `5433->5432`.

**Step 3: Commit**

```bash
git add docker-compose.test.yml
git commit -m "chore: add local test postgres via docker compose"
```

---

## Milestone 1 — `packages/db` (schema, client, migrations)

### Task 1.1: Package skeleton

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`

**Step 1:** `packages/db/package.json`:

```json
{
  "name": "@kluch/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "migrate": "tsx src/migrate.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0"
  }
}
```

**Step 2:** `packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src"]
}
```

**Step 3:** `packages/db/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL! },
});
```

**Step 4:** Install deps from repo root.

Run: `pnpm install`
Expected: workspace links, no errors.

**Step 5: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): scaffold @kluch/db package"
```

### Task 1.2: Define the schema

**Files:**
- Create: `packages/db/src/schema.ts`

**Step 1:** Write `packages/db/src/schema.ts`. Money is stored as integer **minor units** (cents) to avoid float errors; locale is an enum of the three supported languages.

```ts
import {
  pgTable, bigserial, bigint, integer, text, timestamp, pgEnum, uuid, date,
} from "drizzle-orm/pg-core";

export const localeEnum = pgEnum("locale", ["en", "ru", "me"]);
export const roleEnum = pgEnum("role", ["occupant", "operator"]);
export const leaseStatusEnum = pgEnum("lease_status", ["active", "ended"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "confirmed"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "received", "scheduled", "done", "cancelled",
]);
export const directionEnum = pgEnum("direction", ["in", "out"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
  telegramUsername: text("telegram_username"),
  fullName: text("full_name"),
  locale: localeEnum("locale").notNull().default("en"),
  role: roleEnum("role").notNull().default("occupant"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  landlordName: text("landlord_name"),
  landlordContact: text("landlord_contact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leases = pgTable("leases", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  occupantUserId: uuid("occupant_user_id").references(() => users.id),
  joinCode: text("join_code").notNull().unique(),
  rentMinor: integer("rent_minor").notNull(),
  currency: text("currency").notNull().default("EUR"),
  dueDay: integer("due_day").notNull(), // 1..28
  status: leaseStatusEnum("status").notNull().default("active"),
  startDate: date("start_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => leases.id),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("EUR"),
  period: text("period").notNull(), // "YYYY-MM"
  status: paymentStatusEnum("status").notNull().default("pending"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const tickets = pgTable("tickets", {
  id: bigserial("id", { mode: "number" }).primaryKey(), // human-friendly #142
  leaseId: uuid("lease_id").notNull().references(() => leases.id),
  occupantUserId: uuid("occupant_user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  translatedDescription: text("translated_description"),
  photoFileId: text("photo_file_id"),
  status: ticketStatusEnum("status").notNull().default("received"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  direction: directionEnum("direction").notNull(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text"),
  locale: localeEnum("locale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Step 2:** Typecheck.

Run: `pnpm --filter @kluch/db typecheck`
Expected: PASS (no type errors).

**Step 3: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): define MVP schema (users, properties, leases, payments, tickets, messages)"
```

### Task 1.3: Client, index exports, and migrate script

**Files:**
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/migrate.ts`

**Step 1:** `packages/db/src/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = postgres(connectionString);
  return { db: drizzle(client, { schema }), client };
}

export type Database = ReturnType<typeof createDb>["db"];
```

**Step 2:** `packages/db/src/index.ts`:

```ts
export * from "./schema.js";
export * from "./client.js";
```

**Step 3:** `packages/db/src/migrate.ts` (applies generated migrations; used in CI/deploy):

```ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const { db, client } = createDb(url);
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await client.end();
console.log("migrations applied");
```

**Step 4:** Generate the first migration from the schema.

Run: `pnpm --filter @kluch/db generate`
Expected: a SQL file appears under `packages/db/migrations/`.

**Step 5:** Apply it to the local test DB to confirm it's valid.

Run: `DIRECT_DATABASE_URL=postgresql://kluch:kluch@localhost:5433/kluch_test pnpm --filter @kluch/db migrate`
Expected: `migrations applied`.

**Step 6: Commit**

```bash
git add packages/db/src packages/db/migrations
git commit -m "feat(db): add client, exports, migrate script, and initial migration"
```

### Task 1.4: Test harness (DB reset helper) + first DB-backed test

**Files:**
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/src/test-helpers.ts`
- Create: `packages/db/src/__tests__/schema.test.ts`

**Step 1:** `packages/db/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], hookTimeout: 30000 },
});
```

**Step 2:** `packages/db/src/test-helpers.ts` — connects to the test DB, applies migrations once, and truncates between tests:

```ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { createDb } from "./client.js";

const url = process.env.TEST_DATABASE_URL ?? "postgresql://kluch:kluch@localhost:5433/kluch_test";
export const { db, client } = createDb(url);

export async function migrateTestDb() {
  await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
}

export async function resetDb() {
  await db.execute(sql`
    TRUNCATE messages, tickets, payments, leases, properties, users RESTART IDENTITY CASCADE;
  `);
}
```

**Step 3: Write the failing test** — `packages/db/src/__tests__/schema.test.ts`:

```ts
import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db, client, migrateTestDb, resetDb } from "../test-helpers.js";
import { users } from "../schema.js";

beforeAll(async () => { await migrateTestDb(); });
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await client.end(); });

test("can insert and read a user with a default locale", async () => {
  await db.insert(users).values({ telegramUserId: 111, fullName: "Ana" });
  const [row] = await db.select().from(users).where(eq(users.telegramUserId, 111));
  expect(row.fullName).toBe("Ana");
  expect(row.locale).toBe("en");
  expect(row.role).toBe("occupant");
});
```

**Step 4: Run to verify it passes** (schema already exists, so this confirms the harness works).

Run: `pnpm db:up && pnpm --filter @kluch/db test`
Expected: 1 passed.

**Step 5: Commit**

```bash
git add packages/db/vitest.config.ts packages/db/src/test-helpers.ts packages/db/src/__tests__
git commit -m "test(db): add test harness and schema round-trip test"
```

---

## Milestone 2 — `packages/core` foundations (i18n + translation)

### Task 2.1: Package skeleton

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`

**Step 1:** `packages/core/package.json`:

```json
{
  "name": "@kluch/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "@kluch/db": "workspace:*", "drizzle-orm": "^0.33.0" }
}
```

**Step 2:** `packages/core/tsconfig.json` (same shape as db's). `packages/core/vitest.config.ts` (same as db's).

**Step 3:** Install + commit.

```bash
pnpm install
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): scaffold @kluch/core package"
```

### Task 2.2: i18n dictionary (TDD)

**Files:**
- Create: `packages/core/src/i18n.ts`
- Test: `packages/core/src/__tests__/i18n.test.ts`

**Step 1: Write the failing test** — `packages/core/src/__tests__/i18n.test.ts`:

```ts
import { expect, test } from "vitest";
import { t, type Locale } from "../i18n.js";

test("returns the string for the given locale", () => {
  expect(t("en", "welcome")).toContain("Kluch");
  expect(t("ru", "welcome")).not.toEqual(t("en", "welcome"));
});

test("interpolates params", () => {
  expect(t("en", "ticketCreated", { id: 142 })).toContain("142");
});

test("falls back to English for a missing translation", () => {
  // 'me' intentionally lacks this key in the fixture below if so; should not throw
  expect(() => t("me" as Locale, "welcome")).not.toThrow();
});
```

**Step 2: Run to verify it fails**

Run: `pnpm --filter @kluch/core test`
Expected: FAIL — cannot find module `../i18n.js`.

**Step 3: Implement** — `packages/core/src/i18n.ts`:

```ts
export type Locale = "en" | "ru" | "me";

type Dict = Record<string, string>;

const en: Dict = {
  welcome: "Welcome to Kluch 🔑 — your keys to Montenegro.",
  chooseLanguage: "What language do you prefer?",
  linked: "You're linked to {property}. Welcome!",
  badCode: "I couldn't find that code. Please check it and try again.",
  menu: "What would you like to do?",
  askPrompt: "Type your question and I'll pass it to the Kluch team.",
  ticketAskDescription: "What's wrong? Describe it, and you can add a photo.",
  ticketCreated: "Ticket #{id} created. We're on it and will keep you posted here.",
  ticketStatus: "Update on ticket #{id}: {status}.",
  rentDue: "Your rent of {amount} for {period} is due on day {dueDay}.",
  rentPaidClaim: "Thanks — I've recorded your payment as pending. We'll confirm shortly.",
  rentConfirmed: "Your payment for {period} is confirmed ✅. Receipt attached to your history.",
};

const ru: Dict = {
  welcome: "Добро пожаловать в Kluch 🔑 — ваши ключи к Черногории.",
  chooseLanguage: "Какой язык вы предпочитаете?",
  linked: "Вы привязаны к {property}. Добро пожаловать!",
  badCode: "Не нашёл такой код. Проверьте и попробуйте снова.",
  menu: "Что бы вы хотели сделать?",
  askPrompt: "Напишите вопрос, и я передам его команде Kluch.",
  ticketAskDescription: "Что случилось? Опишите проблему, можно добавить фото.",
  ticketCreated: "Заявка #{id} создана. Мы займёмся ею и сообщим вам здесь.",
  ticketStatus: "Обновление по заявке #{id}: {status}.",
  rentDue: "Аренда {amount} за {period} должна быть оплачена до {dueDay} числа.",
  rentPaidClaim: "Спасибо — платёж записан как ожидающий. Скоро подтвердим.",
  rentConfirmed: "Ваш платёж за {period} подтверждён ✅.",
};

const me: Dict = {
  welcome: "Dobrodošli u Kluch 🔑 — vaši ključevi za Crnu Goru.",
  chooseLanguage: "Koji jezik preferirate?",
  linked: "Povezani ste sa {property}. Dobrodošli!",
  badCode: "Nisam pronašao taj kod. Provjerite i pokušajte ponovo.",
  menu: "Šta želite da uradite?",
  askPrompt: "Napišite pitanje i proslijediću ga Kluch timu.",
  ticketAskDescription: "Šta nije u redu? Opišite problem, možete dodati i fotografiju.",
  ticketCreated: "Prijava #{id} je kreirana. Rješavamo i javljamo vam ovdje.",
  ticketStatus: "Ažuriranje prijave #{id}: {status}.",
  rentDue: "Vaša kirija {amount} za {period} dospijeva {dueDay}. u mjesecu.",
  rentPaidClaim: "Hvala — uplata je zabilježena kao na čekanju. Uskoro potvrđujemo.",
  rentConfirmed: "Vaša uplata za {period} je potvrđena ✅.",
};

const dicts: Record<Locale, Dict> = { en, ru, me };

export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const template = dicts[locale]?.[key] ?? en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}
```

**Step 4: Run to verify it passes**

Run: `pnpm --filter @kluch/core test`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add packages/core/src/i18n.ts packages/core/src/__tests__/i18n.test.ts
git commit -m "feat(core): add i18n dictionary (en/ru/me) with interpolation"
```

### Task 2.3: Translator interface + fake (TDD)

**Files:**
- Create: `packages/core/src/translate.ts`
- Test: `packages/core/src/__tests__/translate.test.ts`

**Step 1: Write the failing test:**

```ts
import { expect, test } from "vitest";
import { FakeTranslator } from "../translate.js";

test("fake translator records calls and returns a tagged string", async () => {
  const tr = new FakeTranslator();
  const out = await tr.translate("Voda ne radi", { to: "EN" });
  expect(out).toBe("[EN] Voda ne radi");
  expect(tr.calls).toHaveLength(1);
  expect(tr.calls[0].to).toBe("EN");
});
```

**Step 2: Run to verify it fails.** Expected: cannot find module.

**Step 3: Implement** — `packages/core/src/translate.ts`:

```ts
export interface Translator {
  translate(text: string, opts: { to: string; from?: string }): Promise<string>;
}

/** Test double: deterministic, no network. */
export class FakeTranslator implements Translator {
  calls: { text: string; to: string; from?: string }[] = [];
  async translate(text: string, opts: { to: string; from?: string }) {
    this.calls.push({ text, ...opts });
    return `[${opts.to}] ${text}`;
  }
}

/** Real implementation backed by DeepL. */
export class DeepLTranslator implements Translator {
  constructor(
    private apiKey = process.env.DEEPL_API_KEY!,
    private apiUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate",
  ) {}
  async translate(text: string, opts: { to: string; from?: string }) {
    const body = new URLSearchParams({ text, target_lang: opts.to });
    if (opts.from) body.set("source_lang", opts.from);
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) throw new Error(`DeepL error ${res.status}`);
    const json = (await res.json()) as { translations: { text: string }[] };
    return json.translations[0].text;
  }
}
```

**Step 4: Run to verify it passes.** Expected: 1 passed.

**Step 5: Commit**

```bash
git add packages/core/src/translate.ts packages/core/src/__tests__/translate.test.ts
git commit -m "feat(core): add Translator interface, DeepL impl, and fake"
```

---

## Milestone 3 — `packages/core` domain logic (TDD)

> All functions here take `db` (and a `Translator` where needed) as arguments — no globals — so they're trivially testable against the local test DB. Each function gets its own failing-test-first cycle. Reuse the db test harness from `@kluch/db` by importing `migrateTestDb`/`resetDb`. Add `@kluch/db` test-helpers export if needed, or replicate the tiny helper in core's `__tests__/helpers.ts` pointing at `TEST_DATABASE_URL`.

### Task 3.1: `findOrCreateUser` (onboarding identity)

**Files:** Create `packages/core/src/users.ts`; Test `packages/core/src/__tests__/users.test.ts`.

- **Test first:** inserting an unseen `telegramUserId` creates a user with locale `en`; calling again with the same id returns the same row (no duplicate); passing a locale updates it.
- **Implement:**

```ts
import { eq } from "drizzle-orm";
import { users, type Database } from "@kluch/db";
import type { Locale } from "./i18n.js";

export async function findOrCreateUser(
  db: Database,
  input: { telegramUserId: number; username?: string; fullName?: string },
) {
  const [existing] = await db.select().from(users).where(eq(users.telegramUserId, input.telegramUserId));
  if (existing) return existing;
  const [created] = await db.insert(users).values({
    telegramUserId: input.telegramUserId,
    telegramUsername: input.username,
    fullName: input.fullName,
  }).returning();
  return created;
}

export async function setUserLocale(db: Database, userId: string, locale: Locale) {
  const [row] = await db.update(users).set({ locale }).where(eq(users.id, userId)).returning();
  return row;
}
```

- **Verify pass, commit:** `feat(core): add findOrCreateUser and setUserLocale`.

### Task 3.2: `createLease` + `linkOccupantByCode` (controlled onboarding)

**Files:** Create `packages/core/src/leases.ts`; Test `packages/core/src/__tests__/leases.test.ts`.

- **Test first:**
  - `createLease` (operator/seed use) creates a property + lease with a unique `joinCode`.
  - `linkOccupantByCode(db, userId, code)` sets `occupantUserId` and returns `{ lease, property }`.
  - A bad code returns `null` (caller shows `t(locale,"badCode")`).
  - A code already linked to another occupant is rejected.
- **Implement** `createLease`, `linkOccupantByCode`, and a `generateJoinCode()` helper (6-char base32, collision-retry). Keep money as `rentMinor`.
- **Verify pass, commit:** `feat(core): add lease creation and occupant linking by join code`.

### Task 3.3: `createTicket` (with translation) + `updateTicketStatus`

**Files:** Create `packages/core/src/tickets.ts`; Test `packages/core/src/__tests__/tickets.test.ts`.

- **Test first (uses `FakeTranslator`):**
  - `createTicket(db, translator, {leaseId, occupantUserId, description, locale, photoFileId?})` stores the ticket, sets `status="received"`, and stores `translatedDescription` = the Montenegrin translation (when source locale ≠ `me`, call translator with `to:"EN"`/operator language — see note). Assert the translator was called and `translatedDescription` is set.
  - Returns the numeric `id` (for `#142`).
  - `updateTicketStatus(db, id, status)` updates status + `updatedAt` and returns the row.
- **Note:** operator working language is English; translate occupant text → `EN` for the operator/landlord. Make the target configurable via param defaulting to `"EN"`.
- **Implement** accordingly.
- **Verify pass, commit:** `feat(core): add ticket creation with translation and status updates`.

### Task 3.4: `logMessage` + `relayToOperatorPayload` (Ask Kluch plumbing)

**Files:** Create `packages/core/src/messages.ts`; Test `packages/core/src/__tests__/messages.test.ts`.

- **Test first:** `logMessage(db, translator, {userId, direction, text, locale})` stores original + translated text (incoming → translate to `EN`; outgoing → translate to user locale) and returns the row. Assert both columns populated.
- **Implement.** Keep the actual Telegram send-out in the bot layer; core only persists + translates.
- **Verify pass, commit:** `feat(core): add message logging with translation`.

### Task 3.5: Rent — `ensurePeriodPayment`, `claimPayment`, `confirmPayment`, `leasesDueOn`

**Files:** Create `packages/core/src/rent.ts`; Test `packages/core/src/__tests__/rent.test.ts`.

- **Test first:**
  - `leasesDueOn(db, day)` returns active leases whose `dueDay === day`.
  - `claimPayment(db, leaseId, period)` creates (or returns existing) a `pending` payment for that lease+period; idempotent on (leaseId, period).
  - `confirmPayment(db, paymentId)` sets `status="confirmed"`, stamps `confirmedAt`.
  - `formatMoney(minor, currency)` → `"€450.00"` style.
- **Implement.** Period is `"YYYY-MM"`; pass it in from the caller (no `Date.now()` inside core — keep functions pure/parameterized).
- **Verify pass, commit:** `feat(core): add rent claim/confirm and due-lease query`.

### Task 3.6: Barrel export

**Files:** Create `packages/core/src/index.ts` re-exporting i18n, translate, users, leases, tickets, messages, rent.

- **Verify:** `pnpm --filter @kluch/core typecheck` PASS. **Commit:** `feat(core): add barrel export`.

---

## Milestone 4 — `apps/bot` foundation

### Task 4.1: Package skeleton

**Files:** Create `apps/bot/package.json`, `apps/bot/tsconfig.json`.

```json
{
  "name": "@kluch/bot",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@kluch/core": "workspace:*",
    "@kluch/db": "workspace:*",
    "grammy": "^1.30.0",
    "@grammyjs/conversations": "^1.2.0",
    "hono": "^4.5.0",
    "@hono/node-server": "^1.12.0"
  }
}
```

- Install + commit: `feat(bot): scaffold @kluch/bot package`.

### Task 4.2: Config loader (fail fast on missing env)

**Files:** Create `apps/bot/src/config.ts`; Test `apps/bot/src/__tests__/config.test.ts`.

- **Test first:** `loadConfig({BOT_TOKEN, DATABASE_URL, OPERATOR_CHAT_ID, DEEPL_API_KEY})` returns a typed object; missing a required key throws a clear error naming the key.
- **Implement** a pure `loadConfig(env)` that reads from a passed object (so it's testable without `process.env`).
- Verify pass, commit: `feat(bot): add fail-fast config loader`.

### Task 4.3: Bot bootstrap (polling) + health server

**Files:** Create `apps/bot/src/context.ts`, `apps/bot/src/bot.ts`, `apps/bot/src/server.ts`, `apps/bot/src/index.ts`.

- `context.ts`: a `BotContext` type extending grammY's `Context` with `ConversationFlavor` and a `session` holding `{ userId?: string; locale: Locale }`.
- `bot.ts`: build the `Bot<BotContext>`, install `session` (in-memory) and `conversations()` plugins, and wire a shared services object `{ db, translator, operatorChatId }` created from config (use `DeepLTranslator`).
- `server.ts`: a minimal Hono app with `GET /health` → `200 "ok"`, served via `@hono/node-server` on `process.env.PORT ?? 8080` (Railway health check + reserves the future API surface).
- `index.ts`: load config, run migrations are NOT run here (done at deploy), start the Hono server, then `bot.start()` (long polling). Add graceful shutdown on SIGTERM.
- **Verify (manual):** with a real `BOT_TOKEN` in `.env`, run `pnpm --filter @kluch/bot dev`; `/start` should not crash (handlers added next). `curl localhost:8080/health` → `ok`.
- Commit: `feat(bot): add polling bot bootstrap and health server`.

---

## Milestone 5 — Onboarding flow

### Task 5.1: `/start` → language selection → main menu

**Files:** Create `apps/bot/src/handlers/start.ts`; register in `bot.ts`.

- On `/start [code]`:
  1. `findOrCreateUser` from `ctx.from`. Store `ctx.session.userId`/`locale`.
  2. If a join code arg is present, attempt `linkOccupantByCode`; on success reply `t(locale,"linked",{property})` then show the menu; on failure reply `t(locale,"badCode")`.
  3. If no code and not yet linked, show language inline keyboard `[English][Русский][Crnogorski]`.
- Language buttons (callback `lang:en|ru|me`): `setUserLocale`, update session, then prompt for the join code (a short conversation) or show menu if already linked.
- **Main menu** helper (`apps/bot/src/keyboards.ts`): inline keyboard `[💳 Rent][🛠 Report a problem]` / `[💬 Ask Kluch][📄 Documents]`, labels localized via `t`.
- **Verify (manual):** `/start` shows language buttons; picking one persists locale (re-`/start` skips the prompt). Linking with a seeded code shows the menu.
- Commit: `feat(bot): onboarding — /start, language selection, main menu`.

### Task 5.2: Seed script for the pilot

**Files:** Create `apps/bot/src/seed.ts` (or `packages/db/src/seed.ts`).

- A small `tsx` script that calls `createLease` for the pilot properties and prints each `joinCode`. This is how you (operator) onboard the first tenants. Document usage in the repo README.
- **Verify:** run against the test DB; prints codes.
- Commit: `feat(bot): add pilot seed script that prints join codes`.

---

## Milestone 6 — Maintenance tickets + translation + operator relay

### Task 6.1: "Report a problem" conversation

**Files:** Create `apps/bot/src/handlers/ticket.ts`; register conversation in `bot.ts`.

- Triggered by the menu button (callback `menu:ticket`). Use `@grammyjs/conversations`:
  1. Ask `t(locale,"ticketAskDescription")`.
  2. Wait for a text and/or photo message. Capture `description` (text or caption) and `photoFileId` (largest photo, if any).
  3. Resolve the user's active lease; call `createTicket(db, translator, {...})`.
  4. Reply `t(locale,"ticketCreated",{id})`.
  5. **Relay to operator:** `bot.api.sendMessage(operatorChatId, ...)` with the **translated** description, ticket id, tenant name/property, and an inline keyboard of status actions: `[Scheduled][Done][Cancel]` (callback `tkt:<id>:scheduled` etc.). If a photo exists, `sendPhoto`.
- **Verify (manual):** filing a ticket as a tenant posts a translated card to the operator group with buttons.
- Commit: `feat(bot): maintenance ticket conversation with operator relay`.

### Task 6.2: Operator status actions → notify tenant

**Files:** Create `apps/bot/src/handlers/ticketAdmin.ts`.

- Handle `tkt:<id>:<status>` callbacks **only** from `OPERATOR_CHAT_ID` (guard on `ctx.chat.id`).
  1. `updateTicketStatus(db, id, status)`.
  2. Look up the ticket's occupant; `bot.api.sendMessage(occupantTelegramId, t(occupantLocale,"ticketStatus",{id,status}))` — translate the status word via i18n keys.
  3. Edit the operator card to reflect the new status (acknowledge the callback).
- **Verify (manual):** tapping "Scheduled" in the operator group pings the tenant in their language and updates the card.
- Commit: `feat(bot): operator ticket status actions notify the tenant`.

---

## Milestone 7 — "Ask Kluch" concierge relay

> Reuses the operator-relay pattern from M6 and `logMessage` from Task 3.4.

### Task 7.1: Tenant → operator question relay
**Files:** `apps/bot/src/handlers/ask.ts`.
- Menu button `menu:ask` → reply `t(locale,"askPrompt")`, set a session flag `awaitingAsk=true`.
- On the next free-text message while `awaitingAsk`: `logMessage(direction:"in")`, then relay the **English-translated** text to the operator group with a reply hint: `Reply to this message to answer <tenantName>` and embed the tenant's user id (e.g. in the relayed text or via a stored mapping keyed by the operator message id).
- Commit: `feat(bot): Ask Kluch — relay tenant questions to operator (translated)`.

### Task 7.2: Operator reply → tenant (translated back)
**Files:** extend `apps/bot/src/handlers/ask.ts`.
- In `OPERATOR_CHAT_ID`, when an operator **replies** to a relayed question message: resolve the target tenant (from the stored mapping), `logMessage(direction:"out")`, translate operator text → tenant locale, and `sendMessage` to the tenant.
- Persist the operator-message-id → tenant-user-id mapping in a tiny in-memory map for MVP (note: lost on restart — acceptable; upgrade to a DB table in Phase 2).
- Commit: `feat(bot): Ask Kluch — operator replies delivered to tenant in their language`.

---

## Milestone 8 — Rent reminders + manual payment

### Task 8.1: "Rent" menu — show due + "I've paid"
**Files:** `apps/bot/src/handlers/rent.ts`.
- Menu button `menu:rent` → resolve active lease, show `t(locale,"rentDue",{amount,period,dueDay})` (current period = caller-computed `YYYY-MM`) with a button `[✅ I've paid]` (callback `rent:paid:<period>`).
- On `rent:paid` → `claimPayment(db, leaseId, period)`, reply `t(locale,"rentPaidClaim")`, relay to operator group a card with `[Confirm payment]` (callback `pay:confirm:<paymentId>`).
- Commit: `feat(bot): rent view and tenant payment claim`.

### Task 8.2: Operator confirm → receipt to tenant
**Files:** extend `apps/bot/src/handlers/rent.ts`.
- `pay:confirm:<id>` from operator group → `confirmPayment`, notify tenant `t(locale,"rentConfirmed",{period})`, update operator card.
- Commit: `feat(bot): operator payment confirmation and tenant receipt`.

### Task 8.3: Scheduled rent reminders (Railway cron)
**Files:** `apps/bot/src/cron/rentReminders.ts`; add an npm script `"cron:rent": "tsx src/cron/rentReminders.ts"`.
- A standalone script: compute today's day-of-month and current period, `leasesDueOn(db, day+N)` for a lead time (e.g. 3 days before), and `sendMessage` each occupant a reminder. Idempotency: optionally `claimPayment`-less; just a reminder. Exits when done (Railway Cron runs it on a schedule).
- **Verify (manual/local):** seed a lease with `dueDay = today+3`, run the script, confirm the reminder sends.
- Commit: `feat(bot): scheduled rent reminder cron job`.

---

## Milestone 9 — Documents

### Task 9.1: Documents menu (operator-uploaded files)
**Files:** `apps/bot/src/handlers/documents.ts`; add a `documents` table migration (lease_id, label, file_id, created_at) — TDD the `addDocument`/`listDocuments` core funcs in `packages/core/src/documents.ts` first (M3 pattern).
- Menu button `menu:docs` → `listDocuments(leaseId)` → send each as a button; tapping sends the stored Telegram `file_id`.
- Operator command `/adddoc` (in operator group, replying to a file) stores it against a lease.
- Commit(s): `feat(core): documents storage`, `feat(bot): documents menu and operator upload`.

---

## Milestone 10 — Operator admin polish

### Task 10.1: Broadcast
**Files:** `apps/bot/src/handlers/broadcast.ts`.
- Operator command `/broadcast <message>` (operator group only) → send to all active occupants, each translated to their locale. Log via `logMessage`.
- Commit: `feat(bot): operator broadcast to all occupants (localized)`.

### Task 10.2: Operator help + open-items summary
**Files:** extend admin handlers.
- `/open` in operator group → list open tickets and pending payments (counts + ids).
- Commit: `feat(bot): operator open-items summary`.

---

## Milestone 11 — Deploy to Railway

### Task 11.1: Production migration + start
**Files:** root `package.json` scripts; `apps/bot/package.json` `start`.
- Add a `release`/predeploy step that runs `pnpm --filter @kluch/db migrate` against `DIRECT_DATABASE_URL`, then `pnpm --filter @kluch/bot start`.

### Task 11.2: Railway project
- Create a Railway project from the GitHub repo. Set the **root directory** to repo root (monorepo) and start command to run migrations then the bot. Add all env vars from `.env.example` (use Supabase pooled `DATABASE_URL`, direct `DIRECT_DATABASE_URL`, `BOT_TOKEN`, `OPERATOR_CHAT_ID`, `DEEPL_API_KEY`, `DEEPL_API_URL`). Set region to EU.
- Add a **Railway Cron** for `pnpm --filter @kluch/bot cron:rent` (e.g. daily 09:00 CET).
- **Verify:** deploy logs show "migrations applied" then the bot polling; `/start` works against production; the health endpoint responds.
- Commit: `chore: railway deploy config and docs`.

### Task 11.3: README + ops notes
**Files:** `README.md`.
- Document: local dev (`pnpm db:up`, `.env`, `pnpm --filter @kluch/bot dev`), running tests, seeding pilot codes, the operator group workflow (how to confirm payments, change ticket status, reply to Ask-Kluch, broadcast), and the manual processes that are intentionally not automated yet.
- Commit: `docs: add README with dev, test, and operator runbook`.

---

## Definition of done (Phase 1)

- A foreign tenant can `/start`, pick a language, link to their lease with a code, file a translated maintenance ticket with a photo, ask a free-text question and get a translated answer, see rent due and claim a payment, and retrieve documents — all in Telegram.
- The operator group receives translated tickets, questions, and payment claims with one-tap actions, and can broadcast and see open items.
- Rent reminders fire on schedule.
- `pnpm -r test` is green; the bot runs on Railway against Supabase Postgres.
- Zero proprietary lock-in: data is plain Postgres; identity is in our `users` table; the backend is a portable container.

## Explicitly deferred to Phase 2+ (do NOT build now)

Payment gateway (Stripe/bank) · self-serve landlord bot · automated repair dispatch · DB-backed conversation/session state · web app (Expo) · mobile apps · extra service lines.
