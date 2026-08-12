---
title: "Runner flags worth knowing"
sidebar_label: "14 · Runner flags"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Flag names change between majors — this page
> lists what that version actually has, not what older articles describe.

**Several of these flags exist to find bugs in your test suite rather than in your
code.** Two of them can also make a broken suite report green, so read the whole page
before wiring any into CI.

## `--test-randomize` — find inter-test coupling

Not `--test-random-order`, which does not exist on this version.

```js
const cart = [];   // shared state between tests

test('adds an item', () => { cart.push('widget'); assert.equal(cart.length, 1); });
test('adds a second', () => { cart.push('gizmo'); assert.equal(cart.length, 2); });
test('cart totals two', () => { assert.equal(cart.length, 2); });
```

In file order all three pass. Randomized, with `--test-random-seed` to make each run
reproducible:

| seed | 1 | 2 | 3 | 7 | 11 |
|---|---|---|---|---|---|
| **failures** | 2 | 1 | 1 | **0** | 3 |

Same three tests. **Seed 7 passes entirely** — which is what makes this class of bug so
durable: it hides until the day something reorders execution.

```bash
node --test --test-randomize                    # find it
node --test --test-randomize --test-random-seed=11   # reproduce it
```

Worth running in CI on a schedule, or on the main branch, rather than on every PR where
an unrelated failure is noise.

## `--test-rerun-failures` — and how it lies

Records a state file so the next run skips what already passed.

```bash
node --test --test-rerun-failures=./.test-rerun
```

The state file records the tests that **passed**, with their durations:

```json
[{"flaky.test.mjs:5:1": {"name": "always passes", "passed_on_attempt": 0,
                         "duration_ms": 1.773593}}]
```

On the next run those are **not executed** — they are replayed:

```console
✔ always passes (1.773593ms) (passed on attempt 0)
✔ passes on the second run (1.442618ms)
```

Note the identical duration. Now the measured danger — edit a recorded-as-passing test
so it throws, and run again with the same state file:

```console
✔ always passes (3.559588ms) (passed on attempt 0)
ℹ pass 3
ℹ fail 0
$ echo $?
0
```

**A test that now throws reports a green tick and the run exits 0.** The same file
without the state file:

```console
✖ always passes (1.658833ms)
ℹ fail 1
$ echo $?
1
```

Use it in a local fix-the-failures loop. **Never in CI**, and add the state file to
`.gitignore` so it cannot be committed.

It also refuses to combine with a seed:

```console
ERR_INVALID_ARG_VALUE: The property 'options.randomSeed' is not supported with rerun
failures mode.
```

So "reproduce the random-order failure, then iterate on only the failures" is not
available — reproduce with the seed, fix, then re-run the whole file.

## Tag filtering — and the option key that silently does nothing

The flag is `--experimental-test-tag-filter`. There is no `--test-name-tag`.

```js
test('fast unit thing', {tags: ['unit']}, () => {});
test('slow db thing',   {tags: ['integration']}, () => {});
```

**The key is `tags`, plural, and an array.** Measured against five tests using various
spellings, `--experimental-test-tag-filter=unit` matched exactly one — the one written
`tags: ['unit']`. The singular `tag: 'unit'` produced **no error and no warning**; it
simply never matched.

```console
✔ plural key (1.96ms)
ℹ tests 1
```

A CI job filtering on a tag nobody spelled correctly runs zero tests and exits 0. Until
this leaves experimental, **separating suites by filename and glob is safer** — a glob
that matches nothing is visible.

## `--test-force-exit` — a plaster

A test leaving a listener open:

```js
test('leaves a server listening', () => {
  net.createServer().listen(0);   // never closed
});
```

```console
without --test-force-exit: exit=124   (killed at 6 s — it hangs forever)
with    --test-force-exit: exit=0
```

The flag makes the process exit after the last test regardless of open handles. It is
correct when a third-party library genuinely leaks a handle you cannot close. Used to
silence your own leak, it hides a bug that will also affect graceful shutdown in
production. Close the handle in `after` first.

## `--test-global-setup` — one-time setup across all files

```js
// test/global-setup.mjs
export async function globalSetup()    { /* start a container, run migrations */ }
export async function globalTeardown() { /* stop it */ }
```

```bash
node --test --test-global-setup=./test/global-setup.mjs
```

