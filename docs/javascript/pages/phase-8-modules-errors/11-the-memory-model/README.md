---
title: "11 · The memory model"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [JavaScript data types and data structures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures), [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef), [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) — and ECMAScript [§ ECMAScript Language Types](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types). Documentation-validated; **no timings, no console blocks**.

The syllabus row is *stack versus heap, what a reference costs, and what makes an object
reachable*.

🔴 **The whole topic collapses to one reframing: an object's cost is not its size, it is what it
keeps alive.** "How big is this?" is almost never the useful question; "how long is it kept, and
by whom?" always is.

⚠️ **Two neighbours own the ends of this.** Values versus references is
[Phase 1 · 02](../../phase-1-values-and-coercion/02-references-vs-values.md); reachability,
mark-and-sweep and the leak catalogue are Master
([04 · Reachability](../04-leaks/01-reachability.md),
[04 · The four leaks](../04-leaks/02-the-four-leaks.md)). This topic is the model in between, and
the reasoning you do *before* a profiler is open.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Stack, heap, and what a variable holds](./01-stack-and-heap.md)** | The two regions and 🔴 why they are a model rather than a specification; a variable holding a value or a reference, and everything that follows — assignment, argument passing, identity equality, `const`; the three copy depths and what each loses; what a reference actually costs; and the **shallow versus retained size** vocabulary |
| 02 | **[Cost is retention](./02-cost-is-retention.md)** | The **retainer chain** and reading it backwards; the **four anchors** — module state, closures, registrations, the DOM — with the release for each; why a closure's engine-trimmed scope is an optimisation and not a guarantee; detached subtrees; `WeakMap` against the honest limits of `WeakRef` and `FinalizationRegistry`; and three questions to ask at design time |

## Four facts worth carrying out of this topic

- **Stack and heap are a mental model.** The language specifies neither — reason with it, never
  depend on it.
- **Retained size, not shallow size**, is why a 40-byte closure can be responsible for megabytes.
- **Nulling one variable frees nothing** if any other link in the retainer chain survives.
- **Growth per interaction is the leak tell**; growth per unit of data loaded is just the working
  set.

## Phase gate

Given "memory grows every time this view opens and closes", you can name the four places the
reference is likely anchored, say what would release each, and explain why setting one variable to
`null` did not help.

## Where this connects

- [Phase 1 · 02 · References vs values](../../phase-1-values-and-coercion/02-references-vs-values.md)
  — the value model this builds on
- [Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md)
  — the copy comparison in full
- [04 · Reachability](../04-leaks/01-reachability.md) — roots, mark-and-sweep, and why cycles do
  not leak
- [04 · The four leaks](../04-leaks/02-the-four-leaks.md) — the catalogue these anchors produce
- [Phase 7 · 14 · The model](../../phase-7-async/14-cancellation/01-the-model.md) — one
  `AbortController` per scope as the release for registrations
- [Phase 3 · 06 · Closures](../../phase-3-functions/06-closures/README.md) — what a closure
  captures
- **12 · Finding a leak** *(not written yet)* — the same reasoning, with a heap snapshot open

---

Start → [01 · Stack, heap, and what a variable holds](./01-stack-and-heap.md)
