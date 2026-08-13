#!/usr/bin/env bash
# ex1 — What erasure actually deletes. Emit JS from a TS file and diff the shapes.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
rm -rf out-ex1 && mkdir -p src-ex1
cat > src-ex1/shipping.ts <<'TS'
interface Parcel {
  id: string;
  weightKg: number;
  express?: boolean;
}

type Rate = { base: number; perKg: number };

function quote<T extends Parcel>(parcel: T, rate: Rate): number {
  const surcharge: number = parcel.express ? 500 : 0;
  return rate.base + parcel.weightKg * rate.perKg + surcharge;
}

const parcel = { id: 'P-1', weightKg: 2.5, express: true } satisfies Parcel;
console.log(quote(parcel, { base: 4000, perKg: 120 } as Rate));
TS
echo "=== input: src-ex1/shipping.ts ($(wc -l < src-ex1/shipping.ts) lines) ==="
$TSC --target es2022 --module nodenext --outDir out-ex1 src-ex1/shipping.ts
echo "=== emitted: out-ex1/shipping.js ($(wc -l < out-ex1/shipping.js) lines) ==="
cat out-ex1/shipping.js
echo "=== it runs ==="
node out-ex1/shipping.js
