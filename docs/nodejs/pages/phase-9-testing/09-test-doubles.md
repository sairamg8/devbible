---
title: "Test doubles — stub, spy, mock, fake, and over-mocking"
sidebar_label: "09 · Test doubles"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**.

**"Mock" has become the word for all of these, which is why people build the wrong
one.** The four are distinguished by what they replace and what you assert on. Getting
that right is most of the difference between a suite that catches regressions and one
that has to be rewritten every refactor.

## The four

| Double | What it does | You assert on |
|---|---|---|
| **Stub** | returns canned values | the **result** of the code under test |
| **Spy** | records calls, real behaviour continues | that something **was** called |
| **Mock** | canned values **plus** expectations about calls | the **interaction** |
| **Fake** | a working, simplified implementation | the result, as with the real thing |

### Stub — control the input

```js
test('applies the FX rate', async (t) => {
  const fetchRate = t.mock.fn(async () => 1.25);        // canned value
  const converted = await convert(100, 'EURUSD', {fetchRate});
  assert.equal(converted, 125);                          // assert the outcome
});
```

The stub exists so the code has something to work with. **Nothing is asserted about
the stub itself** — that is what makes it a stub, and it is the double you should reach
for most often.

### Spy — observe without changing

```js
test('logs a warning on a slow query', (t) => {
  const warn = t.mock.method(logger, 'warn');            // two args: real one still runs
  runQuery({durationMs: 4000});
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /slow query/);
});
```

`mock.method` with two arguments spies; the original runs. Use it when the real
behaviour is harmless and you only need to know it happened.

### Mock — assert the interaction

```js
test('charges the card exactly once, with the order total', async (t) => {
  const charge = t.mock.fn(async () => ({id: 'ch_1'}));
  await placeOrder(order, {charge});

  assert.equal(charge.mock.callCount(), 1);
  assert.deepStrictEqual(charge.mock.calls[0].arguments, [
    {amountCents: 4200, currency: 'EUR', idempotencyKey: 'order:99'},
  ]);
});
```

Here the interaction **is** the behaviour: charging twice is the bug, and the
idempotency key is a contract with the payment provider. Asserting on the call is
correct.

Ask before writing one: *if this call changed shape but the behaviour stayed the same,
should the test fail?* For a payment call, yes. For a logger, no.

### Fake — a working substitute

```js
export function makeInMemoryOrders() {
  const rows = new Map();
  let nextId = 1;
  return {
    async create(order) {
      const row = {id: nextId++, ...order};
      rows.set(row.id, row);
      return row;
    },
    async findById(id) { return rows.get(id) ?? null; },
  };
}
```

The best double when several tests need the same collaborator to actually work. It has
real behaviour, so tests read like production code, and it can be shared.

The cost: it is a second implementation that can drift from the real one. Keep it small,
and back it with **one integration test against the real thing**
([page 13](./13-testcontainers.md)) so drift is caught.

## Over-mocking

The smell:

```js
test('places an order', async (t) => {
  const pool     = t.mock.fn();
  const mailer   = {send: t.mock.fn()};
  const payments = {charge: t.mock.fn(async () => ({id: 'ch_1'}))};
  const inventory = {reserve: t.mock.fn(async () => true)};
  const logger   = {info: t.mock.fn(), warn: t.mock.fn()};
  const clock    = t.mock.fn(() => new Date('2026-01-01'));
  const metrics  = {increment: t.mock.fn()};

  await placeOrder(order, {pool, mailer, payments, inventory, logger, clock, metrics});

  assert.equal(payments.charge.mock.callCount(), 1);
});
```

Seven doubles for one assertion. What the test proves is that `placeOrder` calls
`charge` — restating its implementation. Rename a parameter and the test fails though
nothing broke; introduce a real bug in the total calculation and it still passes.

**The setup size is the diagnostic.** Six doubles means the unit has six collaborators,
and that is a design report, not a testing problem. The usual fix is to pull the
decisions out of the orchestration:

```js
// pure — test this exhaustively, no doubles at all
export function orderTotal(items, discount) { … }
export function chargeRequest(order) { … }

// orchestration — one thin test that the pieces are wired
export async function placeOrder(order, deps) { … }
```

Now the branch coverage lives in tests with **zero** doubles, and the orchestration gets
one small test.

## What never to double

**Your own database driver.** Stubbing `pool.query` leaves a test asserting that you
passed a string you also wrote in the test. It goes green against invalid SQL, a missing
column, and a constraint that does not exist — the three things that actually break.

**Pure functions.** There is nothing to isolate. Call them.

**The thing under test.** Partially mocking the module you are testing means the test
and the implementation are the same artefact.

## Choosing quickly

```
Can I pass a plain value instead?        → do that, no double
Do I only need it to return something?   → stub
Do I need to know it was called?         → spy
Is the call itself the behaviour?        → mock
Do several tests need it to work?        → fake
Is it the only thing that can be wrong?  → don't double it — integration test
```

## Gotchas

**Symptom:** A test fails after a pure refactor
**Cause:** It asserts on interactions that are implementation detail.
**Fix:** Assert on the result. Keep interaction assertions for calls that are contracts
— payments, emails, webhooks.

**Symptom:** Test setup is longer than the test
**Cause:** Too many collaborators.
**Fix:** Extract pure functions and test those directly; leave one thin wiring test.

**Symptom:** Everything is green and the endpoint 500s
**Cause:** The data layer is stubbed, so no SQL ever ran.
**Fix:** One integration test per repository against the real engine.

**Symptom:** The fake and the real implementation disagree
**Cause:** Inevitable drift in a second implementation.
**Fix:** Keep fakes minimal and cover the real thing with at least one integration test.

**Symptom:** A spy records nothing
**Cause:** The reference was captured before the double was installed.
**Fix:** Call through the object, or inject it ([page 04](./04-testable-code.md)).

## Interview questions

**★ What is the difference between a stub and a mock?**
A stub supplies canned input and you assert on the *result*; a mock also carries
expectations about how it was called and you assert on the *interaction*. Reach for a
stub by default — mocks couple the test to the implementation, which is only worth it
when the call itself is the behaviour.

**★ When is asserting on a call correct rather than brittle?**
When the call is a contract with the outside world: charging a card once with an
idempotency key, sending exactly one email, delivering a webhook. If the call could
change shape without the behaviour changing — a logger, a metric — asserting on it just
makes refactors expensive.

**★ Why is over-mocking a design smell rather than a testing style?**
The number of doubles equals the number of collaborators. Seven doubles for one
assertion says the unit orchestrates too much. Extract the decisions into pure
functions, test those with no doubles, and leave one thin test for the wiring.

**★ Why should you not mock the database driver?**
Because the logic under test is the SQL, and stubbing `pool.query` removes it. The test
then passes against invalid SQL, a missing column or a constraint that does not exist.
If mocking the dependency removes the risk, it is an integration test.

**When is a fake better than a stub?**
When several tests need the collaborator to actually behave — an in-memory repository
lets tests read like production code and be shared. The cost is a second implementation
that drifts, so keep it small and cover the real thing with one integration test.

**What is a spy, concretely, in `node:test`?**
`t.mock.method(obj, 'name')` with two arguments: the original still runs, and calls are
recorded on `obj.name.mock`. A third argument makes it a stub instead.

---

← Prev: [08 · Module mocking](./08-module-mocking.md) ·
Next → [10 · Fixtures and factories](./10-fixtures-and-factories.md)
