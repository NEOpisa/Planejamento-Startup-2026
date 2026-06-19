"use client";

import { useCallback, useEffect, useState } from "react";
import { sbGet, sbInsert, sbUpdate } from "@/lib/supabase";

export type ClienteStatus = "pendente" | "em-andamento" | "finalizado";

/** Item de orçamento gravado pelo site principal (coluna jsonb "Itens"). */
export interface ItemOrcamento {
  label: string;
  price: number | null;
}

export interface Cliente {
  id: number | string;
  Nome: string;
  Tipo: string | null;
  Status: ClienteStatus;
  "Obs.": string | null;
  Email: string | null;
  Telefone: string | null;
  /** Origem do lead: "orcamento", "pacote" ou null (cadastro manual). */
  Origem: string | null;
  Itens: ItemOrcamento[] | null;
  Valor: number | null;
  Criado_em: string | null;
}

export interface NovoCliente {
  Nome: string;
  Tipo: string | null;
  Status: ClienteStatus;
  "Obs.": string | null;
  Email?: string | null;
  Telefone?: string | null;
}

const STATUS_VALIDOS: ClienteStatus[] = ["pendente", "em-andamento", "finalizado"];
const FLUXO: Partial<Record<ClienteStatus, ClienteStatus>> = {
  pendente: "em-andamento",
  "em-andamento": "finalizado",
};

function texto(v: unknown): string | null {
  return v && v !== "null" ? String(v) : null;
}

function normalizar(c: Partial<Cliente> & Record<string, unknown>): Cliente {
  const status = c.Status as string;
  const valor = c.Valor as unknown;
  return {
    id: c.id as number | string,
    Nome: (c.Nome as string) ?? "",
    Status: STATUS_VALIDOS.includes(status as ClienteStatus) ? (status as ClienteStatus) : "pendente",
    Tipo: texto(c.Tipo),
    "Obs.": texto(c["Obs."]),
    Email: texto(c.Email),
    Telefone: texto(c.Telefone),
    Origem: texto(c.Origem),
    Itens: Array.isArray(c.Itens) ? (c.Itens as ItemOrcamento[]) : null,
    Valor: valor != null && valor !== "" ? Number(valor) : null,
    Criado_em: texto(c.Criado_em),
  };
}

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await sbGet<Record<string, unknown>>("Clientes");
      if (cancelled) return;
      setClientes(data.map(normalizar));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addCliente = useCallback(async (dados: NovoCliente) => {
    const salvo = await sbInsert<Record<string, unknown>>("Clientes", dados);
    if (!salvo) return false;
    setClientes((prev) => [...prev, normalizar(salvo)]);
    return true;
  }, []);

  const avancarStatus = useCallback(
    async (id: number | string) => {
      const cliente = clientes.find((c) => String(c.id) === String(id));
      if (!cliente) return;
      const novoStatus = FLUXO[cliente.Status];
      if (!novoStatus) return;
      await sbUpdate("Clientes", cliente.id, { Status: novoStatus });
      setClientes((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? { ...c, Status: novoStatus } : c))
      );
    },
    [clientes]
  );

  return { clientes, addCliente, avancarStatus };
}
