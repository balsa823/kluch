export interface Translator {
  translate(text: string, opts: { to: string; from?: string }): Promise<string>;
}

/** Test double: deterministic, no network. */
export class FakeTranslator implements Translator {
  calls: { text: string; to: string; from?: string }[] = [];
  async translate(text: string, opts: { to: string; from?: string }) {
    this.calls.push({ text, ...opts });
    return `[${opts.to}] ${text}`;
  }
}

/** Real implementation backed by DeepL. */
export class DeepLTranslator implements Translator {
  constructor(
    private apiKey = process.env.DEEPL_API_KEY!,
    private apiUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com/v2/translate",
  ) {}
  async translate(text: string, opts: { to: string; from?: string }) {
    const body = new URLSearchParams({ text, target_lang: opts.to });
    if (opts.from) body.set("source_lang", opts.from);
    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) throw new Error(`DeepL error ${res.status}`);
    const json = (await res.json()) as { translations: { text: string }[] };
    return json.translations[0].text;
  }
}
