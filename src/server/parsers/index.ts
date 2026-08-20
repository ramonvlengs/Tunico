import { createHash } from 'crypto';
import { ParsedStatement, StatementParseError } from './types';
import { parseOfx } from './ofx';
import { parseSpreadsheet } from './spreadsheet';
import { parsePdfStatement } from './pdf';

export * from './types';
export { parseOfx } from './ofx';
export { parseSpreadsheet } from './spreadsheet';
export { parsePdfStatement } from './pdf';
export { parseBrazilianAmount, parseFlexibleDate } from './amount';

export const ACCEPTED_EXTENSIONS = ['.ofx', '.qfx', '.xlsx', '.xls', '.csv', '.pdf'] as const;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** Escolhe o parser certo pela extensao (com fallback por assinatura do arquivo). */
export async function parseStatementFile(buffer: Buffer, fileName: string): Promise<ParsedStatement> {
  const lower = fileName.toLowerCase();

  if (buffer.length === 0) {
    throw new StatementParseError('O arquivo enviado esta vazio.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new StatementParseError('O arquivo excede o limite de 20 MB.');
  }

  if (lower.endsWith('.ofx') || lower.endsWith('.qfx')) return parseOfx(buffer);
  if (lower.endsWith('.pdf')) return parsePdfStatement(buffer);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
    return parseSpreadsheet(buffer, fileName);
  }

  // Extensao desconhecida: tenta identificar pela assinatura.
  const head = buffer.subarray(0, 512).toString('latin1');
  if (head.startsWith('%PDF')) return parsePdfStatement(buffer);
  if (/OFXHEADER|<OFX>/i.test(head)) return parseOfx(buffer);
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return parseSpreadsheet(buffer, `${fileName}.xlsx`);

  throw new StatementParseError(
    'Formato nao suportado. Envie um arquivo .ofx, .qfx, .xlsx, .xls, .csv ou .pdf.',
  );
}

/**
 * Hash de deduplicacao. Usa o FITID quando o banco fornece (OFX), pois e o
 * identificador oficial; caso contrario deriva de data + valor + descricao.
 */
export function transactionHash(input: {
  bankAccountId: string;
  fitId?: string | null;
  date: Date;
  amount: number;
  description: string;
}): string {
  const base = input.fitId
    ? `${input.bankAccountId}|fit:${input.fitId}`
    : [
        input.bankAccountId,
        input.date.toISOString().slice(0, 10),
        input.amount.toFixed(2),
        input.description
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ''),
      ].join('|');

  return createHash('sha1').update(base).digest('hex');
}
