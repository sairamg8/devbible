---
title: "02 · Modules are singletons, strict, deferred and hoisted"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import). Documentation-validated.

**Four properties you get without asking for any of them** — and each one first shows up as
a surprise rather than as a feature.

| Property | The surprise it causes |
|---|---|
| **singleton** | module-level state is shared everywhere, and leaks between tests |
| **strict** | top-level `this` is `undefined`; a typo'd assignment now throws |
| **deferred** | the DOM is ready at the top of the file, and `document.write` does nothing |
| **hoisted** | imports run before code written above them; a bad name fails at **load** |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Singletons and strict mode](./01-singletons-and-strict.md)** | *"Modules are only executed once"* and what follows — the free connection pool, the cache that never evicts, tests leaking into each other, and **when the same file becomes two modules** because identity is the resolved URL; then strict mode with no opt-out, and the top-level `this` trap |
| 2 | **[Deferred and hoisted](./02-deferred-and-hoisted.md)** | Deferred automatically, so the DOM is ready and the `DOMContentLoaded` wrapper is obsolete — and what that rules out; imports hoisted and evaluated **before** code written above them; the **link-then-evaluate** model that turns a mistyped import into a load-time error rather than CommonJS's `undefined`; and why a circular import lands in the TDZ |

## The three sentences to keep

1. **Every module with top-level state is a singleton**, whether or not you meant it.
2. **Linking happens before evaluation**, which is why a wrong import name fails at load —
   the strongest everyday argument for ESM over CommonJS.
3. **Deferred means the DOM is ready** and nothing can run during parsing.

## Phase gate

You are done with this topic when you can explain why tests leak module state, say what
`this` is at the top of a module and why, predict the execution order of a small module
graph, and explain why a mistyped import fails earlier than the CommonJS equivalent.

## Where this connects

- [01 · ES modules](../01-es-modules/README.md) — the static-specifier rule that makes linking possible
- [Phase 0 · 04 · Strict mode](../../phase-0-how-javascript-runs/04-strict-mode.md) — everything modules turn on for you
- [Phase 3 · 08 · Hoisting and the TDZ](../../phase-3-functions/08-hoisting-and-tdz/README.md) — the same two-phase model, one scope down

---

Start → [01 · Singletons and strict mode](./01-singletons-and-strict.md)
