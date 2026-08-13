#!/usr/bin/env bash
# ex3 — tsc emits broken JavaScript by default. --noEmitOnError is what stops it.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
rm -rf out-ex3 && mkdir -p src-ex3
cat > src-ex3/broken.ts <<'TS'
const port: number = "8080";
console.log('port + 1 =', port + 1);
TS
echo "=== tsc (default): reports the error AND writes the file ==="
$TSC --target es2022 --outDir out-ex3 src-ex3/broken.ts; echo "tsc exit=$?"
ls out-ex3/ 2>/dev/null && echo "--- emitted anyway ---" && cat out-ex3/broken.js
echo "=== and the emitted JS runs, wrongly ==="
node out-ex3/broken.js
echo "=== --noEmitOnError ==="
rm -rf out-ex3
$TSC --target es2022 --noEmitOnError --outDir out-ex3 src-ex3/broken.ts; echo "tsc exit=$?"
echo "files emitted: $(ls out-ex3 2>/dev/null | wc -l)"
echo "=== --noEmit (check only) ==="
$TSC --noEmit src-ex3/broken.ts; echo "tsc exit=$?"
echo "=== and node runs the .ts source with no complaint at all ==="
node src-ex3/broken.ts
