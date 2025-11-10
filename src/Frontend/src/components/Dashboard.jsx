import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ReferenceLine,
  LineChart, Line
} from "recharts";
import "./Dashboard.css";
// 1. IMPORTAMOS a instância 'api' (axios) e a 'API_BASE' (para o SSE)
import { api, API_BASE } from "../../auth/api"; 

/* ========================= Helpers ========================= */


const currency = (v) =>
  Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(v ?? 0));

const shortNum = (v) => {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " mi";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".", ",") + " mil";
  return n.toLocaleString("pt-BR");
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Lê variáveis CSS do tema atual (html[data-theme] ou default)
const cssVar = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/* ========================= Tooltip custom ========================= */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const p = payload[0];
    return (
      <div className="custom-tooltip">
        {label && <div className="label">{label}</div>}
        <p className="intro">
          {p.name ? `${p.name}: ` : ""}
          {typeof p.value === "number"
            ? p.value.toLocaleString("pt-BR")
            : p.value}
        </p>
      </div>
    );
  }
  return null;
};

/* ========================= Fatia ativa (Pizza) ========================= */
const ActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const {
    cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={cssVar('--text', '#333')}>
        {payload.name}
      </text>
      <Sector
        cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius}
        startAngle={startAngle} endAngle={endAngle} fill={fill}
      />
      <Sector
        cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
        innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
            stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex} y={ey} dy={-12} textAnchor={textAnchor} fill={cssVar('--text','#333')}>
        {`${value.toLocaleString("pt-BR")} ${payload.unidade ?? 'un.'}`}
      </text>
      <text x={ex} y={ey} dy={18} textAnchor={textAnchor} fill={cssVar('--muted','#999')}>
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

/* ========================= API (segue seu padrão) ========================= */

// 2. [MUDANÇA 2]: O objeto API agora usa a instância 'api' (Axios)
const API = {
  async summary(groupId, status = 'aprovada') {
    // Usamos 'api.get' (Axios)
    // - Não precisa de '/api/' (vem da baseURL)
    // - Não precisa de 'credentials' (vem da instância global 'api')
    const res = await api.get(`/dashboard/${groupId}/summary?status=${status}`);
    return res.data; // Axios já retorna o JSON em 'res.data'
  },
  async inventory(groupId, status = 'aprovada') {
    const res = await api.get(`/dashboard/${groupId}/inventory?status=${status}`);
    return res.data;
  },
  async timeseries(groupId, range = "30d", tipo = 'todos', status = 'aprovada') {
    const res = await api.get(`/dashboard/${groupId}/timeseries?range=${range}&tipo=${tipo}&status=${status}`);
    return res.data;
  },
};

