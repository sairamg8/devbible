---
title: "Feature flags and serverless adapters"
sidebar_label: "07 · Flags · serverless"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

**Two things the app factory makes possible, both worth knowing exist and neither
worth studying before a project asks: toggling routes at mount time, and handing
the app to a platform that has no `listen`.**

> Verified: 2026-08-14 — **no sandbox run**. Neither topic is an Express feature: there
> is no flag system and no serverless mode. Both work for one documented reason —
> `express()` returns an application that **is a request listener**, with `app.listen()`
> documented as a convenience equivalent to `http.createServer(app).listen()`
> ([application reference](https://expressjs.com/en/5x/api/application/)). An app that
> never listens is a complete handler, which is what an adapter wraps and what
> [Supertest](03-supertest.md) already exploits.
> Mount-time toggling is just conditional `app.use`, resting on middleware executing
> *"in the order they are defined"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
> Adapters (`serverless-http` and platform equivalents) are third-party packages;
> deployment topics are
> [Node Phase 11](../../../nodejs/pages/phase-11-deployment/README.md).

## Mount-time flags versus request-time flags

The distinction decides which one you can use, and they are not interchangeable.

```js
// mount-time — evaluated once, at boot
if (config.features.reporting) {
  app.use('/api/reports', reportsRouter(deps));
}

// request-time — evaluated per request, per user
router.get('/beta', (req, res, next) =>
  flags.enabled('new-checkout', req.user) ? handler(req, res, next) : next(),
);
```

| | Mount-time | Request-time |
|---|---|---|
| Changes take effect | On **restart** | Immediately |
| Per-user targeting | No | Yes |
| Cost per request | **Zero** — the route does not exist | A flag lookup |
| Good for | Killing a whole surface, environment differences, unfinished modules | Gradual rollout, A/B, per-tenant behaviour |

**Mount-time is the one this phase is about**, because it is a property of the
factory: `createApp` takes config and assembles a different app. It is genuinely
useful for keeping an unfinished module out of production entirely — the route does
not exist, so it cannot be reached by guessing the URL, which is a stronger
statement than a handler that returns 404.

Request-time flags are a product concern with a whole ecosystem behind them, and
they belong wherever your flag provider lives — not in the mount.

The trap in the mount-time version: **a disabled route returns 404, which is
indistinguishable from a typo**, so a client seeing 404 cannot tell "not yet
released" from "wrong URL". If that distinction matters, mount a stub that answers
501 Not Implemented instead of omitting the route.

## Serverless: what the adapter actually does

A serverless platform hands you an event object and expects a response object. It
never calls `listen`, because there is no persistent process to listen with. An
adapter translates:

```js
// handler.js
import serverless from 'serverless-http';
import {createApp} from './app.js';

export const handler = serverless(createApp(deps));   // deps built at module scope
```

`createApp` is already the right shape — this is the payoff for
[page 01](01-create-app.md)'s rule. An app that called `listen` internally could not
be adapted at all.

Four things change once there is no long-lived process, and they are the reason
this is *When Needed* rather than *Know*:

1. **Cold starts.** The module is evaluated per cold start, so anything expensive
   at module scope is paid repeatedly. Connection pools in particular behave badly:
   many short-lived instances each holding a pool exhausts the database's
   connection limit — this is what connection proxies exist for.
2. **No graceful shutdown.** [Page 06](06-shutdown-and-entrypoint.md)'s entire
   sequence has no counterpart. The platform freezes or discards the instance, and
   background work started but not awaited simply dies — which makes the floating
   promise from [Phase 7](../phase-7-layering/05-jobs-from-routes.md) worse than
   usual.
3. **No shared in-memory state.** Rate limiter counters, caches and session stores
   in process memory are per-instance and short-lived
   ([Phase 9](../phase-9-hardening/04-rate-limiting.md)). Everything must be
   external.
4. **Payload and duration limits.** Streaming responses, long-running requests and
   large uploads run into platform ceilings that a normal server does not have.

**None of these are Express problems**, and Express does not solve any of them. It
runs; the operational model around it is different.

## When Express-on-serverless is the wrong shape

Worth saying, because the adapter makes it look free: putting a whole Express app
behind one function means every request pays the framework's startup and routing on
a platform that charges by execution. If the workload is genuinely a handful of
event-driven functions, native handlers are a better fit.

The adapter earns its place when you have an **existing** Express app and want to
deploy it somewhere serverless without a rewrite, or when you want one codebase
that runs both ways — a container in production, a function for previews. Both are
real and common; "we are building a new API, let us start with serverless Express"
usually is not.

## Trade-off

Mount-time flags cost nothing at runtime and require a deploy to change — which is
either a safety feature or an obstacle depending on why you are toggling. They also
make the app's shape configuration-dependent, so "which routes exist?" acquires the
answer "it depends", and a bug reproducible only with one flag combination is
genuinely hard to chase. **Keep the number of mount-time flags small and delete them
once the feature ships**; the failure mode is a factory with fifteen conditionals
that nobody dares simplify.

Serverless buys scale-to-zero and no servers to operate, and costs cold starts, the
connection-pool problem, and the loss of every long-lived-process assumption this
phase spent pages establishing. **Take it when the deployment target is already
serverless, not to make an Express app better.**

## Gotchas

**Symptom:** A disabled route returns 404 and clients report a broken endpoint  
**Cause:** Mount-time flag omitted the route entirely  
**Fix:** Mount a stub returning 501 when "not released" must be distinguishable from
"wrong URL"

**Symptom:** A bug reproduces only in one environment  
**Cause:** Different flag values producing a different app shape  
**Fix:** Log the resolved flag set at boot, so the app's shape is visible in the logs

**Symptom:** The database hits its connection limit under serverless load  
**Cause:** Many short-lived instances each holding a pool  
**Fix:** A connection proxy, or a single connection per instance — not a pool

**Symptom:** Background work started in a handler never completes on serverless  
**Cause:** The instance is frozen or discarded after the response  
**Fix:** Enqueue to a real queue; a floating promise has no process to finish in

**Symptom:** Rate limits do not work on serverless  
**Cause:** In-memory counters, per-instance and short-lived  
**Fix:** An external store — the same fix as multi-instance containers

**Symptom:** Streaming responses truncate on the platform  
**Cause:** Payload or duration limits  
**Fix:** Platform constraint, not an Express one — offload to object storage or signed URLs

## Interview questions

**★ What is the difference between a mount-time and a request-time feature flag?**
Mount-time is evaluated once at boot — the route either exists or does not, so it costs
nothing per request and needs a restart to change. Request-time is evaluated per request
and can target a user, at the cost of a lookup. Only mount-time is a property of the app
factory.

**★ Why can an Express app be deployed to a serverless platform at all?**
Because an app *is* a request listener; `listen` is a convenience, not a requirement. An
adapter translates the platform's event into a request and the response back — the same
property Supertest relies on, and the reason the factory must never call `listen` itself.

**★ What breaks about this phase's assumptions on serverless?**
Graceful shutdown has no counterpart, in-memory state (rate limits, caches) is
per-instance and short-lived, cold starts pay module-scope cost repeatedly, and
connection pools across many instances exhaust the database. None are Express problems,
and Express solves none of them.

**When is the serverless adapter the right choice?**
When you have an existing Express app and a serverless deployment target, or want one
codebase running both ways. Building a new event-driven system is usually better served
by native handlers than by a whole framework behind one function.

**What is the downside of a route that a mount-time flag removed?**
It returns 404, which a client cannot distinguish from a typo. Mount a 501 stub if the
difference matters.

**How do you keep mount-time flags from accumulating?**
Delete them when the feature ships, and log the resolved flag set at boot so the app's
shape is visible. A factory with fifteen conditionals is one nobody will simplify later.

---

← Prev: [Shutdown and entrypoint](06-shutdown-and-entrypoint.md) · Index: [Phase 10](README.md)
