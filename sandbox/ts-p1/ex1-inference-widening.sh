#!/usr/bin/env bash
# ex1 — what the compiler INFERS. Emit .d.ts and read the types back out of it:
# the only way to show an inferred type without trusting a hover tooltip.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
rm -rf out-ex1 && mkdir -p src-ex1
cat > src-ex1/infer.ts <<'TS'
export let mutableCity = 'Hyderabad';
export const constCity = 'Hyderabad';

export const rates = { standard: 120, express: 260 };
export const frozen = { standard: 120, express: 260 } as const;

export const mixed = [1, 'two', true];
export const tupleish = [1, 'two'] as const;

export const nested = { a: { b: [1, 2] } };

export function quote(weight: number, express = false) {
  return express ? weight * 260 : weight * 120;
}

export const maybe = Math.random() > 0.5 ? 'yes' : null;
TS
$TSC --declaration --emitDeclarationOnly --strict --target es2022 --outDir out-ex1 src-ex1/infer.ts
echo "=== what the compiler inferred (out-ex1/infer.d.ts) ==="
cat out-ex1/infer.d.ts
