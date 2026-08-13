#!/usr/bin/env bash
# ex4 — type vs interface: merging, unions, and how the two differ in errors.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex4
cat > src-ex4/merge.ts <<'TS'
interface Box { width: number }
interface Box { height: number }        // merges
const b: Box = { width: 1, height: 2 };
const missing: Box = { width: 1 };      // ERROR: height missing — proves the merge

type TBox = { width: number };
type TBox = { height: number };         // ERROR: duplicate identifier
TS
$TSC --noEmit --strict --target es2022 src-ex4/merge.ts; echo "exit=$?"
echo
echo "=== a type alias can be a union; an interface cannot ==="
cat > src-ex4/union.ts <<'TS'
type Id = string | number;              // fine
interface IId extends Id {}             // ERROR
TS
$TSC --noEmit --strict --target es2022 src-ex4/union.ts; echo "exit=$?"
echo
echo "=== error message shape: alias name vs expanded shape ==="
cat > src-ex4/errshape.ts <<'TS'
interface IParcel { id: string; weightKg: number }
type TParcel = { id: string; weightKg: number };
declare function shipI(p: IParcel): void;
declare function shipT(p: TParcel): void;
shipI({ id: 'a' });
shipT({ id: 'a' });
TS
$TSC --noEmit --strict --target es2022 src-ex4/errshape.ts; echo "exit=$?"
