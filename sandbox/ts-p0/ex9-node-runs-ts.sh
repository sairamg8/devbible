#!/usr/bin/env bash
# ex9 — Node 24 executing TypeScript source directly, and refusing to check it.
set -u; cd "$(dirname "$0")"; mkdir -p src-ex9
cat > src-ex9/quote.ts <<'TS'
interface Parcel { id: string; weightKg: number }

function quote(p: Parcel, perKg: number): number {
  return Math.round(p.weightKg * perKg);
}

const parcel: Parcel = { id: 'P-1', weightKg: 2.5 };
console.log('quote:', quote(parcel, 120));
TS
echo "=== node --version ==="; node --version
echo "=== node src-ex9/quote.ts (no flag, no tsconfig, no tsc) ==="
node src-ex9/quote.ts; echo "exit=$?"
cat > src-ex9/lying.ts <<'TS'
const weight: number = "heavy";
console.log('node does not care:', weight.toUpperCase());
TS
echo "=== a file whose types are nonsense ==="
node src-ex9/lying.ts; echo "exit=$?"
echo "=== the same file, checked ==="
node node_modules/typescript/bin/tsc --noEmit src-ex9/lying.ts; echo "exit=$?"
