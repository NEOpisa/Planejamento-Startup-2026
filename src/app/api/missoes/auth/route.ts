import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  COOKIE_MAX_AGE,
  isAuthed,
  passwordConfigured,
  tokenForPassword,
} from "@/lib/missoesAuth";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const lastRequests = new Map<string, number[]>();

function isRateLimited(ip: string) {
  const now = Date.now();
  const timestamps = (lastRequests.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    lastRequests.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  lastRequests.set(ip, timestamps);
  return false;
}

// GET — estado do login (a UI usa para decidir o que mostrar).
export async function GET(req: Request) {
  return NextResponse.json({ required: passwordConfigured(), authed: isAuthed(req) });
}

// POST — login com a senha (env MISSOES_PASSWORD); seta o cookie httpOnly.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const pw = process.env.MISSOES_PASSWORD;
  if (!pw) {
    return NextResponse.json({ error: "Login não configurado. Defina MISSOES_PASSWORD." }, { status: 503 });
  }

  let body: { senha?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (typeof body.senha !== "string" || body.senha !== pw) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, tokenForPassword(pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

// DELETE — logout (limpa o cookie).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
