import { createHmac, timingSafeEqual } from "node:crypto";

/** base64url-encodes a Buffer (no padding). */
function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Computes the HMAC-SHA256 signature of a body string. */
function sign(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/**
 * Signs a payload into a `body.sig` token. The body is the base64url JSON of the
 * payload plus an `exp` epoch-seconds field (`now + ttlSeconds`); a negative ttl
 * yields an already-expired token. The signature is base64url(HMAC-SHA256(body, secret)).
 */
export function signToken(payload: object, secret: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp })));
  const sig = b64url(sign(body, secret));
  return `${body}.${sig}`;
}

/**
 * Verifies a `body.sig` token. Returns the parsed payload, or null if the token is
 * malformed, the signature is invalid, or `exp` is in the past. Uses a constant-time
 * comparison for the signature.
 */
export function verifyToken<T = any>(token: string, secret: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  try {
    const expected = sign(body, secret);
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length) return null;
    if (!timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof payload?.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as T;
  } catch {
    return null;
  }
}
