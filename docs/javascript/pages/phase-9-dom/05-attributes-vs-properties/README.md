---
title: "05 · Attributes versus properties"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`setAttribute`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute), [`getAttribute`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAttribute), [`dataset`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset). Documentation-validated.

**Attributes are the markup; properties are the live object.** Two different things that
share names — and every confusing behaviour here comes from treating them as one.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Two parallel worlds](./01-two-parallel-worlds.md)** | The attribute as *initial* value and the property as *current* — with `value`, `checked`, `class`/`className`/`classList` and `href` worked through; attributes always being **strings**; **boolean attributes**, where presence is truth so `setAttribute("disabled", "false")` disables; lowercase name normalisation; and `data-*`/`dataset`, including why `"0"` is truthy |

## The three sentences to keep

1. **The attribute is the initial value; the property is the current one.** Reading
   `getAttribute("value")` to find what the user typed is a bug.
2. **Boolean attributes are true if present at all** — so set the property, not the attribute.
3. **Every attribute value is a string**, including `data-count="0"`, which is truthy.

## Phase gate

You are done with this topic when you can explain why `setAttribute("disabled", "false")`
disables an element, say which of `value`/`checked` survives a subtree rebuild and why, and
use `dataset` without being caught by string values.

## Where this connects

- [04 · `textContent` vs `innerText` vs `innerHTML`](../04-text-vs-html/README.md) — why a reparse loses property-only state
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — `WeakMap` as the home for data too big for `dataset`

---

Start → [01 · Two parallel worlds](./01-two-parallel-worlds.md)
