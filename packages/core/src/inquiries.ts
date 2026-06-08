import { desc, eq } from "drizzle-orm";
import { inquiries, type Database } from "@kluche/db";

export type Inquiry = typeof inquiries.$inferSelect;

export interface CreateInquiryInput {
  agencyId: string;
  propertyId?: string;
  name: string;
  contact: string;
  message?: string;
}

export async function createInquiry(db: Database, input: CreateInquiryInput): Promise<Inquiry> {
  const [inquiry] = await db.insert(inquiries)
    .values({
      agencyId: input.agencyId,
      propertyId: input.propertyId,
      name: input.name,
      contact: input.contact,
      message: input.message,
    })
    .returning();
  return inquiry;
}

/** All inquiries for an agency, newest first. For the agency console. */
export async function listInquiries(db: Database, agencyId: string): Promise<Inquiry[]> {
  return db.select().from(inquiries)
    .where(eq(inquiries.agencyId, agencyId))
    .orderBy(desc(inquiries.createdAt));
}
