---
title: "Vitest and Jest — when they earn their place"
sidebar_label: "12 · Vitest and Jest"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `vitest` 4.1.10, `jest` 30.4.2, same 50-test
> suite, wall-clock timings over three runs each.

**For a plain Node backend, the built-in runner is the default and the other two need a
reason.** The reason exists more often than purists admit — it is just rarely "better
testing".

## The measurement

Identical suite: 50 tests over one pure function.

| Runner | Wall clock (3 runs) | ESM config needed |
|---|---|---|
| **`node:test`** 24.19.0 | 0.22 · 0.24 · 0.23 s | none |
| **Vitest** 4.1.10 | 1.43 · 1.51 · 1.44 s | none |
| **Jest** 30.4.2 | 1.52 · 1.59 · 1.53 s | config **+** `NODE_OPTIONS=--experimental-vm-modules` |

Roughly **6×**, and it is startup, not per-test cost — it is paid on every watch-mode
re-run, which is where it is felt.

Note also what Jest reports about itself:

```console
Tests:       50 passed, 50 total
Time:        0.32 s
```

0.32 s of *its* time inside 1.5 s of yours. Both numbers are true; only one is the one
you wait for.

## Jest and ESM

With `"type": "module"` and no configuration:

```console
import { sum } from '../sum.mjs';
^^^^^^
SyntaxError: Cannot use import statement outside a module
```

Working configuration, measured:

```js
// jest.config.mjs
export default {
  testEnvironment: 'node',
  transform: {},                     // no babel — required for native ESM
  moduleFileExtensions: ['js', 'mjs', 'json'],
};
```

```json
{"scripts": {"test": "NODE_OPTIONS=--experimental-vm-modules jest"}}
```

```console
(node:69281) ExperimentalWarning: VM Modules is an experimental feature
Tests: 50 passed, 50 total
```

It works, and it is still an experimental Node flag in 2026. **For a new ESM Node
project, Jest is the hardest of the three to justify.**

## When each earns its place

### Stay on `node:test`

A backend service: HTTP handlers, repositories, jobs, pure logic. You get describe/it,
hooks, mocks, mock timers, coverage, snapshots, watch, sharding and a JUnit reporter
with **zero** dependencies and no transform step. Nothing in that list is worse than the
alternatives for this kind of code.

### Choose Vitest when

- **A frontend already uses it.** One runner, one config, one mental model across the
  repo is worth more than 1.2 seconds of startup.
- **You need a DOM.** `environment: 'jsdom'` or `happy-dom`, plus
  `@testing-library`. `node:test` has no answer here and should not grow one.
- **You want the ecosystem.** `expect` matchers, `vi.mock` without an experimental
  flag, an interactive UI, `--related` for changed files, first-class TypeScript with no
  separate build.
- **TypeScript without ceremony.** Vitest transforms TS directly. Node 24 can strip
  types, but the tooling around it is thinner.

### Choose Jest when

- **It is already there** and the suite is large. Migrating thousands of tests for
  1.3 seconds of startup is not a good trade.
- **You depend on its ecosystem** — a preset, `jest-image-snapshot`, an established
  transform pipeline.

For a new project in 2026, Jest is chosen when the team already knows it, which is a
real reason, just not a technical one.

## The API differences that actually matter

```js
// node:test                          // vitest / jest
import {test, mock} from 'node:test'; import {test, vi, expect} from 'vitest';
import assert from 'node:assert/strict';

assert.equal(a, b);                   expect(a).toBe(b);
assert.deepStrictEqual(a, b);         expect(a).toEqual(b);
await assert.rejects(fn, /boom/);     await expect(fn()).rejects.toThrow(/boom/);
const f = t.mock.fn();                const f = vi.fn();
t.mock.method(obj, 'm');              vi.spyOn(obj, 'm');
t.mock.timers.enable({apis:['Date']}) vi.useFakeTimers();
t.assert.snapshot(x);                 expect(x).toMatchSnapshot();
```

Two real differences, not just spelling:

- **`expect(a).toEqual(b)` ignores `undefined` properties**; `deepStrictEqual` does
  not, and compares prototypes as well ([page 02](./02-node-assert.md)). Migrating in
  either direction surfaces genuine mismatches.
- **`vi.mock` is hoisted** above imports by the transform, which is why it does not
  suffer the import-order trap that `mock.module` does
  ([page 08](./08-module-mocking.md)). That hoisting is a real ergonomic advantage,
  bought with a transform step.

## Migration is mostly mechanical

`node:test` ⇄ Vitest is a find-and-replace on assertions plus the mock API, because the
test structure is identical. The parts that are not mechanical: snapshot file format,
`toEqual` versus `deepStrictEqual` semantics, and any reliance on `jest.mock` hoisting.

Do not run two runners in one package. Two configs, two watch modes and two coverage
reports cost more than either choice.

## Gotchas

**Symptom:** `SyntaxError: Cannot use import statement outside a module` under Jest
**Cause:** Native ESM without `--experimental-vm-modules` and `transform: {}`.
**Fix:** Both, together. Or use Vitest.

**Symptom:** The runner reports 0.3 s but the command takes 1.5 s
**Cause:** Self-reported time excludes startup and transform.
**Fix:** Measure wall clock. It is what watch mode costs you on every save.

**Symptom:** Tests pass under Vitest and fail after moving to `node:test`
**Cause:** `toEqual` ignores `undefined` properties and prototypes; `deepStrictEqual`
does not.
**Fix:** Real mismatches — fix the objects, not the assertions.

**Symptom:** `vi.mock` worked; `mock.module` does nothing
**Cause:** Vitest hoists mocks above imports; `node:test` does not.
**Fix:** Dynamic-import the module under test after installing the mock.

**Symptom:** Two runners in one repo, both half-configured
**Cause:** A migration nobody finished.
**Fix:** Finish it. The cost is in maintaining two toolchains, not in the tests.

## Interview questions

**★ When would you not use the built-in runner?**
When you need a DOM environment, when the frontend already standardises on Vitest, or
when a large Jest suite already exists. For a backend service with no browser code,
`node:test` covers everything and starts about six times faster — measured 0.22 s
against 1.4 s on the same suite.

**★ What is the real cost difference?**
Startup, not per-test. `node:test` 0.22 s, Vitest 1.43 s, Jest 1.52 s on 50 tests. It
is paid on every watch-mode re-run, so it shows up as feedback latency rather than CI
time.

**★ Why is Jest awkward with ESM in 2026?**
Native ESM still needs `NODE_OPTIONS=--experimental-vm-modules` plus a config with
`transform: {}`. Without them you get `SyntaxError: Cannot use import statement outside
a module`. For a new ESM project that is hard to justify.

**★ Why does `vi.mock` work where `mock.module` needs care?**
Vitest's transform hoists `vi.mock` above the imports, so the mock is installed before
any module is evaluated. `node:test` has no transform, so you must dynamic-import the
module under test after installing the mock.

**Is `expect(a).toEqual(b)` the same as `deepStrictEqual`?**
No. `toEqual` ignores properties set to `undefined` and does not compare prototypes.
Suites moving between the two find real object-shape differences.

**Would you migrate an existing Jest suite to save a second of startup?**
No. The cost is in the migration risk and the team's familiarity, not the seconds. Move
when there is another reason — dropping the transform pipeline, or unifying with a
frontend already on Vitest.

---

← Prev: [11 · Coverage](./11-coverage.md) ·
Next → [13 · Testcontainers](./13-testcontainers.md)
