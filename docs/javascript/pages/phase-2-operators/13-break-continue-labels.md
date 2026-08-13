---
title: "13 · `break`, `continue`, labels"
sidebar_label: "13 · break, continue, labels"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex3-control-flow.mjs`.

**`break` exits a loop, `continue` skips to the next iteration, and a label lets
either one target an *outer* loop.** Labels are the only part worth thinking
about, because they have exactly one good use and a bad reputation earned by a
different language feature.

## Measured

```
--- labelled break ---
  visit 1,1
  visit 2,1
```

```js
outer: for (const a of [1, 2]) {
  for (const b of [1, 2]) {
    if (b === 2) continue outer;
    console.log(`  visit ${a},${b}`);
  }
}
```

`continue outer` skipped the rest of the **inner** loop and advanced the
**outer** one, so only `b === 1` was ever visited.

## The basics

```js
for (const item of items) {
  if (!item.inStock) continue;    // skip this one
  if (budget < item.price) break; // stop entirely
  buy(item);
}
```

- **`break`** — leaves the nearest enclosing loop or `switch`.
- **`continue`** — skips to the next iteration of the nearest enclosing loop. It
  is not valid in a `switch`.

Neither works in `forEach`, `map` or `filter` — those take callbacks, not loop
bodies ([page 05](./05-loops.md)).

## Labels: the one good use

Breaking out of **nested** loops. Without a label you need a flag:

```js
// ❌ flag-based — an extra variable and a second condition
let found = null;
for (const order of orders) {
  for (const line of order.lines) {
    if (line.sku === sku) { found = line; break; }
  }
  if (found) break;
}

// ✅ labelled — says exactly what it does
search:
for (const order of orders) {
  for (const line of order.lines) {
    if (line.sku === sku) { found = line; break search; }
  }
}
```

The labelled version has no flag and no duplicated condition. **This is the case
where a label is the clearest option**, and it is worth knowing for exactly this.

The alternative that is usually better still: **extract a function and
`return`**.

```js
function findLine(orders, sku) {
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.sku === sku) return line;
    }
  }
  return null;
}
```

`return` exits every enclosing loop at once, gives the operation a name, and is
independently testable. **Prefer this.** Reach for a label only when extracting a
function is genuinely awkward — usually because the loop body mutates several
outer variables.

## Labels are not `goto`

The reputation labels carry comes from `goto`, which can jump anywhere. A
JavaScript label can only be used by a `break` or `continue` **inside** the
labelled statement, and only to exit or continue it. It cannot jump backwards, it
cannot jump into a block, and it cannot leave a function.

That said, a label on a non-loop block is legal and almost always a mistake:

```js
block: {
  if (skip) break block;   // legal — jumps to the end of the block
  doWork();
}
```

Use an `if` or an early return.

## The accidental label

```js
const make = () => { id: 1 };   // returns undefined
```

`id:` here is a **label** on the expression statement `1`. The arrow has a block
body with no `return`, so it yields `undefined`. This is the most common way
people meet labels — by writing one accidentally
([page 11](./11-expressions-vs-statements.md)).

Fix: `() => ({ id: 1 })`.

## `break` in `switch`

`break` inside a `switch` exits the `switch`, not an enclosing loop. To break the
loop from inside a `switch`, you need a label:

```js
processing:
for (const event of events) {
  switch (event.type) {
    case 'stop':
      break processing;      // exits the LOOP
    case 'skip':
      continue processing;   // next event
    default:
      handle(event);
  }
}
```

A plain `break` in the `'stop'` case would only leave the `switch` and continue
looping — a genuinely easy bug to write, and the second real use for labels.

## Gotchas

**Symptom:** `break` inside a `switch` inside a loop did not exit the loop.
**Cause:** `break` targets the nearest enclosing `switch`.
**Fix:** a labelled `break`, or restructure so the switch returns.

**Symptom:** an arrow function returns `undefined`.
**Cause:** `() => { key: value }` — `key:` is a label, not an object property.
**Fix:** `() => ({ key: value })`.

**Symptom:** `SyntaxError: Illegal continue statement`.
**Cause:** `continue` used inside a `switch` that is not in a loop, or outside a
loop entirely.
**Fix:** `break`, or move the logic into a loop.

**Symptom:** a nested search needs a flag and a duplicated condition.
**Cause:** `break` only exits one level.
**Fix:** extract a function and `return`; or use a labelled `break` if extraction
is awkward.

**Symptom:** `break`/`continue` in a `forEach` is a `SyntaxError`.
**Cause:** the callback is a function, not a loop body.
**Fix:** `for…of`, or `some`/`every`.

## Interview questions

**★ How do you break out of nested loops?**
A labelled `break` — `outer: for (…) { for (…) { break outer; } }`. Measured, a
labelled `continue` skipped the inner loop and advanced the outer one. The usually
better option is extracting the loops into a function and using `return`, which
exits every level, names the operation, and is testable.

**★ Are labels the same as `goto`?**
No. A label can only be targeted by a `break` or `continue` **inside** the
labelled statement, and only to exit or continue it. It cannot jump backwards,
jump into a block, or leave a function. The unstructured jumping that gave `goto`
its reputation is not possible.

**★ Why does `() => { id: 1 }` return undefined?**
Because `{` opens a block body and `id:` is parsed as a **label** on the
expression statement `1`. There is no `return`, so the result is `undefined`.
Wrap the object in parentheses.

**What does `break` do inside a `switch` inside a loop?**
It exits the `switch` only — the loop continues. To leave the loop you need a
labelled `break`, which is the second legitimate use for labels.

**Can you `continue` inside a `switch`?**
Only if the `switch` is inside a loop, and it continues that loop. Outside a
loop it is a `SyntaxError`.

---

← [12 · ASI](./12-asi.md) · [Phase index](./) · Next: [14 · Bitwise](./14-bitwise.md) →
