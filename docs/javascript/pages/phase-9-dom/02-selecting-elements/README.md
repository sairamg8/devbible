---
title: "02 · Selecting elements"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Document.querySelectorAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll), [`NodeList`](https://developer.mozilla.org/en-US/docs/Web/API/NodeList), [`HTMLCollection`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection). Documentation-validated.

**The choice is not about speed. It is about whether the result keeps changing after you get
it.**

> `querySelectorAll` "returns a **static (not live)** `NodeList`" — MDN, where the
> `getElementsBy*` family returns a **live** `HTMLCollection`.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The selector methods](./01-the-selector-methods.md)** | The five methods and their **not-found** behaviour — `null` that throws versus an empty list that fails silently; **static versus live**, and why live is usually worse (the removal loop that skips every other element); neither result being an array, and `NodeList` having `forEach` where `HTMLCollection` has nothing; `:scope` for genuinely relative selectors; and where the only real performance cost is |

## The three sentences to keep

1. **Single-element methods return `null`; list methods return an empty list.** One throws,
   one is silent.
2. **Live collections break loops that mutate.** Static lists go stale across a re-render.
   Query late, use immediately, do not store.
3. **`NodeList` has `forEach`; `HTMLCollection` has nothing.** Spread either for real array
   methods.

## Phase gate

You are done with this topic when you can say what each method returns when nothing matches,
explain the every-other-element removal bug without looking it up, and say why `:scope`
exists.

## Where this connects

- [01 · What the DOM is](../01-what-the-dom-is/README.md) — nodes versus elements, which these methods only ever return the element half of
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — a stored collection of detached nodes

---

Start → [01 · The selector methods](./01-the-selector-methods.md)
