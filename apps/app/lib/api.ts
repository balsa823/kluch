const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export const LISTING_STATUSES = [
  "published",
  "rented",
  "sold",
  "draft",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  area?: string | null;
  priceMinor: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  type: string | null;
  dealType: "rent" | "sale";
  status: string;
  photos: string[];
};

export type User = {
  id: string;
  email: string;
  role: string;
  agencyId: string;
};

export type DayHours = { open: string; close: string } | null;

export type BusinessHours = {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
};

export type CustomClosure = { from: string; to?: string; label?: string };

export type Socials = {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
};

export type Agency = {
  id: string;
  name: string;
  slug: string;
  colorPrimary: string;
  colorAccent: string;
  logoUrl: string | null;
  tagline: string | null;
  phone: string | null;
  heroHeadline: string | null;
  heroImageUrl: string | null;
  faviconUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  viber: string | null;
  address: string | null;
  mapUrl: string | null;
  aboutBlurb: string | null;
  footerName: string | null;
  notifyEmail: string | null;
  defaultLang: string | null;
  observeHolidays: boolean;
  businessHours: BusinessHours | null;
  customClosures: CustomClosure[] | null;
  socials: Socials | null;
};

export type CreateListingInput = {
  name: string;
  address: string;
  city: string;
  area?: string | null;
  priceMinor: number;
  bedrooms?: number;
  type?: string;
  dealType: "rent" | "sale";
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

export type UpdateListingInput = {
  name: string;
  address: string;
  city: string;
  area?: string | null;
  priceMinor: number;
  bedrooms?: number;
  bathrooms?: number;
  areaM2?: number;
  type: string;
  dealType: "rent" | "sale";
};

export function updateListing(
  token: string,
  id: string,
  input: UpdateListingInput,
): Promise<Property> {
  return request(`/api/listings/${id}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(input),
  });
}

export function setListingStatus(
  token: string,
  id: string,
  status: ListingStatus,
): Promise<Property> {
  return request(`/api/listings/${id}/status`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ status }),
  });
}

export async function deleteListing(token: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/listings/${id}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok) {
    const message =
      ((await res.json().catch(() => ({}))) as { error?: string }).error ??
      res.statusText;
    throw new Error(message);
  }
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

/** Partial patch of any editable agency settings field (validated server-side). */
export type SettingsPatch = Partial<{
  colorPrimary: string;
  colorAccent: string;
  tagline: string | null;
  phone: string | null;
  heroHeadline: string | null;
  heroImageUrl: string | null;
  faviconUrl: string | null;
  email: string | null;
  whatsapp: string | null;
  viber: string | null;
  address: string | null;
  mapUrl: string | null;
  aboutBlurb: string | null;
  footerName: string | null;
  notifyEmail: string | null;
  defaultLang: string | null;
  observeHolidays: boolean;
  businessHours: BusinessHours | null;
  customClosures: CustomClosure[] | null;
  socials: Socials | null;
}>;

export function updateAgencyConfig(
  token: string,
  agencyId: string,
  cfg: AgencyConfig | SettingsPatch,
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

export type Lead = {
  id: string;
  kind: "inquiry" | "tour" | "phone_click";
  propertyId: string | null;
  propertyName: string | null;
  refCode: string | null;
  name: string | null;
  contact: string | null;
  message: string | null;
  tourDate: string | null;
  status: string;
  createdAt: string;
};

export async function listLeads(
  token: string,
  kind: "inquiry" | "tour" | "phone_click",
): Promise<Lead[]> {
  const data = await request<{ leads: Lead[] }>(
    `/api/agency/leads?kind=${kind}`,
    { method: "GET", headers: headers(token) },
  );
  return data.leads;
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
