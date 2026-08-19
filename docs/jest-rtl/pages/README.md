---
title: "Jest & RTL — Explanations"
sidebar_label: "Explanations"
sidebar_position: 0
---

> Verified: 2026-08-19 against Jest 29.7 / 30.x, React 18/19, Testing Library 16.x, and MSW 2.x documentation.

The core concept chapters for **Jest & React Testing Library**, written to the full Devbible contract with Under-the-hood mechanics, Production code, Gotchas (symptom → cause → fix), and Interview questions.

---

## Explanation Chapters

| # | Section | Topic | Tier |
|---|---|---|---|
| 01 | [01 · Jest Core Concepts](01-jest-core-concepts/01-test-structure.md) | Test Structure, Execution Tree & Parameterization | <span className="db-tier t-master">Master</span> |
| 02 | [02 · Assertions & Matchers](02-assertions-and-matchers/01-the-expect-api.md) | Expect API, Deep Equality & Custom Matchers | <span className="db-tier t-master">Master</span> |
| 03 | [03 · Mocking](03-mocking/01-jest-mock-functions.md) | Spies, Mock Lifecycles, Hoisting & Fake Timers | <span className="db-tier t-master">Master</span> |
| 04 | [04 · Async Testing](04-async-testing/01-handling-asynchrony.md) | Promises, async/await & Microtask Queues | <span className="db-tier t-master">Master</span> |
| 05 | [05 · Snapshot Testing](05-snapshot-testing/01-snapshot-mechanics.md) | Serializers, Property Matchers & Snapshot Diffs | <span className="db-tier t-know">Know</span> |
| 06 | [06 · Coverage & Configuration](06-coverage-and-configuration/01-jest-config.md) | jest.config.ts, SWC Transforms & Setup Files | <span className="db-tier t-understand">Understand</span> |
| 07 | [07 · RTL Core Philosophy](07-rtl-core-philosophy/01-guiding-principle.md) | Testing Behavior, Refactoring Resilience & screen | <span className="db-tier t-master">Master</span> |
| 08 | [08 · RTL Queries](08-rtl-queries/01-query-variants-and-priority.md) | getBy, queryBy, findBy & A11y Priority Hierarchy | <span className="db-tier t-master">Master</span> |
| 09 | [09 · User Interaction](09-user-interaction/01-simulating-input.md) | user-event v14 vs fireEvent & Event Cascades | <span className="db-tier t-master">Master</span> |
| 10 | [10 · Async Utilities](10-async-utilities/01-waiting-for-updates.md) | waitFor, Element Removal & act Warnings | <span className="db-tier t-master">Master</span> |
| 11 | [11 · Custom Render](11-custom-render/01-provider-wrapping.md) | Provider Wrappers, Redux, TanStack Query & Isolation | <span className="db-tier t-master">Master</span> |
| 12 | [12 · Mocking Network Requests](12-mocking-network-requests/01-api-level-mocking.md) | MSW v2, Request Handlers & Transport Layer Mocks | <span className="db-tier t-master">Master</span> |
| 13 | [13 · Testing Hooks](13-testing-hooks/01-render-hook.md) | renderHook, result.current, rerender & Cleanups | <span className="db-tier t-understand">Understand</span> |
| 14 | [14 · Accessibility Testing](14-accessibility-testing/01-a11y-assertions.md) | jest-axe, WCAG Audits & Accessible Names | <span className="db-tier t-understand">Understand</span> |
| 15 | [15 · Debugging Tests](15-debugging-tests/01-diagnostic-tools.md) | screen.debug, logRoles & Testing Playground | <span className="db-tier t-know">Know</span> |
| 16 | [16 · Real World Workflows](16-real-world-workflows-and-recipes/01-testing-setup-from-zero.md) | Bootstrap from Zero: Jest, SWC, RTL, MSW & Vite | <span className="db-tier t-master">Master</span> |
