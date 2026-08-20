/**
 * Smoke tests dos parsers de extrato bancario.
 * Execute com: npm run test:parsers
 */
import { readFileSync } from 'node:fs';
import { parseStatementFile, transactionHash } from '../src/server/parsers/index.js';
import { parseBrazilianAmount, parseFlexibleDate } from '../src/server/parsers/amount.js';

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(`${label} (${JSON.stringify(actual)})`, JSON.stringify(actual) === JSON.stringify(expected), {
    actual,
    expected,
  });
}

console.log('\n== parseBrazilianAmount ==');
eq('1.234,56', parseBrazilianAmount('1.234,56'), 1234.56);
eq('R$ 1.234,56', parseBrazilianAmount('R$ 1.234,56'), 1234.56);
eq('-389,90', parseBrazilianAmount('-389,90'), -389.9);
eq('(150,00) => negativo', parseBrazilianAmount('(150,00)'), -150);
eq('89,90 D => negativo', parseBrazilianAmount('89,90 D'), -89.9);
eq('89,90 C => positivo', parseBrazilianAmount('89,90 C'), 89.9);
eq('1,234.56 (en-US)', parseBrazilianAmount('1,234.56'), 1234.56);
eq('1.234 (milhar sem decimal)', parseBrazilianAmount('1.234'), 1234);
eq('12.34 (decimal en-US)', parseBrazilianAmount('12.34'), 12.34);
eq('vazio', parseBrazilianAmount(''), null);
eq('texto', parseBrazilianAmount('saldo'), null);

console.log('\n== parseFlexibleDate ==');
eq('31/07/2025', parseFlexibleDate('31/07/2025')?.toISOString().slice(0, 10), '2025-07-31');
eq('2025-07-31', parseFlexibleDate('2025-07-31')?.toISOString().slice(0, 10), '2025-07-31');
eq('05/08/25', parseFlexibleDate('05/08/25')?.toISOString().slice(0, 10), '2025-08-05');
eq('03/07 + ano ref', parseFlexibleDate('03/07', 2025)?.toISOString().slice(0, 10), '2025-07-03');
eq('31/02 invalida', parseFlexibleDate('31/02/2025'), null);
eq('serial excel 45841', parseFlexibleDate(45841)?.toISOString().slice(0, 10), '2025-07-03');

console.log('\n== OFX (Itau, SGML/ISO-8859-1) ==');
{
  const st = await parseStatementFile(readFileSync('tests/fixtures/extrato-itau.ofx'), 'extrato-itau.ofx');
  eq('tipo', st.fileType, 'OFX');
  eq('quantidade', st.transactions.length, 4);
  eq('banco', st.meta.bankId, '341');
  eq('conta', st.meta.accountId, '56789-0');
  eq('saldo do extrato', st.meta.ledgerBalance, 5330.2);
  eq('1o credito', st.transactions[0].amount, 1250);
  eq('1o descricao', st.transactions[0].description, 'PIX RECEBIDO JOAO DA SILVA');
  eq('tarifa negativa', st.transactions[2].amount, -29.9);
  check('todas com FITID', st.transactions.every((t) => !!t.fitId));
}

console.log('\n== CSV com cabecalho deslocado ==');
{
  const st = await parseStatementFile(readFileSync('tests/fixtures/extrato-generico.csv'), 'extrato-generico.csv');
  eq('tipo', st.fileType, 'CSV');
  eq('quantidade (linha de saldo descartada)', st.transactions.length, 4);
  eq('coluna de valor mapeada', st.meta.columnMap?.amount, 'Valor');
  eq('coluna de saldo mapeada', st.meta.columnMap?.balance, 'Saldo');
  eq('credito', st.transactions[0].amount, 1250);
  eq('debito', st.transactions[1].amount, -389.9);
  eq('saldo apos', st.transactions[3].balanceAfter, 10330.2);
}

console.log('\n== PDF ==');
{
  const st = await parseStatementFile(readFileSync('tests/fixtures/extrato-banco.pdf'), 'extrato-banco.pdf');
  eq('tipo', st.fileType, 'PDF');
  eq('quantidade (saldo anterior/final descartados)', st.transactions.length, 5);
  eq('pix recebido positivo', st.transactions[0].amount, 1250);
  eq('pagamento negativo', st.transactions[1].amount, -389.9);
  eq('tarifa negativa', st.transactions[2].amount, -29.9);
  eq('ted recebida positiva', st.transactions[3].amount, 4500);
  eq('compra negativa', st.transactions[4].amount, -112.45);
  check('emite aviso sobre inferencia de sinal', (st.meta.warnings ?? []).length > 0);
}

console.log('\n== deduplicacao ==');
{
  const base = { bankAccountId: 'acc1', date: new Date(Date.UTC(2025, 6, 3)), amount: 1250, description: 'PIX RECEBIDO' };
  eq('mesmo conteudo => mesmo hash', transactionHash(base) === transactionHash({ ...base }), true);
  eq('acentuacao ignorada', transactionHash(base) === transactionHash({ ...base, description: 'PÍX RECEBÍDO' }), true);
  eq('valor diferente => hash diferente', transactionHash(base) === transactionHash({ ...base, amount: 1251 }), false);
  eq('FITID tem precedencia', transactionHash({ ...base, fitId: 'X1' }) === transactionHash({ ...base, description: 'OUTRO', fitId: 'X1' }), true);
}

console.log(`\n${checks - failures}/${checks} verificacoes passaram.`);
if (failures > 0) {
  console.error(`${failures} falha(s).`);
  process.exit(1);
}
