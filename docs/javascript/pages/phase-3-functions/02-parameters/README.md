---
title: "02 · Parameters"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex2-parameters.mjs`, `sandbox/js-p3/ex2b-arguments-sloppy.cjs`.

**The parameter list is a small language of its own.** It has its own scope, its
own temporal dead zone, its own evaluation order, and a rule about *simple* vs
*non-simple* lists that silently changes how `arguments` behaves.

Most of this only bites when a caller omits an argument — which is every call,
eventually.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Defaults and the parameter scope](./01-defaults-and-scope.md)** | When a default runs, `undefined` vs `null`, reading earlier parameters, the parameter-list TDZ, the shared-default myth, and `.length` |
| 2 | **[Rest, destructuring and `arguments`](./02-rest-destructuring-arguments.md)** | Rest parameters, destructured parameters and the missing-argument crash, the `arguments` object, sloppy-mode aliasing, and designing a signature |

## Phase gate

You are done with this topic when you can say, without running it, what
`function f(a = 1, b) {}` reports for `f.length` and why, and name the three
things that make a parameter list non-simple.

## Where this connects

- [01 · Declarations, expressions and arrow functions](../01-declarations-expressions-arrows.md) — arrows have no `arguments`, which is why rest parameters are the portable answer
- [08 · Hoisting and the temporal dead zone](../08-hoisting-and-tdz.md) — the parameter list has its own TDZ, measured here
- [17 · Closure and default-parameter gotchas](../17-closure-and-default-gotchas.md) — the defaults that capture something they should not

---

Start → [Defaults and the parameter scope](./01-defaults-and-scope.md)
