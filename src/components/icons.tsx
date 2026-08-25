/*
 * Os ícones da central — os mesmos traços do site público.
 *
 * São desenhos, e não emoji, por uma razão que aparece na primeira captura de
 * tela mandada a um cliente: emoji tem cor própria, tamanho próprio e desenho
 * diferente em cada sistema. Um traço de 1,6 px na cor do texto se comporta
 * como o resto da interface — e envelhece junto com ela.
 */

export function ArrowUpRight({ size }: Props = {}) {
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

export function ImagemIcon(p: Props) {
  return (
    <Traco {...p}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m3.5 17 4.8-4.6a2 2 0 0 1 2.8 0L16 17.4M14.5 15l2-1.9a2 2 0 0 1 2.8 0l1.2 1.2" />
    </Traco>
  );
}

export function VolumeIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" />
      <path d="M15.6 9.4a4 4 0 0 1 0 5.2M18.3 7a7.5 7.5 0 0 1 0 10" />
    </Traco>
  );
}

export function FecharIcon(p: Props) {
  return (
    <Traco {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Traco>
  );
}

/*
 * Os ícones das ferramentas da sala.
 *
 * Todos no mesmo cofre de 24, com traço de 1,9 px — um pouco mais fino que o
 * dos controles de chamada, que são maiores e ficam sempre visíveis. Estes
 * vivem em linhas de menu, onde traço grosso vira mancha.
 */

/** O menu das ferramentas: quatro quadrados, a grade de sempre. */
export function FerramentasIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </Traco>
  );
}

/** O quadro: um lápis. */
export function QuadroIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      <path d="M14 6l4 4" />
    </Traco>
  );
}

/** As notas: folha com linhas. */
export function NotasIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 12.5h7M8.5 16.5h5" />
    </Traco>
  );
}

/** A fila de fala: uma mão levantada. */
export function MaoIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M9 11V4.6a1.6 1.6 0 0 1 3.2 0V11" />
      <path d="M12.2 10.4V3.8a1.6 1.6 0 0 1 3.2 0V11" />
      <path d="M15.4 11V6.4a1.6 1.6 0 0 1 3.2 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.7-2.3l-3-3.9a1.6 1.6 0 0 1 2.3-2.2L9 15V4.6" />
    </Traco>
  );
}

/** A enquete: três barras de altura diferente. */
export function EnqueteIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M5 20V11M12 20V4M19 20v-6" />
    </Traco>
  );
}

/** O temporizador: relógio com o botão em cima. */
export function TempoIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.5l2.4 1.6M9.5 2.5h5" />
    </Traco>
  );
}

/** O cadeado — a permissão que falta. */
export function CadeadoIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.4" />
      <path d="M8 10.5V7.4a4 4 0 0 1 8 0v3.1" />
    </Traco>
  );
}

/** A borracha do quadro. */
export function LimparIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M8.5 20.5H20M4.6 16.9l4.7 4.7 10-10a2 2 0 0 0 0-2.8l-2-2a2 2 0 0 0-2.8 0l-10 10a2 2 0 0 0 0 2.8Z" />
    </Traco>
  );
}

/** Desfazer: a seta que volta. */
export function DesfazerIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M4 8h11a5 5 0 0 1 0 10h-5" />
      <path d="M7.5 4.5 4 8l3.5 3.5" />
    </Traco>
  );
}

/** O chat: um balão de fala. */
export function ChatIcon(p: Props) {
  return (
    <Traco size={18} {...p}>
      <path d="M20.5 12.4a7.6 7.6 0 0 1-8.2 7.5l-5 1.6 1.5-4.2a7.6 7.6 0 1 1 11.7-4.9Z" />
      <path d="M9 11h6M9 14.5h3.5" />
    </Traco>
  );
}
