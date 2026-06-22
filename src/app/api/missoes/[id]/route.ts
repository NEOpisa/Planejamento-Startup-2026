import { NextResponse } from "next/server";
import { getServerSupabase, sbServerHeaders } from "@/lib/supabaseServer";
import { isStatus, isPrioridade } from "@/lib/missoes";
import { isAuthed, passwordConfigured } from "@/lib/missoesAuth";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function authGuard(req: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json({ error: "Gerenciamento desativado. Defina MISSOES_PASSWORD." }, { status: 503 });
  }
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Faça login para gerenciar missões." }, { status: 401 });
  }
  return null;
}

// PATCH /api/missoes/[id] — atualiza status e/ou prioridade (exige login).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authGuard(req);
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return NextResponse.json({ error: "Missão inválida." }, { status: 400 });

  let body: {
    Status?: unknown; Prioridade?: unknown;
    Responsavel?: unknown; Responsavel_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  if (body.Status !== undefined) {
    if (!isStatus(body.Status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    patch.Status = body.Status;
  }
  if (body.Prioridade !== undefined) {
    if (!isPrioridade(body.Prioridade)) return NextResponse.json({ error: "Prioridade inválida." }, { status: 400 });
    patch.Prioridade = body.Prioridade;
  }
  // Reatribuição (só o admin, que já passou pelo authGuard, chega aqui).
  if (body.Responsavel_id !== undefined) {
    if (body.Responsavel_id === null || body.Responsavel_id === "") {
      patch.Responsavel_id = null;
    } else if (typeof body.Responsavel_id === "string" && UUID_RE.test(body.Responsavel_id)) {
      patch.Responsavel_id = body.Responsavel_id;
    } else {
      return NextResponse.json({ error: "Responsável inválido." }, { status: 400 });
    }
  }
  if (body.Responsavel !== undefined) {
    patch.Responsavel = typeof body.Responsavel === "string" && body.Responsavel.trim()
      ? body.Responsavel.trim().slice(0, 120)
      : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const cfg = getServerSupabase();
  if (!cfg) return NextResponse.json({ error: "Serviço indisponível no momento." }, { status: 500 });

  try {
    const res = await fetch(`${cfg.url}/rest/v1/Missoes?id=eq.${id}`, {
      method: "PATCH",
      headers: sbServerHeaders(cfg.key, { Prefer: "return=representation" }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const detalhe = await res.text();
      console.error("[missoes] PATCH falhou:", res.status, detalhe);
      return NextResponse.json({ error: "Não foi possível atualizar a missão." }, { status: 502 });
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ missao: rows[0] });
  } catch (err) {
    console.error("[missoes] erro inesperado no PATCH:", err);
    return NextResponse.json({ error: "Erro interno ao atualizar a missão." }, { status: 500 });
  }
}

// DELETE /api/missoes/[id] — remove a missão (exige login).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authGuard(req);
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return NextResponse.json({ error: "Missão inválida." }, { status: 400 });

  const cfg = getServerSupabase();
  if (!cfg) return NextResponse.json({ error: "Serviço indisponível no momento." }, { status: 500 });

  try {
    const res = await fetch(`${cfg.url}/rest/v1/Missoes?id=eq.${id}`, {
      method: "DELETE",
      headers: sbServerHeaders(cfg.key, { Prefer: "return=minimal" }),
    });
    if (!res.ok) {
      const detalhe = await res.text();
      console.error("[missoes] DELETE falhou:", res.status, detalhe);
      return NextResponse.json({ error: "Não foi possível remover a missão." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[missoes] erro inesperado no DELETE:", err);
    return NextResponse.json({ error: "Erro interno ao remover a missão." }, { status: 500 });
  }
}
