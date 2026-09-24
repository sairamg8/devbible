---
name: devbible-phase9-measurements
description: The measured dataset behind Node Phase 9 (Testing) — runner discovery, isolation, assert edge cases, async traps, mocking, coverage, snapshots, flags, Testcontainers, Vitest/Jest/Biome timings, property and mutation testing
metadata:
  type: reference
---

Everything measured on **Node 24.19.0**, 8 cores, 2026-08-11, in
`sandbox/p9-testing/` (folders `ex1-discovery` … `ex18-concurrency`). Pages are written
from this file. Sibling of [[devbible-progress]].

## Discovery — `node --test` (ex1, ex3b)

Default recursive discovery from cwd picks up: `*.test.mjs` anywhere, `*-test.mjs`,
**every file inside a `test/` directory** (even `plain.mjs`), and nested dirs.

- **`*.spec.mjs` is NOT discovered.** A directory containing only `.spec.mjs` files gives
  `tests 0 … pass 0` and **exits 0** — a green run that tested nothing. This is the
  single most dangerous default for anyone arriving from Jest/Vitest.
- **A directory positional fails.** `node --test ex3-isolation` →
  `Error: Cannot find module '…/ex3-isolation'` (MODULE_NOT_FOUND). Reproduced with and
  without a `package.json` in the directory, relative and absolute, with and without
  `./`. Only **globs** (`'dir/*.test.mjs'`) or explicit files work; bare `node --test`
  does the recursive walk.
- This bit for real: `"command": "node --test test/"` in a Stryker config failed the
  initial dry run until changed to `node --test test/*.test.mjs`.

## Isolation and concurrency (ex3, ex18)

Default is **one child process per file** — 4 files gave 4 distinct pids.
`--test-isolation=none` ran all 4 in **one** pid.

| | 4 trivial files |
|---|---|
| default (process) | 0.21 · 0.22 · 0.22 · 0.22 · 0.23 s |
| `--test-isolation=none` | 0.09 · 0.10 · 0.10 · 0.10 s |

Four files each sleeping 500 ms:

| | wall |
|---|---|
| `--test-concurrency=1` | 2.50 s |
| `=2` | 1.34 s |
| `=4` | 0.72 s |
| default (8 cores) | 0.74 s |

**Within one file tests are serial by default** — two 300 ms tests took 0.80 s.
`describe('group', { concurrency: true }, …)` took 0.50 s.

## Hooks (ex2)

Order for a nested `describe`, measured:

```
outer before → outer beforeEach → test 1 → outer afterEach
             → inner before → outer beforeEach → inner beforeEach → test 2
             → inner afterEach → outer afterEach → inner after → outer after
```

**The outer `beforeEach` runs for nested tests too**; `afterEach` unwinds inner→outer;
`after` runs inner then outer, both after every test.

Failure output: `✖`, exit **1**, full `+ actual - expected` structured diff, plus the
file re-listed under `✖ failing tests:`.

## `node:assert` (ex4)

| Case | Result |
|---|---|
| `legacy.equal(1, '1')` | passes; `strict.equal` throws `ERR_ASSERTION` |
| `deepStrictEqual(NaN, NaN)` | **passes** |
| `deepStrictEqual(0, -0)` | **throws** |
| `{}` vs `Object.create(null)` | throws — prototype is compared |
| `new Point(1)` vs `{x:1}` | throws — class identity is compared |
| `[1,,2]` vs `[1,undefined,2]` | throws — a hole is not `undefined` |
| `new Date(0)` vs `new Date(0)` | passes |
| `Map` with different insertion order | **passes** — order is irrelevant |
| `{a:1}` vs `{a:1,b:undefined}` | **throws** — an explicit `undefined` key is a difference |

`assert.partialDeepStrictEqual` **exists and is not gated** on 24.19.0; extra keys on
the actual are ignored. No ExperimentalWarning emitted.

**`assert.throws(fn, 'boom')` is a trap** — a string second argument is the *message*
override, not a matcher: `ERR_AMBIGUOUS_ARGUMENT: The "error/message" argument is
ambiguous. The error message "boom" is identical to the message.` Use a regexp or object.

## Async traps (ex5) — **corrects an earlier note**

The old note said a forgotten `await` "passes silently". **It does not on 24.19.0.**

