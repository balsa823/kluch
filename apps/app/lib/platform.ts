export const DASHBOARD_HOSTS: Record<string, string> = {
  agency: "rent.kluche.me",
  law: "law.kluche.me",
};
export const DASHBOARD_ROUTES: Record<string, string> = {
  agency: "/agency",
  law: "/law",
};

function isKlucheHost(): boolean {
  return (
    typeof window !== "undefined" &&
    /\.kluche\.me$/.test(window.location.hostname)
  );
}

/**
 * Routes a freshly-authenticated partner to their first dashboard.
 * On *.kluche.me: cross-subdomain redirect with the token in the URL fragment.
 * Elsewhere (localhost / SWA default): in-app navigation (token already stored).
 */
export function routeToDashboard(
  token: string,
  dashboards: string[],
  navigate: (path: string) => void,
) {
  const key = dashboards[0];
  if (!key) return;
  if (isKlucheHost()) {
    const host = DASHBOARD_HOSTS[key];
    if (host && typeof window !== "undefined" && window.location.hostname !== host) {
      window.location.href = `https://${host}/#token=${encodeURIComponent(token)}`;
      return;
    }
  }
  navigate(DASHBOARD_ROUTES[key] ?? "/agency");
}
