---
title: "06 · Closures"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6) — **sandbox-proven**. Script: `sandbox/js-p3/ex6-closures.mjs`.

**A closure is a function together with the variables it still has access to.**
Every function in JavaScript is one — the word only becomes interesting when the
function outlives the scope it was defined in.

The single fact that explains every closure question: **a closure captures the
variable, not the value.** The `var`-in-a-loop bug, the counter factory, the
stale-closure bug in React and the memory it holds alive are all that one rule
seen from different angles.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What is captured](./01-what-is-captured.md)** | Variable-not-value, the `var`-in-a-loop bug and its three fixes, per-iteration `let` bindings, and `setTimeout` ordering |
| 2 | **[Private state and memory](./02-state-and-memory.md)** | The counter factory, shared versus separate scopes, what a closure actually retains (measured), and the stale-closure bug |

## Phase gate

You are done with this topic when you can write a counter factory from an empty
file, explain why `for (var i…)` logs `3,3,3`, and say what a closure does and
does not keep alive.

## Where this connects

- [07 · Lexical scope and the scope chain](../07-lexical-scope.md) — the mechanism closures are built on
- [08 · Hoisting and the temporal dead zone](../08-hoisting-and-tdz.md) — why `let` gives a per-iteration binding and `var` does not
- [13 · Memoization](../13-memoization.md) — a cache held in a closure, and the leak that comes with it
- [17 · Closure and default-parameter gotchas](../17-closure-and-default-gotchas.md) — the stale-closure bug React makes famous

---

Start → [What is captured](./01-what-is-captured.md)
