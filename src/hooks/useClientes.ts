"use client";

import { useCallback, useEffect, useState } from "react";
import { sbGet, sbInsert, sbUpdate } from "@/lib/supabase";

export type ClienteStatus = "pendente" | "em-andamento" | "finalizado";

export interface Cliente {
  id: number | string;
  Nome: string;
  Tipo: string | null;
  Status: ClienteStatus;
  "Obs.": string | null;
}

export interface NovoCliente {
  Nome: string;
  Tipo: string | null;
  Status: ClienteStatus;
  "Obs.": string | null;
}

const STATUS_VALIDOS: ClienteStatus[] = ["pendente", "em-andamento", "finalizado"];
const FLUXO: Partial<Record<ClienteStatus, ClienteStatus>> = {
  pendente: "em-andamento",
  "em-andamento": "finalizado",
};

function normalizar(c: Partial<Cliente> & Record<string, unknown>): Cliente {
  const status = c.Status as string;
  return {
    id: c.id as number | string,
    Nome: (c.Nome as string) ?? "",
    Status: STATUS_VALIDOS.includes(status as ClienteStatus) ? (status as ClienteStatus) : "pendente",
    Tipo: c.Tipo && c.Tipo !== "null" ? (c.Tipo as string) : null,
    "Obs.": c["Obs."] && c["Obs."] !== "null" ? (c["Obs."] as string) : null,
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
