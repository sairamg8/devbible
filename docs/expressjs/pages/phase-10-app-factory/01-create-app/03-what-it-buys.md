---
title: "What it buys"
sidebar_label: "03 · What it buys"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**A factory buys an app you can build a hundred of, per test, with different
config and substituted collaborators — and it moves everything irreversible into
one entrypoint. That is the whole return, and it is worth naming what it costs.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** The enabling fact is again that an Express app *is* a
> request listener and `app.listen()` is the convenience equivalent of
> `http.createServer(app).listen()`
> ([application reference](https://expressjs.com/en/5x/api/application/)) — which
> is why the same app object serves a test runner, a server and a platform
> adapter unchanged. Everything about process lifecycle — binding, signals,
> connections — is Node's rather than Express's
> ([Node Phase 0](../../../../nodejs/pages/phase-0-runtime-model/README.md)).
> Test mechanics are [page 03](../03-supertest.md); shutdown is
> [page 06](../06-shutdown-and-entrypoint.md); platform adapters are
> [page 07](../07-flags-and-serverless.md). **The trade-off and the migration path
> are this bible's.**

## The division: factory assembles, entrypoint commits

| | `createApp` | the entrypoint |
|---|---|---|
| Runs | once per test, many times | **once per process** |
| Reads the environment | never | yes, and validates it |
| Opens connections | never | yes — pool, cache, queue |
| Binds a port | never | yes |
| Registers signal handlers | never | yes |
| Reversible? | entirely — it is a value | no — it owns the process |

```js
// entrypoint — the only file allowed to be irreversible
const config = loadConfig(process.env);        // parse and validate once
const pool = await createPool(config.db);      // connect once
const app = createApp({config, pool, …});      // assemble
const server = app.listen(config.port);        // bind once
process.on('SIGTERM', () => shutdown(server, pool));
```

Everything that cannot be undone lives in one file that runs once. **That is why
the factory can be called freely** — there is nothing in it to undo
([page 06](../06-shutdown-and-entrypoint.md)).

## What tests can do because of it

```js
// a fresh app per test, with exactly the config this test cares about
const app = createApp({
  config: {...baseConfig, rateLimit: {max: 2}},
  orderService: fakeOrderService,
});

const res = await request(app).get('/api/orders');
```

Four things become possible, and each is awkward-to-impossible without a factory:

1. **Config varies per test** — a limiter of 2 to test 429 without waiting, CORS
   locked to one origin, `trust proxy: false` so a spoofed header cannot pass.
2. **Collaborators are substituted** at the composition root rather than by
   module-mocking, so the test says what it replaces in its own body.
3. **Tests run in parallel**, because nothing binds a port and no two apps share
   state ([chunk 01](01-a-function-of-its-dependencies.md)).
4. **The whole stack is under test** — real middleware, real ordering, real error
   handler — which is what catches mounting mistakes
   ([chunk 02](02-mount-order-is-the-content.md)).

⚠️ **Prefer fakes to mocks at this boundary.** A fake service with in-memory
behaviour exercises the same code path for every test; a mock asserting call
arguments re-encodes the implementation and breaks on refactors that changed
nothing observable. Authorization is the exception where the *real* query must run
([Phase 8 · 07 · chunk 03](../../phase-8-validation-authz/07-ownership/03-status-and-proving-it.md)).

## The same app, three runtimes

Because the app is just a handler, the factory is what makes these three
interchangeable without a rewrite:

```js
const app = createApp(deps);

http.createServer(app).listen(3000);   // a server
request(app).get('/health');           // a test
export const handler = adapt(app);     // a platform adapter
```

🔴 **The serverless case is where the no-side-effects rule pays off unexpectedly.**
A module that connects at import time turns every cold start into a connection
attempt, and a module that binds a port fails outright. A factory whose only
output is a value works on a platform nobody had in mind when it was written
([page 07](../07-flags-and-serverless.md)).

## Trade-off

A factory buys testability — `createApp({fakes})` under Supertest with no database
— and it makes the mount order reviewable in one place. Those two benefits are why
this is the default arrangement for anything with tests.

**It costs a threading problem.** Every dependency must be passed from the
entrypoint through the factory to the router that needs it, and adding one touches
three files. For a very small app that is real overhead, and importing a singleton
is genuinely faster to write.

**The line worth drawing: the moment you want an integration test that does not
touch a real database, you need this.** Before that it is optional — and worth
noticing that "before that" rarely lasts long, because the same threading is what
lets a second environment, a worker, or a platform adapter reuse the app.

⚠️ **The threading cost is real but bounded.** It scales with the number of
*dependencies*, not with the number of routes — a dozen routers sharing four
collaborators still thread four things.

## Migrating an app that already exports a listening server

The common starting point is `app.js` that builds an app, connects, and listens at
module scope. The order that keeps it working throughout:

1. **Extract `createApp`** — move the `express()` call and every `app.use` into a
   function that takes nothing yet and returns the app. The old file calls it.
2. **Move `listen` out**, into an entrypoint that imports the factory. Nothing else
   changes; the process still behaves identically.
3. **Move connections out**, one at a time, passing each client in as a parameter.
   The routers still import their services at this stage — that is fine and
   temporary.
4. **Replace `process.env` reads with a `config` parameter**, parsed and validated
   in the entrypoint.
5. **Convert routers to factories**, resource by resource, so services arrive as
   arguments instead of imports.
6. **Write the first test that builds an app with a fake**, which is the step that
   proves the rest was worth doing.

**Each step leaves the app running**, which matters more than doing it in one
change: the value arrives at step 2 (parallel tests become possible) and grows
from there.

## Gotchas

**Symptom:** A cold start on a serverless platform opens a connection every time
**Cause:** A module connects at import scope
**Fix:** Connect in the entrypoint, or in the adapter's initialisation — never at
module load

**Symptom:** Tests are slow because each one waits for a real rate-limit window
**Cause:** Limiter config baked in rather than injected
**Fix:** Pass config per app; a max of 2 tests the same behaviour instantly

**Symptom:** A refactor broke twenty tests that assert call arguments
**Cause:** Mocks encoding the implementation at the composition root
**Fix:** Fakes with real in-memory behaviour; assert observable results

**Symptom:** The app cannot be reused by a worker or a second entrypoint
**Cause:** Assembly and process lifecycle are in the same module
**Fix:** The factory is a value; only the entrypoint is irreversible

**Symptom:** A migration to the factory pattern stalled half-done
**Cause:** Attempted as one change, so nothing worked until everything did
**Fix:** The six steps above, each of which leaves the app running

**Symptom:** Adding a dependency touches many files
**Cause:** Expected — this is the threading cost
**Fix:** Nothing to fix; it scales with dependencies, not routes. If it hurts, the
app may have too many collaborators rather than too much threading

## Interview questions

**★ What exactly does the factory buy?**
Many apps per process — one per test, with config that varies and collaborators
substituted — plus one file where mount order is reviewable, and the ability to
hand the same app to a server, a test runner or a platform adapter unchanged.

**★ What does it cost, and when is it not worth it?**
It costs threading: every dependency is passed from entrypoint to factory to
router, so adding one touches three files. On a small app with no integration
tests that is real overhead. The moment you want a route test that does not touch
a real database, you need it.

**★ Why does the no-side-effects rule matter on serverless specifically?**
Because a module that connects at import time turns every cold start into a
connection attempt, and one that binds a port fails outright. A factory whose only
output is a value runs on platforms nobody anticipated.

**★ Fakes or mocks for the injected collaborators?**
Fakes. A fake with in-memory behaviour exercises the same code path in every test
and survives refactors; a mock asserting call arguments re-encodes the
implementation and breaks when nothing observable changed. Authorization is the
exception — those tests need the real query.

**How would you migrate an app that connects and listens at module scope?**
Extract the factory first, then move `listen` to an entrypoint, then connections,
then `process.env` to a config parameter, then routers to factories, then write
the first test with a fake. Each step leaves the app running, and the payoff
starts at step two.

**Where do signal handlers and shutdown belong?**
The entrypoint, which runs once. Registering them in the factory leaks one
listener per call — invisible in production, a warning in the test suite.

---

← Prev: [Mount order is the content](02-mount-order-is-the-content.md) · Index: [App factory](README.md) · Next → [Request id middleware](../02-request-id.md)
