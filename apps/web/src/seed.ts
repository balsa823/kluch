import { createDb } from "@kluch/db";
import {
  createAgency,
  getAgencyBySlug,
  updateAgencyConfig,
  createAgencyUser,
  createProperty,
  publishProperty,
  type CreatePropertyInput,
} from "@kluch/core";

/**
 * Idempotently seeds a demo agency, an admin login and a few published listings.
 * Run: pnpm --filter @kluch/web seed   (needs DATABASE_URL)
 */
const { db, client } = createDb(process.env.DATABASE_URL);

if (await getAgencyBySlug(db, "popovic")) {
  console.log("already seeded");
  await client.end();
  process.exit(0);
}

const agency = await createAgency(db, { name: "Popović Nekretnine", slug: "popovic" });
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

const listings: Omit<CreatePropertyInput, "agencyId">[] = [
  {
    name: "Old Town Apartment",
    address: "Njegoševa 12",
    city: "Podgorica",
    priceMinor: 14500000,
    bedrooms: 2,
    bathrooms: 1,
    areaM2: 72,
    type: "apartment",
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
    type: "studio",
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
    type: "house",
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
