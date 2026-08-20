/**
 * Popula o banco com dados de demonstracao da Tunico TCG:
 * duas empresas (CNPJs distintos), usuarios com papeis diferentes, plano de
 * contas padrao, clientes, fornecedores, produtos, vendas, contas a pagar e
 * receber com historico de 6 meses e um extrato bancario pronto para conciliar.
 *
 * Uso: npm run db:seed  (ou npm run db:reset para recriar do zero)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@tunicotcg.com.br';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Tunico@2025';

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target;
}

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Gerador pseudoaleatorio deterministico: o seed produz sempre os mesmos numeros. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const rnd = makeRandom(20250820);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
const between = (min: number, max: number) => round2(min + rnd() * (max - min));

const DEFAULT_CATEGORIES = [
  { code: '3.01', name: 'Receita de vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', color: '#16a34a',
    children: ['Venda de singles', 'Venda de produtos lacrados', 'Venda de acessorios', 'Vendas em marketplace', 'Vendas em live / evento'] },
  { code: '3.02', name: 'Receita de servicos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', color: '#0ea5e9',
    children: ['Inscricao em torneios', 'Aluguel de mesa / espaco', 'Avaliacao e grading'] },
  { code: '3.09', name: 'Outras receitas', type: 'INCOME', dreGroup: 'OUTRAS_RECEITAS', color: '#8b5cf6',
    children: ['Rendimento de aplicacoes', 'Estornos e devolucoes recebidas'] },
  { code: '4.01', name: 'Impostos sobre vendas', type: 'EXPENSE', dreGroup: 'DEDUCOES', color: '#f43f5e',
    children: ['Simples Nacional (DAS)', 'ICMS', 'ISS'] },
  { code: '4.02', name: 'Custo das mercadorias vendidas', type: 'EXPENSE', dreGroup: 'CMV', color: '#f97316',
    children: ['Compra de cartas e singles', 'Compra de produtos lacrados', 'Compra de acessorios', 'Frete sobre compras'] },
  { code: '4.03', name: 'Despesas com pessoal', type: 'EXPENSE', dreGroup: 'DESPESA_OPERACIONAL', color: '#eab308',
    children: ['Salarios e ordenados', 'Pro-labore', 'FGTS e INSS', 'Vale transporte e alimentacao', 'Ferias e 13o salario'] },
  { code: '4.04', name: 'Despesas administrativas', type: 'EXPENSE', dreGroup: 'DESPESA_ADMIN', color: '#64748b',
    children: ['Aluguel e condominio', 'Energia eletrica', 'Agua', 'Internet e telefone', 'Contabilidade', 'Material de escritorio e embalagens', 'Software e assinaturas', 'Manutencao e limpeza'] },
  { code: '4.05', name: 'Despesas comerciais', type: 'EXPENSE', dreGroup: 'DESPESA_OPERACIONAL', color: '#ec4899',
    children: ['Marketing e anuncios', 'Comissoes de marketplace', 'Frete sobre vendas', 'Premiacao de torneios', 'Eventos e feiras'] },
  { code: '4.06', name: 'Despesas financeiras', type: 'EXPENSE', dreGroup: 'DESPESA_FINANCEIRA', color: '#dc2626',
    children: ['Tarifas bancarias', 'Taxas de maquininha / gateway', 'Juros e multas pagos', 'IOF'] },
  { code: '4.07', name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTO', color: '#0891b2',
    children: ['Moveis e equipamentos', 'Reformas'] },
  { code: '4.09', name: 'Retiradas dos socios', type: 'EXPENSE', dreGroup: 'INVESTIMENTO', color: '#7c3aed',
    children: ['Distribuicao de lucros'] },
] as const;

async function seedCategories(companyId: string) {
  const map = new Map<string, string>();
  for (const group of DEFAULT_CATEGORIES) {
    const parent = await prisma.category.create({
      data: { companyId, code: group.code, name: group.name, type: group.type, dreGroup: group.dreGroup, color: group.color },
    });
    map.set(group.name, parent.id);
    let index = 1;
    for (const childName of group.children) {
      const child = await prisma.category.create({
        data: {
          companyId,
          parentId: parent.id,
          code: `${group.code}.${String(index).padStart(2, '0')}`,
          name: childName,
          type: group.type,
          dreGroup: group.dreGroup,
          color: group.color,
        },
      });
      map.set(childName, child.id);
      index += 1;
    }
  }
  return map;
}

async function main() {
  console.log('Limpando dados anteriores...');
  await prisma.reconciliationMatch.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.bankImport.deleteMany();
  await prisma.reconciliationRule.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.financialEntry.deleteMany();
  await prisma.recurrence.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.costCenter.deleteMany();
  await prisma.category.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  console.log('Criando usuarios...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.create({
    data: { name: 'Ramon Lengs', email: ADMIN_EMAIL, passwordHash, isSuperAdmin: true, phone: '(11) 99999-0001' },
  });
  const financeUser = await prisma.user.create({
    data: { name: 'Marina Financeiro', email: 'financeiro@tunicotcg.com.br', passwordHash, phone: '(11) 99999-0002' },
  });
  const operatorUser = await prisma.user.create({
    data: { name: 'Diego Loja', email: 'loja@tunicotcg.com.br', passwordHash, phone: '(11) 99999-0003' },
  });

  console.log('Criando empresas (multi-CNPJ)...');
  const matriz = await prisma.company.create({
    data: {
      corporateName: 'Tunico TCG Comercio de Cards LTDA',
      tradeName: 'Tunico TCG - Matriz',
      cnpj: '19131243000197',
      stateReg: '112.233.445.556',
      taxRegime: 'SIMPLES_NACIONAL',
      email: 'contato@tunicotcg.com.br',
      phone: '(11) 4002-8922',
      website: 'https://tunicotcg.com.br',
      zipCode: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      district: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'SP',
      color: '#16a34a',
    },
  });
  const filial = await prisma.company.create({
    data: {
      corporateName: 'Tunico TCG Eventos e Torneios LTDA',
      tradeName: 'Tunico TCG - Eventos',
      cnpj: '45997418000153',
      taxRegime: 'SIMPLES_NACIONAL',
      email: 'eventos@tunicotcg.com.br',
      phone: '(11) 4002-8923',
      zipCode: '13010-111',
      street: 'Rua Barao de Jaguara',
      number: '250',
      district: 'Centro',
      city: 'Campinas',
      state: 'SP',
      color: '#f97316',
    },
  });

  await prisma.membership.createMany({
    data: [
      { userId: admin.id, companyId: matriz.id, role: 'OWNER' },
      { userId: admin.id, companyId: filial.id, role: 'OWNER' },
      { userId: financeUser.id, companyId: matriz.id, role: 'FINANCE' },
      { userId: financeUser.id, companyId: filial.id, role: 'FINANCE' },
      { userId: operatorUser.id, companyId: matriz.id, role: 'OPERATOR' },
    ],
  });

  for (const company of [matriz, filial]) {
    await seedCompany(company.id, company.id === matriz.id);
  }

  console.log('\nPronto!');
  console.log('-------------------------------------------------------');
  console.log(`  Acesso administrador : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Acesso financeiro    : financeiro@tunicotcg.com.br / ${ADMIN_PASSWORD}`);
  console.log(`  Acesso operacional   : loja@tunicotcg.com.br / ${ADMIN_PASSWORD}`);
  console.log('-------------------------------------------------------');
}

async function seedCompany(companyId: string, isMatriz: boolean) {
  const scale = isMatriz ? 1 : 0.35;
  console.log(`Populando empresa ${companyId}${isMatriz ? ' (matriz)' : ' (eventos)'}...`);

  const categories = await seedCategories(companyId);
  const cat = (name: string) => categories.get(name) ?? null;

  const costCenters = await Promise.all(
    [
      { code: 'CC01', name: 'Loja fisica' },
      { code: 'CC02', name: 'Vendas online' },
      { code: 'CC03', name: 'Eventos e torneios' },
      { code: 'CC04', name: 'Administrativo' },
    ].map((c) => prisma.costCenter.create({ data: { ...c, companyId } })),
  );

  const caixa = await prisma.bankAccount.create({
    data: { companyId, name: 'Caixa da loja', type: 'CASH', initialBalance: round2(3500 * scale), color: '#16a34a', openingDate: d(2024, 1, 1) },
  });
  const itau = await prisma.bankAccount.create({
    data: {
      companyId, name: 'Itau - Conta corrente', type: 'CHECKING', bankCode: '341', bankName: 'Itau Unibanco',
      agency: '1234', accountNumber: '56789-0', pixKey: 'contato@tunicotcg.com.br',
      initialBalance: round2(62000 * scale), color: '#f97316', openingDate: d(2024, 1, 1),
    },
  });
  const nubank = await prisma.bankAccount.create({
    data: {
      companyId, name: 'Nubank PJ', type: 'DIGITAL', bankCode: '260', bankName: 'Nu Pagamentos',
      agency: '0001', accountNumber: '9876543-2', initialBalance: round2(18400 * scale), color: '#8b5cf6', openingDate: d(2024, 1, 1),
    },
  });
  const mercadoPago = await prisma.bankAccount.create({
    data: {
      companyId, name: 'Mercado Pago', type: 'DIGITAL', bankCode: '323', bankName: 'Mercado Pago',
      initialBalance: round2(2100 * scale), color: '#0ea5e9', openingDate: d(2024, 1, 1),
    },
  });
  const accounts = [caixa, itau, nubank, mercadoPago];

  const methods = await Promise.all(
    [
      { name: 'Dinheiro', type: 'CASH', feePercent: 0, settlementDays: 0, bankAccountId: caixa.id },
      { name: 'PIX', type: 'PIX', feePercent: 0, settlementDays: 0, bankAccountId: itau.id },
      { name: 'Cartao de debito', type: 'DEBIT_CARD', feePercent: 1.99, settlementDays: 1, bankAccountId: itau.id },
      { name: 'Cartao de credito a vista', type: 'CREDIT_CARD', feePercent: 3.49, settlementDays: 30, bankAccountId: itau.id },
      { name: 'Cartao de credito parcelado', type: 'CREDIT_CARD', feePercent: 4.99, settlementDays: 30, bankAccountId: itau.id },
      { name: 'Boleto bancario', type: 'BOLETO', feeFixed: 2.5, settlementDays: 1, bankAccountId: itau.id },
      { name: 'Mercado Pago', type: 'PIX', feePercent: 4.99, settlementDays: 14, bankAccountId: mercadoPago.id },
    ].map((m) => prisma.paymentMethod.create({ data: { companyId, ...m } })),
  );

  await prisma.reconciliationRule.createMany({
    data: [
      { companyId, name: 'Tarifas bancarias', pattern: 'tarifa', direction: 'OUT', categoryId: cat('Tarifas bancarias'), priority: 10 },
      { companyId, name: 'Taxa de maquininha', pattern: 'taxa', direction: 'OUT', categoryId: cat('Taxas de maquininha / gateway'), priority: 9 },
      { companyId, name: 'Rendimento de aplicacao', pattern: 'rendimento', direction: 'IN', categoryId: cat('Rendimento de aplicacoes'), priority: 8 },
      { companyId, name: 'DAS - Simples Nacional', pattern: 'das simples', direction: 'OUT', categoryId: cat('Simples Nacional (DAS)'), priority: 8 },
      { companyId, name: 'Repasse Mercado Pago', pattern: 'mercado pago', direction: 'IN', categoryId: cat('Vendas em marketplace'), priority: 7 },
    ],
  });

  console.log('  contatos...');
  const customerNames = [
    'Lucas Andrade', 'Fernanda Rocha', 'Pedro Henrique Lima', 'Camila Souza', 'Rafael Mendes',
    'Juliana Prado', 'Bruno Carvalho', 'Amanda Nogueira', 'Thiago Barbosa', 'Leticia Fernandes',
    'Gustavo Ribeiro', 'Patricia Alves', 'Marcelo Duarte', 'Bianca Teixeira', 'Vinicius Costa',
  ];
  const customers = await Promise.all(
    customerNames.map((name, index) =>
      prisma.contact.create({
        data: {
          companyId,
          kind: 'CUSTOMER',
          personType: 'PF',
          name,
          document: String(10000000000 + index * 1234567).padStart(11, '0'),
          email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@email.com`,
          phone: `(11) 9${String(80000000 + index * 111111).slice(0, 8)}`,
          city: 'Sao Paulo',
          state: 'SP',
          creditLimit: between(300, 3000),
        },
      }),
    ),
  );

  const supplierData = [
    ['Card Distribuidora LTDA', '11222333000181', 'Distribuidor oficial de produtos lacrados'],
    ['Epic Games Store Brasil ME', '22333444000172', 'Acessorios e sleeves'],
    ['GG Sleeves Importacao', '33444555000163', 'Importacao de acessorios'],
    ['Imobiliaria Central', '44555666000154', 'Locacao do ponto comercial'],
    ['Contabil Prime Assessoria', '55666777000145', 'Escritorio de contabilidade'],
    ['Enel Distribuicao SP', '66777888000136', 'Energia eletrica'],
    ['Vivo Telefonica Brasil', '77888999000127', 'Internet e telefonia'],
  ];
  const suppliers = await Promise.all(
    supplierData.map(([name, document, notes]) =>
      prisma.contact.create({
        data: {
          companyId, kind: 'SUPPLIER', personType: 'PJ', name, tradeName: name.split(' ')[0],
          document, notes, email: 'financeiro@fornecedor.com.br', phone: '(11) 3000-1000', city: 'Sao Paulo', state: 'SP',
        },
      }),
    ),
  );

  console.log('  produtos...');
  const productSeeds = [
    ['SGL-PKM-001', 'Charizard ex - Obsidian Flames 223/197', 'Singles', 'Pokemon', 'Obsidian Flames', '223/197', 'Special Illustration Rare', 'NM', true, 420, 780],
    ['SGL-PKM-002', 'Pikachu VMAX - Vivid Voltage 044/185', 'Singles', 'Pokemon', 'Vivid Voltage', '044/185', 'Ultra Rare', 'NM', false, 95, 179],
    ['SGL-MTG-001', 'Ragavan, Nimble Pilferer - MH2', 'Singles', 'Magic: The Gathering', 'Modern Horizons 2', '138/303', 'Mythic Rare', 'NM', false, 310, 549],
    ['SGL-MTG-002', 'Sheoldred, the Apocalypse - DMU', 'Singles', 'Magic: The Gathering', 'Dominaria United', '107/281', 'Mythic Rare', 'SP', false, 260, 459],
    ['SGL-OP-001', 'Monkey D. Luffy Leader - OP01', 'Singles', 'One Piece', 'Romance Dawn', 'OP01-001', 'Leader', 'NM', true, 180, 329],
    ['BOX-PKM-001', 'Booster Box Pokemon - Paldea Evolved', 'Booster Box', 'Pokemon', 'Paldea Evolved', null, null, null, false, 640, 899],
    ['BOX-MTG-001', 'Play Booster Box - Bloomburrow', 'Booster Box', 'Magic: The Gathering', 'Bloomburrow', null, null, null, false, 720, 1049],
    ['BOX-OP-001', 'Booster Box One Piece - OP08', 'Booster Box', 'One Piece', 'Two Legends', null, null, null, false, 520, 749],
    ['DCK-PKM-001', 'Deck Pokemon Battle Academy', 'Deck / Starter', 'Pokemon', null, null, null, null, false, 95, 169],
    ['ACC-SLV-001', 'Sleeves Dragon Shield Matte (100un)', 'Sleeves', null, null, null, null, null, false, 32, 64.9],
    ['ACC-SLV-002', 'Sleeves Ultra Pro Eclipse (100un)', 'Sleeves', null, null, null, null, null, false, 28, 54.9],
    ['ACC-DBX-001', 'Deck Box Ultimate Guard Boulder', 'Acessorios', null, null, null, null, null, false, 68, 129.9],
    ['ACC-PMT-001', 'Playmat Tunico TCG personalizado', 'Playmat', null, null, null, null, null, false, 42, 99.9],
    ['ACC-BND-001', 'Fichario Portfolio 480 cartas', 'Acessorios', null, null, null, null, null, false, 75, 149.9],
    ['SRV-TRN-001', 'Inscricao em torneio Standard', 'Servico', null, null, null, null, null, false, 0, 30],
  ] as const;

  const products = await Promise.all(
    productSeeds.map(([sku, name, group, game, set, number, rarity, condition, foil, cost, price]) =>
      prisma.product.create({
        data: {
          companyId,
          sku: sku as string,
          name: name as string,
          group: group as string,
          type: group === 'Servico' ? 'SERVICE' : 'PRODUCT',
          trackStock: group !== 'Servico',
          tcgGame: game as string | null,
          tcgSet: set as string | null,
          tcgNumber: number as string | null,
          tcgRarity: rarity as string | null,
          tcgCondition: condition as string | null,
          tcgFoil: foil as boolean,
          costPrice: cost as number,
          salePrice: price as number,
          stock: group === 'Servico' ? 0 : Math.floor(between(2, 40)),
          minStock: group === 'Singles' ? 1 : 3,
        },
      }),
    ),
  );

  // -------------------------------------------------------------------------
  // Historico: 8 meses de vendas, despesas e baixas
  // -------------------------------------------------------------------------
  console.log('  vendas, contas e baixas...');
  const today = new Date();
  const currentMonth = d(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
  let saleNumber = 1;
  let purchaseNumber = 1;

  for (let offset = -7; offset <= 1; offset++) {
    const monthStart = addMonths(currentMonth, offset);
    const isFuture = offset > 0;
    // Volume mensal calibrado para uma loja com faturamento saudavel:
    // ~30 pedidos/mes na matriz, com ticket medio puxado pelos itens lacrados.
    const salesCount = Math.max(3, Math.round((isFuture ? 9 : 30) * scale + rnd() * 6));

    for (let i = 0; i < salesCount; i++) {
      const customer = pick(customers);
      const method = pick(methods);
      const issueDate = new Date(monthStart.getTime() + Math.floor(rnd() * 26) * 86400000);
      const itemCount = 1 + Math.floor(rnd() * 4);
      const chosen = Array.from({ length: itemCount }, () => pick(products));

      const items = chosen.map((product) => {
        const quantity = product.group === 'Singles' ? 1 : 1 + Math.floor(rnd() * 3);
        const unitPrice = product.salePrice;
        const discount = rnd() > 0.75 ? round2(unitPrice * quantity * 0.05) : 0;
        return {
          productId: product.id,
          description: product.name,
          quantity,
          unitPrice,
          discount,
          total: round2(unitPrice * quantity - discount),
        };
      });

      const subtotal = round2(items.reduce((s, item) => s + item.unitPrice * item.quantity, 0));
      const discount = round2(items.reduce((s, item) => s + item.discount, 0));
      const shipping = rnd() > 0.7 ? between(15, 35) : 0;
      const total = round2(subtotal - discount + shipping);
      const installments = method.name.includes('parcelado') ? 2 + Math.floor(rnd() * 4) : 1;

      const order = await prisma.order.create({
        data: {
          companyId,
          type: 'SALE',
          number: saleNumber++,
          contactId: customer.id,
          status: isFuture ? 'APPROVED' : 'BILLED',
          issueDate,
          paymentMethodId: method.id,
          installments,
          firstDueDate: issueDate,
          subtotal,
          discount,
          shipping,
          total,
          channel: pick(['Loja fisica', 'WhatsApp', 'Instagram', 'Live', 'Ligamagic', 'Mercado Livre', 'Evento / torneio']),
          items: { create: items },
        },
      });

      const per = round2(total / installments);
      const groupId = installments > 1 ? crypto.randomUUID() : null;
      for (let n = 0; n < installments; n++) {
        const amount = n === installments - 1 ? round2(total - per * (installments - 1)) : per;
        const dueDate = addMonths(issueDate, n);
        const entry = await prisma.financialEntry.create({
          data: {
            companyId,
            kind: 'RECEIVABLE',
            description: installments > 1 ? `Venda #${order.number} (${n + 1}/${installments})` : `Venda #${order.number}`,
            contactId: customer.id,
            categoryId: cat(order.channel?.includes('Mercado') || order.channel === 'Ligamagic' ? 'Vendas em marketplace' : 'Venda de singles'),
            costCenterId: order.channel === 'Loja fisica' ? costCenters[0].id : costCenters[1].id,
            bankAccountId: method.bankAccountId,
            orderId: order.id,
            documentNumber: `PED-${String(order.number).padStart(5, '0')}`,
            issueDate,
            competenceDate: issueDate,
            dueDate,
            amount,
            installment: n + 1,
            installments,
            groupId,
            status: 'OPEN',
          },
        });

        // 88% dos titulos vencidos foram recebidos.
        if (dueDate.getTime() < today.getTime() && rnd() < 0.88) {
          const paidAt = new Date(dueDate.getTime() + Math.floor(rnd() * 4) * 86400000);
          const fee = method.feePercent ? round2(amount * (method.feePercent / 100)) : method.feeFixed;
          await prisma.settlement.create({
            data: {
              companyId, entryId: entry.id, bankAccountId: method.bankAccountId!, paymentMethodId: method.id,
              paidAt, amount, fee,
            },
          });
          await prisma.financialEntry.update({
            where: { id: entry.id },
            data: { paidAmount: amount, status: 'PAID' },
          });
        }
      }
    }

    // Compras de mercadoria
    const purchaseCount = Math.max(1, Math.round(2 * scale + rnd() * 2));
    for (let i = 0; i < purchaseCount; i++) {
      const supplier = suppliers[Math.floor(rnd() * 3)];
      const issueDate = new Date(monthStart.getTime() + Math.floor(rnd() * 20) * 86400000);
      const total = between(1800, 9500) * scale;
      const order = await prisma.order.create({
        data: {
          companyId, type: 'PURCHASE', number: purchaseNumber++, contactId: supplier.id,
          status: 'BILLED', issueDate, subtotal: total, total, installments: 2, firstDueDate: addMonths(issueDate, 1),
          items: {
            create: [{ description: 'Reposicao de estoque - lote de produtos', quantity: 1, unitPrice: total, total }],
          },
        },
      });

      for (let n = 0; n < 2; n++) {
        const amount = round2(total / 2);
        const dueDate = addMonths(issueDate, n + 1);
        const entry = await prisma.financialEntry.create({
          data: {
            companyId, kind: 'PAYABLE', description: `Compra #${order.number} - ${supplier.name} (${n + 1}/2)`,
            contactId: supplier.id, categoryId: cat('Compra de produtos lacrados'), costCenterId: costCenters[0].id,
            bankAccountId: itau.id, orderId: order.id, issueDate, competenceDate: issueDate, dueDate, amount,
            installment: n + 1, installments: 2, status: 'OPEN',
            documentNumber: `NF-${String(order.number).padStart(5, '0')}`,
          },
        });
        if (dueDate.getTime() < today.getTime()) {
          await prisma.settlement.create({
            data: { companyId, entryId: entry.id, bankAccountId: itau.id, paidAt: dueDate, amount },
          });
          await prisma.financialEntry.update({ where: { id: entry.id }, data: { paidAmount: amount, status: 'PAID' } });
        }
      }
    }

    // Despesas fixas do mes
    const fixedExpenses: Array<[string, string, number, number, string]> = [
      ['Aluguel da loja', 'Aluguel e condominio', 4800 * scale, 5, suppliers[3].id],
      ['Energia eletrica', 'Energia eletrica', between(480, 920) * scale, 10, suppliers[5].id],
      ['Internet e telefone', 'Internet e telefone', 349.9, 12, suppliers[6].id],
      ['Honorarios contabeis', 'Contabilidade', 690 * scale, 10, suppliers[4].id],
      ['Salarios da equipe', 'Salarios e ordenados', 6400 * scale, 5, ''],
      ['Simples Nacional (DAS)', 'Simples Nacional (DAS)', between(900, 2600) * scale, 20, ''],
      ['Assinaturas e software', 'Software e assinaturas', 189.9, 15, ''],
      ['Anuncios e trafego pago', 'Marketing e anuncios', between(300, 900) * scale, 18, ''],
    ];

    for (const [description, categoryName, amount, day, contactId] of fixedExpenses) {
      const dueDate = d(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, day);
      const entry = await prisma.financialEntry.create({
        data: {
          companyId, kind: 'PAYABLE', description, contactId: contactId || null,
          categoryId: cat(categoryName), costCenterId: costCenters[3].id, bankAccountId: itau.id,
          issueDate: monthStart, competenceDate: monthStart, dueDate, amount: round2(amount), status: 'OPEN',
        },
      });
      if (dueDate.getTime() < today.getTime() && rnd() < 0.94) {
        await prisma.settlement.create({
          data: { companyId, entryId: entry.id, bankAccountId: itau.id, paidAt: dueDate, amount: round2(amount) },
        });
        await prisma.financialEntry.update({ where: { id: entry.id }, data: { paidAmount: round2(amount), status: 'PAID' } });
      }
    }
  }

  // Recorrencia ativa de exemplo
  const nextRun = addMonths(d(today.getUTCFullYear(), today.getUTCMonth() + 1, 5), 1);
  await prisma.recurrence.create({
    data: {
      companyId, kind: 'PAYABLE', description: 'Aluguel da loja (recorrente)', amount: round2(4800 * scale),
      contactId: suppliers[3].id, categoryId: cat('Aluguel e condominio'), costCenterId: costCenters[3].id,
      bankAccountId: itau.id, frequency: 'MONTHLY', interval: 1, dayOfMonth: 5,
      startDate: nextRun, nextRunAt: nextRun,
    },
  });

  // Transferencia entre contas
  await prisma.transfer.create({
    data: {
      companyId, fromAccountId: mercadoPago.id, toAccountId: itau.id,
      amount: round2(1500 * scale), date: new Date(today.getTime() - 5 * 86400000),
      description: 'Repasse do saldo do Mercado Pago para a conta principal',
    },
  });

  // Movimentacoes de estoque iniciais
  for (const product of products.filter((p) => p.trackStock)) {
    await prisma.stockMovement.create({
      data: {
        companyId, productId: product.id, type: 'IN', quantity: product.stock,
        unitCost: product.costPrice, balance: product.stock, reason: 'Estoque inicial (carga do sistema)',
        refType: 'IMPORT',
      },
    });
  }

  // -------------------------------------------------------------------------
  // Extrato bancario pendente de conciliacao
  // -------------------------------------------------------------------------
  console.log('  extrato bancario para conciliar...');
  const openReceivables = await prisma.financialEntry.findMany({
    where: { companyId, kind: 'RECEIVABLE', status: 'OPEN', dueDate: { lte: today } },
    take: Math.round(6 * scale) + 2,
    orderBy: { dueDate: 'desc' },
    include: { contact: true },
  });
  const openPayables = await prisma.financialEntry.findMany({
    where: { companyId, kind: 'PAYABLE', status: 'OPEN', dueDate: { lte: today } },
    take: Math.round(4 * scale) + 2,
    orderBy: { dueDate: 'desc' },
    include: { contact: true },
  });

  const bankImport = await prisma.bankImport.create({
    data: {
      companyId, bankAccountId: itau.id, fileName: 'extrato-itau-mes-atual.ofx', fileType: 'OFX',
      fileSize: 18432, periodStart: addMonths(today, -1), periodEnd: today,
      parsedCount: 0, importedCount: 0, status: 'DONE',
      meta: JSON.stringify({ bankId: '341', accountId: '56789-0', currency: 'BRL' }),
    },
  });

  const rows: Array<{ date: Date; amount: number; description: string }> = [];
  for (const entry of openReceivables) {
    rows.push({
      date: entry.dueDate,
      amount: entry.amount,
      description: `PIX RECEBIDO ${(entry.contact?.name ?? 'CLIENTE').toUpperCase()}`,
    });
  }
  for (const entry of openPayables) {
    rows.push({
      date: entry.dueDate,
      amount: -entry.amount,
      description: `PAGAMENTO ${(entry.contact?.name ?? entry.description).toUpperCase().slice(0, 40)}`,
    });
  }
  // Lancamentos que nao existem no sistema - forcam o uso de "criar lancamento".
  rows.push(
    { date: new Date(today.getTime() - 3 * 86400000), amount: -29.9, description: 'TARIFA PACOTE DE SERVICOS' },
    { date: new Date(today.getTime() - 6 * 86400000), amount: -12.35, description: 'TARIFA TED/DOC' },
    { date: new Date(today.getTime() - 8 * 86400000), amount: round2(84.22 * scale), description: 'RENDIMENTO APLICACAO AUTOMATICA' },
    { date: new Date(today.getTime() - 10 * 86400000), amount: round2(-215.4 * scale), description: 'TAXA MAQUININHA STONE' },
  );

  const { createHash } = await import('crypto');
  let imported = 0;
  for (const row of rows) {
    const hash = createHash('sha1')
      .update([itau.id, row.date.toISOString().slice(0, 10), row.amount.toFixed(2), row.description.toLowerCase().replace(/[^a-z0-9]+/g, '')].join('|'))
      .digest('hex');
    try {
      await prisma.bankTransaction.create({
        data: {
          companyId, bankAccountId: itau.id, importId: bankImport.id, hash,
          date: row.date, amount: round2(row.amount), direction: row.amount >= 0 ? 'IN' : 'OUT',
          description: row.description, status: 'PENDING',
        },
      });
      imported += 1;
    } catch {
      // hash duplicado - ignora
    }
  }

  await prisma.bankImport.update({
    where: { id: bankImport.id },
    data: { parsedCount: rows.length, importedCount: imported, duplicateCount: rows.length - imported },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
