---
title: "The wrapper signature"
sidebar_label: "01 · The wrapper signature"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* — `Parameters`,
> `ReturnType`, `Awaited`, `ThisParameterType`, `OmitThisParameter`; *Variadic Tuple Types* in
> the **4.0 release notes** for labelled tuple elements). The mechanisms themselves are
> **already written and are not repeated here** — [topic 03 · chunk 04](../03-utility-types/04-extractors.md)
> owns the family and the overload rule. **No sandbox, no console block.** Signature-design
> recommendations are **judgement**, marked where they appear.

You have the extractors. This topic is the thing people actually reach for them for: **a
function whose type is defined by another function's type** — a wrapper, a decorator, an
adapter, a retry helper, an instrumented copy.

The whole topic hangs off one line, and it is worth learning as a unit:

```ts
type Wrapped<F extends (...a: never[]) => unknown> =
  (...a: Parameters<F>) => ReturnType<F>;
```

Everything else is a variation: making it async, keeping `this`, changing one parameter,
dropping one.

## Why the constraint is `(...a: never[]) => unknown`

This is the part that gets copied without being understood, and it is a genuine two-way
decision.

```ts
// ✅ a constraint you only MATCH against
type Wrapped<F extends (...a: never[]) => unknown> = /* … */;

// ✅ a signature you intend to CALL
type AnyFn = (...a: any[]) => unknown;
```

**Parameters are contravariant**, so a function type with `never` parameters is the *widest*
possible upper bound: every function is assignable to it, because every parameter type accepts
`never`. That makes `(...a: never[]) => unknown` the correct **bound** — it excludes nothing.

But you cannot *call* such a value, since you have nothing to pass. So:

> 🔴 **`never[]` for a constraint you match against; `any[]` for a signature you intend to
> invoke.** They are not interchangeable, and picking the wrong one produces either a bound
> that rejects real functions or a value you cannot call.

📌 **The same decision, already worked through on the class side:**
[phase 4 · Mixins](../../phase-4-classes-declarations/14-mixins/01-the-pattern.md) uses
`new (...args: any[]) => T` for exactly this reason — a construct signature you intend to call
needs parameters you can supply.

⚠️ **`Function` is not a substitute for either.** It accepts anything, gives you no parameter
types, and returns `any` when called.

## The three variations you will need

### Async — wrap the return in a promise, without double-wrapping

```ts
type Asyncified<F extends (...a: never[]) => unknown> =
  (...a: Parameters<F>) => Promise<Awaited<ReturnType<F>>>;
```

`Awaited` is what stops `Promise<Promise<User>>` when the wrapped function was already async
([topic 03 · chunk 04](../03-utility-types/04-extractors.md) has its recursive definition). Use
it every time you add a `Promise` around a derived return type — the alternative is a type that
is wrong only for the async half of your callers.

### `this` — preserved, or deliberately removed

```ts
// keep the receiver the original required
type Bound<F extends (...a: never[]) => unknown> =
  (this: ThisParameterType<F>, ...a: Parameters<F>) => ReturnType<F>;

// the wrapper supplies the receiver itself
type Detached<F extends (...a: never[]) => unknown> =
  (...a: Parameters<OmitThisParameter<F>>) => ReturnType<F>;
```

`Parameters<F>` **does not include** a `this` parameter — `this` is not a positional argument —
so a naive wrapper silently loses the receiver requirement. If the function you are wrapping
declares one, choose explicitly.

### One parameter changed, the rest forwarded

```ts
// replace the first argument's type, keep the tail exactly as declared
type WithClient<F extends (c: never, ...rest: never[]) => unknown> =
  (client: Client, ...rest: Tail<Parameters<F>>) => ReturnType<F>;

type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];
```

The variadic-tuple machinery behind `Tail` belongs to **13 · Tuple manipulation** *(not written
yet)*; what belongs here is the shape — **spread a derived tuple into a parameter list** — and
the fact that it is the only way to keep the tail's arity, optionality and labels intact.

## Labels and optionality survive; that is the point

Because `Parameters<F>` is a tuple, spreading it back into a parameter list keeps more than the
types:

```ts
declare function send(to: string, body?: string): void;

type Fwd = (...a: Parameters<typeof send>) => void;
// (to: string, body?: string) => void — the optional marker survives
```

Labelled tuple elements (**4.0**) are why the derived signature can still show *names* in
editor hints rather than `args_0`, `args_1`. **Judgement:** this is the strongest argument for
deriving a wrapper's signature rather than re-typing it — hand-written copies lose optionality
and labels first, and nobody notices until a caller does.

## `typeof` needs a value, and that is a constraint on your design

`Parameters<F>` takes a **type**; `Parameters<typeof send>` is how you get one from a function
you have. So a derived wrapper requires the wrapped function to be **in scope as a value** at
the point you write the type
([phase 3 · the `typeof` type operator](../../phase-3-generics/07-typeof-type-operator.md)).

