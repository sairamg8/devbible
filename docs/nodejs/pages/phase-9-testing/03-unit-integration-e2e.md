---
title: "Unit, integration and e2e — where the boundaries actually belong"
sidebar_label: "03 · Unit, integration, e2e"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — timings from this phase's sandbox.

**The categories are not about size. They are about what you replace.** A test is a
unit test because it runs your code with nothing real behind it; an integration test is
one where something real — a database, an HTTP server, the filesystem — is on the other
side.

That framing settles most arguments, because it makes the cost visible:

| | What is real | Measured cost | What it can prove |
|---|---|---|---|
| **Unit** | nothing outside the module | **~0.22 s** for a whole suite | logic, branches, edge cases |
| **Integration** | database, HTTP server, queue | **+5.6 s** just to start a container | your SQL, your schema, your wiring |
| **End-to-end** | the deployed system, a browser | tens of seconds, flaky by nature | that it is plugged in at all |

The numbers are from this phase: a 50-test `node:test` suite ran in 0.22 s, and
`PostgreSqlContainer('postgres:18-alpine').start()` took **5585 ms** and **6355 ms**
across two runs on a warm image.

## The boundary that matters

Draw it at **I/O**, not at "one class".

```js
// pure — a unit test
export function nextRetryDelay(attempt, {base = 200, cap = 30_000} = {}) {
  const exp = Math.min(cap, base * 2 ** attempt);
  return Math.round(Math.random() * exp);      // jitter
}

// I/O — an integration test
export async function claimJob(pool) {
  const {rows} = await pool.query(
    `update jobs set state = 'running'
      where id = (select id from jobs where state = 'queued'
                  order by id for update skip locked limit 1)
      returning *`);
  return rows[0] ?? null;
}
```

`nextRetryDelay` has branches, a cap, and an off-by-one waiting to happen. Test it with
no infrastructure at all, exhaustively, in microseconds.

`claimJob` has almost no JavaScript in it. **Its logic is the SQL** — `FOR UPDATE SKIP
LOCKED`, the subquery, the `RETURNING`. Mocking `pool.query` here tests nothing except
that you can write a mock: the only thing that can be wrong is the part you replaced.
That is the rule.

> **If mocking the dependency removes the thing that could be wrong, it is an
> integration test.** Repositories, migrations and query builders are always in this
> category.

## What each layer is for

**Unit tests** are where coverage of *behaviour* comes from: boundaries, empty inputs,
`null`, the branch nobody takes. They are cheap enough that you write dozens per
function without thinking about the cost. Most of your suite.

**Integration tests** answer the questions a unit test structurally cannot: does this
SQL run, does the unique index exist, does a duplicate insert really produce `23505`,
does the transaction actually roll back. Measured against a real PostgreSQL 18:

```console
code=23505 constraint=orders_sku_key
code=23514 constraint=orders_qty_check
```

You cannot get those two lines from a mock — you can only assert that you *believe*
them. See [page 13](./13-testcontainers.md).

**End-to-end tests** check that the pieces are connected: the app boots, the migration
ran, the reverse proxy points at the right port, the health endpoint answers. A handful
of them, on the critical paths only. They are slow, they are the flakiest thing you
own, and they fail for reasons unrelated to your change.

## The shape that works

Not a pyramid dogma — a budget:

```
many    unit            pure logic, no I/O                     milliseconds
some    integration     one real dependency, per repository    seconds
few     e2e             the happy path of the money flows      minutes
```

The failure mode at each end is real. **All unit tests** ships a suite that is entirely
green against a schema that does not exist. **Mostly e2e** gives you a suite nobody
runs, that takes twenty minutes, and whose failures require an afternoon to diagnose.

## Keep them in separate runs

Integration tests need infrastructure, so they must be selectable:

```json
{
  "scripts": {
    "test": "node --test 'src/**/*.test.mjs'",
    "test:integration": "node --test 'src/**/*.itest.mjs'",
    "test:all": "npm test && npm run test:integration"
  }
}
```

A naming convention beats a tag here, because the runner's tag filter is still
experimental and — measured — **silently matches nothing** if you write `tag:` instead
of `tags:` ([page 14](./14-runner-flags.md)). A glob cannot be silently wrong: it either
matches files or reports zero.

The pre-commit hook runs `test`. CI runs `test:all`.

## What not to do

**Do not mock your own database driver.** The test then asserts that you called
`pool.query` with a string you also wrote in the test — a change detector, not a test.
It goes green when the SQL is invalid.

**Do not write an e2e test for a branch.** "What if the discount code is expired" is a
unit test. Reaching it through HTTP, a browser and a real database costs a thousand
times more and proves the same thing less reliably.

**Do not call an in-memory substitute an integration test.** `better-sqlite3` standing
in for PostgreSQL does not have `ON CONFLICT` semantics, `SKIP LOCKED`, `jsonb`, or the
same SQLSTATEs. It is a fast fake with a database-shaped API — useful, but it proves
nothing about production.

## Gotchas

**Symptom:** Every test passes; the app 500s on the first real request
**Cause:** The data-access layer is fully mocked, so nothing has ever run the SQL.
**Fix:** One integration test per repository against a real database.

**Symptom:** CI takes 20 minutes and people stop reading it
**Cause:** Integration or e2e tests used where unit tests would answer the question.
**Fix:** Move branch and edge-case coverage down to pure functions; keep the expensive
layer for wiring.

**Symptom:** The suite is flaky and reruns "fix" it
**Cause:** e2e tests sharing state, or real timing dependencies.
**Fix:** Reduce the e2e count to the money paths; make the rest deterministic at a lower
layer.

**Symptom:** A test passes against SQLite and fails in production
**Cause:** A substitute engine with different semantics.
**Fix:** Test against the engine you deploy — `postgres:18-alpine` in a container costs
about 6 seconds to start.

## Interview questions

**★ What actually distinguishes a unit test from an integration test?**
What is real behind the code under test. A unit test replaces every dependency; an
integration test keeps one real. Not size, not speed, not how many classes are touched
— those are consequences, not the definition.

**★ When is mocking the wrong choice?**
When the mocked thing is the only thing that could be wrong. A repository function is
mostly SQL; mock the pool and you have asserted that you can build a mock. The rule:
if replacing the dependency removes the risk, don't replace it.

**★ Why not test everything end to end, if that is what users experience?**
Cost and diagnosis. A failing e2e test tells you the system is broken, not where —
and measured here, one container start alone is 5.6 s against 0.22 s for an entire
unit suite. You would trade minutes of feedback for a signal you then have to
investigate anyway.

**★ How do you keep integration tests out of the fast loop?**
Separate them by filename (`*.itest.mjs`) and give them their own script. A glob is
safer than the runner's tag filter, which is experimental and silently matches nothing
if the option key is `tag` rather than `tags`.

**Is an in-memory database good enough for integration tests?**
No. It has different SQL support, different error codes and different concurrency
semantics, so it cannot answer the questions integration tests exist to answer. It is
a fast fake, and worth having as one — but not as evidence.

**Roughly what mix should a backend service have?**
Most tests unit, one integration test per repository and per external boundary, and a
handful of e2e on the flows that cost money if broken. Treat it as a time budget rather
than a ratio to hit.

---

← Prev: [02 · node:assert](./02-node-assert.md) ·
Next → [04 · Writing testable code](./04-testable-code.md)
