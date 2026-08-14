---
title: "03 · Creating and inserting"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`createElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement), [`append`](https://developer.mozilla.org/en-US/docs/Web/API/Element/append), [`insertAdjacentHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML), [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment). Documentation-validated.

**Creating a node and placing it are separate steps** — and everything useful in this topic
lives in the gap between them.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Building and placing nodes](./01-building-and-placing.md)** | `createElement` and why a detached node is cheap; the modern `append`/`prepend`/`before`/`after` family versus `appendChild`, and that **strings become text**, not markup; insertion **moving** rather than copying, and `cloneNode` not carrying listeners; building in a `DocumentFragment`; and `insertAdjacentHTML`'s four positions, why it beats **`innerHTML +=`** (which destroys every listener in the subtree), and the injection-sink warning |

## The three sentences to keep

1. **`append` accepts strings and inserts them as text.** That makes it safe where
   `innerHTML` is not.
2. **`innerHTML +=` reparses the whole subtree** — every listener, every property-only state
   like `checked`, gone.
3. **Inserting moves; `cloneNode` copies markup but never listeners.**

## Phase gate

You are done with this topic when you can list the four `insertAdjacentHTML` positions,
explain exactly what `innerHTML +=` destroys and why, and say what happens when you append a
node that is already in the document.

## Where this connects

- [02 · Selecting elements](../02-selecting-elements/README.md) — where the nodes you insert against come from
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — the detached nodes a reparse leaves behind

---

Start → [01 · Building and placing nodes](./01-building-and-placing.md)
