"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MicIcon } from "@/components/icons";
import { CATALOGO } from "@/lib/ferramentas";
import {
  limparNome,
  limparSala,
  salaAleatoria,
  LIMITES,
} from "@/lib/protocolo.mjs";
import { comBase } from "@/lib/base.mjs";
import "./nvdisc.css";
import "./porta.css";

export default function Porta() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [sala, setSala] = useState("");
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    try {
      setNome(localStorage.getItem("nvdisc:nome") ?? "");
    } catch {
      /* armazenamento opcional */
    }
    const convite = new URLSearchParams(location.search).get("sala");
    if (convite) setSala(limparSala(convite));
    setPronto(true);
  }, []);
  function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!limparNome(nome) || !limparSala(sala)) return;
    try {
      localStorage.setItem("nvdisc:nome", limparNome(nome));
    } catch {
      /* a sala também permite informar o nome */
    }
    router.push(comBase(`/sala/${encodeURIComponent(limparSala(sala))}`));
  }
  return (
    <div className="porta">
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="porta-nav">
        <a
          className="porta-marca"
          href={comBase("")}
          aria-label="NVDISC início"
        >
          <span className="porta-simbolo" aria-hidden="true">
            n/
          </span>{" "}
          nvdisc<span className="porta-marca-ponto">®</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#possibilidades">Recursos</a>
          <a
            href="https://neovanguard.com.br"
            target="_blank"
            rel="noopener noreferrer"
          >
            Neovanguard <ArrowUpRight />
          </a>
        </nav>
        <a href="#entrar" className="porta-nav-cta">
          Abrir uma sala <ArrowUpRight />
        </a>
      </header>
      <main id="main">
        <section className="porta-hero" aria-labelledby="titulo">
          <div className="porta-editorial">
            <h1 id="titulo">
              Sua sala.
              <br />
              <span>Sua conversa.</span>
            </h1>
            <p className="porta-descricao">Voz, tela e chat. Sem cadastro.</p>
            <div className="porta-arte" aria-hidden="true">
              <div className="porta-orbita porta-orbita--a" />
              <div className="porta-orbita porta-orbita--b" />
              <div className="porta-frequencia">
                {Array.from({ length: 39 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${16 + Math.abs(Math.sin(i * 0.71)) * (80 - Math.abs(i - 19) * 2.5)}%`,
                      animationDelay: `${i * -0.13}s`,
                    }}
                  />
                ))}
              </div>
              <span className="porta-arte-numero">01 / ∞</span>
            </div>
          </div>
          <div className="porta-entrada" id="entrar">
            <div className="porta-entrada-topo">
              <span className="porta-kicker">NVDISC</span>
              <MicIcon />
            </div>
            <h2>Entrar na sala</h2>

            <form onSubmit={entrar}>
              <label htmlFor="nome">Seu nome</label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={LIMITES.NOME}
                placeholder="Seu nome ou apelido"
                autoComplete="nickname"
                required
              />
              <div className="porta-label-linha">
                <label htmlFor="sala">Código da sala</label>
                <button type="button" onClick={() => setSala(salaAleatoria())}>
                  Criar um código <ArrowUpRight />
                </button>
              </div>
              <input
                id="sala"
                value={sala}
                onChange={(e) => setSala(e.target.value)}
                maxLength={LIMITES.SALA}
                placeholder="Ex.: noite-de-ideias"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                aria-describedby="codigo-ajuda"
              />
              <p id="codigo-ajuda" className="porta-ajuda">
                Use o mesmo código do seu grupo.
              </p>
              <button
                className="porta-entrar"
                type="submit"
                disabled={!pronto || !limparNome(nome) || !limparSala(sala)}
              >
                Entrar na sala <ArrowUpRight />
              </button>
            </form>
          </div>
        </section>
        <section
          id="possibilidades"
          className="porta-recursos"
          aria-labelledby="recursos-titulo"
        >
          <div className="porta-sec-cab">
            <h2 id="recursos-titulo">Na mesma sala.</h2>
          </div>
          <div className="porta-feature-grid">
            <article className="porta-feature porta-feature--voz">
              <span className="porta-feature-num">01 / CONECTAR</span>
              <div className="porta-dupla" aria-hidden="true">
                <span>oi.</span>
                <span>fala!</span>
              </div>
              <h3>Voz</h3>
              <p>Controle de ruído e volume individual.</p>
            </article>
            <article className="porta-feature porta-feature--tela">
              <span className="porta-feature-num">02 / COMPARTILHAR</span>
              <div className="porta-mini-tela" aria-hidden="true">
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  Ideias à vista.
                  <ArrowUpRight />
                </span>
              </div>
              <h3>Compartilhar tela</h3>
              <p>Compartilhe uma janela ou aba com seu grupo.</p>
            </article>
            <article className="porta-feature">
              <span className="porta-feature-num">03 / FAZER JUNTO</span>
              <div className="porta-nota" aria-hidden="true">
                a próxima
                <br />
                grande ideia <span>↗</span>
              </div>
              <h3>Ferramentas</h3>
              <p>Quadro, notas, enquetes e temporizador.</p>
            </article>
          </div>
          <details className="porta-detalhes">
            <summary>
              Explore todas as ferramentas <span>+</span>
            </summary>
            <div>
              {CATALOGO.map((f) => (
                <article key={f.id}>
                  <h3>{f.titulo}</h3>
                  <p>{f.para}</p>
                </article>
              ))}
            </div>
          </details>
        </section>
      </main>
      <footer className="porta-footer">
        <a className="porta-marca" href={comBase("")}>
          nvdisc®
        </a>
        <span>Neovanguard</span>
      </footer>
    </div>
  );
}
