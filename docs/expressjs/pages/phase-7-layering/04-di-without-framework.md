---
title: "Dependency injection without a framework"
sidebar_label: "04 · DI without framework"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Pass dependencies into router factories. Do not import a global `db` singleton from every file if you care about tests.**

> Verified: 2026-08-14 — **no sandbox run**. Express has **no dependency-injection
> container** and needs none; the pattern is a plain closure. What makes it work is
> documented: `express.Router()` *"creates a new router object"* that is *"a complete
> middleware and routing system"*, and it is mounted with `app.use('/prefix', router)`
> ([routing guide](https://expressjs.com/en/guide/routing.html)) — so a **function
> returning a router** is the whole mechanism. Express's own built-ins follow the same
> shape: `express.json({limit})` and `express.static(root, options)` are called for their
> return value, which the docs describe as *"configurable middleware"* — a module that
> *"exports a function which accepts an options object and returns the middleware
> implementation"* ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
> You are not inventing a convention; you are using Express's.

```js
export function usersRouter({userService}) {
  const r = express.Router();
  r.get('/', async (req, res) => {
    res.json(await userService.list());
  });
  return r;
}

// createApp({userService}).use('/users', usersRouter({userService}))
```

Phase 10 completes composition with `createApp(deps)`.

## What the import-a-singleton version actually costs

`import {db} from '../db.js'` in every file is not merely untidy. Four concrete
consequences, and all of them show up as something other than "our DI is bad":

1. **Importing a module connects to a database.** Module-level `const db =
   createPool(...)` runs on import, so *any* test that imports *any* file touches
   the real connection — including a unit test for a pure function three modules
   away.
2. **Tests cannot substitute anything** without module-mocking hacks that break
   whenever the import graph moves.
3. **Boot order becomes implicit.** Whichever module is imported first wins, and
   nothing declares that the pool must exist before the router.
4. **Two instances become impossible.** A second tenant, a read replica, or a
   test fixture with its own pool has nowhere to live, because the dependency is a
   file path rather than a value.

Point 1 is the one that produces the confusing symptom: a test suite that "hangs"
after the tests pass, because an open pool nobody asked for is keeping the process
alive.

## The whole pattern, in one shape

Every layer is a function taking its dependencies and returning the thing:

```js
// repository
export const makeUserRepo = (db) => ({ /* … */ });

// service
export const makeUserService = ({userRepo, hasher, clock}) => ({ /* … */ });

// router
export function usersRouter({userService}) {
  const r = express.Router();
  r.get('/', async (req, res) => res.json(await userService.list()));
  return r;
}

// composition root — the ONE place that knows real implementations
const db = createPool(config.databaseUrl);
const userRepo = makeUserRepo(db);
const userService = makeUserService({userRepo, hasher: bcryptHasher, clock: systemClock});
app.use('/users', usersRouter({userService}));
```

No container, no decorators, no reflection — just closures. And one rule that
carries the design: **only the composition root constructs anything.** The moment
a service reaches for a real implementation itself, it is a singleton import
wearing a factory's clothes.

## Inject the awkward things too

The dependencies people remember are the database and the queue. The ones that
cause flaky tests are smaller:

| Dependency | Why inject it |
|---|---|
| **`clock`** | `Date.now()` inside a service means time-dependent tests, and "expires in 24h" cannot be tested without waiting |
| **`uuid`** | Random ids make assertions awkward; an injected generator makes them exact |
| **`logger`** | Tests can assert on it, and a per-request child logger with the request id becomes possible |
| **Config values** | A service reading `process.env` directly cannot be instantiated twice with different settings |

A service whose only non-determinism is injected is a service you can test with
plain assertions and no mocking library at all.

## Trade-off

Explicit injection means the composition root grows into a long, boring file that
wires everything — and every new dependency is threaded through by hand. That is
genuinely more typing than importing a singleton, and on a small app it can feel
like ceremony.

What it buys is that **dependencies are visible in signatures**: reading
`makeUserService({userRepo, hasher, clock})` tells you exactly what it touches, and
the compiler or the test tells you when that changes. Singleton imports hide the
same information in a scattered import graph, and you discover it by breaking
something.

A DI *container* would automate the wiring and cost you that visibility, plus a
runtime resolution step that fails at startup instead of at compile time.
**Closures are the right amount of machinery for Express**; reach for a container
only if the graph genuinely outgrows a readable file.

## Gotchas

**Symptom:** The test suite hangs after tests pass  
**Cause:** A module-level pool created at import time, keeping the event loop alive  
**Fix:** Construct connections in the composition root and close them in teardown

**Symptom:** A unit test for pure logic connects to the database  
**Cause:** The import graph pulled in a module that connects on import  
**Fix:** No side effects at module load. Export factories, construct at composition

**Symptom:** Tests pass alone and fail together  
**Cause:** Shared singleton state carried between tests  
**Fix:** Build a fresh graph per test — cheap when everything is a factory

**Symptom:** A service imports the concrete repository "just this once"  
**Cause:** The composition-root rule broke  
**Fix:** Dependencies arrive as arguments, always. One exception becomes the norm

**Symptom:** A test needs to wait for a token to expire  
**Cause:** `Date.now()` called inside the service  
**Fix:** Inject a clock; advance it in tests

## Interview questions

**★ Why inject the DB instead of importing it?**  
Tests substitute fakes; boot order stays explicit.

**★ What actually goes wrong with a module-level `const db = createPool()`?**  
It connects on import — so any test importing anything in that graph opens a real
connection, and the suite often hangs afterwards because the pool keeps the loop
alive. It also makes boot order implicit and a second instance impossible.

**★ Do you need a DI container for this?**  
No. A function taking dependencies and returning a router is the entire pattern, and
it is the same shape Express's own built-ins use — `express.json(options)` is called
for its return value. A container adds runtime resolution and hides the graph.

**Which dependencies do people forget to inject?**  
Clock, id generator, logger and config. They are the usual cause of flaky,
time-dependent or unassertable tests, and each is a one-line injection.

**What is the composition root, and what is its rule?**  
The single place that constructs real implementations and wires them together.
The rule: nothing else constructs anything. One exception and you are back to
singletons.


---

← Prev: [Fat controllers](03-fat-controllers.md) · Next → [Jobs from routes](05-jobs-from-routes.md)
