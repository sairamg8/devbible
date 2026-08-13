---
title: "Strip-only mode and erasableSyntaxOnly"
sidebar_label: "04 · Strip-only and erasableSyntaxOnly"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** and **TypeScript 7.0.2**. Console output
> from `sandbox/ts-p0/ex2-nonerasable.sh` and `ex5-init-and-flags.sh`.

**Node runs TypeScript by deleting types, never by transforming code. Syntax that
needs a transform is rejected at parse time — as a runtime crash, unless you make
the compiler catch it first.** `erasableSyntaxOnly` is that switch, and it is the
single most valuable flag in a project that runs `.ts` directly.

## The failure it prevents

```ts
// one line, and the process will not start
enum Status { Pending }
console.log(Status.Pending);
```

```console
$ node justenum.ts
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
  code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
```

This is a **`SyntaxError` at load**, not a type error and not a runtime
exception you can catch. The module never evaluates. In a service, that is a
container that will not boot.

The complete rejected set, each measured on its own:

```console
--- enum ---
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
--- namespace ---
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript namespace declaration is not supported in strip-only mode
--- parameter property ---
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode
```

Note how specific the messages are — the runtime names the exact construct, which
makes this one of the easier errors to act on.

## Why stripping cannot handle them

Type stripping replaces annotations **with whitespace**. Nothing moves; every
character keeps its position, which is why stack traces stay accurate without a
source map. That design is what forbids the rest: an `enum` would have to
*generate* an IIFE, a parameter property would have to *insert* `this.id = id`
into the constructor body. Both are transforms, not deletions
([02 · Erasure](./02-erasure.md) shows the emitted code).

So the boundary is not arbitrary. **If removing the syntax changes what the
program does, stripping cannot be correct**, and Node refuses rather than
guessing.

## `erasableSyntaxOnly`: move the failure to check time

```json
{
  "compilerOptions": {
    "erasableSyntaxOnly": true
  }
}
```

```console
$ tsc --noEmit --erasableSyntaxOnly src-ex2/justenum.ts
src-ex2/justenum.ts(1,6): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
exit=1
```

`error TS1294`, at the exact column, in CI, before merge — instead of
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` in production. It is confirmed present in
7.0.2 (`tsc --help --all | grep erasableSyntaxOnly`) and defaults to **`false`**,
so you must turn it on.

**Turn it on if anything at all runs `.ts` directly** — the service, a script, a
test runner, a migration. It costs nothing when the code is already erasable and
is the only mechanical guarantee that it stays that way as the team grows.

## The escape hatch, and why it is a step backwards

```console
$ node --experimental-transform-types enums.ts
(node:235167) ExperimentalWarning: Transform Types is an experimental feature and
might change at any time
0
```

It works. It also opts you out of the stable, no-flag path that made running
`.ts` attractive, re-introduces a transform (so positions shift and source maps
matter again), and prints a warning on every start.

**Rewriting the syntax is almost always cheaper than keeping the flag.**

## Rewriting each construct

**`enum` → `as const` object plus a derived union**

```ts
const Status = { Pending: 'pending', Shipped: 'shipped' } as const;
type Status = (typeof Status)[keyof typeof Status];   // 'pending' | 'shipped'

function advance(s: Status): Status {
  return s === Status.Pending ? Status.Shipped : s;
}
```

Call sites (`Status.Pending`) are unchanged, the values are readable in logs, and
the union is narrower and more useful than an enum member type.

**Parameter properties → explicit fields**

```ts
class OrderService {
  private readonly repo: OrderRepo;
  constructor(repo: OrderRepo) {
    this.repo = repo;
  }
}
```

Four lines instead of one. This is the change most likely to annoy a NestJS
codebase, and the reason such codebases keep a `tsc` build.

**`namespace` → modules.** A namespace containing runtime code is pre-module
TypeScript; the replacement is an ordinary ESM module. A `declare namespace` in a
`.d.ts` is type-only and erases fine.

## Trade-off

**With `erasableSyntaxOnly`:** every file runs anywhere — Node directly,
esbuild, swc, any bundler, no transform config. You give up four constructs, one
of which (`enum`) most style guides already discourage.

**Without it:** you keep the full syntax and accept a compile step everywhere,
forever, including for tests and scripts.

The decision is per project, and it is really the same decision as
[03 · The three ways to run TypeScript](./03-three-ways-to-run.md): direct
execution and non-erasable syntax are mutually exclusive.

## Gotchas

**Symptom:** `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` only in production
**Cause:** Locally you run a compiled build or a transform-capable runner;
production runs the source directly.
**Fix:** Make the two paths the same, and turn on `erasableSyntaxOnly` so the
difference cannot exist.

**Symptom:** A dependency's types are fine but its source breaks stripping
**Cause:** Node refuses to strip types inside `node_modules` at all.
**Fix:** Nothing from the consuming side — the package must publish `.js` plus
`.d.ts`.

**Symptom:** `error TS1294` appears after enabling the flag on an old codebase
**Cause:** Existing `enum`s and parameter properties.
**Fix:** Convert them (patterns above). If the volume is large, do it per
directory rather than in one commit.

**Symptom:** `declare enum` or `const enum` still errors
**Cause:** `const enum` inlines values at call sites — a transform — so it is
also non-erasable, and it additionally breaks under `isolatedModules`.
**Fix:** The `as const` object pattern. Do not reach for `preserveConstEnums`.

**Symptom:** Decorators fail under direct execution
**Cause:** They emit code and are not covered by stripping.
**Fix:** Compile with `tsc`, or design without them.

## Interview questions

**★ What is strip-only mode, and what does it forbid?**
It is how Node executes TypeScript: annotations are replaced with whitespace and
the remaining JavaScript runs. It forbids anything that must *generate* code —
`enum`, runtime `namespace`, parameter properties, legacy `import = require` and
decorators — because those need a transform, not a deletion. Violations are
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at load.

**★ What does `erasableSyntaxOnly` do, and when would you enable it?**
It makes `tsc` reject non-erasable syntax with `error TS1294`, converting a
production `SyntaxError` into a check-time failure. Enable it whenever anything
runs `.ts` directly — server, scripts, or tests.

**★ Why does Node replace annotations with whitespace rather than removing them?**
To preserve every character position, so line and column numbers in stack traces
match the original file without a source map. It also makes stripping a purely
local, per-file operation, which is what keeps it fast enough to do at startup.

**How do you replace an `enum` without changing call sites?**
`const Status = { Pending: 'pending' } as const;` plus
`type Status = (typeof Status)[keyof typeof Status];`. `Status.Pending` still
works, the type is a string-literal union, and everything erases.

**Is `const enum` erasable, since it disappears?**
No. It disappears by *inlining* its values into every call site, which is a
transform, and it is also incompatible with `isolatedModules` and single-file
transpilers. Use the `as const` object.

---

← Prev: [The three ways to run TypeScript](./03-three-ways-to-run.md) · Next → [`strict` and the flags it turns on](./05-strict.md)
