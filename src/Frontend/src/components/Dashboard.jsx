// src/components/Dashboard.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Sector,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ReferenceLine,
    LineChart, Line
} from "recharts";
import "./Dashboard.css";

// --- Componentes Customizados para os Gráficos ---

// NOVO: Componente para o Tooltip personalizado
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip">
                <p className="label">{label || payload[0].name}</p>
                <p className="intro">{`Valor: ${payload[0].value}`}</p>
            </div>
        );
    }
    return null;
};

// NOVO: Componente para renderizar a forma da fatia ativa da Pizza (efeito de hover)
const ActiveShape = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
                {payload.name}
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
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 6}
                outerRadius={outerRadius + 10}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">{`${value} un.`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">
                {`(${(percent * 100).toFixed(2)}%)`}
            </text>
        </g>
    );
};

// NOVO: Funções para gerar "traduções" dos gráficos para texto.
const getPieChartInsights = (data) => {
    if (!data || data.length === 0) {
        return "Nenhum item no inventário para exibir insights.";
    }
    const sortedData = [...data].sort((a, b) => b.quantidade - a.quantidade);
    const topItem = sortedData[0];
    const total = data.reduce((sum, item) => sum + item.quantidade, 0);
    return `O item com maior quantidade é "${topItem.nome}" (${topItem.quantidade} unidades), representando ${( (topItem.quantidade / total) * 100 ).toFixed(1)}% do total de itens.`;
};

const getBarChartInsights = (grupo) => {
    // CORREÇÃO: Adiciona fallbacks para evitar NaN se os valores forem undefined.
    const progresso = grupo.progressoArrecadacao || 0;
    const meta = grupo.metaArrecadacao || 0;

    const percent = meta > 0 ? (progresso / meta) * 100 : 0;
    if (percent >= 100) {
        return `Parabéns! A meta de R$ ${meta.toFixed(2)} foi atingida e superada em ${(percent - 100).toFixed(1)}%.`;
    }
    return `Atualmente, ${percent.toFixed(1)}% da meta de R$ ${meta.toFixed(2)} foi alcançada. Faltam R$ ${(meta - progresso).toFixed(2)} para o objetivo.`;
};


export default function Dashboard({ grupo }) {
    if (!grupo) {
        return <div className="dash-container"><p>Nenhum grupo para exibir.</p></div>;
    }

    // NOVO: Estado para controlar o gráfico ativo
    const [activeChart, setActiveChart] = useState('distribuicao');
    // NOVO: Estado para controlar qual fatia da pizza está ativa (para o efeito de hover)
    const [activeIndex, setActiveIndex] = useState(0);
    const onPieEnter = useCallback((_, index) => {
        setActiveIndex(index);
    }, [setActiveIndex]);

    const pieData = grupo.inventario || [];
    const totalItens = useMemo(() => pieData.reduce((sum, item) => sum + item.quantidade, 0), [pieData]);

    const dadosProgressoGrupos = useMemo(() => [{ name: grupo.nome, progresso: grupo.progressoArrecadacao, meta: grupo.metaArrecadacao }], [grupo]);
    const mediaProgresso = useMemo(() => {
        // Em um cenário com múltiplos grupos, você calcularia a média de todos.
        // Por agora, vamos definir uma média de exemplo.
        return 2500;
    }, []);

    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF"];

    return (
        <div className="dash-container">
            <div className="dash-card-header">
                <h2 className="group-title">{grupo.nome}</h2>
                <div className="header-icons"><span>🕒</span><span>🕔</span><span>📊</span><span>📈</span><span className="filter-icon">🔽</span></div>
            </div>

            {/* NOVO: Card de Progresso da Meta */}
            <div className="dash-card">
                <div className="card-content">
                    <h3>Progresso da Meta</h3>
                    <div className="progress-meta-container">
                        <span>R$ {(grupo.progressoArrecadacao || 0).toFixed(2)}</span>
                        <progress 
                            value={grupo.progressoArrecadacao || 0} 
                            max={grupo.metaArrecadacao || 1} 
                        />
                        <span>R$ {(grupo.metaArrecadacao || 0).toFixed(2)}</span>
                    </div>
                </div>
                <div className="card-actions">
                    <button className="icon-button" title="Adicionar Arrecadação">+</button>
                </div>
            </div>

            {/* NOVO: Seletor de Gráficos */}
            <div className="chart-selector">
                <button className={activeChart === 'distribuicao' ? 'active' : ''} onClick={() => setActiveChart('distribuicao')}>Distribuição de Itens</button>
                <button className={activeChart === 'progresso' ? 'active' : ''} onClick={() => setActiveChart('progresso')}>Progresso Financeiro</button>
            </div>

            {/* NOVO: Renderização condicional dos gráficos */}
            {activeChart === 'distribuicao' && (
                <div className="dash-card">
                    <div className="card-content">
                        <h3>Distribuição de Itens</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="donut-center-text-total">{totalItens}</text>
                                <text x="50%" y="50%" dy={20} textAnchor="middle" dominantBaseline="middle" className="donut-center-text-label">Itens</text>
                                <Pie
                                    activeIndex={activeIndex}
                                    activeShape={ActiveShape}
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="quantidade"
                                    onMouseEnter={onPieEnter}
                                    nameKey="nome"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend formatter={(value, entry) => <span className="legend-text">{value}</span>} />
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="chart-insight">
                            <strong>💡 Insight:</strong> {getPieChartInsights(pieData)}
                        </div>
                    </div>
                    <div className="card-actions">
                        <button className="icon-button" title="Adicionar Item">+</button>
                        <button className="icon-button" title="Comentários">💬</button>
                    </div>
                </div>
            )}

            {activeChart === 'progresso' && (
                <div className="dash-card">
                    <div className="card-content">
                        <h3>Progresso de Arrecadação</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dadosProgressoGrupos} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorProgresso" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.9} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 'dataMax + 1000']} />
                                <YAxis type="category" dataKey="name" width={150} tick={{ width: 140, textAnchor: 'end' }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 206, 206, 0.2)' }} />
                                <Legend />
                                <ReferenceLine x={mediaProgresso} stroke="red" strokeDasharray="3 3" />
                                <Bar dataKey="progresso" name="Arrecadado" fill="url(#colorProgresso)">
                                    <LabelList dataKey="progresso" position="right" style={{ fill: 'black' }} formatter={(value) => `R$ ${value}`} />
                                </Bar>
                                <Bar dataKey="meta" name="Meta" fill="#e0e0e0" />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="chart-insight">
                            <strong>💡 Insight:</strong> {getBarChartInsights(grupo)}
                        </div>
                    </div>
                    <div className="card-actions">
                        <button className="icon-button" title="Adicionar Arrecadação">+</button>
                        <button className="icon-button" title="Comentários">💬</button>
                    </div>
                </div>
            )}
        </div>
    );
}