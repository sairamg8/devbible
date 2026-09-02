---
title: "The error contract"
sidebar_label: "09 · The error contract"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against RFC 9457 (problem details), the Express 5 docs
> (error handling, async), and the PostgreSQL error-code appendix. Concept
> home: [Express — errors](../../../expressjs/pages/phase-5-errors/README.md)
> and [every error that arrives](../../../expressjs/pages/phase-5-errors/08-every-error-that-arrives/README.md).

## The problem

Eleven chapters have been throwing `ApiError`s at a handler this chapter
finally writes. The contract has two halves: **the wire shape** (one JSON
body format for every failure, so clients write one error path) and **the
funnel** (every throwable in the process — domain errors, driver codes,
zod, busboy, programmer bugs — arrives at one place and leaves classified).
Express 5 makes the funnel honest: rejected async handlers land in the
error middleware without wrapper ceremony.

## The wire shape

RFC 9457's problem-details, trimmed to the fields this app uses:

```json
{
  "type": "https://api.storefront.example/errors/OUT_OF_STOCK",
  "title": "insufficient stock",
  "status": 409,
  "code": "OUT_OF_STOCK",
  "product_ids": [42, 108],
  "request_id": "8f4c1a…"
}
```

`code` is the machine key clients switch on; extra members
(`product_ids`, `issues`) are per-code and documented with it; `request_id`
ties the response to the log line
([correlation](../../../nodejs/pages/phase-10-observability/03-correlation-ids.md)).

## The implementation

```js
// src/middleware/errors.js
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status; this.code = code; this.extra = extra;
    this.expose = true;                       // safe to describe to the client
  }
}

// domain + infrastructure errors → ApiError, in ONE table
function classify(err) {
  if (err instanceof ApiError) return err;

  // Phase 1's domain error
  if (err.code === 'OUT_OF_STOCK') {
    return new ApiError(409, 'OUT_OF_STOCK', 'insufficient stock',
      {product_ids: err.productIds});
  }
  // Postgres, by SQLSTATE + constraint name — the driver facts are the
  // pg concept page's (§ error codes)
  if (err.code === '23505') {                 // unique_violation
    const map = {
      users_email_key: [409, 'EMAIL_TAKEN', 'email already registered'],
      reviews_order_id_product_id_key:
        [409, 'ALREADY_REVIEWED', 'this purchase already has a review'],
      orders_idempotency_key_key: null,       // handled inside checkout — a bug here
    };
    const hit = map[err.constraint];
    if (hit) return new ApiError(...hit);
  }
  if (err.code === '23503') {                 // fk violation — bad reference in input
    return new ApiError(422, 'BAD_REFERENCE', 'referenced item does not exist');
  }
  if (err.code === '57014' || err.name === 'AbortError') {
    return new ApiError(504, 'TIMEOUT', 'the operation timed out');
  }
  if (err.type === 'entity.too.large') {      // express.json's limit
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'request body too large');
  }
  if (err.code === 'TOO_LARGE' || err.code === 'BAD_TYPE') { // upload service
    return new ApiError(400, err.code, err.message);
  }
  return null;                                // unknown ⇒ a 500, details withheld
}

export function errorHandler({config}) {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);    // mid-stream: let Express destroy

    const known = classify(err);
    const status = known?.status ?? 500;

    req.log?.[status >= 500 ? 'error' : 'warn']({   // the request logger
      err, code: known?.code ?? 'INTERNAL', status,
    });

    const body = known
      ? {type: `${config.ERROR_DOC_BASE}/${known.code}`, title: known.message,
         status, code: known.code, ...known.extra}
      : {type: `${config.ERROR_DOC_BASE}/INTERNAL`, title: 'internal error',
         status: 500, code: 'INTERNAL'};
    body.request_id = req.id;
    res.status(status).json(body);
  };
}

export function notFound(req, res) {
  res.status(404).json({
    type: 'about:blank', title: 'not found', status: 404,
    code: 'NOT_FOUND', request_id: req.id,
  });
}
```

