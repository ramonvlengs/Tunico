import * as XLSX from 'xlsx';
import { ParsedStatement, ParsedTransaction, StatementParseError } from './types';
import { parseBrazilianAmount, parseFlexibleDate } from './amount';

/**
 * Parser de extratos em planilha (.xlsx, .xls, .csv). Bancos exportam layouts
 * muito diferentes, entao a estrategia e:
 *  1. ler a planilha como matriz crua (sem assumir que a linha 1 e o cabecalho);
 *  2. localizar a linha de cabecalho procurando termos conhecidos;
 *  3. mapear colunas por sinonimos (data, historico, valor, debito, credito...);
 *  4. quando nao ha cabecalho reconhecivel, inferir pelas proprias celulas.
 */

type ColumnRole = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'document' | 'balance' | 'type';

const HEADER_SYNONYMS: Array<{ role: ColumnRole; terms: string[] }> = [
  { role: 'date', terms: ['data', 'data lancamento', 'data do lancamento', 'dt', 'data mov', 'data movimento', 'data da compra', 'date', 'competencia'] },
  { role: 'description', terms: ['historico', 'descricao', 'lancamento', 'detalhe', 'detalhes', 'memo', 'description', 'estabelecimento', 'transacao', 'movimentacao', 'complemento'] },
  { role: 'document', terms: ['documento', 'doc', 'numero do documento', 'nr documento', 'num doc', 'identificador', 'id'] },
  { role: 'debit', terms: ['debito', 'debitos', 'saida', 'saidas', 'valor debito', 'pagamento', 'debit'] },
  { role: 'credit', terms: ['credito', 'creditos', 'entrada', 'entradas', 'valor credito', 'recebimento', 'credit'] },
  { role: 'amount', terms: ['valor', 'valor r$', 'valor (r$)', 'vlr', 'montante', 'amount', 'value', 'valor da transacao'] },
  { role: 'balance', terms: ['saldo', 'saldo apos', 'saldo atual', 'balance'] },
  { role: 'type', terms: ['tipo', 'natureza', 'd/c', 'dc', 'operacao'] },
];

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectRole(header: string): ColumnRole | null {
  const value = normalize(header);
  if (!value) return null;
  for (const { role, terms } of HEADER_SYNONYMS) {
    if (terms.includes(value)) return role;
  }
  for (const { role, terms } of HEADER_SYNONYMS) {
    if (terms.some((t) => value.includes(t))) return role;
  }
  return null;
}

type Matrix = unknown[][];

/** Procura a linha de cabecalho nas primeiras 25 linhas. */
function findHeaderRow(rows: Matrix): { index: number; map: Partial<Record<ColumnRole, number>> } | null {
  const limit = Math.min(rows.length, 25);
  let best: { index: number; map: Partial<Record<ColumnRole, number>>; score: number } | null = null;

  for (let i = 0; i < limit; i++) {
    const map: Partial<Record<ColumnRole, number>> = {};
    let score = 0;
    rows[i].forEach((cell, col) => {
      const role = detectRole(String(cell ?? ''));
      if (role && map[role] === undefined) {
        map[role] = col;
        score += 1;
      }
    });
    const usable = map.date !== undefined && (map.amount !== undefined || map.debit !== undefined || map.credit !== undefined);
    if (usable && (!best || score > best.score)) best = { index: i, map, score };
  }

  return best ? { index: best.index, map: best.map } : null;
}

/** Sem cabecalho: descobre as colunas olhando o conteudo das celulas. */
function inferColumns(rows: Matrix): Partial<Record<ColumnRole, number>> {
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const stats = Array.from({ length: width }, () => ({ dates: 0, amounts: 0, texts: 0, filled: 0 }));

  for (const row of rows.slice(0, 200)) {
    for (let col = 0; col < width; col++) {
      const cell = row[col];
      if (cell === null || cell === undefined || cell === '') continue;
      stats[col].filled += 1;
      if (parseFlexibleDate(cell as string, new Date().getUTCFullYear())) stats[col].dates += 1;
      else if (parseBrazilianAmount(cell as string) !== null) stats[col].amounts += 1;
      else if (String(cell).trim().length > 3) stats[col].texts += 1;
    }
  }

  const map: Partial<Record<ColumnRole, number>> = {};
  let bestDate = -1;
  let bestText = -1;
  let bestAmount = -1;
  stats.forEach((s, col) => {
    if (s.filled === 0) return;
    if (s.dates / s.filled > 0.6 && (bestDate < 0 || s.dates > stats[bestDate].dates)) bestDate = col;
    if (s.texts / s.filled > 0.5 && (bestText < 0 || s.texts > stats[bestText].texts)) bestText = col;
  });
  // A coluna de valor e a ultima coluna majoritariamente numerica (evita "saldo"
  // apenas quando ha duas: nesse caso a primeira e valor, a segunda e saldo).
  const numericCols = stats
    .map((s, col) => ({ col, ratio: s.filled ? s.amounts / s.filled : 0, filled: s.filled }))
    .filter((s) => s.filled > 0 && s.ratio > 0.6)
    .map((s) => s.col);
  if (numericCols.length >= 2) {
    bestAmount = numericCols[numericCols.length - 2];
    map.balance = numericCols[numericCols.length - 1];
  } else if (numericCols.length === 1) {
    bestAmount = numericCols[0];
  }

  if (bestDate >= 0) map.date = bestDate;
  if (bestText >= 0) map.description = bestText;
  if (bestAmount >= 0) map.amount = bestAmount;
  return map;
}

