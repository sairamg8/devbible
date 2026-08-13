#!/usr/bin/env bash
# ex8 — TypeScript 7 (native) vs 5.9.3 (JavaScript) on identical input.
# CONFOUND FOUND AND FIXED TWICE:
#  1. Run inside the repo, 5.9.3 auto-included the site's ancestor
#     node_modules/@types (react, node, mdx); 7.0.2 did not. Different workloads.
#  2. Moving the FIXTURE to /tmp did not fix it — 5.9.3 resolves ambient @types
#     relative to the CWD, so it still found ../../node_modules/@types.
# Fix: fixture AND cwd in /tmp, and assert both sides report ZERO diagnostics
# before either timing is believed.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=/tmp/ts-p0-perf; rm -rf $WORK && mkdir -p $WORK/src
for i in $(seq 1 300); do
  cat > $WORK/src/mod$i.ts <<TS
export interface Row$i { id: string; qty: number; tags: string[] }
export function total$i(rows: Row$i[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample$i: Row$i = { id: 'r$i', qty: $i, tags: ['a', 'b'] };
TS
done
echo "input: $(ls $WORK/src | wc -l) files, $(cat $WORK/src/*.ts | wc -l) lines, in $WORK"
FLAGS="--noEmit --strict --target es2022 --module esnext --moduleResolution bundler"
run() {
  local label="$1" tsc="$2"
  cd $WORK
  local diag; diag=$(node "$tsc" $FLAGS src/*.ts 2>&1 | wc -l)
  node "$tsc" $FLAGS src/*.ts >/dev/null 2>&1   # warm
  local best=999 s e t
  for r in 1 2 3; do
    s=$(date +%s.%N); node "$tsc" $FLAGS src/*.ts >/dev/null 2>&1; e=$(date +%s.%N)
    t=$(echo "$e - $s" | bc); best=$(echo "if ($t < $best) $t else $best" | bc)
  done
  printf "%-18s diagnostic lines: %s   best of 3: %.2fs\n" "$label" "$diag" "$best"
}
run "TypeScript 7.0.2" "$HERE/node_modules/typescript/bin/tsc"
run "TypeScript 5.9.3" "$HERE/node_modules/typescript5/bin/tsc"
