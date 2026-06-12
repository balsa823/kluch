import { formatMoney, openStatus, type Agency, type Property, type SearchFilters } from "@kluche/core";
import { MNE_LOCATIONS, cityCoords, areaCoords } from "@kluche/locations";
import { DICT, tr, type Lang } from "./i18n.js";

/**
 * FNV-1a-seeded LCG producing a deterministic [0,1) stream from a string seed.
 * Ported from brand/map-mockup.html so a listing's approximate pin never jumps
 * between renders (seed = listing.id).
 */
function seededRng(seed: string): () => number {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
    s = Math.imul(s, 16777619) >>> 0;
  }
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The approximate map pin for a listing: the area centre when known, else the
 * city centre, displaced by a deterministic random offset within ~460m so the
 * exact address is never revealed. Returns null when the city is unknown.
 * Exported for testing.
 */
export function listingPin(listing: Property): { lat: number; lng: number } | null {
  const area = (listing as { area?: string | null }).area;
  const c = (area && areaCoords(listing.city, area)) || cityCoords(listing.city);
  if (!c) return null;
  const r = seededRng(String(listing.id));
  const angle = r() * 2 * Math.PI;
  const rad = 460 * Math.sqrt(r()); // metres, uniform within the disc
  const dLat = (rad * Math.cos(angle)) / 111320;
  const dLng = (rad * Math.sin(angle)) / (111320 * Math.cos((c.lat * Math.PI) / 180));
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lat: round6(c.lat + dLat), lng: round6(c.lng + dLng) };
}

/** Minimal HTML-escaping for text interpolated into the template. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON value safe to embed inside a <script> tag (escapes `<` so `</script>` can't break out). */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value ?? "").replace(/</g, "\\u003c");
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

/**
 * A URL safe to embed inside a CSS `url('...')`. esc() does not escape `'`/`)`,
 * so a crafted (e.g. scraped) photo URL could break out of the CSS string and
 * inject rules — reject any URL containing quotes, parens, backslash or whitespace.
 */
function cssUrl(u: unknown): string {
  const s = safeUrl(u);
  return /["'()\\\s]/.test(s) ? "" : s;
}

/**
 * Rewrites a full Azure Blob photo URL to our on-demand thumbnail endpoint at
 * the given width; leaves any other URL (local dev, non-blob) untouched.
 */
export function thumbSrc(fullUrl: string, w: number): string {
  const m = /^https:\/\/[^/]+\.blob\.core\.windows\.net\/[^/]+\/(.+)$/.exec(fullUrl);
  return m ? `/t/${m[1]}?w=${w}` : fullUrl;
}

/** Renders a single property card: photo, deal price, city, badge row and type. */
function renderCard(listing: Property, lang: Lang = "en"): string {
  const t_ = (key: string) => esc(tr(lang, key));
  const cover = safeUrl(listing.photos?.[0]);
  const photoCount = (listing.photos ?? []).filter((p) => safeUrl(p)).length;
  const image = cover
    ? `<img class="card-photo" src="${esc(thumbSrc(cover, 480))}" data-full="${attr(cover)}" alt="${esc(listing.name)}" loading="lazy" decoding="async" />`
    : `<div class="card-photo card-photo--empty"></div>`;
  // Arrows only when there's more than one photo; they stopPropagation so a tap
  // flips the photo without opening the modal. JS (mini-gallery) wires them up.
  const arrows = cover && photoCount > 1
    ? `<button class="card-arrow card-arrow-prev" type="button" aria-label="Previous photo" onclick="event.stopPropagation()">‹</button>` +
      `<button class="card-arrow card-arrow-next" type="button" aria-label="Next photo" onclick="event.stopPropagation()">›</button>`
    : "";
  const media = `<div class="card-media">${image}${arrows}</div>`;

  const isRent = listing.dealType === "rent";
  const hasPrice = listing.priceMinor != null && listing.priceMinor > 0;
  const priceLine = hasPrice
    ? (isRent
        ? `<p class="card-price">${esc(formatMoney(listing.priceMinor!, listing.currency))}<span class="card-permo" data-i18n="card.perMonth">${t_("card.perMonth")}</span></p>`
        : `<p class="card-price">${esc(formatMoney(listing.priceMinor!, listing.currency))}</p>`)
    : `<p class="card-price card-price--ask" data-i18n="card.priceOnRequest">${t_("card.priceOnRequest")}</p>`;
  const tag = isRent
    ? `<span class="card-tag card-tag--rent" data-i18n="card.forRent">${t_("card.forRent")}</span>`
    : `<span class="card-tag card-tag--sale" data-i18n="card.forSale">${t_("card.forSale")}</span>`;
  const priceBlock = `${priceLine}
          ${tag}`;

  const badges: string[] = [];
  if (listing.bedrooms != null) badges.push(`<span>${esc(listing.bedrooms)} bd</span>`);
  if (listing.bathrooms != null) badges.push(`<span>${esc(listing.bathrooms)} ba</span>`);
  if (listing.areaM2 != null) badges.push(`<span>${esc(listing.areaM2)} m²</span>`);
  const badgeRow = badges.length
    ? `<div class="card-badges">${badges.join('<i aria-hidden="true">·</i>')}</div>`
    : "";

  const typeLabel = listing.type ? `<p class="card-type">${esc(listing.type)}</p>` : "";

  const codeChip = listing.refCode
    ? `<span class="card-code">${esc(listing.refCode)}</span>`
    : "";

  return `
      <article class="card" data-id="${esc(listing.id)}" role="button" tabindex="0">
        ${codeChip}
        ${media}
        <div class="card-body">
          ${priceBlock}
          <h3 class="card-title">${esc(listing.name)}</h3>
          <p class="card-city">${esc(listing.city)}</p>
          ${badgeRow}
          ${typeLabel}
        </div>
      </article>`;
}

/**
 * Renders a white-label agency website as a standalone, multilingual HTML document.
 * Themed by the agency's own colours via CSS variables, on Kluch's design language.
 */
/**
 * Builds a root-relative query string ("?city=...&page=2") from the active
 * search filters plus a target page. Mirrors how the filter tabs build hrefs,
 * but preserves every active filter (city, dealType, minPrice, maxPrice,
 * bedrooms) so paging never drops the user's search. Returns an esc()'d string
 * safe to drop straight into an href attribute.
 */
/**
 * Builds the query params for the active filters. `overrides` can replace the
 * deal type (for the rent/sale tabs) or add a page number. Prices are emitted in
 * EUROS (filters store cents) to match what the form submits and what
 * parseSearchFilters expects — otherwise each navigation would ×100 the price.
 */
function filterParams(
  filters: SearchFilters,
  overrides: { dealType?: "" | "rent" | "sale"; page?: number } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  // Repeated `loc` params (City or City|Area) round-trip the Location filter.
  for (const l of filters.locations ?? []) {
    params.append("loc", l.area ? `${l.city}|${l.area}` : l.city);
  }
  // Free-text / ref-code search rides in `q` so pagination keeps it.
  if (filters.text) params.set("q", filters.text);
  else if (filters.refCode) params.set("q", filters.refCode);
  const dealType = overrides.dealType !== undefined ? overrides.dealType : filters.dealType;
  if (dealType) params.set("dealType", dealType);
  if (filters.type) params.set("type", filters.type);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice / 100));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice / 100));
  if (filters.bedrooms !== undefined) params.set("bedrooms", String(filters.bedrooms));
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  return params;
}

function hrefFromParams(params: URLSearchParams): string {
  const qs = params.toString();
  return esc(qs ? `?${qs}` : "?");
}

function pageHref(filters: SearchFilters, page: number): string {
  return hrefFromParams(filterParams(filters, { page }));
}

/** True when any filter is active (so we can offer a Clear link). */
function hasActiveFilters(f: SearchFilters): boolean {
  return Boolean(
    f.city || f.dealType || f.type || f.refCode || f.text || f.locations?.length ||
    f.minPrice !== undefined || f.maxPrice !== undefined || f.bedrooms !== undefined,
  );
}

