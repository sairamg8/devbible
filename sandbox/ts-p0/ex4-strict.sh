#!/usr/bin/env bash
# ex4 — what `strict` turns on.
# CORRECTED: the first version of this script used "no flag" as the loose baseline.
# That is wrong on TypeScript 7 — `strict` DEFAULTS TO TRUE there, so both sides
# were identical. The loose baseline must be an explicit `--strict false`.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
echo "=== declared default for --strict ==="
$TSC --help --all 2>&1 | grep -A4 -- "^--strict$" | head -4
echo "=== --strict false (the old default) ==="
$TSC --noEmit --strict false --target es2022 src-ex4/loose.ts; echo "exit=$?"
echo "=== default (strict on, TS 7) ==="
$TSC --noEmit --target es2022 src-ex4/loose.ts; echo "exit=$?"
echo "=== one sub-flag at a time, from the loose baseline ==="
for f in noImplicitAny strictNullChecks strictPropertyInitialization useUnknownInCatchVariables; do
  printf -- "--- --strict false --%s ---\n" "$f"
  $TSC --noEmit --strict false --$f --target es2022 src-ex4/loose.ts 2>&1 | head -3
done
