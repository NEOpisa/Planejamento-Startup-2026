import { NextResponse } from "next/server";
import { getServerSupabase, sbServerHeaders } from "@/lib/supabaseServer";
import { isPrioridade } from "@/lib/missoes";
import { isAuthed, passwordConfigured } from "@/lib/missoesAuth";

export const dynamic = "force-dynamic";

const MAX_LEN = { titulo: 160, descricao: 2000, responsavel: 120 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/missoes — cria uma missão (exige login).
export async function POST(req: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json({ error: "Gerenciamento desativado. Defina MISSOES_PASSWORD." }, { status: 503 });
  }
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Faça login para adicionar missões." }, { status: 401 });
  }

  let body: {
    Titulo?: unknown; Descricao?: unknown; Responsavel?: unknown;
    Prioridade?: unknown; Prazo?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const titulo = typeof body.Titulo === "string" ? body.Titulo.trim() : "";
  const descricao = typeof body.Descricao === "string" ? body.Descricao.trim() : "";
  const responsavel = typeof body.Responsavel === "string" ? body.Responsavel.trim() : "";
  const prioridade = isPrioridade(body.Prioridade) ? body.Prioridade : "media";
  const prazo = typeof body.Prazo === "string" && DATE_RE.test(body.Prazo) ? body.Prazo : null;

  if (!titulo) {
    return NextResponse.json({ error: "Dê um título para a missão." }, { status: 400 });
  }
  if (titulo.length > MAX_LEN.titulo || descricao.length > MAX_LEN.descricao || responsavel.length > MAX_LEN.responsavel) {
    return NextResponse.json({ error: "Um dos campos passou do limite de tamanho." }, { status: 400 });
  }

  const cfg = getServerSupabase();
  if (!cfg) {
    console.error("[missoes] SUPABASE_URL / SUPABASE_SECRET_KEY não configurados.");
    return NextResponse.json({ error: "Serviço indisponível no momento." }, { status: 500 });
  }

  const registro = {
    Titulo: titulo,
    Descricao: descricao || null,
    Responsavel: responsavel || null,
    Prioridade: prioridade,
    Prazo: prazo,
    Status: "pendente",
  };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/Missoes`, {
      method: "POST",
      headers: sbServerHeaders(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(registro),
    });
    if (!res.ok) {
      const detalhe = await res.text();
      console.error("[missoes] insert falhou:", res.status, detalhe);
      return NextResponse.json({ error: "Não foi possível criar a missão agora." }, { status: 502 });
    }
    const rows = await res.json();
    return NextResponse.json({ missao: Array.isArray(rows) ? rows[0] : rows }, { status: 201 });
  } catch (err) {
    console.error("[missoes] erro inesperado no POST:", err);
    return NextResponse.json({ error: "Erro interno ao criar a missão." }, { status: 500 });
  }
}
