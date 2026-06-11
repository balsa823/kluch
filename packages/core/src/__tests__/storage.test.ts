import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { FakeStorage, LocalDiskStorage, IMMUTABLE_CACHE_CONTROL, publicUrl } from "../storage.js";

test("FakeStorage records the call (with cache-control) and returns a deterministic URL", async () => {
  const storage = new FakeStorage();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const url = await storage.upload("agency/logo.png", bytes, "image/png");
  expect(url).toBe("https://fake.storage/agency/logo.png");
  expect(storage.calls).toEqual([
    { path: "agency/logo.png", contentType: "image/png", size: 4, cacheControl: IMMUTABLE_CACHE_CONTROL },
  ]);
  expect(IMMUTABLE_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
});

test("FakeStorage download/exists round-trip from recorded uploads", async () => {
  const storage = new FakeStorage();
  const bytes = new Uint8Array([9, 8, 7]);
  await storage.upload("properties/x/photo-0.jpg", bytes, "image/jpeg");

  expect(await storage.exists("properties/x/photo-0.jpg")).toBe(true);
  expect(await storage.download("properties/x/photo-0.jpg")).toEqual(bytes);
  expect(storage.publicUrlFor("properties/x/photo-0.jpg")).toBe(
    "https://fake.storage/properties/x/photo-0.jpg",
  );

  expect(await storage.exists("nope/missing.jpg")).toBe(false);
  expect(await storage.download("nope/missing.jpg")).toBeNull();
});

test("LocalDiskStorage download/exists round-trip + publicUrlFor", async () => {
  const baseDir = join(tmpdir(), `kluch-storage-${randomUUID()}`);
  const storage = new LocalDiskStorage(baseDir);
  const bytes = new Uint8Array([4, 5, 6]);
  await storage.upload("properties/y/photo-0.jpg", bytes, "image/jpeg");

  expect(await storage.exists("properties/y/photo-0.jpg")).toBe(true);
  expect(await storage.download("properties/y/photo-0.jpg")).toEqual(bytes);
  expect(storage.publicUrlFor("properties/y/photo-0.jpg")).toBe("/uploads/properties/y/photo-0.jpg");

  expect(await storage.exists("properties/y/missing.jpg")).toBe(false);
  expect(await storage.download("properties/y/missing.jpg")).toBeNull();
});

test("LocalDiskStorage writes bytes to disk and returns a public URL", async () => {
  const baseDir = join(tmpdir(), `kluch-storage-${randomUUID()}`);
  const storage = new LocalDiskStorage(baseDir);
  const bytes = new Uint8Array([10, 20, 30]);
  const url = await storage.upload("properties/abc/photo-0.png", bytes, "image/png");
  expect(url).toBe("/uploads/properties/abc/photo-0.png");
  const onDisk = await readFile(join(baseDir, "properties/abc/photo-0.png"));
  expect(new Uint8Array(onDisk)).toEqual(bytes);
});

test("publicUrl builds the Azure Blob public URL (no network)", () => {
  expect(publicUrl("kluchprod", "photos", "properties/abc/photo-0.png")).toBe(
    "https://kluchprod.blob.core.windows.net/photos/properties/abc/photo-0.png",
  );
});
