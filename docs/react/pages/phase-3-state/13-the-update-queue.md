---
title: "The update queue"
sidebar_label: "13 · The update queue"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates),
> whose trace tables are reproduced verbatim below. No sandbox script backs this
> page; claims are cited, not measured.

**Given several `setState` calls in one event, you should be able to predict the
final value on paper, without running it. The rule is two lines long.**

## The rule

React keeps a queue of updates per state variable. When it processes the queue
it walks it in order, carrying a running value:

- **A plain value** replaces the running value entirely. Whatever came before is
  discarded.
- **An updater function** is called with the running value; its return becomes
  the new running value.

That is the whole algorithm. Everything below is that rule applied.

## Three updaters

```jsx
setNumber(n => n + 1);
setNumber(n => n + 1);
setNumber(n => n + 1);
```

| queued update | `n` | returns |
|---|---|---|
| `n => n + 1` | `0` | `0 + 1 = 1` |
| `n => n + 1` | `1` | `1 + 1 = 2` |
| `n => n + 1` | `2` | `2 + 1 = 3` |

Final: **3**. Each updater receives the previous one's result, not the render's
snapshot.

## A value, then an updater

```jsx
setNumber(number + 5);      // number is 0 in this render
setNumber(n => n + 1);
```

| queued update | `n` | returns |
|---|---|---|
| "replace with `5`" | `0` (unused) | `5` |
| `n => n + 1` | `5` | `5 + 1 = 6` |

Final: **6**. Note the `(unused)` — a plain value ignores the running value
completely. The `0` is listed only to show what was discarded.

## A value, an updater, then another value

```jsx
setNumber(number + 5);
setNumber(n => n + 1);
setNumber(42);
```

| queued update | `n` | returns |
|---|---|---|
| "replace with `5`" | `0` (unused) | `5` |
| `n => n + 1` | `5` | `5 + 1 = 6` |
| "replace with `42`" | `6` (unused) | `42` |

Final: **42**. The updater ran — and its result was then thrown away. **A plain
value after an updater discards the updater's work.** Occasionally deliberate
("reset to 42 whatever else happened"), much more often a bug.

## Reading it on paper

The procedure, which is worth doing a few times until it is automatic:

1. **Write down the snapshot value** of the state for this render. Every plain
   value in the handler is computed from *that*, not from the running total.
2. **List the calls in order**, marking each as a value or an updater.
3. **Substitute the snapshot** into every value expression —
   `setNumber(number + 5)` becomes `setNumber(5)` when `number` is `0`.
4. **Walk the list**, carrying the running value. Values replace, updaters
   transform.

Step 3 is where mistakes happen. `setNumber(number + 5)` does **not** mean "add
5 to whatever is queued" — `number` is a `const` from this render's snapshot
([topic 02](02-state-is-a-snapshot.md)), so it is a fixed number computed before
the queue is ever walked.

## Why it works this way

Two properties fall out of the design, and both are the point:

**Updaters are the only way to compose.** A value cannot express "one more than
whatever is pending", because the pending value does not exist yet when the
handler runs. Handing React a function defers the question until React knows the
answer.

**Updaters must be pure**, because React will call them whenever it processes
the queue — possibly more than once. StrictMode double-invokes them for exactly
this reason ([topic 03](03-updater-functions.md)).

## Separate queues, one render

Each state variable has its own queue. Batching decides when the queues are
processed; it does not merge them.

```jsx
function onClick() {
  setCount(c => c + 1);      // count's queue
  setName('Ada');            // name's queue
  setCount(c => c * 2);      // count's queue again
}
```

`count` goes `0 → 1 → 2`; `name` becomes `'Ada'`. One render, two queues, and
the interleaving in the source is irrelevant — only the order within each queue
matters.

## `useReducer` is the same machinery, named

A reducer makes the queue explicit: each `dispatch` enqueues an action, and
React folds them with your reducer. `useState`'s updater form is the same fold
with an anonymous reducer.

```jsx
setCount(c => c + 1);              // an inline, anonymous reducer
dispatch({type: 'increment'});     // a named action, one reducer
```

This is why the "three dispatches in one handler" case has never confused
anyone: the fold is visible. Phase 5 covers `useReducer` properly; the
connection is worth carrying because it makes the updater form feel less like a
special case.

## Gotchas

**Symptom:** three `setCount(count + 1)` calls increment by one.
**Cause:** all three are the same plain value, computed from one snapshot; each
replaces the last.
**Fix:** updaters.

**Symptom:** an updater's effect vanishes.
**Cause:** a plain value queued after it replaced the result.
**Fix:** make the later call an updater too, or reorder deliberately.

**Symptom:** two state variables end up inconsistent after one event.
**Cause:** one was computed from the other's *snapshot* rather than from its
pending value.
**Fix:** compute the shared value once into a local `const` and use it for both,
or move both into one reducer.

**Symptom:** an updater runs twice in development.
**Cause:** StrictMode double-invokes updaters — they must be pure.
**Fix:** no side effects inside an updater.

**Symptom:** predicting the result gets confusing with a mix of forms.
**Cause:** mixing values and updaters for the same variable in one handler.
**Fix:** pick one form per variable per handler. Mixing is legal and rarely
worth the reasoning cost.

## Interview questions

**★ How does React process several `setState` calls from one event?**
It queues them per state variable and walks the queue in order, carrying a
running value. A plain value replaces the running value entirely; an updater
function is called with it and its return becomes the new running value. That
two-line rule predicts every case.

**★ What do `setNumber(number + 5)` then `setNumber(n => n + 1)` produce, with
`number` at 0?**
6. The first queues "replace with 5" — `number` is the snapshot, so it is
computed as 5 before the queue is walked. The second is an updater, which
receives 5 and returns 6.

**★ And if `setNumber(42)` is added after those two?**
42. The updater still runs and still produces 6, and then the plain value
discards it. A plain value after an updater throws the updater's work away,
which is occasionally intentional and usually a bug.

**Why can't a plain value express "one more than what is pending"?**
Because the pending value does not exist when the handler runs — the queue has
not been processed yet. The handler only has this render's snapshot. Passing a
function defers the question until React is walking the queue and knows the
running value.

**Do two state variables share a queue?**
No. Each has its own, and batching only decides when they are all processed.
Interleaving `setCount` and `setName` in the source does not matter; only the
order within each variable's queue does.

**How does this relate to `useReducer`?**
It is the same fold with the reducer named. `dispatch` enqueues an action and
React folds the queue with your reducer; `setCount(c => c + 1)` is the same thing
with an inline anonymous one. Seeing that makes the updater form stop looking
like a special case.

---

← Prev: [Render order](12-render-order.md) · Index: [Phase 3](README.md) · Next → [State in lists](14-state-in-lists.md)
