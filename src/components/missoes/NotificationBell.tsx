"use client";

import { useEffect, useRef, useState } from "react";
import { useNotificacoes } from "@/hooks/useNotificacoes";

function quando(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return d.toLocaleDateString("pt-BR");
}

export default function NotificationBell({ userId }: { userId: string | null }) {
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas, pedirPermissao } =
    useNotificacoes(userId);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) void pedirPermissao();
  }, [aberto, pedirPermissao]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        className="notif-bell"
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
      >
        <span className="notif-bell-icon">🔔</span>
        {naoLidas > 0 && <span className="notif-badge">{naoLidas > 9 ? "9+" : naoLidas}</span>}
      </button>

      {aberto && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <strong>Notificações</strong>
            {naoLidas > 0 && (
              <button className="notif-mark-all" onClick={() => void marcarTodasLidas()}>
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="notif-list">
            {notificacoes.length === 0 && (
              <p className="notif-empty">Nenhuma notificação ainda.</p>
            )}
            {notificacoes.map((n) => (
              <button
                key={n.id}
                className={`notif-item ${n.lida ? "" : "nao-lida"}`}
                onClick={() => void marcarLida(n.id)}
              >
                <span className="notif-item-titulo">{n.titulo}</span>
                {n.corpo && <span className="notif-item-corpo">{n.corpo}</span>}
                <span className="notif-item-quando">{quando(n.criado_em)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
