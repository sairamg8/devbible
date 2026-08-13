---
title: "02 · `for…of` vs `for…in` vs `forEach`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in), [`for...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of), [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach). Documentation-validated.

**Three loops with confusingly similar names, iterating three different things** — and
differing in what control flow works inside them, which is what actually decides the
choice.

| Loop | Iterates | `break`? | `await`? |
|---|---|---|---|
| `for...in` | **keys**, including **inherited** | ✅ | ✅ |
| `for...of` | **values**, via `Symbol.iterator` | ✅ | ✅ |
| `forEach` | values, as a callback | ❌ | ❌ |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What each one iterates](./01-what-each-iterates.md)** | `for...in` walking the prototype chain and MDN's three reasons never to use it on an array (string indices, non-index properties, **skipping holes**), `for...of` and the iterable requirement, and why a plain object is deliberately not iterable |
| 2 | **[Control flow: `break`, `await` and choosing](./02-control-flow-and-choosing.md)** | The capability table, **`return` inside `forEach` returning from the callback**, `forEach(async …)` discarding promises, sequential vs concurrent async, labelled `break`, iterating while modifying, and the ordered decision list |

## The rule

**`for...of` for values. `Object.entries`/`keys` for object properties. `for...in`
almost never.**

```js
function findUser(users, id) {
  users.forEach((u) => { if (u.id === id) return u; });  // ❌ returns from the CALLBACK
  return null;                                            // always reached
}
```

## Phase gate

You are done with this topic when you can give MDN's three reasons not to use `for...in`
on an array, say what `return` does inside a `forEach` callback, and choose between
`for...of` + `await` and `Promise.all` over a `map` with a reason.

## Where this connects

- [01 · Destructuring](../01-destructuring/README.md) — `for (const [k, v] of …)`, the shape that makes these loops readable
- [Phase 5 · 04 · Array iteration methods](../../phase-5-built-in-library/04-array-iteration-methods/README.md) — the method family, and the async trap in full
- [Phase 5 · 01 · Holes and `length`](../../phase-5-built-in-library/01-array-creation-and-shape/02-holes-and-length.md) — why `for...in` and `for...of` disagree on sparse arrays
- [Phase 4 · 08 · What they include](../../phase-4-objects-and-classes/08-keys-values-entries/01-what-they-include.md) — `Object.keys` as the own-only replacement for `for...in`

---

Start → [What each one iterates](./01-what-each-iterates.md)
