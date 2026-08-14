---
title: "02 · call, apply and bind"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Function.prototype.call()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call), [`apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply), [`bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this). Documentation-validated; **no timings**.

**`this` comes from the call site, not from where the function was defined.** Implementing these
three is the clearest way to prove you know that — and `bind` is the interesting one, because the
specification requires it to behave differently under `new`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[call and apply](./01-call-and-apply.md)** | The trick — make the function a temporary property and call it as a method; the four details that are each a follow-up: 🔴 **a `Symbol` key** (a string can clobber a real property), **`enumerable: false`**, 🔴 **`delete` in a `finally`**, and choosing sloppy- versus strict-mode coercion deliberately; `apply` needing **`Array.from`, not spread**, because array-likes are not iterable; the precedence table for where `this` comes from, with arrows as the exception; the lost-`this` bug; and the two `call` idioms that are **still current** — `Object.prototype.toString.call` and `hasOwnProperty.call` |
| 2 | **[bind, including with `new`](./02-bind.md)** | MDN's requirement that *"the provided `this` is ignored"* under construction, and why the naive closure fails it; the two lines that fix it — 🔴 **`new.target` detection** and 🔴 **`prototype = Object.create(target.prototype)`**, plus why assigning it directly leaks; **three things the real `bind` does that a hand-rolled one cannot** — no `prototype` at all (so it cannot be a base class), `name`/`length`, and re-binding ignoring the new `this` while arguments accumulate; partial application; ⚠️ **`bind` in a render path allocating per render**; and the class-field arrow as the modern answer, with its per-instance cost |

## The three sentences to keep

1. **`this` is decided by how a function is called** — which is why extracting a method breaks it,
   and why `call` works by making the function a temporary method.
2. **`bind` must ignore its `thisArg` under `new`**, and must chain `prototype` so `instanceof`
   still reaches the target.
3. **A real bound function has no `prototype` property at all** — the hand-rolled version fakes
   what the engine does with an internal slot.

## Phase gate

You are done with this topic when you can write `call` with the `Symbol` key and the `finally`,
`apply` with `Array.from`, and a `bind` that survives `new` — and name three ways your `bind`
differs from the real one.

## Where this connects

- [01 · `map`, `filter`, `reduce`, `forEach`](../01-array-methods/README.md) — where `callbackFn.call(thisArg, …)` came from
- [03 · `debounce` and `throttle`](../03-debounce-throttle/README.md) — preserving `this` and arguments through a wrapper
- [Phase 3 · Functions, scope and closures](../../phase-3-functions/README.md) — the closure the wrapper depends on
- [Phase 4 · Objects, prototypes and classes](../../phase-4-objects-and-classes/README.md) — the prototype chain `instanceof` walks

---

Start → [01 · call and apply](./01-call-and-apply.md)
