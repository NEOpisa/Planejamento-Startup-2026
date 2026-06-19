"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sbGet, sbUpdate } from "@/lib/supabase";
import type { Cliente, ClienteStatus, ItemOrcamento } from "@/hooks/useClientes";

const STATUS_BADGE: Record<ClienteStatus, { className: string; label: string }> = {
  pendente: { className: "status-pendente", label: "◌ Pendente" },
  "em-andamento": { className: "status-em-andamento", label: "⏳ Em andamento" },
  finalizado: { className: "status-finalizado", label: "✓ Finalizado" },
};

const ORIGEM_LABEL: Record<string, string> = {
  orcamento: "🧮 Orçamento sob medida",
  pacote: "📦 Pacote pronto",
};

const FLUXO: Partial<Record<ClienteStatus, ClienteStatus>> = {
  pendente: "em-andamento",
  "em-andamento": "finalizado",
};
const ACTION_LABEL: Partial<Record<ClienteStatus, string>> = {
  pendente: "Iniciar atendimento",
  "em-andamento": "Marcar como finalizado",
};

function fmtData(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

function val(v: unknown): string | null {
  return v && v !== "null" ? String(v) : null;
}

export default function ClienteDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [estado, setEstado] = useState<"loading" | "ok" | "notfound">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await sbGet<Record<string, unknown>>("Clientes", `id=eq.${id}`);
      if (cancelled) return;
      const raw = data[0];
      if (!raw) {
        setEstado("notfound");
        return;
      }
      const status = raw.Status as ClienteStatus;
      setCliente({
        id: raw.id as number,
        Nome: (raw.Nome as string) ?? "",
        Tipo: val(raw.Tipo),
        Status: ["pendente", "em-andamento", "finalizado"].includes(status) ? status : "pendente",
        "Obs.": val(raw["Obs."]),
        Email: val(raw.Email),
        Telefone: val(raw.Telefone),
        Origem: val(raw.Origem),
        Itens: Array.isArray(raw.Itens) ? (raw.Itens as ItemOrcamento[]) : null,
        Valor: raw.Valor != null && raw.Valor !== "" ? Number(raw.Valor) : null,
        Criado_em: val(raw.Criado_em),
      });
      setEstado("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function avancar() {
    if (!cliente) return;
    const novo = FLUXO[cliente.Status];
    if (!novo) return;
    await sbUpdate("Clientes", cliente.id, { Status: novo });
    setCliente({ ...cliente, Status: novo });
  }

  async function excluir() {
    if (!cliente) return;
    const nome = cliente.Nome || cliente.Email || cliente.Telefone || "este cliente";
    if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/clientes/${cliente.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Não foi possível excluir.");
      return;
    }
    router.push("/clientes");
  }

  if (estado === "loading") {
    return (
      <main className="inner">
        <p className="empty-state" style={{ paddingTop: 80 }}>Carregando…</p>
      </main>
    );
  }

  if (estado === "notfound" || !cliente) {
    return (
      <main className="inner">
        <div className="page-header">
          <h1 className="page-heading">Cliente não encontrado</h1>
          <p className="page-sub">O registro #{id} não existe ou foi removido.</p>
        </div>
        <Link href="/clientes" className="detail-back">← Voltar para a lista</Link>
      </main>
    );
  }

  const nomeExibido = cliente.Nome || cliente.Email || cliente.Telefone || "Sem nome";
  const badge = STATUS_BADGE[cliente.Status];
  const acao = ACTION_LABEL[cliente.Status];
  const criadoEm = fmtData(cliente.Criado_em);

  return (
    <main className="inner">
      <Link href="/clientes" className="detail-back">← Voltar para a lista</Link>

      <div className="detail-head">
        <div className="entity-avatar detail-avatar">{nomeExibido.charAt(0).toUpperCase()}</div>
        <div>
          <h1 className="detail-name">{nomeExibido}</h1>
          <div className="detail-badges">
            <span className="entity-tipo">{cliente.Tipo || "—"}</span>
            {cliente.Origem && (
              <span className="status-badge status-origem">{ORIGEM_LABEL[cliente.Origem] ?? cliente.Origem}</span>
            )}
            <span className={`status-badge ${badge.className}`}>{badge.label}</span>
          </div>
          {criadoEm && <div className="detail-date">Recebido em {criadoEm}</div>}
        </div>
      </div>

      <div className="detail-grid">
        {(cliente.Email || cliente.Telefone) && (
          <section className="detail-block">
            <h2 className="info-block-label">Contato</h2>
            <div className="detail-contact">
              {cliente.Email && (
                <a className="detail-contact-item" href={`mailto:${cliente.Email}`}>
                  ✉️ {cliente.Email}
                </a>
              )}
              {cliente.Telefone && (
                <a
                  className="detail-contact-item"
                  href={`https://wa.me/${cliente.Telefone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 {cliente.Telefone}
                </a>
              )}
            </div>
          </section>
        )}

        {cliente.Itens && cliente.Itens.length > 0 && (
          <section className="detail-block">
            <h2 className="info-block-label">Itens do orçamento</h2>
            <ul className="detail-itens">
              {cliente.Itens.map((item, i) => (
                <li key={i}>
                  <span>{item.label}</span>
                  {item.price != null && <span className="detail-item-price">R$ {item.price.toLocaleString("pt-BR")}</span>}
                </li>
              ))}
            </ul>
            {cliente.Valor != null && (
              <div className="detail-total">
                <span>Total estimado</span>
                <strong>R$ {cliente.Valor.toLocaleString("pt-BR")}</strong>
              </div>
            )}
          </section>
        )}

        {cliente["Obs."] && (
          <section className="detail-block">
            <h2 className="info-block-label">Observações</h2>
            <p className="info-block-text" style={{ whiteSpace: "pre-wrap" }}>{cliente["Obs."]}</p>
          </section>
        )}
      </div>

      <div className="detail-actions">
        {acao && (
          <button className="entity-action-btn" onClick={() => void avancar()}>{acao}</button>
        )}
        <button className="lead-delete detail-delete" onClick={() => void excluir()}>
          Excluir cliente
        </button>
      </div>
    </main>
  );
}
