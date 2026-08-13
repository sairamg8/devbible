---
title: "04 · Optional chaining `?.`"
sidebar_label: "04 · Optional chaining"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Scripts: `sandbox/js-p2/ex2-logical-optional.mjs`,
> `ex6-optional-limits.mjs`, `ex7-optional-parens.mjs`.

**`?.` short-circuits the whole chain to `undefined` when the left side is
`null` or `undefined`.** It is the single biggest reduction in defensive
boilerplate the language has added — and it protects against exactly one thing,
which people routinely over-estimate.

## Measured

```
--- optional chaining ---
  user?.profile?.name      = A
  empty?.profile?.name     = undefined
  empty.profile?.name      = undefined
  empty.profile.name       -> TypeError: Cannot read properties of undefined (reading 'name')
  user.getName?.()         = A
  user.missing?.()         = undefined
  nf.notAFunction?.()      -> TypeError: nf.notAFunction is not a function <- ?. does NOT protect this

--- short-circuit stops the whole chain ---
  empty?.a?.[side()] = undefined | side() called 0 times
```

## The three forms

```js
obj?.prop        // property access
obj?.[expr]      // dynamic key
fn?.()           // call
```

Note the syntax: `?.[` and `?.(` keep the dot. `obj?[k]` is a `SyntaxError`.

```js
// Before
const city = user && user.address && user.address.city;

// After
const city = user?.address?.city;
```

## It short-circuits the *entire* chain

```
  empty?.a?.[side()] = undefined | side() called 0 times
```

This is the part people underestimate. Once any link is nullish, **nothing
further in the chain is evaluated** — not property lookups, not index
expressions, not arguments:

```js
maybeNull?.method(expensiveArgument());   // expensiveArgument() never runs
```

But it short-circuits **only from the link that is actually nullish**, and
parentheses end the chain early. Both facts are measured:

```
u = null:
  u?.profile.name  = undefined
  (u?.profile).name-> TypeError: Cannot read properties of undefined (reading 'name')
v = {} (profile missing):
  v?.profile.name  -> TypeError: Cannot read properties of undefined (reading 'name')
  v?.profile?.name = undefined
```

Two lessons, and the second one catches people:

1. **Parentheses break the protection.** `u?.profile.name` is `undefined` when
   `u` is `null`, but `(u?.profile).name` **throws** — the parens end the chain,
   so `.name` runs on `undefined`. Never parenthesise part of a chain.
2. **One `?.` does not protect the whole path.** `v?.profile.name` still throws
   when `v` exists but `profile` does not, because `v` is not nullish so nothing
   short-circuits. **Put `?.` at every link that can genuinely be missing** —
   `v?.profile?.name`.

## What it does **not** protect against

```
  nf.notAFunction?.()   -> TypeError: nf.notAFunction is not a function
```

**`?.()` only guards `null` and `undefined`.** If the property exists and is not
callable, you still get a `TypeError`. `?.()` means "call it if it exists", not
"call it if it is callable".

The three other things it does not do:

1. **It does not catch a missing *variable*.** Measured, `notDeclaredVar?.x`
   throws `ReferenceError: notDeclaredVar is not defined` — the variable must
   exist; only its *value* may be nullish. Use `typeof v !== 'undefined'`.
2. **It does not make an assignment safe.** Measured, `o?.a = 1` is
   `SyntaxError: Invalid left-hand side in assignment` — optional chaining is
   read-only by design.
3. **It does not distinguish "missing" from "present but undefined."** Measured:
   `{k: undefined}?.k` and `{}?.k` both give `undefined`, while `Object.hasOwn`
   returns `true` and `false`. Use `hasOwn` when that distinction matters.

## `?.` with `??` is the idiom

```js
const qty = cart?.items?.[0]?.qty ?? 1;
```

`?.` produces `undefined` for a missing path; `??` supplies the default. Together
they replace a five-line guard, and unlike `||` they preserve a legitimate `0`
([page 03](./03-logical-operators.md)).

Real shapes from an API:

