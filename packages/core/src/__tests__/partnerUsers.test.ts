import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "@kluche/db/test-helpers";
import { createPartnerUser, verifyPartnerUser, getPartnerUserById, dashboardKeys } from "../partnerUsers.js";

beforeEach(async () => { await resetDb(); });

describe("partnerUsers", () => {
  it("creates and verifies by password", async () => {
    const u = await createPartnerUser(db, {
      email: "P@Agency.me", password: "secret123",
      dashboards: { agency: { agencyId: "00000000-0000-0000-0000-000000000001" } },
    });
    expect(u.email).toBe("p@agency.me");
    expect(await verifyPartnerUser(db, "p@agency.me", "secret123")).toMatchObject({ id: u.id });
    // login is case-insensitive / trims, matching the normalized stored email
    expect(await verifyPartnerUser(db, " P@Agency.me ", "secret123")).toMatchObject({ id: u.id });
    expect(await verifyPartnerUser(db, "p@agency.me", "wrong")).toBeNull();
    expect(await getPartnerUserById(db, u.id)).toMatchObject({ id: u.id });
  });
  it("dashboardKeys returns the map keys", () => {
    expect(dashboardKeys({ agency: { agencyId: "x" } })).toEqual(["agency"]);
    expect(dashboardKeys({})).toEqual([]);
  });
});
