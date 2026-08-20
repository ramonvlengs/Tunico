'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { saveProductAction, type FormState } from '@/app/actions/registry';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { PRODUCT_GROUPS, TCG_CONDITIONS, TCG_GAMES } from '@/lib/constants';
import { formatCurrency, formatPercent } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : 'Salvar produto'}
    </button>
  );
}

export type ProductValues = {
  id: string; sku: string | null; name: string; description: string | null; type: string;
  unit: string; group: string | null; barcode: string | null; ncm: string | null;
  costPrice: number; salePrice: number; stock: number; minStock: number; trackStock: boolean;
  tcgGame: string | null; tcgSet: string | null; tcgNumber: string | null; tcgRarity: string | null;
  tcgLanguage: string | null; tcgCondition: string | null; tcgFoil: boolean; isActive: boolean;
};

export function ProductForm({ product }: { product?: ProductValues }) {
  const [state, action] = useActionState<FormState, FormData>(saveProductAction, undefined);
  const [type, setType] = useState(product?.type ?? 'PRODUCT');
  const [cost, setCost] = useState(product ? String(product.costPrice).replace('.', ',') : '');
  const [price, setPrice] = useState(product ? String(product.salePrice).replace('.', ',') : '');

  const toNumber = (value: string) => {
    const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const costValue = toNumber(cost);
  const priceValue = toNumber(price);
  const margin = priceValue > 0 ? ((priceValue - costValue) / priceValue) * 100 : 0;
  const markup = costValue > 0 ? ((priceValue - costValue) / costValue) * 100 : 0;

  return (
    <form action={action} className="space-y-5">
      {product && <input type="hidden" name="id" value={product.id} />}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="Identificacao">
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="Nome" htmlFor="name" required className="md:col-span-4">
            <input
              id="name"
              name="name"
              required
              defaultValue={product?.name}
              className="input"
              placeholder="Charizard ex - Obsidian Flames 223/197"
            />
          </Field>

          <Field label="Codigo (SKU)" htmlFor="sku" className="md:col-span-2">
            <input id="sku" name="sku" defaultValue={product?.sku ?? ''} className="input" placeholder="SGL-PKM-001" />
          </Field>

          <Field label="Tipo" htmlFor="type" className="md:col-span-2">
            <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
              <option value="PRODUCT">Produto</option>
              <option value="SERVICE">Servico</option>
            </select>
          </Field>

          <Field label="Grupo" htmlFor="group" className="md:col-span-2">
            <select id="group" name="group" defaultValue={product?.group ?? ''} className="input">
              <option value="">Nao classificado</option>
              {PRODUCT_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </Field>

          <Field label="Unidade" htmlFor="unit" className="md:col-span-2">
            <input id="unit" name="unit" defaultValue={product?.unit ?? 'UN'} className="input" placeholder="UN" />
          </Field>

          <Field label="Descricao" htmlFor="description" className="md:col-span-6">
            <textarea id="description" name="description" rows={2} defaultValue={product?.description ?? ''} className="input" />
          </Field>
        </div>
      </Card>

      <Card title="Precos" description="A margem e o markup sao calculados enquanto voce digita.">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Preco de custo" htmlFor="costPrice">
            <input
              id="costPrice"
              name="costPrice"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="input"
              placeholder="0,00"
            />
          </Field>

          <Field label="Preco de venda" htmlFor="salePrice">
            <input
              id="salePrice"
              name="salePrice"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input"
              placeholder="0,00"
            />
          </Field>

          <div className="rounded-lg bg-ink-50 p-3">
            <p className="text-xs text-ink-500">Lucro bruto por unidade</p>
            <p className="mt-1 font-semibold tabular-nums text-ink-900">{formatCurrency(priceValue - costValue)}</p>
          </div>

          <div className="rounded-lg bg-ink-50 p-3">
            <p className="text-xs text-ink-500">Margem / markup</p>
            <p className="mt-1 font-semibold tabular-nums text-ink-900">
              {formatPercent(margin)} / {formatPercent(markup)}
            </p>
          </div>
        </div>
      </Card>

      {type === 'PRODUCT' && (
        <>
          <Card title="Estoque">
            <div className="grid gap-4 md:grid-cols-3">
              {!product && (
                <Field label="Estoque inicial" htmlFor="stock" hint="Gera uma entrada no historico de movimentacoes.">
                  <input id="stock" name="stock" inputMode="decimal" defaultValue="0" className="input" />
                </Field>
              )}
              {product && (
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs text-ink-500">Estoque atual</p>
                  <p className="mt-1 font-semibold tabular-nums text-ink-900">
                    {product.stock} {product.unit}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-400">Alterado apenas por movimentacoes.</p>
                </div>
              )}

              <Field label="Estoque minimo" htmlFor="minStock" hint="Usado no alerta de reposicao.">
                <input
                  id="minStock"
                  name="minStock"
                  inputMode="decimal"
                  defaultValue={product ? String(product.minStock).replace('.', ',') : '0'}
                  className="input"
                />
              </Field>

              <Field label="Codigo de barras" htmlFor="barcode">
                <input id="barcode" name="barcode" defaultValue={product?.barcode ?? ''} className="input" />
              </Field>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="trackStock"
                defaultChecked={product?.trackStock ?? true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium text-ink-800">Controlar estoque deste item</span>
            </label>
          </Card>

          <Card
            title="Dados de card game"
            description="Opcional - preencha para singles e produtos de TCG."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Jogo" htmlFor="tcgGame">
                <select id="tcgGame" name="tcgGame" defaultValue={product?.tcgGame ?? ''} className="input">
                  <option value="">Nao se aplica</option>
                  {TCG_GAMES.map((game) => <option key={game} value={game}>{game}</option>)}
                </select>
              </Field>

              <Field label="Colecao / set" htmlFor="tcgSet">
                <input id="tcgSet" name="tcgSet" defaultValue={product?.tcgSet ?? ''} className="input" placeholder="Obsidian Flames" />
              </Field>

              <Field label="Numero da carta" htmlFor="tcgNumber">
                <input id="tcgNumber" name="tcgNumber" defaultValue={product?.tcgNumber ?? ''} className="input" placeholder="223/197" />
              </Field>

              <Field label="Raridade" htmlFor="tcgRarity">
                <input id="tcgRarity" name="tcgRarity" defaultValue={product?.tcgRarity ?? ''} className="input" placeholder="Ultra Rare" />
              </Field>

              <Field label="Idioma" htmlFor="tcgLanguage">
                <input id="tcgLanguage" name="tcgLanguage" defaultValue={product?.tcgLanguage ?? ''} className="input" placeholder="Ingles" />
              </Field>

              <Field label="Conservacao" htmlFor="tcgCondition">
                <select id="tcgCondition" name="tcgCondition" defaultValue={product?.tcgCondition ?? ''} className="input">
                  <option value="">Nao informada</option>
                  {TCG_CONDITIONS.map((condition) => (
                    <option key={condition.value} value={condition.value}>{condition.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="tcgFoil"
                defaultChecked={product?.tcgFoil ?? false}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium text-ink-800">Versao foil / holografica</span>
            </label>
          </Card>
        </>
      )}

      <Card>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={product?.isActive ?? true}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="font-medium text-ink-800">Produto ativo (disponivel para venda)</span>
        </label>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/produtos" className="btn-secondary">Cancelar</Link>
        <Submit />
      </div>
    </form>
  );
}
