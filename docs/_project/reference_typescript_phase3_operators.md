---
name: devbible-typescript-phase3-operators
description: TypeScript phase 3 claims for topics 07-14 — the typeof type operator, defaults, generic classes, inference sites, infer, const type parameters and when not to write a generic
metadata:
  type: reference
---

# TypeScript Phase 3 — topics 07–14, the Understand/Know tier

Child of [[devbible-typescript-phase3]], split out on 2026-08-15 at the
300-line memory cap ([[devbible-memory-file-cap]]). The parent holds the
validation method and the Master-tier topics 01–06; **open this one when writing
or reviewing a page from topics 07–14**, or at the phase close.

Same evidence rule throughout: **no sandbox**, validated against the handbook,
the release notes, and the compiler's own diagnostic table / `lib/*.d.ts` read
rather than recalled. ⚠️ The install inspected is TypeScript **6.0.3** (the Go
port), not the 7.0.2 the corpus targets — and being the Go port, its JS package
carries the string table but **not the checker**, so a message can be quoted but
not shown firing.

## Topic 07 — the `typeof` type operator

- 🔴 **Position, not syntax, decides which `typeof` you get.** Expression
  position = JavaScript's runtime operator; type position = a type query. The two
  diagnostics that mark the boundary: **`TS2749`** (*"refers to a value, but is
  being used as a type here. Did you mean 'typeof {0}'?"*) and **`TS2693`** (the
  mirror).
- 🔴 **On a class, `typeof` gives the STATIC side.** A class declaration creates
  a type (the instance) and a value (the constructor); `Service` is the first,
  `typeof Service` the second. That is why statics are absent from the instance
  type, and `InstanceType<typeof Service>` is the way back.
- **A type query takes an identifier or property access only** — never a call.
  `ReturnType<typeof getUser>`, not `typeof getUser()`.
- **`as const` + `satisfies` + `typeof` is one toolchain**: drop `as const` and
  literals widen, drop `satisfies` and nothing is checked, use an *annotation*
  instead of `satisfies` and `typeof` hands back the annotation rather than the
  data.

## Topics 08–09 — defaults and generic classes

- **Default precedence: explicit type argument → inference → default.** On a
  *type* a default fills an omitted argument (killing `TS2314`); on a *function*
  it applies only when inference has nothing. `TS2706` defaults must come last,
  `TS2707` gives the arity as a range, `TS2716` no circular defaults.
- 🔴 **`<T = any>` on a parameter with no inference site is the trap** — a silent
  `any` at every call. `= any` is almost always wrong; `= unknown` at minimum.
  General smell: **a default doing the job inference should have done.**
- **Library types accumulate defaults because adding `<T>` is breaking and
  adding `<T = OldBehaviour>` is not** — an over-parameterised signature is often
  history, not design.
- 🔴 **`TS2302` statics cannot reference the class type parameter**, and the
  reason is arithmetic: `T` is per-instance, the constructor is ONE value shared
  by every instantiation. Hence `static of<U>(v: U): Box<U>` in every real
  library.
- **`implements` is a CHECK, not a source of types.** An unannotated method
  parameter is still an implicit `any`. `TS2420` when the class does not satisfy.
- **`: this` as a return type** is what keeps fluent chaining correct through a
  subclass.
- **`TS2442` — private/protected members compare by DECLARATION SITE**, not
  structurally. That is how branding works, and how a duplicated package in a
  build surfaces as a type error (the same failure `instanceof` has at runtime).
- **A `Result` class is almost always better as a discriminated union** — said
  plainly on the page rather than presenting the two as equivalent.

## Topic 10 — inference sites and contextual typing

- 🔴 **Inference is bottom-up, contextual typing is top-down, and they
  ALTERNATE inside one generic call**: infer `T` from arg 1 → push
  `(item: T) => U` into the callback → infer `U` from its return. That is why
  argument order is load-bearing and why a callback declared before the
  type-determining argument gets `TS7006`.
- ⚠️ **Honest refinement of an earlier claim:** topic 01 said "no inference site
  → `unknown`". True with **no context**; given one, the contextual type supplies
  it (`const ys: string[] = create()` infers `string`). Lower priority than
  arguments, vanishes outside an annotated position, and it is exactly what makes
  `parse<T>(s: string): T` *feel* safe while checking nothing.
