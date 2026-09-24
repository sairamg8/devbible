---
name: devbible-typescript-phase3
description: The load-bearing claims behind TypeScript phase 3 (Generics) and the sources they were validated against — banked per topic, to be folded into the phase README at the phase close
metadata:
  type: reference
---

# TypeScript Phase 3 — Generics: the claims and their sources

Split out of [[devbible-typescript-build-progress]] on 2026-08-15, when that file
passed the 300-line memory cap ([[devbible-memory-file-cap]]). **Open this when
writing or reviewing a phase-3 page**, or at the phase close. The live cursor
stays in the parent.

## How every claim here was validated

**No sandbox** (rule 7). Three sources, named on each page's `> Verified:` line:

1. The **TypeScript handbook** — *Generics*, *Type Manipulation → Generics /
   Keyof / Typeof / Indexed Access / Conditional Types*.
2. The **release notes** for anything with a version — `const` type parameters
   (5.0), variance annotations (4.7), `infer … extends` (4.8), `NoInfer` (5.4).
3. 🔴 **The compiler's own diagnostic table and `lib/*.d.ts`**, read rather than
   recalled. `grep -o 'Message_text_id_NNNN[^)]*' <ts>/lib/typescript.js` gives
   the exact `{0}`-templated wording for an error code, and `lib.es5.d.ts` gives
   the real declaration of a utility type. This is documentation, not a run.
   ⚠️ The install inspected is **TypeScript 6.0.3** at
   `my-learning/eKommerce/ek-frontend/node_modules/typescript` (read-only;
   eKommerce is advisor-only), **not the 7.0.2 this corpus targets** — every page
   says so rather than glossing it.
   ⚠️ **Limit found 2026-08-15:** 6.0.3 is the Go port, so `typescript.js` carries
   the *string table* but not the checker. You can quote a message; you cannot
   show which code fires for a given mistake. Where that matters, say the mapping
   was derived from the message wording, not observed.

## Topics 01–02 — type parameters and constraints

- **A type parameter is a variable in the type language**, solved per call site.
  Every confusing generic is a solve with no information or the wrong equation.
- **`T` is solved from the arguments in order, and the solved `T` then becomes
  the callback's contextual type** — that is why `map(arr, x => …)` types `x`
  for free, and why reordering parameters breaks it.
- **No inference site → `unknown`** (or the constraint, if there is one). **A
  parameter appearing only in the return type is an unchecked `as` for the
  caller** — `getJson<User>(url)` is the canonical misuse.
- **`TS2345` = an argument did not fit; `TS2344` = a type *argument* did not fit
  a constraint.** The code says whether to look in the parentheses or the angle
  brackets.
- **`extends` in a constraint is structural assignability, not inheritance** — an
  upper bound. And it is a floor on what you **know**, never a licence to
  **construct** a `T`: `return { count: 0 }` from
  `<T extends { count: number }>(x: T): T` is correctly rejected, because the
  caller's `T` may be narrower.
- **`TS2558` — type argument lists are all-or-nothing.** No partial lists.
- **`<T extends string>` preserves literal types**; the object/array equivalent
  is a `const` type parameter (topic 12).
- 🔴 **`NoInfer<T>` is a compiler intrinsic** — `lib.es5.d.ts` has
  `type NoInfer<T> = intrinsic;` under *"Marker for non-inference type
  position"*. It is the tool for "this argument should conform, not decide",
  which no constraint can express. TS 5.4+.
- **`.tsx` needs `<T,>` or `<T extends unknown>`** — `<T>` parses as JSX. Seeing
  `extends unknown` in React code almost always means this, not a real bound.
- Prefer **`T extends readonly unknown[]`** (accepts `as const` tuples) and
  **`T extends (...args: never[]) => unknown`** over `Function` (which returns
  `any` when called).

## Topic 03 — generic interfaces and aliases

- 🔴 **The lib's own utility types are the best worked examples, and reading
  them settles arguments.** From `lib.es5.d.ts`: `Pick<T, K extends keyof T>`
  **does** constrain against `T`, **`Omit<T, K extends keyof any>` does NOT** —
  so `Omit<User,'nmae'>` compiles and omits nothing. And
  **`NonNullable<T> = T & {}`**, not the conditional form most people remember.
- **`type F<T> = (x: T) => T` vs `type F = <T>(x: T) => T`** — the brackets move
  one position and the meaning changes completely: type constructor vs the type
  of a generic function (caller picks per call). Same distinction as
  interface-level vs method-level parameters.
- **`TS2428` "identical type parameters"** covers **names, order, constraints
  and defaults**, not just the count. Merging is the one real reason to pick
  `interface` over an alias in a generic context.
