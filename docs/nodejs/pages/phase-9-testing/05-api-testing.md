---
title: "API testing — an ephemeral real server, or supertest"
sidebar_label: "05 · API testing"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `supertest` 7.2.2 against `express` 5.2.1.

**Test an HTTP API by making HTTP requests to it.** Not by calling the handler with a
fake `req` and `res` — those objects are streams with dozens of behaviours, and a
hand-rolled double gets the important ones wrong. Boot the real server on an ephemeral
port and use `fetch`, or hand the app to `supertest`.

## Option 1 — a real server on port 0, with `fetch`

`listen(0)` asks the OS for a free port. Read it back from `server.address()`:

```js
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../src/app.mjs';

let server, base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('GET /users/1', async () => {
  const res = await fetch(`${base}/users/1`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.deepStrictEqual(await res.json(), {id: 1, name: 'Ada'});
});

test('POST /users creates and returns Location', async () => {
  const res = await fetch(`${base}/users`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({name: 'Grace'}),
  });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('location'), '/users/2');
});
```

```console
ephemeral port: 38003
✔ GET /users/1 (60.0ms)
✔ POST /users creates and returns Location (16.2ms)
✔ POST /users rejects a missing name (5.7ms)
```

No dependency, and `fetch` is the same client your frontend uses — status, headers and
body are read exactly as a consumer reads them.

**Bind `127.0.0.1`, not `localhost`.** Node resolves DNS `verbatim` by default, so
`localhost` can hand you `::1` first and the connection fails against a server bound to
IPv4. This has cost time in three separate phases of this bible.

## Option 2 — supertest

```js
import request from 'supertest';
import {makeApp} from '../src/app.mjs';

const app = makeApp();          // never .listen()ed

test('health', async () => {
  const res = await request(app).get('/health').expect(200);
  assert.deepStrictEqual(res.body, {ok: true});
});

test('create user', async () => {
  await request(app)
    .post('/users')
    .send({name: 'Grace'})
    .expect('Content-Type', /json/)
    .expect('Location', '/users/7')
    .expect(201, {id: 7, name: 'Grace'});
});
```

Supertest starts the app on an ephemeral port itself, makes the request, and shuts it
down — you never call `listen` or `close`. The chained `.expect()` calls are the draw:
status, headers and body in one expression, with readable failures.

```console
expected 201 "Created", got 422 "Unprocessable Entity"
```

### Which one

| | `fetch` + `listen(0)` | supertest |
|---|---|---|
| Dependency | none | one |
| Lifecycle | you manage `listen`/`close` | managed |
| Assertion style | plain `assert` | chained `.expect()` |
| Works with | anything with a `listen` | anything `http.createServer` accepts |

Both are correct. `fetch` if you would rather not add a dependency and want the client
to be identical to a browser's; supertest if the chained expectations and the automatic
lifecycle are worth one package. Do not use both in one codebase.

## Never hardcode a port

Two test files each binding 3456, run in parallel by the default file concurrency:

```console
✔ serves (51.2ms)
✖ serves (14.5ms)
  Error: listen EADDRINUSE: address already in use 127.0.0.1:3456
ℹ pass 1
ℹ fail 1
```

One passes, one fails, and **which one is a race** — so this reproduces intermittently
in CI and never on the machine of the person asked to fix it. `listen(0)` removes the
class of bug entirely.

## Always close the server

An unclosed listener keeps the event loop alive. Measured: the runner hung until killed
at 6 seconds, exit code 124.

```js
after(() => new Promise((resolve) => server.close(resolve)));
```

`server.close()` stops accepting new connections but **waits for open ones**, including
idle keep-alive sockets. If teardown hangs, use `server.closeAllConnections()` first —
Node 18.2+ — or `closeIdleConnections()` to be gentler.

```js
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
```

`--test-force-exit` also makes it exit, and hides the leak instead of fixing it
([page 14](./14-runner-flags.md)).

## What to assert

The contract, not the implementation:

```js
assert.equal(res.status, 422);                        // status
assert.match(res.headers.get('content-type'), /json/); // shape of the response
assert.equal(body.error.code, 'name_required');        // stable error code, not prose
assert.equal(res.headers.get('location'), '/users/7'); // where the client goes next
```

Asserting on error *prose* makes every copy edit a failing test. Give errors a stable
machine-readable `code` and assert on that — the same discipline as matching
`err.code === '23505'` instead of a driver's message.

## Testing the whole request path

The point of an API test is that the middleware chain runs: body parsing, validation,
auth, error handling. So test through it:

```js
test('rejects an unauthenticated request', async () => {
  const res = await fetch(`${base}/orders`, {method: 'POST'});
  assert.equal(res.status, 401);
});

test('rejects a body over the size cap', async () => {
  const res = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: {'content-type': 'application/json', authorization: `Bearer ${token}`},
    body: JSON.stringify({items: new Array(100_000).fill({sku: 'A'})}),
  });
  assert.equal(res.status, 413);
});
```

Those two cases are exactly what a handler-level unit test cannot reach, because the
behaviour lives in middleware.

## Gotchas

**Symptom:** `EADDRINUSE` in CI, never locally
**Cause:** A hardcoded port and files running in parallel.
**Fix:** `listen(0)` and read `server.address().port`.

**Symptom:** The test suite hangs after the last test
**Cause:** The server was never closed; the listener holds the event loop open.
**Fix:** Close it in `after`. If it still hangs, `closeAllConnections()` first.

**Symptom:** `ECONNREFUSED` against a server you just started
**Cause:** `localhost` resolved to `::1` while the server bound IPv4.
**Fix:** Bind and connect on `127.0.0.1` explicitly.

**Symptom:** Assertions on the response body fail after a copy edit
**Cause:** Asserting on human-readable error text.
**Fix:** Assert on a stable `code` field.

**Symptom:** `res.body` is empty with supertest
**Cause:** No `Content-Type: application/json` on the response, so supertest did not
parse it.
**Fix:** Set the header in the handler — which is a real bug worth the test catching.

## Interview questions

**★ Why boot a real server instead of calling the handler directly?**
Because most of what can break lives between the socket and the handler: body parsing,
validation, auth, error mapping, headers. A fake `req`/`res` skips all of it, and
`req` is a stream with behaviour a hand-written double will get wrong.

**★ What does `listen(0)` do, and why does it matter?**
It asks the OS for any free port, readable afterwards from `server.address().port`. It
makes parallel test files safe — measured, two files sharing a hardcoded port produced
`EADDRINUSE` with a race deciding which failed.

**★ `fetch` or supertest?**
Both correct. `fetch` adds no dependency and exercises the same client a browser uses.
Supertest manages the server lifecycle and gives chained `.expect()` assertions for
status, headers and body. Pick one per codebase.

**★ Why does the suite hang after the tests pass?**
An open handle — usually an unclosed server or a database pool — keeps the event loop
alive. Close it in `after`; `server.close()` waits for open keep-alive connections, so
`closeAllConnections()` may be needed first.

**What should an API test assert on?**
Status, the headers a client acts on (`Content-Type`, `Location`), and a stable error
`code` — not error prose, which changes for editorial reasons and breaks tests that
were not testing anything.

**How do you test middleware behaviour like a body-size cap?**
Through HTTP, since that is the only place the middleware runs. Send an oversized body
and assert `413`.

---

← Prev: [04 · Writing testable code](./04-testable-code.md) ·
Next → [06 · Async testing](./06-async-testing.md)
