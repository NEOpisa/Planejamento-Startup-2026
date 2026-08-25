"use client";

/**
 * NVDISC — a porta.
 *
 * Esta tela não é um login, e o que ela mostra primeiro diz isso: não há
 * conta, não há senha, não há "continuar com". É uma **tela de escolha** —
 * para onde ir dentro da casa —, e o destino que existe hoje é a sala de voz,
 * que abre aqui mesmo, em dois campos.
 *
 * Os destinos por vir aparecem marcados, e não escondidos. Quem chega pela
 * primeira vez quer saber o tamanho da casa; um destino apagado da tela não
 * conta essa história, e um destino que parece pronto e não abre é pior
 * ainda.
 *
 * O nome fica no navegador (`localStorage`) só para não ser redigitado — ele
 * nunca sai daqui para lugar nenhum a não ser a sala em que você entrar.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileBar from "@/components/shell/MobileBar";
import RailLeft from "@/components/shell/RailLeft";
import RailRight from "@/components/shell/RailRight";
import Foot from "@/components/shell/Foot";
import { ArrowUpRight, MicIcon } from "@/components/icons";
import { DESTINOS } from "@/lib/navegacao";
import { CATALOGO } from "@/lib/ferramentas";
import { limparNome, limparSala, salaAleatoria, LIMITES } from "@/lib/protocolo.mjs";
import { comBase } from "@/lib/base.mjs";
import "./nvdisc.css";

export default function Porta() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [sala, setSala] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setNome(localStorage.getItem("nvdisc:nome") ?? "");
    // O código da URL (`?sala=xyz`) vence o que estiver guardado: é assim que
    // um link compartilhado leva a pessoa para a sala certa.
    const daUrl = new URLSearchParams(location.search).get("sala");
    if (daUrl) setSala(limparSala(daUrl));
    setPronto(true);
  }, []);

  const nomeOk = limparNome(nome).length > 0;
  const salaOk = limparSala(sala).length > 0;

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeOk || !salaOk) return;
    localStorage.setItem("nvdisc:nome", limparNome(nome));
    router.push(comBase(`/sala/${encodeURIComponent(limparSala(sala))}`));
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      <MobileBar />

      <div className="sh">
        <RailLeft />

        <main className="sh-main" id="main">
          {/* ── a escolha, e a única que hoje leva a algum lugar ────────── */}
          <section className="panel" aria-labelledby="porta-h" id="entrar">
            <span className="eyebrow">Neovanguard · para onde ir</span>
            <h1 id="porta-h" className="h-xl" style={{ marginTop: 20 }}>
              Escolha um destino.
              <br />
              <em className="h-accent">A sala abre aqui.</em>
            </h1>
            <p className="lead">
              A conversa vai <strong>direto</strong> de um computador ao outro.
              O servidor só apresenta vocês — não passa áudio, não passa vídeo,
              e nada fica gravado.
            </p>

            <form onSubmit={entrar} className="entrada">
              <div className="entrada-campo">
                <label htmlFor="nome">Seu nome</label>
                <input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={LIMITES.NOME}
                  placeholder="como te chamam"
                  autoComplete="off"
                />
              </div>

              <div className="entrada-campo">
                <label htmlFor="sala">Código da sala</label>
                <div className="entrada-linha">
                  <input
                    id="sala"
                    value={sala}
                    onChange={(e) => setSala(e.target.value)}
                    maxLength={LIMITES.SALA}
                    placeholder="churrasco"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="pill pill--ghost"
                    onClick={() => setSala(salaAleatoria())}
                  >
                    sortear
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="pill pill--accent entrada-ir"
                disabled={!pronto || !nomeOk || !salaOk}
              >
                <MicIcon />
                Entrar na sala
              </button>
            </form>

            <p className="entrada-nota">
              Qualquer palavra serve como código. Quem digitar o mesmo código
              cai na mesma sala — é assim que vocês se encontram, e é tudo o
              que faz as vezes de convite.
            </p>
          </section>

          {/* ── as portas ──────────────────────────────────────────────── */}
          <section className="panel" aria-labelledby="destinos-h">
            <header className="sec-head">
              <span className="eyebrow">A casa</span>
              <h2 id="destinos-h" className="h-lg">
                Quatro destinos, <em className="h-accent">um endereço só.</em>
              </h2>
            </header>

            <div className="portas">
              {DESTINOS.map((d) =>
                d.breve ? (
                  <div key={d.titulo} className="door door--breve" aria-disabled="true">
                    <ConteudoDaPorta {...d} />
                  </div>
                ) : d.externo ? (
                  <a
                    key={d.titulo}
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="door"
                  >
                    <ConteudoDaPorta {...d} />
                  </a>
                ) : (
                  <a key={d.titulo} href="#entrar" className="door">
                    <ConteudoDaPorta {...d} />
                  </a>
                ),
              )}
            </div>
          </section>

          {/* ── o que existe dentro da sala ────────────────────────────── */}
          <section className="panel" aria-labelledby="ferr-h">
            <header className="sec-head">
              <span className="eyebrow">Dentro da sala</span>
              <h2 id="ferr-h" className="h-lg">
                Ferramentas <em className="h-accent">para usar falando.</em>
              </h2>
            </header>
            <p className="lead">
              Elas ficam no menu de ferramentas, ao lado do chat. Quem abre o
              quadro ou as notas é dono deles: todo mundo vê, e quem quiser
              mexer pede licença.
            </p>

            <div className="cards">
              {CATALOGO.map((f) => (
                <article key={f.id} className="card">
                  <span className="card-n">{f.resumo}</span>
                  <h3 className="card-t">{f.titulo}</h3>
                  <p className="card-d">{f.para}</p>
                  <div className="card-tags">
                    <span className="chip">{f.dono ? "com dono" : "aberta a todos"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <Foot />
        </main>

        <RailRight />
      </div>
    </>
  );
}

/** O miolo de uma porta — igual nas três formas que ela pode assumir. */
function ConteudoDaPorta({
  n,
  titulo,
  d,
  cta,
  breve,
}: {
  n: string;
  titulo: string;
  d: string;
  cta: string;
  breve?: boolean;
}) {
  return (
    <>
      <span className="door-flag">
        {n} · {breve ? "em breve" : "no ar"}
      </span>
      <h3>{titulo}</h3>
      <p>{d}</p>
      <span className="door-cta">
        {cta}
        {!breve && <ArrowUpRight />}
      </span>
    </>
  );
}
