---
title: "07 · Lexical scope and the scope chain"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex7-scope.mjs`, `sandbox/js-p3/ex7b-scope-sloppy.cjs`.

**Scope is decided by where code is *written*, not where it is *called*.** That
one property — lexical scoping — is what makes closures possible, what makes
`var` and `let` behave differently, and what lets an engine resolve most variable
lookups before the program ever runs.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The scope chain](./01-the-scope-chain.md)** | Lexical versus dynamic scope, how lookup walks outward, what creates a scope, and shadowing |
| 2 | **[`var`, `let` and `const`](./02-var-let-const.md)** | Function versus block scope, redeclaration rules, why `const` is not immutable, and the global-scope differences between a module and a script |

## Phase gate

You are done with this topic when you can say what creates a new scope, predict
which binding a name resolves to in nested blocks, and explain why
`const` objects can still be mutated.

## Where this connects

- [06 · Closures](../06-closures/README.md) — a closure is a function plus the scope chain it kept
- [08 · Hoisting and the temporal dead zone](../08-hoisting-and-tdz/README.md) — *when* a binding becomes usable within its scope
- **18 · IIFE and the module pattern** *(not written yet)* — scope used deliberately as a privacy boundary

---

Start → [The scope chain](./01-the-scope-chain.md)
