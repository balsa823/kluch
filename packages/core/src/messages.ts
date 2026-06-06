import { messages, type Database } from "@kluche/db";
import type { Locale } from "./i18n.js";
import type { Translator } from "./translate.js";

/** Maps our locale to a DeepL target-language code. */
export function localeToDeepL(locale: Locale): string {
  return { en: "EN", ru: "RU", me: "ME" }[locale];
}

export interface LogMessageInput {
  userId: string;
  direction: "in" | "out";
  text: string;
  locale: Locale; // the occupant's language
}

/**
 * Persists a relayed message and its translation.
 * - incoming (occupant → operator): translate to English for the operator.
 * - outgoing (operator → occupant): translate from English to the occupant's language.
 * English-language occupants need no translation.
 */
export async function logMessage(db: Database, translator: Translator, input: LogMessageInput) {
  let translatedText: string | null = null;
  if (input.locale !== "en") {
    const to = input.direction === "in" ? "EN" : localeToDeepL(input.locale);
    translatedText = await translator.translate(input.text, { to });
  }

  const [row] = await db.insert(messages).values({
    userId: input.userId,
    direction: input.direction,
    originalText: input.text,
    translatedText,
    locale: input.locale,
  }).returning();
  return row;
}
