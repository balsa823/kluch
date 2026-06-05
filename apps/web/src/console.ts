import { formatMoney, type Agency, type AgencyUser, type Property } from "@kluch/core";

/** Minimal HTML-escaping for text interpolated into the console templates. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    :root { --navy: #1F3A5C; --cream: #F1ECE0; --teal: #4E827A; }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "Inter", system-ui, sans-serif;
      color: var(--navy); background: var(--cream);
    }
    h1, h2, h3 { font-family: "Plus Jakarta Sans", "Inter", sans-serif; }
    a { color: var(--teal); }
    header.console {
      background: var(--navy); color: #fff;
      padding: 1.25rem clamp(1rem, 4vw, 3rem);
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    }
    header.console h1 { margin: 0; font-size: 1.3rem; }
    header.console a { color: #fff; opacity: 0.85; font-size: 0.9rem; }
    main { padding: clamp(1rem, 4vw, 3rem); max-width: 960px; margin: 0 auto; }
    .panel { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(31,58,92,0.12); margin-bottom: 1.75rem; }
    label { display: flex; flex-direction: column; font-size: 0.8rem; gap: 0.25rem; margin-bottom: 0.75rem; }
    input, select {
      padding: 0.55rem 0.7rem; border: 1px solid #d8d2c4; border-radius: 8px; font: inherit;
    }
    button {
      background: var(--teal); color: #fff; border: 0;
      padding: 0.65rem 1.25rem; border-radius: 8px; font: inherit; cursor: pointer;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid #e7e1d3; font-size: 0.92rem; }
    th { color: #6b6557; font-weight: 600; }
    .status { text-transform: capitalize; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
    .error { background: #fbe4e4; color: #8a1f1f; padding: 0.7rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .login-card { background: #fff; border-radius: 14px; padding: 2rem; width: 100%; max-width: 360px; box-shadow: 0 4px 20px rgba(31,58,92,0.15); }
    .login-card h1 { margin: 0 0 1.25rem; font-size: 1.4rem; }
    .login-card button { width: 100%; margin-top: 0.5rem; }
  </style>`;

export function renderLogin(error = false): string {
  return `<!doctype html>
<html lang="en">
<head>${HEAD}<title>Kluch — Sign in</title></head>
<body>
  <div class="login-wrap">
    <form class="login-card" method="post" action="/login">
      <h1>Kluch Console</h1>
      ${error ? `<p class="error">Invalid email or password.</p>` : ""}
      <label>Email
        <input type="email" name="email" autocomplete="username" required />
      </label>
      <label>Password
        <input type="password" name="password" autocomplete="current-password" required />
      </label>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

function renderRow(p: Property): string {
  return `
        <tr>
          <td>${esc(p.name)}</td>
          <td>${esc(p.city)}</td>
          <td>${esc(formatMoney(p.priceMinor ?? 0, p.currency))}</td>
          <td class="status">${esc(p.status)}</td>
        </tr>`;
}

export function renderDashboard(agency: Agency, user: AgencyUser, listings: Property[]): string {
  const rows = listings.length
    ? listings.map(renderRow).join("")
    : `<tr><td colspan="4">No listings yet.</td></tr>`;
  return `<!doctype html>
<html lang="en">
<head>${HEAD}<title>${esc(agency.name)} — Console</title></head>
<body>
  <header class="console">
    <h1>${esc(agency.name)}</h1>
    <span>${esc(user.name ?? user.email)} · <a href="/logout">Log out</a></span>
  </header>
  <main>
    <section class="panel">
      <h2>Add listing</h2>
      <form method="post" action="/dashboard/listings">
        <label>Name<input type="text" name="name" required /></label>
        <label>Address<input type="text" name="address" required /></label>
        <div class="grid2">
          <label>City<input type="text" name="city" required /></label>
          <label>Price (minor units)<input type="number" name="priceMinor" required /></label>
          <label>Bedrooms<input type="number" name="bedrooms" /></label>
          <label>Type
            <select name="type">
              <option value="apartment">Apartment</option>
              <option value="studio">Studio</option>
              <option value="house">House</option>
            </select>
          </label>
        </div>
        <button type="submit">Add &amp; publish</button>
      </form>
    </section>
    <section class="panel">
      <h2>Listings</h2>
      <table>
        <thead><tr><th>Name</th><th>City</th><th>Price</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}
