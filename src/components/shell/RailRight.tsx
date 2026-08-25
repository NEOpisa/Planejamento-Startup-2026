import { FATOS } from "@/lib/navegacao";
import { CATALOGO } from "@/lib/ferramentas";

/**
 * TRILHO DIREITO — contexto, nunca destino. Responde às três perguntas que
 * alguém faz antes de entrar numa sala pela primeira vez: isto está de pé, o
 * que acontece com o que eu falar, e o que dá para fazer aqui dentro. Rotas
 * moram no trilho da esquerda, e nenhuma se repete aqui.
 */
export default function RailRight() {
  return (
    <aside className="rail rail-right" aria-label="Sobre a sala">
      <div className="rcard">
        <span className="rcard-h">Estado</span>
        <p className="rstatus">
          <i aria-hidden="true" />
          No ar · sala aberta
        </p>
        <p className="rcard-note">
          A voz vai direto de um navegador ao outro. O servidor só apresenta
          vocês — não passa áudio, não passa vídeo, e nada fica gravado.
        </p>
      </div>

      <div className="rcard">
        <span className="rcard-h">A sala em números</span>
        <dl className="rfatos">
          {FATOS.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rcard">
        <span className="rcard-h">Ferramentas lá dentro</span>
        <ul className="rferr">
          {CATALOGO.map((f) => (
            <li key={f.id}>
              <b>{f.titulo}</b>
              <span>{f.resumo}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rmeta">
        <span>Sem conta, sem cadastro, sem cookie de rastreio</span>
      </div>
    </aside>
  );
}
