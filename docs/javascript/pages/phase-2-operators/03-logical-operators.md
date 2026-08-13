---
title: "03 · Logical operators return operands"
sidebar_label: "03 · Logical operators"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex2-logical-optional.mjs`.

**`&&` and `||` do not return `true` or `false`. They return one of their
operands.** Once you see that, the default-value idiom, the JSX conditional
render and the "why is `0` on my screen" bug are all the same fact.

## Measured

```
--- logical operators return OPERANDS, not booleans ---
  'a' && 'b'      = "b"
  0 && 'b'        = 0
  '' || 'fallback'= "fallback"
  null ?? 0       = 0
  0 ?? 'f'        = 0

--- ?? cannot be mixed with || or && unparenthesised ---
  null ?? 1 || 2       -> SyntaxError
  (null ?? 1) || 2     = 1
  null ?? (1 || 2)     = 1
  true && 1 ?? 2       -> SyntaxError
```

## The rules

| Operator | Evaluates right side when left is | Returns |
|---|---|---|
| `&&` | truthy | the **right** operand; otherwise the left |
| `\|\|` | falsy | the **right** operand; otherwise the left |
| `??` | `null` or `undefined` | the **right** operand; otherwise the left |

Read as sentences:

- **`a && b`** — "if `a` is falsy, give me `a`; otherwise give me `b`."
- **`a \|\| b`** — "if `a` is truthy, give me `a`; otherwise give me `b`."

Hence `0 && 'b'` is `0`, not `false`. And `'a' && 'b'` is `'b'`, not `true`.

## Short-circuiting is the point

The right-hand side is **not evaluated** when the left decides the result:

```js
user && logVisit(user);           // logVisit runs only for a truthy user
cache[key] || (cache[key] = compute());   // compute() runs only on a miss
```

This is why `&&` and `||` cannot be replaced by a function — a function would
evaluate both arguments. It also makes them the right tool for guarding an
expensive or unsafe call.

## `??` cannot be mixed with `&&` or `||`

```
  null ?? 1 || 2       -> SyntaxError
  true && 1 ?? 2       -> SyntaxError
  (null ?? 1) || 2     = 1
  null ?? (1 || 2)     = 1
```

A **`SyntaxError`**, not a precedence surprise. The committee decided the
grouping would be genuinely unclear to readers and required explicit
parentheses — the same philosophy as `-2 ** 2`
([page 01](./01-arithmetic.md)).

This is a good rule. When you hit it, the parentheses you add will document
intent that would otherwise have been guesswork in review.

## The default-value idiom, and its bug

```js
const qty  = input.qty || 1;     // ❌ a legitimate 0 becomes 1
const qty2 = input.qty ?? 1;     // ✅ only null/undefined fall back
```

Measured: `0 ?? 'f'` is `0`. `??` looks only at `null` and `undefined`
([Phase 1 · 05](../phase-1-values-and-coercion/05-null-vs-undefined.md)).

**Default to `??`.** In a storefront, `0` (a zero discount, zero stock), `''` (an
empty note) and `false` (an unset flag) are all real values, so `||` is wrong
more often than it is right.

## `&&` for conditional rendering — and the `0` trap

In JSX, `&&` is the standard conditional render:

```jsx
{cart.items.length > 0 && <CartSummary items={cart.items} />}
```

But drop the comparison and it breaks:

```jsx
{cart.items.length && <CartSummary … />}   // ❌ renders a literal 0 when empty
```

`0 && anything` is `0`, and React renders `0` as text. The page shows a stray
zero. Three fixes, in order of preference:

```jsx
{cart.items.length > 0 && <CartSummary … />}   // ✅ force a boolean
{cart.items.length ? <CartSummary … /> : null} // ✅ explicit
{!!cart.items.length && <CartSummary … />}     // ✅ but less readable
```

This is the most-reported React rendering bug that is actually a JavaScript
operator behaviour, which is why it belongs on this page rather than in the React
syllabus.

## `!` and double negation

```js
!value;      // boolean negation — the only logical operator that returns a boolean
!!value;     // convert to boolean (see Phase 1 · 04)
```

`!` is the exception: it always returns `true` or `false`.

## Chaining and readability

```js
const canCheckout = user && cart.items.length > 0 && !cart.locked;
```

That returns `user` when `user` is falsy — an object-or-undefined, not a boolean.
Fine for an `if`, misleading if the value is stored or returned from a function
called `canCheckout`. Force the type when the name promises a boolean:

```js
const canCheckout = Boolean(user) && cart.items.length > 0 && !cart.locked;
```

## Gotchas

**Symptom:** a stray `0` renders on the page.
**Cause:** `{count && <X/>}` returns `0` when `count` is `0`, and React renders
it.
**Fix:** `count > 0 && …`, or a ternary.

**Symptom:** a legitimate `0`, `''` or `false` was replaced by a default.
**Cause:** `||` falls back on any falsy value.
**Fix:** `??`.

**Symptom:** `SyntaxError` mixing `??` with `||`.
**Cause:** the grammar forbids it unparenthesised.
**Fix:** parenthesise explicitly — and note the two groupings can differ.

**Symptom:** a function returned an object where a boolean was expected.
**Cause:** `&&`/`||` return operands, not booleans.
**Fix:** wrap in `Boolean()` when the contract is a boolean.

**Symptom:** a side effect did not run.
**Cause:** short-circuiting skipped the right-hand side.
**Fix:** that is usually the intent — if not, do not hide side effects inside a
logical operator.

## Interview questions

**★ What does `'a' && 'b'` return?**
`'b'` — not `true`. `&&` returns the left operand if it is falsy, otherwise the
right one. Measured alongside `0 && 'b'`, which returns `0`. The operators return
operands; only `!` returns an actual boolean.

**★ Why does `{items.length && <List/>}` render a `0`?**
Because `0 && anything` evaluates to `0`, and React renders `0` as text — unlike
`false`, `null` or `undefined`, which render nothing. Fix by producing a real
boolean: `items.length > 0 && …`.

**★ Why is `a ?? b || c` a `SyntaxError`?**
The grammar deliberately forbids mixing `??` with `||` or `&&` without
parentheses, because the intended grouping would not be obvious to a reader.
`(a ?? b) || c` and `a ?? (b || c)` are both legal and can differ.

**What is short-circuiting and why does it matter?**
The right operand is not evaluated when the left already determines the result.
It lets you guard an expensive or unsafe call — `user && loadProfile(user)` — and
it is why these cannot be replaced by a function, which would evaluate both
arguments.

**When would you still use `||` over `??`?**
When you genuinely want every falsy value to fall back — for instance treating an
empty string from a form as "not provided". It is rarer than people assume, and
worth a comment when you do it.

---

← [02 · Assignment](./02-assignment.md) · [Phase index](./) · Next: [04 · Optional chaining](./04-optional-chaining.md) →
