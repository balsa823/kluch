import { beforeAll, afterAll, expect, test, vi } from "vitest";
import { db, client, migrateTestDb, resetDb } from "@kluche/db/test-helpers";
import { createAgency } from "../agencies.js";
import { FakeStorage } from "../storage.js";
import {
  bestate4Parser,
  fetchAgentListings,
  importAgentListings,
  importListing,
  mapBestate4,
  PARSERS,
  pickParser,
  unwrapFirestore,
  type ListingParser,
} from "../importers.js";
import { searchProperties } from "../listings.js";

// A representative Firestore typed-value `fields` object.
const FIXTURE = {
  title: { stringValue: "Cozy 1BR near the river" },
  monthlyRent: { integerValue: "450" },
  bedrooms: { integerValue: "1" },
  bathrooms: { integerValue: "1" },
  area: { integerValue: "46" },
  price: { integerValue: "0" },
  listingType: { stringValue: "FOR_RENT" },
  type: { stringValue: "Residential" },
  locationDisplay: { stringValue: "Podgorica, Ljubović, Montenegro" },
  montenegroLocation: {
    mapValue: {
      fields: {
        city: { stringValue: "podgorica" },
        neighborhood: { stringValue: "ljubovic" },
        state: { stringValue: "Crna Gora" },
      },
    },
  },
  images: {
    arrayValue: {
      values: [
        { stringValue: "https://firebasestorage.googleapis.com/one.jpg" },
        { stringValue: "https://firebasestorage.googleapis.com/two.jpg" },
      ],
    },
  },
  features: {
    arrayValue: { values: [{ stringValue: "Parking" }] },
  },
  description: { stringValue: "A lovely flat." },
  status: { stringValue: "active" },
};

test("unwrapFirestore turns typed values into a plain object", () => {
  const out = unwrapFirestore({
    s: { stringValue: "hi" },
    n: { integerValue: "42" },
    d: { doubleValue: 3.5 },
    b: { booleanValue: true },
    nil: { nullValue: null },
    arr: { arrayValue: { values: [{ integerValue: "1" }, { stringValue: "x" }] } },
    map: { mapValue: { fields: { inner: { stringValue: "deep" } } } },
  });
  expect(out).toEqual({
    s: "hi",
    n: 42,
    d: 3.5,
    b: true,
    nil: null,
    arr: [1, "x"],
    map: { inner: "deep" },
  });
});

test("unwrapFirestore handles empty arrayValue and missing values", () => {
  expect(unwrapFirestore({ arr: { arrayValue: {} } })).toEqual({ arr: [] });
});

test("bestate4Parser.matches by host suffix", () => {
  expect(bestate4Parser.matches("www.bestate4.me")).toBe(true);
  expect(bestate4Parser.matches("bestate4.me")).toBe(true);
  expect(bestate4Parser.matches("example.com")).toBe(false);
});

test("mapBestate4 maps fixture fields to a ParsedListing", () => {
  const parsed = mapBestate4(unwrapFirestore(FIXTURE));
  expect(parsed.name).toBe("Cozy 1BR near the river");
  expect(parsed.city).toBe("Podgorica");
  expect(parsed.priceMinor).toBe(45000);
  expect(parsed.currency).toBe("EUR");
  expect(parsed.bedrooms).toBe(1);
  expect(parsed.bathrooms).toBe(1);
  expect(parsed.areaM2).toBe(46);
  expect(parsed.type).toBe("residential");
  expect(parsed.dealType).toBe("rent");
  expect(parsed.photos).toEqual([
    "https://firebasestorage.googleapis.com/one.jpg",
    "https://firebasestorage.googleapis.com/two.jpg",
  ]);
  expect(parsed.address).toBe("Podgorica, Ljubović, Montenegro");
});

test("mapBestate4 uses sale price for FOR_SALE listings", () => {
  const parsed = mapBestate4({
    title: "Flat for sale",
    listingType: "FOR_SALE",
    price: 80000,
    bedrooms: 0,
    locationDisplay: "Budva, Center, Montenegro",
  });
  expect(parsed.priceMinor).toBe(8000000);
  expect(parsed.dealType).toBe("sale");
  expect(parsed.city).toBe("Budva");
});

