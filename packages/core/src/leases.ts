import { eq } from "drizzle-orm";
import { leases, properties, type Database } from "@kluch/db";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function uniqueJoinCode(db: Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const [clash] = await db.select().from(leases).where(eq(leases.joinCode, code));
    if (!clash) return code;
  }
  throw new Error("could not generate a unique join code");
}

export interface CreateLeaseInput {
  property: {
    name: string;
    address: string;
    city: string;
    landlordName?: string;
    landlordContact?: string;
  };
  rentMinor: number;
  currency?: string;
  dueDay: number;
  startDate?: string;
}

export async function createLease(db: Database, input: CreateLeaseInput) {
  const [property] = await db.insert(properties).values(input.property).returning();
  const joinCode = await uniqueJoinCode(db);
  const [lease] = await db.insert(leases).values({
    propertyId: property.id,
    joinCode,
    rentMinor: input.rentMinor,
    currency: input.currency ?? "EUR",
    dueDay: input.dueDay,
    startDate: input.startDate,
  }).returning();
  return { lease, property };
}

export async function linkOccupantByCode(db: Database, userId: string, code: string) {
  const [lease] = await db.select().from(leases).where(eq(leases.joinCode, code));
  if (!lease || lease.status !== "active") return null;

  if (lease.occupantUserId && lease.occupantUserId !== userId) {
    throw new Error("This lease is already linked to another occupant.");
  }

  const targetLease = lease.occupantUserId === userId
    ? lease
    : (await db.update(leases).set({ occupantUserId: userId }).where(eq(leases.id, lease.id)).returning())[0];

  const [property] = await db.select().from(properties).where(eq(properties.id, targetLease.propertyId));
  return { lease: targetLease, property };
}
