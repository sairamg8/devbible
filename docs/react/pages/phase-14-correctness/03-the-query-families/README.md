---
title: "The query families"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **Testing Library DOM 10.x / RTL 16.x**, from documentation —
> [Queries · About](https://testing-library.com/docs/queries/about) (the query-type table,
> the priority order, `TextMatch`) and
> [ByRole](https://testing-library.com/docs/queries/byrole) (options, the accessibility
> tree, the performance note).
> No sandbox script backs this topic; claims are cited, not measured.

**Every query in Testing Library is two decisions.** First *how* you look — throw, return
null, or retry until it appears. Then *what* you look for — a role, a label, some text, a
test id. The first decision is a matter of mechanics and gets people stuck on flaky tests;
the second is a matter of policy and gets people stuck on brittle ones.

Learn them as two things, because they compose: `findByRole` is the retrying *how* applied
to the best *what*, and it is by some distance the query you will type most often.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[`getBy`, `queryBy`, `findBy`](01-get-query-find.md)** | The six functions and the exact behaviour of each, why `queryBy` exists only for absence, why `findBy` beats `waitFor(() => getBy…)`, timeouts, `TextMatch` and whitespace normalisation |
| 02 | **[The priority order](02-the-priority-order.md)** | Why role comes first and test ids last, the rationale for each rung, `getByRole`'s options in depth, `within`, and the narrow cases where a test id is the right answer |

## Why this is two files

The first chunk is about **failure behaviour** — what happens when the element is missing,
duplicated, or not there yet. Getting it wrong produces flaky tests and useless error
messages. The second is about **selection policy** — which handle on an element you choose
to grab. Getting *that* wrong produces tests that break on every refactor. Same API,
different mistakes, learned at different times.

## Where this connects

- **[Topic 02 · RTL's model](../02-the-rtl-model/README.md)** — `screen` is where all of
  these live, pre-bound to `document.body`.
- **[Topic 04 · `user-event` over `fireEvent`](../04-user-event-over-fireevent/README.md)** —
  queries find the element; `user-event` is how you then interact with it.
- **[Topic 05 · Async testing and `act()`](../05-async-testing-and-act/README.md)** — `findBy` is
  the async half of this topic, taken further.
- **[Topic 11 · Roles are the query surface](../11-roles-as-the-query-surface.md)** — what
  to do when the element you want has no role and no name.

---

← Prev: [React Testing Library's model](../02-the-rtl-model/README.md) ·
Index: [Phase 14](../README.md) ·
Next → [`getBy`, `queryBy`, `findBy`](01-get-query-find.md)
