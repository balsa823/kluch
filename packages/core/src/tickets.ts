import { eq } from "drizzle-orm";
import { tickets, type Database } from "@kluche/db";
import type { Locale } from "./i18n.js";
import type { Translator } from "./translate.js";

export interface CreateTicketInput {
  leaseId: string;
  occupantUserId: string;
  description: string;
  locale: Locale;
  photoFileId?: string;
}

/**
 * Creates a maintenance ticket. The occupant's description is translated into
 * the operator's working language (default English) unless they already wrote
 * in English.
 */
export async function createTicket(
  db: Database,
  translator: Translator,
  input: CreateTicketInput,
  targetLang = "EN",
) {
  const translatedDescription = input.locale === "en"
    ? null
    : await translator.translate(input.description, { to: targetLang });

  const [ticket] = await db.insert(tickets).values({
    leaseId: input.leaseId,
    occupantUserId: input.occupantUserId,
    description: input.description,
    translatedDescription,
    photoFileId: input.photoFileId,
  }).returning();
  return ticket;
}

export type TicketStatus = "received" | "scheduled" | "done" | "cancelled";

export async function updateTicketStatus(db: Database, id: number, status: TicketStatus) {
  const [row] = await db.update(tickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();
  return row;
}
