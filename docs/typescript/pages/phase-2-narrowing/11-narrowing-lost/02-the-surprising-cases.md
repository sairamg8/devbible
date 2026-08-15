---
title: "The cases that surprise you"
sidebar_label: "02 · The surprising cases"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. The `await` result is
> **sandbox-measured** in `sandbox/ts-p2/ex2-guards-and-loss.sh` — the script was
> written *expecting* `await` to lose the narrowing and it did not, which is why
> this chunk exists. That run saved no output file, so the finding is in prose
> and there is **no console block**. Aliased-condition narrowing is validated
> against the **TypeScript 4.4 release notes** (*Control Flow Analysis of Aliased
> Conditions and Discriminants*) and element-access narrowing against the **4.7**
> notes.

[Chunk 01](./01-how-a-narrowing-dies.md) gave the model and the two losses that
follow from it directly. This chunk is the residue: one case that *should* lose
the narrowing and does not, one that quietly does not lose it when arguably it
should, and the patterns that make the whole problem go away.

## `await` does **not** lose the narrowing

```ts
declare let value: string | null;

async function run() {
  if (value !== null) {
    await somethingElse();
    value.length;          // still string — no error
  }
}
```

**This is measured.** The `ex2` script was written to demonstrate that `await`
destroys a narrowing, alongside the callback case. It does not. Only the
`forEach` line raised an error; the `await` line was clean. The expectation was
wrong and the page is built around why.

### Why it survives

An `await` does not leave the function's own flow. The code after it is still
the same statement sequence in the same function body, and control flow analysis
walks statement sequences. Suspension and resumption are a *runtime* concern; as
far as the analysis is concerned, the next statement is simply the next
statement.

### 🔴 And that is a deliberate unsoundness

Between the suspension and the resumption, **other code ran**. If `value` is a
module-level binding, or a property of an object something else holds, a
different task can have changed it while this one was parked. The compiler is
not proving it did not; it is choosing not to model it.

That choice is defensible for the common case — a local variable no one else can
reach — and genuinely unsafe for the shared case:

```ts
let cachedUser: User | null = null;      // module scope

async function refresh() {
  if (cachedUser !== null) {
    await save(cachedUser);
    cachedUser.name;                     // string, per the compiler
  }                                      // but a concurrent logout() may have
}                                        // set cachedUser = null while we waited
```

No error, and a real `TypeError` in production. **The fix is the same `const`
capture from chunk 01**, and here it is not a workaround at all — it is
correctness. Capturing gives you the object you checked, rather than re-reading
a binding that has moved on:

```ts
const user = cachedUser;
if (user !== null) {
  await save(user);
  user.name;                             // genuinely safe
}
```

This is the single most valuable thing in the topic: **the callback case is a
false positive you work around, and the `await`-across-shared-state case is a
false negative you have to know about.** They point in opposite directions and
the same one-line habit handles both.

## Properties narrow, and stay narrowed further than you expect

TypeScript narrows *paths*, not just plain identifiers:

```ts
declare const res: { body: string | null };

if (res.body !== null) {
  res.body.length;         // string — the path res.body is narrowed
}
```

An assignment to `res.body` — or to `res` — invalidates it, as the model
predicts. What does **not** invalidate it is an intervening function call:

```ts
if (res.body !== null) {
  doSomething();           // could this set res.body = null? The compiler does not ask.
  res.body.length;         // still string
}
```

The compiler does not attempt to work out what an arbitrary call might mutate.
Doing so properly would require whole-program analysis and would make almost
every property unusable after any call, so TypeScript takes the pragmatic
position and assumes your properties survive.

**Know it as a hole, not as a guarantee.** Where a property is genuinely shared
and genuinely mutable, the same rule applies as for `await`: read it once into a
`const` and work with that.

## Aliased conditions — narrowing through a `const` boolean

Since TypeScript 4.4, a condition stored in a `const` still narrows:

```ts
declare const v: string | number;

const isString = typeof v === 'string';

if (isString) {
  v.toUpperCase();         // string — the compiler followed the alias
}
```

The compiler remembers *which check* produced `isString` and applies it at the
`if`. The same works for a stored discriminant:

```ts
const kind = shape.kind;
if (kind === 'circle') { shape.radius; }
```

**It requires `const` for the same reason everything else in this topic does** —
a `let` could have been reassigned between the check and the use, so the link
from the alias back to the check is broken. `let isString = …` narrows nothing.

