---
title: "Testing Setup from Zero: Jest, SWC, RTL, MSW v2 & Vite Migration"
sidebar_label: "Setup from Zero"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against Jest 29.7 / 30.x, React 18/19, Testing Library React 16.x, and MSW 2.x documentation.

Bootstrapping a production testing environment from zero requires incremental layer configuration — Jest runner, SWC fast transpilation, jsdom environment, React Testing Library, `jest-dom` matchers, and Mock Service Worker (MSW v2) — verifying each layer independently before adding the next.

---

## 1. Under-The-Hood Mechanics

Setting up a complete testing pipeline in dependency order prevents compounding configuration errors:

```
Layer 1: Jest CLI & SWC Transpiler  ──► Verifies plain TypeScript/JavaScript execution in Node.
                                        │
                                        ▼
Layer 2: jsdom Environment & RTL    ──► Verifies synthetic DOM window mounting and React JSX rendering.
                                        │
                                        ▼
Layer 3: @testing-library/jest-dom  ──► Upgrades assertions to accessible DOM matchers (`toBeInTheDocument`).
                                        │
                                        ▼
Layer 4: Mock Service Worker v2     ──► Intercepts network socket streams at transport layer.
```

---

## 2. Step-by-Step Production Setup Recipe

### Step 1: Install Core Dependencies
```bash
yarn add -D jest @types/jest @swc/core @swc/jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event msw
```

### Step 2: Configure `jest.config.ts`
```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          transform: {
            react: { runtime: 'automatic' },
          },
        },
      },
    ],
  },
};

export default config;
```

### Step 3: Global Test Setup (`src/setupTests.ts`)
```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';
import { server } from './test/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

// Polyfill missing jsdom window APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

---

## 3. Side-by-Side: Jest vs Vite/Vitest Equivalent

If your application uses Vite, the equivalent `vitest.config.ts` setup shares the same `setupTests.ts` and test code:

```typescript
// vitest.config.ts (Vite Alternative)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: false,
  },
});
```

---

## 4. Gotchas & Senior Pitfalls

### Symptom: `TypeError: expect(...).toBeInTheDocument is not a function`
- **Cause**: `@testing-library/jest-dom` was not imported in `setupFilesAfterEnv` or inside the test file.
- **Fix**: Add `import '@testing-library/jest-dom'` to your `src/setupTests.ts` file.

### Symptom: Unhandled requests succeed or fail silently with timeout
- **Cause**: MSW server started without `{ onUnhandledRequest: 'error' }`.
- **Fix**: Always pass `{ onUnhandledRequest: 'error' }` to `server.listen()` in `setupTests.ts` to catch typos in endpoint URLs immediately.

### Symptom: `SyntaxError: Cannot use import statement outside a module` on ESM dependencies
- **Cause**: Jest runs in CommonJS by default and does not transpile `node_modules` ESM packages.
- **Fix**: Add `transformIgnorePatterns: ['node_modules/(?!(nanoid|axios)/)']` in `jest.config.ts`.

---

## 5. Interview Questions & Deep Dives

### ★ 1. What is the execution sequence when Jest boots up and executes a test file?
**Answer**:
1. Jest CLI parses CLI arguments and loads `jest.config.ts`.
2. A worker process spawns with the configured `testEnvironment` (`jsdom` creates global `window` and `document`).
3. `setupFiles` run before the test framework is installed.
4. Jest registers global APIs (`describe`, `test`, `expect`) and runs `setupFilesAfterEnv` (`setupTests.ts`).
5. Transpiler (`@swc/jest`) compiles the test file.
6. The test file executes synchronously to construct the test tree, then executes hooks and test bodies.

### ★ 2. How do you migrate a test suite from Jest to Vitest?
**Answer**:
1. Replace `jest` with `vitest` in `package.json`.
2. Configure `vitest.config.ts` with `test.globals: true` and `test.environment: 'jsdom'`.
3. Reuse existing `@testing-library/react` tests without changes.
4. Replace `jest.fn()` with `vi.fn()`, `jest.spyOn()` with `vi.spyOn()`, and `jest.mock()` with `vi.mock()`.
5. Point `test.setupFiles` to the existing `setupTests.ts` file.

### 3. Why should you avoid global mutable state in `setupTests.ts`?
**Answer**: `setupTests.ts` executes in every test worker before each test file. Setting global mutable variables or mock implementations there can cause test pollution and race conditions across suites. Global setup files should only register matchers, initialize MSW listeners, and attach browser polyfills.

### 4. What is the difference between `setupFiles` and `setupFilesAfterEnv`?
**Answer**: `setupFiles` executes before Jest is bound to the global context (used for Node runtime polyfills). `setupFilesAfterEnv` executes after Jest globals (`expect`, `beforeAll`, `afterEach`) are available (used for `@testing-library/jest-dom` and MSW hooks).

---

## Where this connects

- **Part 1 (Jest Core)**: [01 · Jest Core Concepts](../01-jest-core-concepts/01-test-structure.md) — Understanding test trees and lifecycle hooks.
- **Part 2 (RTL)**: [08 · RTL Queries](../08-rtl-queries/01-query-variants-and-priority.md) — Query priority order.
- **Part 3 (MSW)**: [12 · Mocking Network Requests](../12-mocking-network-requests/01-api-level-mocking.md) — Network boundary interception.
