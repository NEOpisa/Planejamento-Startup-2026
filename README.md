# NVDISC

Sala de voz, tela e texto da Neovanguard (Next.js + React). Sem conta e sem
cadastro: um nome, um código, e quem digitar o mesmo código cai na mesma sala.

O visual é o **mesmo sistema do site público** (NVGHUB, `neovanguard.com.br`),
seguido à risca: os tokens, a escala tipográfica e as peças — painel, porta,
cartão, pílula, trilho — são os do `shell.css` de lá, sem uma cor ou um
tamanho inventado aqui. Space Grotesk no display, Plus Jakarta Sans no corpo,
IBM Plex Mono nos rótulos. Uma ferramenta da casa com paleta própria pareceria
de outra empresa.

## Telas

| Rota | O que é |
|------|---------|
| `/` | Redireciona para `/NVDISC` |
| `/NVDISC` | A porta: a tela de escolher para onde ir, com o formulário de entrada |
| `/NVDISC/sala/[código]` | A sala — voz, tela, chat e as ferramentas |

A porta vive dentro da telinha de trilhos do NVGHUB; a **sala** fica fora
dela, com a tela inteira. Uma chamada cercada por dois trilhos de navegação
perderia o vídeo para um menu que ninguém abre no meio de uma conversa.

O prefixo `/NVDISC` continua existindo mesmo sendo isto a única coisa que
mora aqui: o caminho da sinalização (`/NVDISC/sinal`) depende dele, e é lido
pelo servidor, pelo cliente e pelo teste.

### A porta é uma escolha, não um login

Ela lista os destinos da casa, e marca os que ainda não abriram em vez de
escondê-los. Quem chega pela primeira vez quer saber o tamanho da casa — um
destino apagado da tela não conta essa história, e um que parece pronto e não
abre é pior. A lista mora em `src/lib/navegacao.ts`, num lugar só, lida pelo
trilho, pela barra do telefone e pela própria porta.

## Rodar

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de produção
npm start       # produção

npm test              # o servidor do NVDISC: salas, chat, limites
npm run test:navegador  # a chamada de verdade, em dois Chrome
npm run test:ferramentas # a permissão do quadro, em duas abas
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

Quando o áudio vem, ele vai **misturado à sua voz, numa faixa só**. Mandá-lo
separado obrigaria a renegociar a conexão com todo mundo bem no momento em que
alguém aperta "compartilhar", que é onde uma malha costuma quebrar — e essa é
a mesma razão de o transceptor de vídeo nascer pronto e vazio.

Quando não vem, a sala diz isso no chat na hora. É melhor saber ao apertar o
botão do que descobrir pelo outro lado avisando que o vídeo está mudo dez
minutos depois.

### O NVDISC tem servidor próprio

Ele vivia com `next start`, que basta para páginas. O NVDISC precisa de uma
conexão **que fica de pé** para apresentar as pessoas de uma sala umas às
outras, e isso `next start` não oferece — função serverless nasce e morre a cada
requisição, e não há onde guardar quem está em qual sala.

Daí o `server.mjs`: um processo só, servindo a porta, a sala e o
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

### O áudio que sempre funciona

O sintoma mais caro que esta sala já teve não é ela quebrar — é ela funcionar
**às vezes**. A chamada fica `connected`, o chat vai e volta, as faixas
continuam vivas, e não entra som. Nada falha, nada aparece no console, e quem
está do outro lado conclui que o próprio microfone quebrou.

O que sustenta a promessa hoje:

- **Um vigia de fluxo**, de dois em dois segundos, pergunta a coisa que
  nenhum estado de conexão responde: *está entrando pacote de áudio desta
  pessoa?* Ele funciona porque o WebRTC não para de mandar quando alguém fica
  mudo — silêncio também é codificado e trafega. Número parado, portanto, não
  é sala quieta: é cano entupido.
