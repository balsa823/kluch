import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "@kluche/db/test-helpers";
import { createVisitor, verifyVisitor, getVisitorById } from "../visitors.js";

beforeEach(async () => { await resetDb(); });

describe("visitors", () => {
  it("creates and verifies by password", async () => {
    const v = await createVisitor(db, { email: "V@Example.com", name: "Vera", password: "secret123" });
    expect(v.email).toBe("v@example.com");
    expect(v.name).toBe("Vera");
    // login is case-insensitive / trims, matching the normalized stored email
    expect(await verifyVisitor(db, "v@example.com", "secret123")).toMatchObject({ id: v.id });
    expect(await verifyVisitor(db, " V@Example.com ", "secret123")).toMatchObject({ id: v.id });
    // wrong password → null
    expect(await verifyVisitor(db, "v@example.com", "wrong")).toBeNull();
    // unknown email → null
    expect(await verifyVisitor(db, "nobody@example.com", "secret123")).toBeNull();
  });

  it("returns null when verifying a visitor with no password hash", async () => {
    await createVisitor(db, { email: "nopass@example.com" });
    expect(await verifyVisitor(db, "nopass@example.com", "anything")).toBeNull();
  });

  it("getVisitorById returns the visitor or null", async () => {
    const v = await createVisitor(db, { email: "byid@example.com", password: "secret123" });
    expect(await getVisitorById(db, v.id)).toMatchObject({ id: v.id, email: "byid@example.com" });
    expect(await getVisitorById(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
