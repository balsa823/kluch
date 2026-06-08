import { createDb } from "@kluche/db";
import {
  createAgency,
  getAgencyBySlug,
  updateAgencyConfig,
  createAgencyUser,
  createPartnerUser,
  createProperty,
  publishProperty,
  type CreatePropertyInput,
} from "@kluche/core";

/**
 * Idempotently seeds a demo agency, an admin login and a few published listings.
 * Run: pnpm --filter @kluche/web seed   (needs DATABASE_URL)
 */
const { db, client } = createDb(process.env.DATABASE_URL);

// Idempotency keyed on the STABLE name-derived slug. (Keying on a hardcoded "popovic"
// previously re-created a blank duplicate once the real agency's slug was changed.)
if (await getAgencyBySlug(db, "popovic-nekretnine")) {
  console.log("already seeded");
  await client.end();
  process.exit(0);
}

const agency = await createAgency(db, { name: "Popović Nekretnine" }); // slug derives to popovic-nekretnine
await updateAgencyConfig(db, agency.id, {
  colorPrimary: "#1F3A5C",
  colorAccent: "#4E827A",
  tagline: "Your home on the Adriatic",
});

await createAgencyUser(db, {
  agencyId: agency.id,
  email: "admin@popovic.me",
  name: "Balša",
  role: "admin",
  password: "kluch1234",
});

// The script early-exits above if the agency already exists, so this runs only on a
// fresh seed — create the partner login unconditionally (matches createAgencyUser above).
await createPartnerUser(db, {
  email: "admin@popovic.me", name: "Balša", password: "kluch1234",
  dashboards: { agency: { agencyId: agency.id } },
});

const listings: Omit<CreatePropertyInput, "agencyId">[] = [
  {
    name: "Old Town Apartment",
    address: "Njegoševa 12",
    city: "Podgorica",
    priceMinor: 14500000,
    bedrooms: 2,
    bathrooms: 1,
    areaM2: 72,
    type: "residential",
    photos: ["https://placehold.co/640x400/1F3A5C/F1ECE0?text=Old+Town+Apartment"],
  },
  {
    name: "Bay View Studio",
    address: "Obala bb",
    city: "Kotor",
    priceMinor: 9800000,
    bedrooms: 1,
    bathrooms: 1,
    areaM2: 38,
    type: "residential",
    photos: ["https://placehold.co/640x400/4E827A/F1ECE0?text=Bay+View+Studio"],
  },
  {
    name: "Seaside Villa",
    address: "Stari grad 4",
    city: "Kotor",
    priceMinor: 48000000,
    bedrooms: 4,
    bathrooms: 3,
    areaM2: 210,
    type: "residential",
    photos: ["https://placehold.co/640x400/1F3A5C/F1ECE0?text=Seaside+Villa"],
  },
];

for (const l of listings) {
  const property = await createProperty(db, { agencyId: agency.id, ...l });
  await publishProperty(db, property.id);
}

console.log(`Seeded agency "${agency.name}".`);
console.log(`Login:  admin@popovic.me  /  kluch1234`);

await client.end();
