// src/components/Dashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend, Sector,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ReferenceLine,
  LineChart, Line
} from "recharts";
import "./Dashboard.css";

/* =========================
   Helpers de formatação / cálculo
   ========================= */
const currency = (v) =>
  Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number(v || 0));

const shortNum = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + " mi";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".", ",") + " mil";
  return n.toLocaleString("pt-BR");
};

const calcSMA = (serie, windowSize = 7) => {
  if (!Array.isArray(serie)) return [];
  const out = [];
  for (let i = 0; i < serie.length; i++) {
    const from = Math.max(0, i - (windowSize - 1));
    const slice = serie.slice(from, i + 1).map((d) => Number(d.valor || 0));
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push({ ...serie[i], valor: Number(avg.toFixed(2)) });
  }
  return out;
};

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const genDemoSeries = (dias = 30, totalAproximado = 2500) => {
  // Série fake para demonstração (até plugar backend)
  const out = [];
  const now = new Date();
  const dailyMean = totalAproximado / dias;
  let acc = 0;
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const jitter = (Math.random() - 0.5) * dailyMean * 0.8;
    const val = Math.max(0, dailyMean + jitter);
    acc += val;
    const pad = (n) => String(n).padStart(2, "0");
    out.push({
      data: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      valor: Number(val.toFixed(2)),
      acumulado: Number(acc.toFixed(2)),
    });
  }
  return out;
};

const filterByRange = (serie, range = "30d") => {
  if (!Array.isArray(serie) || serie.length === 0) return [];
  if (range === "7d") return serie.slice(-7);
  if (range === "30d") return serie.slice(-30);
  // 'mes' → filtra por mês atual
  if (range === "mes") {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return serie.filter((d) => {
      const dt = new Date(d.data + "T00:00");
      return dt.getMonth() === m && dt.getFullYear() === y;
    });
  }
  return serie;
};

/* =========================
   Custom Tooltip (Pizza/Barras/Linha)
   ========================= */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const p = payload[0];
    return (
      <div className="custom-tooltip" role="status">
        {label && <p className="label">{label}</p>}
        <p className="intro">
          {p.name ? `${p.name}: ` : ""}
          {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}
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
    cx, cy, midAngle, innerRadius, outerRadius,
    startAngle, endAngle, fill, payload, percent, value
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
      <text x={cx} y={cy} dy={-6} textAnchor="middle" fill="var(--text,#333)" fontWeight={700}>
        {payload.name}
      </text>
      <text x={cx} y={cy} dy={16} textAnchor="middle" fill="var(--muted,#666)">
        {value} un. ({(percent * 100).toFixed(1)}%)
      </text>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.6}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 12 : -12)} y={ey} textAnchor={textAnchor} fill="var(--text,#333)">
        {`${value.toLocaleString("pt-BR")} un.`}
      </text>
      <text x={ex + (cos >= 0 ? 12 : -12)} y={ey} dy={18} textAnchor={textAnchor} fill="var(--muted,#999)">
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

/* =========================
   Insights textuais
   ========================= */
const getPieChartInsights = (data) => {
  if (!data || data.length === 0) {
    return "Nenhum item no inventário para exibir insights.";
  }
  const sorted = [...data].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0));
  const top = sorted[0];
  const total = data.reduce((s, i) => s + (i.quantidade || 0), 0);
  return `Mais presente: "${top.nome}" (${top.quantidade} un.), representando ${((top.quantidade / total) * 100).toFixed(1)}% do total.`;
};

const getBarChartInsights = (grupo) => {
  const progresso = grupo.progressoArrecadacao ?? 0;
  const meta = grupo.metaArrecadacao ?? 0;
  const percent = meta > 0 ? (progresso / meta) * 100 : 0;
  if (percent >= 100) {
    return `Parabéns! A meta de ${currency(meta)} foi atingida e superada em ${(percent - 100).toFixed(1)}%.`;
  }
  return `Você atingiu ${percent.toFixed(1)}% da meta de ${currency(meta)}. Faltam ${currency(meta - progresso)} para o objetivo.`;
};

/* =========================
   Backend (comentado)
   ========================= */
/*
const API = {
  async summary(groupId) {
    // GET /api/dashboard/:groupId/summary → { meta, progresso, totalItens }
    const r = await fetch(`/api/dashboard/${groupId}/summary`);
    if (!r.ok) throw new Error('Falha ao carregar summary');
    return r.json();
  },
  async inventory(groupId) {
    // GET /api/dashboard/:groupId/inventory → [{ nome, quantidade }]
    const r = await fetch(`/api/dashboard/${groupId}/inventory`);
    if (!r.ok) throw new Error('Falha ao carregar inventário');
    return r.json();
  },
  async timeseries(groupId, range = '30d') {
    // GET /api/dashboard/:groupId/timeseries?range=30d → [{ data:'YYYY-MM-DD', valor: number }]
    const r = await fetch(`/api/dashboard/${groupId}/timeseries?range=${range}`);
    if (!r.ok) throw new Error('Falha ao carregar série temporal');
    return r.json();
  },
};
*/

