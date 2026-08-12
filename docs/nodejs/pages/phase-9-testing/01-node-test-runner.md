---
title: "node:test — the built-in runner"
sidebar_label: "01 · node:test"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**, 8 cores.

**Node ships a test runner. You do not need a dependency to test a Node
application.** `node:test` covers describe/it, hooks, mocking, timers, coverage,
snapshots and watch mode — the things a project actually reaches for.

## The shape

```js
// test/cart.test.mjs
import {describe, it, before, beforeEach, after} from 'node:test';
import assert from 'node:assert/strict';
import {Cart} from '../src/cart.mjs';

describe('Cart', () => {
  let cart;
  beforeEach(() => { cart = new Cart(); });

  it('starts empty', () => {
    assert.equal(cart.total(), 0);
  });

  it('sums line items', () => {
    cart.add({sku: 'A', price: 250, qty: 2});
    assert.equal(cart.total(), 500);
  });
});
```

```console
$ node --test
✔ starts empty (1.9ms)
✔ sums line items (0.4ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

`test` and `it` are the same function. `describe` groups; nesting is allowed to any
depth. A test fails when it **throws** — that is the whole contract, which is why
`node:assert` and a bare `throw` both work.

## How files are found

`node --test` with no arguments walks the current directory. Measured, it picks up:

| Pattern | Discovered |
|---|---|
| `*.test.mjs` anywhere | ✅ |
| `*-test.mjs` | ✅ |
| **anything inside a `test/` directory** — even `helpers.mjs` | ✅ |
| `*.spec.mjs` | ❌ **no** |

**The `.spec` default is the most dangerous thing in this page.** A project whose files
are all named `user.spec.mjs` — the Jest and Vitest convention — produces this:

```console
$ node --test
ℹ tests 0
ℹ pass 0
ℹ fail 0
$ echo $?
0
```

A green CI run that executed nothing. Rename to `.test.mjs`, or pass an explicit glob.

## Hooks and their order

```js
describe('outer', () => {
  before(() => {});      // once, before the first test in this suite
  beforeEach(() => {});  // before every test, including nested ones
  afterEach(() => {});
  after(() => {});       // once, after the last test
  it('test 1', () => {});
  describe('inner', () => {
    before(() => {});
    it('test 2', () => {});
  });
});
```

Measured order:

```console
outer before → outer beforeEach → test 1 → outer afterEach
             → inner before → outer beforeEach → inner beforeEach → test 2
             → inner afterEach → outer afterEach
             → inner after → outer after
```

Two things people get wrong: **the outer `beforeEach` runs for nested tests too**, and
`after` hooks run last of all, inner before outer — not interleaved with the tests.

Hooks may be `async`; the runner awaits them. A `before` that rejects fails every test
in the suite rather than reporting a confusing cascade.

## Isolation: one process per file

By default each test **file** runs in its own child process. Four files gave four
distinct pids. That is what makes a module-level singleton in one file invisible to
another, and it is worth the cost:

| | 4 trivial files |
|---|---|
| default (`--test-isolation=process`) | **0.22 s** |
| `--test-isolation=none` | **0.10 s** |

`none` runs everything in one process — faster, and the moment one file's global state
leaks into another you have a test suite that lies. Use it for a fast local loop, not
for CI.

## Concurrency

Files run **in parallel**; tests inside one file run **serially**.

```console
4 files × 500 ms sleep
  --test-concurrency=1   2.50 s
  --test-concurrency=2   1.34 s
  --test-concurrency=4   0.72 s
  default (8 cores)      0.74 s

2 tests × 300 ms in ONE file
  default                0.80 s      ← serial
  {concurrency: true}    0.50 s
