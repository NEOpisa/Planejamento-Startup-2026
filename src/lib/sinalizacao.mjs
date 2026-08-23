/**
 * A sinalização — o protocolo da sala, sem saber onde está rodando.
 *
 * Ela existe separada porque o NVDISC passou a ter **duas casas**: o
 * `server.mjs`, um processo só que serve tudo, e uma função da Vercel, que
 * nasce e morre e pode nem ser a mesma instância entre duas conexões. O que
 * muda entre as duas é **onde a lista de quem está na sala vive** — memória
 * num caso, Redis no outro. O que não muda é isto aqui: quem entra, quem sai,
 * quem fala com quem.
 *
 * Duas cópias desta lógica seriam duas chances de a sala funcionar num lugar
 * e não no outro, com um sintoma idêntico nos dois: "entrei e não vejo
 * ninguém".
 *
 * O identificador do participante é a **sessão da aba**, e não um número novo
 * a cada conexão. Isso importa porque na Vercel a conexão cai no teto de
 * duração da função (cinco minutos no padrão) e volta: com identificador
 * novo, os outros veriam uma pessoa sair e outra entrar a cada cinco minutos,
 * e as conexões de áudio seriam refeitas do zero — a chamada engasgaria
 * sozinha, para sempre. Com o identificador estável, a reconexão não mexe em
 * nada: a mídia continua indo direto de um navegador ao outro, que é onde ela
 * sempre esteve.
 */

import { PARA_CLIENTE, PARA_SERVIDOR, LIMITES, limparNome, limparSala, limparSessao, limparImagem } from "./protocolo.mjs";

/**
 * Quanto tempo uma aba tem para voltar antes de ser dada como saída.
 *
 * Fechar o socket não diz por quê. Numa hospedagem que corta a função no teto
 * de duração — cinco minutos na Vercel —, anunciar a saída na hora faria os
 * outros derrubarem a conexão de áudio com essa pessoa a cada cinco minutos,
 * e a chamada engasgaria sozinha sem ninguém entender por quê. Quem sai de
 * propósito manda `SAIR` e some na hora; quem só caiu tem estes segundos para
 * reaparecer, e ninguém fica sabendo.
 */
const CARENCIA = 12_000;

/** Só o que o outro lado precisa saber de um participante. */
function publico(p) {
  return { id: p.id, nome: p.nome, mudo: p.mudo, tela: p.tela };
}

/**
 * Manda uma mensagem, a menos que o socket já esteja indo embora.
 *
 * A guarda é pelo que **impede** o envio (fechando, fechado), e não pelo que
 * o permite (`readyState === 1`). Parece o mesmo e não é: cada hospedagem
 * embrulha o WebSocket na sua própria classe, e uma que não exponha
 * `readyState` faria a condição positiva falhar para sempre — o servidor
 * processaria tudo certo e não responderia nada, que é o defeito mais
 * difícil de enxergar que existe: sem erro, sem log, sem fechamento.
 */
function envia(ws, tipo, corpo = {}) {
  try {
    const estado = ws.readyState;
    if (estado === 2 || estado === 3) return;
    ws.send(JSON.stringify({ tipo, ...corpo }));
  } catch {
    /* socket já foi */
  }
}

/**
 * @param {object} registro onde a lista de salas vive (memória ou Redis)
 */
