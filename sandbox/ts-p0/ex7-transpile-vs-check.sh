#!/usr/bin/env bash
# ex7 — a transpiler is not a checker. esbuild emits nonsense happily; tsc refuses.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
ESB="node node_modules/esbuild/bin/esbuild"
mkdir -p src-ex7
cat > src-ex7/bad.ts <<'TS'
interface Cart { items: string[]; total: number }
const cart: Cart = { items: ['sku-1'], total: 'four thousand' };
console.log(cart.total.toFixed(2));
TS
echo "=== esbuild ==="; $ESB --version
$ESB src-ex7/bad.ts --format=esm 2>&1; echo "esbuild exit=$?"
echo; echo "=== the same file, tsc --noEmit ==="
$TSC --noEmit --target es2022 src-ex7/bad.ts; echo "tsc exit=$?"
echo; echo "=== what the esbuild output does at runtime ==="
$ESB src-ex7/bad.ts --format=esm --outfile=src-ex7/bad.mjs >/dev/null 2>&1
node src-ex7/bad.mjs 2>&1 | head -3
