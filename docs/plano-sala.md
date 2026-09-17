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

**Próxima etapa do plano:** refinar a grade com 2, 4 e 8 participantes, validar telas compartilhadas junto de chat/ferramentas abertos e ajustar os painéis laterais em 320 px. TURN continua pendente na hospedagem; não é resolvido por layout.
