import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

export interface Storage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Reads a blob's bytes, or null if it does not exist. */
  download(path: string): Promise<Uint8Array | null>;
  /** True if a blob exists at `path`. */
  exists(path: string): Promise<boolean>;
  /** The public URL for `path` in this storage (no network). */
  publicUrlFor(path: string): string;
}

/** Cache-Control applied to every uploaded image (and generated thumbnail). */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

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
  async download(path: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(join(this.baseDir, path)));
    } catch {
      return null;
    }
  }
  async exists(path: string): Promise<boolean> {
    try {
      await stat(join(this.baseDir, path));
      return true;
    } catch {
      return false;
    }
  }
  publicUrlFor(path: string): string {
    return `${this.publicBase}/${path}`;
  }
}

/** Test double: deterministic, no network. Records every upload + stores bytes. */
export class FakeStorage implements Storage {
  calls: { path: string; contentType: string; size: number; cacheControl: string }[] = [];
  /** path → bytes, backing download()/exists(). */
  blobs = new Map<string, Uint8Array>();
  async upload(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
    this.calls.push({ path, contentType, size: bytes.length, cacheControl: IMMUTABLE_CACHE_CONTROL });
    this.blobs.set(path, bytes);
    return `https://fake.storage/${path}`;
  }
  async download(path: string): Promise<Uint8Array | null> {
    return this.blobs.get(path) ?? null;
  }
  async exists(path: string): Promise<boolean> {
    return this.blobs.has(path);
  }
  publicUrlFor(path: string): string {
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
  async download(path: string): Promise<Uint8Array | null> {
    const client = createClient(this.url, this.key);
    const { data, error } = await client.storage.from(this.bucket).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }
  async exists(path: string): Promise<boolean> {
    return (await this.download(path)) !== null;
  }
  publicUrlFor(path: string): string {
    const client = createClient(this.url, this.key);
    return client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
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
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobCacheControl: IMMUTABLE_CACHE_CONTROL,
      },
    });
    return publicUrl(this.account, this.container, path);
  }
  private blockBlob(path: string) {
    const credential = new StorageSharedKeyCredential(this.account, this.key);
    const service = new BlobServiceClient(
      `https://${this.account}.blob.core.windows.net`,
      credential,
    );
    return service.getContainerClient(this.container).getBlockBlobClient(path);
  }
  async download(path: string): Promise<Uint8Array | null> {
    try {
      const buf = await this.blockBlob(path).downloadToBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      const code = (e as { statusCode?: number; code?: string });
      if (code?.statusCode === 404 || code?.code === "BlobNotFound") return null;
      throw e;
    }
  }
  async exists(path: string): Promise<boolean> {
    return this.blockBlob(path).exists();
  }
  publicUrlFor(path: string): string {
    return publicUrl(this.account, this.container, path);
  }
}
