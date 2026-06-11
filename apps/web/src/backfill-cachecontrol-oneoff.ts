/**
 * One-off: set an immutable Cache-Control header on every blob already in the
 * photos container, so existing listing photos cache as aggressively as new
 * uploads (which get the header at upload time).
 *
 * Run once against prod with the Azure storage creds in the environment:
 *   AZURE_STORAGE_ACCOUNT=... AZURE_STORAGE_KEY=... AZURE_STORAGE_CONTAINER=photos \
 *     pnpm --filter @kluche/web exec tsx src/backfill-cachecontrol-oneoff.ts
 *
 * Safe to re-run: setHTTPHeaders is idempotent. NOT wired into the app.
 */
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

async function main(): Promise<void> {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  const container = process.env.AZURE_STORAGE_CONTAINER ?? "photos";
  if (!account || !key) {
    throw new Error("AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY are required");
  }

  const credential = new StorageSharedKeyCredential(account, key);
  const service = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential,
  );
  const containerClient = service.getContainerClient(container);

  let count = 0;
  for await (const blob of containerClient.listBlobsFlat()) {
    const client = containerClient.getBlockBlobClient(blob.name);
    // Preserve the existing content-type; only (re)set the cache-control header.
    const existingType = blob.properties.contentType;
    await client.setHTTPHeaders({
      blobCacheControl: IMMUTABLE_CACHE_CONTROL,
      blobContentType: existingType,
    });
    count++;
    if (count % 100 === 0) console.log(`...updated ${count} blobs`);
  }

  console.log(`Done. Set Cache-Control on ${count} blob(s) in "${container}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
