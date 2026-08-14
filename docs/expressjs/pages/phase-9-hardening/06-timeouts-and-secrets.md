---
title: "Timeouts and secrets at the edge"
sidebar_label: "06 · Timeouts · secrets"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**Request timeout middleware is a soft deadline. Deep budgets are Node Phase 7. Secrets never live in middleware source.**

> Verified: 2026-08-14 — **no sandbox run**. Express provides **no timeout middleware**;
> the timeouts that exist belong to Node's HTTP server —
> `server.requestTimeout`, `server.headersTimeout`, `server.keepAliveTimeout`
> ([`node:http`](https://nodejs.org/api/http.html)) — and they abort the *connection*,
> which is a different thing from the soft deadline described below.
> The word "soft" is load-bearing and the reason is an Express fact from
> [Phase 4](../phase-4-responses/04-headers-already-sent.md): once the response has begun,
> `res.headersSent` is true and no timeout can turn it into a 503.
> **Nothing in Express or Node cancels a running handler** — there is no thread to kill and
> no cancellation of an in-flight `await`. Config validation and the 12-factor argument are
> [Node Phase 11](../../../nodejs/pages/phase-11-deployment/README.md).

Fail boot if required env is missing (Node 12-factor). Edge code only reads `process.env` via a validated config module.

## A timeout middleware does not stop the work

The honest description: it **stops waiting**, and answers the client. The handler
keeps running.

```js
export function deadline(ms) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503)
           .set('Retry-After', '5')
           .json({error: {code: 'TIMEOUT'}});
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
```

What this buys is a **bounded client experience** — nobody waits forever, and a
stuck dependency does not hold browser connections open.

What it does not buy, and must not be assumed:

- The database query continues, still holding its pooled connection.
- The external HTTP call continues, still consuming a socket.
- The handler will eventually try to respond and hit `headersSent` — hence the
  guard, and the `res.headersSent` check in the error handler
  ([Phase 5](../phase-5-errors/01-error-middleware.md)).
- **Under sustained overload the process gets worse, not better**: you have added
  timeouts while the work continues to accumulate.

**Real cancellation happens at the resource**, not at the edge: statement timeouts
on the database, `AbortSignal` on outbound `fetch`, per-dependency budgets. Those
are Node Phase 6 and 7. The edge deadline is a courtesy to the client and a
diagnostic, and calling it protection is where people get it wrong.

## Layer the timeouts, and keep them ordered

Four different things can time out, and the order matters:

| Timeout | Owner | Should be |
|---|---|---|
| Client / browser | The caller | Longest |
| Proxy or load balancer | Nginx, ALB | Longer than the app's |
| **App deadline** | This middleware | The user-visible promise |
| **Dependency timeouts** | DB statement, `fetch` signal | **Shortest** |

If a dependency's timeout is longer than the app's deadline, the app gives up first
and the dependency keeps working — the leak described above. If the proxy's is
shorter than the app's, the proxy returns 504 and your deadline never fires,
producing an error page you did not write and cannot instrument.

**Set them deliberately, inside-out.**

## Config: validate once, at boot

```js
// config.js — the ONLY module that reads process.env
const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']),
});

export const config = schema.parse(process.env);   // throws at import → boot fails
```

Three properties worth having, and they follow from doing it in one place:

1. **Fail fast.** A missing `SESSION_SECRET` stops the deploy instead of producing
   500s an hour later when the first login arrives.
2. **One reader.** `process.env` appearing anywhere else is a lint rule you can
   enforce — and it means a missing variable cannot hide in a rarely-taken branch.
3. **Typed and coerced.** `PORT` is a number; the same coercion discipline as
   [Phase 8](../phase-8-validation-authz/03-coercion-traps.md), for the same reason.

**Never default a secret.** `process.env.SESSION_SECRET ?? 'dev-secret'` ships a
known signing key to production the first time someone forgets to set it — and
nothing fails, which is precisely the problem. Defaults are for ports and log
levels, never for credentials.

## Secrets: what "not in source" actually means

Not in code is the easy half. The rest:

- **Not in the repository at all** — including `.env` files, fixtures and test
  configs. Git remembers, so a committed secret is compromised even after the
  deleting commit.
- **Not in logs.** The most common leak is a config object logged at startup for
  debugging ([Phase 5](../phase-5-errors/07-error-logging.md)).
- **Not in error responses.** A connection string in a 500 body is a schema and a
  credential in one line.
- **Not in the client bundle.** Anything a front-end build inlines is public,
  whatever it is named.
- **Rotatable.** A secret that cannot be rotated without a code change will not be
  rotated.

`config` objects are especially prone to the logging leak because they look
harmless. Redact at the logger, so it holds regardless of who logs what.

## Trade-off

An edge deadline gives every request a bounded lifetime and a response you control,
which is worth having — a user seeing a clean 503 beats a hanging tab, and the
metric tells you which routes are slow.

It costs the illusion of protection. Teams add it, see 503s instead of hangs, and
conclude the incident is handled while the pool is still draining. **Pair every edge
deadline with a real dependency timeout, or you have added a symptom filter.**

For config, strict boot validation trades deploy-time failures for runtime ones —
deliberately. A container that refuses to start is a rollback; a container that
starts and fails on the first login is an incident. Take the loud failure.

## Gotchas

**Symptom:** Timeouts fire but the process keeps degrading  
**Cause:** The middleware stops waiting; the query and the pooled connection continue  
**Fix:** Statement timeouts and `AbortSignal` at the dependencies. The edge deadline is
not cancellation

**Symptom:** `Cannot set headers after they are sent` from a timed-out request  
**Cause:** The handler finished after the timeout already responded  
**Fix:** Guard with `res.headersSent` in both the timer and the error handler

**Symptom:** Clients see a 504 you did not generate  
**Cause:** The proxy's timeout is shorter than the app's deadline  
**Fix:** Order them: dependencies < app < proxy < client

**Symptom:** Production runs with a development signing secret  
**Cause:** `process.env.SECRET ?? 'dev-secret'` — the default silently applied  
**Fix:** No defaults for secrets. Missing means boot fails

**Symptom:** A database URL with credentials appears in the logs  
**Cause:** The config object logged at startup  
**Fix:** Redact in the logger configuration, not at each call site

**Symptom:** The app starts, then fails on the first request touching a missing variable  
**Cause:** `process.env` read lazily, deep in a module  
**Fix:** One config module, parsed at import, so the failure is at boot

## Interview questions

**★ Why validate env at boot, not on first request?**  
Fail fast before taking traffic.

**★ What does a request-timeout middleware actually stop?**  
The waiting, not the work. It responds to the client; the query, the connection and
the outbound call all continue. Nothing in Express or Node cancels a running handler —
there is no thread to kill and no cancellation of an in-flight `await`.

**★ In what order should timeouts be set?**  
Inside-out: dependency timeouts shortest, then the app deadline, then the proxy, then
the client. A dependency timeout longer than the app deadline leaks work; a proxy
timeout shorter than the app deadline means your handler never gets to answer.

**★ What is wrong with `process.env.SESSION_SECRET ?? 'dev-secret'`?**  
It ships a known signing key to production the first time the variable is missing —
and nothing fails, so nobody notices. Ports and log levels may have defaults;
credentials may not.

**Where do secrets leak from, besides source code?**  
Committed `.env` files (git remembers), config objects logged at startup, error
responses containing connection strings, and anything inlined into a client bundle.

**Why funnel all `process.env` reads through one module?**  
So the failure is at boot rather than in a rarely-taken branch, so the values are
typed and coerced once, and so "who reads the environment?" has one answer you can
lint for.

---

← Prev: [CSRF and injection surfaces](05-csrf-and-injection.md) · Index: [Phase 9](README.md)
