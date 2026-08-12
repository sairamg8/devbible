---
title: "Testcontainers — integration tests against a real database"
sidebar_label: "13 · Testcontainers"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `testcontainers` 12.1.0, `pg` 8.23.0,
> `postgres:18-alpine`, **rootless podman 5.8.4**.

**Testcontainers starts a real database from inside your test process and gives you its
connection string.** No `docker-compose up` before the suite, no shared instance that
one developer has migrated and another has not, no port collisions.

## The shape

```js
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {PostgreSqlContainer} from '@testcontainers/postgresql';
import pg from 'pg';

let container, pool;

before(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  pool = new pg.Pool({connectionString: container.getConnectionUri()});
  await migrate(pool);
}, {timeout: 180_000});

after(async () => {
  await pool?.end();
  await container?.stop();
});

test('a duplicate sku is a unique violation', async () => {
  await pool.query('insert into orders (sku, qty) values ($1, $2)', ['ABC', 2]);
  const err = await pool.query('insert into orders (sku, qty) values ($1, $2)',
                               ['ABC', 3]).catch((e) => e);
  assert.equal(err.code, '23505');
  assert.equal(err.constraint, 'orders_sku_key');
});
```

```console
container start: 5585 ms
code=23505 constraint=orders_sku_key
code=23514 constraint=orders_qty_check
✔ a real unique violation, with a real SQLSTATE (5632ms)
✔ a real check constraint (16ms)
✔ per-test rollback keeps tests isolated (19ms)
```

**`23505` with `orders_sku_key`, and `23514` with `orders_qty_check`** — real SQLSTATEs
from a real engine. A mocked pool can only return whatever you already believed.

`getConnectionUri()` carries a random host port, so parallel files and concurrent CI
jobs never collide.

## The cost, measured

| | |
|---|---|
| Container start (warm image) | **5585 ms** and **6355 ms** across two runs |
| Each query afterwards | 15–20 ms |

Roughly **six seconds before the first assertion**. That is why the container starts
once per file in `before`, not per test — and why these tests live in a separate script
from the unit suite ([page 03](./03-unit-integration-e2e.md)).

Give the hook an explicit timeout. `node:test` has no default, but a first-run image
pull can take minutes and you want a clear failure rather than a hang.

## Isolation between tests

The container is expensive; resetting it should not be. **A transaction per test,
rolled back** — verified:

```js
beforeEach(async (t) => {
  t.client = await pool.connect();
  await t.client.query('begin');
});

afterEach(async (t) => {
  await t.client.query('rollback');
  t.client.release();
});

test('does not leak rows', async (t) => {
  await t.client.query("insert into orders (sku, qty) values ('TEMP', 1)");
  const {rows} = await t.client.query('select count(*)::int c from orders');
  assert.equal(rows[0].c, 2);
});
// the row is gone: outside the transaction the count is back to 1
```

Rollback is a few milliseconds; truncate-and-reseed is tens to hundreds. Pass
`t.client` to the code under test — which works only if your repositories accept a
database handle as a parameter ([page 04](./04-testable-code.md)).

Where the code manages its own transactions, this nesting does not work; use truncation
for those files.

## Running under podman

This project uses podman, and Testcontainers assumes Docker. **Two environment
variables are required** — both failure modes measured:

```bash
export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock
export TESTCONTAINERS_RYUK_DISABLED=true
```

Without `DOCKER_HOST`:

```console
Error: Could not find a working container runtime strategy
```

Without disabling Ryuk — the reaper container Testcontainers starts to clean up after a
crashed run:

```console
Error: Log stream ended and message "/.*Started.*/" was not received
```

The second message names nothing useful, which is what makes it expensive. Enable the
socket once per machine:

```bash
systemctl --user enable --now podman.socket
```

With Ryuk disabled, cleanup is entirely your `after` hook's job — so make sure
`container.stop()` runs, and keep `podman container prune -f` in your notes for when a
run is killed mid-flight.

## Other containers