/* ========================= Componente ========================= */
export default function Dashboard({ grupo }) {
  if (!grupo) return <div className="dash-container">Selecione um grupo para visualizar.</div>;

  /* Estados principais */
  const [activeChart, setActiveChart] = useState("distribuicao"); // 'distribuicao' | 'progresso' | 'tendencia'
  const [activeIndex, setActiveIndex] = useState(0);
  const [filtroItem, setFiltroItem] = useState(null);
  const [range, setRange] = useState("30d"); // 7d | 30d | mes
  const [tipo, setTipo] = useState("todos"); // todos | dinheiro | item
  const [status, setStatus] = useState("aprovada"); // aprovada | pendente | rejeitada | todas
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dados vindos do backend
  const [summary, setSummary] = useState({ meta: 0, progresso: 0, totalItens: 0 });
  const [inventory, setInventory] = useState([]); // [{nome, unidade, quantidade}]
  const [series, setSeries] = useState([]);       // [{data, valor}]

  // Cores reativas ao tema
  const [themeKey, setThemeKey] = useState(0);
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeKey((k) => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const THEME_COLORS = useMemo(() => {
    const primary = cssVar('--primary', '#22c55e');
    const accent1 = cssVar('--accent', '#4caf50') || primary;
    const blue    = '#3b82f6';
    const amber   = '#f59e0b';
    const red     = cssVar('--danger', '#ef4444');
    const purple  = '#a78bfa';
    const teal    = '#14b8a6';
    return [primary, blue, amber, red, purple, teal, accent1];
  }, [themeKey]);

  // Dados derivados
  const totalItens = useMemo(
    () => (inventory ?? []).reduce((s, i) => s + Number(i.quantidade ?? 0), 0),
    [inventory]
  );
  const barData = useMemo(
    () => [{ name: grupo.nome, progresso: Number(summary.progresso ?? 0), meta: Number(summary.meta ?? 0) }],
    [grupo, summary]
  );
  const pieData = useMemo(
    () => (inventory ?? []).map(i => ({ nome: i.nome, unidade: i.unidade, quantidade: Number(i.quantidade ?? 0) })),
    [inventory]
  );

  const onPieEnter = useCallback((_, index) => setActiveIndex(index), []);
  const onPieClick = useCallback((_, index) => setFiltroItem(pieData[index]?.nome ?? null), [pieData]);

  /* ========================= Carregamento inicial + SSE ========================= */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // O 'await Promise.all' funciona exatamente igual com o 'api.get'
      const [sum, inv, ts] = await Promise.all([
        API.summary(grupo.id, status),
        API.inventory(grupo.id, status),
        API.timeseries(grupo.id, range, tipo, status),
      ]);
      // Como o axios já retorna os dados (res.data),
      // não precisamos mais chamar .json()
      setSummary(sum ?? { meta: 0, progresso: 0, totalItens: 0 });
      setInventory(Array.isArray(inv) ? inv : []);
      setSeries(Array.isArray(ts) ? ts : []);
    } catch (e) {
      // O interceptor do api.js vai tratar o 401.
      // Isso aqui vai pegar outros erros (500, 404, etc.)
      setError(e?.response?.data?.error || e?.message || "Erro ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, [grupo.id, range, tipo, status]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // SSE para atualizações em tempo real
  useEffect(() => {
    // 3. [MUDANÇA 3]: Usamos a API_BASE importada de 'src/auth/api.js'
    //    Isso garante que o SSE aponte para o backend (Render) e não
    //    para o frontend (Vercel) em produção.
    const es = new EventSource(`${API_BASE}/stream/grupos/${grupo.id}`, {
      withCredentials: true // Mantemos isso para o EventSource
    });
    
    const handler = async () => {
      try {
        // A lógica de recarregar os dados via 'api' (axios) está correta
        const [sum, inv, ts] = await Promise.all([
          API.summary(grupo.id, status),
          API.inventory(grupo.id, status),
          API.timeseries(grupo.id, range, tipo, status),
        ]);
        setSummary(sum ?? { meta: 0, progresso: 0, totalItens: 0 });
        setInventory(Array.isArray(inv) ? inv : []);
        setSeries(Array.isArray(ts) ? ts : []);
      } catch {/* silencioso */}
    };
    es.addEventListener("dashboard", handler);
    es.addEventListener("heartbeat", () => {}); // mantém conexão viva
    return () => es.close();
  }, [grupo.id, range, tipo, status]); // A dependência de 'loadAll' foi removida para evitar reconexão

  /* ========================= Insights ========================= */
  const getPieChartInsights = (data) => {
    if (!data || data.length === 0) return "Nenhum item no inventário.";
    const sorted = [...data].sort((a, b) => (b.quantidade ?? 0) - (a.quantidade ?? 0));
    const top = sorted[0];
    const total = data.reduce((s, i) => s + (i.quantidade ?? 0), 0);
    const perc = total > 0 ? ((top.quantidade / total) * 100).toFixed(1) : 0;
    return `Mais presente: "${top.nome}" (${top.quantidade} ${top.unidade ?? 'un.'}), ${perc}% do total.`;
  };

  const getBarChartInsights = () => {
    const progresso = summary.progresso ?? 0;
    const meta = summary.meta ?? 0;
    const percent = meta > 0 ? (progresso / meta) * 100 : 0;
    if (percent >= 100) {
      return `Parabéns! A meta de ${currency(meta)} foi atingida e superada em ${(percent - 100).toFixed(1)}%.`;
    }
    return `Você atingiu ${percent.toFixed(1)}% da meta de ${currency(meta)}. Faltam ${currency(Math.max(meta - progresso, 0))}.`;
  };

  /* ========================= Export CSV (Timeseries) ========================= */
  const exportCSV = () => {
    const rows = [["data", "valor"]];
    (series ?? []).forEach(r => rows.push([r.data, String(r.valor ?? 0).replace(".", ",")]));
    const csv = rows.map(r => r.join(";")).join("\n");
    
    // 4. [MUDANÇA 4]: Mantida - Adicionado "\ufeff" (BOM) para forçar o Excel a usar UTF-8
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timeseries_${grupo.id}_${range}_${tipo}_${status}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ========================= UI ========================= */
  return (
    <div className="dash-container">
      {/* Header */}
      <div className="dash-card-header">
        <h4 className="group-title">{grupo.nome}</h4>
        <div className="header-icons">
          <span>{todayStr()}</span>
        </div>
      </div>

      {/* Toolbar: filtros, range e export */}
      <div className="dash-toolbar">
        <div className="filters">
          <label>
            Tipo:
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="item">Item</option>
            </select>
          </label>
          <label>
            Status:
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="aprovada">Aprovadas</option>
              <option value="pendente">Pendentes</option>
              <option value="rejeitada">Rejeitadas</option>
              <option value="todas">Todas</option>
            </select>
          </label>
          <div className="range-filter">
            <button className={range === "7d" ? "active" : ""} onClick={() => setRange("7d")}>7 dias</button>
            <button className={range === "30d" ? "active" : ""} onClick={() => setRange("30d")}>30 dias</button>
            <button className={range === "mes" ? "active" : ""} onClick={() => setRange("mes")}>Mês atual</button>
          </div>
        </div>
        <div className="actions">
          {/* 5. [MUDANÇA 5]: Mantida - Texto do botão alterado */}
          <button className="btn" onClick={exportCSV}>Exportar p/ Excel (CSV)</button>
          <button className="btn" onClick={loadAll}>Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Arrecadado</div>
          <div className="kpi-value">{currency(summary.progresso)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Meta</div>
          <div className="kpi-value">{currency(summary.meta)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Restante</div>
          <div className="kpi-value">{currency(Math.max((summary.meta ?? 0) - (summary.progresso ?? 0), 0))}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Itens totais</div>
          <div className="kpi-value">{shortNum(totalItens)}</div>
        </div>
      </div>

      {/* Seletor de gráfico */}
      <div className="chart-selector">
        <button
          className={activeChart === "distribuicao" ? "active" : ""}
          onClick={() => setActiveChart("distribuicao")}
        >
          Distribuição de Itens
        </button>
        <button
          className={activeChart === "progresso" ? "active" : ""}
          onClick={() => setActiveChart("progresso")}
        >
          Progresso Financeiro
        </button>
        <button
          className={activeChart === "tendencia" ? "active" : ""}
          onClick={() => setActiveChart("tendencia")}
        >
          Tendência (SMA)
        </button>
      </div>

      {/* Loading / Erro */}
      {loading && (
        <div className="dash-card">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      )}
      {error && (
        <div className="dash-card">
          <p className="text-danger">{String(error)}</p>
        </div>
      )}

      {/* Distribuição */}
      {!loading && !error && activeChart === "distribuicao" && (
        <div className="dash-card">
          <h3>Distribuição de Itens</h3>
          {pieData.length === 0 ? (
            <div className="chart-insight">Nenhum item cadastrado ainda.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="quantidade"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    activeIndex={activeIndex}
                    activeShape={ActiveShape}
                    onMouseEnter={onPieEnter}
                    onClick={onPieClick}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={THEME_COLORS[i % THEME_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-insight">
                Insight: {getPieChartInsights(pieData)}
                {filtroItem && (
                  <> {" • "}Filtro ativo: {filtroItem}{" "}
                    <button className="link" onClick={() => setFiltroItem(null)}>limpar</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Progresso */}
      {!loading && !error && activeChart === "progresso" && (
        <div className="dash-card">
          <h3>Progresso de Arrecadação</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border','#e5e7eb')} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
              <Tooltip
                formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                labelFormatter={(name) => name}
                contentStyle={{ borderRadius: 8 }}
              />
              <ReferenceLine y={summary.meta ?? 0} stroke={cssVar('--danger','#ef4444')} strokeDasharray="4 4" />
              <Bar dataKey="progresso" fill={THEME_COLORS[0]} radius={[8, 8, 0, 0]}>
                <LabelList dataKey="progresso" position="top"
                           formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
              </Bar>
              <Bar dataKey="meta" fill={THEME_COLORS[1]} radius={[8, 8, 0, 0]}>
                <LabelList dataKey="meta" position="top"
                           formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-insight">Insight: {getBarChartInsights()}</div>
        </div>
      )}

      {/* Tendência */}
      {!loading && !error && activeChart === "tendencia" && (
        <div className="dash-card">
          <h3>Tendência de Doações (R$)</h3>
          <div className="range-filter" style={{ marginBottom: 8 }}>
            <button className={range === "7d" ? "active" : ""} onClick={() => setRange("7d")}>7 dias</button>
            <button className={range === "30d" ? "active" : ""} onClick={() => setRange("30d")}>30 dias</button>
            <button className={range === "mes" ? "active" : ""} onClick={() => setRange("mes")}>Mês atual</button>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--border','#e5e7eb')} />
              <XAxis
                dataKey="data"
                tickFormatter={(v) => new Date(v + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              />
              <YAxis
                tickFormatter={(v) => `R$ ${shortNum(v)}`}
              />
              <Tooltip
                formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                labelFormatter={(v) => new Date(v + "T00:00").toLocaleDateString("pt-BR")}
              />
              <Line type="monotone" dataKey="valor" stroke={THEME_COLORS[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}