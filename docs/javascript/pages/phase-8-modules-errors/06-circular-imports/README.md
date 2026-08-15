---
title: "06 · Circular imports"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [`let` § TDZ](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let#temporal_dead_zone_tdz) — and ECMAScript [§ Cyclic Module Records](https://tc39.es/ecma262/multipage/ecmascript-language-scripts-and-modules.html#sec-cyclic-module-records), Node.js [Modules: CommonJS § Cycles](https://nodejs.org/api/modules.html#cycles). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *how ESM resolves them, and the `undefined` binding you get instead of an
error*.

🔴 **A cycle is not a load error. Linking succeeds; evaluation is where it bites.** ESM gives you
a `ReferenceError` at the too-early read; CommonJS gives you `undefined` and no error at all —
which is the harder of the two to trace.

⚠️ **The mechanism is Master material**
([02 · Deferred and hoisted](../02-module-semantics/02-deferred-and-hoisted.md)). This topic is
the *consequences*: which shapes survive a cycle, why the same cycle passes in one entry point
and throws in another, how to find them, and the four fixes ranked.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[What actually happens in a cycle](./01-what-happens.md)** | Link then evaluate, in one paragraph; the table that predicts every case (function ✅, `class`/`const`/`let` 🔴 TDZ, `var` ⚠️ `undefined`); *when* you read mattering as much as *what*; the worked A⇄B cycle; why the entry point changes the answer; `class extends` as the sharpest edge; and top-level `await` in a cycle |
| 02 | **[Diagnosing and fixing a cycle](./02-diagnosing-and-fixing.md)** | CommonJS's silent partial `module.exports` and the `module.exports = {}` reassignment trap; three levels of detection and why `no-cycle` must be enabled early; the four fixes ranked — extract, invert, defer, move the read later; barrel files as a cycle factory; and the narrow case where a cycle is acceptable |

## Four facts worth carrying out of this topic

- **Function declarations survive a cycle; `const`, `let` and `class` do not.** That is why so
  many cycles work by accident.
- **The entry point decides which side evaluates early**, so a working cycle is lucky, not safe.
- **CommonJS returns a partially populated `module.exports`** — `undefined` that flows onward and
  fails somewhere else.
- **Extracting the shared thing into a third module is the only fix that removes the cycle.** The
  others hide or defer it.

## Phase gate

You can read a `ReferenceError: Cannot access 'X' before initialization`, name the cycle behind
it, explain why the same code works from a different entry point, and pick the fix that removes
the cycle rather than the one that silences it.

## Where this connects

- [02 · Deferred and hoisted](../02-module-semantics/02-deferred-and-hoisted.md) — link versus
  evaluate, and the TDZ result, at Master depth
- [02 · Singletons and strict](../02-module-semantics/01-singletons-and-strict.md) — one
  evaluation per resolved specifier, which is what makes a cycle terminate
- [05 · The expression](../05-dynamic-import/01-the-expression.md) — a dynamic import is outside
  the static graph, which is fix 3
- [Phase 3 · 08 · Hoisting and the TDZ](../../phase-3-functions/08-hoisting-and-tdz/README.md) —
  the TDZ itself
- [Phase 4 · 05 · The prototype chain](../../phase-4-objects-and-classes/05-the-prototype-chain/README.md)
  — what `extends` is evaluating at class-definition time
- **13 · Bundlers and the build** · **15 · CommonJS in a modern world** *(not written yet)*

---

Start → [01 · What actually happens in a cycle](./01-what-happens.md)
