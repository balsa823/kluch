export type Locale = "en" | "ru" | "me";

type Dict = Record<string, string>;

const en: Dict = {
  welcome: "Welcome to Kluch 🔑 — your keys to Montenegro.",
  chooseLanguage: "What language do you prefer?",
  linked: "You're linked to {property}. Welcome!",
  badCode: "I couldn't find that code. Please check it and try again.",
  menu: "What would you like to do?",
  menuRent: "Rent",
  menuTicket: "Report a problem",
  menuAsk: "Ask Kluch",
  menuDocs: "Documents",
  enterCode: "To link your home, send /join followed by your code — for example: /join ABC123",
  notLinked: "You're not linked to a home yet. Send /join followed by the code from your operator.",
  languageSet: "Language set to English.",
  askPrompt: "Type your question and I'll pass it to the Kluch team.",
  ticketAskDescription: "What's wrong? Describe it, and you can add a photo.",
  ticketCreated: "Ticket #{id} created. We're on it and will keep you posted here.",
  ticketStatus: "Update on ticket #{id}: {status}.",
  rentDue: "Your rent of {amount} for {period} is due on day {dueDay}.",
  rentPaidClaim: "Thanks — I've recorded your payment as pending. We'll confirm shortly.",
  rentConfirmed: "Your payment for {period} is confirmed ✅. Receipt attached to your history.",
};

const ru: Dict = {
  welcome: "Добро пожаловать в Kluch 🔑 — ваши ключи к Черногории.",
  chooseLanguage: "Какой язык вы предпочитаете?",
  linked: "Вы привязаны к {property}. Добро пожаловать!",
  badCode: "Не нашёл такой код. Проверьте и попробуйте снова.",
  menu: "Что бы вы хотели сделать?",
  menuRent: "Аренда",
  menuTicket: "Сообщить о проблеме",
  menuAsk: "Спросить Kluch",
  menuDocs: "Документы",
  enterCode: "Чтобы привязать жильё, отправьте /join и ваш код — например: /join ABC123",
  notLinked: "Вы ещё не привязаны к жилью. Отправьте /join и код от вашего оператора.",
  languageSet: "Язык изменён на русский.",
  askPrompt: "Напишите вопрос, и я передам его команде Kluch.",
  ticketAskDescription: "Что случилось? Опишите проблему, можно добавить фото.",
  ticketCreated: "Заявка #{id} создана. Мы займёмся ею и сообщим вам здесь.",
  ticketStatus: "Обновление по заявке #{id}: {status}.",
  rentDue: "Аренда {amount} за {period} должна быть оплачена до {dueDay} числа.",
  rentPaidClaim: "Спасибо — платёж записан как ожидающий. Скоро подтвердим.",
  rentConfirmed: "Ваш платёж за {period} подтверждён ✅.",
};

const me: Dict = {
  welcome: "Dobrodošli u Kluch 🔑 — vaši ključevi za Crnu Goru.",
  chooseLanguage: "Koji jezik preferirate?",
  linked: "Povezani ste sa {property}. Dobrodošli!",
  badCode: "Nisam pronašao taj kod. Provjerite i pokušajte ponovo.",
  menu: "Šta želite da uradite?",
  menuRent: "Kirija",
  menuTicket: "Prijavi problem",
  menuAsk: "Pitaj Kluch",
  menuDocs: "Dokumenti",
  enterCode: "Da povežete svoj dom, pošaljite /join i vaš kod — na primjer: /join ABC123",
  notLinked: "Još niste povezani sa domom. Pošaljite /join i kod koji ste dobili od operatera.",
  languageSet: "Jezik je postavljen na crnogorski.",
  askPrompt: "Napišite pitanje i proslijediću ga Kluch timu.",
  ticketAskDescription: "Šta nije u redu? Opišite problem, možete dodati i fotografiju.",
  ticketCreated: "Prijava #{id} je kreirana. Rješavamo i javljamo vam ovdje.",
  ticketStatus: "Ažuriranje prijave #{id}: {status}.",
  rentDue: "Vaša kirija {amount} za {period} dospijeva {dueDay}. u mjesecu.",
  rentPaidClaim: "Hvala — uplata je zabilježena kao na čekanju. Uskoro potvrđujemo.",
  rentConfirmed: "Vaša uplata za {period} je potvrđena ✅.",
};

const dicts: Record<Locale, Dict> = { en, ru, me };

export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const template = dicts[locale]?.[key] ?? en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}
