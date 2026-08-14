---
title: "The patterns worth stealing"
sidebar_label: "02 · Patterns and limits"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 4.9 release notes** and the
> **handbook**. `TS9035` — *"Add satisfies and a type assertion to this
> expression (satisfies T as T) to make the type explicit."* — was read out of
> the **compiler's own diagnostic table**, as was `TS2353`
> (*"Object literal may only specify known properties, and '{0}' does not exist
> in type '{1}'."*). ⚠️ Compiler inspected: TypeScript **6.0.3**, not the 7.0.2
> this corpus targets. **No console block** — no recorded run covers this topic.

[Chunk 01](./01-the-problem-it-solves.md) established the mechanic: check the
value, keep the inferred type. This chunk is what that mechanic is *for* — five
patterns you will use repeatedly, and the three places `satisfies` does not
help.

## 1. The exhaustive record — the highest-value use

This is the one to learn first, because it turns a data structure into something
that **fails the build when it goes out of date**.

```ts
type Variant = 'primary' | 'secondary' | 'danger';

const styles = {
  primary:   { bg: 'blue',  fg: 'white' },
  secondary: { bg: 'grey',  fg: 'black' },
  danger:    { bg: 'red',   fg: 'white' },
} satisfies Record<Variant, { bg: string; fg: string }>;
```

Add `'ghost'` to `Variant` and the `satisfies` line errors immediately: the
object no longer covers every key. Remove a variant and the now-unknown key
errors too.

This is the object-shaped counterpart of `assertNever`
([06 · Exhaustiveness](../06-exhaustiveness.md)). Exhaustiveness with `never`
makes a `switch` complete; `satisfies Record<Union, T>` makes a **table**
complete. Between them they cover almost every "someone added a case and forgot
to update the other place" bug in a codebase.

And critically, you keep the detail:

```ts
styles.primary.bg;      // string — and `styles.primary` is its own object type,
                        // not a shared `{ bg: string; fg: string }` alias
```

## 2. The value as the source of truth

Once the inferred type survives, you can derive types *from the data* instead of
declaring them alongside it:

```ts
const routes = {
  home:    '/',
  profile: '/users/:id',
  search:  '/search',
} satisfies Record<string, `/${string}`>;

type RouteName = keyof typeof routes;         // 'home' | 'profile' | 'search'
type RoutePath = (typeof routes)[RouteName];  // '/' | '/users/:id' | '/search'

function go(name: RouteName) { … }
```

With an annotation of `Record<string, string>` this collapses: `RouteName` would
be `string` and `RoutePath` would be `string`, and you would have to maintain a
separate union by hand — the classic pair of declarations that drift apart.

**One object, two derived types, no duplication.** The template-literal
constraint `` `/${string}` `` is doing real work as well: it rejects a path that
forgot its leading slash, and it costs nothing at runtime.

## 3. Heterogeneous config, checked but not flattened

The palette case from chunk 01, generalised. Any object whose entries have
*different* specific types but a *common* constraint:

```ts
const handlers = {
  onSave:   (draft: Draft) => void 0,
  onDelete: (id: string) => void 0,
  onReset:  () => void 0,
} satisfies Record<string, (...args: never[]) => void>;

handlers.onSave;      // (draft: Draft) => void — each signature intact
```

An annotation here would give every handler the constraint's signature and make
all of them uncallable with real arguments. `satisfies` checks that each entry is
*some* void-returning function and then gets out of the way.

## 4. `as const satisfies` for literal data

Covered in chunk 01 as a mechanism; here is where it actually pays:

```ts
const LEVELS = ['debug', 'info', 'warn', 'error'] as const satisfies readonly string[];

type Level = (typeof LEVELS)[number];      // 'debug' | 'info' | 'warn' | 'error'

LEVELS.indexOf('info');                    // still a real array at runtime
```

One declaration produces the **runtime list** (for iterating, rendering a
dropdown, validating input) and the **compile-time union**. Keeping those two in
sync by hand is one of the most reliable sources of stale code in a TypeScript
codebase, and this removes the possibility.

## 5. A checked default export

Module defaults are the other place the inferred type has a life after the check:

```ts
export default {
  port: 3000,
  host: 'localhost',
  features: { search: true, exportCsv: false },
} satisfies AppConfig;
```

Consumers get the precise shape — `features.search` is `boolean`, `port` is
`number` — *and* the module cannot drift out of conformance with `AppConfig`.
An annotation would give consumers only what `AppConfig` declares, which is
usually what you want for a public contract and usually not what you want for
configuration.

## Where `satisfies` does not help

**It does not validate anything at runtime.** It is erased. Data arriving from
the network, a file or `JSON.parse` is `unknown` at runtime whatever you write
in the type layer, and `satisfies` on a parsed value checks the *static* type you
already claimed, not the bytes. That boundary needs a schema validator
(**Phase 9 · Types at the boundary** *(not written yet)*).

**It does not make anything `readonly`.** `satisfies readonly string[]` accepts a
mutable array happily — the constraint is satisfied by a mutable array, since
mutable is assignable to readonly. If you need immutability, that is `as const`
or an explicit `readonly` type, and the two are doing separate jobs even when
they appear on the same line.

**It cannot appear in a type position.** No `type A = B satisfies C`, no
`function f(x: T satisfies U)`. It is an expression operator and only ever
applies to a value.

**It does not change how the value is passed on.** Once the object goes into a
function parameter or is assigned to an annotated variable, the declared type
takes over exactly as before. `satisfies` protects the inferred type *at the
declaration*, not for the rest of its travels.

## One interaction worth knowing: `isolatedDeclarations`

Under `isolatedDeclarations` — the mode that requires every export's type to be
determinable without inference, so declaration files can be emitted per-file —
an exported `satisfies` expression can be too implicit to emit. The compiler's
own suggested fix names the shape to write:

```text
TS9035: Add satisfies and a type assertion to this expression
(satisfies T as T) to make the type explicit.
```

That is `satisfies T as T` — check it, then assert the declared type so the
emitter has something explicit to write down. It is worth recognising rather
than memorising; if a project turns that flag on, this is the diagnostic that
will greet its `satisfies` exports.

## `satisfies` vs the alternatives, decided

- **Reaching for `as` on an object literal?** It is almost always `satisfies` you
  wanted. `as` was the only tool for "make this literal conform" before 4.9, and
  a large amount of existing code uses it for exactly this — with no checking at
  all ([08](../08-as-assertions/README.md)). Converting those is one of the
  highest-value, lowest-risk cleanups available in an older codebase.
- **Writing an annotation on a `const` you then read specific properties out
  of?** `satisfies`, unless the widening is the point.
- **Declaring a public API's parameter or return type?** An annotation. The wide
  type *is* the contract there, and the caller should not depend on your
  implementation's incidental specificity.
- **Need the runtime to reject bad data?** Neither. A validator.

## Gotchas

**Symptom:** Adding a union member does not break the table that handles it
**Cause:** The table is annotated `Record<string, T>`, or not checked at all.
**Fix:** `satisfies Record<TheUnion, T>` — the missing key becomes an error.

**Symptom:** `keyof typeof config` is `string` rather than the actual keys
**Cause:** An annotation with an index signature replaced the inferred keys.
**Fix:** `satisfies` instead of the annotation.

**Symptom:** `satisfies readonly T[]` does not stop `.push()`
**Cause:** It never claimed to. A mutable array satisfies a readonly constraint.
**Fix:** `as const`, or annotate the variable `readonly T[]`.

**Symptom:** Data from `JSON.parse` passes `satisfies` and is wrong at runtime
**Cause:** `satisfies` checks a static type; `JSON.parse` returns `any`, so the
check is vacuous.
**Fix:** Parse with a schema validator. No type-layer operator can do this.

**Symptom:** `TS2353: Object literal may only specify known properties, and '…'
does not exist in type '…'` on a `satisfies`
**Cause:** Excess property checking applies to the literal, exactly as it would
under an annotation — usually a typo'd key.
**Fix:** Fix the key. This is the operator catching the thing you added it for.

**Symptom:** `TS9035` on an exported `satisfies` after enabling
`isolatedDeclarations`
**Cause:** The export's type cannot be emitted without inference.
**Fix:** `satisfies T as T`, as the diagnostic suggests.

## Interview questions

**★ Give a case where `satisfies` catches a bug an annotation would not.**
A lookup table keyed by a union. `const styles = {…} satisfies Record<Variant,
Style>` errors the moment a new `Variant` is added and the table is not updated.
Annotated as `Record<string, Style>` it never errors, and the missing case
surfaces at runtime as `undefined`. It is the object-shaped equivalent of
`assertNever`.

**★ How do you derive a union type from a runtime array without writing it
twice?**
`const LEVELS = [...] as const satisfies readonly string[]`, then
`type Level = (typeof LEVELS)[number]`. One declaration gives both the array you
can iterate at runtime and the union you can type against, so the two cannot
drift apart.

**★ You see `as` on a large object literal in a code review. What do you
suggest?**
`satisfies`. The `as` performs essentially no checking — it only requires the
types to overlap — while `satisfies` checks the literal fully *and* leaves the
inferred property types intact, which is what the author almost certainly
wanted. Before TypeScript 4.9 `as` was the only option, so a lot of existing
code has this shape.

**Does `satisfies` do any runtime validation?**
None. It is erased like every other type-layer construct. A value from
`JSON.parse` is `any`, so `satisfies` against it checks nothing real — the
boundary needs an actual validator.

**When is an annotation still the right choice?**
When the wide type is the contract: exported function signatures, public API
shapes, anything a consumer should be coupled to deliberately rather than to
your implementation's incidental detail. `satisfies` is for values whose
specific inferred type is genuinely useful downstream.

---

← Prev: [01 · The problem it solves](./01-the-problem-it-solves.md) · Next → [11 · Narrowing you lose](../11-narrowing-lost.md)
