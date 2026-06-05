import { formatMoney, type Agency, type Property, type SearchFilters } from "@kluch/core";

/** Minimal HTML-escaping for text interpolated into the template. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(value: unknown): string {
  return value === undefined || value === null || value === "" ? "" : esc(value);
}

/** Returns `value` only if it is a safe CSS color (hex or plain keyword), else `fallback`. */
function cssColor(value: unknown, fallback: string): string {
  const s = String(value ?? "");
  return /^#[0-9a-fA-F]{3,8}$/.test(s) || /^[a-zA-Z]+$/.test(s) ? s : fallback;
}

/**
 * Returns the URL only if it's an http(s) URL or a same-origin root-relative
 * path (e.g. "/uploads/..."), else an empty string. Blocks javascript:/data:
 * and protocol-relative ("//host") URLs.
 */
function safeUrl(u: unknown): string {
  const s = String(u ?? "");
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return "";
}

function renderCard(listing: Property): string {
  const photo = safeUrl(listing.photos?.[0]);
  const image = photo
    ? `<img class="card-photo" src="${esc(photo)}" alt="${esc(listing.name)}" />`
    : `<div class="card-photo card-photo--empty"></div>`;
  return `
      <article class="card">
        ${image}
        <div class="card-body">
          <h3 class="card-title">${esc(listing.name)}</h3>
          <p class="card-price">${esc(formatMoney(listing.priceMinor ?? 0, listing.currency))}</p>
          <p class="card-city">${esc(listing.city)}</p>
        </div>
      </article>`;
}

/**
 * Renders a white-label agency website as a standalone HTML document.
 * Themed by the agency's own colours via CSS variables, on Kluch's design language.
 */
export function renderAgencySite(
  agency: Agency,
  listings: Property[],
  filters: SearchFilters = {},
): string {
  const logoUrl = safeUrl(agency.logoUrl);
  const logo = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(agency.name)}" />`
    : "";

  const cards = listings.length
    ? listings.map(renderCard).join("")
    : `<p class="empty">No properties match your search.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(agency.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --color-primary: ${cssColor(agency.colorPrimary, "#1F3A5C")};
      --color-accent: ${cssColor(agency.colorAccent, "#4E827A")};
      --color-cream: #F1ECE0;
      --color-navy: #1F3A5C;
      --color-teal: #4E827A;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", system-ui, sans-serif;
      color: var(--color-navy);
      background: var(--color-cream);
    }
    h1, h2, h3, .logo-text { font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
    header.site {
      background: var(--color-primary);
      color: #fff;
      padding: 2.25rem 1rem 1.9rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.65rem;
      border-bottom: 3px solid var(--color-accent);
    }
    .logo { height: 84px; width: auto; border-radius: 8px; }
    .logo-text { font-size: 1.5rem; margin: 0; letter-spacing: 0.02em; }
    .tagline { margin: 0; opacity: 0.85; font-size: 0.95rem; }
    main { padding: clamp(1rem, 4vw, 3rem); max-width: 1100px; margin: 0 auto; }
    form.search {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
      align-items: end;
      background: #fff;
      padding: 1rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }
    form.search label { display: flex; flex-direction: column; font-size: 0.8rem; gap: 0.25rem; }
    form.search input {
      padding: 0.5rem 0.65rem;
      border: 1px solid #d8d2c4;
      border-radius: 8px;
      font: inherit;
    }
    form.search button {
      background: var(--color-accent);
      color: #fff;
      border: 0;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font: inherit;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1.25rem;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(31, 58, 92, 0.12);
    }
    .card-photo { width: 100%; height: 170px; object-fit: cover; display: block; }
    .card-photo--empty { background: var(--color-accent); opacity: 0.25; }
    .card-body { padding: 0.9rem 1rem 1.1rem; }
    .card-title { margin: 0 0 0.35rem; font-size: 1.05rem; }
    .card-price { margin: 0 0 0.2rem; color: var(--color-accent); font-weight: 600; }
    .card-city { margin: 0; color: #6b6557; font-size: 0.9rem; }
    .empty { color: #6b6557; }
    footer.site {
      text-align: center;
      padding: 2rem 1rem;
      color: #6b6557;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <header class="site">
    ${logo}
    <div>
      <h1 class="logo-text">${esc(agency.name)}</h1>
      ${agency.tagline ? `<p class="tagline">${esc(agency.tagline)}</p>` : ""}
    </div>
  </header>
  <main>
    <form class="search" method="get">
      <label>City
        <input type="text" name="city" value="${attr(filters.city)}" placeholder="Any city" />
      </label>
      <label>Min price (€)
        <input type="number" name="minPrice" value="${attr(filters.minPrice)}" />
      </label>
      <label>Max price (€)
        <input type="number" name="maxPrice" value="${attr(filters.maxPrice)}" />
      </label>
      <label>Min bedrooms
        <input type="number" name="bedrooms" value="${attr(filters.bedrooms)}" />
      </label>
      <button type="submit">Search</button>
    </form>
    <section class="grid">${cards}</section>
  </main>
  <footer class="site">Powered by Kluch</footer>
</body>
</html>`;
}
