---
title: "Phase 14 — Testing React"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8, React Testing Library 16.x, `@testing-library/user-event` 14.x,
> MSW 2.x.** No sandbox and **no console blocks** — every claim is validated against
> primary documentation and each page's `> Verified:` line names its sources.

🚧 **5 of 14 topics written** — 11 leaf pages.

**Tests for React components that survive a refactor.** Not a testing encyclopedia: the
aim is that you can open an untested component and know what to write, in what order, and
what not to bother with.

The phase rests on one sentence, which is Testing Library's stated guiding principle:

> **The more your tests resemble the way your software is used, the more confidence they
> can give you.**

Everything here — why `getByRole` outranks `getByTestId`, why `user-event` outranks
`fireEvent`, why the network is mocked at the transport layer rather than by stubbing
`fetch` — is that sentence applied to a different decision.

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[What to test, and what not to](01-what-to-test/README.md)** | <span className="db-tier t-master">Master</span> | The one decision that makes a suite an asset or a tax |
| 02 | **[React Testing Library's model](02-the-rtl-model/README.md)** | <span className="db-tier t-master">Master</span> | `render`, `screen`, and what RTL deliberately refuses to give you |
| 03 | **[The query families](03-the-query-families/README.md)** | <span className="db-tier t-master">Master</span> | `getBy` throws, `queryBy` returns null, `findBy` retries — and the priority order |
| 04 | **[`user-event` over `fireEvent`](04-user-event-over-fireevent/README.md)** | <span className="db-tier t-master">Master</span> | A real click is a sequence of events, not one |
| 05 | **[Async testing and what `act()` means](05-async-testing-and-act/README.md)** | <span className="db-tier t-master">Master</span> | `findBy` vs `waitFor` vs `waitForElementToBeRemoved`, and the warning everyone mutes |
| 06 | **[Mocking the API with MSW](06-mocking-the-api.md)** | <span className="db-tier t-master">Master</span> | Intercept the network, not your own modules |
| 07 | **[Jest or Vitest](07-jest-or-vitest.md)** | <span className="db-tier t-understand">Understand</span> | jsdom, ESM and transforms — the honest answer for each project shape |
| 08 | **[Testing forms and Actions](08-testing-forms-and-actions.md)** | <span className="db-tier t-understand">Understand</span> | Asserting on the submitted payload, and the pending and error states |
| 09 | **[Testing hooks](09-testing-hooks.md)** | <span className="db-tier t-understand">Understand</span> | `renderHook`, and when a real component is the better test |
| 10 | **[Wrappers — context, providers and the router](10-wrappers-and-providers.md)** | <span className="db-tier t-understand">Understand</span> | One `renderWithProviders`, not a provider tree per test |
| 11 | **[Roles are the query surface](11-roles-as-the-query-surface.md)** | <span className="db-tier t-understand">Understand</span> | Hard to query is usually hard to use |
| 12 | **[Snapshot tests](12-snapshot-tests.md)** | <span className="db-tier t-know">Know</span> | The narrow case where they earn their place |
| 13 | **[Testing Server Components](13-testing-server-components.md)** | <span className="db-tier t-know">Know</span> | What is genuinely testable in 2026, and what is not |
| 14 | **[Flaky tests, fake timers and CI](14-flaky-tests-and-ci.md)** | <span className="db-tier t-know">Know</span> | The usual causes, and the cost of a suite nobody trusts |

## What this phase is not

- **Not end-to-end testing.** Playwright and Cypress drive a real browser against a real
  server; that is a different tool, a different failure mode and a different phase.
- **Not error boundaries.** They are covered in
  [Phase 8](../phase-8-concurrent-suspense/README.md) as a rendering concern.
- **Not accessibility as a subject.** Roles and accessible names appear here only because
  they are how you *query* a component — [topic 11](11-roles-as-the-query-surface.md)
  is explicit about that boundary.
- **Not CI pipeline design.** [Topic 14](14-flaky-tests-and-ci.md) covers what makes a
  suite fail differently on CI than on your laptop, and stops there.

## Where this phase connects

- **[Phase 9 · Forms and Actions](../phase-9-forms-actions/README.md)** — forms are the
  most-tested thing in most applications. [Topic 08](08-testing-forms-and-actions.md)
  tests what that phase built, including a `<form action>`'s pending and error states.
- **[Phase 7 · Custom hooks](../phase-7-custom-hooks/README.md)** — `renderHook` was
  introduced there. [Topic 09](09-testing-hooks.md) puts it in its place relative to
  testing through a component.
- **[Phase 4 · Effects](../phase-4-effects/README.md)** — effects are where flaky tests
  come from. Most `act()` warnings are an effect updating state after the test stopped
  looking; [topic 05](05-async-testing-and-act/README.md) takes that apart.
- **[Phase 10 · Server Components](../phase-10-server-components/README.md)** — a Server
  Component has no client runtime to render into a jsdom document.
  [Topic 13](13-testing-server-components.md) is honest about what follows from that.

## Gate

**Deliverable:** a test suite for one real feature that drives the UI by role with
`user-event`, mocks the network at the transport layer, asserts the loading, success and
error states, and contains **no** assertion about component internals — and which still
passes after you rename every internal function and state variable in the component.

That last clause is the whole phase in one sentence. A suite that breaks when you rename a
handler was testing the handler, not the feature.

---

← Index: [React — Explanations](../README.md) ·
Start → [What to test, and what not to](01-what-to-test/README.md)
