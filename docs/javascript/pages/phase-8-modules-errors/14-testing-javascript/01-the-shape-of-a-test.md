---
title: "01 · The shape of a test"
sidebar_label: "01 · The shape of a test"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the Vitest docs — [Guide § Mocking](https://vitest.dev/guide/mocking.html), [API § `vi`](https://vitest.dev/api/vi.html) — Jest [Timer Mocks](https://jestjs.io/docs/timer-mocks), Node.js [Test runner](https://nodejs.org/api/test.html), and MDN [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError). Documentation-validated; **no test runs, no timings, no console blocks** — the code here is illustrative, not transcribed output.

## A test is three lines with names on them

Every test in every runner is the same shape, and naming the three parts is most of what makes a
suite readable:

```js
import { describe, test, expect } from 'vitest';   // or 'node:test' + 'node:assert', or Jest globals
import { parsePrice } from './price.js';

describe('parsePrice', () => {
  test('reads a decimal amount into minor units', () => {
    const input = '12.34';                  // arrange
    const result = parsePrice(input);       // act
    expect(result).toBe(1234);              // assert
  });
});
```

**Vitest, Jest and Node's own `node:test` all offer this shape.** They differ in how they load your
code, not in what a test looks like — which is why the vocabulary transfers and why this topic
teaches the vocabulary rather than one tool's flags.

🔴 **One behaviour per test, and the name is the specification.** `test('reads a decimal amount
into minor units')` tells a reader what broke when it fails. `test('parsePrice works')` tells them
to go read the body. A failing test's name is the first — sometimes only — thing anyone sees.

## Asynchronous assertions are where tests silently pass

The single most common broken test is one that asserted nothing because the assertion ran after
the test had already finished:

```js
test('rejects an unknown id', () => {
  fetchUser('nope').catch(err => expect(err.code).toBe('NOT_FOUND'));   // ⛔ passes even if it resolves
});
```

Nothing awaited the promise, so the test function returned, the runner recorded a pass, and the
assertion happened — if it happened at all — in a test that was already over.

**Return or await the promise, and assert on it directly:**

```js
test('rejects an unknown id', async () => {
  await expect(fetchUser('nope')).rejects.toThrow(/not found/i);
});

test('resolves to a user', async () => {
  await expect(fetchUser('u_1')).resolves.toMatchObject({ id: 'u_1' });
});
```

⚠️ **`await` the `expect(...).rejects` chain.** Forgetting the outer `await` puts you back where
you started — the matcher returns a promise, and an unawaited promise cannot fail a test that has
already returned.

**For a synchronous throw, pass a function, not a call:**

```js
expect(() => parsePrice('abc')).toThrow(ValidationError);   // ✅
expect(parsePrice('abc')).toThrow();                        // ⛔ throws before expect() is called
```

🔴 **Assert on something stable.** A message is copy; a `code` or a class is a contract
([08 · Designing the taxonomy](../08-custom-error-classes/01-designing-the-taxonomy.md)). A test
that matches an error string breaks the next time someone improves the wording, which teaches the
team that failing tests are noise.

## Choose the matcher for the failure message you want

Matchers exist because `expect(a === b).toBe(true)` can only ever tell you `true !== false`. The
right matcher prints both values and the difference.

| Instead of | Use | Why |
|---|---|---|
| `expect(x === y).toBe(true)` | `toBe` / `toEqual` | shows both values and a diff |
| `toBe` on an object | `toEqual` (deep) | `toBe` is identity, and two equal literals are not identical |
| a hand-written loop over an array | `toContain` / `toHaveLength` | one clear failure instead of a silent early return |
| `toEqual` on a whole response | `toMatchObject` | asserts the fields you care about, not the ones you inherited |

**`toBe` versus `toEqual` is the value-versus-reference distinction from
[Phase 1](../../phase-1-values-and-coercion/README.md)**, and confusing them produces both classic
failures: a passing test that compared nothing, and a failing test on two objects a human would
call the same.

## Setup, teardown, and the isolation you must not assume away

```js
import { beforeEach, afterEach } from 'vitest';

let db;
beforeEach(() => { db = makeInMemoryDb(); });
afterEach(() => { db.close(); });
```

**The rule: any state a test creates, that test removes.** Shared module state is the ordinary
cause of the worst class of bug in a suite — a test that passes alone and fails in the run, or the
reverse — because a module is evaluated once per module graph
([02 · Singletons](../02-module-semantics/01-singletons-and-strict.md)).

⚠️ **`beforeAll` is a performance decision with a correctness cost.** Anything built once is shared
by every test in the block; the moment one mutates it, the others depend on order. Prefer
`beforeEach` and reach for `beforeAll` only for genuinely immutable, expensive setup.

🔴 **Vitest's own mocking guide states the cleanup rule plainly** — *"Always remember to clear or
restore mocks before or after each test run to undo mock state changes between runs"* — and offers
the `restoreMocks` configuration to do it automatically. Turn it on; it removes a whole family of
order-dependent failures ([02 · Faking time, network and modules](./02-faking-time-network-modules.md)).

## What the runner is actually doing

A test runner is a bundler-adjacent tool, which is why its problems look familiar
([13 · What a bundler does](../13-bundlers-and-the-build/01-what-a-bundler-does.md)):

1. **Finds** files matching a pattern.
2. **Transforms** them — TypeScript, JSX, and whatever your source needs.
3. **Runs** each file in an environment: `node`, or a simulated DOM for browser-ish code.
4. **Isolates** files from each other, usually one worker per file, and reports the results.

Two consequences worth holding on to:

- **The environment is a choice, and a wrong one produces confusing errors.** `document is not
  defined` means a browser test ran in the Node environment; a Node API missing means the reverse.
- **Isolation is per file, not per test.** Two tests in one file share the module graph. That is
  exactly why the cleanup rule above is not optional.

## Gotchas

**Symptom: an async test passes when the code is broken.**
Cause — the promise was never awaited, so the assertion ran after the test finished.
Fix — `await` (or return) every promise, and `await expect(...).rejects` for failures.

**Symptom: `expect(fn()).toThrow()` fails with the thrown error itself.**
Cause — the call happened before `expect` ran.
Fix — pass a function: `expect(() => fn()).toThrow()`.

**Symptom: a test passes alone and fails in the suite.**
Cause — shared state: a module-level cache, a mock never restored, a `beforeAll` fixture mutated.
Fix — move setup into `beforeEach`, restore mocks between tests, and make the fixture per-test.

**Symptom: the same test fails only when the order changes.**
Cause — the same thing, seen from the other side; some earlier test was leaving state behind.
Fix — run the file in isolation to find the pair, then remove the shared state rather than pinning
the order.

**Symptom: `toBe` fails on two objects that look identical.**
Cause — `toBe` is identity; equal contents are not the same reference.
Fix — `toEqual` for deep equality, or `toMatchObject` for a subset.

**Symptom: a wording change broke a dozen tests.**
Cause — assertions matched error messages instead of codes or classes.
Fix — assert on `err.code` or the error class; leave the message to humans.

**Symptom: `document is not defined`.**
Cause — the test ran in the Node environment.
Fix — select a DOM environment for that file or project, and keep pure-logic tests in Node.

## Interview questions

**★ Why does an async test sometimes pass when the code is broken?**
Because nothing awaited the promise. The test function returned, the runner passed it, and the
assertion ran afterwards — or never. Await or return every promise.

**★ How do you assert that something rejects?**
`await expect(p).rejects.toThrow(...)` — with the outer `await`. For a synchronous throw, pass a
function to `expect` so the call happens inside the matcher.

**★ `toBe` or `toEqual`?**
`toBe` is identity, `toEqual` is deep structural equality. Objects that look the same are never
`toBe` each other unless they are the same reference.

**★ Why do tests pass alone and fail together?**
Shared state across a file's module graph — a module-level cache, an unrestored mock, or a mutated
`beforeAll` fixture. Isolation is per file, not per test.

**★ Where should a test's cleanup live?**
In `afterEach`, or by configuring the runner to restore mocks automatically. Vitest's guide is
explicit that mock state must be cleared or restored between runs.

**★ What should a test's name say?**
The behaviour being asserted, in a sentence — it is the specification, and it is what a reader sees
when the test fails.

**Why assert on an error code rather than a message?**
The message is copy and will change; a code or class is a contract you chose to keep.

---

← *(topic index and next chunk land with the README)*
