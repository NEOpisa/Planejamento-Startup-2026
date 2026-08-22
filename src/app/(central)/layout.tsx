import MobileBar from "@/components/shell/MobileBar";
import RailLeft from "@/components/shell/RailLeft";
import RailRight from "@/components/shell/RailRight";

/**
 * A telinha do NVGHUB, aqui dentro: trilho de rotas à esquerda, coluna de
 * painéis no meio, trilho de utilidades à direita. Os trilhos são fixos e
 * nunca somem — no telefone eles viram o menu da barra do topo.
 *
 * É um grupo de rotas — `(central)` não aparece na URL — para que a home
 * continue em `/`, o plano em `/plano`, e o NVDISC fique **fora** deste
 * esqueleto sem precisar de um segundo endereço.
 */
export default function CentralLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      <MobileBar />
      <div className="sh">
        <RailLeft />
        <main className="sh-main" id="main">
          {children}
        </main>
        <RailRight />
      </div>
    </>
  );
}
