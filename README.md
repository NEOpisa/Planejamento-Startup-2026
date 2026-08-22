# Planejamento Neovanguard

Central de ferramentas internas da Neovanguard (Next.js + React).

O visual é o **mesmo sistema do site público** (NVGHUB, `neovanguard.com.br`):
tokens MediumBlue/CornflowerBlue, a "telinha" de trilhos com a coluna de
painéis no meio, e as mesmas peças — painel, cartão, pílula, faixa de números.
Uma ferramenta interna com paleta própria pareceria de outra empresa; quem
abre a calculadora depois do site tem de sentir que continua na mesma casa.

## Telas

| Rota | O que é |
|------|---------|
| `/` | Home com atalhos pras ferramentas |
| `/calculadora` (→ `/calculadora.html`) | Calculadora de precificação (uso interno, offline, single-file) |
| `/plano` | Plano de captação do primeiro cliente |
| `/NVDISC` | Sala de voz, tela e texto — sem conta, sem cadastro |

A home e o plano vivem dentro da telinha (grupo de rotas `(central)`); o
NVDISC fica **fora** dela, com a tela inteira. Uma sala de voz cercada por dois
trilhos de navegação perderia o vídeo para um menu que ninguém abre no meio de
uma chamada.

## Rodar

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de produção
npm start       # produção

npm test              # o servidor do NVDISC: salas, chat, limites
npm run test:navegador  # a chamada de verdade, em dois Chrome
npm run test:instancias  # o arranjo da Vercel: duas instâncias, uma sala
npm run cert          # certificado local, para chamar a turma pela rede
```

Uso interno — valores e estratégia não são públicos.

---

## NVDISC

Voz, tela e texto numa sala. Uma pessoa abre `/NVDISC`, digita um nome e um
código (`churrasco`, o que vier à cabeça) e entra; as outras digitam **o mesmo
código** e caem na mesma sala. Não há convite para aceitar, senha para lembrar
nem conta para criar. O botão **copiar convite** manda um link com o código já
preenchido.

Dentro da sala: o microfone já entra ligado (**`M`** liga e desliga),
`Compartilhar tela` transmite uma janela, uma aba ou o monitor inteiro, e o
chat fica na lateral — no celular, atrás de um botão com contador de não lidas.

Quando alguém compartilha, uma barra **Telas compartilhadas** aparece no alto
do palco: uma aba por pessoa que está mostrando algo, e um clique entra na
tela dela. Com duas ou três pessoas compartilhando ao mesmo tempo, é ali que se
escolhe o que assistir — e o botão na quina da imagem abre em tela cheia (dois
cliques na tela também).

### O som da tela

**O navegador quase nunca entrega o áudio da captura de tela.** O Firefox
ignora o pedido em qualquer situação — o `getDisplayMedia({audio:true})` nunca
foi implementado lá. O Chrome entrega, e só quando se compartilha **uma aba**
com a caixa de áudio marcada: tela inteira e janela vêm mudas.

Por isso existe **Qualidade → Som do computador**. A placa de som expõe a
própria saída como se fosse uma entrada — "Monitor of…" no Linux, "Stereo Mix"
ou "What U Hear" no Windows —, e capturar essa entrada é ouvir o que a máquina
está tocando. Funciona em qualquer navegador, com a tela inteira, e é o
caminho para quem usa Firefox.

Ele vai **misturado à sua voz, numa faixa só**: mandar o som separado
obrigaria a renegociar a conexão com todo mundo bem no momento em que alguém
aperta "compartilhar", que é onde uma malha costuma quebrar.

**Use fone quando ligar isso.** Sem fone, o som que sai pelo alto-falante volta
pelo microfone e vira eco para a sala inteira.

Sem ninguém compartilhando, **as pessoas ocupam o meio da tela**, com o contorno
acendendo em quem fala. Quando alguém compartilha, elas recolhem para uma faixa
embaixo e a tela toma o palco.

### A central passou a ter servidor próprio

Ela vivia com `next start`, que basta para páginas. O NVDISC precisa de uma
conexão **que fica de pé** para apresentar as pessoas de uma sala umas às
outras, e isso `next start` não oferece — função serverless nasce e morre a cada
requisição, e não há onde guardar quem está em qual sala.

Daí o `server.mjs`: um processo só, servindo a home, o plano, a calculadora e o
NVDISC, com o WebSocket da sinalização em `/NVDISC/sinal` no mesmo servidor
HTTP. O custo é uma linha no `package.json`; o ganho é o NVDISC ser uma rota da
central como qualquer outra, e não um segundo serviço para subir com um segundo
endereço para lembrar.

### A conversa não passa pelo servidor

Áudio e vídeo vão direto de um navegador ao outro (WebRTC em malha). O servidor
só apresenta as pessoas e entrega os recados da negociação — por ele passa
texto, e nada mais. Latência menor, custo de servidor quase nulo, e ninguém no
meio do caminho ouvindo.

O preço é o número de conexões crescer ao quadrado: com 8 pessoas cada uma
mantém 7. Por isso o **teto de 8 por sala**.

**Nada é gravado.** Quando o último participante sai, a sala deixa de existir na
memória do servidor. Não há banco de dados — não porque faltou, mas porque
guardar exigiria decidir por quanto tempo, com que segurança e sob quais regras,
e nada disso melhora uma sala de amigos.

### Qualidade

O botão **Qualidade** abre cinco escolhas, que valem na hora:

- **Som** — `Voz` mantém cancelamento de eco e supressão de ruído (é o que
  evita microfonia em quem usa alto-falante); `Música` desliga tudo isso, vai a
  estéreo e sobe a taxa. Nesse modo, **peça fone a todo mundo**.
- **Ruído de fundo** — `Não filtrar` deixa o som passar inteiro; `Padrão` usa
  o supressor do navegador, que tira ventilador, teclado e chiado sem encostar
  na voz; `Forte` acrescenta uma porta: abaixo de um limiar o microfone fica
  fechado, e o que passa é só quando você fala. O `Forte` resolve obra na rua
  e cachorro no quintal, e cobra por isso — começo de palavra dita baixinho
  pode se perder, e respiração some. A porta abre em 8 ms e fecha em 180: abrir
  devagar comeria a primeira sílaba, fechar rápido engoliria o fim das frases.
- **Resolução da tela** — 720p a 4K, ou "Original" (o tamanho nativo do
  monitor).
- **Quadros** — 30 ou 60.
- **Ao apertar a banda** — `Manter nitidez` segura a resolução e deixa cair os
  quadros (certo para código e planilha: texto borrado não se lê); `Manter
  fluidez` faz o inverso (certo para vídeo e jogo).

Sem mexer, o WebRTC entrega Opus **mono a ~32 kbps com DTX** — feito para rede
de celular de 2015, e a razão de a voz soar "de telefone". Aqui são 96 kbps
(256 estéreo no modo música), com FEC ligado (o codec recupera pacote perdido
sozinho, que é o que evita o picote) e DTX desligado (sem corte no silêncio, que
come o começo de palavras faladas baixinho). A voz vai com prioridade de rede
alta: quando a banda aperta, o vídeo cede primeiro.

A malha manda **uma cópia para cada pessoa**, então existe um teto de subida
(12 Mbps) dividido pelo número de pares. Estourar a subida não degrada aos
poucos: enfileira e trava tudo de uma vez, inclusive a voz.

### Onde isto pode rodar

| Onde | O que fazer |
|------|-------------|
| **Vercel** | Precisa de um Redis no projeto (abaixo). |
| **Um processo, tudo junto** | Render, Railway, Fly.io ou um VPS com Node: `npm run build && npm start`, TLS no proxy da frente. É o arranjo mais simples que existe aqui. |
| **Páginas num lugar, sinalização noutro** | Suba o `server.mjs` onde houver processo e aponte as páginas com `NEXT_PUBLIC_SINAL_URL=wss://sinal.seu-dominio` |
| **Na sua rede, sem publicar** | `npm run cert` e suba com TLS. Para chamar quem está na mesma casa, publicar na internet não acrescenta nada. |

