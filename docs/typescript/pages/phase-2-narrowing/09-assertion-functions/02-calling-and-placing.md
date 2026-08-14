---
title: "Calling them, and where they belong"
sidebar_label: "02 · Calling and placing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. **TS2775 and TS2776 — both codes and their exact wording —
> were read out of the TypeScript compiler's own diagnostic table**
> (`Assertions_require_every_name_in_the_call_target_to_be_declared_with_an_explicit_type_annotation`
> and `Assertions_require_the_call_target_to_be_an_identifier_or_qualified_name`),
> not reproduced from memory. ⚠️ The compiler inspected was TypeScript **6.0.3**,
> not the 7.0.2 the rest of this corpus targets; both diagnostics are
> long-standing and unchanged across that range, but 6.0.3 is what was actually
> read and saying so is the honest version. The `asserts` signatures quoted below
> are read from **`@types/node` 26.2.0**'s `assert.d.ts`. Behaviour otherwise
> follows the **TypeScript handbook** (*Narrowing → Assertion functions*).
> **No console block** — no recorded run covers this topic, and a plausible
> `tsc` transcript written from memory is not evidence.

[Chunk 01](./01-the-two-forms.md) covered what an assertion function *is*. This
one covers the two rules the compiler enforces about **how you may call one** —
which is where the feature bites everybody exactly once — and then where it
earns its place.

## 🔴 The explicit-annotation requirement

An assertion function cannot be called through a name whose type was inferred:

```ts
const assertIsString = (v: unknown): asserts v is string => {
  if (typeof v !== 'string') throw new TypeError('expected a string');
};

declare const input: unknown;
assertIsString(input);
```

```text
error TS2775: Assertions require every name in the call target to be declared
with an explicit type annotation.
```

**The function is fine. The `const` binding is the problem.** Its type was
inferred from the arrow initialiser, and the compiler refuses to apply an
assertion through an inferred name.

This is genuinely confusing the first time, because the error points at the
*call site* while the cause is at the *declaration* — and because the identical
code with `v is string` instead of `asserts v is string` compiles without
complaint. Type guards have no such restriction.

Two fixes:

```ts
// 1. Use a function declaration. Its type is not inferred from an initialiser.
function assertIsString(v: unknown): asserts v is string {
  if (typeof v !== 'string') throw new TypeError('expected a string');
}

// 2. Or annotate the binding explicitly — note the signature is written twice.
const assertIsString: (v: unknown) => asserts v is string = (v) => {
  if (typeof v !== 'string') throw new TypeError('expected a string');
};
```

**Prefer the function declaration.** The annotated-`const` form works, but you
now maintain the signature in two places and a drift between them is silent —
the annotation wins, and the arrow's own return type is simply ignored.

### Why the rule exists

Control flow analysis has to know that a call *is* an assertion **before** it
analyses the call, so it can decide what the code after the call knows. If the
call target's type were inferred, resolving that type could itself depend on the
control flow analysis that is trying to use it. Requiring an explicit annotation
breaks the circularity by making the assertion-ness knowable without doing any
inference at all.

That framing also explains why it is not a limitation worth hoping gets removed:
it is not a missing feature, it is the ordering constraint that makes the
feature checkable.

### The sibling rule

```text
error TS2776: Assertions require the call target to be an identifier or
qualified name.
```

Same rule, from the other direction: there must be a **name** to look the
annotation up on.

| Call | Allowed |
|---|---|
| `assertIsString(v)` — a plain identifier | ✅ |
| `assertions.isString(v)` — a qualified (dotted) name | ✅ |
| `assert.ok(v)` — a namespace import member | ✅ |
| `handlers[0](v)` — element access | ❌ TS2776 |
| `(cond ? a : b)(v)` — a computed callee | ❌ TS2776 |
| `getAssert()(v)` — the result of a call | ❌ TS2776 |

The practical consequence: **assertion functions do not survive being put in a
lookup table.** A registry of validators keyed by string cannot narrow anything.
If you need that shape, the entries have to be type guards, and the call site
does the `if`.

## What Node's `assert` module actually declares

The feature landed in TypeScript 3.7 in large part so `node:assert` could be
typed honestly, and those declarations are the reference examples of both forms:

```ts
// @types/node 26.2.0 — assert.d.ts
function assert(value: unknown, message?: …): asserts value;
function ok(value: unknown, message?: …): asserts value;

function strictEqual<T>(actual: unknown, expected: T, message?: …): asserts actual is T;
function ifError(value: unknown): asserts value is null | undefined;
```

Three things fall out of reading them:

- **`assert(x)` and `assert.ok(x)` are the truthiness form** — `asserts value`,
  with the empty-string caveat from chunk 01 attached. `assert(name)` on `''`
  throws.
- **`assert.strictEqual` is generic and asserts a type**, so
  `assert.strictEqual(status, 'ready')` leaves `status` narrowed to the literal
  `'ready'` for the rest of the scope. That is a real and useful side effect
  most people never notice they are getting — particularly in tests, where it
  means the assertions themselves refine what later lines are allowed to say.
- **`assert.ifError(err)`** narrows to `null | undefined` — the callback-era
  idiom, typed exactly.

And because `assert` is imported as a name and called as `assert(…)` or
`assert.ok(…)`, it satisfies both TS2775 and TS2776 without you doing anything.
That is not luck; it is why the rules were drawn where they were.

## Assertion methods on `this`

The `asserts` clause can also be written about the receiver, which is how a
class narrows itself:

```ts
class Config {
  private loaded = false;
  private data?: Record<string, string>;

  assertLoaded(): asserts this is { data: Record<string, string> } {
    if (!this.loaded) throw new Error('config not loaded');
  }

  get(key: string) {
    this.assertLoaded();
    return this.data[key];      // data is no longer optional here
  }
}
```

