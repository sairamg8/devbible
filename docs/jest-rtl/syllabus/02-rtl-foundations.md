---
title: "Part 2 — React Testing Library Foundations & Interaction"
sidebar_label: "2 · RTL Foundations & Interaction"
sidebar_position: 2
---

> Phases 04–06 · The DOM mental model, query hierarchy, user-event, and async waiting

React Testing Library (RTL) is not a test runner — it is a lightweight DOM testing utility designed to test components the way real users and assistive technologies experience them, rather than asserting on internal state or implementation details.

---

## Phase 04 — The RTL Mental Model & Query Architecture

The foundational philosophy, DOM querying rules, and accessible assertions.

| Topic | Tier |
|---|---|
| **The guiding principle & `screen`** — "The more your tests resemble the way your software is used, the more confidence they can give you"; why querying state, props, or component instances breaks on refactor | <span className="db-tier t-master">Master</span> |
| **The query family matrix** — `getBy*` (throws on 0 or >1), `queryBy*` (returns null, for asserting absence), `findBy*` (async retry/polling with timeout); single vs `*AllBy*` variants | <span className="db-tier t-master">Master</span> |
| **Accessibility-first query priority** — `getByRole` (role + accessible name) → `getByLabelText` → `getByPlaceholderText` → `getByText` → `getByDisplayValue` → `getByAltText` → `getByTitle` → `getByTestId` (last resort) | <span className="db-tier t-master">Master</span> |
| DOM matchers with `@testing-library/jest-dom` — `toBeInTheDocument()`, `toBeVisible()`, `toBeDisabled()`, `toHaveValue()`, `toHaveAccessibleName()`, and `toHaveAttribute()` | <span className="db-tier t-understand">Understand</span> |
| Scoped queries within container subtrees — using `within(container).getByRole(...)` to disambiguate identical elements across multiple cards, rows, or list items | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can query any element in a complex rendered UI using only role, label, or text without ever resorting to `data-testid` or CSS class selectors.

---

## Phase 05 — User Interaction & Event Simulation

Driving the UI realistically with `@testing-library/user-event`.

| Topic | Tier |
|---|---|
| **`user-event` v14 setup and execution** — why `userEvent.setup()` must be called before rendering, session state management, and why every interaction is an `await` | <span className="db-tier t-master">Master</span> |
| Realistic input & pointer interactions — `user.click()`, `user.type()`, `user.clear()`, `user.selectOptions()`, and `user.upload()`; how user-event triggers full event cascades (hover, focus, keyDown, keyPress, change, keyUp, blur) | <span className="db-tier t-understand">Understand</span> |
| Keyboard navigation & focus management — `user.tab()`, `user.keyboard('{Enter}')`, `user.keyboard('{Escape}')`, asserting `toHaveFocus()`, and verifying focus trap / modal escape behavior | <span className="db-tier t-understand">Understand</span> |
| `fireEvent` vs `userEvent` — why `fireEvent.click()` only dispatches a synthetic DOM event without firing companion focus/blur events, and the rare cases where `fireEvent` is still needed | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a test that fills out an accessible form using keyboard tab navigation and typing, submitting with Enter, and asserting the focused error field on validation failure.

---

## Phase 06 — Asynchronous Waiting & the `act()` Model

Handling timing, asynchronous DOM mutations, and React's rendering pipeline.

| Topic | Tier |
|---|---|
| **`findBy*` vs `waitFor`** — when to use `findByRole` (waiting for a single element to appear) vs `waitFor` (waiting for complex multi-assertion conditions or side effects) | <span className="db-tier t-master">Master</span> |
| `waitFor` rules and pitfalls — why side effects must never live inside `waitFor`, configuring `timeout` and `interval`, and avoiding empty `waitFor(() => {})` polling hacks | <span className="db-tier t-understand">Understand</span> |
| Waiting for element removal — `waitForElementToBeRemoved()` vs `expect(queryByText(...)).not.toBeInTheDocument()` after async settling; testing loading spinners and skeletons | <span className="db-tier t-understand">Understand</span> |
| The `act(...)` warning demystified — what React's `act()` warning actually signals in React 18/19 (an unhandled state update outside the test boundary), and why manual `act()` wrapping is almost always a code smell | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can debug and eliminate an `act()` warning in an async component test without wrapping code in `act()`, by properly awaiting the underlying DOM change or Promise.

---

## Where this connects

- **Part 3 (Advanced Integration)**: Combines queries and user interactions with Mock Service Worker (MSW) and state providers.
- **React Phase 14 (`docs/react/pages/phase-14-correctness/`)**: Mirrors and expands on the React core testing standards.
