import { InlineKeyboard } from "grammy";
import { t, type Locale } from "@kluche/core";

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("English", "lang:en")
    .text("Русский", "lang:ru")
    .text("Crnogorski", "lang:me");
}

export function mainMenu(locale: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(`💳 ${t(locale, "menuRent")}`, "menu:rent")
    .text(`🛠 ${t(locale, "menuTicket")}`, "menu:ticket")
    .row()
    .text(`💬 ${t(locale, "menuAsk")}`, "menu:ask")
    .text(`📄 ${t(locale, "menuDocs")}`, "menu:docs");
}
