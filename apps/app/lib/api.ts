const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  priceMinor: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  type: string | null;
  status: string;
  photos: string[];
};

export type User = {
  id: string;
  email: string;
  role: string;
  agencyId: string;
};

export type Agency = {
  id: string;
  name: string;
  slug: string;
  colorPrimary: string;
  colorAccent: string;
  logoUrl: string | null;
  tagline: string | null;
};

export type CreateListingInput = {
  name: string;
  address: string;
  city: string;
  priceMinor: number;
  bedrooms?: number;
  type?: string;
};

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? res.statusText;
    } catch {
      // non-JSON body; fall back to statusText
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function login(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return request("/api/auth/login", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
}

export function me(token: string): Promise<{ user: User; agency: Agency }> {
  return request("/api/me", {
    method: "GET",
    headers: headers(token),
  });
}

export type PartnerUser = { id: string; email: string; name: string | null };

export type PartnerLogin = {
  token: string;
  dashboards: string[];
  user: PartnerUser;
};

export function platformLogin(
  email: string,
  password: string,
): Promise<PartnerLogin> {
  return request("/api/platform/login", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
}

export function platformMe(token: string): Promise<{
  user: PartnerUser;
  dashboards: string[];
  agency: Agency | null;
}> {
  return request("/api/platform/me", {
    method: "GET",
    headers: headers(token),
  });
}

export async function listListings(token: string): Promise<Property[]> {
  const data = await request<{ listings: Property[] }>("/api/listings", {
    method: "GET",
    headers: headers(token),
  });
  return data.listings;
}

export function createListing(
  token: string,
  input: CreateListingInput,
): Promise<Property> {
  return request("/api/listings", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(input),
  });
}

/** Imports a listing from an external URL, creating it under the caller's agency. */
export function importListing(token: string, url: string): Promise<Property> {
  return request("/api/listings/import", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ url }),
  });
}

/** Resolve a stored media path (e.g. "/uploads/...") against the API origin. */
export function mediaUrl(path: string): string {
  if (!path) return path;
  return /^https?:\/\//i.test(path) ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export type AgencyConfig = {
  colorPrimary: string;
  colorAccent: string;
  tagline: string | null;
};

export function updateAgencyConfig(
  token: string,
  agencyId: string,
  cfg: AgencyConfig,
): Promise<Agency> {
  return request(`/api/agency/${agencyId}/config`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(cfg),
  });
}

export async function uploadAgencyLogo(
  token: string,
  agencyId: string,
  file: File,
): Promise<{ logoUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/agency/${agencyId}/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(
      ((await res.json().catch(() => ({}))) as { error?: string }).error ??
        res.statusText,
    );
  }
  return res.json() as Promise<{ logoUrl: string }>;
}

export function agencySiteUrl(slug: string): string {
  const origin = /^https?:\/\/[^/]+/.exec(BASE)?.[0] ?? "";
  const host = /kluche\.me|azurecontainerapps\.io/.test(origin)
    ? "https://kluche.me"
    : origin;
  return `${host}/a/${slug}`;
}

export function formatMoney(minor: number, currency = "EUR"): string {
  const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  const symbol = symbols[currency] ?? currency + " ";
  const amount = (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${amount}`;
}
