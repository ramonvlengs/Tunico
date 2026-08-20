'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Upload, FileUp, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { importStatementAction, type ImportState } from '@/app/actions/reconciliation';
import { Alert, Field } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const ACCEPT = '.ofx,.qfx,.xlsx,.xls,.csv,.pdf';

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending || disabled}>
      <Upload size={16} />
      {pending ? 'Processando arquivo...' : 'Importar extrato'}
    </button>
  );
}

export function ImportForm({
  accounts,
}: {
  accounts: Array<{ id: string; name: string; bankName: string | null; color: string }>;
}) {
  const [state, action] = useActionState<ImportState, FormData>(importStatementAction, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0] ?? null;
    setFile(selected);
  };

  return (
    <form action={action} className="space-y-4">
      {state && 'error' in state && <Alert tone="danger" title="Nao foi possivel importar">{state.error}</Alert>}

      {state && 'success' in state && (
        <Alert tone={state.detail.imported > 0 ? 'success' : 'warning'} title={state.success}>
          <ul className="mt-1 space-y-0.5">
            <li>Formato detectado: <strong>{state.detail.fileType}</strong></li>
            <li>Lancamentos lidos no arquivo: <strong>{state.detail.parsed}</strong></li>
            <li>Importados agora: <strong>{state.detail.imported}</strong></li>
            <li>Ja existentes (ignorados): <strong>{state.detail.duplicates}</strong></li>
            {state.detail.autoMatched > 0 && (
              <li>Conciliados automaticamente: <strong>{state.detail.autoMatched}</strong></li>
            )}
          </ul>
          {state.detail.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-current/15 pt-2 text-xs">
              {state.detail.warnings.map((warning) => (
                <li key={warning} className="flex gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          <Link href="/conciliacao" className="btn-primary btn-sm mt-3">
            <CheckCircle2 size={14} /> Ir para a conciliacao
          </Link>
        </Alert>
      )}

      <Field label="Conta bancaria do extrato" htmlFor="bankAccountId" required>
        <select id="bankAccountId" name="bankAccountId" required className="input" defaultValue={accounts[0]?.id}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.bankName ? ` (${account.bankName})` : ''}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <span className="label">Arquivo</span>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(event.dataTransfer.files);
            if (inputRef.current) inputRef.current.files = event.dataTransfer.files;
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition',
            dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-300 bg-ink-50/50',
          )}
        >
          <FileUp size={30} className={dragging ? 'text-brand-600' : 'text-ink-400'} />
          {file ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink-900">{file.name}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="rounded p-1 text-ink-400 hover:bg-ink-200"
                aria-label="Remover arquivo"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-600">
              Arraste o arquivo aqui ou{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="link font-medium"
              >
                escolha do computador
              </button>
            </p>
          )}
          <p className="text-xs text-ink-400">OFX, QFX, XLSX, XLS, CSV ou PDF - ate 20 MB</p>
          <input
            ref={inputRef}
            id="file"
            name="file"
            type="file"
            accept={ACCEPT}
            required
            onChange={(event) => handleFiles(event.target.files)}
            className="sr-only"
          />
        </div>
        {file && (
          <p className="mt-1.5 text-xs text-ink-500">
            {(file.size / 1024).toFixed(0)} KB selecionados.
          </p>
        )}
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-ink-200 bg-white p-3 text-sm">
        <input
          type="checkbox"
          name="autoReconcile"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          <span className="font-medium text-ink-800">Conciliar automaticamente os casos obvios</span>
          <span className="block text-xs text-ink-500">
            Vincula sozinho apenas quando ha uma unica sugestao com 85% ou mais de aderencia. Havendo empate, a decisao
            fica com voce.
          </span>
        </span>
      </label>

      <Submit disabled={!file} />
    </form>
  );
}
