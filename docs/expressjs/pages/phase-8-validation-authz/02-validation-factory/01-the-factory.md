---
title: "The factory"
sidebar_label: "01 · The factory"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`validate({body, params, query})` returns middleware. On failure: 400 with
stable codes and every issue at once. On success: the parsed data, on a property
of your own.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The factory
> shape is **Express's own convention**, not a community invention: the docs
> describe *"configurable middleware"* as a module that *"exports a function which
> accepts an options object and returns the middleware implementation"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
> Attaching the result relies on middleware being able to *"modify the request and
> response objects"* — and since Express publishes **no reserved-name list**
> ([Phase 2 · 06](../../phase-2-middleware/06-mutating-req-res.md)), the
> namespaced `req.validated` matters. `next(err)` with a `statusCode` works
> because the default handler reads `err.status`/`err.statusCode`
> ([error handling](https://expressjs.com/en/guide/error-handling.html)), which is
> `finalhandler@2.1.1`'s `getErrorStatusCode` in
> `sandbox/express-verify/node_modules/`.
>
> ⚠️ **One Express 5 constraint the code depends on**, from the
> [migration guide](https://expressjs.com/en/guide/migrating-5.html): *"the
> `req.query` property is no longer a writable property and is instead a getter."*
> Assigning to it throws.

## The naive shape, and why it is not enough

```js
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body)   req.validated = {...req.validated, body:   schemas.body.parse(req.body)};
      if (schemas.params) req.validated = {...req.validated, params: schemas.params.parse(req.params)};
      if (schemas.query)  req.validated = {...req.validated, query:  schemas.query.parse(req.query)};
      next();
    } catch (err) {
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      next(err);
    }
  };
}
```

It works, and it **throws on the first failing section** — so a form rejects one
field at a time. The user fixes the email, resubmits, and learns the password is
too short. That is a real product problem disguised as a code style.

## Report every error, not the first

```js
export function validate(schemas) {
  return function validate(req, res, next) {
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

Five decisions in that function, and each is deliberate:

**1 · `safeParse`, not `parse`.** A validation failure is an **expected outcome**,
not an exception. Using the result-object form removes exception-driven control
flow and — the actual point — lets all three sections run before answering.

**2 · The issue shape mirrors the error contract.** `code` for a client to branch
on, `message` for a human, `path` so a form can highlight the right input, and
`section` so `body.email` and `query.email` are distinguishable
([Phase 5 · 03 · chunk 01](../../phase-5-errors/03-error-contract/01-the-envelope.md)).

**3 · The error carries its own status.** `statusCode` and `code` on the error
mean the central handler needs no special case, and the default handler would
still produce a 400 if yours were missing.

**4 · The returned function is named.** `Layer` records `fn.name ||
'<anonymous>'`, so `DEBUG=router` shows `validate` rather than a wall of
anonymous entries
([Phase 2 · 02 · chunk 02](../../phase-2-middleware/02-execution-order/02-ordering-in-practice.md)).

**5 · `validated` is built locally and assigned once**, so a partial parse never
half-populates `req.validated`. A handler either sees a complete object or the
request never reached it.

## Where the parsed value goes

🔴 **Not back onto `req.query`.** In Express 5 that throws:

```js
req.query = schemas.query.parse(req.query);
// TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
```

Plenty of Express 4 tutorials do exactly that, and it is one of the more common
upgrade breaks. It was never meaningful anyway: `req.query` re-parses on every
access and returns a new object each time
([Phase 1 · 02 · chunk 02](../../phase-1-routing/02-params-and-query/02-the-query-parser.md)).

**One property, `req.validated`, holding all three sections.** Not three separate
properties, because:

- a handler reads one thing;
- a TypeScript declaration covers it in one place
  ([page 09](../09-type-inference.md));
- and `req.validated` being absent is an unambiguous signal that the middleware
  did not run, which three optional properties do not give you.

**Do not overwrite `req.body` either.** It works, it looks tidy, and it destroys
the distinction between what arrived and what you accepted — which is exactly
what you want while debugging.

## Why one factory rather than validation in each handler

Five things become properties of the system rather than of whoever wrote the
route:

1. **The error shape is identical everywhere.** One client parser handles every
   endpoint's validation failure.
2. **The status is always 400.** No endpoint accidentally returns 500 or 422.
3. **Nothing is forgotten.** A route with no `validate(...)` in its chain is
   visibly missing it — and that is **greppable**, which review is not.
4. **The parse output is always used**, so mass assignment cannot creep back in
   ([page 01 · chunk 02](../01-validate-at-boundary/02-parse-dont-validate.md)).
5. **One place to change.** Adding a request id to validation errors, or
   switching libraries, is a single edit.

**Keep the chain explicit at the route** — `router.post('/x', authenticate,
validate(schemas), handler)` — so a reader sees the guards without hunting for a
global `app.use`.

## Trade-off

A factory adds one indirection between the route and its rules: reading
`validate({body: createOrder})` means opening the schema to learn what is
accepted. Inline validation is locally more obvious.

What you get is **uniformity that survives the team** — the twentieth endpoint
written under deadline behaves like the first, because the shape of the failure
is not up to its author. That is worth far more than local obviousness, and it is
the same argument as the centralised error handler: **consistency you cannot
forget beats clarity you have to maintain.**

## Gotchas

**Symptom:** `TypeError: Cannot set property query of #<IncomingMessage> which has
only a getter`
**Cause:** Express 5 made `req.query` a getter; Express 4 code assigned the parsed
result back to it
**Fix:** Put parsed output on `req.validated` — which you should be doing anyway

**Symptom:** Users fix one validation error at a time
**Cause:** The middleware throws on the first failing section
**Fix:** `safeParse` each section, collect all issues, respond once with `details`

**Symptom:** Validation errors return 500
**Cause:** The thrown error carried no `statusCode`, so the handler defaulted
**Fix:** Set `statusCode` and `code` on the error before `next(err)`

**Symptom:** An endpoint accepts fields the schema does not mention
**Cause:** The handler used `req.body` instead of `req.validated.body`
**Fix:** The factory's value **is** the parse output. Grep for `req.body` in
handlers — once this middleware exists, every occurrence is suspect

**Symptom:** `req.validated.query` is populated but `req.validated.body` is
missing, and the handler crashes
**Cause:** An implementation that assigns per section as it goes, so a partial
parse leaves a partial object
**Fix:** Build locally and assign once, as above

**Symptom:** `DEBUG=router` output is a wall of `<anonymous>`
**Cause:** The factory returns an arrow function
**Fix:** Return a **named** function expression

## Interview questions

**★ Where do you put the parsed result?**
On `req` under a clear name — `req.validated`, holding all three sections. One
property rather than three, so a handler reads one thing, a type declaration
covers it once, and its absence unambiguously means the middleware did not run.

**★ Why can't you just overwrite `req.query` with the parsed value in Express 5?**
It is a getter — assignment throws. Plenty of Express 4 tutorials do exactly
that, which makes it a common upgrade break. And because the getter re-parses on
every access, mutating it was never meaningful.

**★ Why `safeParse` rather than `parse`?**
A validation failure is an expected outcome, not an exception. `safeParse` lets
you run all three sections and collect every issue, instead of making the user fix
one field per round trip.

**★ What does centralising validation actually buy?**
A failure shape that is a property of the system rather than of whoever wrote the
route: one error format, always 400, always the parse output used, one place to
change, and a missing check that is visible — and greppable — in the route line.

**Why build the `validated` object locally rather than assigning per section?**
So a partial parse never half-populates `req.validated`. A handler either sees a
complete object or never runs, which removes a class of "sometimes undefined"
bug.

**Why should the factory return a named function?**
Because `Layer` records `fn.name || '<anonymous>'`, and that name is what
`DEBUG=router` and stack traces show. A stack of anonymous layers tells you
nothing about where a request stopped.

---

Index: [Validation factory](README.md) · Next → [Mounting and order](02-mounting-and-order.md)
