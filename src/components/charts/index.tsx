'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

const axisStyle = { fontSize: 11, fill: '#657391' };

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3 text-xs shadow-pop">
      {label && <p className="mb-1.5 font-semibold text-ink-900">{label}</p>}
      <ul className="space-y-1">
        {payload
          .filter((item: any) => item.value !== 0 && item.value !== null)
          .map((item: any) => (
            <li key={item.dataKey ?? item.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color ?? item.fill }} />
              <span className="text-ink-600">{item.name}</span>
              <span className="ml-auto font-medium tabular-nums text-ink-900">
                {formatCurrency(item.value)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Fluxo de caixa: barras realizadas/previstas + linha de saldo acumulado. */
export function CashFlowChart({
  data,
}: {
  data: Array<{
    label: string;
    realizedIn: number;
    realizedOut: number;
    forecastIn: number;
    forecastOut: number;
    accumulated: number;
  }>;
}) {
  const shaped = data.map((d) => ({
    ...d,
    entradas: d.realizedIn + d.forecastIn,
    saidas: -(d.realizedOut + d.forecastOut),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={shaped} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d5d9e2' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={compact} width={52} />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="entradas" name="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={38} />
        <Bar dataKey="saidas" name="Saidas" fill="#ef4444" radius={[0, 0, 4, 4]} maxBarSize={38} />
        <Line
          type="monotone"
          dataKey="accumulated"
          name="Saldo acumulado"
          stroke="#0ea5e9"
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Evolucao de receita x despesa. */
export function RevenueChart({
  data,
}: {
  data: Array<{ label: string; receitas: number; despesas: number; resultado: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#d5d9e2' }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={compact} width={52} />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#16a34a" fill="url(#gr)" strokeWidth={2} />
        <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" fill="url(#gd)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Rosca de participacao por categoria. */
export function CategoryDonut({
  data,
}: {
  data: Array<{ name: string; amount: number; color?: string | null }>;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-500">Sem dados no periodo.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="name"
          innerRadius={62}
          outerRadius={96}
          paddingAngle={2}
          stroke="#fff"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CurrencyTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontais - usado no aging de inadimplencia. */
export function AgingChart({ data }: { data: Array<{ label: string; amount: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" horizontal={false} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={compact} />
        <YAxis type="category" dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} width={110} />
        <Tooltip content={<CurrencyTooltip />} />
        <Bar dataKey="amount" name="Em atraso" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((_, index) => (
            <Cell key={index} fill={['#fbbf24', '#fb923c', '#f97316', '#ef4444', '#b91c1c'][index] ?? '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Curva ABC: barras de faturamento + linha de percentual acumulado. */
export function AbcChart({
  data,
}: {
  data: Array<{ name: string; amount: number; accumulatedPercent: number; curve: string }>;
}) {
  const colors: Record<string, string> = { A: '#16a34a', B: '#eab308', C: '#94a3b8' };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eceef2" vertical={false} />
        <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
        <YAxis yAxisId="left" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={compact} width={52} />
        <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} unit="%" width={42} domain={[0, 100]} />
        <Tooltip />
        <Bar yAxisId="left" dataKey="amount" name="Faturamento" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, index) => (
            <Cell key={index} fill={colors[entry.curve] ?? '#94a3b8'} />
          ))}
        </Bar>
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="accumulatedPercent"
          name="% acumulado"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
