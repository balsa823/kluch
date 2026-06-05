import {
  pgTable, bigserial, bigint, integer, text, timestamp, pgEnum, uuid, date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const localeEnum = pgEnum("locale", ["en", "ru", "me"]);
export const roleEnum = pgEnum("role", ["occupant", "operator"]);
export const leaseStatusEnum = pgEnum("lease_status", ["active", "ended"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "confirmed"]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "received", "scheduled", "done", "cancelled",
]);
export const directionEnum = pgEnum("direction", ["in", "out"]);
export const agencyRoleEnum = pgEnum("agency_role", ["admin", "agent"]);
export const propertyTypeEnum = pgEnum("property_type", ["apartment", "studio", "house"]);
export const propertyStatusEnum = pgEnum("property_status", ["draft", "published"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
  telegramUsername: text("telegram_username"),
  fullName: text("full_name"),
  locale: localeEnum("locale").notNull().default("en"),
  role: roleEnum("role").notNull().default("occupant"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  landlordName: text("landlord_name"),
  landlordContact: text("landlord_contact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  agencyId: uuid("agency_id").references(() => agencies.id),
  priceMinor: integer("price_minor"),
  currency: text("currency").notNull().default("EUR"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  areaM2: integer("area_m2"),
  type: propertyTypeEnum("type"),
  status: propertyStatusEnum("status").notNull().default("draft"),
  photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
});

export const agencies = pgTable("agencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  colorPrimary: text("color_primary").notNull().default("#1F3A5C"),
  colorAccent: text("color_accent").notNull().default("#4E827A"),
  tagline: text("tagline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agencyDomains = pgTable("agency_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  domain: text("domain").notNull().unique(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agencyUsers = pgTable("agency_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: agencyRoleEnum("role").notNull().default("agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leases = pgTable("leases", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  occupantUserId: uuid("occupant_user_id").references(() => users.id),
  joinCode: text("join_code").notNull().unique(),
  rentMinor: integer("rent_minor").notNull(),
  currency: text("currency").notNull().default("EUR"),
  dueDay: integer("due_day").notNull(), // 1..28
  status: leaseStatusEnum("status").notNull().default("active"),
  startDate: date("start_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  leaseId: uuid("lease_id").notNull().references(() => leases.id),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("EUR"),
  period: text("period").notNull(), // "YYYY-MM"
  status: paymentStatusEnum("status").notNull().default("pending"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
});

export const tickets = pgTable("tickets", {
  id: bigserial("id", { mode: "number" }).primaryKey(), // human-friendly #142
  leaseId: uuid("lease_id").notNull().references(() => leases.id),
  occupantUserId: uuid("occupant_user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  translatedDescription: text("translated_description"),
  photoFileId: text("photo_file_id"),
  status: ticketStatusEnum("status").notNull().default("received"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  direction: directionEnum("direction").notNull(),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text"),
  locale: localeEnum("locale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
