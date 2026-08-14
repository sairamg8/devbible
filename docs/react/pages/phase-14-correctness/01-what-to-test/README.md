---
title: "What to test, and what not to"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **React Testing Library 16.x**, from documentation —
> Testing Library [Guiding Principles](https://testing-library.com/docs/guiding-principles),
> [React Testing Library intro](https://testing-library.com/docs/react-testing-library/intro)
> and [FAQ](https://testing-library.com/docs/react-testing-library/faq); plus Kent C.
> Dodds, ["Testing Implementation Details"](https://kentcdodds.com/blog/testing-implementation-details)
> (17 August 2020), cited as the RTL author's stated rationale rather than as reference
> documentation. No sandbox script backs this topic; claims are cited, not measured.

**This is the one decision that determines whether a test suite is an asset or a tax.**
Everything else in the phase — which query to use, which event helper, where to put the
mock — is a smaller version of the same question: *is this thing I am asserting on
something a user of this component would recognise?*

A suite that tests the wrong things is worse than no suite. It costs time to write, it
costs time on every refactor, it fails for reasons nobody cares about — and because it is
green most of the time, it buys trust it has not earned.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Implementation details, and the two ways a test lies](01-implementation-details.md)** | What an implementation detail actually is, the false negative and the false positive, the two users of a component, and the refactor drill that settles any argument |
| 02 | **[What earns a test](02-what-earns-a-test.md)** | A decision procedure per component shape, the list of things not to test at all, and why coverage percentage is the wrong target |
| 03 | **[The cases worth writing](03-the-cases-worth-writing.md)** | Loading, success, empty, error — the four states most suites test one of; regression tests; and what a good test file looks like end to end |

## Why this is three files

Because it is three separable questions, and answering them in one file would force each
one shorter than it deserves. The first is *what is wrong with the tests people write* —
a diagnosis. The second is *what should I write instead* — a procedure. The third is
*what does that produce for one real feature* — the worked output. You can act on the
first without the third; you cannot act on the third without the first.

## Where this connects

- **[Topic 02 · RTL's model](../02-the-rtl-model/README.md)** — the library is built so that the
  wrong test is *hard to write*. That is a design decision, not an omission.
- **[Topic 03 · The query families](../03-the-query-families.md)** — the priority order is
  this topic's principle turned into a ranked list.
- **[Topic 12 · Snapshot tests](../12-snapshot-tests.md)** — the purest form of the
  mistake this topic names: an assertion that fails on every change and describes none.
- **[Phase 7 · Custom hooks](../../phase-7-custom-hooks/README.md)** — a custom hook is the
  one place where "internals" genuinely are somebody's public API, which is why
  [topic 09](../09-testing-hooks.md) has to be careful.

---

← Index: [Phase 14](../README.md) ·
Next → [Implementation details, and the two ways a test lies](01-implementation-details.md)
