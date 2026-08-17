---
title: "The holes in your data"
sidebar_label: "03 · Holes in your data"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by reading **`lib.es5.d.ts`** and **`lib.es2017.object.d.ts`**
> in the installed **TypeScript 5.9.3** build — `keys(o: object): string[]` and
> `entries<T>(o: { [s: string]: T; } | ArrayLike<T>): [string, T][]`, both
> returning `string`, not `keyof T` — and the **`tsconfig` reference** for
> `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. The object-spread
> case is proved in
> [topic 05 chunk 03](../05-exactoptionalpropertytypes/03-spread-defaults-and-construction.md)
> and cited rather than re-derived. **No sandbox, no console block.**

Three holes you did not opt into, all in the shape of ordinary data handling.
Two of them are closable by a flag this phase has already sold you; one is not
closable at all.

## Hole 4 · Index access — closable

```ts
const xs: string[] = ['a'];
xs[5].toUpperCase();          // typed string. TypeError.

const cfg: Record<string, string> = {};
cfg.missing.trim();           // typed string. TypeError.
```

TypeScript assumes every index access succeeds. It is the most-hit hole in the
list and it is **a default, not a permanent feature** —
[`noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md) adds the
`undefined` and the whole topic is about living with it.

⚠️ **Even with the flag it is only narrowed, not closed**, which is why it still
belongs on this page. `xs[5]` becomes `string | undefined` rather than an error;
the compiler does no bounds analysis and never will. Topic 02 says so in the same
words: *"it narrows the soundness gap rather than closing it."*

## Hole 5 · Object spread over optional properties — closable

```ts
interface Options { timeout?: number }
const defaults = { timeout: 5000 };

function connect(opts: Options) {
  const config = { ...defaults, ...opts };
  config.timeout;                          // typed number
}
connect({ timeout: undefined });           // config.timeout === undefined
```

**Spread copies keys, not defined values.** A property present with the value
`undefined` still overwrites, so the result's declared `number` is a lie whenever
a caller supplies an explicit `undefined`.

🔴 **This is the hole in the list that is easiest to demonstrate and least
known.** It requires no assertion, no `any`, no index access and no clever code —
four lines of ordinary defaults-merging, which is in every codebase.

[`exactOptionalPropertyTypes`](../05-exactoptionalpropertytypes/README.md) closes
it, by removing the state that makes the inference wrong: with the flag,
`connect({ timeout: undefined })` no longer type-checks, so the compiler's model
of the spread becomes true.
[Chunk 03 of that topic](../05-exactoptionalpropertytypes/03-spread-defaults-and-construction.md)
works it through, including the conditional-spread idiom that replaces it.

📌 **Note the shape of that fix, because it recurs.** The flag did not add a check
to the spread — it removed a possible input. Several soundness fixes in
TypeScript work that way: make the wrong state unrepresentable rather than
detected.

## Hole 6 · `Object.keys` returns `string[]` — not closable

Read straight out of the standard library:

```ts
// lib.es5.d.ts
keys(o: object): string[];

// lib.es2017.object.d.ts
entries<T>(o: { [s: string]: T; } | ArrayLike<T>): [string, T][];
```

Both give you `string`, never `keyof T`. So the natural loop does not type-check
without help:

```ts
const user = { name: 'Ada', age: 36 };
Object.keys(user).forEach(k => {
  user[k];                    // TS7053 — string cannot index this type
});
```

### 🔴 Why it is `string[]`, and why that is right

This looks like a missing overload and it is not. **Structural typing means a
value may have more properties at runtime than its type declares:**

```ts
interface Point { x: number; y: number }
const p3 = { x: 1, y: 2, z: 3 };
const p: Point = p3;          // legal — p3 is assignable to Point

Object.keys(p);               // ['x','y','z'] at runtime
```

If `Object.keys` returned `(keyof Point)[]`, that type would say `('x'|'y')[]`
and the runtime value would contain `'z'`. **A `keyof T` return type would
itself be an unsoundness** — a bigger one, and less visible.

📌 **So this hole is the price of a feature.** Structural typing is what lets you
pass any conforming object without declaring an interface relationship; excess
properties at runtime are the direct consequence; and `Object.keys` telling the
truth about that is the compiler choosing the honest option. The
[excess property check](../README.md) that catches `z` on a fresh object literal
is a heuristic layered on top — it applies to literals only, which is
[topic 09](../README.md)'s subject.

### What to do instead

**1. Type the keys where you own the object**, accepting the assertion knowingly:

```ts
(Object.keys(user) as (keyof typeof user)[]).forEach(k => user[k]);
```

⚠️ That is a type assertion — [hole 2](./02-the-holes-you-opt-into.md) — and it
is **only sound if the object has no extra properties**, which you can know for a
literal you just created and cannot know for a parameter. Confining it to
locally-constructed objects is the whole discipline.

