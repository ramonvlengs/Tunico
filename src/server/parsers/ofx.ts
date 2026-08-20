import { ParsedStatement, ParsedTransaction, StatementParseError } from './types';

/**
 * Parser de OFX/QFX que cobre tanto o formato SGML (OFX 1.x, usado pela maioria
 * dos bancos brasileiros) quanto XML (OFX 2.x). Nao depende de bibliotecas
 * externas porque os arquivos reais frequentemente violam o padrao (tags nao
 * fechadas, acentuacao em ISO-8859-1, cabecalhos ausentes).
 */

/** Detecta o charset declarado no cabecalho e decodifica o buffer. */
export function decodeOfx(buffer: Buffer): string {
  const probe = buffer.subarray(0, 2048).toString('latin1').toUpperCase();
  const isUtf8 =
    probe.includes('CHARSET:UTF-8') ||
    probe.includes('ENCODING:UTF-8') ||
    probe.includes('ENCODING="UTF-8"');

  if (isUtf8) return buffer.toString('utf8');

  // Alguns bancos declaram USASCII/1252 mas gravam UTF-8. Se a decodificacao
  // UTF-8 nao produzir caracteres de substituicao, ela e a mais provavel.
  const asUtf8 = buffer.toString('utf8');
  if (!asUtf8.includes('�')) return asUtf8;
  return buffer.toString('latin1');
}

/** Converte DTPOSTED (YYYYMMDD[HHMMSS][.XXX][TZ]) em Date UTC. */
export function parseOfxDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const value = raw.trim();
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function parseOfxAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let value = raw.trim();
  if (!value) return null;
  // Formatos vistos em campo: 1234.56 | 1234,56 | 1.234,56 | -1,234.56
  const hasComma = value.includes(',');
  const hasDot = value.includes('.');
  if (hasComma && hasDot) {
    value = value.lastIndexOf(',') > value.lastIndexOf('.')
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '');
  } else if (hasComma) {
    value = value.replace(',', '.');
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Le o valor de uma tag simples dentro de um bloco SGML/XML. */
function tagValue(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = re.exec(block);
  if (!match) return null;
  return decodeEntities(match[1].trim()) || null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const TRNTYPE_LABELS: Record<string, string> = {
  CREDIT: 'Credito',
  DEBIT: 'Debito',
  INT: 'Juros',
  DIV: 'Dividendos',
  FEE: 'Tarifa',
  SRVCHG: 'Tarifa de servico',
  DEP: 'Deposito',
  ATM: 'Saque em caixa eletronico',
  POS: 'Compra no debito',
  XFER: 'Transferencia',
  CHECK: 'Cheque',
  PAYMENT: 'Pagamento',
  CASH: 'Dinheiro',
  DIRECTDEP: 'Deposito direto',
  DIRECTDEBIT: 'Debito automatico',
  REPEATPMT: 'Pagamento recorrente',
  OTHER: 'Outros',
};

export function parseOfx(buffer: Buffer): ParsedStatement {
  const content = decodeOfx(buffer);
  if (!/<OFX>/i.test(content) && !/<STMTTRN>/i.test(content)) {
    throw new StatementParseError(
      'Arquivo OFX invalido: nao foi encontrada a estrutura <OFX>. Confirme se o arquivo foi exportado corretamente pelo internet banking.',
    );
  }

  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  // Fallback para arquivos sem tag de fechamento (SGML puro).
  const rawBlocks =
    blocks.length > 0
      ? blocks
      : (content.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|<\/STMTRS>|$)/gi) ?? []);

  for (const block of rawBlocks) {
    const date = parseOfxDate(tagValue(block, 'DTPOSTED') ?? tagValue(block, 'DTUSER'));
    const amount = parseOfxAmount(tagValue(block, 'TRNAMT'));
    if (!date || amount === null) {
      warnings.push('Uma transacao foi ignorada por nao conter data ou valor validos.');
      continue;
    }

    const trnType = (tagValue(block, 'TRNTYPE') ?? '').toUpperCase();
    const name = tagValue(block, 'NAME');
    const memo = tagValue(block, 'MEMO');
    const payee = tagValue(block, 'PAYEE');
    const description =
      name || memo || payee || TRNTYPE_LABELS[trnType] || 'Lancamento bancario';

    transactions.push({
      date,
      amount,
      description: description.replace(/\s+/g, ' ').slice(0, 240),
      memo: memo && memo !== description ? memo.replace(/\s+/g, ' ').slice(0, 240) : null,
      documentNumber: tagValue(block, 'CHECKNUM') ?? tagValue(block, 'REFNUM'),
      fitId: tagValue(block, 'FITID'),
    });
  }

  if (transactions.length === 0) {
    throw new StatementParseError(
      'Nenhuma transacao encontrada no arquivo OFX. Verifique se o periodo exportado contem movimentacoes.',
    );
  }

  const ledgerBlock = /<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/i.exec(content)?.[0] ?? content;
  const dates = transactions.map((t) => t.date.getTime());

  return {
    fileType: 'OFX',
    transactions,
    meta: {
      bankId: tagValue(content, 'BANKID'),
      branchId: tagValue(content, 'BRANCHID'),
      accountId: tagValue(content, 'ACCTID'),
      accountType: tagValue(content, 'ACCTTYPE'),
      currency: tagValue(content, 'CURDEF'),
      periodStart: parseOfxDate(tagValue(content, 'DTSTART')) ?? new Date(Math.min(...dates)),
      periodEnd: parseOfxDate(tagValue(content, 'DTEND')) ?? new Date(Math.max(...dates)),
      ledgerBalance: parseOfxAmount(tagValue(ledgerBlock, 'BALAMT')),
      ledgerBalanceDate: parseOfxDate(tagValue(ledgerBlock, 'DTASOF')),
      warnings: warnings.length ? Array.from(new Set(warnings)) : undefined,
    },
  };
}