## The rules

- **Unknown errors say nothing.** A driver message or stack trace in a 500
  body leaks schema names, versions, file paths. The `request_id` is the
  client's handle; the *log* carries the truth. `expose` exists so no code
  path can accidentally promote an internal message to the wire.
- **Constraint names are contract.** The classify table keys on
  `users_email_key` — which means the schema's constraint names are load-
  bearing and a migration renaming one is an API change. That is a feature:
  the database rule and its API translation are linked by a grep-able
  string.
- **The checkout's idempotency conflict never reaches here.** The
  transaction handles it as a *replay*, not an error
  ([1·06](../phase-1-database/06-the-checkout-transaction/01-the-transaction.md));
  its appearance in this handler means that logic broke — hence the `null`
  row: fall through to a 500 and a loud log, not a polite 409.
- **`headersSent` short-circuits.** An error after streaming began (an
  image `GET` dying mid-pipe) cannot be turned into JSON — the only honest
  move is destroying the connection so the client sees truncation, not a
  200 with half a body.
- **4xx logs at `warn`, 5xx at `error`** — client mistakes are weather,
  server faults are pages. Alerting keys off the level
  ([what-to-log](../../../nodejs/pages/phase-10-observability/04-what-to-log.md)).

## Gotchas

- **Symptom:** a new endpoint's failures arrive as `INTERNAL` though the
  service throws a perfectly good domain error. **Cause:** the domain
  error never got a classify row — the funnel is one table by design, and
  new error types must register. **Fix:** the row; and the test suite's
  contract test asserts every exported domain error class maps to a
  non-500.
- **Symptom:** clients report intermittent HTML error pages instead of
  JSON. **Cause:** an error thrown *before* the JSON middleware ran (body
  parser failures on malformed content-type) hit Express's default
  handler — the error middleware wasn't last, or a second app-level
  handler crept in. **Fix:** the [mount-order rule](01-project-structure.md);
  the error handler is registered once, after everything, including
  `notFound`.
- **Symptom:** the security review flags `EMAIL_TAKEN` as an account-
  enumeration oracle — chapter 03 promised neutrality. **Cause:** the
  signup route mapped the unique violation the obvious way. **Fix:** the
  deliberate exception: signup returns the *same* 200-shaped "check your
  email" response for taken and fresh emails, and `EMAIL_TAKEN` is
  reserved for the authenticated change-email flow, where the caller
  already owns an account. The classify table serves both because the
  *route* chooses what to expose — signup catches before the funnel.

## Interview questions

1. **★ Why one error handler instead of try/catch-and-respond in every
   route?** Because the contract is a single wire shape and a single
   logging policy — distributed catch blocks re-implement both, drift, and
   miss the errors nobody anticipated (which are exactly the ones that
   matter). Routes throw meaning; one place decides representation. It is
   the response-side mirror of the validation boundary.
2. **★ Why must unknown errors return a generic body when the real message
   would help debugging?** The client cannot act on internals, and
   attackers can: driver strings reveal schema, stack traces reveal code
   layout, version strings select exploits. The `request_id` gives
   legitimate debuggers a *better* tool — the full server-side log line —
   without shipping the internals to everyone else.
3. **What does Express 5 change about async errors, and what discipline
   survives?** Rejected promises from handlers propagate to error
   middleware automatically — the `catch(next)` wrappers eras die. What
   survives: errors thrown in callbacks *outside* the promise chain
   (an event handler on a stream) still need explicit `next(err)`, which
   is why the upload route wires `bb.on('error', next)` by hand.
4. **Why do 4xx and 5xx get different log levels rather than different
   verbosity?** Level is the alerting interface: `error` means "the
   server broke its promise", which pages; `warn` means "a client sent
   something we refused", which trends. Logging a validation failure at
   `error` trains responders to ignore the pager — the operational cost
   of miscategorized logs is measured in missed real incidents.

---

← Prev: [The uploads endpoint](08-the-uploads-endpoint.md) ·
Next → [Rate limiting](10-rate-limiting.md)
