# Redesign e estabilidade das chamadas

## Visual

Entrada redesenhada com tipografia editorial, fundo escuro, acento azul, ilustração de ondas em CSS, formulário de convite e apresentação das ferramentas. A sala usa o tema Cornflower como padrão; preferências válidas já salvas continuam mantidas. A revisão rápida de layout está registrada em `plano-sala.md`. As animações respeitam movimento reduzido.

Referência de direção visual: [seleção de sites escuros do Awwwards](https://www.awwwards.com/websites/black/). O layout e as ilustrações foram construídos para o NVDISC, sem copiar um site específico.

## Correções

- O amplificador de volume acima de 100% acompanha a substituição do fluxo remoto após uma reconexão.
- O encerramento de uma faixa antiga remove apenas aquela faixa, preservando o áudio/vídeo atual.
- Eventos e operações pendentes de conexões descartadas não atualizam seus substitutos.
- Uma desconexão persistente pode reconstruir a conexão; o relógio de queda não é mais zerado em cada tentativa de ICE.
- O monitor de mídia não executa verificações concorrentes, e ignora estatísticas que chegam após a substituição do par.
- O recebimento de mídia libera o orçamento de reconstrução para futuras quedas.
- Mudanças no processamento do microfone são serializadas; a cadeia anterior é desligada depois da troca das faixas.
- As preferências de processamento também são aplicadas na entrada.
- Sons de entrada e saída compartilham o contexto de áudio da chamada.
- A saída durante a consulta dos servidores ICE não reabre a sinalização.
- O aviso de configuração do servidor agora usa os nomes das variáveis aceitas pela API.

Referências técnicas: [reinício de ICE](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce) e [negociação perfeita](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation).

## Validação local

- `npm run build`: compilação de produção e TypeScript aprovados.
- `npm test`: 44 verificações aprovadas de servidor, sinalização, chat e limites.
- `npm run test:recuperacao`: 9 regressões aprovadas, com temporização e pares simulados.
- `npm run test:navegador`: 32 verificações aprovadas em Chromium, com microfone sintético e captura de tela simulada. Inclui mídia nos dois sentidos, vídeo reproduzindo, som da tela com microfone desligado, supressão forte, recuperação de fluxo, amplificador após reconexão, entrada em desenvolvimento e chat.
- Inspeção visual em 1440 × 1000 e 390 × 844, sem overflow horizontal ou erros JavaScript.

O teste de navegador requer Chromium com CDP em `9333`; portas dos servidores de teste podem ser definidas por `TEST_PORT` e `TEST_DEV_PORT`. O script visual usa Playwright instalado separadamente (`PLAYWRIGHT_PATH` pode apontar para o pacote), CDP em `9333` e servidor temporário em `3411`. As capturas ficam em `artifacts/`.

## O que depende da hospedagem

A hospedagem informada é a Vercel, atualmente sem serviço TURN. As correções locais não substituem esse relé: para atender redes sem caminho direto, obtenha um serviço TURN e configure `TURN_URL`, `TURN_USER` e `TURN_SENHA` nas variáveis de ambiente do projeto Vercel (Production e, se necessário, Preview), seguido de um novo deploy. A rota `/api/turn` entrega os servidores ICE ao navegador; ela não implementa o relé de mídia. Consulte também “Antes de chamar a turma” no README.

A sinalização é uma configuração separada. O projeto já oferece Supabase Realtime, ativado com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Essas variáveis públicas precisam estar presentes durante o build. Sem elas, o cliente usa a rota WebSocket existente: confira a configuração dessa alternativa no README. Supabase Realtime transporta a sinalização e não substitui TURN. Nenhuma variável ou serviço externo foi criado nesta alteração.

Verifique `/api/turn?diagnostico` no domínio publicado. Depois teste dois aparelhos em redes distintas (por exemplo Wi-Fi e rede móvel), troca de rede e uma chamada prolongada. Os testes locais não comprovam conectividade através de CGNAT, qualidade de microfones reais ou comportamento de Safari/Firefox. Não é possível prometer ausência total de falhas de rede.
