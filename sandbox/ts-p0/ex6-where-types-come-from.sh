#!/usr/bin/env bash
# ex6 — the three places a type can come from, and the error when there is none.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
rm -rf types-demo && mkdir -p types-demo/node_modules/untyped-lib types-demo/src
cd types-demo
printf '{"name":"untyped-lib","version":"1.0.0","main":"index.js"}' > node_modules/untyped-lib/package.json
printf 'exports.shout = (s) => s.toUpperCase();\n' > node_modules/untyped-lib/index.js
printf '{"name":"types-demo","private":true}' > package.json
cat > src/app.ts <<'TS'
import { shout } from 'untyped-lib';
console.log(shout('hello'));
TS
TSC7="node ../node_modules/typescript/bin/tsc"
echo "=== no declaration file anywhere ==="
$TSC7 --noEmit --module nodenext --target es2022 src/app.ts; echo "exit=$?"
echo; echo "=== after adding a local ambient declaration ==="
printf "declare module 'untyped-lib' {\n  export function shout(s: string): string;\n}\n" > src/untyped-lib.d.ts
$TSC7 --noEmit --module nodenext --target es2022 src/app.ts src/untyped-lib.d.ts; echo "exit=$?"
echo; echo "=== the declaration is a promise, not a check: wrong arg type is now caught ==="
printf "import { shout } from 'untyped-lib';\nconsole.log(shout(42));\n" > src/wrong.ts
$TSC7 --noEmit --module nodenext --target es2022 src/wrong.ts src/untyped-lib.d.ts; echo "exit=$?"
