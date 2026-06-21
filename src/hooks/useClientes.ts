"use client";

import { useCallback, useEffect, useState } from "react";
import { sbGet, sbInsert, sbUpdate } from "@/lib/supabase";

export type ClienteStatus = "pendente" | "em-andamento" | "finalizado";

export interface ClienteItem {
  label: string;
  price: number | null;
}

export interface Cliente {
  id: number | string;
  Nome: string;
  Tipo: string | null;
  Status: ClienteStatus;
  Atendente: string | null;
  Criado_em: string | null;
  "Obs.": string | null;
  // Campos do lead inbound (site NVGHUB → /api/lead). Nulos em cadastro manual.
  Email: string | null;
  Telefone: string | null;
  Origem: string | null;
  Itens: ClienteItem[] | null;
  Valor: number | null;
}

export interface NovoCliente {
  Nome: string;
  Tipo: string | null;
  Status: ClienteStatus;
  Atendente?: string | null;
  "Obs."?: string | null;
}

const STATUS_VALIDOS: ClienteStatus[] = ["pendente", "em-andamento", "finalizado"];

function limpar(v: unknown): string | null {
  return typeof v === "string" && v && v !== "null" ? v : null;
}

export function normalizar(c: Partial<Cliente> & Record<string, unknown>): Cliente {
  const status = c.Status as string;
  const itens = Array.isArray(c.Itens)
    ? (c.Itens as unknown[])
        .filter((i): i is ClienteItem => !!i && typeof (i as ClienteItem).label === "string")
        .map((i) => ({
          label: String((i as ClienteItem).label),
          price: typeof (i as ClienteItem).price === "number" ? (i as ClienteItem).price : null,
        }))
    : null;
  return {
    id: c.id as number | string,
    Nome: (c.Nome as string) ?? "",
    Status: STATUS_VALIDOS.includes(status as ClienteStatus) ? (status as ClienteStatus) : "pendente",
    Tipo: limpar(c.Tipo),
    Atendente: limpar(c.Atendente),
    Criado_em: limpar(c.Criado_em),
    "Obs.": limpar(c["Obs."]),
    Email: limpar(c.Email),
    Telefone: limpar(c.Telefone),
    Origem: limpar(c.Origem),
    Itens: itens && itens.length ? itens : null,
    Valor: typeof c.Valor === "number" ? c.Valor : null,
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

  // Pegar o cliente pra si: vira "em-andamento" e registra o atendente.
  // Trava no primeiro: só permite se ainda não houver atendente.
  const atender = useCallback(
    async (id: number | string, vendedor: string) => {
      const cliente = clientes.find((c) => String(c.id) === String(id));
      if (!cliente || cliente.Atendente) return false;
      await sbUpdate("Clientes", cliente.id, { Status: "em-andamento", Atendente: vendedor });
      setClientes((prev) =>
        prev.map((c) =>
          String(c.id) === String(id) ? { ...c, Status: "em-andamento", Atendente: vendedor } : c
        )
      );
      return true;
    },
    [clientes]
  );

  const finalizar = useCallback(
    async (id: number | string) => {
      const cliente = clientes.find((c) => String(c.id) === String(id));
      if (!cliente || cliente.Status === "finalizado") return;
      await sbUpdate("Clientes", cliente.id, { Status: "finalizado" });
      setClientes((prev) =>
        prev.map((c) => (String(c.id) === String(id) ? { ...c, Status: "finalizado" } : c))
      );
    },
    [clientes]
  );

  return { clientes, addCliente, atender, finalizar };
}