A test that drops a rejecting promise reports **`✔` for the test**, but the runner then
prints `Error: Test "…" generated asynchronous activity after the test ended … would
have caused the test to fail, but instead triggered an unhandledRejection event`, marks
the **file** `✖`, and exits **1**. Same for an assertion inside a `setTimeout` callback
(`uncaughtException` variant).

It becomes **genuinely silent only if the promise is explicitly caught**
(`p.catch(() => {})`) — then there is no diagnostic at all.

Note the file itself counts as a test: one real test gave `tests 2`.

## Mocking (ex6)

- `t.mock.fn` — `callCount()`, `calls[i].arguments`, `.result`, `.error`,
  `mockImplementationOnce`.
- `t.mock.method(obj, 'm', impl)` is **auto-restored** after the test; the next test saw
  the real method and `obj.m.mock === undefined`.
- **Top-level `mock` from `node:test` does NOT auto-restore** — the stub was still
  `FAKE` in the following test. This is the classic leak.
- `t.mock.timers.enable({ apis: ['setTimeout'] })` + `tick()`; `apis: ['Date'], now:`
  pins the clock; both restored automatically.

**`mock.module` is gated.** Without the flag: `TypeError: mock.module is not a function`.
With `--experimental-test-module-mocks`: works, prints `ExperimentalWarning: Module
mocking is an experimental feature and might change at any time`.

- **`options.namedExports` is deprecated** → `DeprecationWarning: mock.module():
  options.namedExports is deprecated. Use options.exports instead.`
- **Ordering trap, reproduced:** if the module under test is imported statically at the
  top of the test file, mocking its dependency has no effect *and* a later
  `await import()` returns the cached module — the real dependency still ran. The module
  under test must be dynamic-imported **after** the mock is installed.

## Coverage (ex7)

`--experimental-test-coverage` prints a per-file table (line %, branch %, funcs %,
uncovered lines). No ExperimentalWarning.

- Thresholds work: `--test-coverage-lines=90` →
  `Error: 81.82% line coverage does not meet threshold of 90%.` and **exit 1**.
- **The headline:** `withVat(net) { return net * 1.2 }` with one test
  (`withVat(100) === 120`) reports **100.00 / 100.00 / 100.00** — and
  `withVat(19.99) = 23.987999999999996` ships. Coverage measures execution, not
  correctness.

## Snapshots (ex8)

`t.assert.snapshot()` works with **no flag** on 24.19.0.

- First run without a file: `ERR_INVALID_STATE: Cannot read snapshot file … Missing
  snapshots can be generated by rerunning the command with the --test-update-snapshots
  flag.`
- `--test-update-snapshots` writes `<file>.snapshot` containing
  ``exports[`invoice rendering 1`] = ` … `;``
- **The trap:** after changing the code, a blind `--test-update-snapshots` rewrites the
  file and reports `✔`. The diff is only seen if you run *without* the flag first.

## Flags (ex9)

**`--test-randomize` + `--test-random-seed`** on a suite with shared state — same three
tests, different seeds:

| seed | 1 | 2 | 3 | 7 | 11 |
|---|---|---|---|---|---|
| fail | 2 | 1 | 1 | **0** | 3 |

In file order: 3 pass. The coupling is invisible without randomization.

**Tags — the option key is `tags: ['unit']`, plural and an array.** `{ tag: 'unit' }` is
**silently ignored**: with `--experimental-test-tag-filter=unit`, only the `tags:` test
matched (1 of 5). No error, no warning. *(The syllabus row names `--test-name-tag`,
which does not exist; the real flag is `--experimental-test-tag-filter`.)*

**`--test-rerun-failures=<file>`** — the state file records the tests that **passed**
(`passed_on_attempt`, cached `duration_ms`), not the failures. On the next run those are
**not executed**, just replayed as `✔ name (1.773593ms) (passed on attempt 0)` with the
identical cached duration.

- **Worst gotcha in the phase:** with a stale state file, a test edited to `throw` still
  reports `✔ (passed on attempt 0)` and the run **exits 0**. The same file without the
  state file gives `✖` and exit 1.
- `--test-random-seed` is **rejected** in this mode:
  `ERR_INVALID_ARG_VALUE: The property 'options.randomSeed' is not supported with rerun
  failures mode.`

**`--test-force-exit`** — a test leaving `net.createServer().listen(0)` open makes the
runner **hang forever** (killed at 6 s, exit 124). With the flag: exit **0**.

`--test-global-setup=./file.mjs` runs exported `globalSetup`/`globalTeardown`; teardown
runs after the summary block.

## HTTP / API (ex10)

