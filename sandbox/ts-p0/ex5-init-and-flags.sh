#!/usr/bin/env bash
# ex5 — `tsc --init` output, erasableSyntaxOnly, and @ts-check on plain JavaScript.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
rm -rf init-demo && mkdir -p init-demo && cd init-demo
echo "=== tsc --init ==="
node ../node_modules/typescript/bin/tsc --init >/dev/null 2>&1
grep -vE '^\s*(//|/\*|\*)' tsconfig.json | grep -v '^\s*$'
cd ..
echo; echo "=== --erasableSyntaxOnly on an enum ==="
printf 'enum Status { Pending }\nconsole.log(Status.Pending);\n' > src-ex2/justenum.ts
$TSC --noEmit --erasableSyntaxOnly --target es2022 src-ex2/justenum.ts; echo "exit=$?"
echo; echo "=== // @ts-check on a .js file ==="
mkdir -p src-ex5
cat > src-ex5/legacy.js <<'JS'
// @ts-check
/** @param {number} qty */
function total(qty) {
  return qty * 2;
}
console.log(total('three'));
JS
$TSC --noEmit --allowJs --checkJs --target es2022 src-ex5/legacy.js; echo "exit=$?"
echo "node runs it regardless:"; node src-ex5/legacy.js
