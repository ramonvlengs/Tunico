# TunicoTCG Control

ERP financeiro multi-CNPJ da Tunico TCG. Next.js 15 (App Router) + TypeScript +
Tailwind + Prisma. Toda a interface e os dados estao em portugues do Brasil.

## Comandos

```bash
npm run dev            # servidor de desenvolvimento
npm run typecheck      # verificacao de tipos (rodar antes de commitar)
npm run test:parsers   # testes dos parsers de extrato
npm run build          # build de producao
npm run db:reset       # recria o banco e popula a demo
```

## Convencoes do projeto

- **Portugues sem acentos no codigo.** Identificadores, comentarios e strings de
  UI usam portugues; o codigo evita acentos para nao depender de encoding, mas
  textos voltados ao usuario nos componentes podem usar acentuacao quando ja
  existir no arquivo.
- **Multi-tenant e obrigatorio.** Toda consulta ao banco filtra por
  `companyId`, vindo de `requireContext()` / `requireApiContext()`. Nunca
  confie em um ID que chega pela URL sem filtrar pela empresa.
- **Permissao no servidor.** Esconder o botao nao protege nada: toda server
  action revalida com `ctx.can(...)`, e paginas sensiveis usam
  `requirePermission()`.
- **Dinheiro** passa por `round2()` a cada operacao. **Datas** sao UTC a
  meia-noite (`parseDateInput`, `startOfToday`, `addMonthsUTC`).
- **Status financeiro** e sempre recalculado por `recalcEntry()` a partir das
  baixas - nunca escrito na mao.
- Filtros de listagem vivem na URL (`useQueryState`), nao em estado de cliente.
- Server Components por padrao; `'use client'` so onde ha interacao real.

## Onde fica o que

| Assunto | Arquivo |
| --- | --- |
| Sessao e cookies | `src/lib/auth.ts` |
| Empresa ativa e permissoes | `src/lib/tenant.ts`, `src/lib/permissions.ts` |
| Parcelas, baixas, saldos | `src/server/finance.ts` |
| Importacao e conciliacao | `src/server/reconciliation.ts` |
| Parsers de extrato | `src/server/parsers/` |
| Relatorios | `src/server/reports.ts` |
| Plano de contas de nova empresa | `src/server/defaults.ts` |

Detalhes de negocio (pontuacao da conciliacao, regras de baixa, regime de
competencia x caixa) estao documentados no `README.md`.
