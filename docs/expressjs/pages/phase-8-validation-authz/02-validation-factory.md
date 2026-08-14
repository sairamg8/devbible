---
title: "Validation middleware factory"
sidebar_label: "02 · Validation factory"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**`validate({body, params, query})` returns middleware. On failure: 400 with stable codes. On success: attach parsed data.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The factory shape is Express's own convention, not a community invention: the docs
> describe *"configurable middleware"* as a module that *"exports a function which accepts
> an options object and returns the middleware implementation"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), which is
> exactly what `validate(schemas)` is. Attaching the result relies on middleware being
> able to *"modify the request and response objects"* — and since Express publishes **no
> reserved-name list** ([Phase 2](../phase-2-middleware/06-mutating-req-res.md)), the
> namespaced `req.validated` matters. Passing the error to `next(err)` with a
> `statusCode` works because Express's own default handler reads
> `err.status`/`err.statusCode` ([error handling](https://expressjs.com/en/guide/error-handling.html)).
>
> ⚠️ **One Express 5 constraint the code below depends on**, quoted from the
> [migration guide](https://expressjs.com/en/guide/migrating-5.html): *"the `req.query`
> property is no longer a writable property and is instead a getter."* Assigning to it
> throws. That is why the parsed result goes on `req.validated` rather than replacing
> `req.query` in place — which is what most Express 4 tutorials do, and a common upgrade
> break.

```js
// shape — use real Zod in the app
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.validated = { ...req.validated, body: schemas.body.parse(req.body) };
      if (schemas.params) req.validated = { ...req.validated, params: schemas.params.parse(req.params) };
      if (schemas.query) req.validated = { ...req.validated, query: schemas.query.parse(req.query) };
      next();
    } catch (err) {
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      next(err);
    }
  };
}
```

Schemas themselves are Understand-level library surface; the factory and boundary habit are Master.

## Report every error, not the first

The sketch above throws on the first failing section, which produces a form that
rejects one field at a time — the user fixes the email, resubmits, and learns the
password is too short. Parse all three sections, collect the issues, and answer once:

```js
export function validate(schemas) {
  return (req, res, next) => {
    const validated = {};
    const issues = [];

    for (const section of ['body', 'params', 'query']) {
      if (!schemas[section]) continue;
      const result = schemas[section].safeParse(req[section]);
      if (result.success) validated[section] = result.data;
      else issues.push(...result.error.issues.map((i) => ({
        section,
        path: i.path.join('.'),
        code: i.code,          // machine-readable
        message: i.message,    // human-readable
      })));
    }

    if (issues.length) {
      const err = new Error('Validation failed');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = issues;    // → the `details` field from Phase 5
      return next(err);
    }

    req.validated = validated;
    next();
  };
}
```

`safeParse` rather than `parse` is what makes this readable — no exception-driven
control flow for an expected outcome. The `details` array is the field described in
[Phase 5](../phase-5-errors/03-error-contract/README.md): a stable `code` per issue for the
client to branch on, a `message` for a human, and a `path` so a form can highlight
the right input.

## Why one factory rather than validation in each handler

Five things become properties of the system rather than of whoever wrote the route:

1. **The error shape is identical everywhere.** One client parser handles every
   endpoint's validation failure.
2. **The status is always 400.** No endpoint accidentally returns 500 or 422.
3. **Nothing is forgotten.** A route with no `validate(...)` in its chain is visibly
   missing it — and that is greppable.
4. **The parse output is always used**, so mass assignment cannot creep back in.
5. **One place to change.** Adding a request id to validation errors, or switching
   libraries, is a single edit.

**And keep the chain explicit at the route** — `router.post('/x', authenticate,
validate(schemas), handler)` — so a reader sees the guards without hunting for a
global `app.use`.

## Where to mount it

Order is load-bearing and mostly obvious once stated:

```js
router.post(
  '/orders',
  authenticate,                  // 401 before spending effort on the body
  authorize('orders:create'),    // 403 before parsing
  validate({body: createOrder}), // 400
  handler,
);
```

Authentication first: an unauthenticated caller should get a 401 without your
server parsing their payload, and validation errors are a small information leak
(they describe your schema) that anonymous callers do not need.

The exception is [webhooks](../phase-6-rest-surface/09-webhooks.md), where signature
verification runs over the **raw body** and must therefore precede any parsing at
all.

## Trade-off

A factory adds one indirection between the route and its rules: reading
`validate({body: createOrder})` means opening the schema to learn what is accepted.
Inline validation is locally more obvious.

What you get is uniformity that survives the team — the twentieth endpoint written
under deadline behaves like the first, because the shape of the failure is not up
to its author. That is worth far more than local obviousness, and it is the same
argument as the centralised error handler: **consistency you cannot forget beats
clarity you have to maintain.**

## Gotchas

**Symptom:** `TypeError: Cannot set property query of #<IncomingMessage> which has only a getter`  
**Cause:** Express 5 made `req.query` a getter; Express 4 code assigned the parsed result
back to it  
**Fix:** Put parsed output on `req.validated` — which you should be doing anyway

**Symptom:** Users fix one validation error at a time  
**Cause:** The middleware throws on the first failing section  
**Fix:** `safeParse` each section, collect all issues, respond once with `details`

**Symptom:** Validation errors return 500  
**Cause:** The thrown error carried no `statusCode`, so the error handler defaulted  
**Fix:** Set `statusCode` and `code` on the error before `next(err)`

**Symptom:** An endpoint accepts fields the schema does not mention  
**Cause:** The handler used `req.body` instead of `req.validated.body`  
**Fix:** The factory's value is the parse output. Grep for `req.body` in handlers — after
this middleware exists, every occurrence is suspect

**Symptom:** Anonymous callers can enumerate your schema through error messages  
**Cause:** `validate` mounted before `authenticate`  
**Fix:** Authenticate first; validate after

**Symptom:** Webhook signatures fail once validation middleware is added globally  
**Cause:** Body parsing ran before signature verification  
**Fix:** Webhook routes verify the raw body first — they are the documented exception

## Interview questions

**★ Where do you put the parsed result?**  
On `req` under a clear name (`req.validated`) — not mixed with raw body.

**★ Why can't you just overwrite `req.query` with the parsed value in Express 5?**  
It is a getter — assignment throws. Plenty of Express 4 tutorials do exactly that,
and it is a common upgrade break. Attach to your own namespace instead.

**★ Why `safeParse` rather than `parse`?**  
A validation failure is an expected outcome, not an exception. `safeParse` lets you
collect issues from body, params and query together and return them in one response,
instead of making the user fix one field per round trip.

**In what order do authentication, authorisation and validation run?**  
Authn, authz, then validation — reject unauthenticated callers before parsing their
input, and do not describe your schema to anonymous requests. Webhooks are the
exception: signature verification comes before any parsing.

**What does centralising validation actually buy?**  
A failure shape that is a property of the system, not of whoever wrote the route: one
error format, always 400, always the parse output used, one place to change, and a
missing check that is visible in the route line.


---

← Prev: [Validate at boundary](01-validate-at-boundary/README.md) · Next → [Coercion traps](03-coercion-traps.md)