### Na Vercel

Funciona, e não funcionava até junho de 2026 — WebSocket em função é recente
lá. Duas coisas precisam estar de pé:

1. **Um lugar compartilhado para a lista das salas** — Supabase ou Redis, o
   que você já tiver. Como configurar está logo abaixo.
2. **Fluid compute ligado**, que é o padrão em projetos criados de abril de
   2025 para cá.

Isso não é enfeite. Na Vercel, duas pessoas da mesma sala podem cair em
**instâncias diferentes** da função, e não há como escolher: uma lista de
participantes em memória viraria duas listas, cada um sozinho na sua, sem erro
em lugar nenhum. Com o registro compartilhado, a lista é uma só e as
instâncias conversam por publicação. Sem ele a rota sobe assim mesmo e avisa
no log — funciona por acidente, enquanto todo mundo cair na mesma instância.

A outra diferença é que **a conexão morre no teto de duração da função**
(cinco minutos, no padrão). Isso é normal e não deveria aparecer para
ninguém: o identificador de cada participante é a aba, não a conexão, então
quem volta volta como a mesma pessoa. Ninguém sai, ninguém entra, e a voz —
que vai direto de um navegador ao outro — nem fica sabendo. É o que o
`npm run test:instancias` confere, com duas instâncias de verdade.

#### Com Supabase, sem servidor nenhum