export function renderAgencySite(
  agency: Agency,
  listings: Property[],
  filters: SearchFilters = {},
  opts: {
    sent?: boolean;
    page?: number;
    pageSize?: number;
    total?: number;
    now?: Date;
    lang?: Lang;
    showLangPicker?: boolean;
  } = {},
): string {
  // Server-side language: translate the initial HTML so there's no English flash
  // and the page works without JS. `L` drives every data-i18n default below.
  const L: Lang = opts.lang ?? "en";
  const T_ = (key: string) => esc(tr(L, key));

  const logoUrl = safeUrl(agency.logoUrl);
  const logo = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(agency.name)}" />`
    : "";

  const slug = esc(agency.slug);

  // H1: render the agency's own headline literally when set, else the English
  // default copy tagged for client-side localization (the server can't call t()).
  const heroH1 = agency.heroHeadline
    ? `<h1>${esc(agency.heroHeadline)}</h1>`
    : `<h1 data-i18n="hero.title">${T_("hero.title")}</h1>`;

  // Hero background: configured hero image → first listing photo → gradient.
  const heroImage = cssUrl(agency.heroImageUrl) || cssUrl(listings[0]?.photos?.[0]);
  const heroStyle = heroImage
    ? `background-image: linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.5)), url('${heroImage}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, var(--color-primary), #11203a);`;

  const favicon = safeUrl(agency.faviconUrl)
    ? `\n  <link rel="icon" href="${esc(safeUrl(agency.faviconUrl))}">`
    : "";

  // Open/closed badge driven by the agency's business hours + holidays.
  const status = openStatus(agency, opts.now ?? new Date());

  // --- Hero filter pre-selection (server-side, so the URL round-trips) ------
  // Active option class for a single-select chip group (deal / beds / type).
  const optSel = (group: "deal" | "beds" | "type", value: string): boolean => {
    if (group === "deal") return (filters.dealType ?? "") === value;
    if (group === "type") return (filters.type ?? "") === value;
    return value !== "" && filters.bedrooms === Number(value);
  };
  const optClass = (group: "deal" | "beds" | "type", value: string) =>
    optSel(group, value) ? "opt sel" : "opt";

  // The free-text search box shows text first, else a ref-code lookup.
  const searchValue = filters.text ?? filters.refCode ?? "";

  // Hidden inputs serialise the active filters so a plain submit (or JS-less
  // client) preserves them; JS rewrites these live as the user changes chips.
  const locInputs = (filters.locations ?? [])
    .map((l) => `<input type="hidden" name="loc" value="${attr(l.area ? `${l.city}|${l.area}` : l.city)}" />`)
    .join("");
  const hiddenField = (name: string, value: unknown) =>
    value === undefined || value === "" ? "" : `<input type="hidden" name="${name}" value="${attr(value)}" />`;

  // Chip labels reflect the active selection so the page renders correctly even
  // before the inline JS runs (and for no-JS clients).
  // Active-chip labels reflect the selected value; localize them so a server
  // render (e.g. after Search) shows the chip in the visitor's language. The
  // chip() helper localizes the *inactive* default itself via its i18nKey.
  const dealLabel: Record<string, string> = { rent: tr(L, "tab.rent"), sale: tr(L, "tab.sale") };
  const typeLabel: Record<string, string> = {
    residential: tr(L, "search.typeResidential"),
    land: tr(L, "search.typeLand"),
    commercial: tr(L, "search.typeCommercial"),
  };
  const locActive = !!filters.locations?.length;
  const locChipLabel = !locActive
    ? tr(L, "filter.location")
    : filters.locations!.length === 1
      ? (filters.locations![0].area
          ? `${filters.locations![0].city} / ${filters.locations![0].area}`
          : filters.locations![0].city)
      : `Location · ${filters.locations!.length}`;
  const priceActive = filters.minPrice !== undefined || filters.maxPrice !== undefined;
  // Match the client-side syncPriceChip() format so the chip keeps showing "€0–300"
  // after a server render (Search), instead of reverting to the plain "Price" label.
  const priceMinEuro = filters.minPrice !== undefined ? String(filters.minPrice / 100) : "";
  const priceMaxEuro = filters.maxPrice !== undefined ? String(filters.maxPrice / 100) : "";
  const priceLabel = priceActive ? `€${priceMinEuro || "0"}–${priceMaxEuro || "∞"}` : tr(L, "filter.price");
  const dealActive = !!filters.dealType;
  const bedsActive = filters.bedrooms !== undefined;
  const typeActive = !!filters.type;

  const caretSvg = `<svg class="caret" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`;
  // A chip header: active chips carry an ✕ to clear, inactive ones a caret.
  // Active chips render the (already-localized) selection label; inactive chips
  // render the localized default for `i18nKey` (so it's correct pre-JS), keeping
  // the data-i18n attr so the client can re-localize on a live language switch.
  const chip = (pop: string, i18nKey: string, label: string, active: boolean) =>
    `<button type="button" class="chip${active ? " active" : ""}" data-pop="${pop}">` +
    `<span${active ? "" : ` data-i18n="${i18nKey}"`}>${active ? esc(label) : T_(i18nKey)}</span>` +
    `${active ? `<span class="clear" role="button" aria-label="Clear">✕</span>` : caretSvg}</button>`;

  const cards = listings.length
    ? listings.map((l) => renderCard(l, L)).join("")
    : `<p class="empty" data-i18n="properties.empty">${T_("properties.empty")}</p>`;

  // --- Map view (only when the agency has enabled it) -----------------------
  const mapEnabled = !!agency.mapEnabled;
  // Distinct area/city centres present among this page's listings. Each centre
  // gets a name (the area when it resolved to area coords, else the city), the
  // coord, a count, and the `?loc=` value the chip/circle navigates to.
  type MapArea = { name: string; lat: number; lng: number; count: number; loc: string };
  const mapAreas: MapArea[] = [];
  if (mapEnabled) {
    const byKey = new Map<string, MapArea>();
    for (const l of listings) {
      const area = (l as { area?: string | null }).area;
      const ac = area ? areaCoords(l.city, area) : null;
      const centre = ac || cityCoords(l.city);
      if (!centre) continue; // unknown city → not grouped
      const name = ac && area ? area : l.city;
      const loc = ac && area ? `${l.city}|${area}` : l.city;
      const key = `${centre.lat},${centre.lng}|${name}`;
      const existing = byKey.get(key);
      if (existing) existing.count += 1;
      else byKey.set(key, { name, lat: centre.lat, lng: centre.lng, count: 1, loc });
    }
    mapAreas.push(...byKey.values());
  }

  // Pager: only shown when there are more results than fit on one page.
  const pageSize = opts.pageSize ?? 0;
  const total = opts.total ?? 0;
  const page = Math.max(1, opts.page ?? 1);
  const pages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  const pager =
    pageSize > 0 && total > pageSize
      ? `<nav class="pager" aria-label="Pagination">
        ${
          page > 1
            ? `<a class="pager-link pager-prev" href="${pageHref(filters, page - 1)}" data-i18n="pager.prev">${T_("pager.prev")}</a>`
            : ""
        }
        <span class="pager-info">Page ${esc(page)} of ${esc(pages)}</span>
        ${
          page < pages
            ? `<a class="pager-link pager-next" href="${pageHref(filters, page + 1)}" data-i18n="pager.next">${T_("pager.next")}</a>`
            : ""
        }
      </nav>`
      : "";

  const contactInner = opts.sent
    ? `<p class="thankyou" data-i18n="contact.thankyou">${T_("contact.thankyou")}</p>`
    : `<form class="contact-form" method="post" action="/a/${slug}/inquiry">
          <label class="hp" aria-hidden="true">Company
            <input type="text" name="company" tabindex="-1" autocomplete="off" />
          </label>
          <label><span data-i18n="contact.name">${T_("contact.name")}</span>
            <input type="text" name="name" maxlength="120" required />
          </label>
          <label><span data-i18n="contact.contact">${T_("contact.contact")}</span>
            <input type="text" name="contact" maxlength="200" required />
          </label>
          <label><span data-i18n="contact.message">${T_("contact.message")}</span>
            <textarea name="message" rows="4" maxlength="2000"></textarea>
          </label>
          <button type="submit" data-i18n="contact.submit">${T_("contact.submit")}</button>
        </form>`;

  // --- Footer (themed, multi-column, driven by agency settings) -------------
  const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  // About column: aboutBlurb when set, else the localizable default copy.
  const aboutText = agency.aboutBlurb
    ? `<p class="footer-text">${esc(agency.aboutBlurb)}</p>`
    : `<p class="footer-text" data-i18n="about.body">${T_("about.body")}</p>`;

  const SOCIAL_KEYS = ["facebook", "instagram", "linkedin", "youtube", "tiktok"] as const;
  const SOCIAL_LABELS: Record<string, string> = {
    facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok",
  };
  const socials = (agency.socials && typeof agency.socials === "object" && !Array.isArray(agency.socials))
    ? (agency.socials as Record<string, unknown>)
    : {};
  const socialLinks = SOCIAL_KEYS
    .map((k) => ({ k, url: safeUrl(socials[k]) }))
    .filter((s) => s.url)
    .map((s) => `<a class="footer-soc" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(SOCIAL_LABELS[s.k])}">${esc(SOCIAL_LABELS[s.k])}</a>`)
    .join("");
  const socialRow = socialLinks ? `<div class="footer-social">${socialLinks}</div>` : "";

  // Hours column: 7 rows from businessHours (tolerate null/partial jsonb).
  const bh = (agency.businessHours && typeof agency.businessHours === "object" && !Array.isArray(agency.businessHours))
    ? (agency.businessHours as Record<string, unknown>)
    : null;
  const hourRows = bh
    ? DAY_KEYS.map((d) => {
        const day = bh[d];
        let value: string;
        if (day && typeof day === "object") {
          const o = (day as { open?: unknown }).open;
          const c = (day as { close?: unknown }).close;
          value = typeof o === "string" && typeof c === "string" && o && c
            ? `<span class="footer-htime">${esc(o)}–${esc(c)}</span>`
            : `<span class="footer-htime" data-i18n="footer.closedDay">${T_("footer.closedDay")}</span>`;
        } else {
          value = `<span class="footer-htime" data-i18n="footer.closedDay">${T_("footer.closedDay")}</span>`;
        }
        return `<div class="footer-hrow"><span data-i18n="day.${d}">${T_(`day.${d}`)}</span>${value}</div>`;
      }).join("")
    : "";
  const hoursColumn = bh
    ? `<div class="footer-col footer-hours">
          <h4 data-i18n="footer.hours">${T_("footer.hours")}</h4>
          ${hourRows}
        </div>`
    : "";

  // Open-now badge: localizable when open; the holiday name (escaped) or a
  // localizable "Closed" when closed. Literal English fallback shows pre-JS.
  const openBadge = status.open
    ? `<span class="open-badge is-open" data-i18n="footer.openNow">${T_("footer.openNow")}</span>`
    : status.holiday
      ? `<span class="open-badge is-closed">${esc(status.holiday)}</span>`
      : `<span class="open-badge is-closed" data-i18n="footer.closed">${T_("footer.closed")}</span>`;

  // Contact column: only render the bits that are set.
  const phoneRow = agency.phone
    ? `<a class="footer-link" href="tel:${esc(agency.phone)}">${esc(agency.phone)}</a>`
    : "";
  const whatsappRow = agency.whatsapp
    ? `<a class="footer-link" href="https://wa.me/${esc(String(agency.whatsapp).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
    : "";
  const viberRow = agency.viber
    ? `<a class="footer-link" href="viber://chat?number=${esc(String(agency.viber).replace(/[^0-9+]/g, ""))}">Viber</a>`
    : "";
  const emailRow = agency.email
    ? `<a class="footer-link" href="mailto:${esc(agency.email)}">${esc(agency.email)}</a>`
    : "";
  const addressRow = agency.address
    ? `<address class="footer-address">${esc(agency.address).replace(/\n/g, "<br />")}</address>`
    : "";
  const mapRow = safeUrl(agency.mapUrl)
    ? `<a class="footer-link" href="${esc(safeUrl(agency.mapUrl))}" target="_blank" rel="noopener noreferrer" data-i18n="footer.map">${T_("footer.map")}</a>`
    : "";
  const contactBits = [phoneRow, whatsappRow, viberRow, emailRow, addressRow, mapRow].filter(Boolean).join("");
  const contactColumn = contactBits
    ? `<div class="footer-col footer-contact">
          <h4 data-i18n="footer.contact">${T_("footer.contact")}</h4>
          ${contactBits}
        </div>`
    : "";

  const footerLegalName = esc(agency.footerName || agency.name);

  const footer = `
  <footer class="site">
    <div class="footer-grid">
      <div class="footer-col footer-about">
        <h4>${esc(agency.name)}</h4>
        ${aboutText}
        ${socialRow}
      </div>
      ${hoursColumn}
      ${contactColumn}
    </div>
    <div class="footer-bar">
      ${openBadge}
      <span class="footer-legal">${footerLegalName} · <span data-i18n="footer.powered">${T_("footer.powered")}</span></span>
    </div>
  </footer>`;

  return `<!doctype html>
