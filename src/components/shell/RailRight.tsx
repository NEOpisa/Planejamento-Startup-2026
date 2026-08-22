import Link from "next/link";

import { FATOS } from "@/lib/navegacao";
import { ArrowUpRight } from "@/components/icons";
import { comBase } from "@/lib/base.mjs";

/**
 * TRILHO DIREITO — utilidades, nunca destinos: o que está de pé, o que a
 * central custa e os dois atalhos que se usa no meio de uma conversa. Rotas
 * moram no trilho da esquerda, e nenhuma se repete aqui.
 */
export default function RailRight() {
  return (
    <aside className="rail rail-right" aria-label="Estado da central">
      <div className="rcard">
        <span className="rcard-h">Estado</span>
        <p className="rstatus">
          <i aria-hidden="true" />
          No ar · tudo em um processo
        </p>
        <p className="rcard-note">
          A mesma máquina serve as páginas e a sinalização da sala. Nada de
          conta, nada de banco de dados.
        </p>
      </div>

      <div className="rcard">
        <span className="rcard-h">A central em números</span>
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
        <span className="rcard-h">Atalhos</span>
        <a href="/calculadora.html" className="rlink">
          Orçar um cliente
          <ArrowUpRight />
        </a>
        <Link href={comBase("/")} className="rlink">
          Chamar o sócio
          <ArrowUpRight />
        </Link>
        <Link href="/plano" className="rlink">
          O que decidir juntos
          <ArrowUpRight />
        </Link>
      </div>

      <div className="rmeta">
        <span>Valores e estratégia não são públicos</span>
      </div>
    </aside>
  );
}
