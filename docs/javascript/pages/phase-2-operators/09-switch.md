---
title: "09 · `switch`"
sidebar_label: "09 · switch"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex3-control-flow.mjs`.

**`switch` compares with `===` and falls through unless you stop it.** Both
behaviours surprise people, and the second one is occasionally exactly what you
want.

## Measured

```
--- switch uses === ---
  classify(1)   = number 1 | classify("1") = string 1 | classify(true) = no match
  switch(NaN) matches case NaN? no

--- case block scope ---
  duplicate let across cases -> SyntaxError: Identifier 'x' has already been declared
```

## Strict comparison, no coercion

```js
function classify(v) {
  switch (v) {
    case 1:   return 'number 1';
    case '1': return 'string 1';
    default:  return 'no match';
  }
}
```

`classify(1)` and `classify('1')` reach different branches, and `classify(true)`
matches neither — `true == 1` is `true` but `true === 1` is `false`.

So a `switch` on a value that might arrive as a string from a query parameter or
form field will silently fall to `default`. Convert before switching
([Phase 1 · 09](../phase-1-values-and-coercion/09-explicit-conversion.md)).

`switch (NaN)` matches no `case NaN`, for the same reason `NaN === NaN` is
`false` ([Phase 1 · 11](../phase-1-values-and-coercion/11-nan.md)). If `NaN` is
possible, handle it before the switch.

## Fallthrough

Without `break` (or `return`, or `throw`), execution continues into the next
case:

```js
// ❌ accidental — 'paid' also runs the 'shipped' body
switch (status) {
  case 'paid':
    notifyWarehouse(order);
  case 'shipped':
    sendTrackingEmail(order);
    break;
}
```

The `switch` statement has one entry point and runs until something exits. That
is a feature when cases genuinely share a body:

```js
// ✅ deliberate — grouped cases
switch (status) {
  case 'paid':
  case 'processing':
  case 'shipped':
    return 'in progress';
  case 'delivered':
  case 'refunded':
    return 'closed';
  default:
    return 'unknown';
}
```

Stacked empty cases are idiomatic and clear. **Fallthrough with a non-empty body
must be commented** — ESLint's `no-fallthrough` rule accepts a
`// falls through` comment and flags everything else.

**Prefer `return` to `break`** in a `switch` inside a function. It cannot fall
through by accident, and it removes a line per case.

## `default` does not have to be last

It is conventionally last, and it can appear anywhere — with fallthrough rules
still applying, which is a good reason to keep it last regardless.

Omitting `default` means an unmatched value does nothing at all. Prefer an
explicit `default` that throws when a value should be exhaustive:

```js
default:
  throw new Error(`Unhandled order status: ${status}`);
```

In TypeScript this pairs with an exhaustiveness check on `never`, so adding a new
status becomes a compile error rather than a silent no-op.

## The block-scope trap

```
  duplicate let across cases -> SyntaxError: Identifier 'x' has already been declared
```

**The whole `switch` body is one block.** Cases are labels within it, not
separate scopes, so two `let x` declarations in different cases collide:

```js
// ❌ SyntaxError
switch (kind) {
  case 'a': let total = 1; break;
  case 'b': let total = 2; break;
}

// ✅ brace the case body
switch (kind) {
  case 'a': { let total = 1; break; }
  case 'b': { let total = 2; break; }
}
```

Braces around a case body create a real block. Add them whenever a case declares
anything.

## When to use `switch`, and when not

**Use it** for a single value against several known constants where the branches
have real bodies — a reducer, a state machine, a message-type dispatcher.

**Do not use it** when every branch just maps a key to a value. An object lookup
is shorter and needs no `break`
([page 08](./08-conditionals.md)):

```js
// switch with 6 cases returning a string → this
const STATUS_LABEL = { pending: 'Awaiting payment', paid: 'Confirmed', /* … */ };
const label = STATUS_LABEL[status] ?? 'Unknown';
```

**Do not use** `switch (true)` with conditional cases:

```js
// ❌ works, but obscures what is really a chain of ifs
switch (true) {
  case qty === 0: return 'out';
  case qty < 5:   return 'low';
}
```

It relies on `true === (qty === 0)` and hides an `if`/`else if` chain behind
unfamiliar syntax. Use guard clauses.

## Gotchas

**Symptom:** a `switch` on a numeric value always hits `default`.
**Cause:** the value is a string; `switch` uses `===`.
**Fix:** `Number(value)` before switching.

**Symptom:** two branches ran.
**Cause:** a missing `break`.
**Fix:** `break`, or `return` from inside a function. Enable `no-fallthrough`.

**Symptom:** `SyntaxError: Identifier 'x' has already been declared`.
**Cause:** two `let`/`const` declarations of the same name in different cases —
the switch body is one block.
**Fix:** wrap each case body in braces.

**Symptom:** `case NaN:` never matches.
**Cause:** `NaN !== NaN`.
**Fix:** check `Number.isNaN` before the switch.

**Symptom:** adding a new status silently did nothing.
**Cause:** no `default`.
**Fix:** a `default` that throws, so unhandled values are loud.

**Symptom:** a `switch` returning only strings is long and repetitive.
**Cause:** control flow used where data would do.
**Fix:** an object lookup with `??` for the fallback.

## Interview questions

**★ Does `switch` use `==` or `===`?**
`===`. Measured: `switch(1)` and `switch('1')` reach different cases, and
`switch(true)` matches neither, because `true === 1` is `false`. A value arriving
as a string from a form or query parameter falls through to `default`.

**★ What is fallthrough and when is it useful?**
Without `break`, `return` or `throw`, execution continues into the next case's
body. Accidentally, it runs two branches. Deliberately, stacked empty cases let
several values share one body — which is idiomatic. Any fallthrough with a
non-empty body should carry a `// falls through` comment.

**★ Why does declaring `let x` in two cases throw?**
Because the entire `switch` body is a single block and cases are labels inside
it, not separate scopes — measured as `SyntaxError: Identifier 'x' has already
been declared`. Wrap each case body in braces to create real block scope.

**When would you use an object lookup instead of a `switch`?**
When every branch simply maps a key to a value. The lookup is shorter, has no
`break` to forget, extends without touching logic, and is easy to test. Keep
`switch` for branches with real bodies — reducers, state machines, dispatchers.

**Why prefer `return` over `break` inside a function?**
It cannot fall through by accident, and it removes a line per case. `break` is
only necessary when the `switch` is not the last thing the function does.

---

← [08 · Conditionals](./08-conditionals.md) · [Phase index](./) · Next: [10 · Precedence](./10-precedence.md) →
