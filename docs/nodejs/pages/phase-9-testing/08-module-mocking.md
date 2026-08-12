---
title: "Module mocking with mock.module()"
sidebar_label: "08 · Module mocking"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. ⚠ Experimental — gated behind a flag and
> **Stability 1.0 – Early development**. Pin your Node version if you build on it.

**`mock.module()` replaces a module in the loader, so code that imports it gets your
version instead.** It is the escape hatch for a dependency you cannot inject — and the
order of operations matters more than the API does.

## It is behind a flag

```js
mock.module('node:os', {exports: {platform: () => 'mocked-os'}});
```

```console
$ node --test modmock.test.mjs
✖ mock.module (1.8ms)
  TypeError: mock.module is not a function
```

```console
$ node --experimental-test-module-mocks --test modmock.test.mjs
(node:50323) ExperimentalWarning: Module mocking is an experimental feature and might
change at any time
✔ mock.module (6.6ms)
```

Both measured. `mock.module` is not merely inert without the flag — the property does
not exist, and the failure is a `TypeError` rather than anything explanatory.

Put the flag where it cannot be forgotten:

```json
{
  "scripts": {
    "test": "node --experimental-test-module-mocks --test"
  }
}
```

## The import-order trap

This is the part that costs an hour. Both of these look right and only one works.

```js
// ✗ WRONG — the module under test is imported at the top
import {convert} from './convert.mjs';

test('uses the mocked rate', async (t) => {
  t.mock.module('./rates.mjs', {exports: {fetchRate: async () => 1.25}});
  assert.equal(await convert(100, 'EURUSD'), 125);
});
```

```console
✖ CORRECT — dynamic import after the mock is installed (1.0ms)
  Error: real network call to the FX API
      at fetchRate (…/rates.mjs:2:9)
      at convert (…/convert.mjs:3:22)
```

`convert.mjs` was evaluated when the test file's imports were resolved — before any test
ran — and its binding to `fetchRate` was already fixed to the real function. Installing
the mock afterwards changes nothing, and **even a later `await import('./convert.mjs')`
returns the cached module**, so the usual workaround does not save you either.

```js
// ✅ RIGHT — nothing under test is imported statically
import {test} from 'node:test';
import assert from 'node:assert/strict';
// note: no import of ./convert.mjs here

test('uses the mocked rate', async (t) => {
  t.mock.module('./rates.mjs', {exports: {fetchRate: async () => 1.25}});
  const {convert} = await import('./convert.mjs');
  assert.equal(await convert(100, 'EURUSD'), 125);
});
```

```console
✔ mock the dependency, then import the module under test (7.3ms)
```

**The rule: mock first, then dynamic-import the module under test.** Anything on the
path between the test file and the mocked module must be loaded after the mock.

## `exports`, not `namedExports`

```console
DeprecationWarning: mock.module(): options.namedExports is deprecated.
Use options.exports instead.
```

Measured on 24.19.0. Most material written before 2026 uses `namedExports`; it still
works and warns.

```js
t.mock.module('./rates.mjs', {
  exports: {
    fetchRate: async () => 1.25,      // named export
    default: {version: 2},            // default export
  },
});
```

Other options: `cache: true` to keep the mocked module in the loader cache across
imports, and `defaultExport` for a module whose default is not an object.

## When it is the right tool

`mock.module` is for dependencies you genuinely cannot pass in:

- A **third-party module** with a module-scope side effect — an SDK that opens a
  connection on import.
- A **built-in** you cannot inject at the call site: `node:fs`, `node:os`,
  `node:crypto`'s `randomUUID`.
- **Legacy code** you are putting under test before refactoring it, where injection is
  the goal but not yet the state.

For everything else, [dependency injection](./04-testable-code.md) does the same job
with no flag, no import-order rule, no experimental warning, and a dependency visible in
the signature. That is not purism — it is that `mock.module` has three failure modes
(missing flag, wrong import order, deprecated option) and injection has none.

## Scope and restore

`t.mock.module` is undone when the test ends; the top-level `mock.module` is not —
same rule as [page 07](./07-mocking.md). Use `t.mock` and the module registry is clean
for the next test.

Mocks are per-process, and the default isolation gives each **file** its own process, so
a module mock cannot leak between files. Under `--test-isolation=none` it can.

## Stability

`node:test`'s module mocking is **Stability 1.0 — Early development**. The
`namedExports` → `exports` rename already happened within the 24 line. If your suite
depends on it, pin the Node version in CI and in `engines`, and treat a minor upgrade as
something to run the suite against deliberately.

## Gotchas

**Symptom:** `TypeError: mock.module is not a function`
**Cause:** `--experimental-test-module-mocks` is missing.
**Fix:** Add it to the `test` script so it cannot be forgotten.

**Symptom:** The mock has no effect and the real dependency runs
**Cause:** The module under test was imported statically at the top of the test file, so
its bindings were resolved before the mock existed.
**Fix:** Remove the static import; `await import()` it inside the test, after the mock.

**Symptom:** It still has no effect after switching to a dynamic import
**Cause:** The module was already in the loader cache from an earlier static import in
the same file.
**Fix:** No static import of it anywhere in the file, including transitively through a
helper.

**Symptom:** `DeprecationWarning: options.namedExports is deprecated`
**Cause:** The pre-rename option name.
**Fix:** `exports`.

**Symptom:** Mocks leak between tests in one file
**Cause:** The top-level `mock.module` rather than `t.mock.module`.
**Fix:** `t.mock.module`, or `mock.restoreAll()` in `afterEach`.

**Symptom:** The suite breaks after a Node minor upgrade
**Cause:** An early-development API changed.
**Fix:** Pin the version; prefer injection for anything load-bearing.

## Interview questions

**★ What is the single most common reason a module mock does nothing?**
The module under test was imported statically at the top of the test file, so its
import bindings were resolved before the mock was installed. Measured — and a later
`await import()` does not help, because the module is already cached. Mock first, then
dynamic-import.

**★ What does `mock.module` need to work at all?**
`--experimental-test-module-mocks`. Without it the property does not exist and you get
`TypeError: mock.module is not a function` rather than a helpful message.

**★ When would you use module mocking rather than dependency injection?**
When you cannot pass the dependency in: a third-party SDK with import-time side
effects, a Node built-in used deep in a call stack, or legacy code you are stabilising
before refactoring. Injection is otherwise better — no flag, no ordering rule, and the
dependency is visible in the signature.

**★ Is it safe to build a test suite on `mock.module` today?**
It is Stability 1.0, Early development, and `namedExports` was already renamed to
`exports` within the Node 24 line. Usable with a pinned Node version and a small
blast radius; not something to make load-bearing across a large suite.

**Do module mocks leak between test files?**
No, under the default process-per-file isolation — each file has its own loader. Under
`--test-isolation=none` they share a process and can leak.

**What is the difference between `t.mock.module` and `mock.module`?**
Scope. `t.mock.module` is reverted when the test ends; the top-level one persists for
the rest of the file until you restore it.

---

← Prev: [07 · Mocking](./07-mocking.md) ·
Next → [09 · Test doubles](./09-test-doubles.md)
