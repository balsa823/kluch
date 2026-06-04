// Scrape a real-estate listing (bestate4.me and similar JS-rendered sites):
// pulls photos + best-effort details into a folder.
//
// Usage:  node scrape.mjs <listing-url> [outDir]
// Output: <outDir>/<id>/photo-NN.jpg  +  <outDir>/<id>/listing.json
//
// Uses the locally-installed Google Chrome (no Chromium download).

import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const url = process.argv[2];
const outRoot = process.argv[3] || "./scraped";
if (!url) { console.error("Usage: node scrape.mjs <listing-url> [outDir]"); process.exit(1); }

const id = url.split("?")[0].replace(/\/$/, "").split("/").pop() || "listing";
const origin = new URL(url).origin;
const outDir = join(outRoot, id);

// Resolve Next.js /_next/image?url=... wrappers to the original full-res image.
function resolveImageUrl(u) {
  try {
    const parsed = new URL(u, origin);
    if (parsed.pathname.endsWith("/_next/image") && parsed.searchParams.get("url")) {
      const inner = decodeURIComponent(parsed.searchParams.get("url"));
      return new URL(inner, origin).href;
    }
    return parsed.href;
  } catch { return null; }
}

function looksLikePhoto(u) {
  if (!u || u.startsWith("data:")) return false;
  if (/\.svg(\?|$)/i.test(u)) return false;
  if (/(sprite|logo|icon|favicon|avatar|placeholder|_next\/static)/i.test(u)) return false;
  // drop map tiles / map providers (listing pages embed a location map)
  if (/(tile\.openstreetmap|\.tile\.|tile\.osm|cartocdn|basemaps|mapbox|maps\.googleapis|gstatic\.com|staticmap)/i.test(u)) return false;
  return /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) || /_next\/image/.test(u) || /(image|photo|media|upload|storage|cdn|firebasestorage)/i.test(u);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  viewport: { width: 1440, height: 1000 },
});
const page = await ctx.newPage();

console.log(`→ loading ${url}`);
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
// give the client app time to fetch + render the gallery
await page.waitForFunction(() => document.querySelectorAll("img").length > 2, { timeout: 20000 }).catch(() => {});
// scroll to trigger any lazy-loaded gallery images
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1500);

// Collect candidate image URLs (img src/srcset + CSS background-image)
const raw = await page.evaluate(() => {
  const out = new Set();
  document.querySelectorAll("img").forEach((im) => {
    if (im.currentSrc) out.add(im.currentSrc);
    if (im.src) out.add(im.src);
    if (im.srcset) im.srcset.split(",").forEach((p) => out.add(p.trim().split(" ")[0]));
  });
  document.querySelectorAll("*").forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (m) out.add(m[1]);
  });
  return [...out];
});

// Best-effort listing metadata
const meta = await page.evaluate(() => {
  const pick = (sel) => document.querySelector(sel)?.innerText?.trim() || null;
  const text = document.body.innerText || "";
  const grab = (re) => (text.match(re) || [])[0] || null;
  return {
    title: pick("h1") || document.title || null,
    price: grab(/€\s?[\d.,]+(?:\s?\/\s?(?:mo|month|mjesec))?/i),
    area: grab(/\d+(?:[.,]\d+)?\s?m²/i),
    bedrooms: grab(/\d+\s?(?:bed|bedroom|spava|soba|ода)/i),
    rawText: text.replace(/\n{2,}/g, "\n").slice(0, 4000),
  };
});

// Normalize + dedupe photo URLs
const photos = [...new Set(raw.map(resolveImageUrl).filter(looksLikePhoto))];
console.log(`→ found ${photos.length} candidate photos`);

await mkdir(outDir, { recursive: true });
const saved = [];
let n = 0;
for (const purl of photos) {
  n++;
  try {
    const resp = await ctx.request.get(purl, { headers: { referer: url } });
    if (!resp.ok()) { console.log(`  skip (${resp.status()}) ${purl}`); continue; }
    const buf = await resp.body();
    if (buf.length < 8000) { console.log(`  skip (too small ${buf.length}b) ${purl}`); continue; } // drop icons/thumbs
    const ct = resp.headers()["content-type"] || "";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("avif") ? "avif" : "jpg";
    const file = `photo-${String(saved.length + 1).padStart(2, "0")}.${ext}`;
    await writeFile(join(outDir, file), buf);
    saved.push({ file, source: purl, bytes: buf.length });
    console.log(`  ✓ ${file}  (${Math.round(buf.length / 1024)} KB)`);
  } catch (e) { console.log(`  err ${purl}: ${e.message}`); }
}

const listing = { url, id, ...meta, images: saved.map((s) => s.file), imageSources: saved.map((s) => s.source) };
await writeFile(join(outDir, "listing.json"), JSON.stringify(listing, null, 2));
console.log(`\n✓ saved ${saved.length} photos + listing.json to ${outDir}`);
if (meta.title) console.log(`  title: ${meta.title}`);
if (meta.price) console.log(`  price: ${meta.price}`);
if (meta.area) console.log(`  area:  ${meta.area}`);

await browser.close();
