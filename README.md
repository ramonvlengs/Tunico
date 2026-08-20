<div align="center">
  <img src="public/brand/logo.svg" alt="TunicoTCG Control" width="120" />

  # TunicoTCG Control

  **ERP financeiro multi-CNPJ da Tunico TCG.**
  Contas a pagar e receber, fluxo de caixa, DRE, estoque, vendas e conciliacao
  bancaria por OFX, Excel, CSV e PDF.
</div>

---

## Sumario

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Como rodar](#como-rodar)
- [Acessos de demonstracao](#acessos-de-demonstracao)
- [Multi-CNPJ e isolamento de dados](#multi-cnpj-e-isolamento-de-dados)
- [Conciliacao bancaria](#conciliacao-bancaria)
- [Papeis e permissoes](#papeis-e-permissoes)
- [Como o dinheiro e calculado](#como-o-dinheiro-e-calculado)
- [Arquitetura](#arquitetura)
- [Trocar a logo](#trocar-a-logo)
- [Ir para producao](#ir-para-producao)
- [Testes](#testes)

---

## O que o sistema faz

Inspirado no Conta Azul, mas construido em volta da rotina de uma loja de card
game: singles com condicao e colecao, vendas em live e marketplace, repasses de
gateway e conciliacao do extrato no fim do mes.

### Financeiro
- **Contas a pagar e a receber** com filtros por situacao, categoria, contato,
  centro de custo e periodo (por vencimento, emissao ou competencia).
- **Parcelamento** mensal ou a cada N dias, com previa das parcelas antes de
  salvar. A diferenca de arredondamento vai para a ultima parcela, entao a soma
  bate exatamente com o total.
- **Baixa total ou parcial** com desconto, juros, multa e tarifa, mostrando ao
  vivo quanto abate do titulo e qual o impacto no caixa.
- **Estorno de baixa**, que tambem desfaz a conciliacao ligada a ela.
- **Baixa em lote** direto da listagem.
- **Recorrencias** (aluguel, salarios, assinaturas) com geracao manual ou
  automatica e controle de fim por data ou por numero de ocorrencias.
- **Contas e caixas**: banco, carteira digital, cartao e caixa fisico, com
  saldo calculado e opcao de nao compor o caixa disponivel.
- **Transferencias entre contas**, que deslocam saldo sem afetar a DRE.
- **Extrato por conta** com saldo corrido, saldo anterior e saldo final.
- **Exportacao CSV** (separador `;` e BOM UTF-8, abre direto no Excel pt-BR).

### Conciliacao bancaria
- Importacao de **OFX/QFX, XLSX, XLS, CSV e PDF**.
- **Deduplicacao** por assinatura do lancamento (ou FITID no OFX): reimportar o
  mesmo periodo nao duplica nada.
- **Sugestoes pontuadas** de vinculo, com os motivos visiveis ("valor identico",
  "mesma data de vencimento", "historico compativel").
- **Conciliacao automatica** dos casos obvios, com desempate manual.
- **Criar lancamento a partir do extrato** para o que nao existia no sistema
  (tarifa, imposto, venda avulsa) - ja nasce quitado e vinculado.
- **Ignorar** e **desfazer** com um clique.
- **Regras** de classificacao por texto, sentido e faixa de valor.

### Operacao
- **Vendas e compras** com itens, desconto por item, frete e parcelamento. Ao
  faturar, o pedido gera o financeiro e movimenta o estoque.
- **Produtos** com campos de TCG (jogo, colecao, numero, raridade, idioma,
  conservacao, foil) e calculo de margem e markup ao digitar.
- **Estoque** com entrada, saida, ajuste de inventario, alerta de reposicao e
  historico completo.
- **Clientes e fornecedores** com validacao real de CPF/CNPJ, endereco, limite
  de credito e visao consolidada de titulos e pedidos.

### Relatorios
- **DRE** por competencia (receita bruta, deducoes, CMV, lucro bruto, despesas
  operacionais, resultado financeiro, resultado liquido) com margens.
- **Fluxo de caixa** de 6 a 24 meses combinando realizado e previsto, com alerta
  de saldo projetado negativo.
- **Inadimplencia (aging)** em faixas de atraso e ranking por contato.
- **Curva ABC** de clientes ou produtos.
- **Resultado por categoria** com participacao percentual.

### Administracao
- Multiplas empresas (CNPJ) no mesmo login.
- Usuarios com papel **por empresa**.
- Log de auditoria de todas as acoes.
- Busca global sobre contatos, lancamentos, produtos e pedidos.

---

## Como rodar

Requisitos: **Node.js 20+**.

```bash
git clone <url-do-repositorio>
cd Tunico

npm install
cp .env.example .env          # ajuste o AUTH_SECRET
npm run setup                 # gera o client, cria o banco e popula a demo
npm run dev                   # http://localhost:3000
```

Gere uma chave de sessao antes do primeiro login:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Scripts disponiveis:

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao (roda `prisma generate` antes) |
| `npm start` | Servidor de producao |
| `npm run setup` | `prisma generate` + `db push` + `seed` |
| `npm run db:reset` | Recria o banco do zero e popula a demo |
| `npm run db:seed` | Popula a demo |
| `npm run typecheck` | Verificacao de tipos |
| `npm run test:parsers` | Testes dos parsers de extrato |

> Com o banco vazio, a tela de login oferece a criacao do primeiro
> administrador; em seguida o sistema pede o cadastro da primeira empresa. O
> cadastro publico e desligado automaticamente assim que existe um usuario.

---

## Acessos de demonstracao

Criados por `npm run db:seed` (dois CNPJs e oito meses de historico):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Proprietario | `admin@tunicotcg.com.br` | `Tunico@2025` |
| Financeiro | `financeiro@tunicotcg.com.br` | `Tunico@2025` |
| Operacional | `loja@tunicotcg.com.br` | `Tunico@2025` |

Altere `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no `.env` para mudar o acesso
principal. **Troque essas senhas antes de qualquer uso real.**

---

## Multi-CNPJ e isolamento de dados

O sistema pertence a Tunico TCG e opera quantos CNPJs forem necessarios no mesmo
login. Cada empresa tem plano de contas, contas bancarias, contatos, produtos,
estoque, lancamentos e extratos **proprios** - nada e compartilhado.

- A empresa ativa fica em um cookie e e resolvida no servidor a cada requisicao
  (`src/lib/tenant.ts`).
- **Toda** consulta filtra por `companyId`. Abrir a URL de um registro de outra
  empresa devolve 404, mesmo com o ID correto.
- O mesmo usuario pode ter papeis diferentes em cada empresa (Financeiro em uma,
  Consulta em outra).
- A troca de empresa fica no seletor no topo do menu lateral e em
  *Configuracoes &rsaquo; Empresas*.
- Uma nova empresa ja nasce com plano de contas, centros de custo, formas de
  pagamento e caixa padrao.

---

## Conciliacao bancaria

### Formatos aceitos

| Formato | Como e lido | Observacao |
| --- | --- | --- |
| **OFX / QFX** | Parser proprio para SGML (OFX 1.x) e XML (OFX 2.x), com deteccao de charset (UTF-8 x ISO-8859-1) | **Recomendado.** Traz FITID, o identificador oficial do lancamento |
| **XLSX / XLS / CSV** | SheetJS + deteccao automatica do cabecalho e mapeamento de colunas por sinonimos | Entende colunas separadas de debito e credito, e deduz as colunas quando nao ha cabecalho |
| **PDF** | Extracao de texto + heuristicas de linha | Sem estrutura padronizada: o sentido e deduzido pelo historico e o sistema avisa para conferir. PDF escaneado (imagem) nao pode ser lido |

Limite de 20 MB por arquivo.

O parser de planilha localiza a linha de cabecalho nas primeiras 25 linhas e
mapeia `data`, `historico`, `documento`, `valor` (ou `debito`/`credito`),
`saldo` e `tipo` por sinonimos. Linhas de subtotal e rodape sao descartadas por
nao conterem uma data valida.

O parser de PDF lida com o caso real mais chato: a extracao de texto costuma
perder o espaco entre as colunas, gerando linhas como
`03/07/2025PIX RECEBIDO JOAO DA SILVA1.250,006.250,00`. O parser separa data,
historico, valor e saldo mesmo assim.

### Deduplicacao

Cada lancamento recebe um hash SHA-1:

- **Com FITID** (OFX): `conta + FITID`.
- **Sem FITID**: `conta + data + valor + historico normalizado` (sem acentos,
  sem pontuacao, minusculo).

O hash e unico por conta no banco, entao a duplicidade e impossivel por
construcao - nao depende de o usuario lembrar o que ja importou.

### Pontuacao das sugestoes

Cada movimentacao pendente e comparada com os lancamentos em aberto do sentido
correspondente (entrada -> a receber, saida -> a pagar) numa janela de 60 dias:

| Criterio | Peso |
| --- | --- |
| Valor identico | 55 |
| Valor equivalente (ate 1% de diferenca) | 35 |
| Valor aproximado (ate 5%) | 18 |
| Proximidade da data (mesmo dia = 25, decaindo ate 0 em 30 dias) | 0 a 25 |
| Semelhanca do historico com a descricao ou o contato | 0 a 15 |
| Mesmo numero de documento | 5 |

Sugestoes abaixo de 40 pontos nao aparecem. A conciliacao automatica so age com
**85 pontos ou mais** e apenas quando existe **uma unica** sugestao nessa faixa
- havendo empate tecnico (diferenca de ate 5 pontos), a decisao fica com voce.

Ao conciliar, o sistema registra a baixa na conta do extrato, na data do
extrato. Se o valor do extrato for maior que o saldo devedor, a diferenca entra
como juros (recebimento) ou tarifa (pagamento); se for menor, gera baixa
parcial.

---

## Papeis e permissoes

O papel vale **por empresa**.

| Papel | Pode |
| --- | --- |
| **Proprietario** | Tudo, inclusive desativar a empresa e conceder o papel de proprietario |
| **Administrador** | Cadastros, financeiro, vendas, usuarios e configuracoes |
| **Financeiro** | Lancamentos, baixas, conciliacao e relatorios |
| **Operacional** | Vendas, compras, estoque e cadastros; ve o financeiro |
| **Consulta** | Somente leitura |

A protecao acontece em tres camadas:

1. **Middleware** - sem cookie de sessao, nem chega nas paginas internas.
2. **Servidor** - `requireContext()` / `requirePermission()` resolvem sessao,
   empresa e papel antes de renderizar; sem permissao, o usuario cai na tela de
   acesso negado.
3. **Server actions** - toda acao de escrita revalida a permissao. Esconder o
   botao nunca e a unica protecao.

---

## Como o dinheiro e calculado

Decisoes que valem conhecer antes de confiar nos numeros:

- **Valores** sao arredondados para 2 casas com `round2()` a cada operacao,
  evitando o classico `0.1 + 0.2`.
- **Datas** sao sempre UTC a meia-noite. Vencimento nao muda de dia por fuso.
- **Baixa**: o que abate o titulo e `valor pago + desconto - juros - multa`. Um
  titulo de R$ 100 quitado com R$ 95 e R$ 5 de desconto fica liquidado. Juros e
  multa entram no caixa mas nao abatem o principal; a tarifa sai do caixa sem
  mexer no titulo.
- **Status** e recalculado a partir das baixas, nunca escrito na mao. `OVERDUE`
  nao existe no banco: e derivado de `OPEN`/`PARTIAL` com vencimento passado.
- **Saldo da conta** = saldo inicial + recebimentos - pagamentos +
  transferencias recebidas - transferencias enviadas e tarifas.
- **DRE** usa regime de **competencia** (`competenceDate`) e o valor integral do
  lancamento, pago ou nao. Cancelados ficam de fora.
- **Fluxo de caixa** usa regime de **caixa**: meses passados pelo realizado
  (baixas), meses futuros pelo previsto (vencimentos em aberto). O acumulado
  parte do saldo atual e retroage para tras e projeta para frente.
- **Transferencias** nao aparecem na DRE - nao sao receita nem despesa.

---

## Arquitetura

```
prisma/
  schema.prisma          modelo de dados completo
  seed.ts                demo com 2 CNPJs e 8 meses de historico
src/
  app/
    (app)/               area autenticada (layout com menu e seletor de empresa)
      dashboard/         painel
      financeiro/[kind]/ contas a receber e a pagar (mesma implementacao)
      conciliacao/       conciliacao, importacao, historico e regras
      (orders)/[orderType]/ vendas e compras (mesma implementacao)
      produtos/ estoque/ contatos/
      relatorios/        DRE, fluxo de caixa, inadimplencia, ABC, categorias
      configuracoes/     empresas, plano de contas, usuarios, auditoria, perfil
    actions/             server actions (auth, finance, orders, registry, ...)
    api/export/          exportacao CSV
    login/ onboarding/   fluxo publico
  components/
    charts/              graficos (Recharts)
    layout/              shell, menu, seletor de empresa
    ui/                  primitivas, filtros, botao de impressao
  lib/
    auth.ts              sessao JWT em cookie httpOnly
    tenant.ts            resolucao de usuario + empresa ativa + permissoes
    permissions.ts       papeis e matriz de permissoes
    prisma.ts utils.ts validators.ts csv.ts constants.ts
  server/
    finance.ts           parcelas, baixas, saldos, recorrencias
    reconciliation.ts    importacao, pontuacao e acoes de conciliacao
    reports.ts           painel, fluxo de caixa, DRE, aging, ABC, extrato
    entry-query.ts       filtros das listagens
    defaults.ts          plano de contas padrao de uma nova empresa
    parsers/             ofx.ts, spreadsheet.ts, pdf.ts, amount.ts
  middleware.ts          barreira de sessao
tests/
  parsers.test.mts       45 verificacoes dos parsers
  fixtures/              extratos de exemplo (OFX, CSV, XLSX, PDF)
```

**Stack:** Next.js 15 (App Router, Server Components e Server Actions),
TypeScript, Tailwind CSS, Prisma, Recharts, SheetJS, `jose` + `bcryptjs`.

Sem estado global no cliente: as telas sao Server Components e as mutacoes sao
Server Actions com revalidacao. Os filtros vivem na URL, entao qualquer visao
filtrada e um link compartilhavel.

---

## Trocar a logo

A marca fica em `public/brand/`:

- `logo.svg` - logo completa (tela de login, README, cabecalhos)
- `icon.svg` - icone compacto (menu lateral e aba do navegador)

Para usar a arte oficial em bitmap, coloque o arquivo em `public/brand/` e
aponte para ele em `src/components/ui/logo.tsx` (dois `src`, um em `Logo` e
outro em `LogoMark`). Use uma imagem quadrada (1:1) de pelo menos 512x512 para
a logo e 128x128 para o icone.

---

## Ir para producao

1. **Banco**: troque o provider em `prisma/schema.prisma` para `postgresql` e
   aponte a `DATABASE_URL`. Nenhum tipo exclusivo do SQLite e usado, entao a
   migracao e direta:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

   Depois use migrations em vez de `db push`:

   ```bash
   npx prisma migrate dev --name inicial
   npx prisma migrate deploy   # no servidor
   ```

2. **AUTH_SECRET**: gere uma chave aleatoria de 48 bytes e nunca versione o
   `.env`.
3. **HTTPS**: os cookies ja sao `secure` quando `NODE_ENV=production`.
4. **Senhas**: troque as senhas de demonstracao e remova os usuarios de teste.
5. **Backup**: agende backup do banco - ele contem todo o historico financeiro.

---

## Testes

```bash
npm run test:parsers   # 45 verificacoes dos parsers de extrato
npm run typecheck      # verificacao de tipos
npm run build          # build completo
```

Os testes de parser cobrem valores em formato brasileiro e americano, sinais por
`D`/`C` e parenteses, datas em varios formatos, numero serial do Excel, OFX em
SGML, planilha com cabecalho deslocado e colunas de debito/credito separadas,
PDF com colunas coladas e as regras de deduplicacao. As fixtures em
`tests/fixtures/` sao arquivos reais, nao mocks.

---

<div align="center">
  <sub>TunicoTCG Control &middot; Tunico TCG</sub>
</div>
