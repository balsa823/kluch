import { expect, test } from "vitest";
import { signToken, verifyToken } from "../token.js";

const SECRET = "test-secret";

test("round-trip returns the payload", () => {
  const token = signToken({ sub: "user-1", role: "admin" }, SECRET, 60);
  const payload = verifyToken<{ sub: string; role: string; exp: number }>(token, SECRET);
  expect(payload).not.toBeNull();
  expect(payload?.sub).toBe("user-1");
  expect(payload?.role).toBe("admin");
  expect(typeof payload?.exp).toBe("number");
});

test("tampered token returns null", () => {
  const token = signToken({ sub: "user-1" }, SECRET, 60);
  const [body] = token.split(".");
  const tampered = `${body}.deadbeef`;
  expect(verifyToken(tampered, SECRET)).toBeNull();
});

test("malformed token returns null", () => {
  expect(verifyToken("not-a-token", SECRET)).toBeNull();
  expect(verifyToken("", SECRET)).toBeNull();
  expect(verifyToken("a.b.c", SECRET)).toBeNull();
});

test("expired token (negative ttl) returns null", () => {
  const token = signToken({ sub: "user-1" }, SECRET, -60);
  expect(verifyToken(token, SECRET)).toBeNull();
});

test("wrong secret returns null", () => {
  const token = signToken({ sub: "user-1" }, SECRET, 60);
  expect(verifyToken(token, "other-secret")).toBeNull();
});
