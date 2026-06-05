import { expect, test } from "vitest";
import { FakeStorage } from "../storage.js";

test("FakeStorage records the call and returns a deterministic URL", async () => {
  const storage = new FakeStorage();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const url = await storage.upload("agency/logo.png", bytes, "image/png");
  expect(url).toBe("https://fake.storage/agency/logo.png");
  expect(storage.calls).toEqual([
    { path: "agency/logo.png", contentType: "image/png", size: 4 },
  ]);
});
