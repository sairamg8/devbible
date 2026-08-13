#!/usr/bin/env bash
# ex7 — object vs Object vs {} vs the wrapper interfaces, and symbols.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
mkdir -p src-ex7
cat > src-ex7/three.ts <<'TS'
declare function lower(v: object): void;
declare function upper(v: Object): void;
declare function empty(v: {}): void;

lower({ a: 1 }); lower([1, 2]); lower(() => {});
lower('hello');            // ERROR
lower(42);                 // ERROR

upper('hello'); upper(42); // both fine — primitives autobox
empty('hello'); empty(42); // both fine
empty(null);               // ERROR

declare const o: object;
o.id;                      // ERROR: object carries no members

const s: String = 'hello';
const t: string = s;       // ERROR: String is not string
TS
$TSC --noEmit --strict --target es2022 src-ex7/three.ts; echo "exit=$?"
echo
echo "=== symbol and unique symbol ==="
cat > src-ex7/sym.ts <<'TS'
const KEY = Symbol('key');            // typeof KEY is `typeof KEY` (unique symbol)
let loose = Symbol('loose');          // widens to `symbol`

interface Registry { [KEY]: string }
const r: Registry = { [KEY]: 'ok' };

// a `let` symbol as a computed key: measured, NOT an error on 7.0.2
interface Maybe { [loose]: string }

// where it DOES bite: a plain `symbol` cannot be a type-position key in a type alias
type Alias = { [loose]: string };
TS
$TSC --noEmit --strict --target es2022 src-ex7/sym.ts; echo "exit=$?"
cat > src-ex7/symdecl.ts <<'TS'
export const KEY = Symbol('key');
export let loose = Symbol('loose');
TS
$TSC --declaration --emitDeclarationOnly --strict --target es2022 --outDir out-ex7 src-ex7/symdecl.ts && cat out-ex7/symdecl.d.ts
