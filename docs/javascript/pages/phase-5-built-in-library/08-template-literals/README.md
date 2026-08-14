---
title: "08 · Template literals"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), [`String.raw()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/raw), [`Symbol.toPrimitive`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive). Documentation-validated; **no timings**.

Backticks look like a nicer quote mark, and for interpolation and multiline text that is all they
are. **Tagged templates are the part that is genuinely different** — a tag function receives the
literal pieces and the interpolated values *separately*, which is a distinction plain string
building destroys.

That one property is why `sql`, `gql`, `styled` and `html` tags exist: they can treat the text you
wrote as trusted and the values as not.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Interpolation and multiline](./01-interpolation-and-multiline.md)** | What `${}` accepts, the string conversion behind every interpolation (`"[object Object]"`, `"1,2,3"`, `"null"`, symbols throwing), the indentation trap in multiline literals, and when a template literal is the wrong tool — including the XSS case |
| 2 | **[Tagged templates](./02-tagged-templates.md)** | The `(strings, ...values)` shape and its invariant, safe interpolation for SQL and HTML, `.raw` and `String.raw`, the frozen strings array cached per call site and how libraries use it, where you meet tags in the wild, and when writing one is a bad idea |

## Phase gate

You are done with this topic when you can say **what a tag function receives**, and **why a `sql`
tagged template can prevent injection when a plain template literal cannot**.

## Where this connects

- [Phase 4 · 17 · The ToPrimitive protocol](../../phase-4-objects-and-classes/17-tostring-valueof-toprimitive/01-the-toprimitive-protocol.md) — the conversion every `${}` performs
- [07 · String methods](../07-string-methods/README.md) — the alternatives for building and slicing strings
- [Phase 4 · 16 · Extending and patching](../../phase-4-objects-and-classes/16-prototype-patterns-to-avoid/01-extending-and-patching.md) — the same argument about behaviour invisible at the call site
- **21 · `structuredClone`** *(not written yet)* and **15/16 · Regular expressions** *(not written yet)* — `String.raw` matters for regex sources

---

Start → [Interpolation and multiline](./01-interpolation-and-multiline.md)
