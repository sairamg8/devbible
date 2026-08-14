---
title: "Error logging at the edge"
sidebar_label: "07 · Error logging"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

**The error handler is the last place that knows both the failure and the
request. Log the pair — and never log the things that make a log file a breach.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> What Express supplies is the *position*: a four-arg handler that is
> [*"defined last, after other `app.use()` and routes calls"*](https://expressjs.com/en/guide/error-handling.html)
> and therefore sees every request-scoped failure in one place, with `req` still in
> scope. The fields available to log are documented on the
> [request reference](https://expressjs.com/en/5x/api/request/) — `req.method`,
> `req.originalUrl`, `req.baseUrl`, `req.path`, `req.ip`, `req.get()`.
> **Express has no logger.** It ships six built-in middleware and none of them logs
> ([express reference](https://expressjs.com/en/5x/api/express/)); `morgan`, `pino` and
> friends are packages under
> [Resources → Middleware](https://expressjs.com/en/resources/middleware/).
> The *what-not-to-log* list below is security reasoning, not an Express rule — treat it
> as this bible's guidance.

## Why the error handler is the right place

Anywhere else, you have half the picture. A `catch` inside a service knows what
failed but not who asked; a process-level handler knows neither. The four-arg
handler is the only point in an Express app that holds **the error and the
request at the same time**, and it runs exactly once per failed request.

That last part matters more than it sounds. Logging in every `catch` on the way
up produces four lines for one failure, each with a fragment of the story, and
none of them countable. **One failure, one log line.**

```js
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;

  logger[status >= 500 ? 'error' : 'warn']({
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,      // path as sent, including the mount prefix
    status,
    code: err.code,
    ip: req.ip,
    userId: req.user?.id,       // an id, never the user object
    err,                        // full error incl. stack — server-side only
  });

  res.status(status).json(toEnvelope(err, status));
});
```

## What to log

| Field | Why it earns a place |
|---|---|
| **Request id** | The only thing that ties this line to the user's report and to the rest of the request's logs |
| `method` + `originalUrl` | *What* was asked. `originalUrl` over `path` — inside a mounted router `path` has already lost the prefix |
| `status` | Lets you count and alert without parsing messages |
| `code` | Your stable error code — groups failures that share a cause |
| `err` with stack | The reason. **Server-side only**; this is the part that never goes in a response |
| `ip`, `userId` | Who. An id, not a profile |
| Duration | Turns a timeout into an obvious one |

**Log the error object, not `err.message`.** A stringified message discards the
stack and the `cause` chain — the two things you will actually want at 3am.
Structured loggers serialise `Error` properly; `console.log(err.message)` throws
away the evidence.

## What must never be logged

A log file is read by more people, kept longer, and shipped to more third parties
than any database. Everything below has caused a real breach somewhere:

- **Passwords, tokens, API keys, session ids** — including inside a logged request
  body, and including the `Authorization` and `Cookie` headers. Redact by
  allow-list, not by blocklist: log the three headers you need, not "everything
  except the ones I thought of".
- **Full request bodies on failed writes.** That is where card numbers and personal
  data live. Log the shape or the failing field name, not the values.
- **Personal data as identifiers** — email addresses, phone numbers, names. Log the
  user id and join later if you genuinely need the rest.
- **Query strings, unfiltered.** Password reset tokens and signed URLs travel there.
- **Anything you would have to explain in a subject-access request.**

The trap is that none of this is deliberate. Nobody writes `logger.info(password)`;
they write `logger.info({body: req.body})` on a login route, and the password is
in the body. **Redaction belongs in the logger's configuration**, so it survives
the next person who logs an object without thinking.

## Levels, and why they are not cosmetic

From [page 05](05-operational-vs-programmer.md): operational and programmer errors
want different treatment, and the level is how you express it.

| Status | Level | Because |
|---|---|---|
| 4xx | `warn` or `info` | Expected. Interesting in aggregate, not individually |
| 5xx | `error` | A bug or an outage. Every one deserves a look |

Get this wrong in the safe-looking direction — everything at `error` — and the
log becomes undifferentiated noise, the alert becomes something people mute, and
a real 500 sits unnoticed among four thousand 404s.

## Trade-off

Rich structured logs are what make an incident tractable: you can group by `code`,
count by `status`, and follow one request id through every service it touched. They
cost storage, they cost a serialisation step on a hot path, and every field is a
field that might one day contain something it shouldn't.

Minimal logs are cheap and safe and tell you nothing at 3am. **Log richly and
redact aggressively** — the answer is a redaction allow-list in the logger, not
fewer fields.

## Gotchas

**Symptom:** One failure produces four log lines from four layers  
**Cause:** Every `catch` on the way up logs before rethrowing  
**Fix:** Catch to *add context*, log once — in the error handler. If an intermediate
layer knows something useful, attach it to the error (`err.cause`, a field), do not
print it

**Symptom:** A password appears in the log after a failed login  
**Cause:** `logger.error({body: req.body})` on the auth route  
**Fix:** Configure redaction in the logger for `password`, `token`, `authorization`,
`cookie` and friends, so it applies regardless of who logs what

**Symptom:** Logs show `path: '/'` for every error in a mounted router  
**Cause:** `req.path` is relative to the mount point — `/api/users/42` inside a router
mounted at `/api/users` is just `/42`, and `/` for the index route  
**Fix:** Log `req.originalUrl`

**Symptom:** The stack trace is missing from production logs  
**Cause:** `err.message` was logged instead of `err`, or a logger serialising `Error` as
`{}` (its properties are non-enumerable)  
**Fix:** Pass the error object to a logger that has an error serialiser configured

**Symptom:** You cannot correlate a user's report with anything  
**Cause:** No request id, or one generated in the log line rather than per request  
**Fix:** Assign an id in early middleware, put it on `req`, log it everywhere, and return
it in the error envelope ([page 03](03-error-contract/README.md))

**Symptom:** Alerting fires constantly and everyone has muted it  
**Cause:** 4xx logged at `error`  
**Fix:** Level by status class. Alert on 5xx rate, not on error-log volume

## Interview questions

**★ Where should an Express app log its errors, and why there?**  
In the four-arg error handler. It is the only place that has the error *and* the
request together, and it runs once per failed request — so one failure produces one
line, which is what makes logs countable.

**★ Name four things that must never reach a log.**  
Credentials of any kind (passwords, tokens, API keys, session ids), the
`Authorization` and `Cookie` headers, full request bodies on auth or payment routes,
and personal data used as an identifier. Redact by allow-list in the logger config,
not by remembering at each call site.

**★ Why log the error object rather than `err.message`?**  
The message discards the stack and the `cause` chain. Note that `Error` properties
are non-enumerable, so a naive serialiser renders it as `{}` — you need a logger with
an error serialiser, not just the object.

**Why `req.originalUrl` instead of `req.path`?**  
Inside a mounted router, `path` has the mount prefix stripped — an error in a router
mounted at `/api/users` logs as `/42`, or `/` for the index. `originalUrl` is the URL
as the client sent it.

**What is a request id for, if the log already has a timestamp?**  
Correlation. It links this line to every other line from the same request (and the
same trace across services), and it is the one identifier safe to hand back to a user
so their report becomes a lookup instead of a search.

**Should 404s be logged as errors?**  
No — `warn` or `info`. Individually they are routine; the value is in the aggregate.
Logging them at `error` buries the 500s that need a human.

---

← Prev: [404 and process errors](06-not-found-and-process.md) · Index: [Phase 5](README.md)
