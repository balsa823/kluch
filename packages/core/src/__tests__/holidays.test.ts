import { expect, test } from "vitest";
import { orthodoxEaster, montenegroHolidays, openStatus } from "../holidays.js";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

test("orthodoxEaster returns the Gregorian Orthodox Easter Sunday", () => {
  expect(ymd(orthodoxEaster(2024))).toBe("2024-05-05");
  expect(ymd(orthodoxEaster(2025))).toBe("2025-04-20");
  expect(ymd(orthodoxEaster(2026))).toBe("2026-04-12");
});

test("montenegroHolidays includes fixed and computed dates", () => {
  const dates = montenegroHolidays(2026).map((h) => h.date);
  expect(dates).toContain("2026-01-01"); // New Year
  expect(dates).toContain("2026-01-02");
  expect(dates).toContain("2026-01-06"); // Christmas Eve
  expect(dates).toContain("2026-01-07"); // Christmas
  expect(dates).toContain("2026-05-01"); // Labour
  expect(dates).toContain("2026-05-21"); // Independence
  expect(dates).toContain("2026-07-13"); // Statehood
  expect(dates).toContain("2026-07-14");
  // Easter 2026-04-12 → Good Friday Apr 10, Easter Monday Apr 13
  expect(dates).toContain("2026-04-10");
  expect(dates).toContain("2026-04-13");
  const gf = montenegroHolidays(2026).find((h) => h.date === "2026-04-10");
  expect(gf?.name).toMatch(/Good Friday/i);
});

const HOURS = {
  mon: { open: "09:00", close: "17:00" },
  tue: { open: "09:00", close: "17:00" },
  wed: { open: "09:00", close: "17:00" },
  thu: { open: "09:00", close: "17:00" },
  fri: { open: "09:00", close: "17:00" },
  sat: { open: "10:00", close: "14:00" },
  sun: null,
};

test("openStatus: open within business hours", () => {
  // 2026-06-08 is a Monday. 10:00 UTC = 12:00 Podgorica (CEST, +2).
  const r = openStatus(
    { businessHours: HOURS, customClosures: null, observeHolidays: false },
    new Date("2026-06-08T10:00:00Z"),
  );
  expect(r.open).toBe(true);
});

test("openStatus: closed outside business hours", () => {
  // 2026-06-08 Monday, 20:00 UTC = 22:00 Podgorica → after close
  const r = openStatus(
    { businessHours: HOURS, customClosures: null, observeHolidays: false },
    new Date("2026-06-08T20:00:00Z"),
  );
  expect(r.open).toBe(false);
});

test("openStatus: closed when the weekday hours are null", () => {
  // 2026-06-07 is a Sunday → null hours
  const r = openStatus(
    { businessHours: HOURS, customClosures: null, observeHolidays: false },
    new Date("2026-06-07T10:00:00Z"),
  );
  expect(r.open).toBe(false);
});

test("openStatus: closed on a custom closure date", () => {
  const r = openStatus(
    {
      businessHours: HOURS,
      customClosures: [{ from: "2026-06-08", label: "Team offsite" }],
      observeHolidays: false,
    },
    new Date("2026-06-08T10:00:00Z"),
  );
  expect(r.open).toBe(false);
  expect(r.holiday).toBe("Team offsite");
});

test("openStatus: closed on a custom closure range", () => {
  const r = openStatus(
    {
      businessHours: HOURS,
      customClosures: [{ from: "2026-06-08", to: "2026-06-10" }],
      observeHolidays: false,
    },
    new Date("2026-06-09T10:00:00Z"),
  );
  expect(r.open).toBe(false);
});

test("openStatus: closed on a national holiday when observeHolidays", () => {
  // 2026-07-13 Statehood Day (a Monday). 10:00 UTC daytime in Podgorica.
  const r = openStatus(
    { businessHours: HOURS, customClosures: null, observeHolidays: true },
    new Date("2026-07-13T10:00:00Z"),
  );
  expect(r.open).toBe(false);
  expect(r.holiday).toMatch(/Statehood/i);
});

test("openStatus: holiday ignored when observeHolidays is false", () => {
  const r = openStatus(
    { businessHours: HOURS, customClosures: null, observeHolidays: false },
    new Date("2026-07-13T10:00:00Z"),
  );
  expect(r.open).toBe(true);
});

test("openStatus: tolerates null/malformed jsonb without throwing", () => {
  expect(openStatus({ businessHours: null, customClosures: null, observeHolidays: false }, new Date()).open).toBe(false);
  const malformed = { businessHours: "garbage", customClosures: 42, observeHolidays: true } as never;
  expect(openStatus(malformed, new Date()).open).toBe(false);
});
