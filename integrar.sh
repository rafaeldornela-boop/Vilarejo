#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${1:-$(dirname "$PACKAGE_DIR")}" && pwd)"

for required in package.json index.html scripts/prepare_dist.js src/economy/vilarejo_economy.js src/newspaper/vilarejo_newspaper.js src/test/newspaper_test.js style.css; do
  if [[ ! -f "$PROJECT_ROOT/$required" ]]; then
    printf 'Arquivo obrigatório não encontrado: %s\n' "$PROJECT_ROOT/$required" >&2
    exit 1
  fi
done

if grep -q 'src/world/vilarejo_world_engine.js' "$PROJECT_ROOT/index.html"; then
  echo 'Mundo Vivo já aparece no index.html. Não vou reaplicar os patches.' >&2
  exit 1
fi

# Primeiro valida todos os patches. Nenhum arquivo do jogo é alterado antes disso.
(
  cd "$PROJECT_ROOT"
  git apply --check "$PACKAGE_DIR/patches/integracao-completa.patch"
)

mkdir -p "$PROJECT_ROOT/src/world"
cp "$PACKAGE_DIR/src/world/vilarejo_world_engine.js" "$PROJECT_ROOT/src/world/vilarejo_world_engine.js"
cp "$PACKAGE_DIR/src/test/world_engine_test.js" "$PROJECT_ROOT/src/test/world_engine_test.js"
cp "$PACKAGE_DIR/src/test/world_integration_test.js" "$PROJECT_ROOT/src/test/world_integration_test.js"

(
  cd "$PROJECT_ROOT"
  git apply "$PACKAGE_DIR/patches/integracao-completa.patch"
)

if ! grep -q 'world-live-dashboard' "$PROJECT_ROOT/style.css"; then
  printf '\n' >> "$PROJECT_ROOT/style.css"
  cat "$PACKAGE_DIR/patches/world-live.css" >> "$PROJECT_ROOT/style.css"
fi

node - "$PROJECT_ROOT/package.json" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.scripts ||= {};
const append = (name, commands) => {
  const existing = pkg.scripts[name] || '';
  const additions = commands.filter((command) => !existing.includes(command));
  pkg.scripts[name] = [existing, ...additions].filter(Boolean).join(' && ');
};
append('build', [
  'node --check src/world/vilarejo_world_engine.js',
  'node --check src/test/world_engine_test.js',
  'node --check src/test/world_integration_test.js'
]);
append('test', [
  'node src/test/world_engine_test.js',
  'node src/test/world_integration_test.js'
]);
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
NODE

echo 'Mundo Vivo integrado aos arquivos do projeto.'
echo 'Executando build e testes completos...'
if [[ "${SKIP_VALIDATION:-0}" != "1" ]]; then
  (cd "$PROJECT_ROOT" && npm run build && npm test)
else
  echo 'Validação automática ignorada por SKIP_VALIDATION=1.'
fi