📌 **Consequence worth planning for:** if the function is only available at runtime — chosen
from a registry, imported dynamically — you cannot name its type this way, and you are back to
a generic parameter inferred at the call site. That is the normal shape anyway, and it is
better: `function wrap<F extends …>(fn: F): Wrapped<F>` infers `F` per call and needs no
`typeof`.

## Gotchas

**Symptom:** The constraint `(...a: never[]) => unknown` rejects nothing, and inside the
implementation you cannot call `fn`.
**Cause:** That bound is for matching, not invoking.
**Fix:** Keep the bound and type the *implementation* parameter as `any[]`-ish internally, or
constrain with `(...a: any[]) => unknown` if the type itself must be callable.

**Symptom:** A wrapped async function's return type became `Promise<Promise<T>>`.
**Cause:** `Promise<ReturnType<F>>` on an already-async function.
**Fix:** `Promise<Awaited<ReturnType<F>>>`.

**Symptom:** The wrapper works everywhere except on methods, which complain about `this`.
**Cause:** `Parameters<F>` drops the `this` parameter.
**Fix:** `ThisParameterType<F>` to keep it, or `OmitThisParameter<F>` if the wrapper supplies
the receiver.

**Symptom:** The derived signature shows `args_0: string` in hints instead of the real names.
**Cause:** The tuple lost its labels — usually rebuilt by hand somewhere in the chain.
**Fix:** Spread `Parameters<F>` directly rather than reconstructing a tuple from its elements.

**Symptom:** An optional parameter became required in the wrapper.
**Cause:** Same thing — a hand-rebuilt tuple, or a `Tail` implementation that drops modifiers.
**Fix:** Use a variadic pattern that preserves the rest (`[unknown, ...infer R]`), and check the
hover.

**Symptom:** `Parameters<F>` errors with `F` not assignable to `(...args: any) => any`.
**Cause:** `F` is not constrained to a function type at all.
**Fix:** Add the bound. This is the error the bound exists to prevent.

**Symptom:** You cannot write `typeof fn` because `fn` is selected at runtime.
**Cause:** `typeof` needs a value in scope.
**Fix:** Make the wrapper generic and let inference supply `F` at the call site.

**Symptom:** `Function` was used as the constraint and every wrapper returns `any`.
**Cause:** `Function` carries no signature information.
**Fix:** A call signature with a rest parameter. Never `Function`.

## Interview questions

**★ Write the signature of a wrapper that preserves the wrapped function's type.**
`type Wrapped<F extends (...a: never[]) => unknown> = (...a: Parameters<F>) => ReturnType<F>` —
and spreading `Parameters<F>` rather than re-declaring the parameters is what keeps arity,
optionality and labelled names intact. For an async wrapper the return is
`Promise<Awaited<ReturnType<F>>>`, because `Awaited` prevents double-wrapping a function that
already returned a promise.

**★ Why is the constraint `never[]` and not `any[]`?**
Because parameters are contravariant, so a function type whose parameters are `never` is the
widest upper bound — every function is assignable to it, which is exactly what a constraint
should be. The trade-off is that you cannot *call* such a value, having nothing to pass, so a
signature you intend to invoke wants `any[]` instead. Constraint you match against: `never[]`.
Signature you call: `any[]`.

**★ What does `Parameters<F>` silently drop, and why does it matter for a wrapper?**
The `this` parameter, because `this` is not positional. A method wrapped by a naive
`(...a: Parameters<F>) => ReturnType<F>` loses the receiver requirement, so the wrapper type-checks
in places the original would not. Keep it with `ThisParameterType<F>`, or strip it deliberately
with `OmitThisParameter<F>` when the wrapper supplies the receiver.

**★ Why derive a wrapper's signature rather than write it out?**
Because the hand-written copy loses the details first: a parameter's optional marker, the
labelled names that show in editor hints, and the exact arity of a rest parameter. Deriving keeps
all of them, and it cannot drift when the wrapped function changes. It is the case where the
input is genuinely open — the caller's own function — which is
[topic 08](../08-knowing-when-to-stop/04-the-stopping-tests.md)'s test 2 answering "compute it".

**What is the role of `Awaited` here specifically?**
To make the wrapper correct for both sync and async inputs with one type. `Promise<ReturnType<F>>`
is right for a synchronous function and produces `Promise<Promise<T>>` for an asynchronous one —
a type that is wrong for half your callers and passes review because the sync case was the one
tested.

**When can you not use `typeof fn` to derive a wrapper?**
When the function is not in scope as a value where the type is written — chosen from a registry,
resolved dynamically, or passed in from elsewhere. The answer is not a cleverer type: make the
wrapper generic (`function wrap<F extends (...a: never[]) => unknown>(fn: F): Wrapped<F>`) and let
inference supply `F` at each call site. That is the better shape regardless.

**Why never use `Function` as the constraint?**
Because it carries no signature information: you get no parameter types, no return type, and
calling it yields `any`. Every benefit of this topic comes from the call signature being visible
to the type system, and `Function` is the one bound that hides it.

---

← [Topic index](./README.md) · Next → **02 · What derivation quietly loses** *(not written yet)*