É o arranjo desta central hoje, e o mais robusto quando as páginas moram numa
hospedagem sem processo: **o navegador fala direto com o Realtime do
Supabase**. Não há função de sinalização no caminho, e some junto a pergunta
"onde roda o servidor da sala".

A presença do canal *é* a lista de quem está na sala; a transmissão leva a
negociação do WebRTC e o chat. As mensagens que chegam à malha são exatamente
as mesmas do `protocolo.mjs` — o resto da sala não sabe por onde as pessoas
foram apresentadas, e não precisa saber.

Em *Settings → Environment Variables* da Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

O `NEXT_PUBLIC_` é proposital aqui: quem precisa dessas duas é o navegador.
A chave é a **publicável** (ou a `anon`), feita para viver no código da
página. A secreta não entra nisto.

Uma coisa que essas variáveis têm de diferente: elas entram **no momento do
build**. Definir e não publicar de novo não muda nada — o código já foi
gerado sem elas.

O que isso implica: quem tiver o código da sala e a chave publicável entra na
sala, exatamente como quem tem o link entra numa reunião cujo endereço
vazou. É a mesma promessa de sempre — sala pública para quem sabe o código —,
e a razão de nada ser gravado.

Por este caminho **a tabela e a chave secreta não são usadas**. Elas servem
ao arranjo de baixo, com a sinalização em função.

#### Com Supabase, pela função

#### Com Redis

Em vez das duas variáveis acima, um endereço `redis://` em qualquer variável
do projeto — no painel: *Storage* → *Create Database* → *Marketplace* →
qualquer provedor de Redis (o Vercel KV foi aposentado em dezembro de 2024,
então não procure por ele).

O Marketplace mostra só os planos que a Vercel fatura; **o plano gratuito
costuma estar na conta direta do provedor** (na Upstash são 500 mil comandos
por mês, sem cartão).

#### Como saber se pegou

Abra `/NVDISC/sinal` no navegador. Ele responde onde as salas estão vivendo, e
o que fazer se ainda estiverem só na memória da instância.

Se as páginas estiverem na Vercel e a sinalização não subir por lá, a sala
diz isso na cara em vez de ficar em "reconectando…" para sempre.

### Antes de chamar a turma

**HTTPS não é opcional fora do `localhost`.** Navegador só entrega microfone e
captura de tela em contexto seguro. Chamando a turma pelo IP da rede
(`http://192.168.x.x:3000`) dá para ver quem está na sala e usar o chat — e a
voz simplesmente não vai, sem mensagem de erro, porque para o navegador não há
erro nenhum: a captura não é oferecida.

Para dois aparelhos conversarem na sua rede:

```bash
npm run cert     # um certificado para esta máquina, com os IPs dela dentro
TLS_CERT=.cert/certificado.pem TLS_KEY=.cert/chave.pem npm run dev
```

O servidor sobe em `https://` e a sinalização em `wss://`. Cada aparelho mostra
um aviso de certificado na primeira visita — avançar é o esperado, já que quem
assina este servidor é você. Em hospedagem, deixe o TLS com o proxy da frente e
não passe `TLS_CERT`.

Uma armadilha que custou uma noite: fora de HTTPS, **`crypto.randomUUID` não
existe** (é API de contexto seguro). Todo identificador do NVDISC passa por um
`novoId()` com reserva não-criptográfica por causa disso — sem ele, a página
estourava antes de conectar e o sintoma era entrar na sala e ficar sozinho,
com "reconectando…" eterno no topo.

**Sem TURN, alguns não vão conseguir falar.** O STUN embutido resolve na mesma
rede e na maioria das casas, mas atrás de NAT simétrico (rede de empresa,
algumas operadoras) a conexão direta não fecha e a pessoa entra na sala sem
ninguém ouvi-la. Para ligar o seu:

```
NEXT_PUBLIC_TURN_URL=turn:seu-servidor:3478
NEXT_PUBLIC_TURN_USER=usuario
NEXT_PUBLIC_TURN_SENHA=senha
```

