'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireApiContext } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { parseDateInput, round2 } from '@/lib/utils';
import { createEntries, startOfToday } from '@/server/finance';

export type OrderState = { error?: string; success?: string } | undefined;

function parseAmount(value: unknown): number {
  const raw = String(value ?? '').replace(/[R$\s]/g, '');
  if (!raw) return 0;
  const normalized =
    raw.includes(',') && raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

type ItemInput = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
};

/** Le as linhas do formulario (arrays paralelos items.*). */
function readItems(formData: FormData): ItemInput[] {
  const productIds = formData.getAll('itemProductId').map(String);
  const descriptions = formData.getAll('itemDescription').map(String);
  const quantities = formData.getAll('itemQuantity').map(parseAmount);
  const prices = formData.getAll('itemUnitPrice').map(parseAmount);
  const discounts = formData.getAll('itemDiscount').map(parseAmount);

  const items: ItemInput[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i]?.trim();
    const quantity = quantities[i] ?? 0;
    if (!description || quantity <= 0) continue;
    const unitPrice = prices[i] ?? 0;
    const discount = discounts[i] ?? 0;
    items.push({
      productId: productIds[i] || null,
      description,
      quantity,
      unitPrice,
      discount,
      total: round2(quantity * unitPrice - discount),
    });
  }
  return items;
}

/**
 * Verifica se ha estoque para faturar uma venda. Deixar o saldo negativo
 * corromperia a valorizacao do estoque, entao o faturamento e bloqueado com
 * uma mensagem que diz exatamente qual item falta - a mesma regra que ja vale
 * para a saida manual de estoque.
 */
async function findStockShortages(
  companyId: string,
  items: Array<{ productId: string | null; quantity: number }>,
): Promise<string[]> {
  const problems: string[] = [];

  // Agrupa por produto: o mesmo item pode aparecer em varias linhas do pedido.
  const needed = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    needed.set(item.productId, (needed.get(item.productId) ?? 0) + item.quantity);
  }
  if (needed.size === 0) return problems;

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(needed.keys()) }, companyId },
    select: { id: true, name: true, stock: true, unit: true, trackStock: true },
  });

  for (const product of products) {
    if (!product.trackStock) continue;
    const quantity = needed.get(product.id) ?? 0;
    if (quantity > product.stock) {
      problems.push(
        `${product.name}: o pedido pede ${quantity} ${product.unit} e ha ${product.stock} ${product.unit} em estoque.`,
      );
    }
  }

  return problems;
}

/**
 * Cria ou atualiza um pedido de venda/compra. Ao aprovar, gera as parcelas em
 * contas a receber/pagar e baixa o estoque (somente nas vendas).
 */
export async function saveOrderAction(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const auth = await requireApiContext();
  if (!auth.ok) return { error: auth.error };
  const { ctx } = auth;
  if (!ctx.can('sales.write')) return { error: 'Sem permissao para registrar pedidos.' };

  const id = String(formData.get('id') ?? '') || null;
  const type = String(formData.get('type') ?? 'SALE') === 'PURCHASE' ? 'PURCHASE' : 'SALE';
  const status = String(formData.get('status') ?? 'DRAFT');
  const slug = type === 'SALE' ? 'vendas' : 'compras';

  const items = readItems(formData);
  if (items.length === 0) {
    return { error: 'Adicione ao menos um item com descricao e quantidade maior que zero.' };
  }

  const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const itemDiscount = round2(items.reduce((sum, item) => sum + item.discount, 0));
  const extraDiscount = round2(parseAmount(formData.get('discount')));
  const shipping = round2(parseAmount(formData.get('shipping')));
  const total = round2(subtotal - itemDiscount - extraDiscount + shipping);

  if (total < 0) return { error: 'O desconto informado e maior que o valor do pedido.' };

  const issueDate = parseDateInput(String(formData.get('issueDate') ?? '')) ?? startOfToday();
  const installments = Math.max(1, Number(String(formData.get('installments') ?? '1')) || 1);
  const firstDueDate = parseDateInput(String(formData.get('firstDueDate') ?? '')) ?? issueDate;

  if (status === 'BILLED' && type === 'SALE') {
    const shortages = await findStockShortages(ctx.company.id, items);
    if (shortages.length > 0) {
      return {
        error: `Estoque insuficiente para faturar. ${shortages.join(' ')} Registre a entrada em Estoque ou salve o pedido como Aprovado e fature depois.`,
      };
    }
  }

  const base = {
    companyId: ctx.company.id,
    type,
    contactId: String(formData.get('contactId') ?? '') || null,
    status,
    issueDate,
    paymentMethodId: String(formData.get('paymentMethodId') ?? '') || null,
    installments,
    firstDueDate,
    subtotal,
    discount: round2(itemDiscount + extraDiscount),
    shipping,
    total,
    notes: String(formData.get('notes') ?? '').trim() || null,
    channel: String(formData.get('channel') ?? '').trim() || null,
  };

  let orderId = id;

  if (id) {
    const existing = await prisma.order.findFirst({ where: { id, companyId: ctx.company.id } });
    if (!existing) return { error: 'Pedido nao encontrado.' };
    if (existing.status === 'BILLED' && status !== 'CANCELED') {
      return { error: 'Este pedido ja foi faturado. Cancele-o para alterar os itens.' };
    }
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId: id } }),
      prisma.order.update({
        where: { id },
        data: { ...base, items: { create: items } },
      }),
    ]);
  } else {
    const last = await prisma.order.findFirst({
      where: { companyId: ctx.company.id, type },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const created = await prisma.order.create({
      data: { ...base, number: (last?.number ?? 0) + 1, items: { create: items } },
    });
    orderId = created.id;
  }

  // Faturar: gera o financeiro e movimenta o estoque uma unica vez.
  if (status === 'BILLED' && orderId) {
    await billOrder(ctx.company.id, ctx.user.id, orderId);
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: id ? 'UPDATE' : 'CREATE',
    entity: 'Order', entityId: orderId, summary: `${type === 'SALE' ? 'Venda' : 'Compra'} de ${total}`,
  });

  revalidatePath(`/${slug}`);
  redirect(`/${slug}/${orderId}`);
}

