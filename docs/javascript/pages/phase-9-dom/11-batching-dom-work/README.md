---
title: "11 · Batching DOM work"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`DocumentFragment`](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment), [`<template>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template), [`Long Tasks API`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming). Documentation-validated; **no timings**.

The syllabus row asks for **a thousand rows without freezing the page**, and that is two different
problems wearing one coat:

> 1. **Touch the live document as few times as possible** — build off-document, insert once.
> 2. **Do not occupy the main thread for so long that the page stops responding** — and no amount
>    of batching fixes that on its own.

The first is an API question with a clean answer. The second is a scheduling question, and it is
the one that actually decides whether the page feels broken.

🔴 **This page carries no timings and no benchmark numbers.** Under the no-new-sandboxes rule
these pages explain the *mechanism* and cite the documentation; where you need a number for your
own app, measure your own app.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Build off-document](./01-build-off-document.md)** | `DocumentFragment`, `<template>` and its inert content, cloning, `append(...nodes)`, and what "one insertion" actually buys |
| 02 | **[Not freezing the page](./02-not-freezing-the-page.md)** | Long tasks, chunking work across frames, yielding to the browser, and the better answer — not rendering what nobody is looking at |

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [03 · Creating and inserting](../03-creating-and-inserting/README.md) — the insertion API this
  builds on
- [10 · Removing and replacing](../10-removing-and-replacing/README.md) — `replaceChildren` as the
  one-call swap
- **12 · Layout thrashing** *(not written yet)* — the *other* half of DOM performance, and the one
  batching does not solve

---

Start → [01 · Build off-document](./01-build-off-document.md)
