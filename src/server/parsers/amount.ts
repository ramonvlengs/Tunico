/** Utilitarios compartilhados pelos parsers de planilha e PDF. */

/**
 * Converte um valor monetario em formato brasileiro (ou americano) para number.
 * Aceita: "1.234,56", "1234,56", "R$ 1.234,56", "-1.234,56", "1.234,56 D",
 * "(1.234,56)", "1,234.56".
 */
export function parseBrazilianAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  let value = String(input).trim();
  if (!value) return null;

  let sign = 1;

  // Parenteses indicam valor negativo em muitos extratos.
  if (/^\(.*\)$/.test(value)) {
    sign = -1;
    value = value.slice(1, -1);
  }

  // Sufixo/prefixo D (debito) ou C (credito).
  const dc = /(^|\s)([DC])\s*$/i.exec(value);
  if (dc) {
    if (dc[2].toUpperCase() === 'D') sign = -1;
    value = value.slice(0, dc.index).trim();
  }

  value = value.replace(/R\$\s*/gi, '').replace(/\s/g, '');

  if (value.startsWith('-')) {
    sign *= -1;
    value = value.slice(1);
  } else if (value.startsWith('+')) {
    value = value.slice(1);
  }

  if (!/[\d]/.test(value)) return null;

  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  if (hasComma && hasDot) {
    // O separador decimal e o ultimo a aparecer.
    value = value.lastIndexOf(',') > value.lastIndexOf('.')
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '');
  } else if (hasComma) {
    value = value.replace(',', '.');
  } else if (hasDot) {
    // "1.234" sem decimais e separador de milhar; "1.23" e decimal.
    const parts = value.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      value = parts.join('');
    }
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed * sign;
}

/** Converte datas em dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd, dd/mm para Date UTC. */
export function parseFlexibleDate(
  input: string | number | Date | null | undefined,
  referenceYear?: number,
): Date | null {
  if (input === null || input === undefined || input === '') return null;

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
  }

  // Numero serial do Excel (dias desde 30/12/1899).
  if (typeof input === 'number') {
    if (input < 20000 || input > 60000) return null;
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.round(input) * 86400000);
  }

  const value = String(input).trim();
  if (!value) return null;

  // ISO: aaaa-mm-dd
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(value);
  if (m) return buildUTC(Number(m[1]), Number(m[2]), Number(m[3]));

  // Brasileiro: dd/mm/aaaa ou dd-mm-aaaa
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(value);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return buildUTC(year, Number(m[2]), Number(m[1]));
  }

  // Sem ano: dd/mm (comum em PDFs de extrato)
  m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (m && referenceYear) {
    return buildUTC(referenceYear, Number(m[2]), Number(m[1]));
  }

  // Textual: 12 jan 2025 / 12 de janeiro de 2025
  const months: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };
  m = /^(\d{1,2})\s*(?:de\s*)?([a-zç]{3})[a-zç]*\.?\s*(?:de\s*)?(\d{2,4})?/i.exec(value);
  if (m) {
    const month = months[m[2].toLowerCase()];
    if (month) {
      let year = m[3] ? Number(m[3]) : referenceYear;
      if (!year) return null;
      if (year < 100) year += year < 70 ? 2000 : 1900;
      return buildUTC(year, month, Number(m[1]));
    }
  }

  return null;
}

function buildUTC(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null; // 31/02 e afins
  return d;
}
