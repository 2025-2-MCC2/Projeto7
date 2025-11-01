// src/components/Dashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  Sector,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import "./Dashboard.css";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://projeto-interdisciplinar-2.onrender.com/api";

/* =========================
   Helpers de formatação
   ========================= */
const currency = (v) =>
  Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v || 0)
  );

const shortNum = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(".", ",") + " mi";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".", ",") + " mil";
  return n.toLocaleString("pt-BR");
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/* =========================
   Tooltip customizada
   ========================= */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const p = payload[0];
    return (
      <div className="custom-tooltip" role="status">
        {label && <p className="label">{label}</p>}
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

/* =========================
   Fatia ativa (Pizza)
   ========================= */
const ActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
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
      <text
        x={cx}
        y={cy}
        dy={-6}
        textAnchor="middle"
        fill="var(--text,#333)"
        fontWeight={700}
      >
        {payload.name}
      </text>
      <text x={cx} y={cy} dy={16} textAnchor="middle" fill="var(--muted,#666)">
        {value} {payload.unidade || "un."} ({(percent * 100).toFixed(1)}%)
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.6}
      />
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill}
        fill="none"
      />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 12 : -12)}
        y={ey}
        textAnchor={textAnchor}
        fill="var(--text,#333)"
      >
        {`${value.toLocaleString("pt-BR")} ${payload.unidade || "un."}`}
      </text>
      <text
        x={ex + (cos >= 0 ? 12 : -12)}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="var(--muted,#999)"
      >
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a78bfa",
  "#14b8a6",
  "#e11d48",
];

/* =========================
   API (NOVO)
   ========================= */
const API = {
  async summary(groupId) {
    const r = await fetch(`${API_BASE}/dashboard/${groupId}/summary`, {
      credentials: "include",
    });
    if (!r.ok) throw new Error("Falha ao carregar summary");
    return r.json();
  },
  async inventory(groupId) {
    const r = await fetch(`${API_BASE}/dashboard/${groupId}/inventory`, {
      credentials: "include",
    });
    if (!r.ok) throw new Error("Falha ao carregar inventário");
    return r.json(); // [{nome, unidade, quantidade}]
  },
  async timeseries(groupId, range = "30d") {
    const r = await fetch(
      `${API_BASE}/dashboard/${groupId}/timeseries?range=${range}`,
      {
        credentials: "include",
      }
    );
    if (!r.ok) throw new Error("Falha ao carregar série temporal");
    return r.json(); // [{data, valor}]
  },
};

