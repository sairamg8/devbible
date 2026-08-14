---
title: "Part 4 — Testing React"
sidebar_label: "4 · Testing React"
sidebar_position: 4
---

> Phase 14 · 14 topics · React Testing Library, Jest/Vitest, events and API mocking

**This part was cut down to testing.** It originally planned three phases — data
and state, routing, and a broad "correctness" phase covering errors,
accessibility, security, deployment and upgrades. Phases 12 and 13 were dropped,
and Phase 14 was narrowed to the thing it was really for: **writing tests for
React components that survive a refactor.**

What that means in practice:

- **In scope** — React Testing Library, a runner (Jest or Vitest), driving the UI
  with `user-event`, waiting for async correctly, and mocking the network.
- **Out of scope** — error boundaries (already covered in
  [Phase 8](03-concurrent-and-server.md)), accessibility as its own subject,
  security, bundling, deployment and upgrade codemods. Roles and accessible names
  appear here only because they are how you *query* a component.

This phase is **parallelizable** — it can be read alongside anything else, and
most of it applies to a codebase written before you arrived.

---

## Phase 14 — Testing React

*14 topics.* Overview depth, not a testing encyclopedia. The aim is that you can
open an untested component and know what to write, in what order, and what not to
bother with.

| Topic | Tier |
|---|---|
| **What to test, and what not to** — test what the user does through the DOM; why "did `setState` get called" is a test that fails on every refactor and catches nothing. The one decision that determines whether a suite is an asset or a tax | <span className="db-tier t-master">Master</span> |
| **React Testing Library's model** — `render`, `screen`, and the guiding principle that a test should resemble how the software is used. What RTL deliberately does *not* give you | <span className="db-tier t-master">Master</span> |
| **The query families** — `getBy*` throws, `queryBy*` returns `null`, `findBy*` is async and retries; the `*AllBy*` variants; and the documented **priority order** ending at `getByTestId` as a last resort | <span className="db-tier t-master">Master</span> |
| **`user-event` over `fireEvent`** — why a real click is a sequence of events, not one; typing that respects `maxLength` and disabled state; and the setup call people forget | <span className="db-tier t-master">Master</span> |
| **Async testing** — `findBy*` versus `waitFor` versus `waitForElementToBeRemoved`, the assertions that must go *inside* a wait and those that must not, and **what the `act()` warning actually means** | <span className="db-tier t-master">Master</span> |
| **Mocking the API** — MSW at the network layer instead of stubbing `fetch`; sharing handlers between tests and development; and testing the loading and error paths on purpose rather than by accident | <span className="db-tier t-master">Master</span> |
| **Jest or Vitest** — what each gives you, the jsdom environment, ESM and transform pain, and the honest answer for a Vite project versus a legacy one | <span className="db-tier t-understand">Understand</span> |
| **Testing forms and Actions** — filling a form the way a user does, asserting on the submitted payload, and testing the pending and error states of a `<form action>` from [Phase 9](03-concurrent-and-server.md) | <span className="db-tier t-understand">Understand</span> |
| **Testing hooks** — `renderHook` from RTL, when a hook deserves its own test, and when testing it through a real component is the better test | <span className="db-tier t-understand">Understand</span> |
| **Wrappers — context, providers and the router** — the `wrapper` option, a single `renderWithProviders` helper, and why every test re-creating the provider tree is a maintenance trap | <span className="db-tier t-understand">Understand</span> |
| **Roles are the query surface** — querying by role and accessible name makes the test resemble a screen reader; a component that is hard to query is usually a component that is hard to use | <span className="db-tier t-understand">Understand</span> |
| Snapshot tests — the narrow case where they earn their place, and why a large auto-updated snapshot asserts nothing | <span className="db-tier t-know">Know</span> |
| Testing Server Components and async components — what is genuinely testable in 2026, what is not, and pushing logic out of them so it can be unit-tested at all | <span className="db-tier t-know">Know</span> |
| Flaky tests, fake timers and CI — the usual causes (real timers, unawaited promises, shared state between tests), and the cost of a suite nobody trusts | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a test suite for one real feature that drives the UI by
role with `user-event`, mocks the network at the transport layer, asserts the
loading, success and error states, and contains **no** assertion about component
internals — and which still passes after you rename every internal function and
state variable in the component.

---

## Where this connects

- **Phase 14 → Phase 9** — forms and Actions are the most-tested thing in most
  applications; this phase tests what that phase built.
- **Phase 14 → Phase 7** — `renderHook` was introduced there for custom hooks;
  here it is put in its place relative to testing through a component.
- **Phase 14 → Phase 4** — effects are where flaky tests come from. Most `act()`
  warnings are an effect updating state after the test stopped looking.
- **Deliberately not here:** end-to-end testing, CI pipeline design, container
  images and infrastructure. Those are **Docker & Podman** and remain
  project-based.
- **Dropped from this part entirely:** the planned **Phase 12** (data and state in
  a real app) and **Phase 13** (routing and the app shell). Neither was written.
  Earlier pages that pointed forward to them now say so rather than promising a
  page that does not exist.

---

← Prev: [Part 3 — Concurrent React and the server](03-concurrent-and-server.md) · Index: [React](../README.md)