<html lang="${L}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${cssColor(agency.colorPrimary, "#1F3A5C")}" />
  <title>${esc(agency.name)}</title>${favicon}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet" />${mapEnabled ? `\n  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />` : ""}
  <style>
    :root {
      --color-primary: ${cssColor(agency.colorPrimary, "#1F3A5C")};
      --color-accent: ${cssColor(agency.colorAccent, "#4E827A")};
      --color-cream: #F1ECE0;
      --color-ink: #1F2937;
    }
    * { box-sizing: border-box; }
    /* Fill the screen on iOS Safari when its toolbar collapses: html carries the
       page background (so revealed/overscroll areas never flash white) and body
       stretches to the dynamic viewport height. */
    html { background: var(--color-cream); min-height: 100%; }
    body {
      margin: 0;
      font-family: "Inter", system-ui, sans-serif;
      color: var(--color-ink);
      background: var(--color-cream);
      min-height: 100vh;
      min-height: 100dvh;
    }
    h1, h2, h3, .logo-text { font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
    a { color: inherit; }

    /* Nav */
    nav.site {
      position: sticky; top: 0; z-index: 30;
      transition: transform 0.25s ease;
      will-change: transform;
      display: flex; align-items: center; gap: 1rem;
      /* Extend the dark nav under the iOS status bar (safe-area) so Safari, which
         tints its top bar from the content behind it, shows a full-bleed dark top
         like Chrome — not the light page background. */
      padding: calc(0.75rem + env(safe-area-inset-top, 0px)) clamp(1rem, 4vw, 2.5rem) 0.75rem;
      background: var(--color-primary);
      color: #fff;
      border-bottom: 3px solid var(--color-accent);
    }
    /* Collapsible nav: slides up out of view when scrolling down, back on scroll up. */
    nav.site.nav-hidden { transform: translateY(-100%); }
    nav.site .brand { display: flex; align-items: center; gap: 0.6rem; font-weight: 700; }
    nav.site .logo { height: 38px; width: auto; border-radius: 6px; }
    nav.site .nav-links { margin-left: auto; display: flex; align-items: center; gap: 1.1rem; }
    nav.site .nav-links a { text-decoration: none; opacity: 0.9; font-size: 0.92rem; }
    nav.site .nav-links a:hover { opacity: 1; }
    .langmenu { display: flex; gap: 0.25rem; }
    .langmenu button {
      background: rgba(255,255,255,0.12); color: #fff; border: 0;
      padding: 0.3rem 0.5rem; border-radius: 6px; cursor: pointer; font: inherit; font-size: 0.82rem;
    }
    .langmenu button.active { background: var(--color-accent); }
    /* Mobile burger menu */
    nav.site .nav-burger {
      display: none; margin-left: auto; flex-direction: column; gap: 4px;
      background: transparent; border: 0; cursor: pointer; padding: 0.45rem;
    }
    nav.site .nav-burger span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; }
    @media (max-width: 760px) {
      nav.site .nav-burger { display: flex; }
      nav.site .nav-links {
        position: absolute; top: 100%; left: 0; right: 0; margin: 0; display: none;
        flex-direction: column; align-items: flex-start; gap: 0.9rem;
        background: var(--color-primary); padding: 1.1rem clamp(1rem, 4vw, 2.5rem) 1.3rem;
        border-bottom: 3px solid var(--color-accent); box-shadow: 0 12px 30px rgba(0,0,0,.25);
      }
      nav.site .nav-links.open { display: flex; }
      nav.site .nav-links a { font-size: 1rem; }
      .langmenu { margin-top: 0.3rem; }
    }
    /* First-visit language picker */
    .lang-modal { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); padding: 1rem; }
    .lang-modal-card { background: #fff; color: var(--color-ink); border-radius: 16px; padding: 1.6rem; max-width: 360px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
    .lang-modal-title { font-weight: 700; font-size: 1.1rem; margin: 0 0 1.1rem; text-align: center; }
    .lang-modal-opts { display: flex; flex-direction: column; gap: 0.6rem; }
    .lang-modal-opts button {
      background: #fff; border: 1px solid #d8d2c4; border-radius: 10px; padding: 0.75rem 1rem;
      font: inherit; font-size: 1rem; cursor: pointer; text-align: left; color: var(--color-ink);
    }
    .lang-modal-opts button:hover { border-color: var(--color-primary); background: #f4f0e6; }

    /* Hero */
    header.hero {
      ${heroStyle}
      color: #fff;
      padding: clamp(3rem, 12vw, 7rem) clamp(1rem, 4vw, 2.5rem) clamp(4rem, 9vw, 6rem);
      text-align: center;
    }
    header.hero h1 { font-size: clamp(2rem, 6vw, 3.4rem); margin: 0 auto 1.5rem; max-width: 18ch; text-shadow: 0 2px 16px rgba(0,0,0,.4); }

    /* Hero search bar (keypartners-style) */
    form.search { max-width: 980px; margin: 0 auto; text-align: left; }
    .searchbar { display: flex; gap: 0.6rem; }
    .searchbar input {
      flex: 1; border: 0; border-radius: 10px; padding: 0.95rem 1.1rem; font: inherit; font-size: 1rem;
      background: #fff; color: var(--color-ink); box-shadow: 0 10px 30px rgba(0,0,0,.18); min-width: 0;
    }
    .searchbar input:focus { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent), 0 10px 30px rgba(0,0,0,.18); }
    .searchbar button.search-go {
      display: flex; align-items: center; gap: 0.5rem; border: 0; cursor: pointer;
      background: var(--color-accent); color: #fff; font: inherit; font-weight: 700; letter-spacing: .04em;
      padding: 0 1.5rem; border-radius: 10px; text-transform: uppercase; font-size: 0.85rem;
      box-shadow: 0 10px 30px rgba(0,0,0,.18);
    }
    .searchbar button.search-go:hover { filter: brightness(1.05); }
    .searchbar button.search-go svg { width: 1rem; height: 1rem; stroke: #fff; fill: none; stroke-width: 2.4; }

    .chips { display: flex; flex-wrap: wrap; gap: 1.4rem; margin: 1.1rem 0 0; padding-left: 0.2rem; }
    .chip {
      position: relative; display: inline-flex; align-items: center; gap: 0.45rem;
      background: transparent; border: 0; cursor: pointer; color: #fff; font: inherit; font-size: 0.95rem; font-weight: 500;
      padding: 0.2rem 0;
    }
    .chip .caret { width: 0.7rem; height: 0.7rem; stroke: #fff; fill: none; stroke-width: 2.2; opacity: 0.9; }
    .chip .clear {
      display: inline-flex; align-items: center; justify-content: center; width: 1.05rem; height: 1.05rem;
      border-radius: 999px; font-size: 0.8rem; line-height: 1; opacity: 0.85;
    }
    .chip.active { font-weight: 700; }
    .chip:hover { opacity: 0.92; }
    .chip-wrap { position: relative; }

    /* Popover */
    .pop {
      position: absolute; top: calc(100% + 14px); left: 0; z-index: 40; display: none;
      background: #fff; color: var(--color-ink); border-radius: 12px; padding: 1.1rem 1.2rem; min-width: 240px;
      box-shadow: 0 18px 50px rgba(0,0,0,.28);
    }
    .pop.open { display: block; }
    .pop::before {
      content: ""; position: absolute; top: -8px; left: 22px; width: 16px; height: 16px; background: #fff;
      transform: rotate(45deg); box-shadow: -3px -3px 6px rgba(0,0,0,.05);
    }
    .pop h4 { margin: 0 0 0.8rem; font-size: 0.95rem; font-weight: 700; }
    .opts { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .opt {
      border: 1px solid #E2DDD0; background: #fff; border-radius: 9px; padding: 0.55rem 0.9rem;
      cursor: pointer; font: inherit; font-size: 0.95rem; color: var(--color-ink); min-width: 3rem; text-align: center;
    }
    .opt:hover { border-color: var(--color-primary); }
    .opt.sel { background: var(--color-primary); border-color: var(--color-primary); color: #fff; font-weight: 600; }
    .price-row { display: flex; align-items: center; gap: 0.6rem; }
    .price-row input { width: 7rem; border: 1px solid #E2DDD0; border-radius: 9px; padding: 0.55rem 0.6rem; font: inherit; }
    .pop .col { display: flex; flex-direction: column; gap: 0.45rem; min-width: 200px; }
    .pop .col .opt { text-align: left; }
    .pop-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem; }
    .pop-actions .apply { background: var(--color-primary); color: #fff; border: 0; border-radius: 8px; padding: 0.5rem 1rem; font: inherit; font-weight: 600; cursor: pointer; }
    .pop-actions .reset { background: transparent; border: 0; color: #6b6557; cursor: pointer; font: inherit; text-decoration: underline; }

    .pop.loc { min-width: 320px; }
    .loc-search { width: 100%; border: 1px solid #E2DDD0; border-radius: 9px; padding: 0.6rem 0.7rem; font: inherit; margin-bottom: 0.5rem; }
    .loc-search:focus { outline: none; border-color: var(--color-primary); }
    .loc-list { max-height: 320px; overflow: auto; display: flex; flex-direction: column; gap: 1px; }
    .loc-city { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.5rem; border-radius: 8px; cursor: pointer; font-weight: 700; color: var(--color-primary); }
    .loc-area { display: flex; align-items: center; gap: 0.5rem; padding: 0.42rem 0.5rem 0.42rem 1.4rem; border-radius: 8px; cursor: pointer; color: #44535F; font-size: 0.93rem; }
    .loc-city:hover, .loc-area:hover { background: #F4F0E6; }
    .loc-check { flex: none; width: 1.05rem; height: 1.05rem; border: 1.5px solid #E2DDD0; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; color: #fff; }
    .loc-row.sel .loc-check { background: var(--color-primary); border-color: var(--color-primary); }
    .loc-row.sel { background: #F4F0E6; }
    .loc-empty { padding: 0.8rem 0.5rem; color: #8A95A1; font-size: 0.9rem; }
    .search-clear-row { margin: 1rem 0 0; }
    form.search .search-clear { color: #fff; font-size: 0.82rem; font-weight: 600; text-decoration: underline; opacity: 0.85; }
    form.search .search-clear:hover { opacity: 1; }
    .card-price--ask { color: #6b6557; font-style: italic; font-weight: 600; }

    main { padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2.5rem); max-width: 1180px; margin: 0 auto; }
    section { scroll-margin-top: 80px; }
    .section-head { margin: 0 0 1.2rem; }

    /* Pager */
    .pager { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 2rem; }
    .pager-link {
      text-decoration: none; padding: 0.45rem 0.95rem; border-radius: 999px;
      border: 1px solid var(--color-accent); color: var(--color-primary); font-size: 0.9rem;
    }
    .pager-link:hover { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
    .pager-info { color: #6b6557; font-size: 0.9rem; }

    /* Cards */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.4rem; }
    .card {
      position: relative;
      background: #fff; border-radius: 14px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(31, 58, 92, 0.12);
      transition: transform .18s ease, box-shadow .18s ease;
    }
    .card-code {
      position: absolute; top: 0.6rem; left: 0.6rem; z-index: 2;
      background: var(--color-primary); color: #fff;
      font-size: 0.68rem; font-weight: 600; letter-spacing: .04em;
      padding: 0.18rem 0.45rem; border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,.25);
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(31, 58, 92, 0.18); }
    .card-media { position: relative; }
    .card-photo { width: 100%; height: 180px; object-fit: cover; display: block; }
    .card-photo--empty { background: var(--color-accent); opacity: 0.25; }
    .card-arrow {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 30px; height: 30px; border: 0; border-radius: 50%;
      background: rgba(0,0,0,0.42); color: #fff; cursor: pointer; z-index: 2;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem; line-height: 1; padding: 0;
    }
    .card-arrow:hover { background: rgba(0,0,0,0.62); }
    .card-arrow-prev { left: 0.45rem; }
    .card-arrow-next { right: 0.45rem; }
    .card-body { padding: 0.9rem 1rem 1.1rem; position: relative; }
    .card-tag {
      display: inline-block; font-size: 0.68rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: .05em; padding: 0.2rem 0.5rem; border-radius: 6px; margin-bottom: 0.5rem;
    }
    .card-tag--rent { background: var(--color-accent); color: #fff; }
    .card-tag--sale { background: var(--color-primary); color: #fff; }
    .card-price { margin: 0 0 0.35rem; color: var(--color-primary); font-weight: 700; font-size: 1.15rem; }
    .card-permo { font-size: 0.8rem; font-weight: 500; color: #6b6557; }
    .card-title { margin: 0 0 0.25rem; font-size: 1.02rem; }
    .card-city { margin: 0 0 0.5rem; color: #6b6557; font-size: 0.9rem; }
    .card-badges { display: flex; align-items: center; gap: 0.45rem; color: #6b6557; font-size: 0.85rem; }
    .card-badges i { opacity: 0.5; font-style: normal; }
    .card-type { margin: 0.5rem 0 0; color: #9a937f; font-size: 0.78rem; text-transform: capitalize; }
    .call-btn {
      margin-top: 0.75rem; width: 100%; background: var(--color-accent); color: #fff; border: 0;
      padding: 0.55rem 0.7rem; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer;
    }
    .call-btn:hover { filter: brightness(0.95); }
    .empty { color: #6b6557; }
    /* Phones: two compact cards per row. */
    @media (max-width: 560px) {
      .grid { grid-template-columns: 1fr 1fr; gap: 0.7rem; }
      .card-photo { height: 120px; }
      .card-body { padding: 0.6rem 0.65rem 0.75rem; }
      .card-code { font-size: 0.6rem; padding: 0.14rem 0.36rem; }
      .card-tag { font-size: 0.6rem; padding: 0.14rem 0.4rem; margin-bottom: 0.4rem; }
      .card-price { font-size: 0.98rem; }
      .card-title { font-size: 0.9rem; }
      .card-city { font-size: 0.8rem; margin-bottom: 0.35rem; }
      .card-badges { gap: 0.3rem; font-size: 0.75rem; flex-wrap: wrap; }
      .card-type { font-size: 0.72rem; }
      .call-btn { font-size: 0.82rem; padding: 0.5rem; }
    }

    /* About */
    section.about {
      background: var(--color-primary); color: #fff; border-radius: 16px;
      padding: clamp(2rem, 6vw, 3.5rem); margin: 3rem 0; text-align: center;
    }
    section.about h2 { margin: 0 0 0.6rem; }
    section.about p { margin: 0.4rem auto; max-width: 60ch; opacity: 0.9; }

    /* Contact */
    section.contact { max-width: 620px; margin: 3rem auto; }
    .contact-form { display: grid; gap: 0.85rem; background: #fff; padding: 1.5rem; border-radius: 16px; box-shadow: 0 1px 4px rgba(31,58,92,.12); }
    .contact-form label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; font-weight: 500; }
    .contact-form input, .contact-form textarea { padding: 0.6rem 0.7rem; border: 1px solid #d8d2c4; border-radius: 8px; font: inherit; }
    .contact-form button { background: var(--color-accent); color: #fff; border: 0; padding: 0.7rem; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
    .thankyou { background: #fff; padding: 1.5rem; border-radius: 16px; border-left: 4px solid var(--color-accent); font-size: 1.05rem; }
    /* visually-hidden honeypot */
    .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

    footer.site { background: var(--color-primary); color: #fff; margin-top: 3rem; padding-bottom: env(safe-area-inset-bottom, 0px); }
    .footer-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 2rem;
      max-width: 1180px; margin: 0 auto; padding: clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2.5rem) 1.5rem;
    }
    .footer-col h4 { margin: 0 0 0.9rem; font-size: 1rem; color: #fff; }
    .footer-text { margin: 0 0 1rem; opacity: 0.85; font-size: 0.9rem; line-height: 1.5; max-width: 40ch; }
    .footer-social { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .footer-soc { font-size: 0.82rem; text-decoration: none; opacity: 0.85; border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; padding: 0.25rem 0.7rem; }
    .footer-soc:hover { opacity: 1; background: rgba(255,255,255,0.1); }
    .footer-hrow { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.88rem; padding: 0.18rem 0; opacity: 0.9; }
    .footer-htime { opacity: 0.95; }
    .footer-link, .footer-address { display: block; color: #fff; opacity: 0.88; text-decoration: none; font-size: 0.9rem; margin: 0 0 0.45rem; font-style: normal; line-height: 1.4; }
    .footer-link:hover { opacity: 1; text-decoration: underline; }
    .footer-bar {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
      max-width: 1180px; margin: 0 auto; padding: 1rem clamp(1rem, 4vw, 2.5rem) 2rem;
      border-top: 1px solid rgba(255,255,255,0.18); font-size: 0.82rem; opacity: 0.9;
    }
    .open-badge { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600; padding: 0.25rem 0.7rem; border-radius: 999px; }
    .open-badge::before { content: ""; width: 0.55rem; height: 0.55rem; border-radius: 999px; background: currentColor; }
    .open-badge.is-open { background: rgba(78,130,122,0.25); color: #b9f5cf; }
    .open-badge.is-closed { background: rgba(255,255,255,0.12); color: #f1d6d6; }
    .call-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
    .card .call-btn { width: auto; }
    .card[role="button"] { cursor: pointer; }
    .card[role="button"]:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

    /* Modal */
    .modal {
      position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
      /* Pad by the iOS safe-area so the centered card (and its ✕) never tuck under
         the status/URL bar. */
      padding: max(1rem, env(safe-area-inset-top, 0px)) 1rem max(1rem, env(safe-area-inset-bottom, 0px));
    }
    .modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); }
    .modal-card {
      position: relative; z-index: 1; background: #fff; border-radius: 16px;
      width: 100%; max-width: 860px; overflow-y: auto;
      /* dvh = the *dynamic* viewport (Safari toolbar-aware), so the card fits the
         visible area instead of being clipped at the top. */
      max-height: 92vh; max-height: 88dvh;
      display: grid; grid-template-columns: 1.1fr 1fr; gap: 0;
      box-shadow: 0 20px 60px rgba(0,0,0,.4);
    }
    @media (max-width: 720px) { .modal-card { grid-template-columns: 1fr; } }
    .modal-close {
      position: absolute; top: 0.5rem; right: 0.6rem; z-index: 2;
      background: rgba(255,255,255,0.92); border: 0; border-radius: 999px;
      width: 2rem; height: 2rem; font-size: 1.3rem; line-height: 1; cursor: pointer; color: var(--color-ink);
    }
    .modal-gallery { position: relative; background: #000; min-height: 240px; display: flex; align-items: center; justify-content: center; border-radius: 16px 0 0 16px; }
    @media (max-width: 720px) { .modal-gallery { border-radius: 16px 16px 0 0; } }
    .gal-img { width: 100%; height: 100%; max-height: 92vh; max-height: 88dvh; object-fit: cover; display: block; }
    .gal-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(0,0,0,0.5); color: #fff; border: 0; width: 2.4rem; height: 2.4rem;
      border-radius: 999px; font-size: 1.4rem; line-height: 1; cursor: pointer;
    }
    .gal-prev { left: 0.6rem; } .gal-next { right: 0.6rem; }
    .gal-counter { position: absolute; bottom: 0.6rem; right: 0.8rem; background: rgba(0,0,0,0.55); color: #fff; font-size: 0.78rem; padding: 0.15rem 0.5rem; border-radius: 999px; }
    .modal-details { padding: 1.5rem 1.6rem; }
    .modal-tag { display: inline-block; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; padding: 0.2rem 0.5rem; border-radius: 6px; margin-bottom: 0.5rem; color: #fff; }
    .modal-tag.is-rent { background: var(--color-accent); } .modal-tag.is-sale { background: var(--color-primary); }
    .modal-code { margin: 0 0 0.3rem; color: #6b6557; font-size: 0.8rem; font-weight: 600; letter-spacing: .04em; }
    .modal-title { margin: 0 0 0.3rem; font-size: 1.35rem; }
    .modal-price { margin: 0 0 0.3rem; color: var(--color-primary); font-weight: 700; font-size: 1.25rem; }
    .modal-city { margin: 0 0 0.6rem; color: #6b6557; }
    .modal-badges { display: flex; flex-wrap: wrap; gap: 0.45rem; color: #6b6557; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .modal-type { margin: 0 0 1rem; color: #9a937f; font-size: 0.85rem; text-transform: capitalize; }
    .modal-call { margin: 0 0 1.2rem; }
    .modal-tour { border-top: 1px solid #e6e0d2; padding-top: 1rem; }
    .modal-tour h4 { margin: 0 0 0.7rem; font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
    .modal-tour label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; margin-bottom: 0.7rem; }
    .modal-tour input, .modal-tour textarea { padding: 0.55rem 0.65rem; border: 1px solid #d8d2c4; border-radius: 8px; font: inherit; }
    .modal-tour button.tour-go { background: var(--color-accent); color: #fff; border: 0; padding: 0.65rem; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; width: 100%; }
    .modal-tour .tour-toggle { background: none; border: 0; color: var(--color-primary); cursor: pointer; font: inherit; text-decoration: underline; padding: 0.5rem 0 0; }
    .modal-tour .tour-msg { font-size: 0.85rem; margin: 0.6rem 0 0; }
    .modal-tour .tour-msg.err { color: #b3261e; }
    .modal-tour .tour-signed { font-size: 0.85rem; color: #6b6557; margin: 0 0 0.7rem; }${mapEnabled ? `

    /* --- Map view ------------------------------------------------------- */
    .view-toggle { display: inline-flex; border: 1px solid var(--color-accent); border-radius: 999px; overflow: hidden; margin: 0 0 1.2rem; }
    .view-toggle button {
      background: #fff; color: var(--color-primary); border: 0; cursor: pointer;
      font: inherit; font-size: 0.88rem; font-weight: 600; padding: 0.45rem 1.1rem;
    }
    .view-toggle button.active { background: var(--color-primary); color: #fff; }
    #kluche-map { margin: 0 0 1rem; }
    #kluche-map-canvas { height: 70vh; min-height: 380px; width: 100%; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(31,58,92,.12); }
    .map-note { margin: 0.6rem 0 0; color: #6b6557; font-size: 0.82rem; }
    .leaflet-tile { filter: grayscale(1) contrast(1.03) brightness(1.02); }
    .area-label { background: rgba(31,58,92,.92); color: #fff; border: 0; border-radius: 8px; padding: .12rem .45rem; font: 600 .72rem "Inter", sans-serif; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,.3); cursor: pointer; }
    .leaflet-tooltip.area-label::before { display: none; }
    .pin { background: var(--color-accent); color: #fff; font-weight: 800; font-size: .74rem; border: 2px solid #fff; border-radius: 999px; padding: .15rem .5rem; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; }` : ""}
  </style>
</head>
<body>
  <nav class="site">
    <a class="brand" href="#top">
      ${logo}
      <span>${esc(agency.name)}</span>
    </a>
    <button class="nav-burger" id="navBurger" type="button" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <div class="nav-links" id="navLinks">
      <a href="#properties" data-i18n="nav.properties">${T_("nav.properties")}</a>
      <a href="#about" data-i18n="nav.about">${T_("nav.about")}</a>
      <a href="#contact" data-i18n="nav.contact">${T_("nav.contact")}</a>
      <div class="langmenu" id="langMenu">
        <button type="button" data-code="en"${L === "en" ? ' class="active"' : ""}>EN</button>
        <button type="button" data-code="sr"${L === "sr" ? ' class="active"' : ""}>SR</button>
        <button type="button" data-code="ru"${L === "ru" ? ' class="active"' : ""}>RU</button>
        <button type="button" data-code="tr"${L === "tr" ? ' class="active"' : ""}>TR</button>
      </div>
    </div>
  </nav>

  <div id="langModal" class="lang-modal" style="display:${opts.showLangPicker ? "flex" : "none"}" role="dialog" aria-modal="true" aria-label="Choose language">
    <div class="lang-modal-card">
      <p class="lang-modal-title">🌐 Choose your language</p>
      <div class="lang-modal-opts">
        <button type="button" data-code="en">🇬🇧 English</button>
        <button type="button" data-code="sr">🇲🇪 Crnogorski / Srpski</button>
        <button type="button" data-code="ru">🇷🇺 Русский</button>
        <button type="button" data-code="tr">🇹🇷 Türkçe</button>
      </div>
    </div>
  </div>

  <header class="hero" id="top">
    ${heroH1}
    ${agency.tagline ? `<p class="hero-sub">${esc(agency.tagline)}</p>` : ""}
    <form class="search" method="get" id="hero-form">
      <div class="searchbar">
        <input type="text" name="q" value="${attr(searchValue)}" data-i18n-ph="search.placeholder" placeholder="${T_("search.placeholder")}" />
        <button type="submit" class="search-go">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
          <span data-i18n="search.submit">${T_("search.submit")}</span>
        </button>
      </div>

      <div class="chips">
        <!-- Location -->
        <div class="chip-wrap">
          ${chip("loc", "filter.location", locChipLabel, locActive)}
          <div class="pop loc" id="pop-loc">
            <h4 data-i18n="filter.location">${T_("filter.location")}</h4>
            <input class="loc-search" id="loc-search" type="text" data-i18n-ph="loc.searchPh" placeholder="${T_("loc.searchPh")}" />
            <div class="loc-list" id="loc-list"></div>
            <div class="pop-actions"><button type="button" class="reset" id="loc-reset" data-i18n="loc.clear">${T_("loc.clear")}</button><button type="button" class="apply" id="loc-apply" data-i18n="loc.done">${T_("loc.done")}</button></div>
          </div>
        </div>

        <!-- Price -->
        <div class="chip-wrap">
          ${chip("price", "filter.price", priceLabel, priceActive)}
          <div class="pop" id="pop-price">
            <h4 data-i18n="filter.price">${T_("filter.price")}</h4>
            <div class="price-row">
              <input type="number" name="minPrice" min="0" data-i18n-ph="search.minPrice" placeholder="${T_("search.minPrice")}" value="${attr(filters.minPrice ? filters.minPrice / 100 : "")}" />
              <span>–</span>
              <input type="number" name="maxPrice" min="0" data-i18n-ph="search.maxPrice" placeholder="${T_("search.maxPrice")}" value="${attr(filters.maxPrice ? filters.maxPrice / 100 : "")}" />
            </div>
          </div>
        </div>

        <!-- Listing (deal type) -->
        <div class="chip-wrap">
          ${chip("deal", "filter.listing", dealActive ? dealLabel[filters.dealType!] : "Listing", dealActive)}
          <div class="pop" id="pop-deal">
            <h4 data-i18n="filter.listing">${T_("filter.listing")}</h4>
            <div class="col">
              <button type="button" class="${optClass("deal", "")}" data-group="deal" data-value="" data-i18n="opt.any">${T_("opt.any")}</button>
              <button type="button" class="${optClass("deal", "rent")}" data-group="deal" data-value="rent" data-i18n="tab.rent">${T_("tab.rent")}</button>
              <button type="button" class="${optClass("deal", "sale")}" data-group="deal" data-value="sale" data-i18n="tab.sale">${T_("tab.sale")}</button>
            </div>
          </div>
        </div>

        <!-- Beds -->
        <div class="chip-wrap">
          ${chip("beds", "filter.beds", bedsActive ? `${filters.bedrooms}+` : "Beds", bedsActive)}
          <div class="pop" id="pop-beds">
            <h4 data-i18n="filter.beds">${T_("filter.beds")}</h4>
            <div class="opts">
              <button type="button" class="${optClass("beds", "")}" data-group="beds" data-value="" data-i18n="opt.any">${T_("opt.any")}</button>
              <button type="button" class="${optClass("beds", "1")}" data-group="beds" data-value="1" data-i18n="beds.1plus">${T_("beds.1plus")}</button>
              <button type="button" class="${optClass("beds", "2")}" data-group="beds" data-value="2" data-i18n="beds.2plus">${T_("beds.2plus")}</button>
              <button type="button" class="${optClass("beds", "3")}" data-group="beds" data-value="3" data-i18n="beds.3plus">${T_("beds.3plus")}</button>
              <button type="button" class="${optClass("beds", "4")}" data-group="beds" data-value="4" data-i18n="beds.4plus">${T_("beds.4plus")}</button>
            </div>
          </div>
        </div>

        <!-- Type -->
        <div class="chip-wrap">
          ${chip("type", "filter.type", typeActive ? typeLabel[filters.type!] : "Type", typeActive)}
          <div class="pop" id="pop-type">
            <h4 data-i18n="filter.type">${T_("filter.type")}</h4>
            <div class="col">
              <button type="button" class="${optClass("type", "")}" data-group="type" data-value="" data-i18n="opt.any">${T_("opt.any")}</button>
              <button type="button" class="${optClass("type", "residential")}" data-group="type" data-value="residential" data-i18n="search.typeResidential">${T_("search.typeResidential")}</button>
              <button type="button" class="${optClass("type", "land")}" data-group="type" data-value="land" data-i18n="search.typeLand">${T_("search.typeLand")}</button>
              <button type="button" class="${optClass("type", "commercial")}" data-group="type" data-value="commercial" data-i18n="search.typeCommercial">${T_("search.typeCommercial")}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Hidden fields carry the active filters on submit (kept live by JS). -->
      <div id="hero-hidden">
        ${locInputs}
        ${hiddenField("dealType", filters.dealType ?? "")}
        ${hiddenField("type", filters.type ?? "")}
        ${filters.bedrooms !== undefined ? hiddenField("bedrooms", filters.bedrooms) : ""}
      </div>
      ${hasActiveFilters(filters) ? `<p class="search-clear-row"><a class="search-clear" href="?" data-i18n="tab.clear">${T_("tab.clear")}</a></p>` : ""}
    </form>
  </header>

  <script type="application/json" id="kluche-locations">${jsonForScript(MNE_LOCATIONS)}</script>

  <main>
    <section id="properties">
      <h2 class="section-head" data-i18n="properties.heading">${T_("properties.heading")}</h2>
      ${
        mapEnabled
          ? `<div class="view-toggle" role="group" aria-label="View">
        <button type="button" id="view-list" class="active" data-i18n="view.list">${T_("view.list")}</button>
        <button type="button" id="view-map" data-i18n="view.map">${T_("view.map")}</button>
      </div>
      <section id="kluche-map" style="display:none">
        <div id="kluche-map-canvas"></div>
        <p class="map-note" data-i18n="map.approx">${T_("map.approx")}</p>
      </section>
      <script type="application/json" id="kluche-map-areas">${jsonForScript(mapAreas)}</script>`
          : ""
      }
      <div class="grid">${cards}</div>
      ${pager}
    </section>

    <section class="about" id="about">
      <h2>${esc(agency.name)}</h2>
      ${agency.tagline ? `<p>${esc(agency.tagline)}</p>` : ""}
      <p data-i18n="about.body">${T_("about.body")}</p>
    </section>

    <section class="contact" id="contact">
      <h2 class="section-head" data-i18n="contact.heading">${T_("contact.heading")}</h2>
      ${contactInner}
    </section>
  </main>

  ${footer}

  <div id="kluche-modal" class="modal" style="display:none" role="dialog" aria-modal="true" aria-labelledby="km-title">
    <div class="modal-backdrop" data-close></div>
    <div class="modal-card">
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>
      <div class="modal-gallery">
        <button class="gal-nav gal-prev" type="button" aria-label="Previous">‹</button>
        <img class="gal-img" alt="" />
        <button class="gal-nav gal-next" type="button" aria-label="Next">›</button>
        <span class="gal-counter"></span>
      </div>
      <div class="modal-details">
        <span class="modal-tag" data-tag></span>
        <p class="modal-code" hidden></p>
        <h3 id="km-title" class="modal-title"></h3>
        <p class="modal-price"></p>
        <p class="modal-city"></p>
        <div class="modal-badges"></div>
        <p class="modal-type"></p>
        <button class="call-btn modal-call" type="button" aria-label="Call"${agency.phone ? "" : ' style="display:none"'}>
          <span aria-hidden="true">📞</span> <span data-i18n="card.call">${T_("card.call")}</span>
        </button>
        <div id="kluche-tour" class="modal-tour"></div>
      </div>
    </div>
  </div>

  <script type="application/json" id="kluche-listings">${jsonForScript(listings.map((l) => { const pin = listingPin(l); return { id: l.id, name: l.name, city: l.city, priceMinor: l.priceMinor, currency: l.currency, dealType: l.dealType, bedrooms: l.bedrooms, bathrooms: l.bathrooms, areaM2: l.areaM2, type: l.type, refCode: l.refCode, photos: (l.photos || []).filter((p) => safeUrl(p)), lat: pin ? pin.lat : null, lng: pin ? pin.lng : null }; }))}</script>

  ${mapEnabled ? `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>` : ""}
  <script>
  // Translation dict + initial language are injected server-side (see i18n.ts).
  var T = ${jsonForScript(DICT)};
  var LANG = ${JSON.stringify(L)};
  function t(key) { return (T[LANG] && T[LANG][key]) != null ? T[LANG][key] : (T.en[key] != null ? T.en[key] : key); }
  function applyLang() {
    // Only rewrite leaf elements: setting textContent on a node that wraps form
    // controls (e.g. a <label> around an <input>) would delete those controls.
    document.querySelectorAll("[data-i18n]").forEach((el) => { if (!el.firstElementChild) el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    document.documentElement.lang = LANG;
    document.querySelectorAll("#langMenu button").forEach((b) => b.classList.toggle("active", b.dataset.code === LANG));
  }
  function setLang(code) {
    if (!T[code]) return;
    LANG = code;
    // Persist in a cookie so the SERVER renders this language on the next request
    // (no English flash). Mirror to localStorage harmlessly.
    document.cookie = "kluche_lang=" + code + "; path=/; max-age=31536000; samesite=lax";
    try { localStorage.setItem("kluche_lang", code); } catch (e) {}
    applyLang();
  }
  document.querySelectorAll("#langMenu button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.code)));

  // Mobile burger menu
  var navBurger = document.getElementById("navBurger");
  var navLinks = document.getElementById("navLinks");
  if (navBurger && navLinks) {
    navBurger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navBurger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        navBurger.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Collapsible nav: hide on scroll-down, reveal on scroll-up.
  (function () {
    var nav = document.querySelector("nav.site");
    if (!nav) return;
    var lastY = window.scrollY || 0;
    var ticking = false;
    function update() {
      var y = window.scrollY || 0;
      if (y < 64) {
        nav.classList.remove("nav-hidden"); // always visible near the top
      } else if (y > lastY + 6) {
        nav.classList.add("nav-hidden"); // scrolling down
        if (navLinks) navLinks.classList.remove("open"); // close the mobile drawer too
      } else if (y < lastY - 6) {
        nav.classList.remove("nav-hidden"); // scrolling up
      }
      lastY = y;
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  })();

  // Language: the SERVER picked the initial LANG (from the kluche_lang cookie) and
  // decided whether to show this first-visit picker (showLangPicker → display:flex).
  // The pills/modal only need to write the cookie + live-switch the page.
  var langModal = document.getElementById("langModal");
  function pickLang(code) { setLang(code); if (langModal) langModal.style.display = "none"; }
  if (langModal) {
    langModal.querySelectorAll("[data-code]").forEach(function (b) {
      b.addEventListener("click", function () { pickLang(b.dataset.code); });
    });
    // Dismiss via backdrop → default to English (and remember, so we don't nag).
    langModal.addEventListener("click", function (e) { if (e.target === langModal) pickLang("en"); });
  }
  // Idempotent sync of the active pill / placeholders (text is already translated server-side).
  applyLang();

  // --- Hero search: chip popovers, Location multi-select, hidden-field sync ---
  (function () {
    var form = document.getElementById("hero-form");
    if (!form) return;
    var hidden = document.getElementById("hero-hidden");

    var MNE = [];
    try {
      var locRaw = document.getElementById("kluche-locations");
      MNE = JSON.parse(locRaw ? locRaw.textContent : "[]") || [];
    } catch (e) {}

    // locSel keyed by "City" or "City|Area"; seeded from the server-rendered hidden inputs.
    var locSel = {};
    hidden.querySelectorAll('input[name="loc"]').forEach(function (i) { if (i.value) locSel[i.value] = true; });

    function closeAll(except) {
      document.querySelectorAll(".pop").forEach(function (p) { if (p !== except) p.classList.remove("open"); });
    }
    function caret() { return ' <svg class="caret" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>'; }
    function clearX() { return ' <span class="clear" role="button" aria-label="Clear">✕</span>'; }
    function baseLabel(g) { return g === "beds" ? t("filter.beds") : g === "type" ? t("filter.type") : g === "deal" ? t("filter.listing") : t("filter.price"); }

    function setHidden(name, value) {
      var input = hidden.querySelector('input[name="' + name + '"]');
      if (!value) { if (input) input.remove(); return; }
      if (!input) { input = document.createElement("input"); input.type = "hidden"; input.name = name; hidden.appendChild(input); }
      input.value = value;
    }
    function syncLocHidden() {
      hidden.querySelectorAll('input[name="loc"]').forEach(function (i) { i.remove(); });
      Object.keys(locSel).forEach(function (k) {
        var input = document.createElement("input"); input.type = "hidden"; input.name = "loc"; input.value = k; hidden.appendChild(input);
      });
    }

    function setChip(g, text, active) {
      var chip = document.querySelector('.chip[data-pop="' + g + '"]');
      if (!chip) return;
      chip.classList.toggle("active", active);
      chip.innerHTML = '<span>' + text + '</span>' + (active ? clearX() : caret());
    }
    function clearGroup(g) {
      document.querySelectorAll('.opt[data-group="' + g + '"]').forEach(function (s) { s.classList.toggle("sel", s.dataset.value === ""); });
      setChip(g, baseLabel(g), false);
      if (g === "deal") setHidden("dealType", "");
      else if (g === "type") setHidden("type", "");
      else if (g === "beds") setHidden("bedrooms", "");
    }

    // chip open/close + clear (event delegation)
    document.addEventListener("click", function (e) {
      var clearBtn = e.target.closest(".clear");
      if (clearBtn && clearBtn.closest("#hero-form")) {
        e.stopPropagation(); e.preventDefault();
        var g = clearBtn.closest(".chip").dataset.pop;
        if (g === "loc") { locSel = {}; renderLoc(); syncLocChip(); syncLocHidden(); }
        else if (g === "price") { document.querySelector('#pop-price input[name="minPrice"]').value = ""; document.querySelector('#pop-price input[name="maxPrice"]').value = ""; syncPriceChip(); }
        else clearGroup(g);
        return;
      }
      var chip = e.target.closest(".chip[data-pop]");
      if (chip && chip.closest("#hero-form")) {
        e.stopPropagation(); e.preventDefault();
        var pop = document.getElementById("pop-" + chip.dataset.pop);
        var willOpen = !pop.classList.contains("open");
        closeAll(pop); pop.classList.toggle("open", willOpen);
        return;
      }
      if (e.target.closest(".pop")) return; // clicks inside a popover stay open
      closeAll(null);
    });

    // single-select option groups (deal / beds / type)
    document.querySelectorAll(".opt[data-group]").forEach(function (opt) {
      opt.addEventListener("click", function () {
        var g = opt.dataset.group, val = opt.dataset.value;
        document.querySelectorAll('.opt[data-group="' + g + '"]').forEach(function (s) { s.classList.remove("sel"); });
        opt.classList.add("sel");
        var active = val !== "";
        var label = !active ? baseLabel(g) : (g === "beds" ? (val + "+") : opt.textContent.trim());
        setChip(g, label, active);
        if (g === "deal") setHidden("dealType", val);
        else if (g === "type") setHidden("type", val);
        else if (g === "beds") setHidden("bedrooms", val);
        closeAll(null);
      });
    });

    // Price popover: keep its chip in sync (the inputs themselves are the form fields).
    var minEl = document.querySelector('#pop-price input[name="minPrice"]');
    var maxEl = document.querySelector('#pop-price input[name="maxPrice"]');
    function syncPriceChip() {
      var active = !!(minEl.value || maxEl.value);
      var label = !active ? baseLabel("price") : ("€" + (minEl.value || "0") + "–" + (maxEl.value || "∞"));
      setChip("price", label, active);
    }
    if (minEl) minEl.addEventListener("input", syncPriceChip);
    if (maxEl) maxEl.addEventListener("input", syncPriceChip);

    // Location: searchable multi-select (city or city/area)
    var listEl = document.getElementById("loc-list");
    var searchEl = document.getElementById("loc-search");
    function renderLoc() {
      var q = (searchEl.value || "").trim().toLowerCase();
      var html = "";
      MNE.forEach(function (c) {
        var cityMatch = c.city.toLowerCase().indexOf(q) >= 0;
        var areas = (c.areas || []).filter(function (a) { return !q || cityMatch || a.toLowerCase().indexOf(q) >= 0; });
        if (!q || cityMatch || areas.length) {
          var ck = locSel[c.city] ? "sel" : "";
          html += '<div class="loc-city loc-row ' + ck + '" data-key="' + esc(c.city) + '"><span class="loc-check">' + (ck ? "✓" : "") + '</span>' + esc(c.city) + '</div>';
          areas.forEach(function (a) {
            var key = c.city + "|" + a;
            var k = locSel[key] ? "sel" : "";
            html += '<div class="loc-area loc-row ' + k + '" data-key="' + esc(key) + '"><span class="loc-check">' + (k ? "✓" : "") + '</span>' + esc(a) + '</div>';
          });
        }
      });
      listEl.innerHTML = html || '<div class="loc-empty">' + esc(t("properties.empty")) + '</div>';
    }
    function syncLocChip() {
      var keys = Object.keys(locSel);
      var n = keys.length;
      if (n === 0) setChip("loc", t("filter.location"), false);
      else setChip("loc", n === 1 ? keys[0].replace("|", " / ") : (t("filter.location") + " · " + n), true);
    }
    // escape for innerHTML built above
    function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

    if (listEl) {
      listEl.addEventListener("click", function (e) {
        var row = e.target.closest(".loc-row"); if (!row) return;
        var key = row.dataset.key;
        if (locSel[key]) delete locSel[key]; else locSel[key] = true;
        renderLoc(); syncLocChip(); syncLocHidden();
      });
      searchEl.addEventListener("input", renderLoc);
      document.getElementById("loc-reset").addEventListener("click", function () { locSel = {}; renderLoc(); syncLocChip(); syncLocHidden(); });
      document.getElementById("loc-apply").addEventListener("click", function () { closeAll(null); });
      renderLoc();
    }
  })();

  (function () {
    var SLUG = ${jsonForScript(agency.slug)};
    var PHONE = ${jsonForScript(agency.phone ?? "")};
    var TEL_RE = /^[+0-9 ]+$/;
    var TOKEN_KEY = "kluche_visitor";

    // "Call" → log a phone-click (fire-and-forget) then dial. Used by both the
    // card icon buttons and the modal call button.
    function phoneClick(pid) {
      fetch("/a/" + encodeURIComponent(SLUG) + "/phone-click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: pid })
      }).catch(function () {});
      if (PHONE && TEL_RE.test(PHONE)) {
        window.location.href = "tel:" + PHONE.replace(/ /g, "");
      }
    }
    document.querySelectorAll(".card .call-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.stopPropagation(); phoneClick(btn.dataset.pid); });
    });

    // --- Listing detail modal ---------------------------------------------
    var byId = {};
    try {
      var raw = document.getElementById("kluche-listings");
      (JSON.parse(raw ? raw.textContent : "[]") || []).forEach(function (l) { byId[l.id] = l; });
    } catch (e) {}

    var modal = document.getElementById("kluche-modal");
    if (modal) {
      var galImg = modal.querySelector(".gal-img");
      var galPrev = modal.querySelector(".gal-prev");
      var galNext = modal.querySelector(".gal-next");
      var galCounter = modal.querySelector(".gal-counter");
      var elTag = modal.querySelector(".modal-tag");
      var elCode = modal.querySelector(".modal-code");
      var elTitle = modal.querySelector(".modal-title");
      var elPrice = modal.querySelector(".modal-price");
      var elCity = modal.querySelector(".modal-city");
      var elBadges = modal.querySelector(".modal-badges");
      var elType = modal.querySelector(".modal-type");
      var callBtn = modal.querySelector(".modal-call");
      var tourPanel = document.getElementById("kluche-tour");

      var photos = [];
      var photoIdx = 0;

      function fmtMoney(minor, currency) {
        var amount = (Number(minor) || 0) / 100;
        try {
          return new Intl.NumberFormat(LANG, { style: "currency", currency: currency || "EUR" }).format(amount);
        } catch (e) {
          return (currency || "EUR") + " " + amount.toFixed(2);
        }
      }
      function showPhoto() {
        if (!photos.length) {
          galImg.removeAttribute("src"); galImg.alt = "";
          galCounter.textContent = ""; galPrev.style.display = "none"; galNext.style.display = "none";
          return;
        }
        galImg.setAttribute("src", photos[photoIdx]);
        galCounter.textContent = (photoIdx + 1) + " / " + photos.length;
        var multi = photos.length > 1;
        galPrev.style.display = multi ? "" : "none";
        galNext.style.display = multi ? "" : "none";
      }
      function galStep(d) { if (photos.length) { photoIdx = (photoIdx + d + photos.length) % photos.length; showPhoto(); } }
      galPrev.addEventListener("click", function () { galStep(-1); });
      galNext.addEventListener("click", function () { galStep(1); });
      // Swipe the modal gallery on touch devices.
      (function () {
        var sx = 0, sy = 0;
        galImg.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        galImg.addEventListener("touchend", function (e) {
          var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) galStep(dx < 0 ? 1 : -1);
        }, { passive: true });
      })();

      function openModal(id) {
        var l = byId[id];
        if (!l) return;
        photos = Array.isArray(l.photos) ? l.photos.slice() : [];
        photoIdx = 0;
        galImg.alt = String(l.name || "");
        showPhoto();
        var isRent = l.dealType === "rent";
        elTag.textContent = isRent ? t("card.forRent") : t("card.forSale");
        elTag.className = "modal-tag " + (isRent ? "is-rent" : "is-sale");
        if (l.refCode) { elCode.textContent = String(l.refCode); elCode.hidden = false; }
        else { elCode.textContent = ""; elCode.hidden = true; }
        elTitle.textContent = String(l.name || "");
        var hasPrice = l.priceMinor != null && Number(l.priceMinor) > 0;
        elPrice.textContent = hasPrice ? (fmtMoney(l.priceMinor, l.currency) + (isRent ? t("card.perMonth") : "")) : t("card.priceOnRequest");
        elCity.textContent = String(l.city || "");
        elBadges.textContent = "";
        var parts = [];
        if (l.bedrooms != null) parts.push(l.bedrooms + " bd");
        if (l.bathrooms != null) parts.push(l.bathrooms + " ba");
        if (l.areaM2 != null) parts.push(l.areaM2 + " m²");
        parts.forEach(function (p) { var s = document.createElement("span"); s.textContent = p; elBadges.appendChild(s); });
        elType.textContent = l.type ? String(l.type) : "";
        callBtn.dataset.pid = id;
        renderTour(id);
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
      }
      function closeModal() {
        modal.style.display = "none";
        document.body.style.overflow = "";
      }

      callBtn.addEventListener("click", function () { phoneClick(callBtn.dataset.pid); });
      modal.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.style.display !== "none") closeModal(); });

      // Rewrite a full blob URL to our thumbnail endpoint (mirrors server thumbSrc).
      // String ops, not a regex: this code lives in a template literal, where regex
      // backslash-escapes would be stripped and break the script.
      function thumb(u) {
        u = u || "";
        if (u.indexOf("https://") !== 0) return u;
        var marker = ".blob.core.windows.net/";
        var i = u.indexOf(marker);
        if (i < 0) return u;
        var after = u.slice(i + marker.length); // "<container>/<path...>"
        var slash = after.indexOf("/");
        if (slash < 0) return u;
        return "/t/" + after.slice(slash + 1) + "?w=480";
      }
      document.querySelectorAll(".card[data-id]").forEach(function (card) {
        card.addEventListener("click", function (e) {
          if (e.target.closest(".call-btn") || e.target.closest(".card-arrow")) return;
          openModal(card.dataset.id);
        });
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(card.dataset.id); }
        });

        // Mini-gallery: arrows + swipe flip the card's cover through its photos
        // without opening the modal.
        var l = byId[card.dataset.id];
        var cardImg = card.querySelector("img.card-photo");
        var cardPhotos = l && Array.isArray(l.photos) ? l.photos : [];
        if (cardImg && cardPhotos.length > 1) {
          var ci = 0;
          function showCard(i) {
            ci = (i + cardPhotos.length) % cardPhotos.length;
            cardImg.src = thumb(cardPhotos[ci]);
            cardImg.dataset.full = cardPhotos[ci];
          }
          var prev = card.querySelector(".card-arrow-prev");
          var next = card.querySelector(".card-arrow-next");
          if (prev) prev.addEventListener("click", function (e) { e.stopPropagation(); showCard(ci - 1); });
          if (next) next.addEventListener("click", function (e) { e.stopPropagation(); showCard(ci + 1); });
          var sx = 0, sy = 0;
          cardImg.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
          cardImg.addEventListener("touchend", function (e) {
            var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { showCard(ci + (dx < 0 ? 1 : -1)); }
          }, { passive: true });
        }
      });

      // If a thumbnail fails to load, fall back to the original full-size photo.
      // Uses a data attribute + DOM assignment (no inline JS string) so a photo
      // URL can never break out into executable markup.
      document.querySelectorAll("img.card-photo[data-full]").forEach(function (img) {
        function fallback() { if (img.dataset.full && img.src !== img.dataset.full) img.src = img.dataset.full; }
        img.addEventListener("error", fallback, { once: true });
        if (img.complete && img.naturalWidth === 0) fallback();
      });

      // --- Tour / visitor auth panel --------------------------------------
      function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
      function setToken(v) { try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

      function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
      function mkLabel(textKey, input) {
        var lab = document.createElement("label");
        var span = document.createElement("span");
        span.textContent = t(textKey);
        lab.appendChild(span);
        lab.appendChild(input);
        return lab;
      }

      function renderTour(listingId) {
        clear(tourPanel);
        var token = getToken();
        if (token) {
          fetch("/api/visitor/me", { headers: { "Authorization": "Bearer " + token } })
            .then(function (r) {
              if (r.ok) return r.json().then(function (d) { renderTourForm(listingId, d && d.visitor ? d.visitor : null); });
              if (r.status === 401) { setToken(""); renderAuth(listingId); return; }
              renderAuth(listingId);
            })
            .catch(function () { renderAuth(listingId); });
        } else {
          renderAuth(listingId);
        }
      }

      function renderTourForm(listingId, visitor) {
        clear(tourPanel);
        var h = document.createElement("h4"); h.textContent = t("tour.heading"); tourPanel.appendChild(h);
        if (visitor && visitor.email) {
          var who = document.createElement("p"); who.className = "tour-signed";
          who.textContent = t("auth.signedInAs") + " " + visitor.email; tourPanel.appendChild(who);
        }
        var dateInput = document.createElement("input"); dateInput.type = "date";
        var noteInput = document.createElement("textarea"); noteInput.rows = 3;
        tourPanel.appendChild(mkLabel("tour.date", dateInput));
        tourPanel.appendChild(mkLabel("tour.note", noteInput));
        var go = document.createElement("button"); go.type = "button"; go.className = "tour-go"; go.textContent = t("tour.submit");
        tourPanel.appendChild(go);
        var msg = document.createElement("p"); msg.className = "tour-msg"; tourPanel.appendChild(msg);
        go.addEventListener("click", function () {
          msg.className = "tour-msg"; msg.textContent = "";
          if (!dateInput.value) { msg.className = "tour-msg err"; msg.textContent = t("tour.date"); return; }
          var token = getToken();
          go.disabled = true;
          fetch("/a/" + encodeURIComponent(SLUG) + "/tour", {
            method: "POST",
            headers: { "content-type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify({ propertyId: listingId, tourDate: dateInput.value, note: noteInput.value || undefined })
          }).then(function (r) {
            go.disabled = false;
            if (r.status === 201) { clear(tourPanel); var done = document.createElement("p"); done.className = "tour-msg"; done.textContent = t("tour.done"); tourPanel.appendChild(done); return; }
            if (r.status === 401) { setToken(""); renderAuth(listingId); return; }
            msg.className = "tour-msg err"; msg.textContent = "Error";
          }).catch(function () { go.disabled = false; msg.className = "tour-msg err"; msg.textContent = "Error"; });
        });
      }

      function renderAuth(listingId) {
        clear(tourPanel);
        var mode = "login"; // or "register"
        var h = document.createElement("h4"); h.textContent = t("auth.heading"); tourPanel.appendChild(h);
        var emailInput = document.createElement("input"); emailInput.type = "email"; emailInput.autocomplete = "email";
        var pwInput = document.createElement("input"); pwInput.type = "password"; pwInput.autocomplete = "current-password";
        var nameInput = document.createElement("input"); nameInput.type = "text"; nameInput.autocomplete = "name";
        var emailLabel = mkLabel("auth.email", emailInput);
        var pwLabel = mkLabel("auth.password", pwInput);
        var nameLabel = mkLabel("auth.name", nameInput);
        tourPanel.appendChild(emailLabel);
        tourPanel.appendChild(pwLabel);
        tourPanel.appendChild(nameLabel);
        var go = document.createElement("button"); go.type = "button"; go.className = "tour-go";
        tourPanel.appendChild(go);
        var toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "tour-toggle";
        tourPanel.appendChild(toggle);
        var msg = document.createElement("p"); msg.className = "tour-msg"; tourPanel.appendChild(msg);
        function sync() {
          go.textContent = mode === "register" ? t("auth.register") : t("auth.login");
          toggle.textContent = mode === "register" ? t("auth.toggleToLogin") : t("auth.toggleToRegister");
          nameLabel.style.display = mode === "register" ? "" : "none";
        }
        sync();
        toggle.addEventListener("click", function () { mode = mode === "register" ? "login" : "register"; msg.textContent = ""; msg.className = "tour-msg"; sync(); });
        go.addEventListener("click", function () {
          msg.className = "tour-msg"; msg.textContent = "";
          if (!emailInput.value || !pwInput.value) { msg.className = "tour-msg err"; msg.textContent = t("auth.email"); return; }
          var path = mode === "register" ? "/api/visitor/signup" : "/api/visitor/login";
          var body = { email: emailInput.value, password: pwInput.value };
          if (mode === "register" && nameInput.value) body.name = nameInput.value;
          go.disabled = true;
          fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
            .then(function (r) {
              return r.json().then(function (d) { return { status: r.status, data: d }; }).catch(function () { return { status: r.status, data: null }; });
            })
            .then(function (res) {
              go.disabled = false;
              if ((res.status === 200 || res.status === 201) && res.data && res.data.token) {
                setToken(res.data.token);
                renderTourForm(listingId, res.data.visitor || null);
                return;
              }
              msg.className = "tour-msg err";
              msg.textContent = res.status === 409 ? t("auth.toggleToLogin") : (res.status === 401 ? t("auth.login") : "Error");
            })
            .catch(function () { go.disabled = false; msg.className = "tour-msg err"; msg.textContent = "Error"; });
        });
      }

      ${mapEnabled ? `
      // --- Map view: List/Map toggle + Leaflet (area circles + approx pins) -
      // String ops only here (this is a template literal — regex literals would
      // have their escapes stripped and break the whole inline script).
      (function () {
        var listBtn = document.getElementById("view-list");
        var mapBtn = document.getElementById("view-map");
        var mapSection = document.getElementById("kluche-map");
        var grid = document.querySelector("#properties .grid");
        if (!listBtn || !mapBtn || !mapSection || !grid) return;

        // Build a ?loc= URL the server re-filters on (City or City|Area), keeping
        // the visitor's other active filters out of the way — same convention the
        // hero uses. encodeURIComponent keeps the pipe + spaces safe.
        function locHref(loc) { return "?loc=" + encodeURIComponent(loc); }

        var mapInited = false;
        var leafletMap = null;

        function initMap() {
          if (mapInited) return;
          if (typeof L === "undefined") return; // Leaflet may be slow / blocked
          mapInited = true;

          var areas = [];
          try {
            var ar = document.getElementById("kluche-map-areas");
            areas = JSON.parse(ar ? ar.textContent : "[]") || [];
          } catch (e) { areas = []; }

          // All listings with numeric coords, from the shared listings blob.
          var pinned = [];
          Object.keys(byId).forEach(function (k) {
            var l = byId[k];
            if (l && typeof l.lat === "number" && typeof l.lng === "number") pinned.push(l);
          });

          // Initial view: centre on the first area, else the first pin, else MNE.
          var center = [42.4411, 19.2627], zoom = 12;
          if (areas.length) { center = [areas[0].lat, areas[0].lng]; zoom = 13; }
          else if (pinned.length) { center = [pinned[0].lat, pinned[0].lng]; zoom = 13; }

          leafletMap = L.map("kluche-map-canvas", { scrollWheelZoom: true }).setView(center, zoom);
          L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd", maxZoom: 20, attribution: "© OpenStreetMap, © CARTO"
          }).addTo(leafletMap);

          var bounds = [];

          // Area circles + permanent label (name · count). Click → ?loc= filter.
          areas.forEach(function (a) {
            var circle = L.circle([a.lat, a.lng], {
              radius: 520, color: "#1F3A5C", weight: 1.5, fillColor: "#1F3A5C", fillOpacity: 0.12
            }).addTo(leafletMap);
            circle.bindTooltip(String(a.name) + " · " + String(a.count), {
              permanent: true, direction: "center", className: "area-label"
            });
            circle.on("click", function () { window.location.href = locHref(a.loc); });
            bounds.push([a.lat, a.lng]);
          });

          // Price pins. Pin click → open the listing modal (reused opener).
          pinned.forEach(function (l) {
            var isRent = l.dealType === "rent";
            var label = (l.priceMinor != null && Number(l.priceMinor) > 0)
              ? (fmtMoney(l.priceMinor, l.currency) + (isRent ? t("card.perMonth") : ""))
              : t("card.priceOnRequest");
            var span = document.createElement("span");
            span.className = "pin";
            span.textContent = label;
            var icon = L.divIcon({ className: "", html: span.outerHTML, iconSize: null });
            var marker = L.marker([l.lat, l.lng], { icon: icon }).addTo(leafletMap);
            marker.on("click", (function (id) { return function () { openModal(id); }; })(l.id));
            bounds.push([l.lat, l.lng]);
          });

          if (bounds.length > 1) {
            try { leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 }); } catch (e) {}
          }
        }

        function showMap() {
          listBtn.classList.remove("active");
          mapBtn.classList.add("active");
          grid.style.display = "none";
          mapSection.style.display = "";
          initMap();
          // Leaflet needs a size recalc once its container becomes visible.
          if (leafletMap) { try { leafletMap.invalidateSize(); } catch (e) {} }
        }
        function showList() {
          mapBtn.classList.remove("active");
          listBtn.classList.add("active");
          mapSection.style.display = "none";
          grid.style.display = "";
        }
        mapBtn.addEventListener("click", showMap);
        listBtn.addEventListener("click", showList);
      })();
      ` : ""}
    }
  })();
  </script>
</body>
</html>`;
}
