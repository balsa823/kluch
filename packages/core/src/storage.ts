import { createClient } from "@supabase/supabase-js";

export interface Storage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
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
