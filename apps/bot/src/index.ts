import { createDb } from "@kluch/db";
import { DeepLTranslator } from "@kluch/core";
import { loadConfig } from "./config.js";
import { createBot } from "./bot.js";
import { startServer } from "./server.js";

const config = loadConfig();
const { db } = createDb(config.databaseUrl);
const translator = new DeepLTranslator(config.deeplApiKey, config.deeplApiUrl);

const bot = createBot(config.botToken, {
  db,
  translator,
  operatorChatId: config.operatorChatId,
});

startServer(config.port);
console.log(`health server listening on :${config.port}`);

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

await bot.start({
  onStart: (me) => console.log(`bot @${me.username} started (long polling)`),
});
