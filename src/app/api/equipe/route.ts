import { NextResponse } from "next/server";

// Valida a senha única da equipe (server-side; a senha nunca vai pro bundle).
export async function POST(req: Request) {
  let body: { senha?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const senha = typeof body.senha === "string" ? body.senha : "";
  const esperada = process.env.EQUIPE_SENHA;
  if (!esperada) {
    console.error("[equipe] EQUIPE_SENHA não configurada.");
    return NextResponse.json({ error: "Login indisponível no momento." }, { status: 500 });
  }
  if (senha !== esperada) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
