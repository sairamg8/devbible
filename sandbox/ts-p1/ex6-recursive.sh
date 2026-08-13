#!/usr/bin/env bash
# ex6 — recursive type aliases: what works, and the two ways they fail.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex6
cat > src-ex6/json.ts <<'TS'
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const payload: JsonValue = { id: 'O-1', total: 4800, items: [{ sku: 'a', qty: 2 }], note: null };

type MenuItem = { label: string; href?: string; items?: MenuItem[] };
const menu: MenuItem = { label: 'Root', items: [{ label: 'Child', href: '/c' }] };

function sizeOf(v: JsonValue): number {
  if (v === null || typeof v !== 'object') return 1;
  if (Array.isArray(v)) return v.reduce<number>((n, x) => n + sizeOf(x), 0);
  return Object.values(v).reduce<number>((n, x) => n + sizeOf(x), 0);
}
console.log(payload, menu, sizeOf(payload));
TS
echo "=== valid recursive types ==="
$TSC --noEmit --strict --target es2022 src-ex6/json.ts; echo "exit=$?"
echo
echo "=== depth limit ==="
cat > src-ex6/deep.ts <<'TS'
// 50 is fine on 7.0.2; push until the limit actually bites
type Deep<N extends number[], Stop extends number> = N['length'] extends Stop ? true : Deep<[...N, 0], Stop>;
type A = Deep<[], 50>;
type B = Deep<[], 500>;
type C = Deep<[], 5000>;
declare const a: A; declare const b: B; declare const c: C;
TS
$TSC --noEmit --strict --target es2022 src-ex6/deep.ts; echo "exit=$?"
echo
echo "=== circular alias not deferred by a property ==="
cat > src-ex6/circular.ts <<'TS'
type Worse = Worse & { a: 1 };
declare const w: Worse;
TS
$TSC --noEmit --strict --target es2022 src-ex6/circular.ts; echo "exit=$?"
echo
echo "=== interface vs alias against an index signature ==="
cat > src-ex6/iface.ts <<'TS'
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
interface IOrder { id: string; total: number }
type TOrder = { id: string; total: number };
declare const i: IOrder;
declare const t: TOrder;
const a: JsonValue = i;
const b: JsonValue = t;
TS
$TSC --noEmit --strict --target es2022 src-ex6/iface.ts; echo "exit=$?"
