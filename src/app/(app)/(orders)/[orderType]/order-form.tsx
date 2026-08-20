'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Plus, Save, Trash2 } from 'lucide-react';
import { saveOrderAction, type OrderState } from '@/app/actions/orders';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { SALES_CHANNELS } from '@/lib/constants';
import { formatCurrency, round2, toDateInput } from '@/lib/utils';
import type { OrderTypeConfig } from './order-type';

type ProductOption = { id: string; name: string; sku: string | null; salePrice: number; costPrice: number; stock: number; unit: string };

type Line = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : label}
    </button>
  );
}

const toNumber = (value: string) => {
  const parsed = Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  productId: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  discount: '',
});

export function OrderForm({
  config,
  options,
  order,
}: {
  config: OrderTypeConfig;
  options: {
    contacts: Array<{ id: string; name: string; kind: string }>;
    products: ProductOption[];
    paymentMethods: Array<{ id: string; name: string }>;
  };
  order?: {
    id: string; contactId: string | null; status: string; issueDate: Date;
    paymentMethodId: string | null; installments: number; firstDueDate: Date | null;
    discount: number; shipping: number; notes: string | null; channel: string | null;
    items: Array<{ productId: string | null; description: string; quantity: number; unitPrice: number; discount: number }>;
  };
}) {
  const [state, action] = useActionState<OrderState, FormData>(saveOrderAction, undefined);
  const [lines, setLines] = useState<Line[]>(
    order?.items.length
      ? order.items.map((item) => ({
          key: Math.random().toString(36).slice(2),
          productId: item.productId ?? '',
          description: item.description,
          quantity: String(item.quantity).replace('.', ','),
          unitPrice: String(item.unitPrice).replace('.', ','),
          discount: item.discount ? String(item.discount).replace('.', ',') : '',
        }))
      : [newLine()],
  );
  const [extraDiscount, setExtraDiscount] = useState(order ? String(order.discount).replace('.', ',') : '');
  const [shipping, setShipping] = useState(order ? String(order.shipping).replace('.', ',') : '');

  const contacts = options.contacts.filter((contact) => config.contactKinds.includes(contact.kind));

  const totals = useMemo(() => {
    const subtotal = round2(lines.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.unitPrice), 0));
    const itemDiscount = round2(lines.reduce((sum, line) => sum + toNumber(line.discount), 0));
    const extra = toNumber(extraDiscount);
    const freight = toNumber(shipping);
    return { subtotal, itemDiscount, extra, freight, total: round2(subtotal - itemDiscount - extra + freight) };
  }, [lines, extraDiscount, shipping]);

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const pickProduct = (key: string, productId: string) => {
    const product = options.products.find((p) => p.id === productId);
    update(key, {
      productId,
      ...(product
        ? {
            description: product.name,
            unitPrice: String(config.type === 'SALE' ? product.salePrice : product.costPrice).replace('.', ','),
          }
        : {}),
    });
  };

  return (
    <form action={action} className="space-y-5">
      {order && <input type="hidden" name="id" value={order.id} />}
      <input type="hidden" name="type" value={config.type} />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="Dados do pedido">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={config.contactLabel} htmlFor="contactId">
            <select id="contactId" name="contactId" defaultValue={order?.contactId ?? ''} className="input">
              <option value="">{config.type === 'SALE' ? 'Consumidor final' : 'Nao informado'}</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Data do pedido" htmlFor="issueDate" required>
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              required
              defaultValue={toDateInput(order?.issueDate ?? new Date())}
              className="input"
            />
          </Field>

          {config.type === 'SALE' && (
            <Field label="Canal de venda" htmlFor="channel">
              <select id="channel" name="channel" defaultValue={order?.channel ?? ''} className="input">
                <option value="">Nao informado</option>
                {SALES_CHANNELS.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
              </select>
            </Field>
          )}
        </div>
      </Card>

      <Card
        title="Itens"
        actions={
          <button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="btn-secondary btn-sm">
            <Plus size={14} /> Adicionar item
          </button>
        }
        bodyClassName="p-0"
      >
        <div className="table-wrap">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th className="w-1/3">Produto</th>
                <th>Descricao</th>
                <th className="w-24">Qtde</th>
                <th className="w-32">Preco unit.</th>
                <th className="w-28">Desconto</th>
                <th className="w-28 num">Total</th>
                <th className="w-10" aria-label="Remover" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const product = options.products.find((p) => p.id === line.productId);
                const lineTotal = round2(toNumber(line.quantity) * toNumber(line.unitPrice) - toNumber(line.discount));
                return (
                  <tr key={line.key}>
                    <td>
                      <select
                        name="itemProductId"
                        value={line.productId}
                        onChange={(event) => pickProduct(line.key, event.target.value)}
                        className="input"
                        aria-label="Produto"
                      >
                        <option value="">Item livre (sem cadastro)</option>
                        {options.products.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                            {option.sku ? ` (${option.sku})` : ''}
                          </option>
                        ))}
                      </select>
                      {product && config.type === 'SALE' && (
                        <span className="mt-1 block text-[11px] text-ink-500">
                          Estoque: {product.stock} {product.unit}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        name="itemDescription"
                        value={line.description}
                        onChange={(event) => update(line.key, { description: event.target.value })}
                        className="input"
                        placeholder="Descricao do item"
                        aria-label="Descricao"
                      />
                    </td>
                    <td>
                      <input
                        name="itemQuantity"
                        value={line.quantity}
                        onChange={(event) => update(line.key, { quantity: event.target.value })}
                        className="input"
                        inputMode="decimal"
                        aria-label="Quantidade"
                      />
                    </td>
                    <td>
                      <input
                        name="itemUnitPrice"
                        value={line.unitPrice}
                        onChange={(event) => update(line.key, { unitPrice: event.target.value })}
                        className="input"
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-label="Preco unitario"
                      />
                    </td>
                    <td>
                      <input
                        name="itemDiscount"
                        value={line.discount}
                        onChange={(event) => update(line.key, { discount: event.target.value })}
                        className="input"
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-label="Desconto"
                      />
                    </td>
                    <td className="num font-medium tabular-nums">{formatCurrency(lineTotal)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== line.key) : current))}
                        className="btn-ghost btn-sm text-red-600"
                        aria-label="Remover item"
                        disabled={lines.length === 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Pagamento" className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Forma de pagamento" htmlFor="paymentMethodId">
              <select id="paymentMethodId" name="paymentMethodId" defaultValue={order?.paymentMethodId ?? ''} className="input">
                <option value="">Nao informada</option>
                {options.paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>{method.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Parcelas" htmlFor="installments">
              <input
                id="installments"
                name="installments"
                type="number"
                min={1}
                max={36}
                defaultValue={order?.installments ?? 1}
                className="input"
              />
            </Field>

            <Field label="Primeiro vencimento" htmlFor="firstDueDate">
              <input
                id="firstDueDate"
                name="firstDueDate"
                type="date"
                defaultValue={toDateInput(order?.firstDueDate ?? new Date())}
                className="input"
              />
            </Field>

            <Field label="Desconto adicional" htmlFor="discount">
              <input
                id="discount"
                name="discount"
                inputMode="decimal"
                value={extraDiscount}
                onChange={(event) => setExtraDiscount(event.target.value)}
                className="input"
                placeholder="0,00"
              />
            </Field>

            <Field label="Frete" htmlFor="shipping">
              <input
                id="shipping"
                name="shipping"
                inputMode="decimal"
                value={shipping}
                onChange={(event) => setShipping(event.target.value)}
                className="input"
                placeholder="0,00"
              />
            </Field>

            <Field label="Situacao" htmlFor="status" hint="Faturar gera o financeiro e movimenta o estoque.">
              <select id="status" name="status" defaultValue={order?.status ?? 'BILLED'} className="input">
                <option value="DRAFT">Rascunho</option>
                <option value="OPEN">Aberto</option>
                <option value="APPROVED">Aprovado</option>
                <option value="BILLED">Faturado</option>
              </select>
            </Field>

            <Field label="Observacoes" htmlFor="notes" className="md:col-span-3">
              <textarea id="notes" name="notes" rows={2} defaultValue={order?.notes ?? ''} className="input" />
            </Field>
          </div>
        </Card>

        <Card title="Resumo">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-600">Subtotal</dt>
              <dd className="tabular-nums text-ink-900">{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Descontos nos itens</dt>
              <dd className="tabular-nums text-red-600">-{formatCurrency(totals.itemDiscount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Desconto adicional</dt>
              <dd className="tabular-nums text-red-600">-{formatCurrency(totals.extra)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Frete</dt>
              <dd className="tabular-nums text-ink-900">{formatCurrency(totals.freight)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-200 pt-2">
              <dt className="font-semibold text-ink-900">Total</dt>
              <dd className="text-lg font-semibold tabular-nums text-brand-700">{formatCurrency(totals.total)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href={`/${config.slug}`} className="btn-secondary">Cancelar</Link>
        <Submit label={order ? 'Salvar pedido' : `Registrar ${config.singular.toLowerCase()}`} />
      </div>
    </form>
  );
}