São `NEXT_PUBLIC_` porque quem precisa delas é o navegador. Um TURN próprio se
sobe com [coturn](https://github.com/coturn/coturn) num VPS pequeno.

### Uma aba só, mesmo quando ela volta

Quem entrava numa sala **se via duas vezes**. A permissão do microfone é pedida
antes de conectar; se a página desmontar nesse meio-tempo, o pedido de saída
acontece com o WebSocket ainda por abrir — e a conexão sobe depois, sem ninguém
para fechá-la. Ela fica na sala como uma segunda pessoa com o mesmo nome.

Duas condições precisavam estar juntas, e é por isso que o defeito passou tanto
tempo em pé: **`npm run dev`** (em desenvolvimento o React monta o componente
duas vezes de propósito; em produção, uma só) e a **entrada pelo formulário**
(`router.push`, e não uma carga de página inteira). Quem só testava a versão
publicada, ou colava a URL da sala direto na barra, nunca via.

O conserto é nas duas pontas, porque nenhuma sozinha basta:

- **No navegador**, `entrar()` verifica se já pediram para sair antes de abrir
  a conexão, e mensagens de um socket já substituído são ignoradas.
- **No servidor**, cada aba manda um `sessao` no `ENTRAR` — um identificador
  que vive no `sessionStorage` (e não no `localStorage`, senão duas abas
  legítimas se derrubariam). Se a sala já tem alguém com aquele `sessao`, é a
  mesma aba voltando: a conexão anterior sai na hora, em vez de esperar os 30 s
  da varredura de conexões mortas.

A segunda ponta também resolve o fantasma da reconexão, que aparece em
produção depois de uma queda de Wi-Fi — e que não tem nada a ver com o React.

Os dois testes cobrem cada uma: o `npm test` confere que a aba que volta não
ocupa duas vagas na sala; o `npm run test:navegador` entra pelo formulário
**num servidor de desenvolvimento** e conta os cartões na tela, que é a única
forma de ver o defeito original.

### Onde as coisas estão

```
server.mjs                       Next + WebSocket da sinalização, num processo só
src/lib/sinalizacao.mjs          o protocolo da sala, sem saber onde roda
src/lib/registro-memoria.mjs     as salas na memória (server.mjs)
src/lib/registro-redis.mjs       as salas no Redis (Vercel)
src/lib/registro-supabase.mjs    as salas no Supabase (sinalização em função)
src/lib/sinal-supabase.ts        a sala pelo Realtime, direto do navegador
supabase/nvdisc.sql              a tabela, para rodar uma vez no projeto
src/app/api/sinal/route.ts       a sinalização como função da Vercel
src/app/globals.css              o sistema visual (o do NVGHUB) + as peças daqui
src/app/layout.tsx               só o documento: fontes e tokens
src/app/(central)/layout.tsx     a telinha: trilhos + coluna de painéis
src/app/(central)/page.tsx       a home que escolhe a ferramenta
src/app/(central)/plano/         o plano de captação
src/components/shell/            trilhos, barra mobile e rodapé
src/lib/navegacao.ts             os destinos — um lugar só para os três menus
public/calculadora.html          a calculadora (arquivo único, abre offline)
src/lib/base.mjs                 onde o NVDISC mora (/NVDISC) — um ponto de verdade
src/lib/protocolo.mjs            as mensagens — um arquivo, lido pelos dois lados
src/lib/malha.ts                 as conexões WebRTC, a qualidade, o indicador de fala
src/app/NVDISC/page.tsx          a entrada (nome + código)
src/app/NVDISC/nvdisc.css        o visual da sala, nos tokens da central
src/app/NVDISC/_ui/Sala.tsx      a sala
scripts/teste*.mjs               os dois testes
scripts/sonda.js                 o que o teste avalia dentro da página
```

O `protocolo.mjs` e o `base.mjs` estão em `.mjs` puro de propósito: o servidor
roda em Node sem compilação e o cliente roda no bundle do Next. Um arquivo só,
importado pelos dois, é o que garante que falem a mesma língua — duas cópias das
constantes seriam duas chances de divergir num nome de campo e passar horas
caçando um "por que ninguém entra na sala".

### Os testes

O `npm test` sobe o processo inteiro numa porta livre e conversa com ele por
WebSocket. O `npm run test:navegador` abre **dois Chrome headless com microfone
falso**, põe os dois na mesma sala e confere o que só um navegador pode
responder — inclusive a qualidade negociada: taxa do Opus, FEC, DTX, prioridade
de rede, taxa de amostragem do microfone.

Ele também sobe um segundo servidor, em modo de desenvolvimento e com pasta de
build própria (`NEXT_DIST_DIR`), só para o caso do "dois eu" — que não existe
em produção. Sem a pasta separada, o modo de desenvolvimento apagaria o build
que o outro servidor do mesmo teste está servindo.

Esse segundo teste achou os quatro defeitos mais graves que o NVDISC teve, e
nenhum deles o teste de servidor veria: o fluxo remoto não ligado a nenhum
elemento de áudio (a sala era muda, sem erro no console); os dois lados criando
transceptores ao mesmo tempo (a chamada ficava `connected` e um dos dois não
ouvia nada); um `AudioContext` por participante, que estourava o limite do
Chrome e picotava o som; e a conexão fantasma que fazia a pessoa se ver duas
vezes ao entrar.

Para rodá-lo, um Chrome com depuração remota:

```
flatpak run --filesystem=/tmp com.google.Chrome \
  --headless=new --disable-gpu --user-data-dir=/tmp/nvdisc-chrome \
  --remote-debugging-port=9333 --use-fake-device-for-media-stream \
  --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required \
  about:blank &
```