```js
const primaryImage = product?.media?.images?.[0]?.url ?? PLACEHOLDER;
const discountPct  = order?.promotion?.discountPct ?? 0;
order?.onApplied?.(discountPct);       // fire the callback only if provided
```

That last line is the common callback pattern — safe when `onApplied` is absent,
and still throwing (correctly) if someone passes a non-function.

## When *not* to use it

`?.` is easy to over-apply, and over-applying it hides bugs:

```js
// ❌ If `user` should always exist here, this silently produces undefined
//    and the failure surfaces three layers away.
const name = user?.profile?.name;

// ✅ Assert the invariant, then access plainly
if (!user) throw new Error('user is required');
const name = user.profile?.name;      // only `profile` is genuinely optional
```

**Use `?.` where the value is genuinely optional, not to silence errors.** A
`TypeError` at the point of the broken assumption is more useful than an
`undefined` that travels. This is the same argument as `catch {}` being worse
than an uncaught throw.

TypeScript reinforces this: if a type says the field is non-optional, `?.` on it
is a signal that either the type or the code is wrong.

## Gotchas

**Symptom:** `TypeError: x is not a function` despite using `?.()`.
**Cause:** `?.()` guards only `null`/`undefined`; the property exists and holds a
non-function.
**Fix:** `typeof fn === 'function' && fn()` when the type is genuinely uncertain.

**Symptom:** `ReferenceError` from `maybeVar?.x`.
**Cause:** the *variable* is undeclared; `?.` requires it to exist.
**Fix:** `typeof maybeVar !== 'undefined'`, or fix the import.

**Symptom:** `(a?.b).c` throws even though `?.` is present.
**Cause:** the parentheses terminate the chain, so `.c` runs on `undefined`.
**Fix:** do not parenthesise part of a chain.

**Symptom:** `a?.b.c` throws when `a` exists but `b` does not.
**Cause:** `?.` guards only the link it is on. `a` is not nullish, so nothing
short-circuits, and `.c` then runs on `undefined`.
**Fix:** `a?.b?.c` — one `?.` per optional link.

**Symptom:** `SyntaxError` on `obj?.a = 1`.
**Cause:** optional chaining cannot be an assignment target.
**Fix:** guard with `if (obj)` and assign normally.

**Symptom:** a bug surfaced far from its cause, as an `undefined`.
**Cause:** `?.` used on a value that should have been guaranteed, converting a
loud failure into a quiet one.
**Fix:** assert the invariant; reserve `?.` for genuinely optional values.

**Symptom:** `SyntaxError` on `obj?[key]`.
**Cause:** the dynamic form keeps the dot.
**Fix:** `obj?.[key]`.

## Interview questions

**★ What does `?.` protect against, and what does it not?**
It short-circuits the chain to `undefined` when the left side is `null` or
`undefined`. It does **not** protect against a non-callable value — measured,
`nf.notAFunction?.()` still throws `TypeError: nf.notAFunction is not a
function`. It also does not help with an undeclared variable (that is a
`ReferenceError`) and cannot be an assignment target.

**★ How far does the short-circuit reach?**
From the nullish link to the end of the chain, including index expressions and
call arguments — measured, `empty?.a?.[side()]` returned `undefined` with
`side()` called **zero** times. Two limits: parentheses end the chain, so
`(u?.profile).name` throws even when `u` is `null`; and a single `?.` only guards
*its own* link — `v?.profile.name` still throws when `v` exists but `profile`
does not.

**★ When should you not use optional chaining?**
When the value is supposed to be present. `?.` on a guaranteed value converts a
`TypeError` at the point of the broken assumption into an `undefined` that
propagates and fails somewhere unrelated. Assert the invariant, and reserve `?.`
for genuinely optional fields.

**How do `?.` and `??` work together?**
`?.` yields `undefined` for a missing path and `??` supplies the default:
`cart?.items?.[0]?.qty ?? 1`. Unlike `||`, this preserves a legitimate `0`.

**Can you use `?.` to write a property?**
No. `obj?.a = 1` is a `SyntaxError` — optional chaining is deliberately
read-only.

---

← [03 · Logical operators](./03-logical-operators.md) · [Phase index](./) · Next: [05 · Loops](./05-loops.md) →
