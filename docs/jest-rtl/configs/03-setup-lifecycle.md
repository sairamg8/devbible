---
title: "The setup lifecycle"
sidebar_label: "03 · The setup lifecycle"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the [Jest configuration reference](https://jestjs.io/docs/configuration)
> (`globalSetup`, `setupFiles`, `setupFilesAfterEnv`, `globalTeardown`), the
> [Vitest config reference](https://vitest.dev/config/) (`globalSetup`, `setupFiles`,
> `provide`) and the [Testing Library setup docs](https://testing-library.com/docs/react-testing-library/setup).
> **No sandbox, no console blocks.**

**Putting a line in the wrong setup file does not error. It does nothing.** That is what
makes this the highest-value chunk in the section: the failure mode is silence, and the
eventual symptom — a missing matcher, an unpolyfilled API, a mock server that never
intercepts — points nowhere near the cause.

---

## The order, in full

```
  ┌── ONCE, per run, in its own process ─────────────────────────┐
  │  globalSetup            start a container, seed a database   │
  └──────────────────────────────────────────────────────────────┘
                              │
  ┌── PER TEST FILE, in a worker ────────────────────────────────┐
  │  1. the test environment is constructed  (jsdom / node)      │
  │  2. setupFiles              ← no describe/test/expect yet    │
  │  3. the test framework is installed  (describe, test, expect)│
  │  4. setupFilesAfterEnv      ← matchers, hooks, MSW lifecycle │
  │  5. your test file is imported and run                       │
  └──────────────────────────────────────────────────────────────┘
                              │
  ┌── ONCE, after everything ────────────────────────────────────┐
  │  globalTeardown                                              │
  └──────────────────────────────────────────────────────────────┘
```

🔴 **Step 3 is the whole point.** Between `setupFiles` and `setupFilesAfterEnv`, Jest
installs the test framework. Anything needing `expect`, `beforeEach` or `afterEach` must
be in `setupFilesAfterEnv` — in `setupFiles` those globals **do not exist yet**.

---

## What belongs where

| Stage | Put here | Because |
|---|---|---|
| `globalSetup` | Start a database container, generate a shared fixture, set `process.env` for the run | Once per run. A separate process — nothing it defines is importable by tests |
| `setupFiles` | Environment polyfills that must exist before **any** module is imported: `TextEncoder`, `crypto`, `fetch` on old runtimes, `process.env` defaults | Runs before the framework, and crucially before your modules are evaluated |
| `setupFilesAfterEnv` | `@testing-library/jest-dom`, MSW's `beforeAll`/`afterEach`/`afterAll`, RTL `configure()`, global `beforeEach` mock resets, `window` polyfills | Framework globals exist. This is where nearly everything goes |
| `globalTeardown` | Stop the container, clean the fixture | Once, at the end |

### 🔴 The failure that sends people in circles

```js
// setupFiles: ['<rootDir>/src/setupEnv.ts']
import '@testing-library/jest-dom';

beforeEach(() => {          // ❌ ReferenceError: beforeEach is not defined
  jest.clearAllMocks();
});
```

`beforeEach` does not exist yet. And even when the file avoids hooks, importing jest-dom
here can leave the matchers unregistered — `expect` has not been installed for them to
attach to. **The symptom is `toBeInTheDocument is not a function`, in a project that
plainly imports jest-dom.**

**The rule: if it mentions `expect`, `beforeEach`, `afterEach` or `jest.fn`, it belongs in
`setupFilesAfterEnv`.** In practice most projects need only that one file.

---

## A `setupTests.ts` that is in the right order

```ts
// src/setupTests.ts   ← referenced by setupFilesAfterEnv (Jest) / test.setupFiles (Vitest)
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { server } from './mocks/server';

configure({ asyncUtilTimeout: 2000 });

// 1. network mocking, outermost
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 2. jsdom gaps — see chunk 04 for the full checklist
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    addListener: jest.fn(), removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});
```

⚠️ **`onUnhandledRequest: 'error'` is the setting worth arguing for.** The default warns,
so a request you forgot to mock reaches the real network — slow, flaky, and occasionally
a test suite that writes to a real service.

---

## Vitest's equivalents

| Jest | Vitest | Difference |
|---|---|---|
| `globalSetup` | `test.globalSetup` | Vitest's can **export a teardown function** instead of needing a separate file, and can `provide()` values that tests read with `inject()` |
| `setupFiles` | — | 🔴 **no separate pre-framework stage** |
| `setupFilesAfterEnv` | `test.setupFiles` | The single setup hook |
| `globalTeardown` | the return value of `globalSetup` | |

```ts
export default defineConfig({
  test: {
    setupFiles: ['./src/setupTests.ts'],       // ≈ setupFilesAfterEnv
    globalSetup: ['./src/globalSetup.ts'],     // once per run
  },
});
```

🔴 **`test.setupFiles` is the analogue of `setupFilesAfterEnv`, not of `setupFiles`.** The
name collides with the Jest option that means the *other* stage, and that is a real
migration hazard: a Jest project with both files migrates by **concatenating** them into
`test.setupFiles`, not by mapping each to its like-named option.

⚠️ **Vitest's setup files run per test file too**, and `test.globals` decides whether
`expect`/`describe` are global or must be imported from `vitest`. With
`globals: false`, a setup file must import what it uses — including `beforeAll`.

---

## Debugging "my setup did not run"

1. **Is the path right?** Use `<rootDir>/…` in Jest — [chunk 01](./01-where-config-lives.md).
2. **Is it in the right stage?** Add `console.log('setup ran')`; if it prints but the
   effect is missing, it is a stage problem, not a path problem.
3. **`projects`?** Top-level `setupFilesAfterEnv` is ignored — it must be inside each
   project ([02 · chunk 06](./02-jest-config-reference/06-workers-and-projects.md)).
4. **Vitest with `globals: false`?** The setup file needs explicit imports.
5. **`npx jest --showConfig`** prints the resolved arrays, settling 1 and 3.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `beforeEach is not defined` in a setup file | It is in `setupFiles`, before the framework exists | Move to `setupFilesAfterEnv` |
| `toBeInTheDocument is not a function` despite importing jest-dom | Imported in `setupFiles`; no `expect` to attach to | Move the import |
| Matchers work in one project only | Top-level `setupFilesAfterEnv` ignored under `projects` | Repeat it inside each project |
| `TextEncoder is not defined` at import time | Polyfilled in `setupFilesAfterEnv`, after modules were evaluated | Move to `setupFiles` — a genuine use for it |
| MSW intercepts nothing | `server.listen()` never ran, or the file is not wired | Confirm with a log line, then check the path |
| Tests hit the real network | `onUnhandledRequest` defaults to a warning | Set it to `'error'` |
| A `globalSetup` variable is undefined in tests | It ran in a separate process | Env vars, or Vitest's `provide`/`inject` |
| Vitest setup runs but hooks are undefined | `globals: false` and nothing imported | `import { beforeAll } from 'vitest'` |
| Migration to Vitest loses the polyfills | Jest's `setupFiles` mapped to the same-named Vitest option | Concatenate both Jest files into `test.setupFiles` |
| Handlers leak between tests | No `resetHandlers()` in `afterEach` | Add it |

---

## Interview questions

**Q. What is the difference between `setupFiles` and `setupFilesAfterEnv`?**
`setupFiles` runs after the environment is built but **before** the test framework is
installed, so `describe`, `test`, `expect` and the hooks do not exist. `setupFilesAfterEnv`
runs after installation, which is why matchers and lifecycle hooks belong there.

**Q. jest-dom is imported and `toBeInTheDocument` is still not a function. Why?**
The import is in `setupFiles`. jest-dom extends `expect`, which does not yet exist, so
nothing is registered.

**Q. Is there anything that genuinely belongs in `setupFiles`?**
Yes — polyfills that must exist before any module is evaluated, such as `TextEncoder` or
`crypto`, when a module reads them at import scope.

**Q. Where does `globalSetup` run, and what follows from that?**
Once per run, in its own process. Nothing it defines is importable by tests; communication
is via environment variables, the outside world, or Vitest's `provide`/`inject`.

**Q. Give the full ordering.**
`globalSetup` → per file: environment constructed → `setupFiles` → framework installed →
`setupFilesAfterEnv` → the test file → `globalTeardown` at the end.

**Q. What is the trap when mapping Jest's setup options to Vitest?**
Vitest's `test.setupFiles` corresponds to Jest's `setupFilesAfterEnv`, despite the name
matching the other option. Vitest has no separate pre-framework stage, so both Jest files
concatenate into the one option.

**Q. Why `onUnhandledRequest: 'error'`?**
The default only warns, so an unmocked request reaches the network — slow, flaky, and
capable of touching a real service from a test run.

**Q. Setup file logs but its effect is missing. What does that tell you?**
The path and wiring are correct, so it is a stage problem — the code ran too early for
what it was trying to touch.

**Q. Under `projects`, matchers work in one project and not another. Why?**
`setupFilesAfterEnv` beside `projects` is ignored. Each project carries its own.

**Q. With Vitest `globals: false`, what changes in the setup file?**
Nothing is injected — `beforeAll`, `afterEach` and `expect` must be imported from
`vitest` explicitly.

---

← **Prev:** [02 · jest.config reference](./02-jest-config-reference/README.md) ·
**Next:** 04 · RTL configuration *(not written yet)*
