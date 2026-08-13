---
title: "Erasure, and the syntax that survives it"
sidebar_label: "02 · Erasure"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0**. Emitted output
> below is byte-for-byte from `sandbox/ts-p0/ex1-erasure.sh` and
> `ex2-nonerasable.sh`.

**Most TypeScript syntax is deleted on the way to JavaScript. A short list of
constructs is not — they generate code. Knowing which is which explains
`enum`'s bad reputation, why Node rejects some `.ts` files, and what
`erasableSyntaxOnly` is for.**

## What erasure looks like

```ts
// src-ex1/shipping.ts — 15 lines
interface Parcel {
  id: string;
  weightKg: number;
  express?: boolean;
}

type Rate = { base: number; perKg: number };

function quote<T extends Parcel>(parcel: T, rate: Rate): number {
  const surcharge: number = parcel.express ? 500 : 0;
  return rate.base + parcel.weightKg * rate.perKg + surcharge;
}

const parcel = { id: 'P-1', weightKg: 2.5, express: true } satisfies Parcel;
console.log(quote(parcel, { base: 4000, perKg: 120 } as Rate));
```

```console
$ tsc --target es2022 --module nodenext --outDir out-ex1 src-ex1/shipping.ts
$ cat out-ex1/shipping.js
function quote(parcel, rate) {
    const surcharge = parcel.express ? 500 : 0;
    return rate.base + parcel.weightKg * rate.perKg + surcharge;
}
const parcel = { id: 'P-1', weightKg: 2.5, express: true };
console.log(quote(parcel, { base: 4000, perKg: 120 }));
export {};

$ node out-ex1/shipping.js
4800
```

15 lines in, 7 out. Deleted: `interface`, `type`, the generic `<T extends
Parcel>`, every `: Type` annotation, `satisfies Parcel`, and `as Rate`. Added:
`export {}`, a marker keeping the file a module.

**The runtime logic is untouched.** That is the guarantee erasure gives you and
the reason types cost nothing at runtime.

## The rule

> Erasable syntax describes values that already exist. Non-erasable syntax
> **creates** something that must exist at runtime.

An `interface` describes an object you built yourself, so it can vanish. An
`enum` has to produce an object with properties, so it cannot.

| Erasable — deleted | Non-erasable — emits JavaScript |
|---|---|
| `: Type` annotations, return types | `enum` (and `const enum`) |
| `interface`, `type` aliases | `namespace` containing runtime code |
| generics: `<T>`, `T extends U` | parameter properties: `constructor(private x: T)` |
| `as`, `satisfies`, non-null `!` | legacy `import x = require('y')` |
| `import type` / `export type` | experimental (legacy) decorators |
| `declare`, overload signatures | |

## What the non-erasable three actually emit

```ts
// src-ex2/nonerasable.ts
enum Status { Pending, Shipped }

class Order {
  constructor(private readonly id: string, public total: number) {}
  describe(): string { return `${this.id}: ${this.total}`; }
}

const o = new Order('O-1', 4800);
console.log(Status.Pending, Status[0], o.describe());
```

```console
$ tsc --target es2022 --module nodenext --outDir out-ex2 src-ex2/nonerasable.ts
$ cat out-ex2/nonerasable.js
var Status;
(function (Status) {
    Status[Status["Pending"] = 0] = "Pending";
    Status[Status["Shipped"] = 1] = "Shipped";
})(Status || (Status = {}));
class Order {
    id;
    total;
    constructor(id, total) {
        this.id = id;
        this.total = total;
    }
    describe() { return `${this.id}: ${this.total}`; }
}
const o = new Order('O-1', 4800);
console.log(Status.Pending, Status[0], o.describe());
export {};

$ node out-ex2/nonerasable.js
0 Pending O-1: 4800
```

Two things to read out of that output:

1. **The enum became an IIFE building a two-way map.** `Status[0]` returns
   `'Pending'` — the reverse mapping numeric enums generate. It is real code with
   a real object in memory, and it cannot be tree-shaken away by a bundler that
   cannot prove the IIFE is side-effect free.
2. **The parameter properties became field declarations plus assignments.** The
   compiler wrote `this.id = id` for you. `private` and `readonly` themselves are
   erased — they are compile-time only, so nothing stops JavaScript from reading
   `o.id` at runtime.

## Why this matters immediately: Node rejects the source

Node 24 runs `.ts` by stripping types. It cannot strip what it would have to
generate, so it refuses:

```console
$ node src-ex2/nonerasable.ts
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported
in strip-only mode
```

