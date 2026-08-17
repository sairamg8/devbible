---
title: "no-misused-promises — a promise where a value was expected"
sidebar_label: "03 · no-misused-promises"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own rule page** for
> `no-misused-promises` — description, preset, and all three top-level options with
> the six `checksVoidReturn` sub-options, quoted from it — and the **TypeScript
> 5.9.3 diagnostic table** for the codes this rule overlaps with (`TS2801`,
> `TS2367`, `TS2774`), which were read there. ⚠️ typescript-eslint is not installed
> here, so rule metadata is from documentation. **No sandbox, no console block.**

The sibling of [`no-floating-promises`](./02-no-floating-promises.md), and the
relationship is worth stating precisely: **that rule is about a promise nobody
used; this one is about a promise used in a place that cannot handle it.**

Description, verbatim: *"Disallow Promises in places not designed to handle
them."*

> 🔴 **This rule partially overlaps the compiler, and the overlap is uneven.** One
> of its three checks duplicates diagnostics you already get; the other two find
> a bug class `tsc` will never report. **Knowing which is which is the difference
> between "we already have `strict`, we do not need this" and adopting it.**

## The three checks, and their defaults

| Option | Default | What it catches |
|---|---|---|
| `checksConditionals` | `true` | a promise used as a condition — ⚠️ **largely covered by the compiler** |
| `checksVoidReturn` | `true` | 🔴 an `async` function passed where `void` was expected — **the compiler says nothing** |
| `checksSpreads` | `true` | spreading a promise with `...` |

### ⚠️ `checksConditionals` is the part you may already have

```ts
if (isReady()) { … }        // isReady is async
```

The compiler already reports this as `TS2801` — *"This condition will always return
true since this '{0}' is always defined."* — and a comparison instead of a
condition gets `TS2367` with a `TS2773` *"Did you forget to use 'await'?"* hint
attached ([topic 10 chunk 11](../10-the-error-codes/11-the-condition-is-decided.md)).

📌 **So `checksConditionals` is the least valuable of the three on a `strict`
codebase**, and it is the one people cite when arguing the rule is redundant. It
still earns its place in places the compiler's checks do not reach — a promise in a
`.filter()` callback's return position, where the callback's declared return type is
`unknown`-ish or the promise is one branch of a union — but if you were ranking the
three, this is third.

### 🔴 `checksVoidReturn` is the reason to adopt the rule

This is the check with no compiler equivalent, and it finds a genuinely nasty bug:

```ts
items.forEach(async (item) => {
  await save(item);          // ← forEach does not wait
});
console.log("all saved");    // ← runs before any save finishes
```

**`Array.prototype.forEach` is typed to take a callback returning `void`.** Passing
an `async` function returns a `Promise<void>` instead — and `void` is a
*deliberately* permissive return position in TypeScript, so the compiler **allows a
function returning anything to be used where `void` is expected.** That rule exists
so `[1,2].forEach(x => arr.push(x))` works without complaint, and the price is
that `forEach(async …)` type-checks perfectly.

🔴 **So this is not an oversight either — it is a documented assignability rule
producing an unwanted result in one position.** No flag changes it; the rule is
load-bearing for ordinary code. A lint rule that knows the callback is `async` is
the only available check.

**The six sub-options are the six positions where a `void` return can be
promised:**

| Sub-option | The position |
|---|---|
| `arguments` | an `async` function passed as a parameter — the `forEach` case |
| `attributes` | a JSX attribute — `onClick={async () => …}` |
| `properties` | an object property — a config object's callback |
| `returns` | returned from a function whose return type is `void` |
| `variables` | assigned to a `void`-returning variable |
| `inheritedMethods` | 🔴 an `async` method implementing an interface that declared it `void` |

📌 **`inheritedMethods` is the subtle one and the most commonly disabled.** A base
class or interface declares `setThing(): void`, an implementation is `async
setThing()`, and now no caller can await it — because the *contract* says there is
nothing to await. **That is a real design bug**, and it is why the fix is usually to
change the interface to `Promise<void>` rather than to disable the check.

⚠️ **`attributes` is the one that generates the most noise in React codebases**,
because `onClick={async () => { await submit(); }}` is extremely common and often
fine. If you disable one sub-option, it is usually this — and the honest
alternative is a wrapper that catches, since an unhandled rejection from a click
handler goes nowhere useful.

### `checksSpreads`

```ts
const merged = { ...getConfig() };      // getConfig is async
```

Spreading a promise gives you an object with the promise's own enumerable
properties — which is none of them. **The result is `{}`**, silently. The compiler
is content because spreading any object is legal.

## The fixes, by shape

```ts
// 1. sequential — when order matters or you want backpressure
for (const item of items) await save(item);

// 2. concurrent — when it does not
await Promise.all(items.map(item => save(item)));

// 3. bounded concurrency — when "all at once" would overwhelm something
//    (a queue, a semaphore, or a library; not a one-liner)

// 4. the void-return contract is wrong — fix the contract
interface Store { setThing(v: T): Promise<void> }   // was: void
```

⚠️ **`Promise.all` is not always the right answer**, and reaching for it reflexively
is the second bug in this area: a hundred rows becomes a hundred simultaneous
database writes. **`for…of` with `await` is the safe default**; concurrency is an
optimisation you choose.

📌 **`Promise.allSettled` when partial failure is acceptable.** `Promise.all`
rejects on the first failure and abandons the rest — usually wrong for a batch of
independent writes, where you want to know which ones failed.

## Where this connects