export function parseSpreadsheet(buffer: Buffer, fileName: string): ParsedStatement {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false, codepage: 65001 });
  } catch {
    throw new StatementParseError(
      'Nao foi possivel ler a planilha. Salve o arquivo novamente em formato .xlsx ou .csv e tente de novo.',
    );
  }

  const isCsv = /\.csv$/i.test(fileName);
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];
  const columnMap: Record<string, string> = {};
  let usedSheet = '';

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: false,
    }) as Matrix;
    if (rows.length === 0) continue;

    const header = findHeaderRow(rows);
    const map = header ? header.map : inferColumns(rows);
    const startRow = header ? header.index + 1 : 0;

    if (map.date === undefined) continue;
    if (map.amount === undefined && map.debit === undefined && map.credit === undefined) continue;

    const referenceYear = new Date().getUTCFullYear();
    const sheetTransactions: ParsedTransaction[] = [];

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

      const date = parseFlexibleDate(row[map.date] as string, referenceYear);
      if (!date) continue; // linhas de subtotal, rodape, saldo anterior...

      let amount: number | null = null;
      if (map.amount !== undefined) {
        amount = parseBrazilianAmount(row[map.amount] as string);
      }
      if (amount === null && (map.debit !== undefined || map.credit !== undefined)) {
        const debit = map.debit !== undefined ? parseBrazilianAmount(row[map.debit] as string) : null;
        const credit = map.credit !== undefined ? parseBrazilianAmount(row[map.credit] as string) : null;
        if (credit) amount = Math.abs(credit);
        else if (debit) amount = -Math.abs(debit);
      }
      if (amount === null || amount === 0) continue;

      // Coluna de tipo (D/C) sobrepoe o sinal quando presente.
      if (map.type !== undefined) {
        const type = normalize(row[map.type]);
        if (type === 'd' || type.startsWith('deb') || type.startsWith('said')) amount = -Math.abs(amount);
        else if (type === 'c' || type.startsWith('cred') || type.startsWith('entr')) amount = Math.abs(amount);
      }

      const description =
        map.description !== undefined
          ? String(row[map.description] ?? '').replace(/\s+/g, ' ').trim()
          : '';

      sheetTransactions.push({
        date,
        amount,
        description: (description || 'Lancamento importado').slice(0, 240),
        memo: null,
        documentNumber:
          map.document !== undefined ? String(row[map.document] ?? '').trim() || null : null,
        balanceAfter:
          map.balance !== undefined ? parseBrazilianAmount(row[map.balance] as string) : null,
        fitId: null,
      });
    }

    if (sheetTransactions.length > transactions.length) {
      transactions.length = 0;
      transactions.push(...sheetTransactions);
      usedSheet = sheetName;
      Object.keys(columnMap).forEach((k) => delete columnMap[k]);
      for (const [role, col] of Object.entries(map)) {
        if (col === undefined) continue;
        const headerLabel = header ? String(rows[header.index][col as number] ?? '') : `Coluna ${Number(col) + 1}`;
        columnMap[role] = headerLabel || `Coluna ${Number(col) + 1}`;
      }
      if (!header) {
        warnings.push('A planilha nao tinha cabecalho reconhecivel. As colunas foram deduzidas pelo conteudo - confira os lancamentos antes de conciliar.');
      }
    }
  }

  if (transactions.length === 0) {
    throw new StatementParseError(
      'Nao foi possivel identificar lancamentos na planilha. Ela precisa ter, no minimo, uma coluna de data e uma de valor (ou colunas separadas de debito e credito).',
    );
  }

  const times = transactions.map((t) => t.date.getTime());

  return {
    fileType: isCsv ? 'CSV' : 'XLSX',
    transactions,
    meta: {
      periodStart: new Date(Math.min(...times)),
      periodEnd: new Date(Math.max(...times)),
      warnings: warnings.length ? warnings : undefined,
      columnMap: { ...columnMap, planilha: usedSheet },
    },
  };
}
