---
title: "Making it stick"
sidebar_label: "03 · Making it stick"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**A contract that two-thirds of your routes follow is not a contract. The failure
mode is never the design — it is the one route that answered
`res.status(400).send('bad')`.**

> Verified: 2026-08-14. The mechanisms relied on here are established elsewhere
> and cited inline: error-handler chaining and the `headersSent` guard from
> `router@2.2.0` and `finalhandler@2.1.1`
> ([01 · chunks 01 and 02](../01-error-middleware/01-arity-and-placement.md)), and
> `res.status`'s Express 5 throws from `express@5.2.1`'s `lib/response.js` — all
> in `sandbox/express-verify/node_modules/`. **No sandbox run backs this page and
> it carries no console block.** Everything below is **this bible's guidance**:
> Express provides no enforcement of any response shape, and no way to add one.

## One place creates errors, one place formats them

The contract holds when there is exactly one of each:

```js
// errors.js — the only place an error is constructed
export class AppError extends Error {
  constructor(code, message, {status, details, headers, expose} = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code] ?? 500;
    this.details = details;
    this.headers = headers;
    this.expose = expose ?? this.status < 500;
  }
}

// anywhere in the app
throw new AppError('EMAIL_TAKEN', 'That email is already registered');
```

Everything the handler needs travels **on the error**, from the place that
understood the failure. The handler stays a formatter with no knowledge of the
domain, and adding a new failure mode needs no edit to it
([01 · chunk 03](../01-error-middleware/03-designing-the-handler.md)).

Two properties of that class worth keeping:

- **`status` is derived from `code` by default**, through one table. So the code
  is the thing authors choose and the status follows — which means two routes
  cannot disagree about what `EMAIL_TAKEN` is.
- **`expose` is derived from `status`**, overridable. The default is right almost
  always, and the override exists for the deliberate 5xx
  ([chunk 02](02-what-is-safe-to-expose.md)).

## The four ways the contract leaks

**1 · A route that responds directly.**

```js
if (!order) return res.status(404).send('not found');    // ⛔ text/plain, no code
```

**Grep for it.** `res.status(4` and `res.status(5` outside the error handler is a
short list and worth reading in review. The replacement is always
`throw new AppError(...)`, because the throw is *shorter* — which is the
argument that actually persuades people.

**2 · A library that responds for you.** `express-rate-limit` sends its own body
by default; Passport, `csurf`-style middleware and most auth libraries do too. Each
has a hook — `handler`, `onLimitReached`, a failure callback — and every one of
them should be wired to `next(new AppError(...))` rather than left to its default
([Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md)).

