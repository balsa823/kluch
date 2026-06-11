# Cache-Control + on-demand thumbnails — Plan

**Goal:** cache images/static aggressively and serve resized card thumbnails on demand (cached to
Blob), to cut white-label page load. HTML stays `no-cache` so edits show instantly.

## 1. Cache-Control
- `packages/core/src/storage.ts` `AzureBlobStorage.upload`: add
  `blobCacheControl: "public, max-age=31536000, immutable"` to `blobHTTPHeaders` (also applies to
  generated thumbs). FakeStorage records `cacheControl` for tests.
- `apps/web/src/app.ts`: HTML route(s) (`/a/:slug` + host-routed) → `c.header("Cache-Control",
  "no-cache")`. Static routes `/uploads/*`, `/brand/*`, apex static files → `Cache-Control:
  public, max-age=86400`.
- One-off backfill `apps/web/src/backfill-cachecontrol-oneoff.ts`: list all blobs in the photos
  container and `setHTTPHeaders` the immutable cache-control (so the ~existing photos cache too).
  Run once against prod.

## 2. Storage interface for resizing
- Extend `Storage` with `download(path): Promise<Uint8Array | null>` and `exists(path):
  Promise<boolean>`. Implement in AzureBlobStorage (downloadToBuffer / blob.exists), LocalDiskStorage
  (readFile / stat), FakeStorage (from recorded uploads). Add `AzureBlobStorage.publicUrlFor(path)`
  (uses publicUrl with its account/container) so the endpoint can 302.

## 3. Thumbnail endpoint (sharp)
- Add `sharp` to `apps/web/package.json` deps (prebuilt linux binary installs in node:22-slim).
- `GET /t/*` in app.ts:
  - `w` query ∈ whitelist {240,480,960,1600} (default 480). `path = c.req.path.slice("/t/".length)`;
    reject `..`; require it start with `properties/` or `agencies/`.
  - `thumbPath = "thumbs/w" + w + "/" + path`.
  - if `await storage.exists(thumbPath)` → 302 to `storage.publicUrlFor(thumbPath)`,
    `Cache-Control: public, max-age=31536000, immutable`.
  - else download original (`storage.download(path)`; 404 if null), `sharp(buf).rotate().resize({
    width:w, withoutEnlargement:true }).jpeg({ quality:72, mozjpeg:true }).toBuffer()`,
    `storage.upload(thumbPath, out, "image/jpeg")`, then 302 to its public URL (same cache header).
  - Guard: only when storage supports download/exists (Azure/Local); on FakeStorage tests it works.
  - Wrap sharp in try/catch → on failure, 302 to the original public URL (graceful).

## 4. render.ts — cards use thumbs
- Helper `thumbSrc(fullUrl, w)`: if `fullUrl` matches `https://<acct>.blob.core.windows.net/<container>/<path>`,
  return `/t/<path>?w=<w>`; else return `fullUrl` (dev/local/non-blob).
- Card `<img class="card-photo" src="${thumbSrc(photo,480)}" loading="lazy" decoding="async"
  onerror="this.onerror=null;this.src='${esc(photo)}'" …>` (fallback to original on error).
- Modal gallery + the `kluche-listings` JSON keep FULL-size photos (quality). Hero can use
  `thumbSrc(...,1600)` (optional; keep full if simpler).

## 5. Tests
- storage: upload passes cacheControl (FakeStorage records it); download/exists round-trip on Fake.
- app: `/t/properties/<uuid>/photo-0.jpg?w=480` with a Fake holding the original → generates a thumb
  (Fake records the `thumbs/w480/...` upload) and 302s; missing original → 404; bad `w`/path → 400/404.
  HTML response has `Cache-Control: no-cache`; `/brand/*` has `public, max-age`.
- render: card src points at `/t/...?w=480` with onerror fallback; modal/json still full URLs.

## 6. Deploy
- Build image (verify sharp installs in the Docker build — watch the build log). `terraform apply`
  rolls it (min_replicas=1 already). Run the cache-control backfill once against prod. Verify:
  `/t/...?w=480` returns a 302 → cached thumb (2nd hit fast); a card on kluche.me/a/stam uses /t;
  image blobs now send `Cache-Control: …immutable`. Watch CPU/memory on first page (24 resizes).

## Notes
- sharp memory on 0.5vCPU/1Gi: resizing one photo is ~tens of MB transient; low concurrency fine.
  Each image is resized at most once ever (then cached in Blob), so steady-state is just 302s.
- Don't break dev: LocalDiskStorage download/exists make /t work locally too.
