/**
 * A sonda que o teste de navegador avalia dentro da página.
 *
 * Mora num arquivo, e não numa string dentro do teste, por um motivo que
 * custou três tentativas: dentro de um template literal, `\n`, `\r` e `\d` são
 * reinterpretados pelo JavaScript **antes** de chegarem ao navegador. Uma
 * expressão regular vira uma expressão inválida, um `split("\n")` vira uma
 * string aberta, e o erro que aparece é um "Invalid or unexpected token" sem
 * relação visível com o que se escreveu.
 *
 * Lido como texto e enviado como está, não há camada de escape nenhuma no
 * caminho — o que está aqui é exatamente o que a página executa.
 *
 * Devolve um retrato do estado da chamada. Só leitura: nada aqui altera a
 * página.
 */
(() => {
  const audios = Array.from(document.querySelectorAll("audio"));
  const fluxos = audios.map((a) => a.srcObject).filter(Boolean);
  const faixas = fluxos.flatMap((f) => f.getAudioTracks());
  const pcs = window.__pcs || [];
  const pc = pcs[0];

  const senderDe = (tipo) =>
    pc ? pc.getSenders().find((s) => s.track && s.track.kind === tipo) : null;

  const linhaFmtp = () => {
    const sdp = pc && pc.localDescription ? pc.localDescription.sdp : "";
    return (
      sdp
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.indexOf("maxaveragebitrate") >= 0) || ""
    );
  };

  const envio = (tipo) => {
    const s = senderDe(tipo);
    if (!s) return null;
    const p = s.getParameters();
    const e = p.encodings && p.encodings[0] ? p.encodings[0] : null;
    if (!e) return null;
    return {
      taxa: e.maxBitrate,
      prio: e.networkPriority,
      escala: e.scaleResolutionDownBy,
      degradacao: p.degradationPreference,
    };
  };

  return {
    pessoas: Array.from(document.querySelectorAll("li")).map((li) =>
      li.textContent.trim(),
    ),
    audios: audios.length,
    fluxos: fluxos.length,
    faixas: faixas.length,
    recebendo: faixas.filter((t) => t.readyState === "live" && !t.muted).length,
    tocando: audios.filter((a) => !a.paused).length,
    contextos: window.__acs || 0,
    opus: linhaFmtp(),
    envioAudio: envio("audio"),
    envioVideo: envio("video"),
    microfone: (() => {
      const s = senderDe("audio");
      return s && s.track ? s.track.getSettings() : null;
    })(),
    conexoes: pcs.map((c) => ({
      estado: c.connectionState,
      ice: c.iceConnectionState,
      sinal: c.signalingState,
      enviando: c
        .getSenders()
        .filter((s) => s.track)
        .map((s) => s.track.kind),
      recebendo: c
        .getReceivers()
        .filter((r) => r.track)
        .map((r) => r.track.kind + ":" + (r.track.muted ? "mudo" : "ok")),
    })),
  };
})();
