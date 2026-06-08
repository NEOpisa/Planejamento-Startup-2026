export interface TeamMember {
  name: string;
  role: string;
  share: string;
}

export const TEAM: TeamMember[] = [
  { name: "Mizael", role: "Gestor Geral · Pure Coder · Revisor · Jurídico & Contábil ext.", share: "25%" },
  { name: "Daniel", role: "Gestor de Inovação · Front-end completo · UI/UX Design", share: "25%" },
  { name: "Kauã", role: "Gestor de Marketing · Vendas · Atendimento ao cliente", share: "25%" },
  { name: "João", role: "Gestor Tático · Back-end · Segurança · Infra digital", share: "25%" },
];

/** Cores categóricas — variáveis CSS dentro da paleta roxa do design system. */
export type CatColor = "violet" | "orchid" | "teal" | "amber" | "magenta";

export interface TaskItem {
  text: string;
  tag: string;
}

export interface TaskGroup {
  title: string;
  color: CatColor;
  tasks: TaskItem[];
}

export interface Meta {
  label: string;
  value: string;
  desc: string;
}

export interface Phase {
  id: string;
  number: number;
  short: string;
  timeline: string;
  title: string;
  description: string;
  groups: TaskGroup[];
  metas: Meta[];
}

export const PHASES: Phase[] = [
  {
    id: "p1",
    number: 1,
    short: "Fundação",
    timeline: "Mês 1–2",
    title: "Fundação & Estrutura",
    description:
      "Estruturar a empresa, definir processos internos, montar portfólio e identidade da marca antes de ir ao mercado.",
    groups: [
      {
        title: "Estrutura base",
        color: "violet",
        tasks: [
          { text: "Definir posições dos Membros e o que cada um faz", tag: "Mizael" },
          { text: "Firmar a base da empresa entre os membros", tag: "Mizael" },
          { text: "Definir precificação inicial de serviços (landing page, site institucional, e-commerce)", tag: "Todos" },
        ],
      },
      {
        title: "Identidade Visual & Marca",
        color: "orchid",
        tasks: [
          { text: "Definir nome, logo e paleta da startup", tag: "Daniel" },
          { text: "Criar site institucional da própria startup", tag: "Daniel + João" },
          { text: "Montar portfólio com 2–3 projetos de demonstração", tag: "Daniel + Mizael" },
        ],
      },
      {
        title: "Infraestrutura Técnica",
        color: "teal",
        tasks: [
          { text: "Fazer testes com clientes reais e definir tempo de entrega", tag: "João" },
          { text: "Definir stack padrão dos projetos de clientes", tag: "João + Mizael" },
          { text: "Criar landing-page propria, Criar repositório de templates e boilerplates internos", tag: "Mizael + Daniel" },
        ],
      },
      {
        title: "Marketing & Prospecção Inicial",
        color: "amber",
        tasks: [
          { text: "Criar perfis profissionais (Instagram, LinkedIn) para a startup", tag: "Kauã" },
          { text: "Mapear 20–30 potenciais clientes locais sem presença digital", tag: "Kauã" },
          { text: "Montar script de abordagem e proposta comercial padrão", tag: "Kauã + Todos" },
        ],
      },
    ],
    metas: [
      { label: "Meta da fase", value: "0 → 1", desc: "Empresa estruturada e pronta para vender" },
      { label: "Duração", value: "8 sem.", desc: "Meses 1 e 2" },
    ],
  },
  {
    id: "p2",
    number: 2,
    short: "Primeiro cliente",
    timeline: "Mês 3–5",
    title: "Primeiro Cliente & Validação",
    description:
      "Conquistar os primeiros 3–5 clientes pagantes, entregar com qualidade e construir reputação inicial.",
    groups: [
      {
        title: "Vendas & Fechamento",
        color: "amber",
        tasks: [
          { text: "Fazer 30+ abordagens (WhatsApp, Instagram, visita presencial)", tag: "Kauã" },
          { text: "Fechar pelo menos 3 projetos pagos (meta mínima de R$400 cada)", tag: "Kauã" },
          { text: "Usar contrato padrão em todo fechamento", tag: "Mizael + Kauã" },
          { text: "Cobrar 50% adiantado, 50% na entrega", tag: "Regra do time" },
        ],
      },
      {
        title: "Entrega dos Projetos",
        color: "orchid",
        tasks: [
          { text: "Definir prazo máximo de entrega por tipo de projeto (ex: landing 7 dias)", tag: "Todos" },
          { text: "Daniel responsável pelo design, Mizael/João pela implementação", tag: "Daniel + Mizael + João" },
          { text: "Pedir depoimento/avaliação após cada entrega", tag: "Kauã" },
        ],
      },
      {
        title: "Operação Interna",
        color: "teal",
        tasks: [
          { text: "Escolher ferramenta de gestão de projetos (Notion, Linear ou Trello)", tag: "Todos" },
          { text: "Realizar reunião semanal de alinhamento (30 min)", tag: "Todos" },
          { text: "Registrar horas/esforço por projeto para embasar precificação futura", tag: "Todos" },
        ],
      },
    ],
    metas: [
      { label: "Meta de receita", value: "R$4,5k+", desc: "3 projetos mínimos na fase" },
      { label: "Meta de clientes", value: "3–5", desc: "Com depoimento/avaliação" },
    ],
  },
  {
    id: "p3",
    number: 3,
    short: "Escala",
    timeline: "Mês 6–12",
    title: "Escala & Produto Próprio",
    description:
      "Crescer a base de clientes, otimizar processos e iniciar desenvolvimento do produto SaaS próprio para receita recorrente.",
    groups: [
      {
        title: "Crescimento de Clientes",
        color: "amber",
        tasks: [
          { text: "Atingir 10+ clientes ativos ou entregues", tag: "Kauã" },
          { text: "Criar plano de manutenção mensal (receita recorrente via MRR)", tag: "Kauã + Todos" },
          { text: "Investir parte do lucro em tráfego pago (Meta Ads / Google Ads)", tag: "Kauã" },
        ],
      },
      {
        title: "Produto Próprio (SaaS)",
        color: "violet",
        tasks: [
          { text: "Validar ideia de produto com clientes atuais (pesquisa/entrevistas)", tag: "Todos" },
          { text: "Desenvolver MVP do produto (6–8 semanas)", tag: "Mizael + Daniel + João" },
          { text: "Lançar em beta para 5 clientes piloto", tag: "Kauã + Todos" },
        ],
      },
      {
        title: "Financeiro & Reinvestimento",
        color: "teal",
        tasks: [
          { text: "Definir política de distribuição de lucros (ex: 60% reinveste, 40% distribui)", tag: "Todos" },
          { text: "Meta de R$15k+ faturamento no ano 1", tag: "Meta geral" },
        ],
      },
      {
        title: "Oficialização da Empresa",
        color: "magenta",
        tasks: [
          { text: "Definir e registrar o nome oficial da empresa (consulta de disponibilidade na Junta Comercial)", tag: "Mizael" },
          { text: "Abrir como ME (Microempresa) com auxílio do contador externo", tag: "Mizael" },
          { text: "Registrar CNPJ e enquadrar no Simples Nacional", tag: "Contábil ext." },
          { text: "Registrar a marca no INPI para proteção do nome e identidade visual", tag: "Jurídico ext." },
          { text: "Redigir e assinar o Acordo de Sócios (vesting, saída, lucros, direito de preferência)", tag: "Jurídico ext. + Todos" },
          { text: "Abrir conta bancária empresarial em nome do CNPJ (Nubank PJ, Inter PJ ou similar)", tag: "Mizael + Todos" },
        ],
      },
    ],
    metas: [
      { label: "Meta faturamento", value: "R$15k", desc: "Ano 1 somando todas as fases" },
      { label: "Meta produto", value: "MVP", desc: "SaaS em beta até mês 12" },
    ],
  },
];

