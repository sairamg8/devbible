---
title: "The shapes in practice"
sidebar_label: "03 · The shapes in practice"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types*) and the **4.0 release
> notes** (variadic tuple types, labelled tuple elements). Decorator typing is deliberately
> **not** developed here — [phase 4 · topic 13](../../phase-4-classes-declarations/13-decorators.md)
> owns the two incompatible decorator systems, and this page links to it rather than picking one.
> **No sandbox, no console block.** The four shapes and their trade-offs are **judgement**,
> assembled from the mechanics in chunks [01](./01-the-wrapper-signature.md) and
> [02](./02-what-it-loses.md).

Four shapes cover nearly every real use of this topic. Each is given with the signature that
holds up — not the one that compiles first.

## Shape 1 · Transparent wrapper — same type, more behaviour

Caching, logging, timing, error translation. **The signature must be indistinguishable from the
original**, because the point is that callers do not change.

```ts
function memoize<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const cache = new Map<string, R>();
  return (...args: A): R => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key)!;
  };
}
```

📌 **Note what this does *not* use.** No `Parameters`, no `typeof` — the tuple `A` and the return
`R` are inferred **at the call site**, which is why this shape survives overloads and generics
where a derived version would not ([chunk 02](./02-what-it-loses.md)).

> 🔴 **Infer the parameter tuple; do not extract it.** `<A extends unknown[], R>` is the shape to
> reach for first, and `Parameters<F>` only when you must name the type without a value in hand.

⚠️ **The cache key is the honest weakness**, not the types: `JSON.stringify` cannot key on
functions, `undefined` versus absent, `Map` instances or key order. A memoizer with a perfect
signature and a wrong key is worse than none.

## Shape 2 · Async-ifying wrapper — the return type changes

Retry, queueing, batching, anything that must await:

```ts
function retried<A extends unknown[], R>(
  fn: (...args: A) => R,
  attempts = 3,
): (...args: A) => Promise<Awaited<R>> {
  return async (...args: A) => {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try { return (await fn(...args)) as Awaited<R>; }
      catch (e) { last = e; }
    }
    throw last;
  };
}
```

Two deliberate details:

- **`Promise<Awaited<R>>`** — correct whether `fn` was sync or async
  ([chunk 01](./01-the-wrapper-signature.md)). `Promise<R>` would double-wrap the async half.
- **The `as Awaited<R>`** is a real assertion and it is where the honesty lives: `await`ing an
  `R` that *might* be a promise is exactly the case the compiler cannot narrow generically. One
  assertion, in the wrapper, at a line you can review — rather than `any` spread over the body.

