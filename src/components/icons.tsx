/*
 * Os ícones da central — os mesmos traços do site público.
 *
 * São desenhos, e não emoji, por uma razão que aparece na primeira captura de
 * tela mandada a um cliente: emoji tem cor própria, tamanho próprio e desenho
 * diferente em cada sistema. Um traço de 1,6 px na cor do texto se comporta
 * como o resto da interface — e envelhece junto com ela.
 */

export function ArrowUpRight({ size }: { size?: number } = {}) {
  return (
    <svg
      {...(size ? { width: size, height: size } : {})}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

/**
 * O microfone.
 *
 * Tinha nascido sem `width`/`height`, contando com o CSS de quem o usasse
 * para dar tamanho — e num botão que não dizia nada ele cresceu até 200 px e
 * estourou a barra de controles inteira. Ícone que depende de alguém lembrar
 * de dimensioná-lo é uma armadilha esperando o próximo uso: aqui todos têm
 * tamanho próprio, com o padrão que serve à maioria dos casos.
 */
export function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </svg>
  );
}

type Props = { size?: number };

function Traco({ size = 16, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function MicOffIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M12 15a3 3 0 0 0 3-3V9m-6 0v3a3 3 0 0 0 1.2 2.4" />
      <path d="M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.3 6.2M12 18v3" />
      <path d="M3 3l18 18" />
    </Traco>
  );
}

export function TelaIcon(p: Props) {
  return (
    <Traco {...p}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </Traco>
  );
}

export function PararIcon(p: Props) {
  return (
    <Traco {...p}>
      <rect x="5" y="5" width="14" height="14" rx="2.5" />
    </Traco>
  );
}

export function AjustesIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </Traco>
  );
}

export function SairIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </Traco>
  );
}

export function AlertaIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M12 4.5 2.8 19.5h18.4L12 4.5Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </Traco>
  );
}

export function ExpandirIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </Traco>
  );
}
