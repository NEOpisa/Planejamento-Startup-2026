/**
 * O isolador de voz — o nó que roda a rede neural no fio do microfone.
 *
 * A porta de ruído que a sala já tinha é um portão: abaixo de um volume, ela
 * fecha. Isso limpa o silêncio e **não limpa a voz** — enquanto você fala, o
 * ventilador, o teclado e a obra na rua passam inteiros junto. É por isso que
 * "supressão forte" nunca pareceu funcionar: ela nunca prometeu isso.
 *
 * Aqui é outra coisa. A RNNoise é uma rede recorrente treinada para separar
 * voz de ruído quadro a quadro, e ela age **durante** a fala — é a família de
 * técnica que o Krisp usa. O modelo tem uns 85 KB de pesos e roda em WASM.
 *
 * Três detalhes que o formato impõe, e que são a maior parte deste arquivo:
 *
 * 1. **A RNNoise só sabe 480 amostras por vez** (10 ms a 48 kHz), e o
 *    AudioWorklet entrega 128. Os números não são múltiplos, então nenhum
 *    alinhamento salva: é preciso um anel que junta o que chega até dar um
 *    quadro, e outro que devolve o que já foi limpo.
 * 2. **A escala é de inteiro de 16 bits**, não o -1..1 do motor de áudio. Sem
 *    multiplicar por 32768 na entrada e dividir na saída, a rede recebe algo
 *    perto de zero e devolve silêncio — que é o defeito mais fácil de
 *    confundir com "o microfone parou".
 * 3. **Sai com atraso de um quadro.** 10 ms é imperceptível numa conversa e é
 *    o preço fixo desta técnica.
 *
 * Enquanto o WASM não terminou de subir, o áudio passa **cru**. Nunca em
 * silêncio: um isolador que ainda está carregando não pode ser a razão de
 * ninguém te ouvir.
 */

const QUADRO = 480;

class Isolador extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pronto = false;
    this.ligado = true;

    // Anéis de entrada e saída. `restoSaida` é o que já foi limpo e ainda não
    // coube num bloco de 128.
    this.entrada = new Float32Array(QUADRO);
    this.nEntrada = 0;
    this.saida = new Float32Array(QUADRO * 4);
    this.nSaida = 0;

    this.port.onmessage = (ev) => {
      if (ev.data?.tipo === "ligado") {
        this.ligado = ev.data.valor !== false;
        return;
      }
      if (ev.data?.tipo !== "iniciar") return;
      try {
        this.mod = criarRNNoise();
        this.estado = this.mod._rnnoise_create();
        // Um lugar só na memória do WASM, reaproveitado a cada quadro:
        // alocar 100 vezes por segundo seria trabalho puro para o coletor.
        this.ptr = this.mod._malloc(QUADRO * 4);
        this.pronto = true;
        this.port.postMessage({ tipo: "pronto" });
      } catch (e) {
        // Falhar aqui deixa o áudio cru, que é ruim e audível — melhor que
        // mudo, que é ruim e invisível.
        this.port.postMessage({ tipo: "falhou", erro: String(e) });
      }
    };
  }

  /** Limpa um quadro de 480 amostras, no lugar. */
  limpar(quadro) {
    const heap = this.mod.HEAPF32;
    const base = this.ptr >> 2;
    for (let i = 0; i < QUADRO; i++) heap[base + i] = quadro[i] * 32768;
    this.mod._rnnoise_process_frame(this.estado, this.ptr, this.ptr);
    for (let i = 0; i < QUADRO; i++) quadro[i] = heap[base + i] / 32768;
  }

  process(entradas, saidas) {
    const ent = entradas[0]?.[0];
    const sai = saidas[0]?.[0];
    if (!sai) return true;
    // Sem entrada o nó continua vivo: o microfone pode voltar, e um
    // `return false` aqui mataria o processador para sempre.
    if (!ent) return true;

    if (!this.pronto || !this.ligado) {
      sai.set(ent);
      return true;
    }

    for (let i = 0; i < ent.length; i++) {
      this.entrada[this.nEntrada++] = ent[i];
      if (this.nEntrada === QUADRO) {
        this.limpar(this.entrada);
        // Se a saída encheu, o consumidor parou de puxar — descartar o mais
        // antigo é melhor que crescer sem limite.
        if (this.nSaida + QUADRO > this.saida.length) this.nSaida = 0;
        this.saida.set(this.entrada, this.nSaida);
        this.nSaida += QUADRO;
        this.nEntrada = 0;
      }
    }

    if (this.nSaida >= sai.length) {
      sai.set(this.saida.subarray(0, sai.length));
      this.saida.copyWithin(0, sai.length, this.nSaida);
      this.nSaida -= sai.length;
    } else {
      // Ainda enchendo o primeiro quadro: silêncio por ~10 ms, uma vez.
      sai.fill(0);
    }
    return true;
  }
}

registerProcessor("isolador-de-voz", Isolador);
