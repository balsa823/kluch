# Expo Universal Console — Design + Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development to implement task-by-task.

**Goal:** Rebuild the agency console as an **Expo (React Native + React Native Web)** app — one codebase that runs on the web today and compiles to iOS/Android later — talking to the existing Hono backend over a JSON + token-auth API, styled in the Kluch design language.

**Architecture:** Keep the **public** white-label agency sites + marketing server-rendered (Hono/static, good for SEO). Build the **logged-in app** (`apps/app`) in Expo Router with RN primitives (`View`/`Text`/`Pressable`) so it's portable to native. The backend gains a **token-based JSON API** (Bearer) for the app — cookies are fine for server-rendered pages but tokens work for both web SPA and native. Shared logic/types live in packages; UI lives in the Expo app.

**Tech Stack:** Expo (SDK 51+) · Expo Router · React Native + react-native-web · TypeScript · Hono (existing backend) · signed-token auth (HMAC/JWT-ish via node:crypto) · pnpm monorepo · Docker.

---

## Decisions

- **Token auth, not cookies, for the app.** `POST /api/auth/login` → `{ token }` (signed, contains agencyUserId + expiry). App stores it (web: localStorage; native: expo-secure-store) and sends `Authorization: Bearer <token>`. Backend middleware authenticates it. (The existing cookie-session server-rendered console can stay or be retired later.)
- **Design tokens shared.** A `theme.ts` (colors/spacing/radii/fonts from the design language) drives RN `StyleSheet`s — the RN equivalent of the CSS vars used in the mockups.
- **Marketing stays static** (`brand/` + `index.html`). Not ported to Expo.
- **Scope for v1:** auth (login) → dashboard (agency's listings) → add/publish listing. Tenants/leads/promotion screens come after, reusing the same components.
- **Monorepo + Expo:** Expo in a pnpm workspace needs `node_modules` hoisting care; use Expo's monorepo guidance (`metro.config.js` watchFolders + `resolver.nodeModulesPaths`). The app talks to the backend only via HTTP, so it does NOT import `packages/core` (server-only). Shared *types* may be duplicated or a tiny `packages/shared-types` added.

---

## Milestone 1 — Backend: token auth + JSON console API (TDD, in `apps/web`)

### Task 1.1 — signed token helpers (core)
`packages/core/src/token.ts`: `signToken(payload, secret, ttlSec)` → base64url `header.body.sig` (HMAC-SHA256 via `node:crypto`); `verifyToken(token, secret)` → payload or null (checks sig + expiry). TDD: round-trips; tampered sig → null; expired → null.

### Task 1.2 — auth endpoints
In `apps/web/src/app.ts`:
- `POST /api/auth/login` (JSON `{email,password}`) → `verifyAgencyUser` → `{ token, user: {id,email,role,agencyId} }` (401 on bad creds).
- `bearerUser(c)` helper: read `Authorization: Bearer`, `verifyToken`, `getAgencyUserById`.
- `GET /api/me` → current user + their agency (401 if no/invalid token).
Tests via `app.request` with the Authorization header.

### Task 1.3 — JSON listing API (Bearer-scoped to the caller's agency)
- `GET /api/listings` → `listAgencyProperties(db, user.agencyId)` (the caller's agency only).
- `POST /api/listings` → create (+ publish) for `user.agencyId`. Ignore any agencyId in body (scope from token).
- `PATCH /api/listings/:id/publish`, `/unpublish` (optional).
Tests: a token for agency A only sees/creates A's listings; no token → 401. Add CORS (allow the Expo web dev origin) via `hono/cors`.

---

## Milestone 2 — Expo app scaffold (`apps/app`)

### Task 2.1 — create the Expo app in the workspace
`apps/app` with Expo + Expo Router + TypeScript + react-native-web. Add to pnpm workspace. `metro.config.js` configured for the monorepo (watchFolders = repo root, nodeModulesPaths). Confirm `npx expo start --web` serves a blank screen.

### Task 2.2 — design-language theme
`apps/app/theme.ts`: colors (`navy #1F3A5C`, `teal #4E827A`, `cream #F1ECE0`, `amber #C9883C`, ink/muted/sand), spacing scale, radii, font families (load Plus Jakarta Sans + Inter via `expo-font`/`@expo-google-fonts`). Basic primitives: `Screen`, `Card`, `Button`, `TextField`, `Pill` as RN components using the theme. (Mirror the mockups visually.)

---

## Milestone 3 — API client + auth

### Task 3.1 — API client
`apps/app/lib/api.ts`: `EXPO_PUBLIC_API_URL` base; `login(email,pw)`, `me()`, `listListings()`, `createListing(input)`; attaches Bearer token; throws typed errors.

### Task 3.2 — auth state + token storage
`apps/app/lib/auth.tsx`: a context/store holding the token + user; persist token (web: localStorage; native: `expo-secure-store` — abstract behind one module). `login()` stores token, `logout()` clears.

### Task 3.3 — login screen
`app/login.tsx`: themed login (email/password, "Continue with Telegram" placeholder) matching the mockup; on success route to `/dashboard`. Expo Router guards: unauthenticated → `/login`.

---

## Milestone 4 — Dashboard screens

### Task 4.1 — dashboard / listings
`app/(app)/dashboard.tsx`: navy sidebar/topbar (web) → agency name, KPIs (count), a list of the agency's listings (Card per listing: title, city, price, status pill), styled in the design language. Pulls `GET /api/listings`.

### Task 4.2 — add listing
An "Add listing" form (modal or screen): name, address, city, price, bedrooms, type → `POST /api/listings` → refresh list. Optimistic or refetch.

(Later milestones: tenants inbox, leads pipeline, promotion — reuse components.)

---

## Milestone 5 — Run it (local + docker)

- **Dev:** `apps/app` runs via `npx expo start --web` (port 8082), pointing `EXPO_PUBLIC_API_URL` at `http://localhost:8080`.
- **Docker:** add an `app` service. For production-ish local, build the **web export** (`npx expo export --platform web`) and serve the static output via nginx (a new `app` service on :8082), OR run the Expo dev server in a container. Backend stays :8080 (now API + public sites). Update `docker-compose.yml`.
- Backend CORS allows the app origin.

---

## Definition of done (v1)

- `npx expo start --web` (or the docker `app` service) serves the console; logging in with `admin@popovic.me / kluch1234` lands on a themed dashboard listing Popović Nekretnine's properties; "Add listing" creates one via the API and it appears.
- All built with RN primitives (`View`/`Text`) so the same screens compile to native later.
- Backend `pnpm -r test` stays green; new token/API tests included.

## Deferred

Native builds (`eas build`); tenant app screens; leads/promotion; retiring the old server-rendered console; real Telegram login; refresh tokens.