export function criarSinalizacao(registro) {
  /** Os sockets **desta** instância, por sala. Sala → id → ws. */
  const locais = new Map();

  /** Entrega uma mensagem do barramento aos sockets locais da sala. */
  function entregar(sala, { paraId, exceto, tipo, corpo }) {
    const gente = locais.get(sala);
    if (!gente) return;
    if (paraId) {
      const ws = gente.get(paraId);
      if (ws) envia(ws, tipo, corpo);
      return;
    }
    for (const [id, ws] of gente) {
      if (id === exceto) continue;
      envia(ws, tipo, corpo);
    }
  }

  async function registrarLocal(sala, id, ws) {
    if (!locais.has(sala)) {
      locais.set(sala, new Map());
      await registro.assinar(sala, (msg) => entregar(sala, msg));
    }
    locais.get(sala).set(id, ws);
  }

  async function esquecerLocal(sala, id) {
    const gente = locais.get(sala);
    if (!gente) return;
    gente.delete(id);
    if (gente.size === 0) {
      locais.delete(sala);
      await registro.desassinar(sala);
    }
  }

  /** Cada conexão nova passa por aqui. `ws` é um WebSocket de servidor. */
  function aoConectar(ws) {
    /** @type {{sala: string, id: string, nome: string, conexao: string, chatEm: number[], deliberado: boolean} | null} */
    let eu = null;

    async function entrar(dados) {
      const sala = limparSala(dados.sala);
      const nome = limparNome(dados.nome) || "anônimo";
      const sessao = limparSessao(dados.sessao);

      if (!sala) {
        envia(ws, PARA_CLIENTE.ERRO, { motivo: "código de sala inválido" });
        return null;
      }
      // Uma aba que não se identifica ainda entra: pode ser uma página aberta
      // antes desta versão subir, e barrá-la seria derrubar quem já estava
      // conversando no meio de um deploy. Ela só perde o que a identificação
      // dá — voltar para a sala como a mesma pessoa depois de uma queda.
      const id = sessao || `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      // A marca desta conexão. Serve para a conexão velha da mesma aba não
      // apagar da sala a nova quando finalmente perceber que morreu.
      const conexao = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const p = { id, nome, mudo: false, tela: false, conexao };

      const mortos = await registro.varrer(sala);
      for (const morto of mortos) {
        await registro.publicar(sala, { tipo: PARA_CLIENTE.SAIU, corpo: { id: morto } });
      }

      const r = await registro.entrar(sala, p);
      if (r.erro) {
        envia(ws, PARA_CLIENTE.ERRO, { motivo: r.erro });
        return null;
      }

      // A conexão anterior desta mesma aba, se ainda estiver aqui, sai agora:
      // duas conexões vivas com o mesmo identificador se atrapalhariam.
      const anterior = locais.get(sala)?.get(id);
      if (anterior && anterior !== ws) {
        try {
          anterior.close();
        } catch {
          /* já fechada */
        }
      }
      await registrarLocal(sala, id, ws);

      // A lista vai **antes** de anunciar a chegada: assim quem entra já sabe
      // com quem falar, e quem estava lá recebe um `ENTROU` de alguém que a
      // lista do recém-chegado já contempla.
      envia(ws, PARA_CLIENTE.BEMVINDO, {
        voceId: id,
        sala,
        participantes: r.participantes.filter((o) => o.id !== id),
      });

      // Quem volta (reconexão) não é novidade para ninguém: só se anuncia
      // quem de fato chegou agora.
      if (!r.jaEstava) {
        await registro.publicar(sala, {
          tipo: PARA_CLIENTE.ENTROU,
          corpo: publico(p),
          exceto: id,
        });
      }
      return { sala, id, nome, conexao, chatEm: [], deliberado: false };
    }

    /** Rajada de chat: janela deslizante de 10 s por conexão. */
    function podeFalar() {
      const agora = Date.now();
      eu.chatEm = eu.chatEm.filter((t) => agora - t < 10_000);
      if (eu.chatEm.length >= LIMITES.CHAT_RAJADA) return false;
      eu.chatEm.push(agora);
      return true;
    }

    async function aoReceber(bruto) {
      let msg;
      try {
        msg = JSON.parse(bruto);
      } catch {
        return; // lixo entra, lixo é ignorado — não vale derrubar a conexão
      }
      if (!msg || typeof msg.tipo !== "string") return;

      // Antes de entrar, a única mensagem aceita é a de entrar.
      if (!eu) {
        if (msg.tipo !== PARA_SERVIDOR.ENTRAR) return;
        try {
          eu = await entrar(msg);
        } catch (erro) {
          // Sem isto, uma falha no registro (tabela que não existe, banco
          // fora do ar, credencial errada) derruba a conexão calada: o
          // cliente tenta de novo, cai de novo, e a pessoa fica olhando um
          // "reconectando…" que nunca termina, sem nada que a ajude a saber
          // o que houve. Dizer o motivo custa uma linha.
          envia(ws, PARA_CLIENTE.ERRO, {
            motivo:
              `o servidor não conseguiu montar a sala: ${erro?.message ?? erro}. ` +
              `Se este site acabou de subir, é quase sempre o banco das salas ` +
              `faltando — veja "Na Vercel" no README.`,
          });
        }
        return;
      }

      switch (msg.tipo) {
        case PARA_SERVIDOR.PING: {
          // O ping do cliente também é o batimento que segura a pessoa na
          // lista: sem ele, o registro a considera morta e a tira da sala.
          await registro.tocar(eu.sala, eu.id);
          // E é a deixa para varrer quem parou de bater — a instância que
          // morre sem fechar as conexões não deixa outro rastro.
          const mortos = await registro.varrer(eu.sala);
          for (const id of mortos) {
            await registro.publicar(eu.sala, { tipo: PARA_CLIENTE.SAIU, corpo: { id } });
          }
          envia(ws, PARA_CLIENTE.PONG);
          break;
        }

        case PARA_SERVIDOR.SAIR:
          // A pessoa fechou a aba ou clicou em sair: não há o que esperar.
          eu.deliberado = true;
          try {
            ws.close();
          } catch {
            /* o fechamento leva ao `aoFechar` de qualquer jeito */
          }
          break;

        case PARA_SERVIDOR.SINAL:
          // O servidor não lê o conteúdo do sinal — ele é assunto entre os
          // dois navegadores. O que ele garante é a **origem**: `de` é
          // preenchido aqui, e não aceito do cliente, senão qualquer um
          // poderia se passar por qualquer um dentro da sala.
          await registro.publicar(eu.sala, {
            tipo: PARA_CLIENTE.SINAL,
            corpo: { de: eu.id, dados: msg.dados },
            paraId: String(msg.para ?? ""),
          });
          break;

        case PARA_SERVIDOR.CHAT: {
          const texto = String(msg.texto ?? "").slice(0, LIMITES.CHAT).trim();
          const imagem = limparImagem(msg.imagem);
          // Uma imagem sozinha é mensagem legítima; texto vazio sem imagem
          // não é. A validação da imagem é do servidor porque o cliente é
          // quem se quer proteger.
          if ((!texto && !imagem) || !podeFalar()) break;
          await registro.publicar(eu.sala, {
            tipo: PARA_CLIENTE.CHAT,
            corpo: { de: eu.id, nome: eu.nome, texto, imagem, em: Date.now() },
          });
          break;
        }

        case PARA_SERVIDOR.ESTADO: {
          const campos = {};
          if (typeof msg.mudo === "boolean") campos.mudo = msg.mudo;
          if (typeof msg.tela === "boolean") campos.tela = msg.tela;
          const atual = await registro.atualizar(eu.sala, eu.id, campos);
          await registro.publicar(eu.sala, {
            tipo: PARA_CLIENTE.ESTADO,
            corpo: { id: eu.id, mudo: atual.mudo, tela: atual.tela },
          });
          break;
        }
      }
    }

    /** Tira a pessoa da sala e conta aos outros — se ainda for ela mesma. */
    async function retirar(sala, id, conexao) {
      // Só sai de verdade se a sala ainda estiver com **esta** conexão. Se a
      // aba já voltou por outra, quem manda é a nova.
      const saiu = await registro.sair(sala, id, conexao);
      if (saiu) await registro.publicar(sala, { tipo: PARA_CLIENTE.SAIU, corpo: { id } });
    }

    async function aoFechar() {
      if (!eu) return;
      const { sala, id, conexao, deliberado } = eu;
      eu = null;
      await esquecerLocal(sala, id);
      if (deliberado) {
        await retirar(sala, id, conexao);
        return;
      }
      // Sem aviso: pode ser a hospedagem cortando a função. Dá-se o prazo, e
      // quem voltar nesse meio-tempo troca a marca da conexão — aí a retirada
      // não acontece, porque não é mais esta conexão que está na sala.
      setTimeout(() => void retirar(sala, id, conexao), CARENCIA);
    }

    // Nenhuma mensagem pode derrubar a conexão de quem já está na sala: uma
    // falha momentânea do banco viraria uma saída em falso para todo mundo.
    return {
      aoReceber: (bruto) =>
        aoReceber(bruto).catch((erro) => {
          console.error("NVDISC: falha ao tratar mensagem:", erro?.message ?? erro);
        }),
      aoFechar,
    };
  }

  return { aoConectar };
}
