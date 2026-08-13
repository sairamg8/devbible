#!/usr/bin/env bash
# ex4 — what `strict` actually turns on: the same file, checked both ways.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex4
cat > src-ex4/loose.ts <<'TS'
function findUser(id) {
  return id === 1 ? { name: 'Asha' } : null;
}

const user = findUser(1);
console.log(user.name.toUpperCase());

class Session {
  token: string;
  start() { this.token = 'abc'; }
}

try { start(); } catch (err) { console.log(err.message); }
function start() { throw new Error('nope'); }
TS
echo "=== tsc --noEmit (no strict) ==="
$TSC --noEmit --target es2022 src-ex4/loose.ts; echo "exit=$?"
echo
echo "=== tsc --noEmit --strict ==="
$TSC --noEmit --strict --target es2022 src-ex4/loose.ts; echo "exit=$?"
echo
echo "=== which sub-flag produces which error ==="
for f in noImplicitAny strictNullChecks strictPropertyInitialization useUnknownInCatchVariables; do
  printf -- "--- --%s ---\n" "$f"
  $TSC --noEmit --target es2022 --$f src-ex4/loose.ts 2>&1 | head -3
done
