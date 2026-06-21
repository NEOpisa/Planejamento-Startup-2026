"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sbGet, sbUpdate } from "@/lib/supabase";
import { normalizar, type Cliente, type ClienteStatus } from "@/hooks/useClientes";
import EquipeGate from "@/components/clientes/EquipeGate";
import { useAuth } from "@/hooks/useAuth";

const STATUS_BADGE: Record<ClienteStatus, { className: string; label: string }> = {
  pendente: { className: "status-pendente", label: "Pendente" },
  "em-andamento": { className: "status-em-andamento", label: "Em andamento" },
  finalizado: { className: "status-finalizado", label: "Finalizado" },
};

function waLink(tel: string): string {
  const d = tel.replace(/\D/g, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${num}`;
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ClienteDetailPage() {
  return (
    <EquipeGate>
      <ClienteDetalhe />
    </EquipeGate>
  );
}

function ClienteDetalhe() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [cliente, setCliente] = useState<Cliente | null | undefined>(undefined);
  const [excluindo, setExcluindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { vendedor } = useAuth();

  async function iniciarAtendimento() {
    if (!cliente || cliente.Atendente || !vendedor || salvando) return;
    setSalvando(true);
    await sbUpdate("Clientes", cliente.id, { Status: "em-andamento", Atendente: vendedor });
    setCliente({ ...cliente, Status: "em-andamento", Atendente: vendedor });
    setSalvando(false);
  }

  async function finalizarAtendimento() {
    if (!cliente || cliente.Status === "finalizado" || salvando) return;
    setSalvando(true);
    await sbUpdate("Clientes", cliente.id, { Status: "finalizado" });
    setCliente({ ...cliente, Status: "finalizado" });
    setSalvando(false);
  }

  async function excluir() {
    if (!id || excluindo) return;
    if (!window.confirm("Excluir este cliente? Esta ação não pode ser desfeita.")) return;
    setExcluindo(true);
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/clientes");
        return;
      }
    } catch {
      /* ignora — trata abaixo */
    }
    setExcluindo(false);
    alert("Não foi possível excluir agora.");
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const rows = await sbGet<Record<string, unknown>>("Clientes", `id=eq.${id}`);
      if (cancelled) return;
      setCliente(rows[0] ? normalizar(rows[0]) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const badge = cliente ? STATUS_BADGE[cliente.Status] : null;

  return (
    <main className="inner cliente-detail">
      <Link href="/clientes" className="detail-back">
        ← Voltar para clientes
      </Link>

      {cliente === undefined && <p className="empty-state">Carregando…</p>}
      {cliente === null && <p className="empty-state">Cliente não encontrado.</p>}

      {cliente && badge && (
        <>
          <div className="page-header">
            <span className="section-eyebrow">
              {cliente.Origem ? "Atendimento via site" : "Cliente"}
            </span>
            <h1 className="page-heading">{cliente.Nome || "—"}</h1>
            <p className="page-sub">
              <span>{cliente.Tipo || "—"}</span>
              {"  "}
              <span className={`status-badge ${badge.className}`}>{badge.label}</span>
            </p>
          </div>

          <div className="detail-actions">
            {cliente.Status === "finalizado" ? (
              <span className="detail-status-note">
                Atendimento finalizado{cliente.Atendente ? ` por ${cliente.Atendente}` : ""}.
              </span>
            ) : cliente.Atendente && cliente.Atendente !== vendedor ? (
              <span className="detail-status-note">Em atendimento por {cliente.Atendente}.</span>
            ) : cliente.Status === "em-andamento" ? (
              <button className="btn-save" onClick={() => void finalizarAtendimento()} disabled={salvando}>
                {salvando ? "Salvando…" : "Finalizar atendimento"}
              </button>
            ) : (
              <button className="btn-save" onClick={() => void iniciarAtendimento()} disabled={salvando}>
                {salvando ? "Salvando…" : "Iniciar atendimento"}
              </button>
            )}
          </div>

          <div className="detail-blocks">
            {cliente.Atendente && (
              <div className="info-block">
                <div className="info-block-label">Em atendimento por</div>
                <div className="info-block-text">{cliente.Atendente}</div>
              </div>
            )}

            {(cliente.Telefone || cliente.Email) && (
              <div className="info-block">
                <div className="info-block-label">Contato</div>
                <div className="info-block-text lead-contato">
                  {cliente.Telefone && (
                    <a href={waLink(cliente.Telefone)} target="_blank" rel="noopener noreferrer">
                      WhatsApp · {cliente.Telefone}
                    </a>
                  )}
                  {cliente.Email && <a href={`mailto:${cliente.Email}`}>{cliente.Email}</a>}
                </div>
              </div>
            )}

            {cliente.Itens && cliente.Itens.length > 0 && (
              <div className="info-block">
                <div className="info-block-label">Diagnóstico</div>
                <ul className="info-block-text lead-itens">
                  {cliente.Itens.map((it, i) => (
                    <li key={i}>
                      {it.label}
                      {it.price != null ? ` — R$ ${it.price.toLocaleString("pt-BR")}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cliente.Valor != null && (
              <div className="info-block">
                <div className="info-block-label">Valor estimado</div>
                <div className="info-block-text">R$ {cliente.Valor.toLocaleString("pt-BR")}</div>
              </div>
            )}

            {cliente.Origem && (
              <div className="info-block">
                <div className="info-block-label">Origem</div>
                <div className="info-block-text">
                  {cliente.Origem === "atendimento" ? "Atendimento via site" : cliente.Origem}
                </div>
              </div>
            )}

            {cliente.Criado_em && (
              <div className="info-block">
                <div className="info-block-label">Recebido em</div>
                <div className="info-block-text">{formatarData(cliente.Criado_em)}</div>
              </div>
            )}
          </div>

          <div className="cliente-excluir-row">
            <button type="button" className="cliente-excluir" onClick={excluir} disabled={excluindo}>
              {excluindo ? "Excluindo…" : "Excluir cliente"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