export default function Dashboard({ grupo }) {
  if (!grupo) return <div className="dash-card"><p>Selecione um grupo para visualizar.</p></div>;

  /* =========================
     Estados locais
     ========================= */
  const [activeChart, setActiveChart] = useState("distribuicao"); // 'distribuicao'|'progresso'|'tendencia'
  const [activeIndex, setActiveIndex] = useState(0);
  const [filtroItem, setFiltroItem] = useState(null);
  const [range, setRange] = useState("30d"); // '7d'|'30d'|'mes'

  // Carregamentos (quando backend estiver ativo)
  // const [loading, setLoading] = useState(false);
  // const [error, setError] = useState("");

  /* =========================
     Dados base (frontend atual)
     ========================= */
  const pieData = useMemo(() => {
    const inv = Array.isArray(grupo.inventario) ? grupo.inventario : [];
    return inv.map((i) => ({ nome: i.nome, quantidade: Number(i.quantidade || 0) }));
  }, [grupo]);

  const totalItens = useMemo(
    () => pieData.reduce((s, i) => s + (i.quantidade || 0), 0),
    [pieData]
  );

  // Série temporal (demo) — troca para API.timeseries quando plugar backend
  const serieFull = useMemo(() => genDemoSeries(30, grupo.progressoArrecadacao || 2500), [grupo]);
  const serieFiltrada = useMemo(() => filterByRange(serieFull, range), [serieFull, range]);
  const sma7 = useMemo(() => calcSMA(serieFiltrada, 7), [serieFiltrada]);

  const barData = useMemo(
    () => [{ name: grupo.nome, progresso: Number(grupo.progressoArrecadacao || 0), meta: Number(grupo.metaArrecadacao || 0) }],
    [grupo]
  );

  const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a78bfa", "#14b8a6", "#e11d48"];

  const onPieEnter = useCallback((_, index) => setActiveIndex(index), []);
  const onPieClick = useCallback((_, index) => setFiltroItem(pieData[index]?.nome || null), [pieData]);

  /* =========================
     Backend (comentado): como ligar
     ========================= */
  /*
  useEffect(() => {
    let abort = false;
    const load = async () => {
      try {
        setLoading(true); setError("");
        const groupId = grupo.id;
        const [sum, inv, ts] = await Promise.all([
          API.summary(groupId),
          API.inventory(groupId),
          API.timeseries(groupId, range),
        ]);
        if (abort) return;

        // Exemplo de como setar estados com retorno do backend:
        // setPieData(inv);
        // setBarData([{ name: sum.nome, progresso: sum.progresso, meta: sum.meta }]);
        // setSerieFull(ts);

      } catch (e) {
        if (!abort) setError(e?.message || "Erro ao carregar dashboard.");
      } finally {
        if (!abort) setLoading(false);
      }
    };
    load();
    return () => { abort = true; };
  }, [grupo.id, range]);
  */

  /* =========================
     UI
     ========================= */
  return (
    <div className="dash-container">
      {/* Header do card principal */}
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
          <strong className="kpi-value">{currency(grupo.progressoArrecadacao)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Meta</span>
          <strong className="kpi-value">{currency(grupo.metaArrecadacao)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Restante</span>
          <strong className="kpi-value">
            {currency(Math.max((grupo.metaArrecadacao || 0) - (grupo.progressoArrecadacao || 0), 0))}
          </strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Itens totais</span>
          <strong className="kpi-value">{shortNum(totalItens)}</strong>
        </div>
      </div>

      {/* Seletor de gráfico */}
      <div className="chart-selector" role="tablist" aria-label="Seleção de gráfico">
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

      {/* Cards de gráficos */}
      {activeChart === "distribuicao" && (
        <div className="dash-card">
          <h3>Distribuição de Itens</h3>

          {pieData.length === 0 ? (
            <>
              <p className="muted">Nenhum item cadastrado ainda. Adicione itens para ver a distribuição.</p>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
              <div className="skeleton-row"></div>
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
                      activeShape={ActiveShape}
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
                    <button className="link" onClick={() => setFiltroItem(null)}>limpar</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeChart === "progresso" && (
        <div className="dash-card">
          <h3>Progresso de Arrecadação</h3>
          <div className="card-content">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Bar dataKey="progresso" fill="var(--primary, #22c55e)" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="progresso" position="top" formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                </Bar>
                <ReferenceLine
                  y={barData[0]?.meta || 0}
                  stroke="var(--danger, #ef4444)"
                  strokeDasharray="4 4"
                  label={{ value: "Meta", position: "top", fill: "var(--danger,#ef4444)" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-insight" aria-live="polite">
            <strong>Insight:</strong> {getBarChartInsights(grupo)}
          </div>
        </div>
      )}

      {activeChart === "tendencia" && (
        <div className="dash-card">
          <h3>Tendência de Doações / Coletas</h3>

          {/* Filtro de período */}
          <div className="range-filter" role="group" aria-label="Período">
            <button className={range === "7d" ? "active" : ""} onClick={() => setRange("7d")}>7 dias</button>
            <button className={range === "30d" ? "active" : ""} onClick={() => setRange("30d")}>30 dias</button>
            <button className={range === "mes" ? "active" : ""} onClick={() => setRange("mes")}>Mês atual</button>
          </div>

          <div className="card-content">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={serieFiltrada}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tickFormatter={(v) => new Date(v + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                <YAxis tickFormatter={(v) => `R$ ${shortNum(v)}`} />
                <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Line type="monotone" dataKey="valor" name="Diário" stroke="#22c55e" dot={false} strokeWidth={2} />
                <Line type="monotone" data={sma7} dataKey="valor" name="SMA(7)" stroke="#3b82f6" dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}