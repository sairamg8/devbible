---
title: "Jest & RTL — Overview"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-19 against [Jest documentation](https://jestjs.io/docs/getting-started), [Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [MSW v2 documentation](https://mswjs.io/docs/), and [Vitest guide](https://vitest.dev/guide/).

The complete syllabus and reference for **Jest** and **React Testing Library (RTL)**, scoped to production-grade fullstack application development (MERN/PERN).

---

## Syllabus Architecture

The curriculum is divided into **4 parts** and **12 phases** covering runner internals, accessible DOM querying, 3rd-party library mocking recipes, provider harnesses, `setupTests` configurations, and high-performance CI pipelines.

| Part | Title | Phases | Topics | Focus |
|---|---|---|---|---|
| **[Part 1](syllabus/01-jest-runner.md)** | [Jest Core & Test Runner Mechanics](syllabus/01-jest-runner.md) | 01–03 | 14 | Execution tree, hook scoping, `expect` API, `test.each`, deterministic mocks & fake timers |
| **[Part 2](syllabus/02-rtl-foundations.md)** | [RTL Foundations & Interaction](syllabus/02-rtl-foundations.md) | 04–06 | 13 | The RTL mental model, accessible query hierarchy, `user-event` v14, `waitFor` & `act()` |
| **[Part 3](syllabus/03-advanced-integration.md)** | [State, Network, 3rd-Party Mocks & Modern React](syllabus/03-advanced-integration.md) | 07–10 | 20 | `renderWithProviders`, Redux & TanStack Query cache isolation, MSW v2, 3rd-party library mocking (Radix, Lucide, Framer Motion, Router, Canvas, Storage), React 19 Actions/Transitions, `jest-axe` |
| **[Part 4](syllabus/04-production-ci.md)** | [Production Setup & CI](syllabus/04-production-ci.md) | 11–12 | 12 | Zero-to-one setup, `setupFiles` vs `setupFilesAfterEnv`, Vite/Vitest `test.setupFiles`, polyfill checklist, SWC transpilation, ESM resolution, CI worker tuning, sharding, Vitest migration bridge |

---

## Tier Distribution

Total syllabus topics: **59** across 12 phases.

| Badge | Tier | Topic Count | % of Total | Description |
|---|---|---|---|---|
| `<span className="db-tier t-master">Master</span>` | **Must Learn & Master** | 17 | 28.8% | Core runner mechanics, RTL query priority, `userEvent.setup`, async waiting, MSW v2, custom render, `setupTests.ts` architecture |
| `<span className="db-tier t-understand">Understand</span>` | **Must Understand** | 35 | 59.3% | Hook testing, fake timers, 3rd-party library mocks (Framer Motion, Canvas, SDKs, Storage), SWC transforms, ESM resolution, TanStack/Redux isolation, CI tuning |
| `<span className="db-tier t-know">Know</span>` | **Should Know** | 6 | 10.2% | Snapshots, test filtering flags, icon mocking, debugging tools (`screen.debug`), module hoisting details |
| `<span className="db-tier t-when">When Needed</span>` | **Learn When Needed** | 1 | 1.7% | Custom matchers (`expect.extend`) |

---

## Existing Explanation Pages (Draft Corpus)

The following 16 foundation chapters are available in [`pages/`](pages/README.md) and are being validated against the Devbible contract:

| # | Section | Link |
|---|---|---|
| 01 | Jest core concepts | [01 · Test structure](pages/01-jest-core-concepts/01-test-structure.md) |
| 02 | Assertions and matchers | [02 · The expect API](pages/02-assertions-and-matchers/01-the-expect-api.md) |
| 03 | Mocking | [03 · Jest mock functions](pages/03-mocking/01-jest-mock-functions.md) |
| 04 | Async testing | [04 · Handling asynchrony](pages/04-async-testing/01-handling-asynchrony.md) |
| 05 | Snapshot testing | [05 · Snapshot mechanics](pages/05-snapshot-testing/01-snapshot-mechanics.md) |
| 06 | Coverage and configuration | [06 · Jest config](pages/06-coverage-and-configuration/01-jest-config.md) |
| 07 | RTL core philosophy | [07 · Guiding principle](pages/07-rtl-core-philosophy/01-guiding-principle.md) |
| 08 | RTL queries | [08 · Query variants and priority](pages/08-rtl-queries/01-query-variants-and-priority.md) |
| 09 | User interaction | [09 · Simulating input](pages/09-user-interaction/01-simulating-input.md) |
| 10 | Async utilities | [10 · Waiting for updates](pages/10-async-utilities/01-waiting-for-updates.md) |
| 11 | Custom render | [11 · Provider wrapping](pages/11-custom-render/01-provider-wrapping.md) |
| 12 | Mocking network requests | [12 · API level mocking](pages/12-mocking-network-requests/01-api-level-mocking.md) |
| 13 | Testing hooks | [13 · Render hook](pages/13-testing-hooks/01-render-hook.md) |
| 14 | Accessibility testing | [14 · A11y assertions](pages/14-accessibility-testing/01-a11y-assertions.md) |
| 15 | Debugging tests | [15 · Diagnostic tools](pages/15-debugging-tests/01-diagnostic-tools.md) |
| 16 | Real world workflows and recipes | [16 · Testing setup from zero](pages/16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md) |

import Progress from '@site/src/components/Progress';

<Progress lang="jest-rtl" compact />
