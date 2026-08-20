'use server';

/**
 * Acoes dos cadastros: contatos, categorias, centros de custo, contas
 * bancarias, formas de pagamento e produtos.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireApiContext } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { onlyDigits, parseDateInput, round2 } from '@/lib/utils';
import { isValidDocument } from '@/lib/validators';

export type FormState = { error?: string; success?: string } | undefined;

function fail(message: string): FormState {
  return { error: message };
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === '' ? null : value;
}

function num(formData: FormData, key: string): number {
  const raw = str(formData, key).replace(/[R$\s]/g, '');
  if (!raw) return 0;
  const normalized =
    raw.includes(',') && raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) !== null;
}

// ---------------------------------------------------------------------------
// Contatos
// ---------------------------------------------------------------------------

export async function saveContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('catalog.write')) return fail('Sem permissao para editar cadastros.');

  const id = optional(formData, 'id');
  const name = str(formData, 'name');
  if (name.length < 2) return fail('Informe o nome do contato.');

  const document = onlyDigits(str(formData, 'document'));
  if (document && !isValidDocument(document)) {
    return fail('CPF/CNPJ invalido. Confira os digitos ou deixe o campo em branco.');
  }

  const data = {
    companyId: ctx.company.id,
    kind: str(formData, 'kind') || 'CUSTOMER',
    personType: str(formData, 'personType') || 'PF',
    name,
    tradeName: optional(formData, 'tradeName'),
    document: document || null,
    stateReg: optional(formData, 'stateReg'),
    email: optional(formData, 'email'),
    phone: optional(formData, 'phone'),
    whatsapp: optional(formData, 'whatsapp'),
    zipCode: optional(formData, 'zipCode'),
    street: optional(formData, 'street'),
    number: optional(formData, 'number'),
    complement: optional(formData, 'complement'),
    district: optional(formData, 'district'),
    city: optional(formData, 'city'),
    state: optional(formData, 'state'),
    notes: optional(formData, 'notes'),
    creditLimit: num(formData, 'creditLimit'),
    isActive: bool(formData, 'isActive'),
  };

  let contact;
  if (id) {
    // Confere a empresa dona antes de escrever: sem isso, um ID de outra
    // empresa seria atualizado e ainda migraria para a empresa ativa.
    const existing = await prisma.contact.findFirst({ where: { id, companyId: ctx.company.id } });
    if (!existing) return fail('Contato nao encontrado.');
    contact = await prisma.contact.update({ where: { id }, data });
  } else {
    contact = await prisma.contact.create({ data });
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: id ? 'UPDATE' : 'CREATE',
    entity: 'Contact', entityId: contact.id, summary: `Contato "${name}"`,
  });

  revalidatePath('/contatos');
  redirect(`/contatos/${contact.id}`);
}

export async function toggleContactAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('catalog.write')) return;
  const id = String(formData.get('id') ?? '');
  const contact = await prisma.contact.findFirst({ where: { id, companyId: auth.ctx.company.id } });
  if (!contact) return;
  await prisma.contact.update({ where: { id }, data: { isActive: !contact.isActive } });
  revalidatePath('/contatos');
  revalidatePath(`/contatos/${id}`);
}

export async function deleteContactAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('catalog.write')) return;
  const id = String(formData.get('id') ?? '');

  const linked = await prisma.financialEntry.count({ where: { contactId: id, companyId: auth.ctx.company.id } });
  if (linked > 0) {
    // Contato com historico nunca e apagado: apenas inativado.
    await prisma.contact.updateMany({ where: { id, companyId: auth.ctx.company.id }, data: { isActive: false } });
  } else {
    await prisma.contact.deleteMany({ where: { id, companyId: auth.ctx.company.id } });
  }
  revalidatePath('/contatos');
  redirect('/contatos');
}

// ---------------------------------------------------------------------------
// Categorias (plano de contas)
// ---------------------------------------------------------------------------

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Sem permissao.');

  const id = optional(formData, 'id');
  const name = str(formData, 'name');
  if (name.length < 2) return fail('Informe o nome da categoria.');

  const parentId = optional(formData, 'parentId');
  if (parentId && parentId === id) return fail('Uma categoria nao pode ser pai dela mesma.');

  const data = {
    companyId: ctx.company.id,
    name,
    code: optional(formData, 'code'),
    type: str(formData, 'type') === 'INCOME' ? 'INCOME' : 'EXPENSE',
    dreGroup: optional(formData, 'dreGroup'),
    color: optional(formData, 'color'),
    parentId,
    isActive: bool(formData, 'isActive'),
  };

  if (id) await prisma.category.updateMany({ where: { id, companyId: ctx.company.id }, data });
  else await prisma.category.create({ data });

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: id ? 'UPDATE' : 'CREATE',
    entity: 'Category', entityId: id, summary: `Categoria "${name}"`,
  });

  revalidatePath('/configuracoes/categorias');
  return { success: 'Categoria salva.' };
}

export async function deleteCategoryAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('finance.write')) return;
  const id = String(formData.get('id') ?? '');
  const companyId = auth.ctx.company.id;

  const [used, children] = await Promise.all([
    prisma.financialEntry.count({ where: { categoryId: id, companyId } }),
    prisma.category.count({ where: { parentId: id, companyId } }),
  ]);

  // Categoria em uso vira inativa para nao quebrar o historico e a DRE.
  if (used > 0 || children > 0) {
    await prisma.category.updateMany({ where: { id, companyId }, data: { isActive: false } });
  } else {
    await prisma.category.deleteMany({ where: { id, companyId } });
  }
  revalidatePath('/configuracoes/categorias');
}

// ---------------------------------------------------------------------------
// Centros de custo
// ---------------------------------------------------------------------------

export async function saveCostCenterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Sem permissao.');

  const id = optional(formData, 'id');
  const name = str(formData, 'name');
  if (name.length < 2) return fail('Informe o nome do centro de custo.');

  const data = {
    companyId: ctx.company.id,
    name,
    code: optional(formData, 'code'),
    isActive: bool(formData, 'isActive'),
  };

  if (id) await prisma.costCenter.updateMany({ where: { id, companyId: ctx.company.id }, data });
  else await prisma.costCenter.create({ data });

  revalidatePath('/configuracoes/centros-de-custo');
  return { success: 'Centro de custo salvo.' };
}

export async function deleteCostCenterAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('finance.write')) return;
  const id = String(formData.get('id') ?? '');
  const used = await prisma.financialEntry.count({ where: { costCenterId: id, companyId: auth.ctx.company.id } });
  if (used > 0) {
    await prisma.costCenter.updateMany({ where: { id, companyId: auth.ctx.company.id }, data: { isActive: false } });
  } else {
    await prisma.costCenter.deleteMany({ where: { id, companyId: auth.ctx.company.id } });
  }
  revalidatePath('/configuracoes/centros-de-custo');
}

// ---------------------------------------------------------------------------
// Contas bancarias
// ---------------------------------------------------------------------------

export async function saveBankAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Sem permissao.');

  const id = optional(formData, 'id');
  const name = str(formData, 'name');
  if (name.length < 2) return fail('Informe o nome da conta.');

  const bankCode = optional(formData, 'bankCode');
  const data = {
    companyId: ctx.company.id,
    name,
    type: str(formData, 'type') || 'CHECKING',
    bankCode,
    bankName: optional(formData, 'bankName'),
    agency: optional(formData, 'agency'),
    accountNumber: optional(formData, 'accountNumber'),
    pixKey: optional(formData, 'pixKey'),
    initialBalance: round2(num(formData, 'initialBalance')),
    openingDate: parseDateInput(str(formData, 'openingDate')),
    color: str(formData, 'color') || '#16a34a',
    includeInCash: bool(formData, 'includeInCash'),
    isActive: bool(formData, 'isActive'),
  };

  if (id) await prisma.bankAccount.updateMany({ where: { id, companyId: ctx.company.id }, data });
  else await prisma.bankAccount.create({ data });

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: id ? 'UPDATE' : 'CREATE',
    entity: 'BankAccount', entityId: id, summary: `Conta "${name}"`,
  });

  revalidatePath('/financeiro/contas');
  redirect('/financeiro/contas');
}

export async function deleteBankAccountAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('finance.write')) return;
  const id = String(formData.get('id') ?? '');
  const companyId = auth.ctx.company.id;

  const movements = await prisma.settlement.count({ where: { bankAccountId: id, companyId } });
  const transactions = await prisma.bankTransaction.count({ where: { bankAccountId: id, companyId } });

  if (movements > 0 || transactions > 0) {
    await prisma.bankAccount.updateMany({ where: { id, companyId }, data: { isActive: false } });
  } else {
    await prisma.bankAccount.deleteMany({ where: { id, companyId } });
  }
  revalidatePath('/financeiro/contas');
  redirect('/financeiro/contas');
}

// ---------------------------------------------------------------------------
// Formas de pagamento
// ---------------------------------------------------------------------------

export async function savePaymentMethodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Sem permissao.');

  const id = optional(formData, 'id');
  const name = str(formData, 'name');
  if (name.length < 2) return fail('Informe o nome da forma de pagamento.');

  const data = {
    companyId: ctx.company.id,
    name,
    type: str(formData, 'type') || 'PIX',
    feePercent: num(formData, 'feePercent'),
    feeFixed: num(formData, 'feeFixed'),
    settlementDays: Number(str(formData, 'settlementDays') || '0') || 0,
    bankAccountId: optional(formData, 'bankAccountId'),
    isActive: bool(formData, 'isActive'),
  };

  if (id) await prisma.paymentMethod.updateMany({ where: { id, companyId: ctx.company.id }, data });
  else await prisma.paymentMethod.create({ data });

  revalidatePath('/configuracoes/formas-de-pagamento');
  return { success: 'Forma de pagamento salva.' };
}

export async function deletePaymentMethodAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('finance.write')) return;
  const id = String(formData.get('id') ?? '');
  const used = await prisma.settlement.count({ where: { paymentMethodId: id, companyId: auth.ctx.company.id } });
  if (used > 0) {
    await prisma.paymentMethod.updateMany({ where: { id, companyId: auth.ctx.company.id }, data: { isActive: false } });
  } else {
    await prisma.paymentMethod.deleteMany({ where: { id, companyId: auth.ctx.company.id } });
  }
  revalidatePath('/configuracoes/formas-de-pagamento');
}

// ---------------------------------------------------------------------------
// Produtos e estoque
// ---------------------------------------------------------------------------

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('catalog.write')) return fail('Sem permissao.');

  const id = optional(formData, 'id');
  const name = str(formData, 'name');
  if (name.length < 2) return fail('Informe o nome do produto.');

  const data = {
    companyId: ctx.company.id,
    sku: optional(formData, 'sku'),
    name,
    description: optional(formData, 'description'),
    type: str(formData, 'type') === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
    unit: str(formData, 'unit') || 'UN',
    group: optional(formData, 'group'),
    barcode: optional(formData, 'barcode'),
    ncm: optional(formData, 'ncm'),
    costPrice: num(formData, 'costPrice'),
    salePrice: num(formData, 'salePrice'),
    minStock: num(formData, 'minStock'),
    trackStock: bool(formData, 'trackStock'),
    tcgGame: optional(formData, 'tcgGame'),
    tcgSet: optional(formData, 'tcgSet'),
    tcgNumber: optional(formData, 'tcgNumber'),
    tcgRarity: optional(formData, 'tcgRarity'),
    tcgLanguage: optional(formData, 'tcgLanguage'),
    tcgCondition: optional(formData, 'tcgCondition'),
    tcgFoil: bool(formData, 'tcgFoil'),
    isActive: bool(formData, 'isActive'),
  };

  let productId = id;
  if (id) {
    await prisma.product.updateMany({ where: { id, companyId: ctx.company.id }, data });
  } else {
    const initialStock = num(formData, 'stock');
    const created = await prisma.product.create({ data: { ...data, stock: initialStock } });
    productId = created.id;
    if (initialStock !== 0 && data.trackStock) {
      await prisma.stockMovement.create({
        data: {
          companyId: ctx.company.id, productId: created.id, type: 'IN', quantity: initialStock,
          unitCost: data.costPrice, balance: initialStock, reason: 'Estoque inicial', refType: 'MANUAL',
          userId: ctx.user.id,
        },
      });
    }
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: id ? 'UPDATE' : 'CREATE',
    entity: 'Product', entityId: productId, summary: `Produto "${name}"`,
  });

  revalidatePath('/produtos');
  redirect(`/produtos/${productId}`);
}

export async function deleteProductAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('catalog.write')) return;
  const id = String(formData.get('id') ?? '');
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) {
    await prisma.product.updateMany({ where: { id, companyId: auth.ctx.company.id }, data: { isActive: false } });
  } else {
    await prisma.stockMovement.deleteMany({ where: { productId: id, companyId: auth.ctx.company.id } });
    await prisma.product.deleteMany({ where: { id, companyId: auth.ctx.company.id } });
  }
  revalidatePath('/produtos');
  redirect('/produtos');
}

export async function adjustStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('stock.write')) return fail('Sem permissao para movimentar estoque.');

  const productId = str(formData, 'productId');
  const type = str(formData, 'type');
  const quantity = num(formData, 'quantity');

  if (!['IN', 'OUT', 'ADJUST'].includes(type)) return fail('Tipo de movimento invalido.');
  if (!Number.isFinite(quantity) || quantity <= 0) return fail('Informe uma quantidade maior que zero.');

  const product = await prisma.product.findFirst({ where: { id: productId, companyId: ctx.company.id } });
  if (!product) return fail('Produto nao encontrado.');
  if (!product.trackStock) return fail('Este item nao controla estoque.');

  const balance =
    type === 'IN' ? round2(product.stock + quantity)
    : type === 'OUT' ? round2(product.stock - quantity)
    : round2(quantity);

  if (balance < 0) {
    return fail(`Saida maior que o estoque disponivel (${product.stock} ${product.unit}).`);
  }

  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        companyId: ctx.company.id, productId, type,
        quantity: type === 'ADJUST' ? round2(quantity - product.stock) : quantity,
        unitCost: num(formData, 'unitCost') || product.costPrice,
        balance, reason: optional(formData, 'reason'), refType: 'MANUAL', userId: ctx.user.id,
      },
    }),
    prisma.product.update({ where: { id: productId }, data: { stock: balance } }),
  ]);

  revalidatePath('/estoque');
  revalidatePath(`/produtos/${productId}`);
  return { success: 'Movimentacao registrada.' };
}
