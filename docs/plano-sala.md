# Plano rápido — sala NVDISC

## Objetivo
Restaurar o azul original e reduzir texto e moldura para dar prioridade à chamada.

## Implementação
1. Entrada: paleta original, hero curto, remover slogans e chamadas repetidas.
2. Sala: cabeçalho compacto com nome, estado da conexão, convite, ferramentas e chat.
3. Palco: reduzir a barra de telas e remover instruções longas do estado vazio.
4. Controles: manter ações acessíveis no celular, com área segura inferior.
5. Validar build e layout desktop/celular; registrar o ponto de parada abaixo.

## Ponto de parada
Etapas 1 a 4 implementadas nesta passagem:
- Paleta azul original (Cornflower/MediumBlue) restaurada na entrada e como padrão da sala. A opção Lima foi removida; preferências antigas com esse valor voltam ao padrão azul.
- Hero reduzido a “Sua sala. Sua conversa.” e uma linha funcional. Removidos slogans, faixa promocional, rodapé repetido do formulário e chamada final.
- Cabeçalho compacto com botão de convite, confirmação de cópia e campo selecionável se a área de transferência estiver bloqueada.
- Barra de telas mais compacta, instrução de sala vazia reduzida e controles respeitando a área segura do celular.

Validação: build de produção e TypeScript aprovados. Inspeção visual em 1440 × 1000 e 390 × 844 aprovada, sem overflow horizontal ou erros JavaScript; controles visíveis no celular.

**Onde parei:** primeira revisão da entrada e do cabeçalho/palco implementada. O motor de áudio/vídeo não foi alterado nesta passagem.

## Etapa 6 — grade e painéis laterais (17/09/2026)
Validado com 2, 4 e 8 participantes reais (Chrome headless, mídia falsa) em 1440, 1280, 1024, 390 e 320 px, com e sem tela compartilhada, lateral e chat.

Grade:
- A largura do cartão saía de `100vw − 580px`, como se lateral e chat estivessem sempre abertos. Agora o palco é medido (`ResizeObserver`) e `src/lib/grade.mjs` escolhe as colunas que deixam o cartão maior, com piso de 120 px e teto de 440 px × densidade. Empate: menos buracos na última fileira, depois o formato mais parecido com o do palco. Coberto no `npm test`.
- Cartão sempre 16:10 (saiu o `min-height: 220px`, que fazia 8 pessoas virarem tiras em pé). Avatar e plaquinhas escalam com o lado; cartões pequenos (`.miuda`) apertam as plaquinhas.
- Resultado: 2 pessoas com 440 px lado a lado; 8 em 4 × 2 no monitor, 2 × 4 no celular, sem rolar e sem nada debaixo da pílula. Com lateral + chat abertos em 1280, 2 × 4.
- Corrigido: a camada de densidade apagava a folga de 88 px da pílula; `align-content: center` jogava a primeira fileira para fora da rolagem (agora `safe center`); plaquinha de ícones vazia aparecia como um traço.

Painéis:
- Abaixo de 1024 px abrir lateral fecha o chat e vice-versa (antes abriam um por cima do outro).
- Véu escuro atrás da gaveta que boia (lateral ≤ 1180, chat ≤ 1023); tocar nele fecha.
- No celular (≤ 900 px) a lateral ocupa a tela inteira; a largura de 268 px da bancada vencia a regra e deixava uma fresta clicável da chamada. Chat em largura total ≤ 480 px.
- Coluna de pessoas ao lado da tela: avatar em cima e nome embaixo (antes só cabia "N…").
- Celular com tela aberta: faixa de pessoas com cartões de 84 px que não encolhem; some o rótulo "No palco" e o "voltar às pessoas" (o X da tela faz o mesmo); folga embaixo da tela para a legenda não ficar sob a pílula.

**Onde parei:** etapa 6 concluída. Motor de áudio/vídeo não foi alterado.

**Próxima etapa do plano:** testar numa chamada real, no celular, abrir e fechar lateral/chat durante uma tela compartilhada. Em 1024 px com 8 pessoas a coluna ao lado da tela rola (esperado).
