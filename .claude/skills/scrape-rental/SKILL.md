---
name: scrape-rental
description: Scrape a rental/real-estate listing's photos and details into the project. Use when the user gives a listing URL (e.g. bestate4.me) and wants the apartment photos and metadata pulled down — for the Kluch marketplace, mockups, or a listings import. Handles JavaScript-rendered listing pages via a headless browser.
---

# Scrape Rental Listing

Pulls the **photos** and best-effort **details** (title, price, area) from a real-estate
listing page into a local folder. Built for `bestate4.me` (a client-rendered Next.js app
backed by Firebase Storage) and works on similar JS-rendered listing sites.

## How it works

The listing data is **not** in the server HTML — it's fetched by JavaScript after load. So
the scraper drives a **headless browser** (your installed Google Chrome, via `playwright-core`),
lets the page render, then collects gallery images (`<img>`, `srcset`, CSS backgrounds),
resolves Next.js `/_next/image?url=` wrappers to the full-res original, drops map tiles and
icons, and downloads the real photos. It also grabs the title, price, and area.

## Prerequisites

- **Node 22** (the repo uses it via nvm — run `nvm use 22` first if needed)
- **Google Chrome** installed (the script launches it with `channel: "chrome"` — no Chromium download)
- One-time install of the dependency:

```bash
cd .claude/skills/scrape-rental
npm install            # installs playwright-core only
```

## Usage

```bash
cd .claude/skills/scrape-rental
node scrape.mjs <listing-url> [outDir]
```

- `<listing-url>` — e.g. `https://www.bestate4.me/listing/kfBMbvrdUImyDi5L1cMG`
- `[outDir]` — defaults to `./scraped`

### Output

`<outDir>/<listing-id>/`:
- `photo-01.jpg`, `photo-02.jpg`, … — the apartment photos (full resolution)
- `listing.json` — `{ url, id, title, price, area, bedrooms, rawText, images[], imageSources[] }`

### Example

```bash
node scrape.mjs "https://www.bestate4.me/listing/kfBMbvrdUImyDi5L1cMG"
# → 4 photos + listing.json in scraped/kfBMbvrdUImyDi5L1cMG/
#   title: Izdaje se jednosoban stan · price: €450/mo · area: 46 m²
```

To use the photos in the Kluch marketplace mockup, copy them into `brand/img/` and reference
them from a listing card / the modal gallery.

## Notes & limits

- **Photos only by default:** map tiles (OpenStreetMap/Carto/Mapbox), logos, icons, and SVGs are
  filtered out; images under ~8 KB are skipped as thumbnails.
- **Metadata is best-effort** (regex over the rendered text). `rawText` holds the first ~4 KB of
  page text so you can pull anything the structured fields missed.
- If a site lazy-loads gallery images only on carousel click, some photos may be missed — the
  script scrolls to trigger lazy loading, which covers most cases.
- **Respect each site's terms of service and copyright.** Listing photos are usually the
  agency's/owner's; only reuse them with permission. For Kluch this is intended for **partner
  agencies importing their own listings**, not scraping competitors.