`server.listen(0, '127.0.0.1')` + `server.address().port` — ephemeral port worked
(38003). `fetch` against it: 200/201/422 all as expected, `location` header readable.

**supertest 7.2.2 with express 5.2.1** — `request(app)` boots the app itself, no
`.listen()`. Chained `.expect('Content-Type', /json/).expect('Location', …).expect(201,
body)` works. Failure message: `expected 201 "Created", got 422 "Unprocessable Entity"`.

**Hardcoded port under parallel files:** two files both binding 3456 →
`Error: listen EADDRINUSE: address already in use 127.0.0.1:3456`, one file passes and
one fails, and which is a race.

## Dependency injection (ex11)

A `config.mjs` evaluating `process.env.REGION` at import time: setting
`process.env.REGION = 'us-east-1'` **inside the test** changed nothing —
`receiptId(42)` still returned `eu-west-1-2026-42`, because the module was evaluated
before the test body ran. The factory version (`makeReceiptId({ region, clock })`)
pinned both and returned `us-east-1-2019-42`.

## Runner comparison (ex12) — same 50-test suite

| Runner | wall (3 runs) | ESM config |
|---|---|---|
| `node:test` 24.19.0 | 0.22 · 0.24 · 0.23 s | none |
| **vitest 4.1.10** | 1.43 · 1.51 · 1.44 s | none |
| **jest 30.4.2** | 1.52 · 1.59 · 1.53 s | config + `NODE_OPTIONS=--experimental-vm-modules` |

Jest with `"type": "module"` and no config: `SyntaxError: Cannot use import statement
outside a module`. Jest self-reports `Time: 0.32 s` while wall clock is 1.5 s — it times
itself, not your wait.

## Testcontainers (ex13) — `testcontainers` 12.1.0, `pg` 8.23.0

`postgres:18-alpine` via `PostgreSqlContainer`: **container start 5585 ms and 6355 ms**
on a warm image. Real errors observed: `23505` / `orders_sku_key`, `23514` /
`orders_qty_check`. Per-test `BEGIN … ROLLBACK` isolation verified.

**Rootless podman needs both:**

- `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock` — without it,
  `Error: Could not find a working container runtime strategy`
- `TESTCONTAINERS_RYUK_DISABLED=true` — without it,
  `Error: Log stream ended and message "/.*Started.*/" was not received`

## Property and mutation testing (ex14, ex15)

**fast-check 4.9.0.** `fc.string()` defaults are too short to exercise a 12-char
truncation — widening to `{ minLength: 8, maxLength: 40 }` found it immediately:
`Counterexample: ["0 0 00 A AA    0"]`, **shrunk 35 times**. Three example-based tests
passed against the same bug.

**Stryker 9.6.1** on `discount()` — a suite with **100 % line coverage**:
`13 killed, 2 survived, mutation score 86.67 %`. Both survivors are the boundary:
`total >= 10` → `true`, and `>= 10` → `> 10`. No test uses `total = 10` or below.

## Lint / format (ex16) — 4 files, direct binaries

| Tool | 3 runs |
|---|---|
| eslint 10.8.1 | 0.43 · 0.46 · 0.45 s |
| prettier 3.9.6 | 0.31 · 0.29 · 0.28 s |
| **@biomejs/biome 2.5.8** | 0.09 · 0.09 · 0.09 s |

ESLint + Prettier ≈ 0.75 s vs Biome 0.09 s, and Biome does lint + format + import
organisation in one pass (self-reported `Checked 1 file in 5ms`).

## Contract testing (ex17) — zod 4.4.3

Compatibility matrix against a consumer-owned schema:

| Change | Verdict | zod message |
|---|---|---|
| add an optional field | compatible | — |
| widen a free-string value | compatible | — |
| remove a field | **breaking** | `email: Invalid input: expected string, received undefined` |
| rename a field | **breaking** | `createdAt: … received undefined` |
| narrow a type (`1` → `'1'`) | **breaking** | `id: Invalid input: expected number, received string` |
| null a required field | **breaking** | `email: … received null` |

Provider verification: the same contract run against a real ephemeral server caught
`created_at` drift — `createdAt — Invalid input: expected string, received undefined` —
before any frontend saw it.

## Containers left running

None of mine. `devbible-pg` (postgres:18-alpine) was already running and is **not
mine** — left alone. Testcontainers instances are removed by `container.stop()`;
`podman container prune -f` cleared the strays.
