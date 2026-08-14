---
title: "02 · addEventListener"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener), [`removeEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Documentation-validated.

**Four options — and `signal` makes the hardest problem in the topic disappear.**

| Option | Default | What it does |
|---|---|---|
| `capture` | `false` | fire during capture instead of bubble |
| `once` | `false` | invoked at most once, then removed |
| `passive` | `false`\* | promises never to call `preventDefault()` |
| `signal` | — | removed when the `AbortSignal` aborts |

\* `true` by default for `wheel`/`touchstart`/`touchmove` on root nodes in most browsers.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Options and removal](./01-options-and-removal.md)** | The **identity trap** — removal matches on the function reference, so two identical arrows are two unremovable listeners while the same named reference is silently deduplicated; `signal` and the one-controller-per-lifecycle pattern MDN recommends; `once`; and `passive` as a **contract the browser optimises against**, including the root-node default that quietly makes `preventDefault` a no-op |

## The three sentences to keep

1. **Removal matches the reference.** An arrow literal can never be removed by name.
2. **One `AbortController` per lifecycle, `abort()` in teardown** — the whole problem, gone.
3. **`passive` is a promise you can break silently**, and it is already `true` by default for
   touch and wheel on root nodes.

## Phase gate

You are done with this topic when you can explain why adding the same arrow twice differs
from adding the same named function twice, use `signal` for cleanup without thinking about it,
and say why a `touchmove` `preventDefault` might do nothing.

## Where this connects

- [01 · The event model](../01-the-event-model/README.md) — what `capture` selects
- [Phase 8 · 04 · 02 · The four leaks](../../phase-8-modules-errors/04-leaks/02-the-four-leaks.md) — the listener leak this topic prevents

---

Start → [01 · Options and removal](./01-options-and-removal.md)
