---
title: "Part 1 — Jest Core & Test Runner Mechanics"
sidebar_label: "1 · Jest Core & Runner"
sidebar_position: 1
---

> Phases 01–03 · Test tree execution, assertions, matchers, and deterministic mocking

Jest is an all-in-one test runner providing test collection, a CLI, assertion matchers, mock spies, and fake timers. Understanding its execution phases prevents common debugging traps like leaking state across tests or misunderstanding asynchronous registration.

---

## Phase 01 — Test Structure & Execution Lifecycle

How Jest parses test files, builds the execution tree, and cascades lifecycle hooks.

| Topic | Tier |
|---|---|
| **Test registration vs execution** — Jest registers `describe` and `test` blocks synchronously into an AST-like tree before running any test body; why top-level code in `describe` runs during discovery | <span className="db-tier t-master">Master</span> |
| **Hook scoping and cascading** — `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`; nested `describe` hook execution order (outer `beforeEach` runs first, inner `afterEach` runs first) | <span className="db-tier t-understand">Understand</span> |
| **Data-driven parameterization** — `test.each` and `describe.each` with array tables and tagged template literals; individual test reporting vs looping inside a single test | <span className="db-tier t-understand">Understand</span> |
| Test filtering and debugging flags — `test.only`, `test.skip`, `test.todo`, and `test.concurrent`; why committing `.only` breaks CI silently and how ESLint prevents it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can predict the exact execution and console log order of a complex nested `describe` block containing mixed outer/inner hooks and asynchronous tests from memory.

---

## Phase 02 — Assertions, Matchers & Snapshots

Writing expressive, diagnostic assertions and managing snapshot regression testing safely.

| Topic | Tier |
|---|---|
| **The `expect` API & equality semantics** — `toBe` (strict `Object.is` referential equality) vs `toEqual` (deep recursive equality) vs `toStrictEqual` (checking `undefined` keys and prototype matching) | <span className="db-tier t-master">Master</span> |
| Asynchronous assertions & modifiers — `.resolves`, `.rejects`, `.not`, asserting rejected error messages with `toThrow()`, and avoiding unhandled promise rejections in assertions | <span className="db-tier t-understand">Understand</span> |
| Asymmetric matchers — `expect.any()`, `expect.stringContaining()`, `expect.objectContaining()`, and `expect.arrayContaining()` for testing dynamic IDs, timestamps, and partial payloads | <span className="db-tier t-understand">Understand</span> |
| Snapshot testing mechanics — inline snapshots (`toMatchInlineSnapshot`) vs `.snap` artifact files; serialization rules, when snapshots add value, and why large DOM snapshots assert nothing | <span className="db-tier t-know">Know</span> |
| Custom matchers with `expect.extend` — authoring domain-specific matchers with custom pass/fail messages and diagnostic diffs | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you know exactly when `toEqual` passes where `toStrictEqual` fails, and you can write an asymmetric matcher for a payload with dynamic UUIDs and dates without mocking Date.

---

## Phase 03 — Mocking & Deterministic Isolation

Replacing real dependencies at the right boundary without over-mocking or leaking state.

| Topic | Tier |
|---|---|
| **Mock functions (`jest.fn`)** — tracking call count, arguments, return values (`mockReturnValue`, `mockResolvedValue`, `mockImplementation`), and inspecting `.mock.calls` | <span className="db-tier t-master">Master</span> |
| **Method spying (`jest.spyOn`)** — wrapping existing object methods while preserving default implementations, selective overriding, and restoring original methods | <span className="db-tier t-master">Master</span> |
| **Mock lifecycle management** — the critical distinctions between `jest.clearAllMocks()`, `jest.resetAllMocks()`, and `jest.restoreAllMocks()`; configuring `restoreMocks: true` in config | <span className="db-tier t-master">Master</span> |
| Module mocking (`jest.mock`) — auto-mocking vs inline factory functions vs the `__mocks__` directory; hoisting mechanics (`jest.mock` is hoisted to the top of the file) and `jest.requireActual` | <span className="db-tier t-understand">Understand</span> |
| Deterministic fake timers — `jest.useFakeTimers()`, `jest.advanceTimersByTime()`, `jest.runOnlyPendingTimers()`, and modern vs legacy fake timer implementations for debouncing/throttling | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can explain why `jest.mock('./api')` hoists above imports, and how to safely mock a single export from a module while keeping all other original exports intact.

---

## Where this connects

- **Part 2 (RTL Foundations)**: RTL uses Jest's runner, assertion engine, and spy system to execute component tests.
- **Node.js Phase 9 (`docs/nodejs/pages/phase-9-testing/`)**: Jest backend testing shares the exact same mock lifecycle and `expect` vocabulary as Node test suites.
