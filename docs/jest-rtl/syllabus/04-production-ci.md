---
title: "Part 4 — Production Setup, CI & Vitest Bridge"
sidebar_label: "4 · Production Setup & CI"
sidebar_position: 4
---

> Phases 11–12 · Setup files, global polyfills, Vite/Vitest integration, SWC, ESM, and CI sharding

A test suite that takes 10 minutes to run, lacks necessary browser polyfills, or fails randomly on CI quickly gets disabled or ignored. Engineering high-performance test runners and robust setup configurations ensures sustainable testing.

---

## Phase 11 — Configuration Architecture, `setupTests` & Polyfills

Wiring up setup files, polyfilling missing browser APIs, and contrasting Jest with Vite/Vitest.

| Topic | Tier |
|---|---|
| **Step-by-step setup from zero** — incremental setup order (Jest → jsdom → React/RTL → jest-dom → MSW) with independent sanity verification at each layer | <span className="db-tier t-master">Master</span> |
| **`setupFiles` vs `setupFilesAfterEnv` in Jest** — environment-level hooks (Node polyfills, env vars) vs test-framework hooks (`src/setupTests.ts` for jest-dom matchers, MSW server lifecycle, global mock resets) | <span className="db-tier t-master">Master</span> |
| **Vite & Vitest configuration architecture** — configuring `vitest.config.ts` (`test.environment: 'jsdom'`, `test.setupFiles: ['./src/setupTests.ts']`, `test.globals: true`); sharing alias paths with `vite.config.ts` | <span className="db-tier t-master">Master</span> |
| **The global polyfill checklist in `setupTests.ts`** — polyfilling `window.matchMedia`, `ResizeObserver`, `IntersectionObserver`, `window.scrollTo`, `TextEncoder`, and `HTMLCanvasElement.prototype.getContext` | <span className="db-tier t-master">Master</span> |
| **Fast transpilers: `@swc/jest` vs `ts-jest` vs `babel-jest`** — benchmarking compilation overhead in large suites; why SWC cuts transpilation time by 3–5x over Babel | <span className="db-tier t-understand">Understand</span> |
| **The ESM & `transformIgnorePatterns` resolution** — fixing `SyntaxError: Cannot use import statement outside a module` caused by pure ESM packages in `node_modules` (e.g. `nanoid`, `axios`, `d3`) | <span className="db-tier t-understand">Understand</span> |
| Module name mappers & asset mocking — mapping TypeScript path aliases (`@/*` → `<rootDir>/src/*`), mocking CSS modules with `identity-obj-proxy`, and stubbing image/SVG imports | <span className="db-tier t-understand">Understand</span> |
| Coverage thresholds & reporting — configuring `collectCoverageFrom`, setting strict line/branch/statement/function failure thresholds, and generating lcov/HTML reports | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can write a `setupTests.ts` that includes all standard browser polyfills and MSW lifecycles, and configure it identically in both a Jest and a Vite/Vitest project without runtime errors.

---

## Phase 12 — CI Performance, Flakiness & Vitest Bridge

Scaling test suites in continuous integration and translating skills across runners.

| Topic | Tier |
|---|---|
| **CI tuning & worker orchestration** — `--maxWorkers=50%` vs `--runInBand` in Docker/GitHub Actions containers; avoiding out-of-memory (OOM) worker crashes | <span className="db-tier t-understand">Understand</span> |
| **Test sharding and parallelization** — splitting large test suites across parallel CI jobs using Jest's `--shard=1/4` flag to reduce pipeline duration | <span className="db-tier t-understand">Understand</span> |
| **Root causes of test flakiness & memory leaks** — unawaited asynchronous operations, real timer dependencies, detached DOM nodes in jsdom, and non-deterministic mock state | <span className="db-tier t-understand">Understand</span> |
| **The Vitest migration bridge** — mapping `jest.fn()` to `vi.fn()`, `jest.spyOn()` to `vi.spyOn()`, `jest.mock()` to `vi.mock()`, and porting RTL suites seamlessly to Vite projects | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can diagnose and fix a memory leak or flaky failure in a 500-test suite running in a restricted CI Docker container, and explain how to port that suite to Vitest.

---

## Where this connects

- **Frontend Architecture (`docs/frontend-architecture/pages/13-testing-strategy/`)**: How unit, component, and E2E tests combine into a scalable testing pyramid.
- **Playwright Track (`docs/playwright/`)**: Escalating from jsdom component tests to full real-browser end-to-end testing.
