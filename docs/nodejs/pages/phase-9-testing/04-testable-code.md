---
title: "Writing testable code — dependency injection over module singletons"
sidebar_label: "04 · Testable code"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**.

**Most "this is hard to test" problems are not testing problems.** They are a module
that reached out and grabbed something instead of being handed it. The fix is boring
and it is always the same: pass the dependency in.

## The problem, measured

```js
// config.mjs — evaluated once, at import time
export const config = {region: process.env.REGION ?? 'eu-west-1'};

// receipts.mjs
import {config} from './config.mjs';
const clock = () => new Date();                       // hidden dependency

export function receiptId(orderId) {
  return `${config.region}-${clock().getFullYear()}-${orderId}`;
}
```

The obvious test does not work:

```js
test('uses the configured region', () => {
  process.env.REGION = 'us-east-1';
  assert.match(receiptId(42), /^us-east-1/);
});
```

```console
process.env.REGION is now us-east-1
receiptId says           eu-west-1-2026-42
```

**The environment variable was read before the test body ran.** ESM evaluates
`config.mjs` when the import graph is resolved — before the first line of any test. By
the time you set `process.env`, the value is already baked into a module-level constant
that nothing can reach.

The second problem is quieter: `clock()` returns the real date, so the year in the
assertion is whatever year it happens to be. The test passes today and starts failing
on 1 January.

## The fix

Take both as parameters. A factory returns the configured function:

```js
// receipts.mjs
export function makeReceiptId({region, clock = () => new Date()}) {
  return (orderId) => `${region}-${clock().getFullYear()}-${orderId}`;
}
```

```js
test('formats a receipt id', () => {
  const receiptId = makeReceiptId({
    region: 'us-east-1',
    clock: () => new Date('2019-06-01'),
  });
  assert.equal(receiptId(42), 'us-east-1-2019-42');
});
```

Passes deterministically, forever, with no mocking library, no module interception and
no experimental flag. **That is the point** — the alternative is
[`mock.module()`](./08-module-mocking.md), which needs
`--experimental-test-module-mocks` and a careful import order. Injection needs neither.

Wire it once, at the edge:

```js
// main.mjs — the only place that reads the environment
import {makeReceiptId} from './receipts.mjs';
const receiptId = makeReceiptId({region: process.env.REGION ?? 'eu-west-1'});
```

## What counts as a hidden dependency

Anything the function reaches for that the caller cannot see:

| Hidden | Injected |
|---|---|
| `new Date()` / `Date.now()` | a `clock` function |
| `Math.random()` / `randomUUID()` | an `id` or `random` function |
| `process.env.X` | a value in a config object |
| a module-scope `new Pool(...)` | the `pool`, or a client, as an argument |
| `fetch` to a fixed URL | an injected `httpClient` and a base URL |
| a top-level logger | a `logger` on the dependency object |

Clock and randomness are the two that turn into flaky tests rather than impossible
ones, which is worse — they fail at month boundaries, across DST, or once in fifty runs.

## Two shapes that both work

**A factory closing over its dependencies** — good for a module with several related
functions:

```js
export function makeOrderService({pool, clock, mailer}) {
  return {
    async place(cart) { /* uses pool, clock */ },
    async cancel(id)  { /* uses pool, mailer */ },
  };
}
```

**A dependency as the first argument** — good for repositories, and it composes with
transactions, because the caller decides whether to hand over a pool or a client already
inside a `BEGIN`:

```js
export async function findById(db, id) {
  const {rows} = await db.query('select * from orders where id = $1', [id]);
  return rows[0] ?? null;
}
```

```js
// production: the pool. inside a transaction: the checked-out client.
await withTransaction(pool, async (client) => {
  const order = await findById(client, id);
  await markPaid(client, order.id);
});
```

That second shape is why the repository pattern is worth the small ceremony — see
[Phase 6](../phase-6-data-access/10-repository-pattern.md).

## Do not build a DI container

Node does not need one. A function that takes an object is dependency injection; a
framework that resolves a graph by decorator and string token is a different thing
carrying real cost — indirection, startup magic, and a second language to learn. Wire
the graph by hand in `main.mjs`. When it becomes genuinely unmanageable, that is a
signal about the design, not about the missing container.

## Defaults keep call sites honest

```js
export function makeOrderService({pool, clock = () => new Date(), mailer = realMailer}) { … }
```

Production passes what it must; tests override only what they care about. Without
defaults, every test constructs the whole world and the tests become as coupled as the
code.

## Gotchas

**Symptom:** Setting `process.env` in a test has no effect
**Cause:** The module read it at import time, before the test ran. Reproduced.
**Fix:** Read the environment once at the entrypoint and pass values down. If you must,
`await import()` the module *after* setting the variable — but injection is the fix.

**Symptom:** A test fails on 1 January, or only in CI's timezone
**Cause:** `new Date()` inside the code under test.
**Fix:** Inject a clock, or freeze time with `t.mock.timers`
([page 07](./07-mocking.md)).

**Symptom:** A test needs six mocks to construct one object
**Cause:** The unit depends on too much; the test is reporting a design problem.
**Fix:** Split the pure logic out and test that directly. Over-mocking is a smell —
[page 09](./09-test-doubles.md).

**Symptom:** Tests pass individually, fail as a suite
**Cause:** A module-level singleton mutated by one test and observed by another.
**Fix:** Construct per test via a factory. Process isolation hides this across files,
not within one.

**Symptom:** You cannot run two instances in one process
**Cause:** State lives at module scope rather than in an instance.
**Fix:** Move it into the object the factory returns.

## Interview questions

**★ Why can't you just set `process.env` in a test?**
Because ESM evaluates modules when the import graph is resolved, before any test body
runs. Measured: setting `process.env.REGION` inside the test left `receiptId` returning
the import-time value. Read the environment at the entrypoint and pass it down.

**★ How do you test code that uses the current time?**
Inject a clock (`{clock = () => new Date()}`) or freeze it with
`t.mock.timers.enable({apis: ['Date'], now})`. Injection is preferable because it needs
no runner support and makes the dependency visible in the signature.

**★ What is the argument against a DI container in Node?**
A function taking an object already is dependency injection. A container adds
indirection, startup-time resolution and framework-specific vocabulary in exchange for
wiring you can do in ten lines in `main.mjs`. It earns its place at a scale most Node
services never reach.

**★ Why pass the database handle as a parameter instead of importing the pool?**
So the caller can hand over a pool normally and a checked-out client inside a
transaction, without the repository knowing which. It is what makes one transaction
span several repositories.

**How do you avoid tests that construct the entire application?**
Give dependencies defaults so a test overrides only what it cares about, and keep pure
logic in functions that take plain values.

**Is dependency injection the same as mocking?**
No — it is what makes mocking mostly unnecessary. Injection replaces a dependency
through the public signature; mocking reaches around it. The first is checked by the
type system and visible at the call site, the second is not.

---

← Prev: [03 · Unit, integration, e2e](./03-unit-integration-e2e.md) ·
Next → [05 · API testing](./05-api-testing.md)
