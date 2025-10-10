import React, { useEffect, useRef, useState } from "react";
import { useNotifications } from "./useNotifications";
import "./Notifications.css";

/**
 * Props:
 * - userId: string | number (usado p/ storage scoping)
 * - className?: string
 * - placement?: 'right'|'left' (alinhamento do dropdown)
 */
export default function NotificationBell({ userId, className = "", placement = "right" }) {
  const {
    items, unreadCount, add, markAsRead, markAllAsRead, remove, clearAll,
  } = useNotifications(userId);

  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const [ring, setRing] = useState(false);
  const prevUnreadRef = useRef(unreadCount);
  const ringTimerRef = useRef(null);
  const [tap, setTap] = useState(false);
  const tapTimerRef = useRef(null);



  // Fechar ao clicar fora
  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Acessibilidade: tecla ESC fecha
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  
// Dispara a animação quando o contador de não-lidas aumenta
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      // liga classe .ring por ~1.2s
      setRing(true);
      clearTimeout(ringTimerRef.current);
      clearTimeout(tapTimerRef.current);
      ringTimerRef.current = setTimeout(() => setRing(false), 1200);
    }
    prevUnreadRef.current = unreadCount;
    return () => clearTimeout(ringTimerRef.current);
  }, [unreadCount]);


 
  const onToggle = () => {
  setOpen(o => !o);
    // Dispara animação de clique
    setTap(true);
    clearTimeout(tapTimerRef.current);
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setTap(false), 300);
};


  // Dev helper: adicione uma notificação de teste
  const addTest = () => {
    add({
      title: "Nova atualização",
      body: "Seu relatório mensal foi aprovado 👏",
      type: "success",
      action: { label: "Abrir", href: "/relatorios" },
    });
  };

  const typeIcon = (t) => {
    switch (t) {
      case "success": return <i className="fa-solid fa-circle-check" aria-hidden="true" />;
      case "warning": return <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />;
      case "error":   return <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />;
      default:          return <i className="fa-solid fa-bell" aria-hidden="true" />;
    }
  };

  const fmt = (ts) => new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className={`notif-bell ${ring ? "ring" : ""} ${tap ? "tap" : ""} ${className}`} aria-live="polite">
      <button
        ref={btnRef}
        className="notif-btn"
        aria-label={`Notificações (${unreadCount} não lidas)`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
      >
        <i className="fa-regular fa-bell" aria-hidden="true" />
        {unreadCount > 0 && <span className="notif-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && (
        <div
          ref={popRef}
          className={`notif-popover ${placement === 'left' ? 'left' : 'right'}`}
          role="dialog"
          aria-label="Notificações"
        >
          <div className="notif-head">
            <strong>Notificações</strong>
            <div className="gap" />
            <button className="link" onClick={markAllAsRead} disabled={unreadCount === 0}>Marcar todas como lidas</button>
            <button className="link danger" onClick={clearAll} disabled={items.length === 0}>Limpar</button>
          </div>

          {items.length === 0 ? (
            <div className="notif-empty">
              <i className="fa-regular fa-bell-slash" aria-hidden="true" />
              <p>Sem notificações por aqui.</p>
              <button className="btn btn-secondary" onClick={addTest}>Adicionar de teste</button>
            </div>
          ) : (
            <ul className="notif-list">
              {items.map(n => (
                <li key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
                  <div className="icon">{typeIcon(n.type)}</div>
                  <div className="content">
                    <div className="title-row">
                      <strong className="title">{n.title}</strong>
                      <small className="ts">{fmt(n.createdAt)}</small>
                    </div>
                    {n.body && <p className="body">{n.body}</p>}
                    <div className="actions">
                      {!n.read && (
                        <button className="link" onClick={() => markAsRead(n.id)}>Marcar como lida</button>
                      )}
                      {n.action?.href && (
                        <a className="link" href={n.action.href}>{n.action.label || "Abrir"}</a>
                      )}
                      <button className="link danger" onClick={() => remove(n.id)} aria-label="Remover notificação">Remover</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
