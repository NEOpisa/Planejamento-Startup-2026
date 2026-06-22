// Tipos e constantes da área de missões (client + server).
// Colunas capitalizadas seguindo o padrão das tabelas do projeto (Clientes, etc).
// Status reaproveita os mesmos valores/cores do resto do app (status-badge).

export type MissaoStatus = "pendente" | "em-andamento" | "finalizado";
export type MissaoPrioridade = "baixa" | "media" | "alta";
export type MissaoTipo = "empresa" | "propria";

export function isTipo(v: unknown): v is MissaoTipo {
  return v === "empresa" || v === "propria";
}

export const STATUSES: { value: MissaoStatus; label: string; badge: string }[] = [
  { value: "pendente", label: "Pendente", badge: "status-pendente" },
  { value: "em-andamento", label: "Em andamento", badge: "status-em-andamento" },
  { value: "finalizado", label: "Concluída", badge: "status-finalizado" },
];

export const PRIORIDADES: { value: MissaoPrioridade; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

export const STATUS_VALUES = STATUSES.map((s) => s.value);
export const PRIO_VALUES = PRIORIDADES.map((p) => p.value);

export function isStatus(v: unknown): v is MissaoStatus {
  return typeof v === "string" && (STATUS_VALUES as string[]).includes(v);
}
export function isPrioridade(v: unknown): v is MissaoPrioridade {
  return typeof v === "string" && (PRIO_VALUES as string[]).includes(v);
}
export function statusLabel(v: string): string {
  return STATUSES.find((s) => s.value === v)?.label ?? v;
}
export function statusBadge(v: string): string {
  return STATUSES.find((s) => s.value === v)?.badge ?? "status-pendente";
}
export function prioridadeLabel(v: string): string {
  return PRIORIDADES.find((p) => p.value === v)?.label ?? v;
}

export interface Missao {
  id: number | string;
  Titulo: string;
  Descricao: string | null;
  Responsavel: string | null;
  Responsavel_id: string | null;
  Owner_id: string | null;
  Tipo: MissaoTipo;
  Status: MissaoStatus;
  Prioridade: MissaoPrioridade;
  Prazo: string | null;
}

/** Payload de uma missão DA EMPRESA (criada pelo admin via rota server-side). */
export interface NovaMissao {
  Titulo: string;
  Descricao: string | null;
  Responsavel: string | null;
  Responsavel_id: string | null;
  Prioridade: MissaoPrioridade;
  Prazo: string | null;
}

/** Payload de uma missão PRÓPRIA (criada pelo próprio membro via RLS). */
export interface NovaMissaoPropria {
  Titulo: string;
  Descricao: string | null;
  Prioridade: MissaoPrioridade;
  Prazo: string | null;
}

export function normalizeMissao(r: Record<string, unknown>): Missao {
  const status = r.Status as string;
  const prio = r.Prioridade as string;
  const tipo = r.Tipo as string;
  const clean = (v: unknown) => (v && v !== "null" ? (v as string) : null);
  return {
    id: r.id as number | string,
    Titulo: (r.Titulo as string) ?? "",
    Descricao: clean(r.Descricao),
    Responsavel: clean(r.Responsavel),
    Responsavel_id: clean(r.Responsavel_id),
    Owner_id: clean(r.Owner_id),
    Tipo: isTipo(tipo) ? tipo : "empresa",
    Status: isStatus(status) ? status : "pendente",
    Prioridade: isPrioridade(prio) ? prio : "media",
    Prazo: clean(r.Prazo),
  };
}
