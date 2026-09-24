---
name: devbible-typescript-phase1
description: The measured dataset behind TypeScript Phase 1 (17 pages) — weak-type detection and where it stops, the interface-error folklore that failed, TS2589 being far further away than believed, and two of my own claims the scripts falsified
metadata:
  type: reference
---

Phase 1 "The type vocabulary" — **17 pages written 2026-08-13**. Scripts:
`sandbox/ts-p1/ex1…ex7`, own npm project, TypeScript 7.0.2.

## The technique this phase established

**Read inferred types out of an emitted `.d.ts`**, never from a hover tooltip:

```bash
tsc --declaration --emitDeclarationOnly --strict --outDir out src/infer.ts
```

Every inference claim in the phase is backed by that output. It is also how the
`noUncheckedIndexedAccess` effect was shown: the *same source* emits
`first<T>(items: T[]): T` without the flag and `: T | undefined` with it.

## Five claims the scripts changed

1. **Weak type detection, and where it stops (ex3).** A typo in an optional
   property passed through a **variable** still errors —
   `TS2559: Type '{ timeoutMS: number; }' has no properties in common with type
   'Options'` — because *every* property of `Options` is optional. I had written
   "no error" in the script comment. **But add one required property and the same
   typo passes silently**, measured. So: excess property checks catch literals
   always; weak-type detection catches variables only for all-optional targets.
2. **"Interfaces give better error messages" did NOT reproduce (ex4).** A plain
   object alias and an equivalent interface both produced
   `TS2741 … but required in type 'TParcel'` / `'IParcel'` — identical, each
   naming its own type. The folklore holds only for aliases built from
   intersections/mapped types, which have no single name to print.
3. **`TS2589` is far away (ex6).** Type-level recursion at depth **50 and 500
   compiled fine**; only **5000** tripped
   `Type instantiation is excessively deep and possibly infinite`. My first
   version of the page claimed 50 was the limit and printed an error that never
   happened.
4. **My own `reduce` example did not compile (ex6).** `v.reduce((n, x) => n +
   sizeOf(x), 0)` over `JsonValue[]` infers the accumulator from the *elements*,
   giving `TS18047: 'n' is possibly 'null'` and `TS2365`. Needs
   `reduce<number>(…)`. The correction is now a worked example on the page.
5. **A plain `symbol` was accepted as a computed key (ex7).** Both
   `interface Maybe { [loose]: string }` and `type Alias = { [loose]: string }`
   compiled with a `let` symbol, against the documented `unique symbol`
   requirement. Recorded as version-dependent rather than asserted either way.

## Other measured facts worth keeping

- **Inference (ex1):** `let` → `string`, `const` → `"Hyderabad"`; object
  properties widen (`{standard: number}`) but `as const` gives
  `{ readonly standard: 120 }`; array literals infer `(A|B)[]` never tuples;
  `as const` array → `readonly [1, 'two']`; a defaulted parameter emits as
  `subject?: string` while the body sees `string`.
- **any/unknown (ex2):** the two `any` lines produced **no diagnostics at all**,
  while `unknown` gave `TS18046` and `TS2322` — the whole argument in one run.
- **Exhaustiveness (ex2):** all branches handled → compiles (value is `never`);
  one missing → `Type '"cancelled"' is not assignable to type '1'`, **naming the
  forgotten case**.
- **Functions (ex5):** fewer params assignable, more rejected with
  `Target signature provides too few arguments`; returning a value into `void`
  accepted; overload call with 3 args → `TS2554: Expected 1-2 arguments` proving
  the implementation signature is not callable.
- **type vs interface (ex4):** interface merging proven by
  `TS2741 Property 'height' is missing`; alias duplicate → `TS2300`;
  `interface extends` a union → `TS2312`.
- **object/Object/{} (ex7):** `object` rejects `'hello'`/`42`; `Object` and `{}`
  accept both; `{}` rejects `null`; `o.id` on `object` → `TS2339`; and the
  compiler adds a hint on `String`→`string`:
  *"'string' is a primitive, but 'String' is a wrapper object. Prefer using
  'string' when possible."*
- **Symbols (ex7):** `export const KEY = Symbol()` emits
  `unique symbol`; `export let loose` emits `symbol`.
- **Recursive (ex6):** an `interface` fails `JsonValue`'s index signature —
  `Index signature for type 'string' is missing in type 'IOrder'` — while an
  equivalent `type` alias passes. A real, practical type-vs-interface difference.

## Page shape

17 files, **~180–265 lines**, none over cap, genuine spread. Same section
skeleton as Phase 0.

## Build state at phase close

`yarn build` **fails**, and **none of it is TypeScript** — broken links in
`docs/css/pages/phase-1-selectors/`, `docs/react/pages/phase-0-how-react-runs/`,
and an **MDX compilation error in `docs/react/pages/phase-0-how-react-runs/02-the-element.md`**
from the co-session working in parallel. Zero warnings name `typescript`.
Per the user's standing instruction, skipped rather than fixed; re-check later.

## Correction applied after Phase 2 measurement

Page 10 (`null` and `undefined`) originally claimed narrowing is lost after an
`await`, with an invented error block. **Measured false on 7.0.2** (ts-p2 ex2):
narrowing on a mutable property **survives `await`** in the same function body
and is lost **inside a callback** — one `TS18047`, on the `forEach` line only.
Page and its interview question rewritten around the measurement.

Related: [[devbible-typescript-phase0]] · [[devbible-typescript-build-progress]] ·
[[devbible-verify-your-own-measurements]]
