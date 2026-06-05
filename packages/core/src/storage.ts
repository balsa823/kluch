import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

export interface Storage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

/** Writes uploads to the local filesystem; URLs are served back via the app's /uploads route. */
export class LocalDiskStorage implements Storage {
  constructor(private baseDir: string, private publicBase = "/uploads") {}
  async upload(path: string, bytes: Uint8Array, _contentType: string): Promise<string> {
    const full = join(this.baseDir, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return `${this.publicBase}/${path}`;
  }
}

/** Test double: deterministic, no network. Records every upload. */
export class FakeStorage implements Storage {
  calls: { path: string; contentType: string; size: number }[] = [];
  async upload(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
    this.calls.push({ path, contentType, size: bytes.length });
    return `https://fake.storage/${path}`;
  }
}

/** Real implementation backed by Supabase Storage. */
export class SupabaseStorage implements Storage {
  constructor(
    private url = process.env.SUPABASE_URL!,
    private key = process.env.SUPABASE_SERVICE_KEY!,
    private bucket = process.env.STORAGE_BUCKET ?? "kluch",
  ) {}
  async upload(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
    const client = createClient(this.url, this.key);
    const storage = client.storage.from(this.bucket);
    const { error } = await storage.upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;
    return storage.getPublicUrl(path).data.publicUrl;
  }
}
