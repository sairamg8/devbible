---
title: "setupFiles run inside every test worker before every test file, and globalSetup runs once in a different process before any worker exists — mixing them up puts state where the tests can't reach it"
sidebar_label: "01e · setupFiles vs globalSetup"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vitest documentation — [`setupFiles`](https://vitest.dev/config/setupfiles), [`globalSetup`](https://vitest.dev/config/globalsetup). Documentation-validated; **no sandbox run**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Two config options with similar names, running in different processes

**`setupFiles` and `globalSetup` sound like a naming inconsistency for the same idea, and they are two genuinely different mechanisms with different lifetimes, different processes, and — critically — no shared memory between them and the tests.** Reaching for the wrong one produces two distinct classes of bug: a `setupFiles` global that mysteriously "doesn't exist" in a test, and a `globalSetup` value a test tries to read directly and gets `undefined` for, even though the setup function clearly ran.

## `setupFiles` — runs in the test process, once per test file

> *"Paths to setup files resolved relative to the [`root`](https://vitest.dev/config/root)."* — [`setupFiles`](https://vitest.dev/config/setupfiles)

> *"They will run before each _test file_ in the same process."*

> *"Note that setup files are executed in the same process as tests, unlike [`globalSetup`](https://vitest.dev/config/globalsetup) that runs once in the main thread before any test worker is created."*

`setupFiles` is where per-test-file bootstrapping belongs — anything the test process itself needs to see: DOM polyfills, `expect` matcher extensions, a mock server that must be reachable from inside the test's own module scope.

```typescript
// src/test-setup.ts — runs before EVERY test file, in the SAME process as that file
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// vite.config.ts
export default defineConfig({
  test: { setupFiles: ['./src/test-setup.ts'] },
});
```

Because it runs in the same process as the tests, anything it assigns to `globalThis`, or any module-level mutable state it sets up, is directly visible to every test in that file — that is the entire point of `beforeAll`/`afterEach` hooks living there rather than duplicated at the top of every test file. It is also why the docs flag: *"Editing a setup file will automatically trigger a rerun of all tests"* — Vitest treats it as a dependency of every test file, correctly, since a change to it can change every test's behavior.

## `globalSetup` — runs once, before any worker, in a separate scope

> Setup executes *"before the test workers are created and only if there is at least one test queued"*; teardown runs *"after all test files have finished running."* — [`globalSetup`](https://vitest.dev/config/globalsetup)

> It runs *"in a different global scope before test workers are even created"*.

```typescript
// global-setup.ts — runs ONCE, before Vitest spins up any test worker
import { setup as setupTestDatabase, teardown as teardownTestDatabase } from './test-db';

export async function setup() {
  await setupTestDatabase();
}

export async function teardown() {
  await teardownTestDatabase();
}
```

```typescript
// vite.config.ts
export default defineConfig({
  test: { globalSetup: ['./global-setup.ts'] },
});
```

> *"a global setup file can either export named functions `setup` and `teardown` or a `default` function that returns a teardown function"* — both forms are valid; the named-export form above and a single default function returning its own teardown are interchangeable styles.

Multiple global setup files are supported and *"are executed sequentially"* — order in the array is the run order.

## The one restriction that breaks the most setups: no shared globals

> *"Your tests don't have access to global variables defined here"* — a value assigned to a module-level variable, or even `globalThis`, inside `globalSetup` is invisible to every test file, because they run in an entirely different process/scope.

The documented workaround is `provide`/`inject`, passing **serializable data only** across that process boundary:

```typescript
// global-setup.ts
export async function setup({ provide }: { provide: (key: string, value: unknown) => void }) {
  const container = await startTestDatabaseContainer();
  provide('dbUrl', container.connectionString); // string — serializable, crosses the boundary
}
```

```typescript
// a-test-file.test.ts
import { inject, test, expect } from 'vitest';

test('connects to the seeded test database', () => {
  const dbUrl = inject('dbUrl'); // reads what globalSetup provided, by key
  expect(dbUrl).toContain('postgres://');
});
```

A live database connection object, a class instance, a function — none of these survive `provide`/`inject`, because the value is serialized to cross the process boundary. Only the connection string, port number, or other plain data can travel; each test file that needs an actual connection opens its own from that string, typically inside `setupFiles`.

## Choosing between them

| | `setupFiles` | `globalSetup` |
|---|---|---|
| Runs | before **every** test file | **once**, before any worker exists |
| Process | same as the tests | separate, before workers are created |
| Visibility to tests | direct — same `globalThis`, same module state | none — only via `provide`/`inject`, serializable data only |
| Typical use | matcher extensions, mock server lifecycle, DOM polyfills | spinning up a real database/container once for the whole run |

The rule of thumb: if a resource is cheap enough to set up per test file and needs to be directly usable as an object inside the test process, it belongs in `setupFiles`. If it is expensive enough that doing it once for the whole run matters (a real database container, a test server binding a real port), it belongs in `globalSetup`, with only the connection details handed across via `provide`/`inject`.

## Gotchas

**★ Symptom: a value set on `globalThis` inside `globalSetup` reads as `undefined` in every test, even though a log statement inside `globalSetup` confirms it ran and set the value.** Cause: `globalSetup` runs *"in a different global scope before test workers are even created"* — its `globalThis` is not the same object every test process sees. Fix: pass the value through `provide`, and read it with `inject` in the test file, keeping only serializable data on that path.
```typescript
// global-setup.ts
export async function setup({ provide }) { provide('apiPort', 4321); }
// test file
import { inject } from 'vitest';
const port = inject('apiPort');
```

**★ Symptom: `provide('client', dbClient)` compiles, and the test that calls `inject('client')` gets back something that is not the client object — methods are missing, or it throws when called.** Cause: `provide`/`inject` serializes the value to cross the process boundary between `globalSetup` and the test workers; a class instance or a function does not survive serialization intact. Fix: provide only the connection string or config, and construct the real client inside `setupFiles` (same process as the tests) using that string.

**★ Symptom: a mock server (MSW, `nock`) set up in `globalSetup` never intercepts any request made by the tests.** Cause: `globalSetup` runs in a process that is not the one making the HTTP requests — the tests run in separate workers. An interceptor installed there has nothing to intercept. Fix: move the mock server's `listen()`/`close()` lifecycle into `setupFiles`, which runs in the same process as the code under test.

**★ Symptom: a large, expensive fixture (a real Postgres container, a compiled WASM module) is being re-created inside `setupFiles`, and the test suite is slow to start.** Cause: `setupFiles` runs *"before each test file"* — anything expensive placed there is redone once per test file, not once for the whole run. Fix: move the expensive, one-time part into `globalSetup`, and pass only the resulting connection details to each test file via `provide`/`inject`.

**★ Symptom: editing an unrelated helper module used by `setupFiles` triggers every single test in the project to re-run in watch mode, not just the files that actually import that helper.** Cause: the documentation states plainly that *"Editing a setup file will automatically trigger a rerun of all tests"* — Vitest treats the setup file itself, and by extension anything it imports, as a dependency of every test file. Fix: this is expected behavior, not a bug; if it becomes a real cost, the fix is reducing what the setup file imports, not fighting the invalidation logic.

## Interview questions

**★ A team writes `globalSetup` code that assigns `globalThis.testDbUrl = url`, expecting tests to read `globalThis.testDbUrl`. It doesn't work. Why not, precisely?**
Because `globalSetup` runs in a different scope before any test worker is created — the documentation is explicit that this is "a different global scope," not merely a different point in time within the same process. Assigning to `globalThis` inside `globalSetup` mutates an object that no test worker shares; each worker has its own `globalThis`. The only sanctioned channel across that boundary is `provide`/`inject`, and only for serializable data, which is a deliberate constraint, not a missing feature — it forces the boundary to stay data-only rather than becoming a place shared mutable objects leak across process lines.

**★ Why does `setupFiles` re-run before every single test file, when `globalSetup` runs exactly once for the whole suite?**
Because they solve different problems. `setupFiles` exists to guarantee every test file starts from the same known state inside its own process — matcher extensions, a fresh mock server handler set, DOM polyfills — and re-running it per file is what makes tests independent of each other and of run order. `globalSetup` exists for state that is expensive to create and safe to share read-only across the whole run — a database container, a built asset — where re-creating it per test file would be wasteful and where the whole point is that it does NOT need to be file-scoped.

**★ Why can't `globalSetup` just export the live resource (a database client, an HTTP server instance) directly instead of routing everything through `provide`/`inject`?**
Because `globalSetup` executes in a separate process/scope from every test worker — there is no shared memory to export an object reference into. `provide`/`inject` works by serializing the value and passing it across that process boundary, which only works for plain, serializable data (strings, numbers, plain objects) — a live client, a function, or a class instance cannot survive that serialization intact. The correct pattern is provide the connection string once, and construct the actual client inside `setupFiles`, which does run in the same process as the tests that need it.

**★ When does the extra process-boundary cost of `globalSetup` pay for itself over just doing the same setup inside `setupFiles`?**
When the setup work is expensive enough that paying its cost once for the whole test run is meaningfully cheaper than paying it once per test file — starting a real database container, compiling a large fixture, seeding data that many test files will read but none will mutate destructively. For anything cheap — instantiating a mock, extending `expect`, resetting handlers — the per-file cost of `setupFiles` is negligible and the direct, same-process access to the result is worth more than the one-time saving `globalSetup` would offer.

---

← [01d · Mocking under a shared pipeline](01d-mocking.md) · [Vite overview](../../README.md) · Next → [01f · Coverage providers](01f-coverage.md)