/** Gera contas e baixa estoque. Idempotente: nao duplica se ja houver entries. */
async function billOrder(companyId: string, userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { items: true, paymentMethod: true, entries: { select: { id: true } } },
  });
  if (!order || order.entries.length > 0) return;

  await createEntries({
    companyId,
    kind: order.type === 'SALE' ? 'RECEIVABLE' : 'PAYABLE',
    description: `${order.type === 'SALE' ? 'Venda' : 'Compra'} #${order.number}`,
    amount: order.total,
    dueDate: order.firstDueDate ?? order.issueDate,
    issueDate: order.issueDate,
    competenceDate: order.issueDate,
    contactId: order.contactId,
    bankAccountId: order.paymentMethod?.bankAccountId ?? null,
    orderId: order.id,
    documentNumber: `${order.type === 'SALE' ? 'PED' : 'NF'}-${String(order.number).padStart(5, '0')}`,
    installments: order.installments,
  });

  for (const item of order.items) {
    if (!item.productId) continue;
    const product = await prisma.product.findFirst({ where: { id: item.productId, companyId } });
    if (!product || !product.trackStock) continue;

    const delta = order.type === 'SALE' ? -item.quantity : item.quantity;
    const balance = round2(product.stock + delta);
    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          type: order.type === 'SALE' ? 'OUT' : 'IN',
          quantity: item.quantity,
          unitCost: order.type === 'PURCHASE' ? item.unitPrice : product.costPrice,
          balance,
          reason: `${order.type === 'SALE' ? 'Venda' : 'Compra'} #${order.number}`,
          refType: 'ORDER',
          refId: order.id,
          userId,
        },
      }),
      prisma.product.update({ where: { id: product.id }, data: { stock: balance } }),
    ]);
  }
}

export async function billOrderAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('sales.write')) return;
  const { ctx } = auth;
  const id = String(formData.get('id') ?? '');

  const order = await prisma.order.findFirst({
    where: { id, companyId: ctx.company.id },
    include: { items: { select: { productId: true, quantity: true } } },
  });
  if (!order || order.status === 'BILLED' || order.status === 'CANCELED') return;

  const slugForError = order.type === 'SALE' ? 'vendas' : 'compras';
  if (order.type === 'SALE') {
    const shortages = await findStockShortages(ctx.company.id, order.items);
    if (shortages.length > 0) {
      redirect(`/${slugForError}/${id}?erro=${encodeURIComponent(shortages.join(' '))}`);
    }
  }

  await prisma.order.update({ where: { id }, data: { status: 'BILLED' } });
  await billOrder(ctx.company.id, ctx.user.id, id);

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'UPDATE',
    entity: 'Order', entityId: id, summary: `Pedido #${order.number} faturado`,
  });

  const slug = order.type === 'SALE' ? 'vendas' : 'compras';
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/${id}`);
  revalidatePath('/dashboard');
}

export async function cancelOrderAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('sales.write')) return;
  const { ctx } = auth;
  const id = String(formData.get('id') ?? '');

  const order = await prisma.order.findFirst({
    where: { id, companyId: ctx.company.id },
    include: { entries: { include: { settlements: true } } },
  });
  if (!order) return;

  // Nao cancela pedido com titulo ja baixado: exige estornar antes.
  const hasSettlements = order.entries.some((entry) => entry.settlements.length > 0);
  if (hasSettlements) return;

  await prisma.financialEntry.deleteMany({ where: { orderId: id, companyId: ctx.company.id } });
  await prisma.order.update({ where: { id }, data: { status: 'CANCELED' } });

  const slug = order.type === 'SALE' ? 'vendas' : 'compras';
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/${id}`);
}

export async function deleteOrderAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('sales.write')) return;
  const { ctx } = auth;
  const id = String(formData.get('id') ?? '');

  const order = await prisma.order.findFirst({
    where: { id, companyId: ctx.company.id },
    include: { entries: { include: { settlements: true } } },
  });
  if (!order) return;
  if (order.entries.some((entry) => entry.settlements.length > 0)) return;

  await prisma.financialEntry.deleteMany({ where: { orderId: id } });
  await prisma.order.delete({ where: { id } });

  const slug = order.type === 'SALE' ? 'vendas' : 'compras';
  revalidatePath(`/${slug}`);
  redirect(`/${slug}`);
}
