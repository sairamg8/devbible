#!/usr/bin/env bash
# ex2 — The constructs that EMIT code instead of vanishing, and how Node reacts.
set -u; cd "$(dirname "$0")"; TSC="node node_modules/typescript/bin/tsc"
rm -rf out-ex2 && mkdir -p src-ex2
cat > src-ex2/nonerasable.ts <<'TS'
enum Status { Pending, Shipped }

class Order {
  constructor(private readonly id: string, public total: number) {}
  describe(): string { return `${this.id}: ${this.total}`; }
}

const o = new Order('O-1', 4800);
console.log(Status.Pending, Status[0], o.describe());
TS
echo "=== emitted JavaScript for enum + parameter properties ==="
$TSC --target es2022 --module nodenext --outDir out-ex2 src-ex2/nonerasable.ts
cat out-ex2/nonerasable.js
echo "=== node runs the EMITTED js ==="
node out-ex2/nonerasable.js
echo "=== node runs the SOURCE .ts directly ==="
node src-ex2/nonerasable.ts 2>&1 | head -6
echo "=== each construct alone, straight to node ==="
for c in enum ns param; do
  case $c in
    enum) printf 'enum E { A }\nconsole.log(E.A);\n' > /tmp/ts-p0-$c.ts ;;
    ns)   printf 'namespace N { export const x = 1; }\nconsole.log(N.x);\n' > /tmp/ts-p0-$c.ts ;;
    param) printf 'class C { constructor(private x: number) {} }\nconsole.log(new C(1));\n' > /tmp/ts-p0-$c.ts ;;
  esac
  printf -- '--- %s ---\n' "$c"
  node /tmp/ts-p0-$c.ts 2>&1 | grep -E "SyntaxError|code:|^\{|^C " | head -2
done