- **Uma escada de conserto**, do barato ao caro. Aos 6 s sem pacote, reinicia
  o ICE (procura outro caminho de rede sem derrubar nada). Aos 16 s, refaz a
  conexão do zero — e refaz **combinado com o outro lado**, por um recado
  `refazer` no canal de sinalização, porque uma reconstrução unilateral chega
  no outro como uma oferta com credenciais novas sobre uma sessão viva, que é
  aperto de mão que o navegador nem sempre aceita. Aos 26 s, com duas
  reconstruções sem um pacote, ele para de tentar e **diz** — a essa altura o
  problema é caminho de rede que não existe entre as duas casas, e quem
  resolve isso é um TURN.
- **A seção de áudio nasce aberta**, mesmo sem microfone pronto. Quem atendia
  sem microfone (permissão ainda sendo decidida, negada, ou o aparelho tomado
  por outro programa) respondia `recvonly` — "eu só quero ouvir" —, e quando o
  microfone abria depois, a faixa era pendurada num remetente que o padrão
  manda ignorar. Ninguém ouvia essa pessoa pelo resto da chamada.
- **Sem microfone nenhum, o app continua tentando** a cada cinco segundos.
  Quem negou a permissão e depois liberou não precisa mais recarregar a
  página.
- **Um gesto solta a sala inteira.** O bloqueio de reprodução automática do
  navegador rendia um botão "ouvir fulano" por pessoa; quem clicasse em dois e
  parasse ficava sem ouvir o resto. Agora qualquer clique, tecla ou toque
  destrava o motor de áudio e todas as reproduções pendentes de uma vez — e os
  ouvintes de gesto ficam de pé, porque o bloqueio não acontece uma vez só.
- **O papel de "educado" sai da comparação dos identificadores**, sempre. Ele
  saía de quem chamou `abrirPar`, e havia um caminho — sinal chegando antes da
  lista de participantes — em que os **dois** lados se achavam educados. Numa
  colisão de ofertas os dois cediam, e a negociação ficava dependendo de o
  acaso não juntar as duas.

O teste `npm run test:navegador` provoca o defeito de propósito (a Ana para de
mandar áudio sem fechar nada) e cobra que a sala se conserte sozinha, sem
ninguém recarregar página.

### Qualidade

O botão **Ajustes** abre as escolhas, que valem na hora:

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

### A sala de cada um

O botão **Ajustes → Personalização** muda a aparência da sala **só para quem
mexe**. Nada é dito à sala, nada viaja pela sinalização, e a tela de quem está
do outro lado não muda — é a mesma promessa que o volume por pessoa já fazia.
Fica guardado no navegador, entre visitas.

| O que | Para que serve |
|-------|----------------|
| Cor de acento | nove cores, todas da paleta da marca |
| Fundo | `grade` (o da central), `brilho` (só a luz) ou `liso` |
| Densidade | quanto ar entre as coisas; mexe no tamanho dos cartões, não só nas margens |
| Cantos | de reto a redondo |
| Tamanho do texto | 90% a 115%, só no texto de leitura |
| Avatares | cor por pessoa, ou a cor da marca |
| Régua do microfone | uma barra de nível no seu cartão, sempre visível |
| Movimento | desliga as transições e o anel que cresce |

**O que não está lá, de propósito:** contraste e superfícies. A legibilidade
foi medida uma vez (16.8:1 no texto principal) e não é assunto de gosto —
trocar contraste por preferência é como se produz uma interface bonita que
ninguém consegue ler por uma hora seguida.

#### A cor de cada pessoa sai do nome

Não é sorteada nem escolhida: é uma conta sobre o nome, e por isso chega
**igual em todos os navegadores** sem passar pela sinalização, é **a mesma
amanhã**, e não custa um campo novo no protocolo. A cor vira reconhecimento em
vez de enfeite — com cinco pessoas na barra de baixo, achar quem se procura é
olhar uma cor, não ler cinco nomes.

O matiz é livre; a saturação e a luz não são. As duas ficam presas numa faixa
que se lê sobre o fundo escuro — matiz livre com luz livre produziria, mais
cedo ou mais tarde, um avatar quase preto com a letra quase preta em cima.

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

## As ferramentas da sala

Cinco, no botão **Ferramentas** da barra de baixo: um **quadro** para
desenhar, um **bloco de notas**, uma **fila de fala**, uma **enquete** e um
**temporizador**. Elas abrem numa gaveta à **esquerda** — a lateral onde todo
programa de desenho põe as suas há trinta anos.

