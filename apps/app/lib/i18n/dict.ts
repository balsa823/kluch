// Pure i18n dictionary module — NO imports (so it can be key-parity-checked outside RN).

export type Lang = "en" | "sr";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "sr", label: "ME/SR" },
];

export const dict: Record<Lang, Record<string, string>> = {
  en: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.loading": "Loading…",
    "common.retry": "Retry",
    "common.add": "Add",
    "common.close": "Close",
  },
  sr: {
    "common.save": "Sačuvaj",
    "common.cancel": "Otkaži",
    "common.delete": "Obriši",
    "common.edit": "Izmijeni",
    "common.loading": "Učitavanje…",
    "common.retry": "Pokušaj ponovo",
    "common.add": "Dodaj",
    "common.close": "Zatvori",
  },
};