**3 · The default handler, on paths you did not think about.** A 404 never reaches
error middleware, so an unmatched route gets `finalhandler`'s HTML `Cannot GET
/foo` unless you mounted a 404 handler that produces the envelope
([Phase 5 · 06](../06-not-found-and-process.md)):

```js
app.use((req, res) => {
  res.status(404).json({error: {code: 'NOT_FOUND', message: 'No such endpoint', requestId: req.id}});
});
```

**4 · Errors from before your stack.** A body-parser 413, a 415, a malformed
request rejected by Node's parser. The first two *do* reach your handler — as
`http-errors` objects with a `status` and a `type`, which your mapping should
translate into your own codes
([Phase 3 · 02 · chunk 03](../../phase-3-requests/02-json-and-urlencoded/03-errors-and-choices.md)).
The third never reaches Express at all, and the proxy's error page is what the
client sees — which is a reason to keep the proxy's limits *above* yours
([Phase 3 · 03 · chunk 02](../../phase-3-requests/03-size-limits/02-choosing-and-layering.md)).

## Test the contract, not the happy path

The tests that keep this honest are cheap and rarely written:

```js
it('returns the envelope for every documented failure', async () => {
  for (const {request, code, status} of ERROR_CASES) {
    const res = await request(app)[request.method](request.path).send(request.body);
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message', 'requestId']);
    expect(res.body.error.code).toBe(code);
  }
});
```

Three things it asserts that a normal test does not:

- **The content type**, which catches the route that fell through to the HTML
  default.
- **The exact key set**, which catches both a missing field and an accidental
  extra one — the same technique that catches `password_hash` riding along on a
  success response
  ([Phase 10 · 03](../../phase-10-app-factory/03-supertest.md)).
- **A table of cases**, so adding a code means adding a row, and a code with no
  row is visible.

And one more, worth a single test of its own: **an unexpected throw produces the
envelope too.** Mount a route that throws a plain `Error` in a test-only build and
assert the generic 500 shape — that is the path nobody exercises and the one that
leaks.

## Document the codes where clients will look

The codes are an API surface, so they belong in the OpenAPI document, not only in
a comment ([Phase 6 · 08](../../phase-6-rest-surface/08-openapi.md)). One shared
error schema, referenced by every operation, plus an enumeration of the codes
each can return.

The version consequence follows: **changing a code is a breaking change**, in
exactly the way changing a field name is
([Phase 6 · 05](../../phase-6-rest-surface/05-versioning.md)). Adding one is not,
provided clients treat unknown codes as "some failure of this status class" —
which is worth saying explicitly in the documentation, because it is the thing
that lets you add codes later.

## Trade-off

Centralising costs a little indirection: a reader of one route cannot see the
status it returns without opening the code table, and a one-off failure mode
needs a new entry rather than three inline lines.

**That indirection is the point.** It is what makes the status of `EMAIL_TAKEN`
the same in every route, what lets you rewrite every message without a client
noticing, and what makes "does this API always return JSON errors" a question
with an answer.

The genuine cost is at the edges: **third-party middleware**, which each needs
wiring, and **the 404 path**, which is not an error and so needs its own handler.
Neither is expensive; both are forgotten.

## Gotchas

**Symptom:** One endpoint returns `text/plain` for errors
**Cause:** A route that called `res.status(400).send('bad')` directly
**Fix:** `throw new AppError(...)`. Grep for `res.status(4` and `res.status(5`
outside the error handler

**Symptom:** Rate-limit responses have a different shape from everything else
**Cause:** The library's default handler
**Fix:** Wire its `handler` option to `next(new AppError('RATE_LIMITED', …))`

**Symptom:** An unknown URL returns an HTML page
**Cause:** A 404 is not an error, so it never reaches your handler; `finalhandler`
answered
**Fix:** A three-argument 404 handler below the routes that emits the envelope

**Symptom:** A 413 has a different `code` shape from your other errors
**Cause:** body-parser's `http-errors` object passed through unmapped
**Fix:** Translate `err.type` into your own codes in the handler

**Symptom:** Adding an error code broke a client
**Cause:** The client treated unknown codes as fatal
**Fix:** Document that clients must handle unknown codes by status class — and
never *reuse* a code, which is the change that breaks them silently

**Symptom:** The contract test passes and production still returns HTML sometimes
**Cause:** The tests only exercise handled failures; nothing throws an unexpected
error
**Fix:** One test that triggers a plain `throw` and asserts the generic 500 shape

## Interview questions

**★ Why should errors be constructed in one place?**
So that `code`, `status`, `expose` and `headers` are derived consistently and the
handler stays a formatter with no domain knowledge. Adding a failure mode then
needs no edit to the handler, and two routes cannot disagree about what a code
means.

**★ Where does an error contract usually leak?**
Four places: a route that responds directly, third-party middleware with its own
default response, the 404 path (which is not an error and never reaches your
handler), and errors raised before your stack — a body-parser 413, or a request
Node's parser rejected outright.

**★ How do you test that the contract holds?**
A table-driven test asserting, for every documented failure: the status, a JSON
content type, and the **exact key set** of the error object. Plus one test that
triggers an unexpected `throw` and asserts the generic 500 shape — that is the
path nobody exercises and the one that leaks.

**★ Is adding a new error code a breaking change?**
Not if clients are documented to handle unknown codes by status class — and that
sentence has to be in the documentation for it to be true. **Reusing** a code for
a different meaning always is, and it breaks silently: the client's branch still
matches and now does the wrong thing.

**Why derive `status` from `code` rather than passing both everywhere?**
Because two routes throwing the same code with different statuses is a bug nobody
notices. One table means the code is the decision and the status follows.

**What do you do about a library that sends its own error body?**
Wire its failure hook to `next(new AppError(...))`. Every serious middleware has
one — `handler` on the rate limiter, a failure callback on auth middleware — and
the default is only there for apps with no contract of their own.

---

← Prev: [What is safe to expose](02-what-is-safe-to-expose.md) · Index: [Error contract](README.md) · Next topic → [Mapping to HTTP](../04-mapping-to-http.md)