O **quadro** é a exceção, e por isso ele é o exemplo: a tela dele não fica na
gaveta, fica no **palco**, numa aba ao lado das telas que as pessoas
compartilham. Desenhar num painel de 340 px ao lado do chat era desenhar num
guardanapo — cabia o rabisco e não cabia a ideia. Para quem usa, um quadro que
a sala inteira olha ao mesmo tempo e uma tela compartilhada são a mesma coisa,
então eles dividem o cartão, a prévia ao vivo e o lugar. A aba do quadro
**existe sempre**, mesmo em branco: um quadro que só aparecesse depois de
alguém desenhar seria um quadro que ninguém descobre.

Tudo viaja pelo mesmo canal de sinalização do chat, numa mensagem
(`PARA_SERVIDOR.FERRAMENTA`) cujo corpo **o servidor não lê**. Ele confere
três coisas e repassa: o tamanho, o ritmo e a origem. É o mesmo tratamento
que ele dá ao sinal do WebRTC, e tem o mesmo ganho — acrescentar uma sexta
ferramenta não encosta no servidor.

### A regra da permissão

Quadro e notas têm **dono**: quem pegou. Todo mundo na sala **vê** ao vivo,
sem pedir nada a ninguém — ver é grátis, e um quadro que os outros não
enxergassem não teria por que ser compartilhado. **Mexer** é que pede licença:
quem quiser desenhar por cima manda um pedido, o dono libera ou não, e pode
revogar depois. Enquanto ninguém pegou, a ferramenta é livre.

Isto **não é segurança**. A sala é pública, quem tem o código entra, e um
cliente modificado ignoraria a regra. É etiqueta: evita que o desenho de
alguém seja rabiscado por engano, que é o que acontece de verdade num quadro
aberto a oito pessoas. Onde há segurança de fato é na **origem** — `de` é
carimbado pelo servidor e nunca aceito do cliente, então ninguém consegue
anunciar uma permissão em nome do dono. Há teste para isso.

Fila, enquete e temporizador não têm dono, porque não fazia sentido ter: a mão
levantada é de quem a levanta, o voto é de quem vota, e o temporizador é um
relógio — trancá-lo daria mais discussão do que o problema que evitaria.

### O que o layout da sala combina

- **Duas gavetas, uma de cada lado**: ferramentas à esquerda, chat à direita,
  e as duas com botão na barra de baixo. O do chat vivia no topo e só aparecia
  no telefone — no computador a coluna do chat ocupava 320 px o tempo todo e
  não havia como fechá-la, nem botão que dissesse que aquilo era possível.
- **A barra de abas do palco tem uma linha.** Eram duas — cabeçalho em cima,
  cartões embaixo —, cobrando 145 px de altura do palco o tempo inteiro. Com o
  quadro sempre presente, aquilo deixou de ser "uma área que às vezes tem
  coisa" e virou o que sempre foi: uma barra de abas.
- **Abaixo de 1180 px a gaveta das ferramentas flutua** por cima do palco em
  vez de disputar a largura com ele. Duas gavetas fixas numa tela de notebook
  deixariam o palco com menos largura que cada uma delas — e o palco é o
  motivo de a sala existir.

### Três decisões que não são óbvias

- **O quadro viaja de 0 a 1, não em pixels.** A tela de cada um tem um
  tamanho, e um traço em pixels desenhado num monitor de 27" chega cortado
  pela metade num notebook — sem erro nenhum, que é o pior tipo.
- **Um traço vai em lotes de 60 ms**, e não um pacote por ponto. Um ponteiro
  entrega até 240 eventos por segundo; um a um, três segundos de rabisco
  estourariam o teto de rajada e o traço apareceria truncado do outro lado.
  As rajadas do chat e das ferramentas são orçamentos **separados**, senão
  desenhar por um segundo emudeceria a pessoa no chat.
- **O temporizador manda quanto falta, não quando acaba.** Os relógios de
  duas máquinas divergem em segundos, às vezes em minutos, e um instante
  absoluto chegaria ao outro lado já vencido.

Quem chega no meio pergunta (`oi`) e os donos respondem com o retrato do que
está aberto — é o que faz entrar numa conversa em andamento mostrar o quadro
que já estava lá, em vez de uma folha em branco.

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

