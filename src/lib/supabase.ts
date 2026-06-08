"use client";

let supaUrl: string | null = null;
let supaHeaders: Record<string, string> | null = null;
let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("Falha ao buscar config: " + res.status);
    const cfg = (await res.json()) as { url: string; key: string };
    supaUrl = cfg.url;
    supaHeaders = {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  } catch (e) {
    console.error("initSupabase:", e);
  }
}

export async function initSupabase(): Promise<void> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

export async function sbGet<T = Record<string, unknown>>(
  tabela: string,
  query = "order=id.asc"
): Promise<T[]> {
  await initSupabase();
  if (!supaUrl || !supaHeaders) return [];
  try {
    const res = await fetch(`${supaUrl}/rest/v1/${encodeURIComponent(tabela)}?${query}`, {
      headers: supaHeaders,
    });
    if (!res.ok) {
      console.error("Erro GET", tabela, await res.text());
      return [];
    }
    return res.json();
  } catch (e) {
    console.error("Erro GET", tabela, e);
    return [];
  }
}

export async function sbInsert<T = Record<string, unknown>>(
  tabela: string,
  dados: object
): Promise<T | null> {
  await initSupabase();
  if (!supaUrl || !supaHeaders) return null;
  try {
    const res = await fetch(`${supaUrl}/rest/v1/${encodeURIComponent(tabela)}`, {
      method: "POST",
      headers: supaHeaders,
      body: JSON.stringify(dados),
    });
    if (!res.ok) {
      console.error("Erro INSERT", tabela, await res.text());
      return null;
    }
    const json = await res.json();
    return Array.isArray(json) ? json[0] : json;
  } catch (e) {
    console.error("Erro INSERT", tabela, e);
    return null;
  }
}

export async function sbUpdate(
  tabela: string,
  id: number | string,
  dados: object
): Promise<void> {
  await initSupabase();
  if (!supaUrl || !supaHeaders) return;
  try {
    const res = await fetch(`${supaUrl}/rest/v1/${encodeURIComponent(tabela)}?id=eq.${id}`, {
      method: "PATCH",
      headers: supaHeaders,
      body: JSON.stringify(dados),
    });
    if (!res.ok) console.error("Erro UPDATE", tabela, await res.text());
  } catch (e) {
    console.error("Erro UPDATE", tabela, e);
  }
}

export async function sbUpsert(
  tabela: string,
  dados: object
): Promise<void> {
  await initSupabase();
  if (!supaUrl || !supaHeaders) return;
  try {
    await fetch(`${supaUrl}/rest/v1/${encodeURIComponent(tabela)}`, {
      method: "POST",
      headers: { ...supaHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(dados),
    });
  } catch (e) {
    console.error("Erro UPSERT", tabela, e);
  }
}

/** Deriva um id estável de tarefa a partir do texto (mesma lógica do site original). */
export function taskId(texto: string): string {
  return (
    "task_" +
    texto
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_À-ɏ]/g, "")
      .slice(0, 60)
  );
}
