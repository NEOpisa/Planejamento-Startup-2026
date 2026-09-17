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
          <a href="#possibilidades">O que rola aqui</a>
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
            <p className="porta-kicker">
              <span /> UM LUGAR PARA ESTAR JUNTO
            </p>
            <h1 id="titulo">
              Boa conversa.
              <br />
              Zero <span>distância.</span>
            </h1>
            <p className="porta-descricao">
              Seu grupo, suas ideias, seu espaço. Entre na voz, compartilhe a
              tela e deixe a conversa acontecer.
            </p>
            <div className="porta-promessas">
              <span>Sem cadastro</span>
              <span>Até 8 pessoas</span>
              <span>Sem gravação</span>
            </div>
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
              <span className="porta-arte-label">
                MENOS DISTÂNCIA. MAIS PRESENÇA.
              </span>
              <span className="porta-arte-numero">01 / ∞</span>
            </div>
          </div>
          <div className="porta-entrada" id="entrar">
            <div className="porta-entrada-topo">
              <span className="porta-kicker">A CONVERSA COMEÇA AQUI</span>
              <MicIcon />
            </div>
            <h2>Puxa uma cadeira.</h2>
            <p>Um nome e um código. O resto é com vocês.</p>
            <form onSubmit={entrar}>
              <label htmlFor="nome">Como podemos te chamar?</label>
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
                Recebeu um convite? Use o código do seu grupo.
              </p>
              <button
                className="porta-entrar"
                type="submit"
                disabled={!pronto || !limparNome(nome) || !limparSala(sala)}
              >
                Entrar na sala <ArrowUpRight />
              </button>
            </form>
            <div className="porta-entrada-rodape">
              <span className="porta-mini-onda" aria-hidden="true">
                ▂▅▇▃▆
              </span>
              <span>
                Mesma sala. Mesmo momento.
                <br />
                <small>Compartilhe o código e encontre sua turma.</small>
              </span>
            </div>
          </div>
        </section>
        <div className="porta-faixa">
          <span>CONVERSAS QUE VIRAM IDEIAS</span>
          <span aria-hidden="true">✳</span>
          <span>IDEIAS QUE JUNTAM GENTE</span>
          <span aria-hidden="true">✳</span>
          <span>DO SEU JEITO</span>
        </div>
        <section
          id="possibilidades"
          className="porta-recursos"
          aria-labelledby="recursos-titulo"
        >
          <div className="porta-sec-cab">
            <p className="porta-kicker">MUITO ALÉM DO “TÁ ME OUVINDO?”</p>
            <h2 id="recursos-titulo">
              Um espaço.
              <br />
              <span>Mil possibilidades.</span>
            </h2>
            <p>
              Para uma partida, um projeto ou só colocar o papo em dia. Tudo
              fica perto, sem sair da conversa.
            </p>
          </div>
          <div className="porta-feature-grid">
            <article className="porta-feature porta-feature--voz">
              <span className="porta-feature-num">01 / CONECTAR</span>
              <div className="porta-dupla" aria-hidden="true">
                <span>oi.</span>
                <span>fala!</span>
              </div>
              <h3>A voz aproxima.</h3>
              <p>
                Áudio com controle de ruído e volume individual. Cada pessoa
                encontra seu jeito de ouvir.
              </p>
              <span className="porta-tag">VOZ EM TEMPO REAL</span>
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
              <h3>Mostra. Explica. Cria.</h3>
              <p>
                Sua tela vira o ponto de encontro. Compartilhe uma janela, uma
                aba e, quando disponível, o som dela.
              </p>
              <span className="porta-tag">TELA + SOM</span>
            </article>
            <article className="porta-feature">
              <span className="porta-feature-num">03 / FAZER JUNTO</span>
              <div className="porta-nota" aria-hidden="true">
                a próxima
                <br />
                grande ideia <span>↗</span>
              </div>
              <h3>O papo ganha forma.</h3>
              <p>
                Quadro, notas, enquetes e temporizador. Ferramentas que
                acompanham o ritmo do grupo.
              </p>
              <span className="porta-tag">COLABORAÇÃO</span>
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
        <section className="porta-final">
          <p className="porta-kicker">PODE CHEGAR.</p>
          <h2>
            A melhor parte
            <br />é quem está <em>do outro lado.</em>
          </h2>
          <a href="#entrar">
            Encontre sua turma <ArrowUpRight />
          </a>
        </section>
      </main>
      <footer className="porta-footer">
        <a className="porta-marca" href={comBase("")}>
          nvdisc®
        </a>
        <span>Feito para conectar. Por Neovanguard.</span>
        <span>Mais encontros em breve.</span>
      </footer>
    </div>
  );
}
