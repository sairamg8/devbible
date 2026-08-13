#!/usr/bin/env bash
# ex2 — `in`, instanceof, type predicates, assertion functions, and the four
# ways a narrowing silently disappears.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex2
cat > src-ex2/guards.ts <<'TS'
type Cat = { name: string; meow(): void };
type Dog = { name: string; bark(): void };
declare const pet: Cat | Dog;

if ('meow' in pet) { const r: 1 = pet; }      // reveals Cat
else               { const r: 1 = pet; }      // reveals Dog

class ApiError extends Error { constructor(public status: number) { super(); } }
declare const e: unknown;
if (e instanceof ApiError) { const r: 1 = e; }
if (e instanceof Error)    { const r: 1 = e; }

function isCat(p: Cat | Dog): p is Cat { return 'meow' in p; }
if (isCat(pet)) { const r: 1 = pet; }

function assertString(v: unknown): asserts v is string {
  if (typeof v !== 'string') throw new Error('not a string');
}
declare const u: unknown;
assertString(u);
const r2: 1 = u;                               // reveals string AFTER the assertion
TS
$TSC --noEmit --strict --target es2022 src-ex2/guards.ts; echo "exit=$?"
echo
echo "=== where narrowing disappears ==="
cat > src-ex2/loss.ts <<'TS'
type Order = { shippedAt: Date | null; items: string[] };
declare const order: Order;
declare function save(o: Order): Promise<void>;

async function afterAwait() {
  if (order.shippedAt !== null) {
    await save(order);
    order.shippedAt.getTime();       // LOST
  }
}

function inCallback() {
  if (order.shippedAt !== null) {
    order.items.forEach(() => {
      order.shippedAt.getTime();     // LOST
    });
  }
}

function withConst() {
  const shippedAt = order.shippedAt;
  if (shippedAt !== null) {
    order.items.forEach(() => shippedAt.getTime());   // kept
  }
}

function reassigned(v: string | number) {
  if (typeof v === 'string') {
    v = 42;
    const r: 1 = v;                  // reveals what it is now
  }
}
TS
$TSC --noEmit --strict --target es2022 src-ex2/loss.ts; echo "exit=$?"
