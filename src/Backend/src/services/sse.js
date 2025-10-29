// src/Backend/src/services/sse.js
const clientsByGroup = new Map(); // key: grupoId (string) -> Set(res)
let globalClients = new Set();
const HEARTBEAT_MS = 25_000;

function addClient(set, res) {
  set.add(res);
  const hb = setInterval(() => {
    try { res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`); } catch {}
  }, HEARTBEAT_MS);
  res.on("close", () => {
    clearInterval(hb);
    set.delete(res);
  });
}

export function sseGroupHandler(req, res) {
  const { grupoId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(":ok\n\n");
  const key = String(grupoId);
  const set = clientsByGroup.get(key) ?? new Set();
  clientsByGroup.set(key, set);
  addClient(set, res);
}

export function sseGlobalHandler(_req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(":ok\n\n");
  if (!globalClients) globalClients = new Set();
  addClient(globalClients, res);
}

/** Dispara evento de atualização de dashboard de um grupo específico */
export function pushDashboardUpdate(grupoId, payload = {}) {
  const key = String(grupoId);
  const set = clientsByGroup.get(key);
  if (set && set.size) {
    const data = `event: dashboard\ndata: ${JSON.stringify({ grupoId: Number(grupoId), ...payload })}\n\n`;
    for (const res of set) { try { res.write(data); } catch {} }
  }
  // Também notifica canal global (para cards/overview)
  if (globalClients && globalClients.size) {
    const data = `event: dashboard\ndata: ${JSON.stringify({ scope:"global", grupoId:Number(grupoId), ...payload })}\n\n`;
    for (const res of globalClients) { try { res.write(data); } catch {} }
  }
}