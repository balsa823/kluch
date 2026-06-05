import { expect, test } from "vitest";
import { FakeTranslator } from "../translate.js";

test("fake translator records calls and returns a tagged string", async () => {
  const tr = new FakeTranslator();
  const out = await tr.translate("Voda ne radi", { to: "EN" });
  expect(out).toBe("[EN] Voda ne radi");
  expect(tr.calls).toHaveLength(1);
  expect(tr.calls[0].to).toBe("EN");
});