This is worth knowing because it makes the "extract the condition for
readability" refactor safe, which it was not before 4.4. If you are reading an
older codebase full of inlined conditions that would be clearer named, this is
why they were written that way.

## Element access narrows only with a stable key

```ts
declare const record: Record<string, string | undefined>;
const key = 'name';                    // const — a literal type

if (record[key] !== undefined) {
  record[key].toUpperCase();           // narrowed
}
```

TypeScript 4.7 extended narrowing to element access when the key is a literal or
a `const` binding with a literal type. With a `let` key, or a computed one, the
path `record[key]` is not a stable reference — the key itself could change — and
no narrowing is kept.

## The four patterns that end the problem

**1. Capture into a `const`, immediately after the check.** Covers callbacks,
`await`, shared properties and aliases in one move. If you learn one thing from
this topic, this is it.

```ts
const body = res.body;
if (body === null) return;
// body is string everywhere below, in every closure, across every await
```

**2. Early return instead of a block.** Narrowing after a guard clause applies to
the rest of the function, which is a larger and flatter scope than an `if` body
— and it removes the nesting that makes the closure cases easy to miss.

**3. Destructure at the top.** `const { body, status } = res;` gives you `const`
bindings for free, and every subsequent narrowing is durable.

**4. Model it so the check cannot go stale.** A discriminated union
([05](../05-discriminated-unions.md)) attaches the narrowing to the *value*
rather than to a moment in the control flow, so there is no window between
checking and using.

## Gotchas

**Symptom:** A narrowing survives an `await` and the value is `null` at runtime
**Cause:** The compiler does not model concurrent mutation across a suspension —
a deliberate unsoundness.
**Fix:** Capture into a `const` **before** the check. This is a real bug class,
not a style preference.

**Symptom:** A property stays narrowed across a function call that clears it
**Cause:** TypeScript does not analyse what an arbitrary call mutates.
**Fix:** Read the property into a `const` once and use that.

**Symptom:** `const isValid = x !== null; if (isValid) { x.foo }` narrows, but the
same code with `let` does not
**Cause:** Aliased-condition narrowing (4.4) requires a `const` alias.
**Fix:** Use `const`. There is rarely a reason for the condition to be mutable.

**Symptom:** `record[key]` is not narrowed after a check
**Cause:** The key is a `let` or computed, so the access path is not stable.
**Fix:** `const key = …`, or destructure the value out first.

**Symptom:** A narrowing works in one branch of a `try`/`catch` and not the other
**Cause:** The `catch` block can be entered from any point in the `try`, so the
compiler keeps only what was true before the `try` began.
**Fix:** Do the narrowing before the `try`, or re-check inside the `catch`.

## Interview questions

**★ Does a narrowing survive an `await`? Should it?**
It does — measured. `await` does not leave the function's statement sequence, so
control flow analysis simply continues. It arguably should not: other code runs
during the suspension, so a shared binding can have changed. It is a deliberate
unsoundness, and the fix is to capture the checked value into a `const` before
awaiting.

**★ Name a case where TypeScript is too strict about narrowing and one where it
is too lenient.**
Too strict: a callback. `forEach` calls its argument immediately but nothing in
its type says so, so the narrowing is dropped and you get a false positive. Too
lenient: a property that stays narrowed across a function call, or any binding
across an `await` — both are cases where the value really can have changed and
the compiler does not ask.

**★ Why does `const isString = typeof v === 'string'` narrow but `let` does not?**
Aliased-condition analysis, added in 4.4, remembers which check produced the
boolean and re-applies it at the `if`. It requires `const` because a mutable
alias could have been reassigned between the check and the use, which would break
the link back to the original check.

**What is the one habit that fixes most narrowing losses?**
Capture the narrowed value into a `const` right after the check, and use that
binding from then on. It covers callbacks, `await`, shared properties and
aliases, and unlike `!` or `as` it makes the narrowing genuinely valid rather
than merely silencing the report.

**Why does a `catch` block not see narrowings from its `try`?**
Because the `catch` can be entered from any statement in the `try`, including
the first, so the compiler can only keep what was already true before the block
started. Narrow before the `try`, or re-check inside the handler.

---

← Prev: [01 · How a narrowing dies](./01-how-a-narrowing-dies.md) · Next → [12 · `unknown` in `catch`](../12-unknown-in-catch.md)
