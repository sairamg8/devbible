---
title: "Fixtures, factories, and test data that doesn't rot"
sidebar_label: "10 · Fixtures and factories"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**.

**Test data rots for one reason: it is written once, shared everywhere, and then nobody
dares change it.** The fix is a factory that builds a valid object with one line and
lets each test override only the field it is actually about.

## The problem with a shared fixture

```js
// fixtures/order.json — imported by 40 tests
{
  "id": 1, "customerId": 7, "status": "paid", "currency": "EUR",
  "items": [{"sku": "A", "qty": 2, "price": 250}],
  "createdAt": "2024-03-01T10:00:00Z", "discountCode": null, "shippingCents": 499
}
```

Three failures follow, all of them predictable:

1. **Nobody can change it.** Adding `taxRate` to the schema breaks the 40 tests that
   deep-compare it, so the field is added everywhere else and the fixture drifts.
2. **The test does not say what it is about.** A test for "expired discount codes"
   imports the same blob as every other test, and the one field that matters is
   invisible.
3. **It goes stale.** `status: "paid"` was legal when it was written; a later state
   machine requires `paidAt`, and the fixture is now an object the application can no
   longer produce.

## Factories

A function with sensible defaults and an override:

```js
// test/factories.mjs
let seq = 0;
export const nextId = () => ++seq;

export function anOrder(overrides = {}) {
  return {
    id: nextId(),
    customerId: nextId(),
    status: 'pending',
    currency: 'EUR',
    items: [anItem()],
    shippingCents: 499,
    discountCode: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function anItem(overrides = {}) {
  return {sku: 'WIDGET-1', qty: 1, priceCents: 1000, ...overrides};
}
```

The test now states its own subject:

```js
test('an expired discount code is rejected', () => {
  const order = anOrder({discountCode: 'SUMMER24'});
  assert.throws(() => applyDiscount(order, {expiresAt: '2024-09-01'}), /expired/);
});

test('free shipping over 100 EUR', () => {
  const order = anOrder({items: [anItem({priceCents: 12_000})]});
  assert.equal(shippingFor(order), 0);
});
```

Everything not named is irrelevant to the assertion, and a new required field is added
in **one** place.

## Keep the defaults valid and boring

The default object should be the most ordinary thing your system can hold: one item,
no discount, the common currency, a status you can legally start from. Tests then say
"an ordinary order, except…", which is what makes them readable.

Resist a `aPaidOrderWithTwoItemsAndADiscount()` for every combination. Composition
handles it:

```js
const order = anOrder({status: 'paid', items: [anItem(), anItem({sku: 'WIDGET-2'})]});
```

## Determinism beats realism

```js
// ✗ a different value every run
import {faker} from '@faker-js/faker';
const order = {id: faker.string.uuid(), total: faker.number.int()};
```

Random data produces tests that fail once a fortnight with a value nobody can
reproduce. If you want randomness, use **property-based testing**, which is randomness
with a seed and automatic shrinking to a minimal counterexample
([page 17](./17-property-and-mutation.md)) — measured there:
`Counterexample: ["0 0 00 A AA    0"]`, shrunk 35 times. That is what randomness is
worth doing properly.

Where uniqueness is needed, use a counter, not a UUID:

```js
let seq = 0;
const uniqueSku = () => `SKU-${++seq}`;
```

Reproducible, readable in a failure message, and still unique within the run.

## Fix time explicitly

```js
const FIXED_NOW = new Date('2026-01-01T00:00:00Z');
export const anOrder = (o = {}) => ({createdAt: FIXED_NOW.toISOString(), ...o});
```

Then either inject that clock ([page 04](./04-testable-code.md)) or freeze it with
`t.mock.timers` ([page 07](./07-mocking.md)). Data built from `new Date()` gives you a
suite that fails at month ends and across DST.

## Database fixtures

For integration tests, the factory writes rows and returns them:

```js
export async function anOrderRow(db, overrides = {}) {
  const order = anOrder(overrides);
  const {rows} = await db.query(
    `insert into orders (customer_id, status, currency, shipping_cents)
     values ($1, $2, $3, $4) returning *`,
    [order.customerId, order.status, order.currency, order.shippingCents],
  );
  return rows[0];
}
```

Isolate with a **transaction per test**, rolled back afterwards — verified against a
real PostgreSQL 18 on [page 13](./13-testcontainers.md):

```js
beforeEach(async (t) => {
  t.client = await pool.connect();
  await t.client.query('begin');
});
afterEach(async (t) => {
  await t.client.query('rollback');
  t.client.release();
});
```

Faster than truncate-and-reseed, and each test starts from the migrated schema with
nothing left behind. It cannot be used for code that manages its own transactions —
those tests need truncation instead.

## Where a static fixture is still right

For **input you did not author**: a captured webhook payload, a provider's OAuth
response, a real CSV that broke the importer. The point is that it is exactly what
arrived, so a factory would defeat it.

```
test/fixtures/
  stripe-charge-succeeded.json     # captured 2026-01-14, do not edit
  bank-statement-latin1.csv        # the encoding bug from #482
```

Comment the provenance. A captured payload whose origin nobody remembers is
indistinguishable from one somebody invented.

## Gotchas

**Symptom:** One schema change breaks dozens of unrelated tests
**Cause:** A shared fixture deep-compared everywhere.
**Fix:** A factory with defaults; tests override only what they assert on.

**Symptom:** A test fails roughly once a fortnight
**Cause:** Random data from a faker library.
**Fix:** Deterministic defaults and a counter; use property-based testing where you
genuinely want random input.

**Symptom:** Tests fail at month end or in CI's timezone
**Cause:** Data built from `new Date()`.
**Fix:** A fixed constant, plus an injected or mocked clock.

**Symptom:** Integration tests pass alone, fail together
**Cause:** Rows left behind by an earlier test.
**Fix:** A transaction per test, rolled back in `afterEach`.

**Symptom:** A fixture describes a state the application can no longer produce
**Cause:** The fixture was not updated with the state machine.
**Fix:** Build fixtures through the factory — or, better, through the real creation
path.

**Symptom:** Nobody knows if a fixture is real or invented
**Cause:** No provenance.
**Fix:** Comment where and when it was captured; never edit captured payloads.

## Interview questions

**★ Why prefer a factory over a shared fixture file?**
Because the shared file couples every test to every field. A factory gives valid
defaults and lets each test override the one field it is about, so the test states its
own subject and a schema change is a one-line edit rather than forty.

**★ What is wrong with using faker for test data?**
It produces failures nobody can reproduce — a different value every run, and the value
that broke it is gone. If you want random input, use property-based testing: seeded,
reproducible, and it shrinks to a minimal counterexample.

**★ How do you isolate integration tests from each other?**
A transaction per test: `BEGIN` in `beforeEach`, `ROLLBACK` in `afterEach`, with the
checked-out client passed to the code under test. Verified against PostgreSQL 18 —
faster than truncate-and-reseed, and the schema stays migrated. It does not work for
code that manages its own transactions.

**★ When is a static fixture still the right answer?**
For input you did not author — a captured webhook payload, a provider response, the
CSV that broke the importer. Its value is being exactly what arrived, so record the
provenance and never edit it.

**How do you keep test data from going stale?**
Build it through the factory, and where practical through the real creation path, so
data that the application can no longer produce cannot survive in the suite.

**How do you get uniqueness without randomness?**
A module-level counter — `SKU-1`, `SKU-2`. Unique within the run, reproducible across
runs, and readable in a failure message.

---

← Prev: [09 · Test doubles](./09-test-doubles.md) ·
Next → [11 · Coverage](./11-coverage.md)
