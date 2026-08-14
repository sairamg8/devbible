---
title: "01 · DevTools beyond console.log"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console) and the [WHATWG Console specification](https://console.spec.whatwg.org/) — and the Chrome DevTools documentation — [Coverage](https://developer.chrome.com/docs/devtools/coverage), [Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems). Documentation-validated; **no console blocks or screenshots**, because no session produced them.

**Debugging skill is mostly knowing which question you are asking.** `console.log` answers one
question — "what is this value here?" — and people use it for the other five because the tools
that answer those are less familiar, not because they are harder.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The console API in full](./01-the-console-api.md)** | The twenty methods and what each is *for* — `table` for rows, `dir` for properties (and why `log(el)` shows you markup instead), `group`, `time`, **`count` for "is this running twice?"**, `assert`, `trace`, `timeStamp`; the six format specifiers including `%c`; 🔴 **the live-reference trap** where a logged object shows its current state rather than a snapshot; and why console logging is neither free nor private in production |
| 2 | **[The panels](./02-the-panels.md)** | Which panel answers which question; the Network panel as the thing that settles client-vs-server arguments (and why the **`OPTIONS`** entry is the one to read); breakpoints that replace logging — conditional, **logpoint**, DOM, event-listener, fetch/XHR — and blackboxing; the Performance panel for **long tasks**, with the warning that it is not a benchmark; heap snapshots, the Allocation Timeline and **detached DOM nodes**; and 🔴 **why Coverage's "unused" is not a delete list** |

## The three sentences to keep

1. **`console.dir` for properties, `console.log` for rendering, `console.table` for rows** — and
   a logged object is a live reference, not a snapshot.
2. **Most "impossible" bugs are answered by a breakpoint you have not used** — DOM removal,
   XHR/fetch, or a logpoint in code you cannot edit.
3. **Coverage reports what did not run during the recording**, not what is never used.

## Phase gate

You are done with this topic when your first move on a mystery is a breakpoint rather than a
`console.log`, you can find which code removed a DOM node without reading the code, and you can
say why a logged object's contents can change after you logged it.

## Where this connects

- [Phase 11 · 05 · CORS from the client side](../../phase-11-network-storage/05-cors-client-side/README.md) — the console/network reading this topic makes possible
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — what the Memory panel is looking for
- [Phase 7 · 02 · The event loop](../../phase-7-async/02-the-event-loop/README.md) — what a long task in the Performance panel actually is

---

Start → [01 · The console API in full](./01-the-console-api.md)
