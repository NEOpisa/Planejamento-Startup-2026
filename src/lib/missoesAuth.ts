// Login da área de missões: só para gerenciar (criar/editar/remover).
// A senha vem da env MISSOES_PASSWORD (configurada na Vercel). O cookie guarda
// só um HMAC da senha — nunca a senha em si — e é httpOnly.

import crypto from "crypto";

export const AUTH_COOKIE = "missoes_auth";
const AUTH_PAYLOAD = "missoes-auth-v1";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export function passwordConfigured(): boolean {
  return !!process.env.MISSOES_PASSWORD;
}

export function tokenForPassword(pw: string): string {
  return crypto.createHmac("sha256", pw).update(AUTH_PAYLOAD).digest("hex");
}

export function getExpectedToken(): string | null {
  const pw = process.env.MISSOES_PASSWORD;
  return pw ? tokenForPassword(pw) : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function isAuthed(req: Request): boolean {
  const expected = getExpectedToken();
  if (!expected) return false; // sem senha configurada => ninguém entra
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  if (!match) return false;
  const val = decodeURIComponent(match.slice(AUTH_COOKIE.length + 1));
  return timingSafeEqual(val, expected);
}
