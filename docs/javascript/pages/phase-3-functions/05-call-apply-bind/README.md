---
title: "05 · call, apply and bind"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts:
> `sandbox/js-p3/ex5-call-apply-bind.mjs`, `sandbox/js-p3/ex5b-thisarg-sloppy.cjs`.

**The three methods that make `this` explicit.** `call` and `apply` invoke
immediately and differ only in how arguments are packaged; `bind` invokes
nothing and returns a new function with `this` — and optionally some leading
arguments — fixed permanently.

Spread syntax replaced most of what `apply` was used for, but `call` and `bind`
are still load-bearing, and `Object.prototype.toString.call` remains the only
correct built-in type check.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three methods](./01-the-three-methods.md)** | `call` vs `apply` vs `bind` side by side, and `thisArg` coercion in strict versus sloppy mode |
| 2 | **[What `bind` does](./02-what-bind-does.md)** | Permanence, `.name`, `.length`, no own `prototype`, the `new` exception, and writing `bind` yourself |
| 3 | **[Borrowing, partial application and cost](./03-borrowing-and-cost.md)** | Method borrowing from array-likes, `toString.call` type checking, `apply`'s argument limit, and measured call overhead |

## Phase gate

You are done with this topic when you can write `bind` from scratch, say what
`new (Fn.bind(obj, 1))(2)` produces, and explain why
`removeEventListener(handler.bind(this))` never removes anything.

## Where this connects

- [03 · `this`](../03-this/README.md) — explicit binding is rule 2 of four
- [04 · Arrow functions and `this`](../04-arrow-functions-and-this/README.md) — arrows ignore all three for `this`, but still accept their arguments
- [11 · Currying and partial application](../11-currying.md) — `bind` is partial application with a fixed receiver

---

Start → [The three methods](./01-the-three-methods.md)
