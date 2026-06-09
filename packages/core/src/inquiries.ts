import { and, desc, eq } from "drizzle-orm";
import { inquiries, type Database } from "@kluche/db";

export type Inquiry = typeof inquiries.$inferSelect;

export interface CreateInquiryInput {
  agencyId: string;
  propertyId?: string;
  name?: string;
  contact?: string;
  message?: string;
  kind?: string;
  visitorId?: string;
  tourDate?: string;
}

export async function createInquiry(db: Database, input: CreateInquiryInput): Promise<Inquiry> {
  const [inquiry] = await db.insert(inquiries)
    .values({
      agencyId: input.agencyId,
      propertyId: input.propertyId,
      kind: input.kind,
      visitorId: input.visitorId,
      tourDate: input.tourDate,
      name: input.name,
      contact: input.contact,
      message: input.message,
    })
    .returning();
  return inquiry;
}

/**
 * Inquiries for an agency, newest first. For the agency console.
 * Pass `opts.kind` to restrict to a single lead kind (e.g. "phone_click").
 */
export async function listInquiries(
  db: Database,
  agencyId: string,
  opts: { kind?: string } = {},
): Promise<Inquiry[]> {
  const where = opts.kind
    ? and(eq(inquiries.agencyId, agencyId), eq(inquiries.kind, opts.kind))
    : eq(inquiries.agencyId, agencyId);
  return db.select().from(inquiries)
    .where(where)
    .orderBy(desc(inquiries.createdAt));
}
