import { and, eq } from "drizzle-orm";
import { leases, payments, type Database } from "@kluche/db";

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

/** Renders integer minor units (cents) as a currency string, e.g. 45000 -> "€450.00". */
export function formatMoney(minor: number, currency = "EUR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

/** Active leases whose monthly due-day equals the given day-of-month. */
export async function leasesDueOn(db: Database, day: number) {
  return db.select().from(leases)
    .where(and(eq(leases.dueDay, day), eq(leases.status, "active")));
}

/** Records a pending payment for a lease+period. Idempotent per (leaseId, period). */
export async function claimPayment(db: Database, leaseId: string, period: string) {
  const [existing] = await db.select().from(payments)
    .where(and(eq(payments.leaseId, leaseId), eq(payments.period, period)));
  if (existing) return existing;

  const [lease] = await db.select().from(leases).where(eq(leases.id, leaseId));
  if (!lease) throw new Error(`lease ${leaseId} not found`);

  const [created] = await db.insert(payments).values({
    leaseId,
    amountMinor: lease.rentMinor,
    currency: lease.currency,
    period,
  }).returning();
  return created;
}

export async function confirmPayment(db: Database, paymentId: string) {
  const [row] = await db.update(payments)
    .set({ status: "confirmed", confirmedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();
  return row;
}
