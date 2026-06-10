import type { Agency } from "./agencies.js";

/**
 * Orthodox (Eastern) Easter Sunday for a given year, returned as a Gregorian
 * Date (UTC midnight). Uses the Meeus Julian computus, which yields the date on
 * the Julian calendar; we then add the Julian→Gregorian offset for that century
 * (13 days for years 1900–2099).
 *
 * Verified: 2024→2024-05-05, 2025→2025-04-20, 2026→2026-04-12.
 */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const day = ((d + e + 114) % 31) + 1;
  // Julian-calendar Easter (UTC midnight).
  const julian = Date.UTC(year, month - 1, day);
  // Julian→Gregorian offset: 13 days for the 1900–2099 range.
  const offsetDays = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  return new Date(julian + offsetDays * 24 * 60 * 60 * 1000);
}

export interface Holiday {
  date: string;
  name: string;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shift(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Montenegro national public holidays for the given year (YYYY-MM-DD). */
export function montenegroHolidays(year: number): Holiday[] {
  const easter = orthodoxEaster(year);
  return [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-01-02`, name: "New Year's Day" },
    { date: `${year}-01-06`, name: "Orthodox Christmas Eve" },
    { date: `${year}-01-07`, name: "Orthodox Christmas" },
    { date: ymd(shift(easter, -2)), name: "Orthodox Good Friday" },
    { date: ymd(shift(easter, 1)), name: "Orthodox Easter Monday" },
    { date: `${year}-05-01`, name: "Labour Day" },
    { date: `${year}-05-02`, name: "Labour Day" },
    { date: `${year}-05-21`, name: "Independence Day" },
    { date: `${year}-05-22`, name: "Independence Day" },
    { date: `${year}-07-13`, name: "Statehood Day" },
    { date: `${year}-07-14`, name: "Statehood Day" },
  ];
}

export interface OpenStatus {
  open: boolean;
  holiday?: string;
}

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const WEEKDAY_KEYS: Record<string, DayKey> = {
  Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun",
};

const HHMM = /^\d{2}:\d{2}$/;

/** The Podgorica-local date (YYYY-MM-DD), weekday key, and HH:MM for `now`. */
function localParts(now: Date): { date: string; weekday: DayKey; time: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Podgorica",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  // en-GB short weekday is e.g. "Mon"; hour can be "24" at midnight in some envs.
  let hour = get("hour");
  if (hour === "24") hour = "00";
  const time = `${hour}:${get("minute")}`;
  return { date, weekday: WEEKDAY_KEYS[get("weekday")] ?? "mon", time };
}

/**
 * Whether the agency is open at `now`, accounting for custom closures, national
 * holidays (when observed), and the weekday's business hours. Pure and
 * timezone-correct (Europe/Podgorica). Tolerates null/malformed jsonb.
 */
export function openStatus(
  agency: Pick<Agency, "businessHours" | "customClosures" | "observeHolidays">,
  now: Date,
): OpenStatus {
  const { date, weekday, time } = localParts(now);

  // 1. Custom closures (from..to inclusive, or single `from`).
  const closures = agency.customClosures;
  if (Array.isArray(closures)) {
    for (const c of closures) {
      if (!c || typeof c !== "object") continue;
      const from = (c as { from?: unknown }).from;
      if (typeof from !== "string") continue;
      const to = (c as { to?: unknown }).to;
      const end = typeof to === "string" && to ? to : from;
      if (date >= from && date <= end) {
        const label = (c as { label?: unknown }).label;
        return { open: false, holiday: typeof label === "string" && label ? label : "Closed" };
      }
    }
  }

  // 2. National holidays.
  if (agency.observeHolidays) {
    const year = Number(date.slice(0, 4));
    const hit = montenegroHolidays(year).find((h) => h.date === date);
    if (hit) return { open: false, holiday: hit.name };
  }

  // 3. Business hours for the weekday.
  const hours = agency.businessHours;
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return { open: false };
  const day = (hours as Record<string, unknown>)[weekday];
  if (!day || typeof day !== "object") return { open: false };
  const open = (day as { open?: unknown }).open;
  const close = (day as { close?: unknown }).close;
  if (typeof open !== "string" || typeof close !== "string" || !HHMM.test(open) || !HHMM.test(close)) {
    return { open: false };
  }
  return { open: time >= open && time < close };
}