export default function Dashboard({ grupo }) {
  if (!grupo)
    return (
      <div className="dash-card">
        <p>Selecione um grupo para visualizar.</p>
      </div>
    );

  /* =========================
     Estados
     ========================= */
  const [activeChart, setActiveChart] = useState("distribuicao"); // 'distribuicao'|'progresso'|'tendencia'
  const [activeIndex, setActiveIndex] = useState(0);
  const [filtroItem, setFiltroItem] = useState(null);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dados vindos do backend (NOVO)
  const [summary, setSummary] = useState({
    meta: 0,
    progresso: 0,
    totalItens: 0,
  });
  const [inventory, setInventory] = useState([]); // [{nome, unidade, quantidade}]
  const [series, setSeries] = useState([]); // [{data, valor}]

  const totalItens = useMemo(
    () => (inventory || []).reduce((s, i) => s + Number(i.quantidade || 0), 0),
    [inventory]
  );

  const barData = useMemo(
    () => [
      {
        name: grupo.nome,
        progresso: Number(summary.progresso || 0),
        meta: Number(summary.meta || 0),
      },
    ],
    [grupo, summary]
  );

  const pieData = useMemo(
    () =>
      (inventory || []).map((i) => ({
        nome: i.nome,
        unidade: i.unidade,
        quantidade: Number(i.quantidade || 0),
      })),
    [inventory]
  );

  const onPieEnter = useCallback((_, index) => setActiveIndex(index), []);
  const onPieClick = useCallback(
    (_, index) => setFiltroItem(pieData[index]?.nome ?? null),
    [pieData]
  );

  /* =========================
     Carregamento inicial + SSE (NOVO)
     ========================= */
  useEffect(() => {
    let abort = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const [sum, inv, ts] = await Promise.all([
          API.summary(grupo.id),
          API.inventory(grupo.id),
          API.timeseries(grupo.id, range),
        ]);
        if (abort) return;
        setSummary(sum);
        setInventory(inv);
        setSeries(ts);
      } catch (e) {
        if (!abort) setError(e?.message || "Erro ao carregar dashboard.");
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();

    // Assina SSE para atualizações (aprovação de doações / novas doações)
    const es = new EventSource(`${API_BASE}/stream/grupos/${grupo.id}`, {
      credentials: "include",
      withCredentials: true,
    });
    const handler = async () => {
      try {
        const [sum, inv, ts] = await Promise.all([
          API.summary(grupo.id),
          API.inventory(grupo.id),
          API.timeseries(grupo.id, range),
        ]);
        setSummary(sum);
        setInventory(inv);
        setSeries(ts);
      } catch {}
    };
    es.addEventListener("dashboard", handler);
    es.addEventListener("heartbeat", () => {}); // mantém conexão viva

    return () => {
      abort = true;
      es.close();
    };
  }, [grupo.id, range]);

  /* =========================
     Insights
     ========================= */
  const getPieChartInsights = (data) => {
    if (!data || data.length === 0) return "Nenhum item no inventário.";
    const sorted = [...data].sort(
      (a, b) => (b.quantidade || 0) - (a.quantidade || 0)
    );
    const top = sorted[0];
    const total = data.reduce((s, i) => s + (i.quantidade || 0), 0);
    const perc = total > 0 ? ((top.quantidade / total) * 100).toFixed(1) : 0;
    return `Mais presente: "${top.nome}" (${top.quantidade} ${
      top.unidade || "un."
    }), ${perc}% do total.`;
  };

  const getBarChartInsights = () => {
    const progresso = summary.progresso || 0;
    const meta = summary.meta || 0;
    const percent = meta > 0 ? (progresso / meta) * 100 : 0;
    if (percent >= 100) {
      return `Parabéns! A meta de ${currency(
        meta
      )} foi atingida e superada em ${(percent - 100).toFixed(1)}%.`;
    }
    return `Você atingiu ${percent.toFixed(1)}% da meta de ${currency(
      meta
    )}. Faltam ${currency(Math.max(meta - progresso, 0))}.`;
  };

  /* =========================
     UI
     ========================= */
  return (
    <div className="dash-container">
      {/* Header */}
      <div className="dash-card-header">
        <h3 className="group-title">{grupo.nome}</h3>
        <div className="header-icons" aria-hidden>
          <span title="Atualizado">{todayStr()}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Arrecadado</span>
          <strong className="kpi-value">{currency(summary.progresso)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Meta</span>
          <strong className="kpi-value">{currency(summary.meta)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Restante</span>
          <strong className="kpi-value">
            {currency(
              Math.max((summary.meta || 0) - (summary.progresso || 0), 0)
            )}
          </strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Itens totais</span>
          <strong className="kpi-value">{shortNum(totalItens)}</strong>
        </div>
      </div>

      {/* Tabs de gráfico */}
      <div
        className="chart-selector"
        role="tablist"
        aria-label="Seleção de gráfico"
      >
        <button
          role="tab"
          aria-selected={activeChart === "distribuicao"}
          className={activeChart === "distribuicao" ? "active" : ""}
          onClick={() => setActiveChart("distribuicao")}
        >
          Distribuição de Itens
        </button>
        <button
          role="tab"
          aria-selected={activeChart === "progresso"}
          className={activeChart === "progresso" ? "active" : ""}
          onClick={() => setActiveChart("progresso")}
        >
          Progresso Financeiro
        </button>
        <button
          role="tab"
          aria-selected={activeChart === "tendencia"}
          className={activeChart === "tendencia" ? "active" : ""}
          onClick={() => setActiveChart("tendencia")}
        >
          Tendência (SMA)
        </button>
      </div>

      {/* Loading/Erro */}
      {loading && (
        <div className="dash-card">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      )}
      {error && (
        <div className="dash-card">
          <p className="message error">{String(error)}</p>
        </div>
      )}

      {/* Distribuição */}
      {activeChart === "distribuicao" && (
        <div className="dash-card">
          <h3>Distribuição de Itens</h3>
          {pieData.length === 0 ? (
            <>
              <p className="muted">Nenhum item cadastrado ainda.</p>
              <div className="skeleton-row" />
              <div className="skeleton-row" />
              <div className="skeleton-row" />
            </>
          ) : (
            <>
              <div className="card-content">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="quantidade"
                      nameKey="nome"
                      innerRadius={70}
                      outerRadius={110}
                      activeIndex={activeIndex}
                      activeShape={(p) => <ActiveShape {...p} />}
                      onMouseEnter={onPieEnter}
                      onClick={onPieClick}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-insight" aria-live="polite">
                <strong>Insight:</strong> {getPieChartInsights(pieData)}
                {filtroItem && (
                  <>
                    {" • "}
                    <strong>Filtro ativo:</strong> {filtroItem}{" "}
                    <button
                      className="link"
                      onClick={() => setFiltroItem(null)}
                    >
                      limpar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Progresso */}
      {activeChart === "progresso" && (
        <div className="dash-card">
          <h3>Progresso de Arrecadação</h3>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  tickFormatter={(v) =>
                    `R$ ${Number(v).toLocaleString("pt-BR")}`
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    `R$ ${Number(v).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`
                  }
                />
                <Bar
                  dataKey="progresso"
                  fill="var(--primary, #22c55e)"
                  radius={[6, 6, 0, 0]}
                >
                  <LabelList
                    dataKey="progresso"
                    position="top"
                    formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`}
                  />
                </Bar>
                <ReferenceLine
                  y={barData[0]?.meta || 0}
                  stroke="var(--danger, #ef4444)"
                  strokeDasharray="4 4"
                  label={{
                    value: "Meta",
                    position: "top",
                    fill: "var(--danger, #ef4444)",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-insight" aria-live="polite">
            <strong>Insight:</strong> {getBarChartInsights()}
          </div>
        </div>
      )}

      {/* Tendência */}
      {activeChart === "tendencia" && (
        <div className="dash-card">
          <h3>Tendência de Doações (R$)</h3>

          <div className="range-filter" role="group" aria-label="Período">
            <button
              className={range === "7d" ? "active" : ""}
              onClick={() => setRange("7d")}
            >
              7 dias
            </button>
            <button
              className={range === "30d" ? "active" : ""}
              onClick={() => setRange("30d")}
            >
              30 dias
            </button>
            <button
              className={range === "mes" ? "active" : ""}
              onClick={() => setRange("mes")}
            >
              Mês atual
            </button>
          </div>

          <div className="card-content">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v) =>
                    new Date(v + "T00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                />
                <YAxis tickFormatter={(v) => `R$ ${shortNum(v)}`} />
                <Tooltip
                  formatter={(v) =>
                    `R$ ${Number(v).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="valor"
                  name="Diário"
                  stroke="#22c55e"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
