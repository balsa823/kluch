import type { Bot } from "grammy";
import {
  findOrCreateUser, setUserLocale, linkOccupantByCode, getActiveLeaseForUser,
  t, type Locale,
} from "@kluche/core";
import type { BotContext } from "../context.js";
import { languageKeyboard, mainMenu } from "../keyboards.js";

/** Resolves (or creates) the current Telegram user as a Kluch user row. */
async function resolveUser(ctx: BotContext) {
  const from = ctx.from!;
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ") || undefined;
  return findOrCreateUser(ctx.services.db, {
    telegramUserId: from.id,
    username: from.username,
    fullName,
  });
}

/** Attempts to link the user to a lease by join code, replying appropriately. */
async function tryLink(ctx: BotContext, userId: string, locale: Locale, code: string): Promise<boolean> {
  try {
    const result = await linkOccupantByCode(ctx.services.db, userId, code.trim().toUpperCase());
    if (!result) {
      await ctx.reply(t(locale, "badCode"));
      return false;
    }
    await ctx.reply(t(locale, "linked", { property: result.property.name }));
    await ctx.reply(t(locale, "menu"), { reply_markup: mainMenu(locale) });
    return true;
  } catch {
    // lease already linked to a different occupant
    await ctx.reply(t(locale, "badCode"));
    return false;
  }
}

export function registerOnboarding(bot: Bot<BotContext>): void {
  bot.command("start", async (ctx) => {
    const user = await resolveUser(ctx);

    const payload = ctx.match?.toString().trim();
    if (payload) {
      await tryLink(ctx, user.id, user.locale, payload);
      return;
    }

    await ctx.reply(t(user.locale, "welcome"));
    const lease = await getActiveLeaseForUser(ctx.services.db, user.id);
    if (lease) {
      await ctx.reply(t(user.locale, "menu"), { reply_markup: mainMenu(user.locale) });
      return;
    }
    await ctx.reply(t(user.locale, "chooseLanguage"), { reply_markup: languageKeyboard() });
  });

  bot.callbackQuery(/^lang:(en|ru|me)$/, async (ctx) => {
    const locale = ctx.match[1] as Locale;
    const user = await resolveUser(ctx);
    await setUserLocale(ctx.services.db, user.id, locale);
    await ctx.answerCallbackQuery();
    await ctx.reply(t(locale, "languageSet"));

    const lease = await getActiveLeaseForUser(ctx.services.db, user.id);
    if (lease) {
      await ctx.reply(t(locale, "menu"), { reply_markup: mainMenu(locale) });
    } else {
      await ctx.reply(t(locale, "enterCode"));
    }
  });

  bot.command("join", async (ctx) => {
    const user = await resolveUser(ctx);
    const code = ctx.match?.toString().trim();
    if (!code) {
      await ctx.reply(t(user.locale, "enterCode"));
      return;
    }
    await tryLink(ctx, user.id, user.locale, code);
  });
}
