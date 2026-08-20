/** Geracao de CSV compativel com Excel em pt-BR (separador ";" e BOM UTF-8). */

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  if (rows.length === 0) return '';
  const columns = headers ?? Object.keys(rows[0]);
  const lines = [
    columns.map(csvEscape).join(';'),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(';')),
  ];
  // BOM para o Excel reconhecer os acentos.
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** Numero no formato brasileiro, para o Excel interpretar como numero. */
export function csvNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2).replace('.', ',');
}

export function csvDate(value: Date | null | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value);
}

export function csvResponse(csv: string, fileName: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
