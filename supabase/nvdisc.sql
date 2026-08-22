-- NVDISC — a tabela das salas.
--
-- Rode isto uma vez no seu projeto (Supabase → SQL Editor → New query →
-- colar → Run). É tudo o que o Supabase precisa ter para a sala funcionar.
--
-- O que ela guarda: quem está em qual sala, agora. Nada de histórico, nada de
-- conversa: o chat vive na memória de quem está na sala e some junto, e a voz
-- nunca passa por aqui — ela vai direto de um navegador ao outro.
--
-- Uma linha some sozinha de três formas: quando a pessoa sai (a função apaga),
-- quando ela para de dar sinal de vida (a varredura apaga), e — se as duas
-- falharem, porque uma instância morreu no meio — quando alguém varrer a sala
-- depois. Não há tarefa agendada de propósito: numa hospedagem serverless não
-- haveria onde ela rodar.

create table if not exists public.nvdisc_participantes (
  sala      text        not null,
  id        text        not null,
  nome      text        not null,
  mudo      boolean     not null default false,
  tela      boolean     not null default false,
  -- a marca da conexão atual: é o que impede a conexão velha de uma aba que
  -- reconectou de apagar a linha nova dela mesma
  conexao   text        not null,
  visto_em  timestamptz not null default now(),
  primary key (sala, id)
);

-- A varredura procura por sala e por quem não dá sinal há tempo demais.
create index if not exists nvdisc_participantes_varredura
  on public.nvdisc_participantes (sala, visto_em);

-- A tabela é fechada: quem fala com ela é a função da Vercel, com a chave
-- secreta, e nunca o navegador. Com o RLS ligado e nenhuma política criada,
-- as chaves públicas não leem nem escrevem nada aqui — e a chave secreta
-- passa por cima do RLS, que é justamente o arranjo que se quer.
alter table public.nvdisc_participantes enable row level security;