- **Excess-property checking applies only to FRESH object literals in a typed
  position** — which is why a typo is reported inline and disappears once the
  object is extracted to a variable.
- **The better fix for `TS7006` is annotating the receiving position (or
  `satisfies`), not the parameter** — it supplies context to the whole
  expression at once.

## Topic 11 — `infer` in conditional types

- **`infer` names a hole in a type pattern; it is in scope only in the TRUE
  branch.** The lib's `Awaited` is the best single worked example — several
  `infer`s in one clause, a nested conditional matching an inferred type,
  recursion, and a `_` throwaway.
- 🔴 **Distribution:** a conditional over a **naked** type parameter evaluates
  once per union member — which is why `Exclude`/`Extract` are one line each.
  **`[T] extends [U]` switches it off** and compares the union as a whole.
- **`infer` position decides union vs intersection** — the same name in several
  *property* positions gives a union, in several *parameter* positions gives an
  intersection. That is `UnionToIntersection`'s mechanism, and variance (topic
  14) is the reason.
- **`infer X extends C` (TS 4.8)** both constrains the match and converts the
  result for primitive constraints — `` `${infer N extends number}` `` yields a
  number literal.
- **Do not reach for a conditional where `T[K]` would do.** Every conditional
  added makes downstream error messages worse.
- ⚠️ `Parameters` falls back to `never` and `ReturnType` to `any` — a historical
  inconsistency in the standard library, not a principle. Said as such.

## Topic 12 — `const` type parameters (written 2026-08-15)

Source: the **TypeScript 5.0 release notes**, *const Type Parameters*. The
`getNamesExactly` / `fnGood` / `fnBad` examples and their inferred types are
quoted verbatim from that page rather than reconstructed.

- **`<const T>` makes inference at the call site behave as if the caller had
  written `as const`.** `getNamesExactly({ names: [...] })` goes from `string[]`
  to `readonly ["Alice", "Bob", "Eve"]` on one keyword. It moves the obligation
  off every caller and onto the one declaration — which is the actual value, not
  the brevity.
- 🔴 **It only affects object, array and primitive expressions written *within
  the call*.** A variable declared elsewhere was already widened at its own
  declaration and cannot be recovered: `const arr = ["a","b","c"]; fnGood(arr)`
  still gives `string[]`. `const` on a *variable* stops reassignment, not
  widening.
- 🔴 **A mutable constraint silently defeats it, with NO error.**
  `<const T extends string[]>` produces the candidate `readonly ["a","b","c"]`,
  which is not assignable to a mutable `string[]`, so inference **falls back to
  the constraint** and `T` is `string[]`. The `const` sits there looking correct
  and doing nothing. Fix: `readonly` throughout the constraint — which is why the
  handbook's own `HasNames` is `{ names: readonly string[] }`.
  **This is the highest-value claim on the page**: a silent no-op beats a loud
  error for how long it survives in a codebase.
- **Allowed on function, method and constructor type parameters only** — a type
  alias or interface has no call site, so there is nothing to act on.
  ⚠️ The three placement messages read from the 6.0.3 table are **TS1273**
  (*"'{0}' modifier cannot appear on a type parameter"*), **TS1274**
  (*"… of a class, interface or type alias"* — the `in`/`out` variance list) and
  **TS1277** (*"… of a function, method or class"* — the `const` list). The
  mapping is **derived from the wording plus the documented placement rules, not
  observed firing** — the Go-port compiler's checker is not readable from the JS
  package. Page says so.
- **Purely compile-time.** Erased with every other annotation; the array is an
  ordinary mutable array at runtime. Worth saying because "const" reads as a
  runtime guarantee to people arriving from other languages.
- **The signal to add it:** the return type reads the literals — `T[number]`,
  `T[K]`, `keyof T`, or a template literal. If the parameter is only ever "some
  array", `const` buys nothing but longer hovers and bigger error messages.
- Neighbour distinction the page draws: **`as const`** = the caller freezes;
  **`as const satisfies T`** = freeze then check; **`<const T>`** = the author
  declares the literals matter.