Measured: setup runs before any file, teardown after the summary. This is how you start
**one** database for the whole run instead of one per file — pass the connection string
through an environment variable, since the files are separate processes.

## Selecting what runs

```bash
node --test --test-name-pattern="checkout"      # regex against the test name
node --test --test-skip-pattern="slow"          # its inverse
node --test --test-only                         # required for it.only to take effect
node --test --test-shard=1/4                    # split across CI machines
node --test --test-timeout=5000                 # no default otherwise
node --test --test-concurrency=4
node --test --test-isolation=none               # one process for everything
```

`--test-shard=1/4` … `4/4` on four runners is the cheapest CI speed-up available, and
unlike the flags above it cannot make a broken suite look green.

## Reporters

```bash
node --test --test-reporter=spec                                   # default on a TTY
node --test --test-reporter=dot
node --test --test-reporter=junit --test-reporter-destination=results.xml \
            --test-reporter=spec  --test-reporter-destination=stdout
```

Pairs of reporter/destination flags, positionally matched — one machine-readable file
plus human output on the same run.

## A CI configuration that is honest

```json
{
  "scripts": {
    "test": "node --test --test-timeout=10000",
    "test:watch": "node --test --watch --test-isolation=none",
    "test:fix": "node --test --test-rerun-failures=./.test-rerun",
    "test:ci": "node --experimental-test-coverage --test-coverage-include='src/**' --test-timeout=10000 --test-reporter=junit --test-reporter-destination=results.xml --test-reporter=spec --test-reporter-destination=stdout --test"
  }
}
```

`test:fix` is deliberately not part of `test:ci`.

## Gotchas

**Symptom:** CI is green while a test throws
**Cause:** A stale `--test-rerun-failures` state file replaying an old pass.
**Fix:** Remove the flag from CI; gitignore the state file.

**Symptom:** A tag-filtered job runs zero tests and exits 0
**Cause:** `tag:` instead of `tags: [...]` — silently unmatched.
**Fix:** Use `tags` with an array, or separate suites by filename.

**Symptom:** `--test-random-order` is not recognised
**Cause:** It does not exist; the flag is `--test-randomize`.
**Fix:** Use `--test-randomize`, with `--test-random-seed` to reproduce.

**Symptom:** `ERR_INVALID_ARG_VALUE … randomSeed … rerun failures mode`
**Cause:** The two flags are mutually exclusive.
**Fix:** Reproduce with the seed, then run the whole file.

**Symptom:** The suite hangs at the end
**Cause:** An open handle.
**Fix:** Close it in `after`. `--test-force-exit` hides it; the same leak affects
production shutdown.

**Symptom:** `it.only` did not restrict the run
**Cause:** `--test-only` was not passed.
**Fix:** Add it, or use `--test-name-pattern`.

## Interview questions

**★ How do you find tests that depend on each other?**
`--test-randomize`, with `--test-random-seed` to reproduce. Measured on a
three-test suite with shared state: seeds 1/2/3/7/11 gave 2/1/1/**0**/3 failures. Seed
7 passed entirely, which is why the bug survives in file order.

**★ Why should `--test-rerun-failures` never be in CI?**
The state file records passes and replays them without executing. Measured: a test
edited to throw still reported `✔ (passed on attempt 0)` and the run exited 0. Without
the state file the same suite failed. It is a local iteration tool.

**★ What is the correct way to tag a test?**
`test('name', {tags: ['unit']}, fn)` — plural, array — with
`--experimental-test-tag-filter`. The singular `tag:` is silently ignored, no error,
so a filtered CI job can run zero tests and exit 0.

**★ When is `--test-force-exit` legitimate?**
When a third-party library leaks a handle you cannot close. For your own code it hides
a real defect: the same unclosed handle prevents graceful shutdown in production.

**How do you split a slow suite across CI machines?**
`--test-shard=1/4` through `4/4` on four runners. It is the safest speed-up here —
unlike rerun-failures or tag filtering it cannot make a broken suite look green.

**How do you get both human and machine output in one run?**
Repeat `--test-reporter` and `--test-reporter-destination` in pairs — `junit` to a
file and `spec` to stdout.

---

← Prev: [13 · Testcontainers](./13-testcontainers.md) ·
Next → [15 · Snapshot testing](./15-snapshot-testing.md)
