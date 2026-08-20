export type ParsedTransaction = {
  /** Data do lancamento (UTC, meia-noite). */
  date: Date;
  /** Positivo = credito (entrada), negativo = debito (saida). */
  amount: number;
  description: string;
  memo?: string | null;
  documentNumber?: string | null;
  /** Identificador unico fornecido pelo banco (FITID no OFX). */
  fitId?: string | null;
  balanceAfter?: number | null;
};

export type ParsedStatement = {
  fileType: 'OFX' | 'XLSX' | 'CSV' | 'PDF';
  transactions: ParsedTransaction[];
  /** Metadados detectados no arquivo, exibidos na tela de importacao. */
  meta: {
    bankId?: string | null;
    bankName?: string | null;
    branchId?: string | null;
    accountId?: string | null;
    accountType?: string | null;
    currency?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    ledgerBalance?: number | null;
    ledgerBalanceDate?: Date | null;
    /** Avisos nao fatais (linhas ignoradas, colunas nao reconhecidas...). */
    warnings?: string[];
    /** Como as colunas foram mapeadas (planilhas). */
    columnMap?: Record<string, string>;
  };
};

export class StatementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatementParseError';
  }
}