- **TS4104** (*"The type '{0}' is 'readonly' and cannot be assigned to the
  mutable type '{1}'."*, read from the table) is what a `const`-inferred tuple
  hits downstream when handed to something wanting a mutable array. Fix at that
  boundary with a spread, not by removing the `const`.

## Topic 13 — When *not* to write a generic (written 2026-08-15)

Sources: the **TypeScript handbook**, *Functions → Guidelines for Writing Good
Generic Functions* (all three guidelines and their code examples quoted
verbatim), and **typescript-eslint**'s `no-unnecessary-type-parameters` rule page.

- 🔴 **The one test: a type parameter must appear TWICE in the signature.** The
  handbook's own words — *"type parameters are for relating the types of multiple
  values. If a type parameter is only used once in the function signature, it's
  not relating anything."* One occurrence is a longer way of writing `unknown`.
- 🔴 **The nuance that makes the rule usable: the INFERRED return type counts as
  a position.** The handbook says so explicitly. So count positions in the
  signature, not occurrences in the source — a parameter written once but flowing
  into the inferred return is legitimate. This is what stops the rule being
  over-applied.
- **The handbook's three guidelines, verbatim titles:** *Push Type Parameters
  Down* (parameterise the element, not the container — `<Type extends any[]>(arr:
  Type)` returns **`any`** from `arr[0]` where `<Type>(arr: Type[])` returns
  `number`; the handbook's own comments label them "good" and "bad"), *Use Fewer
  Type Parameters* (`filter2`'s `Func` "doesn't relate two values"), *Type
  Parameters Should Appear Twice* (`greet<Str extends string>` → `greet(s:
  string)`).
- **The lint that enforces it: `@typescript-eslint/no-unnecessary-type-parameters`
  — *"Disallow type parameters that aren't used multiple times."*** Its wording:
  *"Type parameters relate two types. If a type parameter is only used once, then
  it is not relating anything."* Incorrect/correct pair quoted verbatim:
  `second<A, B>(a: A, b: B): B` → `second<B>(a: unknown, b: B): B`.
- 🔴 **The dangerous shape is return-position-only, and it is the most common bad
  generic in application code.** `getJson<T>(url: string): Promise<T>` has no
  inference site, so the caller *states* `T` and the compiler agrees — **an
  unchecked `as` wearing angle brackets**, which survives review because it looks
  like typed code. Fixes: return `Promise<unknown>` and narrow, or take
  `parse: (raw: unknown) => T` so `T` is inferred from something that actually
  validates. Phase 9 turns the second into a whole layer.
- **The `as`-in-the-body test** (carried forward from topic 05): if the
  implementation needs `as T`, the compiler cannot see the relationship because
  there is not one.
- **The three legitimate relationships**, stated so the page is not purely
  negative: argument → return, argument → argument, argument → a *later* call
  (`Repository<T>`).
- **`TS2558` gives the extra-parameter cost teeth** — type argument lists are
  all-or-nothing, so one useless parameter forces every caller who specifies any
  type argument to specify that one too.
- Honest trade-off recorded: **in application code, delete it**; in a published
  library, removing a parameter is a breaking change for anyone passing type
  arguments explicitly — which is exactly why library signatures accumulate them
  (topic 08). The return-position case is wrong in a library too.


⚠️ **Topics 12 and 13 were EXPANDED into 4-file chunk directories on 2026-08-15**
after first shipping as single files of 289 and 293 lines — see
[[devbible-typescript-build-progress]] for why (they had been planned to a line
target). The claims below cover the expanded versions; the extra material is
noted inline.

## Topic 14 — Variance (written 2026-08-15)

Sources: the **TypeScript 4.7 release notes** (*Optional Variance Annotations for
Type Parameters*) and the **tsconfig reference** for `strictFunctionTypes`. The
`Getter`/`Setter`/`State` declarations, the `StringOrNumberFunc` example, the
annotation error text and the methods-exempt note are quoted verbatim.

- **The four variances, keyed to position:** output → covariant (`() => T`,
  `readonly T[]`), input → contravariant (`(v: T) => void`), both → invariant,
  and bivariant (unsound, kept deliberately in two places). TypeScript infers all
  of this **structurally**; you almost never declare it.
- 🔴 **THE claim of the page: methods are STILL compared bivariantly under
  `strict`.** `strictFunctionTypes` *"only applies to functions written in
  function syntax, not to those in method syntax"*, because development
  *"discovered a large number of inherently unsafe class hierarchies, including
  some in the DOM"*. So `handle: (e: E) => void` is checked properly and
  `handle(e: E): void` is not — **identical-looking declarations, different
  soundness, no flag closes the gap.** The actionable habit: declare
  callback-shaped members as **properties with function types**, never methods.
- **Contravariance is what the error message is showing you.** The
  `StringOrNumberFunc` failure nests down to *"Type 'string | number' is not
  assignable to type 'string'"* — the comparison flipped. Recognising that flip
  is most of what the Know tier needs.
- **`Array<T>` is covariant and unsound on purpose** — `T` sits in input and
  output positions so it ought to be invariant, but invariance would reject far
  too much ordinary code. `readonly T[]` has no input position and is genuinely
  safe. Pairs with topic 12's "make the constraint readonly throughout".
- **`in`/`out` (4.7) do NOT change behaviour** — they state variance that was
  already inferred. What they buy, per the release notes: the checker can *"skip
  deeper comparisons and just compare type arguments"* (a real speed-up in large
  or circular types), plus documentation. And they are **checked**: annotating
  `State<out T>` when `set` makes it invariant produces *"...is not assignable to
  type 'State<super-T>' **as implied by variance annotation**"* — that phrase is
  the one to recognise.
- **Placement:** `in`/`out` go on a **class, interface or type alias** — the
  `TS1274` list, exactly mirroring where `const` is *not* allowed (topic 12).

### Added when topic 12 was expanded to 3 chunks

- **`as const` does THREE separable things** — literal types, tuple-ness, and
  `readonly` — and `<const T>` reproduces all three together, no picking a
  subset. Naming them separately is what makes the downstream `readonly` friction
  predictable rather than surprising.
- **What counts as "written within the call"**, derived from the release notes'
  rule rather than separately documented (and labelled as a derivation on the
  page): an inline literal ✅; a spread of an already-widened variable ❌; a
  function call's return ❌; a conditional expression ⚠️ (its own type is computed
  first — do not rely on it).
- **`<const T>` with no constraint at all** is the "remember exactly what I was
  handed" signature — on an object it marks **every property `readonly`**, which
  is what `defineConfig`-style helpers want.
- **Migrating an existing API to `<const T>` is NOT purely additive.** Callers who
  never wrote `as const` now get narrower, readonly types — an improvement that
  breaks anything calling `.push` or assigning to a mutable array. ⚠️ **And the
  constraint almost always has to widen to `readonly` in the same commit, or the
  whole migration is inert** — the silent-no-op trap disguised as a delivered
  change.
- **The precedence reminder:** an explicit type argument still beats `const`
  inference — `fnGood<string[]>(["a"])` gets `string[]`.

### Added when topic 13 was expanded to 3 chunks

- **"Push Type Parameters Down" worked through to the mechanism:**
  `firstElement2<Type extends any[]>(arr: Type)` returns **`any`** from `arr[0]`
  where `firstElement1<Type>(arr: Type[])` returns `number` — indexing a value
  known only to extend `any[]` yields `any`, which then spreads silently. The
  handbook's own comments label them "good" and "bad".
- 🔴 **A constraint does NOT make a return-position-only parameter safe.**
  `<R extends { items: T[] }>(url: string): Promise<R>` still has no inference
  site; the constraint only narrows *which lie is tellable*. This is the disguise
  that makes the unsafe shape survive review, and it is now its own interview
  question.
- **The full four-parameter refactor** (`fetchList<T, R, F, K>`) taken apart one
  parameter at a time, ending with the honest note that shrinking the generics
  **exposed** the remaining unsoundness rather than fixing it.
- **The counter-case matters as much as the rule:** `first<T>(items: readonly
  T[]): T | undefined` and `mapValues<T, U>` are fine — the return is *computed*
  from an argument. The test: **could the compiler work the type out if the caller
  wrote no type arguments at all?** Yes → inference. No → assertion.
- **Two honest exceptions to the `as`-in-the-body test**, so it is not applied
  mechanically: bridging genuinely untyped input at a boundary, and an overload
  implementation signature that is deliberately wider.
- **The catalogue of return-position offenders** worth recognising as one shape:
  `parse<T>`, `readConfig<T>`, `fromCache<T>`, `rpc<T>`, `query<T>`. ⚠️ `query<T>`
  gets a specific caveat — driver/ORM APIs genuinely cannot do better, since the
  row shape is decided by a SQL string; treat the type argument as documentation
  and validate at the module edge.

Related: [[devbible-typescript-phase3]] (parent — validation method and topics
01–06) · [[devbible-typescript-build-progress]] (the live cursor) ·
[[devbible-typescript-syllabus]]