- ⚠️ **`TS2589` fires far later than folklore says** — `ts-p1` measured it at
  depth **5000**, not 50 or 500. Recursive *data* models (`Json`,
  `DeepPartial`) are fine; the limit is a type-level-computation concern.
- ⚠️ **"Interfaces give better error messages" FAILED to reproduce** in `ts-p1`
  for a plain object shape — identical `TS2741` from both. Not repeated as a
  reason to prefer either form.

## Topics 04–06 — `keyof`, `getProp`, indexed access

- 🔴 **The `keyof` duality:** `keyof (A | B)` is the **intersection** of the
  keys, `keyof (A & B)` is the **union**. It follows from what is safe to
  access, so derive it rather than memorising it. Consequence:
  `K extends keyof T` goes nearly useless when `T` is a wide union — narrow `T`
  first rather than fighting the constraint.
- **`keyof { [k: string]: X }` is `string | number`** — `obj[0]` is `obj['0']`
  at runtime and TS models it. `Extract<keyof T, string>` is the filter, and it
  is also the fix when a symbol key breaks a template literal type.
- **`keyof someArray` drags in every `Array.prototype` member.** What was wanted
  is `T[number]`.
- **`keyof {}` is `never`** — a `K extends keyof T` parameter silently becomes
  uninhabitable when `T` widens to `{}`, and every call then fails confusingly.
- **`keyof` on a class = public instance members only.**
- 🔴 **Why `getProp` has TWO type parameters, in one sentence:** `key: keyof T`
  checks the key but **forgets which one**, so the widest return type it can
  express is `T[keyof T]` — the union of every property type. The second
  parameter captures the literal that was passed, which is what makes the return
  `T[K]` exact.
- **`setProp<T, K extends keyof T>(obj, key, value: T[K])`** ties the value to
  the key — a genuinely hard thing in most type systems, one indexed access here.
- **The object must be the FIRST parameter.** Inference runs in argument order;
  `T` must be solved before `K extends keyof T` has anything to check against.
  Not a stylistic convention — it is why every API of this shape looks the same.
- **A correct `getProp` needs NO `as` in its body.** If it does, `T` is
  unconstrained where the body assumes an object, or the parameter order lost the
  inference. That is the test of whether the generic does real work.
- **`TS7053`** (*"Element implicitly has an 'any' type because expression of type
  '{0}' can't be used to index type '{1}'."*) is the un-generic version of this
  whole topic surfacing as an error; **`TS2536`** is its sibling for an
  unconstrained type parameter used as an index.
- **Typed deep paths (`'address.city'`) are Phase 5 machinery** — template
  literals plus recursion. Flagged with its real costs (rename tools do not
  follow path strings, error messages get much worse): a form library needs it,
  application code usually does not.
- **`T[number]` is the element type**, and `(typeof ARR)[number]` with `as const`
  gives a runtime list and its union from one declaration. ⚠️ **The parentheses
  are load-bearing** — `typeof ARR[number]` parses as `typeof (ARR[number])` and
  sometimes coincidentally agrees, which is worse than failing.
- **`T[keyof T]` = the union of every property type.** Seeing it in a hover is
  usually a `getProp` missing its second type parameter.
- **Types are indexed, never dotted** — `User['id']`, not `User.id`. `TS2713`
  says so *and* suggests the bracket form. The index must be a type, so a value
  needs `typeof` first.
- **There is no `?.` for types** — `Cfg['db']['host']` fails on an optional
  property; use `NonNullable<Cfg['db']>['host']`.

## Topics 07–14 — the Understand/Know tier

Split into a child on 2026-08-15 when this file passed the 300-line cap:
**[[devbible-typescript-phase3-operators]]** — the `typeof` type operator,
default type parameters, generic classes, inference sites and contextual typing,
`infer` in conditional types, `const` type parameters, and when *not* to write a
generic. Open it when writing or reviewing any of those pages.

Its two highest-value claims, so you know whether you need to open it:

- 🔴 **A mutable constraint makes `<const T>` a SILENT no-op** — the readonly
  candidate fails the constraint, inference falls back to it, nothing is
  reported.
- 🔴 **A type parameter appearing only in the return position is an unchecked
  `as` in angle brackets** — `getJson<User>(url)`, the most common bad generic in
  application code.

## Still to bank

Topic **14 · Variance** (Know) — not written yet. Already referenced from 02 (why
`(...args: never[]) => unknown` is the right "any function" bound), 11 (the
infer-position asymmetry behind `UnionToIntersection`) and 12 (the TS1274 vs
TS1277 placement lists, which are the `in`/`out` list and the `const` list).

Related: [[devbible-typescript-build-progress]] · [[devbible-typescript-phase2]] ·
[[devbible-typescript-phase1]] · [[devbible-typescript-syllabus]]
