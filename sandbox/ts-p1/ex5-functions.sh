#!/usr/bin/env bash
# ex5 — function types: parameters, optional/default/rest, overloads, and the
# assignability rules that surprise people (fewer params, void returns).
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex5
cat > src-ex5/fns.ts <<'TS'
type Formatter = (value: number, currency: string) => string;

const f1: Formatter = (v, c) => `${c}${v}`;      // params inferred contextually
const f2: Formatter = (v) => `${v}`;             // FEWER params: allowed
const f3: Formatter = (v, c, extra) => `${v}`;   // MORE params: error

type Handler = () => void;
const h: Handler = () => 42;                     // returning a value into void: allowed

declare function each<T>(xs: T[], cb: (x: T) => void): void;
each([1, 2], (x) => x.toFixed(2));               // cb returns string into void: allowed
TS
$TSC --noEmit --strict --target es2022 src-ex5/fns.ts; echo "exit=$?"
echo
echo "=== overloads: implementation signature is not callable ==="
cat > src-ex5/overload.ts <<'TS'
function parse(input: string): string[];
function parse(input: string, limit: number): string[];
function parse(input: string, limit?: number): string[] {
  const parts = input.split(',');
  return limit === undefined ? parts : parts.slice(0, limit);
}
parse('a,b,c');
parse('a,b,c', 2);
parse('a,b,c', 2, true);
TS
$TSC --noEmit --strict --target es2022 src-ex5/overload.ts; echo "exit=$?"
echo
echo "=== inferred signature with optional/default/rest ==="
cat > src-ex5/sig.ts <<'TS'
export function send(to: string, subject = 'none', ...cc: string[]) {
  return { to, subject, cc };
}
TS
rm -rf out-ex5 && $TSC --declaration --emitDeclarationOnly --strict --target es2022 --outDir out-ex5 src-ex5/sig.ts && cat out-ex5/sig.d.ts