test("mapBestate4 maps type and dealType from source, using monthlyRent for rent", () => {
  const parsed = mapBestate4({
    title: "Rental home",
    listingType: "FOR_RENT",
    type: "Residential",
    monthlyRent: 500,
    price: 999999,
  });
  expect(parsed.type).toBe("residential");
  expect(parsed.dealType).toBe("rent");
  expect(parsed.priceMinor).toBe(50000);
});

test("mapBestate4 maps land + FOR_SALE using sale price", () => {
  const parsed = mapBestate4({
    title: "Plot of land",
    listingType: "FOR_SALE",
    type: "Land",
    price: 250000,
  });
  expect(parsed.type).toBe("land");
  expect(parsed.dealType).toBe("sale");
  expect(parsed.priceMinor).toBe(25000000);
});

test("mapBestate4 defaults type to residential and price to 0 when missing", () => {
  const parsed = mapBestate4({ title: "Mystery listing" });
  expect(parsed.type).toBe("residential");
  expect(parsed.dealType).toBe("rent");
  expect(parsed.priceMinor).toBe(0);
});

test("mapBestate4 maps commercial type", () => {
  const parsed = mapBestate4({ title: "Shop", type: "Commercial", listingType: "FOR_SALE", price: 100 });
  expect(parsed.type).toBe("commercial");
});

test("mapBestate4 throws when title is missing", () => {
  expect(() => mapBestate4({ locationDisplay: "x" })).toThrow();
});

test("pickParser resolves by URL host", () => {
  expect(pickParser("https://www.bestate4.me/listing/abc")).toBe(bestate4Parser);
  expect(pickParser("https://zoopla.co.uk/x")).toBeNull();
});

// --- importListing downloads + stores photos in our storage ----------------

const REMOTE_PHOTOS = [
  "https://firebasestorage.googleapis.com/one.jpg",
  "https://firebasestorage.googleapis.com/two.jpg",
];

const fakeParser: ListingParser = {
  id: "fake",
  matches: (host) => host === "fake.test",
  parse: async () => ({
    name: "Imported flat",
    address: "Somewhere 1",
    city: "Budva",
    priceMinor: 100000,
    currency: "EUR",
    type: "residential",
    photos: REMOTE_PHOTOS,
  }),
};

beforeAll(async () => { await migrateTestDb(); });
afterAll(async () => { await client.end(); });

test("importListing downloads remote photos and stores them in our storage", async () => {
  await resetDb();
  PARSERS.push(fakeParser);
  const realFetch = globalThis.fetch;
  const imageBytes = new Uint8Array(512).fill(7);
  globalThis.fetch = vi.fn(async () =>
    new Response(imageBytes, {
      headers: { "content-type": "image/jpeg" },
    }),
  ) as unknown as typeof fetch;
  try {
    const agency = await createAgency(db, { name: "Import Agency" });
    const storage = new FakeStorage();

    const property = await importListing(db, agency.id, "https://fake.test/listing/x", storage);

    // Photos are our stored URLs, not the remote source URLs.
    expect(property.photos).toEqual([
      `https://fake.storage/properties/${property.id}/photo-0.jpg`,
      `https://fake.storage/properties/${property.id}/photo-1.jpg`,
    ]);
    expect(property.photos).not.toContain(REMOTE_PHOTOS[0]);
    expect(property.status).toBe("published");

    // Storage recorded both uploads under the property's path.
    expect(storage.calls.map((c) => c.path)).toEqual([
      `properties/${property.id}/photo-0.jpg`,
      `properties/${property.id}/photo-1.jpg`,
    ]);
    expect(storage.calls[0].contentType).toBe("image/jpeg");
    expect(storage.calls[0].size).toBe(512);
  } finally {
    globalThis.fetch = realFetch;
    PARSERS.splice(PARSERS.indexOf(fakeParser), 1);
  }
});

test("importListing keeps remote photos when no storage is provided", async () => {
  await resetDb();
  PARSERS.push(fakeParser);
  try {
    const agency = await createAgency(db, { name: "Import Agency" });
    const property = await importListing(db, agency.id, "https://fake.test/listing/x");
    expect(property.photos).toEqual(REMOTE_PHOTOS);
  } finally {
    PARSERS.splice(PARSERS.indexOf(fakeParser), 1);
  }
});