**2. Use `for…in` with a guard**, when the object came from outside:

```ts
for (const k in obj) {
  if (!Object.hasOwn(obj, k)) continue;
  …
}
```

**3. Best — do not iterate the keys at all.** If you need a known set of fields,
write them: `(['name', 'age'] as const).forEach(…)`. This is exact, it is checked
against the type, and it fails loudly when a field is renamed — which key
iteration never does.

**4. `Object.entries` has the same problem and one extra**: its value type is `T`
from an index-signature-shaped parameter, so on a heterogeneous object you get
`any` via the `entries(o: {}): [string, any][]` overload. That is
[hole 1](./02-the-holes-you-opt-into.md) arriving without anyone writing it.

## Gotchas

**Symptom:** `TS7053` when indexing with a key from `Object.keys`.
**Cause:** the key is `string`, not `keyof T`, and that is deliberate.
**Fix:** assert the key array where you own the object, or better, enumerate the
fields you actually want with `as const`.

**Symptom:** a `keyof typeof` assertion on `Object.keys` produced a runtime
`undefined`.
**Cause:** the object had a property its type did not declare — exactly the case
the `string[]` return exists for.
**Fix:** the assertion is only safe for objects you constructed locally. For
anything from outside, guard the loop.

**Symptom:** `Object.entries` values are `any` and nothing warned.
**Cause:** the heterogeneous overload returns `[string, any][]`. `any` entered
without being written.
**Fix:** the `no-unsafe-*` lint family catches its use downstream
([topic 03](../03-containing-any.md)).

**Symptom:** a spread-based defaults merge is typed correctly and behaves wrongly.
**Cause:** hole 5 — an explicit `undefined` in the source object overwrote the
default while the type said otherwise.
**Fix:** `exactOptionalPropertyTypes`, or apply defaults by destructuring, which
is value-based and never had the problem.

**Symptom:** `noUncheckedIndexedAccess` is on and `xs[5]` on a 3-element array is
still not an error.
**Cause:** the flag adds `undefined`; it does not do bounds analysis.
**Fix:** none. This is the documented extent, which is why index access stays on
this list even with the flag on.

**Symptom:** an object literal with an extra property errors, but the same object
via a variable does not.
**Cause:** excess property checking is a heuristic for **fresh literals only**,
not part of assignability.
**Fix:** none needed — but know the rule, because it is why `Object.keys` cannot
promise `keyof T`. See topic 09.

## Interview questions

**Why does `Object.keys` return `string[]` instead of `(keyof T)[]`?**
Because structural typing lets a value carry more properties at runtime than its
declared type mentions. An object with `x`, `y` and `z` is assignable to
`{x: number, y: number}`, and `Object.keys` on it returns three strings. A
`keyof T` return would claim two, which would be a *larger* unsoundness than the
one it removes — so the standard library tells the truth instead.

**When is `Object.keys(o) as (keyof typeof o)[]` safe?**
Only when you can guarantee the object has no undeclared properties — in
practice, when you constructed it locally and it has not passed through a
function boundary. For a parameter, you cannot know, and the assertion is exactly
the case the `string[]` return exists to prevent.

**Give a soundness hole that needs no `any`, no `as` and no index access.**
Object spread over an optional property. `{...defaults, ...opts}` where
`opts.timeout` is optional is typed `number`, but a caller passing
`{timeout: undefined}` supplies a present key that overwrites the default, so the
runtime value is `undefined`. Four lines of ordinary code, and
`exactOptionalPropertyTypes` closes it.

**Two of the seven holes are closable by flags. What does the fix look like?**
In both cases the flag does not add a check — it removes a possible input.
`noUncheckedIndexedAccess` widens the read type so the unchecked case must be
handled; `exactOptionalPropertyTypes` forbids the explicit `undefined` so the
compiler's model of spread becomes true. Making the wrong state unrepresentable
rather than detected is a recurring shape in the language.

**Does `noUncheckedIndexedAccess` make index access sound?**
No, and it is worth saying so. `xs[5]` on a three-element array becomes
`string | undefined` rather than an error — there is no bounds analysis, and a
mutation between a check and a use can still invalidate it. The flag narrows the
gap; index access stays on the list of holes.

**What is the safest replacement for iterating an object's keys?**
Not iterating them. Writing the fields you want as an `as const` tuple gives you
exact types, is checked against the object's type, and fails loudly when a field
is renamed — which key iteration silently survives. Key iteration is the right
tool only when the key set is genuinely dynamic, and then the values are
genuinely unknown too.

---

← [02 · The holes you opt into](./02-the-holes-you-opt-into.md) · Next → [04 · Mutation and variance](./04-mutation-and-variance.md)