```js
import {RedisContainer} from '@testcontainers/redis';
import {GenericContainer, Wait} from 'testcontainers';

const redis = await new RedisContainer('redis:8-alpine').start();

const wiremock = await new GenericContainer('wiremock/wiremock:3.9.1')
  .withExposedPorts(8080)
  .withWaitStrategy(Wait.forLogMessage(/started/i))
  .start();
const url = `http://${wiremock.getHost()}:${wiremock.getMappedPort(8080)}`;
```

`GenericContainer` handles anything with an image. The wait strategy matters — without
one you connect before the service is listening and get an intermittent
`ECONNREFUSED`.

## When it is not worth it

- **Unit-testable logic.** Six seconds to test a pure function is indefensible.
- **CI without a container runtime.** Some hosted runners cannot run Docker-in-Docker;
  a service container declared in the CI config is the alternative.
- **A shared dev database is fine for exploration** — just never for the suite, because
  it makes tests order-dependent and machine-dependent.

The alternative for a small project is a long-lived container plus a reset script,
which is what `sandbox/README.md` in this repo does. Testcontainers wins when the
lifecycle should be owned by the test run rather than by a person remembering.

## Gotchas

**Symptom:** `Could not find a working container runtime strategy`
**Cause:** No Docker socket; podman's is at a different path.
**Fix:** `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`, and enable
`podman.socket`.

**Symptom:** `Log stream ended and message "/.*Started.*/" was not received`
**Cause:** The Ryuk reaper container cannot start under rootless podman.
**Fix:** `TESTCONTAINERS_RYUK_DISABLED=true`, and clean up in `after`.

**Symptom:** The first CI run times out, later ones pass
**Cause:** The image pull is counted in the hook timeout.
**Fix:** A generous `{timeout}` on `before`; pre-pull the image in a CI step.

**Symptom:** Containers pile up after a killed run
**Cause:** Ryuk is disabled and `after` never ran.
**Fix:** `podman container prune -f`.

**Symptom:** Intermittent `ECONNREFUSED` against a `GenericContainer`
**Cause:** No wait strategy — the port is mapped before the service is listening.
**Fix:** `Wait.forLogMessage(...)` or `Wait.forListeningPorts()`.

**Symptom:** Integration tests are slower than they should be
**Cause:** A container per test, or truncate-and-reseed between tests.
**Fix:** One container per file in `before`; a transaction per test, rolled back.

## Interview questions

**★ What does a real database in tests buy you that a mock cannot?**
Real failures. Measured: a duplicate insert returned `23505` with constraint
`orders_sku_key`, and a violated check returned `23514` — values you can only assert
against a real engine. A mock returns whatever you already believed, including when
your SQL is invalid.

**★ What does it cost?**
About **6 seconds** to start `postgres:18-alpine` on a warm image (5585 ms and 6355 ms
measured), then 15–20 ms per query. Start one container per file in `before`, and keep
these tests in a separate script from the unit suite.

**★ How do you isolate tests inside one container?**
`BEGIN` in `beforeEach`, `ROLLBACK` in `afterEach`, with the checked-out client passed
to the code under test. Milliseconds per test, and the schema stays migrated. It does
not work for code that manages its own transactions.

**★ What does Testcontainers need to run under podman?**
`DOCKER_HOST` pointing at the rootless podman socket, and `TESTCONTAINERS_RYUK_DISABLED=true`.
Without the first: `Could not find a working container runtime strategy`. Without the
second: `Log stream ended and message "/.*Started.*/" was not received` — which names
nothing useful, so it is worth recognising.

**Why a wait strategy on a `GenericContainer`?**
The mapped port exists before the process inside is listening, so without a wait
strategy you get intermittent `ECONNREFUSED`. `Wait.forLogMessage` on the service's own
readiness line is the reliable form.

**When would you not use Testcontainers?**
For anything unit-testable, and on CI runners without a container runtime — a declared
service container is the alternative there. A long-lived local container with a reset
script is also reasonable for a small project.

---

← Prev: [12 · Vitest and Jest](./12-vitest-and-jest.md) ·
Next → [14 · Runner flags](./14-runner-flags.md)
