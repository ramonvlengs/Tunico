import { ParsedStatement, ParsedTransaction, StatementParseError } from './types';
import { parseBrazilianAmount, parseFlexibleDate } from './amount';

/**
 * Parser de extratos em PDF.
 *
 * PDF nao tem estrutura tabular, entao trabalhamos sobre o texto extraido e
 * aplicamos heuristicas validadas em extratos brasileiros (Itau, Bradesco,
 * Banco do Brasil, Santander, Caixa, Nubank, Inter, C6, Mercado Pago, PagBank):
 *
 *  - toda linha de lancamento comeca com uma data (dd/mm ou dd/mm/aaaa);
 *  - o(s) ultimo(s) numero(s) da linha sao valor e, opcionalmente, saldo;
 *  - o texto entre a data e o valor e o historico;
 *  - o sinal vem de "-", "D", "(...)" ou de palavras-chave do historico.
 *
 * Linhas de saldo, cabecalho, rodape e totalizadores sao descartadas.
 */

const NOISE_PATTERNS = [
  /saldo\s+(anterior|do\s+dia|em|final|atual|disponivel|bloqueado)/i,
  /^saldo\b/i,
  /^total\b/i,
  /^subtotal\b/i,
  /extrato\s+de\s+conta/i,
  /^p[aá]gina\s+\d+/i,
  /^data\s+(hist[oó]rico|lan[cç]amento|descri)/i,
  /^lan[cç]amentos?\s+(do|de)\b/i,
  /limite\s+(dispon[ií]vel|de\s+cr[eé]dito)/i,
  /^ouvidoria/i,
  /^sac\b/i,
  /central\s+de\s+atendimento/i,
  /^cnpj\b/i,
  /^ag[eê]ncia\b.*conta\b/i,
];

const NEGATIVE_HINTS = [
  'pagamento', 'pgto', 'saque', 'compra', 'debito', 'débito', 'tarifa', 'taxa', 'iof',
  'juros', 'anuidade', 'transferencia enviada', 'transferência enviada', 'pix enviado',
  'ted enviada', 'doc enviado', 'boleto', 'fatura', 'darf', 'das ', 'inss', 'fgts',
  'aluguel', 'energia', 'internet', 'telefone', 'remuneracao', 'salario', 'salário',
  'envio', 'enviado', 'cobranca', 'cobrança', 'estorno debito',
];

const POSITIVE_HINTS = [
  'recebimento', 'recebido', 'deposito', 'depósito', 'credito', 'crédito',
  'pix recebido', 'ted recebida', 'transferencia recebida', 'transferência recebida',
  'estorno', 'rendimento', 'resgate', 'venda', 'liquidacao', 'liquidação', 'devolucao',
];

/**
 * Valor monetario brasileiro. O sufixo D/C so e aceito quando nao emenda em
 * outra palavra: extratos em PDF costumam perder os espacos entre as colunas,
 * e sem essa guarda o "C" de "Compra" seria lido como marcador de credito.
 */
const MONEY = String.raw`\(?-?\s?(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s?[DCdc](?![A-Za-zÀ-ÿ]))?`;
const MONEY_RE = new RegExp(MONEY, 'g');

/**
 * Linha de lancamento: comeca com a data. O espaco depois dela e opcional
 * porque a extracao de texto do PDF frequentemente cola as colunas
 * ("03/07/2025PIX RECEBIDO1.250,006.250,00").
 */
const DATE_START_RE = /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(.*)$/;

/**
 * Extrai o texto do PDF.
 *
 * pdf-parse e CommonJS e, dependendo do bundler, `await import()` devolve a
 * funcao em `default`, em `default.default` ou no proprio namespace - por isso
 * o desempacotamento defensivo abaixo.
 */
async function extractText(buffer: Buffer): Promise<string> {
  type PdfParseFn = (data: Buffer, options?: Record<string, unknown>) => Promise<{ text: string }>;

  const mod: unknown = await import('pdf-parse');
  const candidates: unknown[] = [
    mod,
    (mod as { default?: unknown }).default,
    ((mod as { default?: { default?: unknown } }).default ?? {}).default,
  ];
  const pdfParse = candidates.find((candidate) => typeof candidate === 'function') as PdfParseFn | undefined;

  if (!pdfParse) {
    throw new Error('pdf-parse nao expos uma funcao chamavel.');
  }

  const result = await pdfParse(buffer);
  return result?.text ?? '';
}

function isNoise(line: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(line));
}

