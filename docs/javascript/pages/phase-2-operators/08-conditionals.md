---
title: "08 · Conditionals"
sidebar_label: "08 · Conditionals"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Behaviour on this page follows from
> truthiness ([Phase 1 · 04](../phase-1-values-and-coercion/04-truthiness.md))
> and the logical operators ([page 03](./03-logical-operators.md)), both
> measured there.

**`if` converts its condition with `ToBoolean`.** Everything else on this page is
about structuring branches so they stay readable — which is a real engineering
concern, because deeply nested conditionals are where business logic goes to die.

## `if` / `else if` / `else`

```js
if (cart.items.length === 0) {
  return renderEmptyCart();
} else if (!user) {
  return renderLoginPrompt();
} else {
  return renderCheckout();
}
```

Two habits that matter more than the syntax:

**1. Always use braces.** Brace-less bodies are legal and are how the Apple
"goto fail" TLS bug happened — a duplicated line ended up outside a brace-less
`if` and every certificate validated. It also interacts badly with ASI
([page 12](./12-asi.md)).

**2. Prefer early return over nesting.** These are equivalent:

```js
// Nested — the happy path is buried
function checkout(cart, user) {
  if (user) {
    if (cart.items.length > 0) {
      if (!cart.locked) {
        return process(cart);
      } else { throw new Error('cart locked'); }
    } else { throw new Error('cart empty'); }
  } else { throw new Error('not signed in'); }
}

// Guard clauses — the happy path is last and unindented
function checkout(cart, user) {
  if (!user) throw new Error('not signed in');
  if (cart.items.length === 0) throw new Error('cart empty');
  if (cart.locked) throw new Error('cart locked');
  return process(cart);
}
```

The second version has the same logic, one level of indentation, and each failure
condition sits next to its message. This is the single highest-value refactor for
conditional-heavy code.

## The ternary

```js
const label = count === 1 ? 'item' : 'items';
```

Correct for choosing **a value**. Wrong for choosing **an action** — a ternary
whose branches are side effects should be an `if`.

```js
// ❌ side effects in a ternary
isValid ? save(order) : showError();

// ✅
if (isValid) save(order); else showError();
```

### When a ternary stops paying

Nesting is where it turns:

```js
// ❌ unreadable
const badge = qty === 0 ? 'out' : qty < 5 ? 'low' : qty < 20 ? 'ok' : 'plenty';
```

If the chain must stay an expression — inside JSX, or assigning to a `const` —
format it as a decision table instead:

```js
const badge =
  qty === 0  ? 'out'
  : qty < 5  ? 'low'
  : qty < 20 ? 'ok'
  :            'plenty';
```

Aligned like that, a nested ternary reads as a table and is genuinely fine. Or
lift it into a function with guard clauses, which is usually better:

```js
function stockBadge(qty) {
  if (qty === 0) return 'out';
  if (qty < 5)   return 'low';
  if (qty < 20)  return 'ok';
  return 'plenty';
}
```

**The rule:** one level of ternary inline; two or more, either align it as a
table or extract a function.

## Object lookup instead of branching

When every branch maps a key to a value, a lookup beats both:

```js
const STATUS_LABEL = {
  pending: 'Awaiting payment',
  paid: 'Confirmed',
  shipped: 'On the way',
  delivered: 'Delivered',
};

const label = STATUS_LABEL[order.status] ?? 'Unknown';
```

Data instead of control flow: it is shorter, easy to extend, and trivially
testable. The `??` handles an unexpected status without a `default` branch.

Use a `Map` instead when keys are not strings, or when you need guaranteed
insertion order.

**Do not** use this when branches have different *shapes* — different arguments,
side effects, or early returns. Then `if` or `switch` is clearer
([page 09](./09-switch.md)).

## Conditions that read well

```js
// ❌ negation pile-up
if (!(!user || !user.isVerified)) …

// ✅ name the condition
const canCheckout = Boolean(user?.isVerified) && cart.items.length > 0;
if (canCheckout) …
```

Naming an intermediate boolean is almost always worth the line. It makes the
condition greppable, testable, and readable in a debugger's Scope panel.

And be explicit rather than relying on truthiness when a falsy value is
meaningful:

```js
if (stock)              // ❌ 0 in stock is "falsy"
if (stock > 0)          // ✅
if (stock != null)      // ✅ "we have a number at all"
```

That is the same trap as [Phase 1 · 04](../phase-1-values-and-coercion/04-truthiness.md),
and in a storefront it is the most common one.

## Gotchas

**Symptom:** a legitimate `0` or `''` takes the wrong branch.
**Cause:** `if (value)` uses truthiness.
**Fix:** compare explicitly — `value > 0`, `value != null`, `value !== ''`.

**Symptom:** an added line inside a brace-less `if` runs unconditionally.
**Cause:** only the first statement belongs to a brace-less body.
**Fix:** always use braces. Enable ESLint's `curly`.

**Symptom:** an `if` condition always passes.
**Cause:** `=` instead of `===` — assignment returns the assigned value
([page 02](./02-assignment.md)).
**Fix:** `no-cond-assign`.

**Symptom:** a nested ternary is unreviewable.
**Cause:** more than one level inline.
**Fix:** align as a decision table, or extract a function with guard clauses.

**Symptom:** logic is buried five levels deep.
**Cause:** nested `if`s instead of guard clauses.
**Fix:** invert each condition and return early; the happy path ends up last and
unindented.

**Symptom:** a lookup object returned `undefined` for an unexpected key.
**Cause:** no fallback.
**Fix:** `LOOKUP[key] ?? fallback`. Use `??`, not `||`, so a legitimate falsy
value survives.

## Interview questions

**★ When should you use a ternary and when an `if`?**
A ternary chooses a **value** in expression position — assigning to a `const`, or
inside JSX. An `if` chooses an **action**. Side effects in a ternary read badly
and cannot be extended without a rewrite. More than one level of nesting means
either aligning it as a decision table or extracting a function.

**★ What are guard clauses and why prefer them?**
Early returns for failure cases at the top of a function, so the happy path is
last and unindented. Same logic as nested `if`s, one level of indentation, and
each failure sits next to its own error message. It is the highest-value refactor
for conditional-heavy code.

**When would you replace a conditional with an object lookup?**
When every branch maps a key to a value — status labels, config by environment,
icon by type. It turns control flow into data: shorter, extensible without
touching logic, and easy to test. Not appropriate when branches take different
arguments or have side effects.

**Why always use braces?**
Because a brace-less body contains only the first statement, so a later addition
silently runs unconditionally. This caused Apple's "goto fail" TLS bug, where
every certificate validated. It also interacts badly with automatic semicolon
insertion.

**How do you keep a complex condition readable?**
Name it. Assign to a well-named `const` — `canCheckout`, `isExpired` — instead of
inlining a pile of negations. It becomes greppable, individually testable, and
visible by name in the debugger.

---

← [07 · Comparison](./07-comparison.md) · [Phase index](./) · Next: [09 · switch](./09-switch.md) →
