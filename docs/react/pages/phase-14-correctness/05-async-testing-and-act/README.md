---
title: "Async testing and what act() means"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **Testing Library DOM 10.x / RTL 16.x** and **React 19.2**,
> from documentation —
> [dom-testing-library · Async APIs](https://testing-library.com/docs/dom-testing-library/api-async)
> and [react.dev · `act`](https://react.dev/reference/react/act).
> No sandbox script backs this topic; claims are cited, not measured.

**Almost every hard test failure in a React suite is a timing failure.** The element is not
there yet; the element is there but the state update has not been applied; the update lands
after the test has finished and React complains about `act`. All three feel like different
problems and all three come from the same place: the test looked at a moment the app had
not reached.

This topic is the timing model — the three waiting tools and their exact semantics, then
what `act()` actually is and why the warning it produces is usually pointing at a genuine
mistake rather than at missing ceremony.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The three waiting tools](01-the-waiting-tools.md)** | `findBy`, `waitFor` and `waitForElementToBeRemoved`; the documented timeouts and intervals; the throw-to-retry rule that explains most misuse; and the four `waitFor` anti-patterns |
| 02 | **[`act()`, and what the warning means](02-act-and-the-warning.md)** | What `act` does, `IS_REACT_ACT_ENVIRONMENT`, why you rarely call it, the four real causes behind "not wrapped in act(...)", and why silencing it is the wrong fix |

## Why this is two files

The first is a working reference you use while writing tests — which helper, what it waits
for, what its failure means. The second is a diagnosis: a single warning with several
distinct root causes, each with a different fix. Reading the first makes you productive;
reading the second stops you from muting a real bug.

## Where this connects

- **[Topic 03 · The query families](../03-the-query-families/README.md)** — `findBy` is
  introduced there as the retrying query; here it is put in context with `waitFor`.
- **[Topic 04 · `user-event`](../04-user-event-over-fireevent/README.md)** — awaiting every
  interaction is the other half of keeping `act` quiet.
- **[Topic 06 · Mocking the API with MSW](../06-mocking-the-api.md)** — the resolved
  request is what most of these waits are waiting for.
- **[Topic 14 · Flaky tests, fake timers and CI](../14-flaky-tests-and-ci.md)** — timing
  problems that survive this topic are usually about timers or shared state.

---

← Prev: [`user-event` over `fireEvent`](../04-user-event-over-fireevent/README.md) ·
Index: [Phase 14](../README.md) ·
Next → [The three waiting tools](01-the-waiting-tools.md)