```

To parallelise within a file, opt in:

```js
describe('independent reads', {concurrency: true}, () => {
  it('a', async () => { /* … */ });
  it('b', async () => { /* … */ });
});
```

Only where the tests genuinely share nothing. The default is serial because that is the
safe answer.

## Skip, todo, only

```js
it.skip('not yet', () => {});
it.todo('write this');
it('conditionally', {skip: process.platform === 'win32'}, () => {});
it.only('just this one', () => {});     // needs --test-only
```

`only` requires the `--test-only` flag to take effect; without it the flag is ignored
and the whole file runs. That asymmetry catches people — a committed `.only` does *not*
silently disable the rest of your CI suite, which is the safe default.

## Watch mode

```bash
node --test --watch
node --test --watch 'src/**/*.test.mjs'
```

Re-runs on change. Pair it with `--test-isolation=none` locally for the fastest loop.

## Exit codes and failure output

A failing assertion gives a structured diff, the file is re-listed, and the process
exits **1**:

```console
✖ deepStrictEqual diff (4.7ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      id: 1,
      tags: [
        'a',
  +     'b'
  -     'c'
      ]
    }
$ echo $?
1
```

Reporters: `--test-reporter=spec` (the default when attached to a TTY), `tap`, `dot`,
`junit`, `lcov`. CI usually wants `--test-reporter=junit
--test-reporter-destination=results.xml`, and you can pass the flag twice to get both a
human and a machine report.

## Gotchas

**Symptom:** `node --test` reports `tests 0` and exits `0`
**Cause:** Files are named `*.spec.mjs`, which is not a discovery pattern.
**Fix:** Rename to `*.test.mjs`, move them into a `test/` directory, or pass a glob.

**Symptom:** `Error: Cannot find module '…/test'` when running `node --test test/`
**Cause:** A directory positional is resolved as a **module**, not searched. Reproduced
on 24.19.0 with and without `./`, relative and absolute.
**Fix:** `node --test` with no argument (it walks recursively), or a quoted glob:
`node --test 'test/**/*.test.mjs'`.

**Symptom:** Tests pass alone and fail together
**Cause:** Shared module state, plus `--test-isolation=none`.
**Fix:** Drop back to the default process isolation, and see
[page 14](./14-runner-flags.md) for `--test-randomize`, which finds this deliberately.

**Symptom:** `it.only` did not restrict the run
**Cause:** `only` needs `--test-only`.
**Fix:** Add the flag, or use `--test-name-pattern` instead.

**Symptom:** The runner never exits after the last test
**Cause:** An open handle — a server, an interval, a database pool.
**Fix:** Close it in `after`. See [page 14](./14-runner-flags.md) for
`--test-force-exit` and why it is a plaster, not a fix.

## Interview questions

**★ Why would you use `node:test` over Jest or Vitest?**
No dependency, no transform, no config, and it starts an order of magnitude faster —
measured 0.22 s against 1.4 s for Vitest on the same 50-test suite. For a plain Node
backend it covers everything: mocks, timers, coverage, snapshots, watch. The case for
the others is jsdom, a large existing suite, or a shared frontend toolchain
([page 12](./12-vitest-and-jest.md)).

**★ How does the runner decide a test failed?**
It throws. There is no special return value — an uncaught exception or a rejected
promise from the test function fails it, which is why `node:assert` needs no
integration and why a bare `throw new Error()` works.

**★ What is the difference between `--test-isolation=process` and `=none`?**
`process` (the default) gives each file its own child process, so module state cannot
leak between files. `none` runs everything in one process and is roughly twice as fast
on a trivial suite, at the cost of hiding cross-file coupling. Local speed-up, not a
CI setting.

**★ Do tests run in parallel?**
Files do, up to `--test-concurrency` (defaults to the core count). Tests **within** one
file are serial unless you pass `{concurrency: true}` to the enclosing `describe`.
Measured: two 300 ms tests took 0.80 s serially and 0.50 s concurrently.

**Which files does `node --test` pick up?**
`*.test.*`, `*-test.*`, and everything inside a `test/` directory. Notably **not**
`*.spec.*` — a suite named that way runs zero tests and still exits 0.

**How do you get machine-readable output for CI?**
`--test-reporter=junit --test-reporter-destination=results.xml`. The flag can be
repeated to emit a human-readable report at the same time.

---

← Prev: [Phase 8 · Audit logging](../phase-8-security/27-audit-logging.md) ·
Next → [02 · node:assert](./02-node-assert.md)
