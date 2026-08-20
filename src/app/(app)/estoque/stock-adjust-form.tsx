'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Boxes } from 'lucide-react';
import { adjustStockAction, type FormState } from '@/app/actions/registry';
import { Alert, Field } from '@/components/ui/primitives';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      <Boxes size={16} /> {pending ? 'Registrando...' : 'Registrar movimentacao'}
    </button>
  );
}

export function StockAdjustForm({
  products,
  fixedProductId,
}: {
  products: Array<{ id: string; name: string; stock: number; unit: string; costPrice: number }>;
  fixedProductId?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(adjustStockAction, undefined);
  const [productId, setProductId] = useState(fixedProductId ?? products[0]?.id ?? '');
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const selected = products.find((product) => product.id === productId);

  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {fixedProductId ? (
        <input type="hidden" name="productId" value={fixedProductId} />
      ) : (
        <Field label="Produto" htmlFor="productId" required>
          <select
            id="productId"
            name="productId"
            required
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="input"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.stock} {product.unit})
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Tipo de movimento" htmlFor="type" required>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as 'IN' | 'OUT' | 'ADJUST')}
          className="input"
        >
          <option value="IN">Entrada (compra, devolucao, acerto para mais)</option>
          <option value="OUT">Saida (venda avulsa, perda, brinde)</option>
          <option value="ADJUST">Ajuste (definir o saldo exato do inventario)</option>
        </select>
      </Field>

      <Field
        label={type === 'ADJUST' ? 'Novo saldo' : 'Quantidade'}
        htmlFor="quantity"
        required
        hint={
          selected
            ? type === 'ADJUST'
              ? `Saldo atual: ${selected.stock} ${selected.unit}`
              : `Ficara com ${type === 'IN' ? 'mais' : 'menos'} unidades que os ${selected.stock} atuais.`
            : undefined
        }
      >
        <input id="quantity" name="quantity" required inputMode="decimal" className="input" placeholder="0" />
      </Field>

      {type === 'IN' && (
        <Field label="Custo unitario" htmlFor="unitCost" hint="Deixe em branco para usar o custo cadastrado.">
          <input
            id="unitCost"
            name="unitCost"
            inputMode="decimal"
            className="input"
            placeholder={selected ? String(selected.costPrice).replace('.', ',') : '0,00'}
          />
        </Field>
      )}

      <Field label="Motivo" htmlFor="reason">
        <input id="reason" name="reason" className="input" placeholder="Inventario de agosto" />
      </Field>

      <Submit />
    </form>
  );
}
