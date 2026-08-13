---
title: "`enum` vs union vs `const` object"
sidebar_label: "13 · enum vs union"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0**. Emitted
> JavaScript and the runtime failures come from
> `sandbox/ts-p0/ex2-nonerasable.sh`.

**Three ways to model a fixed set of values. Two of them erase completely; `enum`
is the one that emits runtime code, and that single fact drives every argument
about it.**

## The three

```ts
// 1 — enum
enum Status { Pending, Shipped }

// 2 — union of string literals
type Status2 = 'pending' | 'shipped';

// 3 — const object plus a derived union
const Status3 = { Pending: 'pending', Shipped: 'shipped' } as const;
type Status3 = (typeof Status3)[keyof typeof Status3];
```

## What `enum` compiles to

```console
$ tsc --target es2022 --module nodenext --outDir out-ex2 src-ex2/nonerasable.ts
$ cat out-ex2/nonerasable.js
var Status;
(function (Status) {
    Status[Status["Pending"] = 0] = "Pending";
    Status[Status["Shipped"] = 1] = "Shipped";
})(Status || (Status = {}));
```

An IIFE building a **two-way map**: `Status.Pending` is `0` and `Status[0]` is
`'Pending'`. Real code, real object, in every bundle.

Consequences, in order of how often they bite:

1. **It cannot be stripped.** Running the source directly fails:
   ```console
   $ node src-ex2/nonerasable.ts
   SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
   ```
   Which is why `erasableSyntaxOnly` rejects it at check time
   ([Phase 0](../phase-0-how-typescript-runs/04-strip-only-and-erasable-syntax.md)).
2. **It resists tree-shaking.** An assignment inside an IIFE is not obviously
   side-effect free, so bundlers keep it.
3. **Numeric enums log as numbers.** `console.log(status)` prints `0`, not
   `pending` — in your logs, your database, and your API responses.
4. **Numeric enums accept arbitrary numbers** in older TypeScript versions and
   still accept any member of the same enum, so the type is weaker than it looks.

## What the alternatives compile to

The union: **nothing**. It is purely a type.

The `const` object: the object literal you wrote, and nothing else — it
tree-shakes and strips cleanly.

## Choosing

| | `enum` | Union of literals | `const` object + union |
|---|---|---|---|
| Runtime code | **yes** | none | just the object |
| Runs under strip-only | **no** | yes | yes |
| Iterate the values at runtime | yes | **no** | yes |
| Autocomplete on a named constant | yes | no (values only) | yes |
| Log/serialise readably | numeric: no | yes | yes |
| Exhaustiveness checking | yes | yes | yes |

**The default should be the union of string literals.** It is the smallest thing
that works, it serialises readably, and it needs no import at the use site:

```ts
function label(s: Status2) { … }
label('pending');
```

**Reach for the `const` object when you need the values at runtime** — iterating
for a dropdown, validating an input, or wanting `Status.Pending` rather than a
bare string at call sites:

```ts
const STATUSES = ['pending', 'shipped', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

for (const s of STATUSES) { … }          // runtime iteration
function set(s: Status) { … }             // compile-time checking
```

One declaration, both halves derived from it — no list to keep in step with a
type ([02 · Literal types](./02-literal-types-and-as-const.md)).

## When `enum` is still reasonable

- A codebase already built on them, with a `tsc` build step. Migrating for its
  own sake is not worth a large diff.
- A framework that expects them — some NestJS and TypeORM patterns.
- Interop with a numeric protocol where the numbers are the contract, and even
  then a `const` object of numbers does the same job.

If you keep them, prefer **string enums** — `enum Status { Pending = 'pending' }`
— which log readably and have no reverse map.

**`const enum` is the worst option**: it inlines values at call sites, which is a
transform, so it breaks under `isolatedModules` and every single-file
transpiler ([Phase 0 · Checking vs transpiling](../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)).

## Migrating off `enum`

```ts
// before
enum Status { Pending = 'pending', Shipped = 'shipped' }

// after — call sites unchanged
const Status = { Pending: 'pending', Shipped: 'shipped' } as const;
type Status = (typeof Status)[keyof typeof Status];
```

Declaring a `const` and a `type` with the same name is legal and deliberate —
TypeScript keeps value and type namespaces separate, so `Status.Pending` (value)
and `s: Status` (type) both work exactly as before. In most codebases the change
is invisible to consumers.

## Trade-off

**Union of literals:** zero runtime cost, readable values, no import needed. You
cannot enumerate the members at runtime, and there is no named constant to
autocomplete.

**`const` object:** everything the union has, plus runtime iteration and named
constants, at the cost of two lines and a value import.

**`enum`:** named constants and runtime iteration built in, at the cost of
emitted code, no strip-only execution, worse tree-shaking, and numeric values in
your logs.

## Gotchas

**Symptom:** `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript enum is not supported
in strip-only mode`
**Cause:** `enum` emits code, so Node cannot strip it.
**Fix:** Migrate to a `const` object, or compile with `tsc`.

**Symptom:** A status appears as `0` in logs or a database
**Cause:** Numeric enum members are numbers at runtime.
**Fix:** String enum values, or the `const` object pattern.

**Symptom:** An unused enum is still in the bundle
**Cause:** The IIFE is not provably side-effect free.
**Fix:** `const` object plus a derived union.

**Symptom:** `const enum` breaks under Vite/esbuild/swc
**Cause:** Inlining requires cross-file information a single-file transpiler does
not have; `isolatedModules` forbids it.
**Fix:** Drop `const`, or move to the object pattern.

**Symptom:** Two enums with the same member names are not interchangeable
**Cause:** Enums are **nominal** — one of the few nominal constructs in the
language.
**Fix:** Usually what you want; if not, string literal unions are structural.

## Interview questions

**★ Why do most style guides discourage `enum`?**
It is the only type-ish construct that emits runtime code — an IIFE building a
two-way map — so it cannot run under Node's strip-only mode, resists
tree-shaking, and (when numeric) puts `0` in your logs and payloads. A union of
string literals or a `const` object gives the same modelling with none of it.

**★ What does `const Status = {...} as const; type Status = (typeof Status)[keyof typeof Status]` do?**
It creates one runtime object and derives the union of its values as a type with
the same name — legal because values and types live in separate namespaces. Call
sites keep using `Status.Pending`, the type stays in sync automatically, and
everything erases cleanly.

**★ When is a plain union of string literals enough?**
Whenever you do not need the values at runtime. It has zero runtime cost and no
import — you just write `'pending'`. Add the `const` object only when you need to
iterate the members or want a named constant.

**Why is `const enum` worse than a regular `enum`?**
It works by inlining member values into every call site, which is a whole-program
transform. Single-file transpilers cannot do it, so it is banned by
`isolatedModules` and breaks under esbuild, swc and Vite.

**Are enums structurally or nominally typed?**
Nominally — two enums with identical members are not assignable to each other.
That is unusual for TypeScript and occasionally useful, but string-literal unions
being structural is what makes them easy to pass around.

---

← Prev: [Call and construct signatures](./12-call-and-construct-signatures.md) · Next → [`readonly` and immutability](./14-readonly-and-immutability.md)