export interface GestorBlock {
  label: string;
  text: string;
}

export interface Gestor {
  initial: string;
  name: string;
  titulo: string;
  color: CatColor;
  blocks: GestorBlock[];
  tags: string[];
}

export const GESTORES: Gestor[] = [
  {
    initial: "M",
    name: "Mizael",
    titulo: "Gestor Geral · Pure Coder · Revisor · Jurídico & Contábil ext.",
    color: "violet",
    blocks: [
      {
        label: "Como Gestor Geral",
        text: "Tem visão transversal de toda a empresa. É o único que precisa entender cada área para garantir que tudo funciona junto. Recebe as descrições de ação de cada sócio antes de executarem, vota por último nas decisões estratégicas e deve explicar seu voto. Também faz a ponte com o jurídico e contábil externos.",
      },
      {
        label: "Como Pure Coder",
        text: "Responsável pela escrita e qualidade do código puro — sem frameworks pesados quando não necessário. Garante que o código entregue ao cliente é limpo, funcional e eficiente.",
      },
      {
        label: "Como Revisor",
        text: "Revisa o trabalho técnico do time antes da entrega ao cliente. Verifica código, estrutura e qualidade geral dos projetos.",
      },
    ],
    tags: ["Visão geral", "Código limpo", "Revisão técnica", "Último voto", "Jurídico ext."],
  },
  {
    initial: "D",
    name: "Daniel",
    titulo: "Gestor de Inovação · Front-end completo · UI/UX Design",
    color: "orchid",
    blocks: [
      {
        label: "Como Gestor de Inovação",
        text: "Lidera as ideias de novos serviços, tendências e diferenciais da empresa. Propõe soluções criativas para clientes e monitora o que há de novo no mercado digital para manter a agência à frente.",
      },
      {
        label: "Como Front-end & UI/UX",
        text: "Responsável pela interface e experiência de todos os projetos entregues aos clientes. Cria o design, prototipa e desenvolve o front-end completo — do visual ao código da tela.",
      },
    ],
    tags: ["Inovação", "Design visual", "Front-end", "Protótipos", "UX/UI"],
  },
  {
    initial: "K",
    name: "Kauã",
    titulo: "Gestor de Marketing · Vendas · Atendimento ao cliente",
    color: "amber",
    blocks: [
      {
        label: "Como Gestor de Marketing",
        text: "Cuida da presença digital da agência, criação de conteúdo, estratégias de atração de clientes e posicionamento de marca. Define como a empresa aparece para o mercado.",
      },
      {
        label: "Como Vendas & Atendimento",
        text: "É o rosto da empresa para o cliente. Faz a prospecção, conduz as negociações, fecha contratos e mantém o relacionamento durante e após a entrega. Garante que o cliente se sinta bem atendido em todo o processo.",
      },
    ],
    tags: ["Marketing digital", "Prospecção", "Fechamento", "Atendimento", "Relacionamento"],
  },
  {
    initial: "J",
    name: "João",
    titulo: "Gestor Tático · Back-end · Segurança · Infraestrutura digital",
    color: "teal",
    blocks: [
      {
        label: "Como Gestor Tático",
        text: "Traduz as decisões estratégicas em ações concretas. Organiza como os projetos são executados tecnicamente, define prazos realistas e garante que a operação técnica da empresa funcione sem falhas.",
      },
      {
        label: "Como Back-end, Segurança & Infra",
        text: "Responsável por toda a parte invisível mas essencial: servidores, banco de dados, APIs, segurança dos sistemas e infraestrutura dos projetos. Garante que o front-end funciona solidamente pelo back-end.",
      },
    ],
    tags: ["Execução tática", "Back-end", "Segurança", "Infraestrutura", "Servidores"],
  },
];

