#!/usr/bin/env bash
# ex3 — structural typing, excess property checks, and why a variable is
# accepted where an identical object literal is rejected.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex3
cat > src-ex3/structural.ts <<'TS'
interface Parcel { id: string; weightKg: number }

// never mentions Parcel, but has the right shape
class Crate {
  constructor(public id: string, public weightKg: number, public fragile = true) {}
}
const c: Parcel = new Crate('C-1', 3);        // fine: shapes match

function ship(p: Parcel) { return p.id; }

const extra = { id: 'P-1', weightKg: 2, express: true };
ship(extra);                                   // fine: a variable, extra prop ignored

ship({ id: 'P-2', weightKg: 2, express: true }); // ERROR: object literal

const widened: Parcel = extra;                 // fine
const direct: Parcel = { id: 'P-3', weightKg: 1, express: true }; // ERROR

ship({ id: 'P-4', weightKg: 2, express: true } as Parcel);  // silenced by assertion
TS
$TSC --noEmit --strict --target es2022 src-ex3/structural.ts; echo "exit=$?"
echo
echo "=== a typo in an optional property is caught only on the literal ==="
cat > src-ex3/typo.ts <<'TS'
interface Options { retries?: number; timeoutMs?: number }
function run(o: Options) { return o.retries ?? 0; }
interface Mixed { id: string; timeoutMs?: number }
function runMixed(o: Mixed) { return o.id; }

run({ timeoutMS: 500 });          // ERROR: literal, so the typo is caught
const opts = { timeoutMS: 500 };
run(opts);                        // ALSO errors — TS2559 weak type detection:
                                  // a type whose properties are ALL optional rejects
                                  // an object with no properties in common.
                                  // (Expected no error here; the measurement said otherwise.)
TS
cat >> src-ex3/typo.ts <<'TS'

// with one REQUIRED property the weak-type rule does not apply,
// so the same typo passes through a variable unnoticed
const m = { id: 'P-1', timeoutMS: 500 };
runMixed(m);
TS
$TSC --noEmit --strict --target es2022 src-ex3/typo.ts; echo "exit=$?"
