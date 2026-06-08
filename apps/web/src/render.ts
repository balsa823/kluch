import { formatMoney, type Agency, type Property, type SearchFilters } from "@kluche/core";

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

/**
 * A URL safe to embed inside a CSS `url('...')`. esc() does not escape `'`/`)`,
 * so a crafted (e.g. scraped) photo URL could break out of the CSS string and
 * inject rules — reject any URL containing quotes, parens, backslash or whitespace.
 */
function cssUrl(u: unknown): string {
  const s = safeUrl(u);
  return /["'()\\\s]/.test(s) ? "" : s;
}

/** Renders a single property card: photo, deal price, city, badge row and type. */
function renderCard(listing: Property): string {
  const photo = safeUrl(listing.photos?.[0]);
  const image = photo
    ? `<img class="card-photo" src="${esc(photo)}" alt="${esc(listing.name)}" loading="lazy" />`
    : `<div class="card-photo card-photo--empty"></div>`;

  const price = esc(formatMoney(listing.priceMinor ?? 0, listing.currency));
  const isRent = listing.dealType === "rent";
  const priceBlock = isRent
    ? `<p class="card-price">${price}<span class="card-permo" data-i18n="card.perMonth"> / mo</span></p>
          <span class="card-tag card-tag--rent" data-i18n="card.forRent">For rent</span>`
    : `<p class="card-price">${price}</p>
          <span class="card-tag card-tag--sale" data-i18n="card.forSale">For sale</span>`;

  const badges: string[] = [];
  if (listing.bedrooms != null) badges.push(`<span>${esc(listing.bedrooms)} bd</span>`);
  if (listing.bathrooms != null) badges.push(`<span>${esc(listing.bathrooms)} ba</span>`);
  if (listing.areaM2 != null) badges.push(`<span>${esc(listing.areaM2)} m²</span>`);
  const badgeRow = badges.length
    ? `<div class="card-badges">${badges.join('<i aria-hidden="true">·</i>')}</div>`
    : "";

  const typeLabel = listing.type ? `<p class="card-type">${esc(listing.type)}</p>` : "";

  return `
      <article class="card">
        ${image}
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
function pageHref(filters: SearchFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  if (filters.dealType) params.set("dealType", filters.dealType);
  if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  if (filters.bedrooms !== undefined) params.set("bedrooms", String(filters.bedrooms));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return esc(qs ? `?${qs}` : "?");
}

export function renderAgencySite(
  agency: Agency,
  listings: Property[],
  filters: SearchFilters = {},
  opts: { sent?: boolean; page?: number; pageSize?: number; total?: number } = {},
): string {
  const logoUrl = safeUrl(agency.logoUrl);
  const logo = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(agency.name)}" />`
    : "";

  const slug = esc(agency.slug);
  const heroTitle = esc(agency.tagline || agency.name);

  const heroPhoto = cssUrl(listings[0]?.photos?.[0]);
  const heroStyle = heroPhoto
    ? `background-image: linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.5)), url('${heroPhoto}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, var(--color-primary), #11203a);`;

  const sel = (v: "rent" | "sale" | "") =>
    (filters.dealType ?? "") === v ? " selected" : "";
  const tabActive = (v: "" | "rent" | "sale") =>
    (filters.dealType ?? "") === v ? "tab is-active" : "tab";

  const cards = listings.length
    ? listings.map(renderCard).join("")
    : `<p class="empty" data-i18n="properties.empty">No properties match your search.</p>`;

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
            ? `<a class="pager-link pager-prev" href="${pageHref(filters, page - 1)}" data-i18n="pager.prev">Previous</a>`
            : ""
        }
        <span class="pager-info">Page ${esc(page)} of ${esc(pages)}</span>
        ${
          page < pages
            ? `<a class="pager-link pager-next" href="${pageHref(filters, page + 1)}" data-i18n="pager.next">Next</a>`
            : ""
        }
      </nav>`
      : "";

  const contactInner = opts.sent
    ? `<p class="thankyou" data-i18n="contact.thankyou">Thank you — we'll be in touch shortly.</p>`
    : `<form class="contact-form" method="post" action="/a/${slug}/inquiry">
          <label class="hp" aria-hidden="true">Company
            <input type="text" name="company" tabindex="-1" autocomplete="off" />
          </label>
          <label data-i18n="contact.name">Your name
            <input type="text" name="name" maxlength="120" required />
          </label>
          <label data-i18n="contact.contact">Email or phone
            <input type="text" name="contact" maxlength="200" required />
          </label>
          <label data-i18n="contact.message">Message
            <textarea name="message" rows="4" maxlength="2000"></textarea>
          </label>
          <button type="submit" data-i18n="contact.submit">Send request</button>
        </form>`;

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
      --color-ink: #1F2937;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", system-ui, sans-serif;
      color: var(--color-ink);
      background: var(--color-cream);
    }
    h1, h2, h3, .logo-text { font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
    a { color: inherit; }

    /* Nav */
    nav.site {
      position: sticky; top: 0; z-index: 30;
      display: flex; align-items: center; gap: 1rem;
      padding: 0.75rem clamp(1rem, 4vw, 2.5rem);
      background: var(--color-primary);
      color: #fff;
      border-bottom: 3px solid var(--color-accent);
    }
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

    /* Hero */
    header.hero {
      ${heroStyle}
      color: #fff;
      padding: clamp(3rem, 12vw, 7rem) clamp(1rem, 4vw, 2.5rem) clamp(4rem, 9vw, 6rem);
      text-align: center;
    }
    header.hero h1 { font-size: clamp(2rem, 6vw, 3.4rem); margin: 0 auto 1.5rem; max-width: 18ch; text-shadow: 0 2px 16px rgba(0,0,0,.4); }
    form.search {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 0.6rem; align-items: end;
      background: rgba(255,255,255,0.96);
      color: var(--color-ink);
      padding: 1rem; border-radius: 14px;
      max-width: 880px; margin: 0 auto;
      box-shadow: 0 12px 40px rgba(0,0,0,.25);
    }
    form.search label { display: flex; flex-direction: column; font-size: 0.72rem; gap: 0.2rem; text-align: left; text-transform: uppercase; letter-spacing: .04em; color: #6b6557; }
    form.search input, form.search select {
      padding: 0.5rem 0.6rem; border: 1px solid #d8d2c4; border-radius: 8px; font: inherit; background: #fff;
    }
    form.search button {
      background: var(--color-accent); color: #fff; border: 0;
      padding: 0.62rem 1rem; border-radius: 8px; font: inherit; cursor: pointer; font-weight: 600;
    }

    main { padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2.5rem); max-width: 1180px; margin: 0 auto; }
    section { scroll-margin-top: 80px; }
    .section-head { margin: 0 0 1.2rem; }

    /* Filter tabs */
    .tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .tabs a {
      text-decoration: none; padding: 0.45rem 0.95rem; border-radius: 999px;
      border: 1px solid var(--color-accent); color: var(--color-primary); font-size: 0.9rem;
    }
    .tabs a.is-active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

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
      background: #fff; border-radius: 14px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(31, 58, 92, 0.12);
      transition: transform .18s ease, box-shadow .18s ease;
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(31, 58, 92, 0.18); }
    .card-photo { width: 100%; height: 180px; object-fit: cover; display: block; }
    .card-photo--empty { background: var(--color-accent); opacity: 0.25; }
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
    .empty { color: #6b6557; }

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

    footer.site { text-align: center; padding: 2.5rem 1rem; color: #6b6557; font-size: 0.85rem; }
  </style>
</head>
<body>
  <nav class="site">
    <a class="brand" href="#top">
      ${logo}
      <span>${esc(agency.name)}</span>
    </a>
    <div class="nav-links">
      <a href="#properties" data-i18n="nav.properties">Properties</a>
      <a href="#about" data-i18n="nav.about">About</a>
      <a href="#contact" data-i18n="nav.contact">Contact</a>
      <div class="langmenu" id="langMenu">
        <button data-code="en">EN</button>
        <button data-code="sr">SR</button>
        <button data-code="ru">RU</button>
        <button data-code="tr">TR</button>
      </div>
    </div>
  </nav>

  <header class="hero" id="top">
    <h1>${heroTitle}</h1>
    <form class="search" method="get">
      <label data-i18n="search.city">City
        <input type="text" name="city" value="${attr(filters.city)}" data-i18n-ph="search.cityPh" placeholder="Any city" />
      </label>
      <label data-i18n="search.dealType">Type
        <select name="dealType">
          <option value=""${sel("")} data-i18n="search.dealAny">Any</option>
          <option value="rent"${sel("rent")} data-i18n="search.dealRent">Rent</option>
          <option value="sale"${sel("sale")} data-i18n="search.dealSale">Sale</option>
        </select>
      </label>
      <label data-i18n="search.minPrice">Min price
        <input type="number" name="minPrice" value="${attr(filters.minPrice)}" />
      </label>
      <label data-i18n="search.maxPrice">Max price
        <input type="number" name="maxPrice" value="${attr(filters.maxPrice)}" />
      </label>
      <label data-i18n="search.bedrooms">Bedrooms
        <input type="number" name="bedrooms" value="${attr(filters.bedrooms)}" />
      </label>
      <button type="submit" data-i18n="search.submit">Search</button>
    </form>
  </header>

  <main>
    <section id="properties">
      <h2 class="section-head" data-i18n="properties.heading">Available properties</h2>
      <div class="tabs">
        <a href="?" class="${tabActive("")}" data-i18n="tab.all">All</a>
        <a href="?dealType=rent" class="${tabActive("rent")}" data-i18n="tab.rent">For rent</a>
        <a href="?dealType=sale" class="${tabActive("sale")}" data-i18n="tab.sale">For sale</a>
      </div>
      <div class="grid">${cards}</div>
      ${pager}
    </section>

    <section class="about" id="about">
      <h2>${esc(agency.name)}</h2>
      ${agency.tagline ? `<p>${esc(agency.tagline)}</p>` : ""}
      <p data-i18n="about.body">We help you find the right home — to rent or to buy. Get in touch and our team will guide you, in your language, every step of the way.</p>
    </section>

    <section class="contact" id="contact">
      <h2 class="section-head" data-i18n="contact.heading">Request info / book a viewing</h2>
      ${contactInner}
    </section>
  </main>

  <footer class="site">${esc(agency.name)} · <span data-i18n="footer.powered">Powered by Kluche</span></footer>

  <script>
  // SR/RU/TR are first-pass translations — review with a native speaker before launch.
  const T = {
    en: {
      "nav.properties":"Properties","nav.about":"About","nav.contact":"Contact",
      "search.city":"City","search.cityPh":"Any city","search.dealType":"Type","search.dealAny":"Any","search.dealRent":"Rent","search.dealSale":"Sale",
      "search.minPrice":"Min price","search.maxPrice":"Max price","search.bedrooms":"Bedrooms","search.submit":"Search",
      "tab.all":"All","tab.rent":"For rent","tab.sale":"For sale",
      "pager.prev":"Previous","pager.next":"Next",
      "card.forRent":"For rent","card.forSale":"For sale","card.perMonth":" / mo",
      "properties.heading":"Available properties","properties.empty":"No properties match your search.",
      "about.body":"We help you find the right home — to rent or to buy. Get in touch and our team will guide you, in your language, every step of the way.",
      "contact.heading":"Request info / book a viewing","contact.name":"Your name","contact.contact":"Email or phone","contact.message":"Message","contact.submit":"Send request",
      "contact.thankyou":"Thank you — we'll be in touch shortly.",
      "footer.powered":"Powered by Kluche"
    },
    sr: {
      "nav.properties":"Nekretnine","nav.about":"O nama","nav.contact":"Kontakt",
      "search.city":"Grad","search.cityPh":"Bilo koji grad","search.dealType":"Tip","search.dealAny":"Sve","search.dealRent":"Najam","search.dealSale":"Prodaja",
      "search.minPrice":"Min. cijena","search.maxPrice":"Maks. cijena","search.bedrooms":"Spavaće sobe","search.submit":"Pretraga",
      "tab.all":"Sve","tab.rent":"Za najam","tab.sale":"Za prodaju",
      "pager.prev":"Prethodno","pager.next":"Sljedeće",
      "card.forRent":"Za najam","card.forSale":"Za prodaju","card.perMonth":" / mj.",
      "properties.heading":"Dostupne nekretnine","properties.empty":"Nema nekretnina za vašu pretragu.",
      "about.body":"Pomažemo vam da pronađete pravi dom — za najam ili kupovinu. Javite nam se i naš tim će vas voditi, na vašem jeziku, na svakom koraku.",
      "contact.heading":"Zatražite informacije / zakažite obilazak","contact.name":"Vaše ime","contact.contact":"E-pošta ili telefon","contact.message":"Poruka","contact.submit":"Pošalji upit",
      "contact.thankyou":"Hvala — javićemo vam se uskoro.",
      "footer.powered":"Pokreće Kluche"
    },
    ru: {
      "nav.properties":"Объекты","nav.about":"О нас","nav.contact":"Контакты",
      "search.city":"Город","search.cityPh":"Любой город","search.dealType":"Тип","search.dealAny":"Все","search.dealRent":"Аренда","search.dealSale":"Продажа",
      "search.minPrice":"Цена от","search.maxPrice":"Цена до","search.bedrooms":"Спальни","search.submit":"Поиск",
      "tab.all":"Все","tab.rent":"Аренда","tab.sale":"Продажа",
      "pager.prev":"Назад","pager.next":"Вперёд",
      "card.forRent":"Аренда","card.forSale":"Продажа","card.perMonth":" / мес.",
      "properties.heading":"Доступные объекты","properties.empty":"Нет объектов по вашему запросу.",
      "about.body":"Мы поможем найти подходящее жильё — в аренду или для покупки. Свяжитесь с нами, и наша команда поможет вам на вашем языке на каждом шаге.",
      "contact.heading":"Запросить информацию / записаться на просмотр","contact.name":"Ваше имя","contact.contact":"Эл. почта или телефон","contact.message":"Сообщение","contact.submit":"Отправить запрос",
      "contact.thankyou":"Спасибо — мы скоро свяжемся с вами.",
      "footer.powered":"Работает на Kluche"
    },
    tr: {
      "nav.properties":"İlanlar","nav.about":"Hakkımızda","nav.contact":"İletişim",
      "search.city":"Şehir","search.cityPh":"Tüm şehirler","search.dealType":"Tür","search.dealAny":"Tümü","search.dealRent":"Kiralık","search.dealSale":"Satılık",
      "search.minPrice":"En düşük fiyat","search.maxPrice":"En yüksek fiyat","search.bedrooms":"Yatak odası","search.submit":"Ara",
      "tab.all":"Tümü","tab.rent":"Kiralık","tab.sale":"Satılık",
      "pager.prev":"Önceki","pager.next":"Sonraki",
      "card.forRent":"Kiralık","card.forSale":"Satılık","card.perMonth":" / ay",
      "properties.heading":"Mevcut ilanlar","properties.empty":"Aramanıza uygun ilan yok.",
      "about.body":"Doğru evi bulmanıza yardımcı oluyoruz — kiralık ya da satılık. Bize ulaşın, ekibimiz her adımda kendi dilinizde size yardımcı olsun.",
      "contact.heading":"Bilgi isteyin / randevu alın","contact.name":"Adınız","contact.contact":"E-posta veya telefon","contact.message":"Mesaj","contact.submit":"Gönder",
      "contact.thankyou":"Teşekkürler — en kısa sürede sizinle iletişime geçeceğiz.",
      "footer.powered":"Kluche tarafından sağlanır"
    }
  };
  let LANG = "en";
  function t(key) { return (T[LANG] && T[LANG][key]) != null ? T[LANG][key] : (T.en[key] != null ? T.en[key] : key); }
  function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
    document.documentElement.lang = LANG;
    document.querySelectorAll("#langMenu button").forEach((b) => b.classList.toggle("active", b.dataset.code === LANG));
  }
  function setLang(code) {
    if (!T[code]) return;
    LANG = code;
    try { localStorage.setItem("kluche_lang", code); } catch (e) {}
    applyLang();
  }
  document.querySelectorAll("#langMenu button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.code)));
  let saved = "en";
  try { saved = localStorage.getItem("kluche_lang") || "en"; } catch (e) {}
  setLang(T[saved] ? saved : "en");
  </script>
</body>
</html>`;
}
