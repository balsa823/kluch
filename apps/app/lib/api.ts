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

export function formatMoney(minor: number, currency = "EUR"): string {
  const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
  const symbol = symbols[currency] ?? currency + " ";
  const amount = (minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${amount}`;
}