⚠️ **`catch (e)` gives `unknown`**, deliberately, and rethrowing it is right. Do not annotate it
as `Error`; phase 10 owns the argument
([`catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md)).

## Shape 3 · Adapter — one argument supplied, the rest forwarded

Dependency injection, partial application, currying by one:

```ts
type Tail<T extends readonly unknown[]> =
  T extends readonly [unknown, ...infer R] ? R : [];

function withClient<A extends [Client, ...unknown[]], R>(
  fn: (...args: A) => R,
  client: Client,
): (...rest: Tail<A>) => R {
  return (...rest) => fn(...([client, ...rest] as unknown as A));
}
```

Three things worth being explicit about:

- **The constraint `[Client, ...unknown[]]`** is what makes the first parameter's meaning part of
  the type rather than a comment.
- **`Tail<A>` keeps the remaining parameters' arity, optionality and labels** — the payoff from
  [chunk 01](./01-the-wrapper-signature.md). Writing `(...rest: unknown[])` would throw all three
  away.
- **The assertion in the body is unavoidable** here: the compiler cannot verify that
  `[client, ...rest]` reconstitutes `A`, because `A` is a variable. Again: one reviewable
  assertion, isolated in a helper.

📌 **Variadic tuple manipulation in general — `Head`, `Tail`, `Last`, currying to arbitrary
depth — is 13 · Tuple manipulation** *(not written yet)*. This page uses one pattern; that topic
develops them.

## Shape 4 · Adapter that changes a parameter's *type*

The shape people get wrong most often, because it looks like shape 3:

```ts
// take the original's parameters, replace the first, keep the rest
type Replace1<A extends readonly unknown[], T> =
  A extends readonly [unknown, ...infer Rest] ? [T, ...Rest] : [T];

function acceptingId<A extends [User, ...unknown[]], R>(
  fn: (...args: A) => R,
  lookup: (id: string) => User,
): (...args: Replace1<A, string>) => R {
  return (id, ...rest) => fn(...([lookup(id), ...rest] as unknown as A));
}
```

**Why this is the fragile one:** the derived parameter list is now *neither* the original's nor
one you wrote, so a mistake in `Replace1` produces a signature that is subtly wrong at every call
site and named nowhere. [Topic 08 · chunk 04](../08-knowing-when-to-stop/04-the-stopping-tests.md)
applies directly — if the wrapper is used in three places, **write the two signatures out.**

## Decorators are the same problem with a different surface

A decorator is a wrapper whose signature is dictated by the decorator protocol rather than by you,
and **there are two incompatible protocols in circulation** — told apart by their parameter lists.
Which one you are typing decides everything, so that argument lives with the feature:
[phase 4 · Decorators](../../phase-4-classes-declarations/13-decorators.md).

What transfers from this page: the *inner* function you return is shape 1 or shape 2, and the same
rules apply — infer the tuple, use `Awaited` when you add a promise, and keep `this` if the
original had one.

## The four shapes, chosen by what changes

| What changes | Shape | Signature |
|---|---|---|
| Nothing — behaviour only | 1 · transparent | `(...args: A) => R` |
| The return becomes a promise | 2 · async-ifying | `(...args: A) => Promise<Awaited<R>>` |
| One argument is supplied | 3 · adapter | `(...rest: Tail<A>) => R` |
| One argument's type | 4 · re-typing adapter | `(...args: Replace1<A, T>) => R` — **write it by hand if used rarely** |

## Gotchas

**Symptom:** The memoized function's type drifted from the original after a refactor.
**Cause:** The wrapper re-declared the parameters instead of inferring the tuple.
**Fix:** `<A extends unknown[], R>` and `(...args: A) => R`.

**Symptom:** Memoization returns stale or wrong values despite correct types.
**Cause:** The key, not the types — `JSON.stringify` cannot distinguish `undefined` from absent,
cannot key functions, and is order-sensitive on objects.
**Fix:** A key function chosen for the arguments you actually have; types cannot help here.

**Symptom:** The retried wrapper's callers get `Promise<Promise<T>>`.
**Cause:** `Promise<R>` where `R` was already a promise.
**Fix:** `Promise<Awaited<R>>`.

**Symptom:** The retry body needs `as Awaited<R>` and a reviewer objects to the assertion.
**Cause:** Genuine limit — `await` on a generic `R` cannot be narrowed.
**Fix:** Keep the single assertion and say why in a comment. The alternative is `any` across the
body, which is worse and less visible.

**Symptom:** An adapter's forwarded parameters lost their optional markers.
**Cause:** `(...rest: unknown[])` instead of `Tail<A>`.
**Fix:** Derive the tail with a variadic pattern.

**Symptom:** `fn(...[client, ...rest])` does not type-check.
**Cause:** The compiler cannot prove the reconstructed tuple is `A`.
**Fix:** One assertion, in the helper. Do not widen the parameter types to avoid it.

**Symptom:** A re-typing adapter produced a signature nobody can read.
**Cause:** Shape 4 on a rarely-used function.
**Fix:** Write the two concrete signatures. This is the stopping test, not a failure of nerve.

**Symptom:** A decorator's wrapper type-checks in one project and not another.
**Cause:** Two decorator protocols; the projects differ in configuration.
**Fix:** [Phase 4 · Decorators](../../phase-4-classes-declarations/13-decorators.md) — identify
which protocol before typing anything.

**Symptom:** A method wrapped by shape 1 loses its receiver.
**Cause:** `this` is not in the inferred tuple, exactly as in
[chunk 01](./01-the-wrapper-signature.md).
**Fix:** Declare `this: ThisParameterType<F>` on the returned function.

## Interview questions

**★ Write a `memoize` whose type is indistinguishable from the wrapped function.**
`function memoize<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R` — infer the
parameter tuple and return type at the call site rather than extracting them with `Parameters`.
That is what makes it survive overloaded and generic inputs, which a derived signature would
flatten. The interesting weakness is the cache **key**, not the types: `JSON.stringify` cannot key
functions, cannot distinguish `undefined` from an absent argument, and depends on property order.

**★ Why `Promise<Awaited<R>>` in an async-ifying wrapper?**
Because the wrapped function may already be async. `Promise<R>` is correct for the sync case and
produces `Promise<Promise<T>>` for the async one — wrong for half the callers, and the half nobody
tests. `Awaited` collapses it either way, which is why it belongs in every wrapper that adds a
promise to a derived return type.

**★ You need an assertion inside the retry wrapper. Is that a failure?**
No — it is the honest expression of a real limit: `await` on a generic `R` that *may* be a promise
cannot be narrowed by the compiler. The judgement is about *containment*: one asserted expression
inside a reviewed helper is far better than loosening the body to `any`, because the unsound step is
visible, singular, and greppable.

**★ How do you supply one argument and forward the rest without losing anything?**
Constrain the input to `[Client, ...unknown[]]` so the first parameter's meaning is in the type,
and derive the forwarded list with a variadic pattern — `Tail<A>` via
`A extends readonly [unknown, ...infer R] ? R : []` — which preserves the remaining parameters'
arity, optional markers and labels. `(...rest: unknown[])` discards all three. The body needs one
assertion because the compiler cannot prove the rebuilt tuple is `A`.

**Which of the four shapes should you be most reluctant to write?**
Shape 4, the adapter that changes a parameter's *type*. Its signature is neither the original's nor
one you wrote, so an error in the transformation is wrong at every call site and named nowhere. If
the wrapper has a handful of uses, two hand-written signatures are shorter, checkable and
readable — the stopping tests reaching the obvious conclusion.

**Why does this topic recommend inferring the tuple over `Parameters<F>`?**
Because inference happens per call site, so it resolves the *right* overload and preserves
genericity, while `Parameters<F>` collapses overloads to the last signature and instantiates type
parameters away. Extraction earns its place when you must name a function's type without having a
generic position to infer in — typing a variable, a registry entry, a `.d.ts` declaration.

**Where do decorators fit?**
The returned inner function is shape 1 or shape 2 and follows every rule here. What differs is the
*outer* signature, which the decorator protocol dictates — and there are two incompatible protocols
in circulation, distinguishable by their parameter lists. Identify the protocol first; phase 4's
decorators topic is where that is settled.

---

← Prev: [02 · What it quietly loses](./02-what-it-loses.md) · [Topic index](./README.md) ·
Next → **11 · Recursive types** *(not written yet)*