test("importListing falls back to remote photos when every download fails", async () => {
  await resetDb();
  PARSERS.push(fakeParser);
  const realFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () =>
    new Response(null, { status: 404 }),
  ) as unknown as typeof fetch;
  try {
    const agency = await createAgency(db, { name: "Import Agency" });
    const storage = new FakeStorage();
    const property = await importListing(db, agency.id, "https://fake.test/listing/x", storage);
    expect(property.photos).toEqual(REMOTE_PHOTOS);
    expect(storage.calls).toEqual([]);
  } finally {
    globalThis.fetch = realFetch;
    PARSERS.splice(PARSERS.indexOf(fakeParser), 1);
  }
});

// --- importAgentListings (idempotent bulk import) ---------------------------

/** Builds a Firestore document with the given id + a typed-value fields object. */
function fsDoc(id: string, fields: Record<string, unknown>) {
  return { name: `projects/x/databases/(default)/documents/listings/${id}`, fields };
}

/** A fetchImpl that returns one Firestore-shaped page of docs (no nextPageToken). */
function pageFetch(docs: unknown[]): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ documents: docs }), {
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

const AGENT_DOC_A = fsDoc("listing-a", {
  title: { stringValue: "Agent A Flat" },
  listingType: { stringValue: "FOR_RENT" },
  type: { stringValue: "Residential" },
  monthlyRent: { integerValue: "500" },
  locationDisplay: { stringValue: "Budva, Center, Montenegro" },
  agentId: { stringValue: "AGENT" },
});
const AGENT_DOC_B = fsDoc("listing-b", {
  title: { stringValue: "Agent B House" },
  listingType: { stringValue: "FOR_SALE" },
  type: { stringValue: "Residential" },
  price: { integerValue: "250000" },
  locationDisplay: { stringValue: "Kotor, Old Town, Montenegro" },
  agentId: { stringValue: "AGENT" },
});
const OTHER_AGENT_DOC = fsDoc("listing-c", {
  title: { stringValue: "Someone Else" },
  agentId: { stringValue: "OTHER" },
});

test("fetchAgentListings returns only docs for the requested agent with ids", async () => {
  const fetchImpl = pageFetch([AGENT_DOC_A, AGENT_DOC_B, OTHER_AGENT_DOC]);
  const docs = await fetchAgentListings("AGENT", fetchImpl);
  expect(docs.map((d) => d.id).sort()).toEqual(["listing-a", "listing-b"]);
});

test("importAgentListings imports + publishes the agent's listings, idempotently", async () => {
  await resetDb();
  const agency = await createAgency(db, { name: "Bulk Agency" });
  const fetchImpl = pageFetch([AGENT_DOC_A, AGENT_DOC_B, OTHER_AGENT_DOC]);

  const result = await importAgentListings(db, agency.id, "AGENT", new FakeStorage(), { fetchImpl });
  expect(result).toEqual({ created: 2, skipped: 0, failed: 0 });

  const published = await searchProperties(db, agency.id, {});
  expect(published).toHaveLength(2);
  expect(published.every((p) => p.status === "published")).toBe(true);

  // Re-running skips the already-imported docs.
  const rerun = await importAgentListings(db, agency.id, "AGENT", new FakeStorage(), { fetchImpl });
  expect(rerun).toEqual({ created: 0, skipped: 2, failed: 0 });
});

test("importAgentListings counts unmappable docs as failed but imports the good ones", async () => {
  await resetDb();
  const agency = await createAgency(db, { name: "Mixed Agency" });
  const bad = fsDoc("listing-bad", { agentId: { stringValue: "AGENT" } }); // missing title → mapBestate4 throws
  const fetchImpl = pageFetch([AGENT_DOC_A, bad]);

  const result = await importAgentListings(db, agency.id, "AGENT", new FakeStorage(), { fetchImpl });
  expect(result).toEqual({ created: 1, skipped: 0, failed: 1 });
  expect(await searchProperties(db, agency.id, {})).toHaveLength(1);
});
