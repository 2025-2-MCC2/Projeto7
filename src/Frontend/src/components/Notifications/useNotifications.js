import { useEffect, useMemo, useState, useCallback } from "react";

/**
 * Estrutura da notificação (frontend):
 * {
 *   id: string,
 *   title: string,
 *   body?: string,
 *   type?: 'info'|'success'|'warning'|'error',
 *   createdAt: number (timestamp),
 *   read: boolean,
 *   action?: { label: string, href: string } // opcional
 * }
 */

const LS_KEY = (uid) => `notifications_${uid || "anon"}`;

// ---- Stubs de API ( backend) ----
// const API = {
//   async list(userId) {
//     // return fetch(`/api/notifications?user=${userId}`).then(r => r.json());
//   },
//   async markAllRead(userId) {
//     // return fetch(`/api/notifications/mark-all-read`, { method: 'PATCH', body: JSON.stringify({ userId }) });
//   },
//   async ackOne(id) {
//     // return fetch(`/api/notifications/${id}/ack`, { method: 'PATCH' });
//   },
//   async clearAll(userId) {
//     // return fetch(`/api/notifications/clear-all`, { method: 'DELETE', body: JSON.stringify({ userId }) });
//   },
// };

export function useNotifications(userId) {
  const key = useMemo(() => LS_KEY(userId), [userId]);
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(items));
  }, [key, items]);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  // Ações
  const add = useCallback((notif) => {
    const n = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: "info",
      read: false,
      createdAt: Date.now(),
      ...notif,
    };
    setItems(prev => [n, ...prev]);
  }, []);

  const markAsRead = useCallback((id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    // API.ackOne(id).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(() => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    // API.markAllRead(userId).catch(() => {});
  }, [userId]);

  const remove = useCallback((id) => {
    setItems(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    // API.clearAll(userId).catch(() => {});
  }, []);

  return {
    items,
    unreadCount,
    add,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
    setItems,
  };
}