- **[Chunk 02](./02-no-floating-promises.md)** — the two rules together cover the
  promise mistakes: one where the value is dropped, one where it is handed to
  something that cannot use it. **Both are in `recommended-type-checked`**, and
  they are the pair that justifies the whole preset.
- **[Topic 10 chunk 11](../10-the-error-codes/11-the-condition-is-decided.md)** —
  the compiler's `TS2801`/`TS2367`/`TS2774` family, which is what
  `checksConditionals` mostly duplicates.
- **[Phase 7 · Typed Express handlers](../../phase-7-server/05-typed-express-handlers/02-a-promise-the-compiler-cannot-keep.md)**
  — Express 4's handler signature is a `void` return position, so this is the same
  mechanism in the framework the rest of that phase is built on.

## Gotchas

**Symptom:** `forEach(async …)` type-checks and does the wrong thing.
**Cause:** `void` is a permissive return position by design, so a
`Promise<void>`-returning callback is assignable to a `void`-returning parameter.
**Fix:** `for…of` with `await`, or `Promise.all(map(…))`. The permissiveness is
load-bearing for ordinary code and will not be changed.

**Symptom:** a log line after a loop runs before the loop's work finishes.
**Cause:** the loop was `forEach` with an `async` callback, so nothing awaited it.
**Fix:** as above. ⚠️ This one is easy to misdiagnose as a database or ordering
problem.

**Symptom:** the rule fires on every `onClick={async …}` in a React codebase.
**Cause:** the `attributes` sub-option of `checksVoidReturn`.
**Fix:** it is a real finding — an unhandled rejection from a handler goes nowhere
— but if you disable one sub-option this is the usual one. Prefer a small wrapper
that catches and surfaces the error.

**Symptom:** the rule complains about an `async` method that implements an
interface.
**Cause:** `inheritedMethods` — the interface declared the method `void`, so
callers cannot await it.
**Fix:** change the interface to `Promise<void>`. Disabling the check leaves an API
whose asynchrony is unrepresentable.

**Symptom:** `{ ...getConfig() }` produces an empty object.
**Cause:** you spread a promise. `checksSpreads` is the check for it.
**Fix:** `{ ...(await getConfig()) }`.

**Symptom:** `Promise.all` was used to satisfy the rule and now the database is
saturated.
**Cause:** the fix converted sequential work into unbounded concurrency.
**Fix:** `for…of` with `await` unless concurrency is wanted, and bounded
concurrency if it is.

**Symptom:** the rule feels redundant because `strict` already flags promises in
conditions.
**Cause:** it is partly redundant — `checksConditionals` overlaps `TS2801` and
`TS2367`.
**Fix:** adopt it for `checksVoidReturn`, which has no compiler equivalent. Judging
the rule on its conditional check is judging it on its weakest third.

**Symptom:** `Promise.all` rejects and you cannot tell which items succeeded.
**Cause:** `Promise.all` rejects on first failure.
**Fix:** `Promise.allSettled` for independent work, then inspect the results.

## Interview questions

**Why does `items.forEach(async item => await save(item))` type-check?**
Because `forEach`'s callback is typed to return `void`, and TypeScript
deliberately allows a function returning *any* type to be used where `void` is
expected. That permissiveness exists so ordinary code like
`arr.forEach(x => other.push(x))` works — `push` returns a number — and the price
is that an `async` callback, which returns `Promise<void>`, is equally acceptable.
No compiler flag changes it, which is why a lint rule is the only available check.

**Which of `no-misused-promises`' three checks matters most, and why?**
`checksVoidReturn`. `checksConditionals` largely duplicates the compiler's `TS2801`
and `TS2367`, and `checksSpreads` catches something rare. `checksVoidReturn` is the
one with no compiler equivalent, and it finds the `forEach(async …)` family of bugs
across six positions — arguments, JSX attributes, object properties, return
positions, variable assignments, and inherited method implementations.

**What is the `inheritedMethods` check and why should you not disable it?**
It flags an `async` method implementing an interface that declared the method as
returning `void`. That combination means no caller can ever await the method,
because the contract says there is nothing to wait for — so the asynchrony is
unrepresentable in the type. Disabling the check leaves the API broken; the fix is
to change the interface to `Promise<void>`.

**Someone fixes a `forEach(async …)` warning with `Promise.all`. Is that right?**
Sometimes. It is correct when the operations are independent and concurrency is
acceptable, and wrong when it turns a hundred sequential writes into a hundred
simultaneous ones. `for…of` with `await` is the safe default; concurrency is an
optimisation you should choose deliberately. And if partial failure is acceptable,
`Promise.allSettled` is usually the right variant, because `Promise.all` abandons
the remaining work on the first rejection.

**Why is `{ ...somePromise }` a bug the compiler allows?**
Because spreading an object is always legal, and a promise is an object. Its own
enumerable properties are none, so the result is `{}` — an empty object where you
expected config. The type system has no rule against it; `checksSpreads` is what
notices.

**How do `no-floating-promises` and `no-misused-promises` divide the work?**
The first is about a promise nobody used at all — a bare statement with no `await`.
The second is about a promise handed to something that cannot handle it: a
condition, a spread, or a position typed to return `void`. Together they cover the
promise mistakes, both ship in `recommended-type-checked`, and they are the pair
that justifies paying for typed linting at all.

---

← [02 · `no-floating-promises`](./02-no-floating-promises.md) · [Topic index](./README.md) · Next → [04 · `no-unnecessary-condition`](./04-no-unnecessary-condition.md)
