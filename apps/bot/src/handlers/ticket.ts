import { Bot, InlineKeyboard } from "grammy";
import { createConversation, type Conversation } from "@grammyjs/conversations";
import {
  findOrCreateUser, getActiveLeaseForUser, getUserById, createTicket, updateTicketStatus,
  t, type Locale,
} from "@kluche/core";
import type { Database } from "@kluche/db";
import type { BotContext, Services } from "../context.js";

const STATUS_KEY: Record<string, string> = {
  scheduled: "statusScheduled",
  done: "statusDone",
  cancelled: "statusCancelled",
};

/** Slim, serializable snapshot of the occupant + their lease for the conversation. */
async function loadOccupant(db: Database, telegramUserId: number) {
  const user = await findOrCreateUser(db, { telegramUserId });
  const info = await getActiveLeaseForUser(db, user.id);
  return {
    userId: user.id,
    locale: user.locale,
    occupantName: user.fullName ?? "tenant",
    leaseId: info?.lease.id ?? null,
    propertyName: info?.property.name ?? null,
    propertyCity: info?.property.city ?? null,
  };
}

export function registerTickets(bot: Bot<BotContext>, services: Services): void {
  const { db, translator, operatorChatId } = services;

  const ticketConversation = async (conversation: Conversation<BotContext>, ctx: BotContext) => {
    const telegramUserId = ctx.from!.id;
    const setup = await conversation.external(() => loadOccupant(db, telegramUserId));

    if (!setup.leaseId) {
      await ctx.reply(t(setup.locale, "notLinked"));
      return;
    }

    await ctx.reply(t(setup.locale, "ticketAskDescription"));
    const got = await conversation.waitFor("message");
    const description = (got.message.text ?? got.message.caption ?? "").trim();
    const photos = got.message.photo;
    const photoFileId = photos?.[photos.length - 1]?.file_id;

    if (!description && !photoFileId) {
      await ctx.reply(t(setup.locale, "ticketAskDescription"));
      return;
    }

    const created = await conversation.external(async () => {
      const ticket = await createTicket(db, translator, {
        leaseId: setup.leaseId!,
        occupantUserId: setup.userId,
        description: description || "(photo)",
        locale: setup.locale,
        photoFileId,
      });

      if (operatorChatId !== 0) {
        const shown = ticket.translatedDescription ?? ticket.description;
        const orig = ticket.translatedDescription ? `\n\n(original: ${ticket.description})` : "";
        const card =
          `🛠 Ticket #${ticket.id} — ${setup.propertyName} (${setup.propertyCity})\n` +
          `From: ${setup.occupantName} (${setup.locale})\n\n${shown}${orig}`;
        const kb = new InlineKeyboard()
          .text("📅 Scheduled", `tkt:${ticket.id}:scheduled`)
          .text("✅ Done", `tkt:${ticket.id}:done`)
          .text("✖ Cancel", `tkt:${ticket.id}:cancelled`);
        if (photoFileId) {
          await bot.api.sendPhoto(operatorChatId, photoFileId, { caption: card, reply_markup: kb });
        } else {
          await bot.api.sendMessage(operatorChatId, card, { reply_markup: kb });
        }
      }
      return { id: ticket.id };
    });

    await ctx.reply(t(setup.locale, "ticketCreated", { id: created.id }));
  };

  bot.use(createConversation(ticketConversation, "ticket"));

  bot.callbackQuery("menu:ticket", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("ticket");
  });

  // Operator marks a status; only honored inside the operator group.
  bot.callbackQuery(/^tkt:(\d+):(scheduled|done|cancelled)$/, async (ctx) => {
    if (ctx.chat?.id !== operatorChatId) {
      await ctx.answerCallbackQuery();
      return;
    }
    const id = Number(ctx.match[1]);
    const status = ctx.match[2] as "scheduled" | "done" | "cancelled";

    const ticket = await updateTicketStatus(db, id, status);
    const occupant = await getUserById(db, ticket.occupantUserId);
    if (occupant) {
      const phrase = t(occupant.locale as Locale, STATUS_KEY[status]);
      await ctx.api.sendMessage(
        occupant.telegramUserId,
        t(occupant.locale as Locale, "ticketStatus", { id, status: phrase }),
      );
    }
    await ctx.answerCallbackQuery({ text: `Tenant notified: ${status}` });
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  });
}
