# Listing Reference Codes + Search/Filter Hardening — Design

*Approved 2026-06-10.* Two features:
1. Every listing gets a short, memorable **reference code** (`ST-0042`) shown on the
   white-label cards + modal, with a backfill for existing listings.
2. The agency-site **search/filters are verified with tests** and gain a **look-up-by-code** path.

## Reference code

**Format `XX-NNNN`** — a fixed 2-letter agency prefix + a per-agency zero-padded sequential
number (min 4 digits, grows to 5–6 as an agency nears its ~100K ceiling). Examples:
`ST-0001`, `ST-1180` (Stam). Per-agency unique (the code lives on that agency's own site).

Chosen over random `AA-1234` because sequential is the easiest to dictate ("S-T, forty-two"),
stickiest to remember, and unique by construction — no collision-retry. Count-leak is a
non-issue for a real-estate agency.

### Schema (additive)
- `agencies.refPrefix text` — 2–4 uppercase letters, set at agency creation (derived from name).
- `agencies.refSeq integer not null default 0` — last allocated number (atomic counter).
- `properties.refCode text` (nullable) — the formatted code.
- Partial unique index `(agencyId, refCode)` where `refCode is not null`.

### Allocation
- `derivePrefix(name)` — uppercased, strips non-A–Z, takes the first 2 letters of the name
  (or initials of the first two words if cleaner); falls back to first 2 of the slug, then `AG`.
  Excludes nothing extra — pure-digit body keeps it unambiguous. Stored once on the agency row.
- `allocateRefCode(tx, agencyId)` — atomically `UPDATE agencies SET ref_seq = ref_seq + 1
  RETURNING ref_seq, ref_prefix`, then format `${prefix}-${String(seq).padStart(4,"0")}`.
  Concurrency-safe (the UPDATE … RETURNING is atomic).
- `createProperty` runs in a transaction: allocate the code, then insert with `refCode`.
  The bulk importer goes through `createProperty`, so imports get codes automatically.

### Backfill (existing data)
A one-shot, idempotent script: per agency, set `refPrefix` if empty; order that agency's
codeless listings by `createdAt asc, id` and assign `prefix-0001, -0002, …`; set the agency's
`refSeq` to the highest number assigned. Re-runnable (skips listings that already have a code,
never re-uses a number). Run against prod after the migration deploys.

## Search / filters

Current stack is sound: `parseSearchFilters` (€→cents) → `searchConditions` → `searchProperties`
/`countProperties`, pagination via `page`. This round:
- **Add a `code` filter**: `SearchFilters.refCode`; `searchConditions` adds an exact (uppercased)
  match `eq(properties.refCode, code)` when present. `parseSearchFilters` reads `code` and
  normalizes (trim + uppercase); a value matching `^[A-Z]{2,6}-\d+$` is treated as a code.
- **Search form**: add a small "Ref. code" input (i18n en/sr/ru/tr) alongside the existing
  fields; submitting it filters to that one listing. Existing fields unchanged.
- **Harden with tests** (the "make sure they work" ask): cover `parseSearchFilters` (city,
  price €→cents, bedrooms, type, dealType, page, code) and `searchConditions`/`searchProperties`
  /`countProperties` (city ilike, price range, bedrooms gte, type, dealType, published-only,
  pagination, code exact-match) — at both core and web layers.

## Display
- Each `.card` shows the code as a small badge (e.g. top-left chip). The modal shows it near
  the title. Added to the `kluche-listings` JSON blob so the modal can render it.

## Tests
- core: `derivePrefix` cases; `allocateRefCode` increments + formats + is per-agency;
  `createProperty` assigns a code; `searchConditions`/search/count for every filter incl. code;
  backfill assigns sequentially + is idempotent.
- web: `parseSearchFilters` incl. code; `/a/:slug?code=ST-0042` returns the one listing;
  render output has the code badge on cards + in the modal JSON + the ref-code search field.
- console: unaffected (code is read-only there for now) — typecheck stays green.

## Out of scope
- Editing/regenerating a code from the console; global (cross-agency) code lookup; showing the
  code on rented/sold listings in the public grid (still published-only).

## Security / constraints
- `refCode` is never client-settable (not in `updateProperty`'s whitelist); allocated server-side.
- Backfill never persists secrets; runs with the prod connection string passed inline (never written to disk).
- Per-agency uniqueness enforced by the partial unique index.
