import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { FakeStorage, LocalDiskStorage } from "../storage.js";

test("FakeStorage records the call and returns a deterministic URL", async () => {
  const storage = new FakeStorage();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const url = await storage.upload("agency/logo.png", bytes, "image/png");
  expect(url).toBe("https://fake.storage/agency/logo.png");
  expect(storage.calls).toEqual([
    { path: "agency/logo.png", contentType: "image/png", size: 4 },
  ]);
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