The same trade-off as everywhere else in this topic applies — the body is
unchecked, and `this.loaded` and `this.data` can disagree with no complaint from
the compiler. It reads well for a genuine two-state object (loaded/not, open/
closed, connected/not) and badly for anything with more states than that, where
a discriminated union ([05](../05-discriminated-unions.md)) models the thing
properly instead of asserting your way around it.

## Where it earns its place

**Good uses** all share one property: failure means *this build, config or
invariant is broken*, not *this input was bad*.

```ts
// Startup checks — fail fast, before anything else runs.
function assertEnv(name: string, v: string | undefined): asserts v is string {
  if (v === undefined) throw new Error(`missing environment variable ${name}`);
}

// Invariants inside a module, where the caller cannot have got it wrong.
function assertNonEmpty<T>(xs: readonly T[]): asserts xs is readonly [T, ...T[]] {
  if (xs.length === 0) throw new Error('expected a non-empty array');
}
```

Note the second one's asserted type: a **non-empty tuple**, which then makes
`xs[0]` safe under `noUncheckedIndexedAccess` (Phase 10). That is the shape of a
good assertion — it buys a property the type system can actually use afterwards,
not just a mood.

`assertNever` from [06 · Exhaustiveness](../06-exhaustiveness.md) is the same
idea with `never` as the parameter type: the compile error is the point, and the
throw is only the runtime backstop.

**Bad uses** are the ones at a boundary. An assertion function over a request
body or an API response turns every malformed payload into a thrown exception
with no structured error and no field-level detail — and, because the body is
unchecked, a boundary is precisely where a hand-written check is most likely to
be subtly wrong. That work belongs to a schema validator, which performs the
runtime check *and* derives the type from one declaration
(**Phase 9 · Types at the boundary** *(not written yet)*).

## Trade-off

**An assertion function** removes a level of nesting, reads as a precondition at
the top of a function, and composes with `assert` from the standard library. It
costs you the other branch — there is no recovery path — it cannot be used with
`filter`, it cannot live in a lookup table, and it is unverified, so a wrong
body corrupts every caller silently.

**A type guard** keeps both branches, works with array methods, and reads the
same at every call site — at the cost of indentation, and a rightward drift when
several checks stack up.

**An inline check** is the only one of the three the compiler actually verifies.
Prefer it when exactly one place needs the narrowing; the abstraction only pays
for itself on the second call site.

## Gotchas

**Symptom:** `TS2775: Assertions require every name in the call target to be
declared with an explicit type annotation`
**Cause:** The assertion is bound to a `const` whose type was inferred from an
arrow function. The error points at the call, the cause is at the declaration.
**Fix:** Declare it with `function`, or annotate the binding
(`const f: (v: unknown) => asserts v is T = …`).

**Symptom:** The same code compiles fine once you change `asserts v is T` to
`v is T`
**Cause:** Type guards have no explicit-annotation requirement; only assertions
do.
**Fix:** Nothing is wrong with your guard — but if you wanted the
narrow-the-rest-of-the-scope behaviour, you have to satisfy TS2775 to get it.

**Symptom:** `TS2776: Assertions require the call target to be an identifier or
qualified name`
**Cause:** Called through an index, an element access, or a computed callee —
`handlers[0](v)`.
**Fix:** Assign it to a named `const` with an explicit annotation first, then
call that. If the design genuinely needs a table of checks, make them guards.

**Symptom:** An assertion in a registry of validators narrows nothing
**Cause:** Same as above — a table lookup is not a qualified name.
**Fix:** Type guards plus an `if` at the call site.

**Symptom:** `assert(value)` throws on a legitimate empty string
**Cause:** `node:assert`'s `assert`/`ok` are declared `asserts value` —
truthiness, not presence.
**Fix:** `assert(value !== undefined)`, or a `assertPresent` helper asserting
`NonNullable<T>`.

## Interview questions

**★ Why does assigning an assertion function to a `const` arrow break?**
`TS2775` — assertions require every name in the call target to have an explicit
type annotation. Control flow analysis must know a call is an assertion before
it analyses that call, and an inferred binding type could depend on that
analysis, so the annotation requirement breaks the circularity. Use a `function`
declaration, or annotate the binding.

**★ What can you not do with an assertion function that you can do with a guard?**
Three things: pass it to `filter`/`find` (it returns `void`, not `boolean`),
call it through an element access or computed callee (`TS2776` — the target must
be an identifier or qualified name), and handle the negative case, since there
is no `else`.

**How does `node:assert` get its narrowing?**
Its declarations use the feature directly: `assert`/`assert.ok` are
`asserts value`, `assert.strictEqual<T>` is `asserts actual is T`, and
`assert.ifError` is `asserts value is null | undefined`. Because it is called as
a plain or dotted name, it satisfies both TS2775 and TS2776 automatically.

**What is an assertion method on `this`?**
A method whose return type is `asserts this is X` — it narrows the receiver for
the rest of the calling scope, so a `Config` can prove it is loaded and then
read a property declared optional. Reasonable for a genuine two-state object;
for more states than that, model it as a discriminated union instead.

**When should you not use one?**
At a boundary. An assertion turns a malformed payload into a thrown exception
with no structured error, and the unchecked body is exactly where hand-written
validation goes wrong. Use a schema validator there, and keep assertion
functions for invariants whose failure means the program is already broken.

---

← Prev: [01 · What an assertion function is](./01-the-two-forms.md) · Next → [10 · `satisfies`](../10-satisfies.md)
