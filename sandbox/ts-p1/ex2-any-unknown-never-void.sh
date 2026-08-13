#!/usr/bin/env bash
# ex2 — the four that get confused: any, unknown, never, void.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex2
cat > src-ex2/four.ts <<'TS'
declare const a: any;
declare const u: unknown;

a.whatever.deeply.nested();      // no error: any disables checking
const n1: number = a;            // no error: any flows anywhere

u.toUpperCase();                 // error: must narrow first
const n2: number = u;            // error: unknown assigns to nothing

if (typeof u === 'string') {
  u.toUpperCase();               // fine once narrowed
}

function fail(msg: string): never {
  throw new Error(msg);
}
const nv: never = fail('x');
const s: string = fail('x');     // never assigns TO everything

function log(): void { }
const v = log();
const bad: number = v;           // void assigns to nothing useful
TS
echo "=== tsc --strict ==="
$TSC --noEmit --strict --target es2022 src-ex2/four.ts; echo "exit=$?"
echo
echo "=== never as the empty union: what does a narrowed-away value become? ==="
cat > src-ex2/exhaust.ts <<'TS'
type Status = 'pending' | 'shipped' | 'cancelled';
declare const s: Status;

// all three handled: the else branch holds `never`, which assigns to anything
function complete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {} else if (x === 'cancelled') {}
  else { const impossible: 1 = x; }
}

// one branch missing: the leftover type is named in the error
function incomplete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {}
  else { const impossible: 1 = x; }
}
TS
$TSC --noEmit --strict --target es2022 src-ex2/exhaust.ts; echo "exit=$?"
