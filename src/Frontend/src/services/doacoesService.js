// src/services/doacoesService.js
const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://projeto-interdisciplinar-2.onrender.com/api";

/** GET /grupos */
export async function fetchGrupos() {
  const r = await fetch(`${API_BASE}/grupos`);
  if (!r.ok) throw new Error(`Falha ao listar grupos (${r.status})`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

/** GET /grupos/:id/doacoes?status=...  -> normaliza attachments */
export async function fetchDoacoesByGrupo(groupId, { status = 'todas' } = {}) {
  const r = await fetch(`${API_BASE}/grupos/${groupId}/doacoes?status=${encodeURIComponent(status)}`);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Falha ao buscar doações (${r.status}): ${t}`);
  }
  const data = await r.json();
  return (Array.isArray(data) ? data : []).map(d => ({
    ...d,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
  }));
}

/** Converte o objeto de doação do backend para um item do Extrato */
export function toExtratoItem(d, grupo) {
  const isMoney = d.tipo_doacao === 'dinheiro';
  return {
    id: d.ID_doacao,
    tipo: d.tipo_doacao,                               // 'dinheiro' | 'item'
    valor: isMoney ? Number(d.valor_doacao || 0) : null,
    item: !isMoney ? (d.item_doacao || '') : null,
    quantidade: !isMoney ? Number(d.quantidade || 0) : null,
    unidade: !isMoney ? (d.unidade || '') : null,
    doador: d.doador_nome || 'Anônimo',
    createdAt: d.doacao_data_registro || null,
    status: d.status_doacao,                           // pendente|aprovada|rejeitada
    usuarioRegistro: d.nome_usuario_registro || '',
    grupoId: grupo?.id ?? null,
    grupoName: grupo?.nome ?? 'Grupo',
  };
}

export const currencyBRL = (v) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dateBR = (iso) => {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
};