import type { Context } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";
import type { Database } from "@kluche/db";
import type { Translator } from "@kluche/core";

/** Shared dependencies attached to every context as `ctx.services`. */
export interface Services {
  db: Database;
  translator: Translator;
  operatorChatId: number;
}

/**
 * The bot context. We let the conversations plugin own the session (it stores
 * its own state there) and resolve the current user/locale from the database
 * per update — that keeps identity in our own tables and survives restarts.
 */
export type BotContext = ConversationFlavor<Context> & { services: Services };
