import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

export interface Storage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

/** Pure helper: the public blob URL for an account/container/path. No network involved. */
export function publicUrl(account: string, container: string, path: string): string {
  return `https://${account}.blob.core.windows.net/${container}/${path}`;
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

/** Real implementation backed by Azure Blob Storage (Standard LRS, public-read container). */
export class AzureBlobStorage implements Storage {
  constructor(
    private account = process.env.AZURE_STORAGE_ACCOUNT!,
    private key = process.env.AZURE_STORAGE_KEY!,
    private container = process.env.AZURE_STORAGE_CONTAINER ?? "photos",
  ) {}
  async upload(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
    const credential = new StorageSharedKeyCredential(this.account, this.key);
    const service = new BlobServiceClient(
      `https://${this.account}.blob.core.windows.net`,
      credential,
    );
    const containerClient = service.getContainerClient(this.container);
    const blob = containerClient.getBlockBlobClient(path);
    await blob.uploadData(Buffer.from(bytes), {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return publicUrl(this.account, this.container, path);
  }
}