export interface GovItem {
  icon: string;
  text: string;
}

export const GOVERNANCA: GovItem[] = [
  {
    icon: "🗳",
    text: "Decisões estratégicas exigem maioria (Mizael sempre deve ser o último a votar e deve explicar seu voto). Empate = pausa e nova discussão em 24h.",
  },
  {
    icon: "💸",
    text: "Gastos acima de R$500 precisam de aprovação de pelo menos 2 sócios via chat registrado.",
  },
  {
    icon: "🔒",
    text: "Nenhum sócio pode vender sua parte nos primeiros 12 meses (a não ser entre os próprios). Após isso, direito de preferência dos outros 3.",
  },
  {
    icon: "📅",
    text: "Reunião semanal (30 min). Reunião mensal de resultados (1h). Pauta registrada no Notion.",
  },
  {
    icon: "🚪",
    text: "Saída voluntária: sócio deve avisar com 30 dias e negociar valor da participação com os demais.",
  },
  {
    icon: "⚡",
    text: "Cada sócio tem autonomia na sua área, (precisando apenas descrever o que ira fazer para o gestor geral) para decisões técnicas/operacionais do seu escopo.",
  },
  {
    icon: "📊",
    text: "Financeiro transparente: relatório mensal compartilhado com todos (receita, despesa, saldo).",
  },
];

export const GOV_METAS: Meta[] = [
  { label: "Estrutura", value: "4 × 25%", desc: "Partes iguais, Seguir Ordenança" },
  { label: "Prioridade", value: "#1", desc: "Assinar acordo de sócios ainda na fase 1" },
];