Each construct alone, straight to `node`:

```console
--- enum ---
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
  code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
--- namespace ---
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript namespace declaration is not supported in strip-only mode
  code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
--- parameter property ---
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode
  code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
```

The **same file compiled by `tsc` runs fine** — it is the direct-execution path
that rejects it. Which path your project uses therefore decides which syntax you
are allowed to write. Full treatment in
[04 · Strip-only mode and erasableSyntaxOnly](./04-strip-only-and-erasable-syntax.md).

## Writing the erasable version instead

Replace an `enum` with a `const` object plus a derived type:

```ts
const Status = { Pending: 'pending', Shipped: 'shipped' } as const;
type Status = (typeof Status)[keyof typeof Status];   // 'pending' | 'shipped'

const current: Status = Status.Shipped;
```

`as const` and `typeof`/`keyof` are all erasable, so the whole thing disappears
except the object literal you would have written anyway. You also gain string
values that are readable in a log line, instead of `0` and `1`.

Replace parameter properties with explicit fields:

```ts
class Order {
  readonly id: string;
  total: number;
  constructor(id: string, total: number) {
    this.id = id;
    this.total = total;
  }
}
```

More typing, and it runs everywhere. That is the whole trade.

## Trade-off

**`enum` and parameter properties are genuinely more concise.** Giving them up
costs a few lines per class and a slightly wordier constant declaration.

**What you buy:** the file runs under Node directly, under any transpiler, in any
bundler, with no transform configuration — and `import type` stays honest because
nothing you wrote depends on a code transform.

For a NestJS or TypeORM codebase already built on decorators and parameter
properties, this argument is settled the other way: you have a `tsc` build step,
so use the syntax.

## Gotchas

**Symptom:** `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` when running a `.ts` file
**Cause:** Non-erasable syntax — `enum`, runtime `namespace`, or a parameter
property.
**Fix:** Rewrite it as erasable syntax, or compile with `tsc` first. Turn on
`erasableSyntaxOnly` so the checker catches it instead of the runtime.

**Symptom:** A bundler keeps an `enum` you thought was unused
**Cause:** It emits an IIFE assigning to a `var`; that is not obviously
side-effect free, so tree-shaking leaves it.
**Fix:** `as const` object plus a derived type — a plain object literal shakes
cleanly.

**Symptom:** `private` fields are readable from JavaScript at runtime
**Cause:** `private` is a compile-time modifier and is erased.
**Fix:** Use `#private` fields, which are enforced by the runtime.

**Symptom:** `Status[0]` returns a string and you did not expect a reverse map
**Cause:** Numeric enums emit both directions; string enums do not.
**Fix:** Prefer string values, or the `as const` object pattern.

**Symptom:** Deleting an `import` broke a side effect
**Cause:** The import was type-only in effect, and got erased — or you removed a
value import the module relied on for its side effect.
**Fix:** Mark type imports explicitly with `import type` and keep side-effect
imports as bare `import './register.js'`. See `verbatimModuleSyntax` in Phase 6.

## Interview questions

**★ What is erasure, and what does TypeScript leave behind?**
Erasure is the deletion of everything that only describes types — annotations,
`interface`, `type`, generics, `as`, `satisfies`, `import type`. The emitted
JavaScript is the same program with those removed, so types cost nothing at
runtime. A short list of constructs is not erased because it must generate code:
`enum`, runtime `namespace`, parameter properties, legacy decorators and
`import = require`.

**★ Why do people advise against `enum`?**
It is the one type-ish construct that emits runtime code — an IIFE building a
two-way map for numeric enums — so it blocks direct execution under Node's
strip-only mode, resists tree-shaking, and behaves unlike every other type
construct. `const Status = {...} as const` plus a derived union gives you the
same call sites, erases cleanly, and produces readable values.

**★ Is `private` a runtime guarantee?**
No. `private` is erased, so the field is an ordinary property at runtime and any
JavaScript can read it. `#name` is the runtime-enforced form.

**Why does the compiler add `export {}` to some emitted files?**
It marks the file as a module. Without it, a file with no imports or exports
would be treated as a script sharing the global scope.

**Can you tell from the emitted JavaScript whether the source had types?**
Not usually — that is the point. Annotations leave no trace. The exceptions are
the non-erasable constructs, whose emitted shape (the enum IIFE, constructor
field assignments) is recognisable.

---

← Prev: [Checker, not a runtime](./01-static-checker-not-runtime.md) · Next → [The three ways to run TypeScript](./03-three-ways-to-run.md)
