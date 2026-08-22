/**
 * As salas na memória do processo.
 *
 * É o registro do `server.mjs`: um processo só serve tudo, então a lista de
 * quem está em cada sala pode viver aqui mesmo. Não há persistência de
 * propósito — uma sala é uma conversa, e conversa que acabou não precisa
 * continuar existindo em disco.
 *
 * O irmão deste arquivo é o `registro-redis.mjs`, que faz o mesmo quando não
 * há um processo só: na Vercel, duas pessoas da mesma sala podem cair em
 * instâncias diferentes, e uma lista em memória seria duas listas.
 */

import { LIMITES } from "./protocolo.mjs";

export function criarRegistroMemoria() {
  /** sala → Map<id, participante> */
  const salas = new Map();
  /** sala → função que entrega às conexões locais */
  const assinantes = new Map();

  return {
    nome: "memória",

    async entrar(sala, p) {
      if (!salas.has(sala)) salas.set(sala, new Map());
      const gente = salas.get(sala);
      const jaEstava = gente.has(p.id);

      if (!jaEstava && gente.size >= LIMITES.POR_SALA) {
        return {
          erro:
            `esta sala já está com ${LIMITES.POR_SALA} pessoas, que é o limite. ` +
            `A conversa é direta entre os navegadores, e acima disso a conexão de ` +
            `quem tem internet mais fraca começa a sofrer.`,
        };
      }

      // Quem volta mantém o que já havia dito sobre si (microfone, tela): a
      // reconexão não é uma pessoa nova, é a mesma continuando.
      const antigo = gente.get(p.id);
      gente.set(p.id, { ...p, mudo: antigo?.mudo ?? p.mudo, tela: antigo?.tela ?? p.tela });

      return { participantes: [...gente.values()].map((o) => ({ ...o })), jaEstava };
    },

    async sair(sala, id, conexao) {
      const gente = salas.get(sala);
      const p = gente?.get(id);
      // A conexão velha da mesma aba não apaga a nova.
      if (!p || (conexao && p.conexao !== conexao)) return false;
      gente.delete(id);
      // Sala vazia é sala que não existe: guardar o registro dela seria uma
      // lista crescente de nomes de sala, para sempre, sem servir a ninguém.
      if (gente.size === 0) salas.delete(sala);
      return true;
    },

    async atualizar(sala, id, campos) {
      const p = salas.get(sala)?.get(id);
      if (!p) return { mudo: false, tela: false };
      Object.assign(p, campos);
      return { mudo: p.mudo, tela: p.tela };
    },

    async listar(sala) {
      return [...(salas.get(sala)?.values() ?? [])].map((o) => ({ ...o }));
    },

    /** Em memória não há outras instâncias: publicar é entregar. */
    async publicar(sala, msg) {
      assinantes.get(sala)?.(msg);
    },

    async assinar(sala, entregar) {
      assinantes.set(sala, entregar);
    },

    async desassinar(sala) {
      assinantes.delete(sala);
    },

    /** Sem TTL aqui: quem morre, morre pelo fechamento do socket. */
    async tocar() {},

    /** Nada a varrer: não há como uma entrada ficar órfã em memória. */
    async varrer() {
      return [];
    },

    async encerrar() {},
  };
}
