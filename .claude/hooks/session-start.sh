#!/usr/bin/env bash
# Prepara o ambiente do TunicoTCG Control em sessoes do Claude Code na web:
# instala dependencias, garante o .env, gera o Prisma Client e o banco de demo.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ ! -d node_modules ]; then
  echo "Instalando dependencias..."
  npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
fi

if [ ! -f .env ]; then
  cp .env.example .env
  # Chave de sessao aleatoria para o ambiente efemero.
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  node -e "
    const fs = require('fs');
    const content = fs.readFileSync('.env', 'utf8').replace(/^AUTH_SECRET=.*/m, 'AUTH_SECRET=\"$SECRET\"');
    fs.writeFileSync('.env', content);
  "
  echo ".env criado com AUTH_SECRET aleatorio."
fi

npx prisma generate >/dev/null 2>&1 || true

if [ ! -f prisma/dev.db ]; then
  echo "Criando banco de demonstracao..."
  npx prisma db push --skip-generate >/dev/null 2>&1
  npx tsx prisma/seed.ts >/dev/null 2>&1 || true
fi

echo "Ambiente pronto. npm run dev | npm run test:parsers | npm run typecheck"
