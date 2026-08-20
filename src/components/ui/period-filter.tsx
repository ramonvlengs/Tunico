'use client';

import { useQueryState } from './filters';
import { addMonthsUTC, endOfMonthUTC, startOfMonthUTC, toDateInput } from '@/lib/utils';

/** Atalhos de periodo usados nos relatorios. */
const PRESETS: Array<{ key: string; label: string; range: () => [Date, Date] }> = [
  {
    key: 'this-month',
    label: 'Mes atual',
    range: () => [startOfMonthUTC(), endOfMonthUTC()],
  },
  {
    key: 'last-month',
    label: 'Mes anterior',
    range: () => {
      const previous = addMonthsUTC(new Date(), -1);
      return [startOfMonthUTC(previous), endOfMonthUTC(previous)];
    },
  },
  {
    key: 'quarter',
    label: 'Ultimos 3 meses',
    range: () => [startOfMonthUTC(addMonthsUTC(new Date(), -2)), endOfMonthUTC()],
  },
  {
    key: 'semester',
    label: 'Ultimos 6 meses',
    range: () => [startOfMonthUTC(addMonthsUTC(new Date(), -5)), endOfMonthUTC()],
  },
  {
    key: 'year',
    label: 'Ano atual',
    range: () => {
      const now = new Date();
      return [new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59))];
    },
  },
];

export function PeriodFilter() {
  const { params, setParams } = useQueryState();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const apply = (preset: (typeof PRESETS)[number]) => {
    const [start, end] = preset.range();
    setParams({ from: toDateInput(start), to: toDateInput(end) });
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 no-print">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => {
          const [start, end] = preset.range();
          const active = from === toDateInput(start) && to === toDateInput(end);
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => apply(preset)}
              className={active ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <label className="text-xs text-ink-500" htmlFor="period-from">De</label>
        <input
          id="period-from"
          type="date"
          value={from}
          onChange={(event) => setParams({ from: event.target.value || null })}
          className="input w-auto"
        />
        <label className="text-xs text-ink-500" htmlFor="period-to">ate</label>
        <input
          id="period-to"
          type="date"
          value={to}
          onChange={(event) => setParams({ to: event.target.value || null })}
          className="input w-auto"
        />
      </div>
    </div>
  );
}
