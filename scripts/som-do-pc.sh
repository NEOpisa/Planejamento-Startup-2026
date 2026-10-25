#!/bin/sh
# Cria no PipeWire a entrada "NVDISC som do PC": repete o que sai nas caixas
# (segue a saída padrão) para a sala mandar o som junto da tela inteira ou de
# uma janela, que o Chrome no Linux entrega mudas. Uso: sh scripts/som-do-pc.sh
set -e
d="$HOME/.config/pipewire/pipewire.conf.d"
mkdir -p "$d"
cat > "$d/nvdisc-som-do-pc.conf" <<'CONF'
context.modules = [
  { name = libpipewire-module-loopback
    args = {
      node.description = "NVDISC som do PC"
      capture.props = {
        node.name = "nvdisc_som_do_pc_captura"
        stream.capture.sink = true
        node.passive = true
        audio.position = [ FL FR ]
      }
      playback.props = {
        node.name = "nvdisc_som_do_pc"
        node.description = "NVDISC som do PC"
        media.class = Audio/Source
        audio.position = [ FL FR ]
      }
    }
  }
]
CONF
systemctl --user restart pipewire pipewire-pulse
echo "pronto: a entrada \"NVDISC som do PC\" já aparece para o navegador"