function guessSign(description: string, raw: string): number {
  const lower = description.toLowerCase();
  if (/\bD\s*$/.test(raw.trim())) return -1;
  if (/\bC\s*$/.test(raw.trim())) return 1;
  for (const hint of NEGATIVE_HINTS) if (lower.includes(hint)) return -1;
  for (const hint of POSITIVE_HINTS) if (lower.includes(hint)) return 1;
  return -1; // extratos costumam ter mais saidas; o usuario pode ajustar na tela
}

/** Descobre o ano de referencia quando as linhas trazem apenas dd/mm. */
function findReferenceYear(text: string): number {
  const match = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(text);
  if (match) return Number(match[3]);
  const alt = /\b(20\d{2})\b/.exec(text);
  if (alt) return Number(alt[1]);
  return new Date().getUTCFullYear();
}

export async function parsePdfStatement(buffer: Buffer): Promise<ParsedStatement> {
  let text: string;
  try {
    text = await extractText(buffer);
  } catch (error) {
    console.error('[parsePdfStatement] falha ao extrair texto do PDF:', error);
    throw new StatementParseError(
      'Nao foi possivel ler o PDF. Se o arquivo for digitalizado (imagem), o texto nao pode ser extraido - exporte o extrato em OFX, Excel ou CSV.',
    );
  }

  if (!text.trim()) {
    throw new StatementParseError(
      'O PDF nao contem texto selecionavel (provavelmente e uma imagem escaneada). Exporte o extrato em OFX, Excel ou CSV para importar.',
    );
  }

  const referenceYear = findReferenceYear(text);
  const warnings: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Junta linhas de continuacao: uma linha que nao comeca com data e nao contem
  // valor pertence ao historico da linha anterior.
  const lines: string[] = [];
  for (const line of rawLines) {
    const startsWithDate = DATE_START_RE.test(line);
    const hasMoney = new RegExp(MONEY).test(line);
    if (!startsWithDate && !hasMoney && lines.length > 0 && !isNoise(line) && line.length < 80) {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${line}`;
    } else {
      lines.push(line);
    }
  }

  let skippedNoise = 0;

  for (const line of lines) {
    const dateMatch = DATE_START_RE.exec(line);
    if (!dateMatch) continue;
    if (isNoise(line)) {
      skippedNoise += 1;
      continue;
    }

    const date = parseFlexibleDate(dateMatch[1], referenceYear);
    if (!date) continue;

    const rest = dateMatch[2];
    MONEY_RE.lastIndex = 0;
    // Guardamos tambem a posicao de cada valor: usar indexOf sobre o texto
    // quebra quando a descricao contem o mesmo numero do valor.
    const monies = Array.from(rest.matchAll(MONEY_RE)).map((match) => ({
      text: match[0],
      index: match.index ?? 0,
    }));
    if (monies.length === 0) continue;

    // Com dois ou mais valores na linha, o ultimo e o saldo apos o lancamento.
    const amountToken = monies.length >= 2 ? monies[monies.length - 2] : monies[monies.length - 1];
    const balanceToken = monies.length >= 2 ? monies[monies.length - 1] : null;

    const parsedAmount = parseBrazilianAmount(amountToken.text);
    if (parsedAmount === null || parsedAmount === 0) continue;

    const description = rest
      .slice(0, amountToken.index)
      .replace(/\s+/g, ' ')
      .replace(/[.\-\u2013\u2014]+$/, '')
      .trim();

    if (!description || description.length < 2) continue;

    // Quando o proprio valor ja traz o sinal (-, parenteses ou D/C) ele manda;
    // caso contrario o sentido e deduzido pelo historico.
    const amount = parsedAmount < 0 ? parsedAmount : parsedAmount * guessSign(description, amountToken.text);

    transactions.push({
      date,
      amount,
      description: description.slice(0, 240),
      memo: null,
      documentNumber: null,
      balanceAfter: balanceToken ? parseBrazilianAmount(balanceToken.text) : null,
      fitId: null,
    });
  }

  if (transactions.length === 0) {
    throw new StatementParseError(
      'Nenhum lancamento foi reconhecido no PDF. O layout deste banco pode nao ser suportado - prefira importar o arquivo OFX, que e o formato oficial de conciliacao.',
    );
  }

  warnings.push(
    'Extratos em PDF nao possuem estrutura padronizada. Os sinais (entrada/saida) foram deduzidos pelo historico - revise os lancamentos antes de conciliar.',
  );
  if (skippedNoise > 0) {
    warnings.push(`${skippedNoise} linha(s) de saldo/cabecalho foram ignoradas.`);
  }

  const times = transactions.map((t) => t.date.getTime());

  return {
    fileType: 'PDF',
    transactions,
    meta: {
      periodStart: new Date(Math.min(...times)),
      periodEnd: new Date(Math.max(...times)),
      warnings,
    },
  };
}
