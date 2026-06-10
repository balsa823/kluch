import React, { createContext, useCallback, useContext, useState } from "react";
import { dict, type Lang } from "./dict";

const STORAGE_KEY = "kluche_console_lang";

function isLang(value: unknown): value is Lang {
  return value === "en" || value === "sr";
}

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures (private mode / SSR / disabled storage)
    }
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      let str = dict[lang][key] ?? dict.en[key] ?? key;
      if (vars) {
        for (const [token, value] of Object.entries(vars)) {
          str = str.split(`{${token}}`).join(String(value));
        }
      }
      return str;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useT must be used within an I18nProvider");
  }
  return ctx;
}
