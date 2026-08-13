#!/usr/bin/env bash
# ex1 — typeof, truthiness, equality, `in`, instanceof: what each narrows to.
# Types are revealed by assigning to `1`, which forces the compiler to print them.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex1
cat > src-ex1/reveal.ts <<'TS'
declare const v: string | number | null | undefined | string[];

if (typeof v === 'string')  { const r: 1 = v; }
if (typeof v === 'number')  { const r: 1 = v; }
if (typeof v === 'object')  { const r: 1 = v; }   // object INCLUDES null
if (v)                      { const r: 1 = v; }   // truthiness drops '' and 0 too
if (v != null)              { const r: 1 = v; }
if (Array.isArray(v))       { const r: 1 = v; }
TS
$TSC --noEmit --strict --target es2022 src-ex1/reveal.ts; echo "exit=$?"
echo
echo "=== the falsy trap: '' and 0 are removed by truthiness ==="
cat > src-ex1/falsy.ts <<'TS'
declare const s: string | undefined;
declare const n: number | undefined;
function f(x: string | undefined) { return x; }
if (s) { f(s); }
if (n !== undefined) { const r: 1 = n; }
if (n) { const r: 1 = n; }
TS
$TSC --noEmit --strict --target es2022 src-ex1/falsy.ts; echo "exit=$?"