**Sem TURN, alguns não vão conseguir falar — e nenhum conserto no código muda
isso.** O STUN embutido resolve na mesma rede e na maioria das casas, mas
atrás de NAT simétrico (rede de empresa, internet de celular, boa parte do
CGNAT que as operadoras usam) a conexão direta não fecha, e não há caminho
nenhum entre os dois navegadores. O vigia de fluxo vai tentar, refazer a
conexão duas vezes, e no fim dizer no chat que o áudio não achou caminho —
dizer é tudo o que ele pode fazer, porque o caminho de fato não existe.

É **a** diferença entre "às vezes funciona" e "funciona". Se a sala precisa
funcionar sempre, isto não é opcional.

#### Com um coturn próprio

É o caminho que mantém a promessa de "ninguém no meio do caminho", já que o
relé é seu. Sobe num VPS pequeno com [coturn](https://github.com/coturn/coturn):

```
TURN_URL=turn:seu-servidor:3478,turn:seu-servidor:443,turns:seu-servidor:443
TURN_USER=usuario
TURN_SENHA=senha
```

Vários endereços separados por vírgula, e vale usar os três: `3478` é o
caminho normal, `443` passa por firewall que só libera porta de web, e
`turns:` vai por TLS, que é o único que atravessa rede corporativa com
inspeção de tráfego. O ICE testa todos em paralelo e fica com o primeiro que
fechar.

As antigas `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USER` e
`NEXT_PUBLIC_TURN_SENHA` continuam funcionando, e continuam significando uma
senha publicada na página. Sem o prefixo é melhor.

Para conferir se pegou, sem caçar log:

```
curl https://seu-endereco/api/turn?diagnostico
```

Ele responde de onde veio o TURN, quais endereços foram entregues, se há
credencial — e, quando não há, o que falta configurar.

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
src/app/api/turn/route.ts        as credenciais de TURN, emitidas no servidor
src/lib/preferencias.ts          o que cada um ajusta na própria sala
src/app/globals.css              o sistema visual (o do NVGHUB) + as peças daqui
src/app/layout.tsx               só o documento: fontes e tokens
src/components/shell/            trilhos, barra mobile e rodapé
src/lib/navegacao.ts             os destinos — um lugar só para os três menus
src/lib/base.mjs                 onde o NVDISC mora (/NVDISC) — um ponto de verdade
src/lib/protocolo.mjs            as mensagens — um arquivo, lido pelos dois lados
src/lib/malha.ts                 as conexões WebRTC, a qualidade, o indicador de fala
src/app/NVDISC/page.tsx          a porta: escolher o destino + entrar na sala
src/app/NVDISC/nvdisc.css        o visual da sala, nos tokens do NVGHUB
src/app/NVDISC/_ui/Sala.tsx      a sala
src/app/NVDISC/_ui/Ferramentas.tsx  o painel: quadro, notas, fila, enquete, tempo
src/lib/ferramentas.ts           o estado das ferramentas e a regra da permissão
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
WebSocket. O `npm run test:ferramentas` abre duas abas na mesma sala e percorre
o aperto de mão da permissão inteiro — a Ana pega o quadro, a Bia vê o cadeado,
pede, é liberada, desenha, e o traço aparece na tela da Ana. Nenhum desses
passos dá erro quando quebra: o sintoma é uma sala que parece funcionar. O `npm run test:navegador` abre **dois Chrome headless com microfone
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

Ele guarda também o vigia de fluxo, e este é o único bloco que **provoca** o
defeito em vez de esperar por ele: a Ana para de mandar áudio sem fechar nada,
e o teste cobra que o som volte sozinho em menos de 45 segundos. Uma asserção
que só olhasse `connectionState` passaria com a sala muda — que é exatamente
como o defeito viveu tanto tempo.

Para rodá-lo, um Chrome com depuração remota:

```
flatpak run --filesystem=/tmp com.google.Chrome \
  --headless=new --disable-gpu --user-data-dir=/tmp/nvdisc-chrome \
  --remote-debugging-port=9333 --use-fake-device-for-media-stream \
  --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required \
  about:blank &
```
