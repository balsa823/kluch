import { Bot, session } from "grammy";
import { conversations } from "@grammyjs/conversations";
import type { BotContext, Services } from "./context.js";

/**
 * Builds the grammY bot with session + conversations plugins and the shared
 * services made available on every context as `ctx.services`. Handlers are
 * registered by later milestones.
 */
export function createBot(token: string, services: Services): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // The session backs the conversations plugin; we keep no app data in it.
  bot.use(session({ initial: () => ({}) }));
  bot.use(async (ctx, next) => {
    ctx.services = services;
    await next();
  });
  bot.use(conversations());

  return bot;
}
