---
title: "The envelope"
sidebar_label: "01 · The envelope"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**One public JSON shape for every failure, with a stable `code` a client can
branch on and a `message` you stay free to rewrite. Express provides none of
this — it sends an HTML page.**

> Verified: 2026-08-14. **The envelope is this bible's design, not an Express
> feature** — Express has no opinion on error body shape and provides no
> mechanism for one. What *is* documented
> ([error handling](https://expressjs.com/en/guide/error-handling.html)) is the
> behaviour this page exists to replace: the built-in handler takes the status
> from `err.status`/`err.statusCode`, defaults to 500, and **writes `err.stack`
> outside production while sending an HTML page in production** — read from
> `finalhandler@2.1.1` in `sandbox/express-verify/node_modules/` and quoted in
> [01 · chunk 02](../01-error-middleware/02-the-default-handler.md).
> [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) is the standardised
> alternative discussed below. **No sandbox run backs this page and it carries no
> console block.**

## The handler

```js
function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || 500;
  const body = {
    error: {
      code: err.code || (status >= 500 ? 'INTERNAL' : 'REQUEST_ERROR'),
      message:
        status >= 500 && process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : err.expose === false
            ? 'Internal Server Error'
            : err.message,
    },
  };
  if (process.env.NODE_ENV !== 'production' && status >= 500) {
    body.error.stack = err.stack;
  }
  res.status(status).json(body);
}
```

Log the full `err` plus the request id server-side — see
[Error logging at the edge](../07-error-logging.md).

## The three fields, and why each earns its place

| Field | Audience | Why |
|---|---|---|
| `code` | **Machines** | A stable string the client branches on. `INVALID_EMAIL` survives copy edits; a message does not |
| `message` | **Humans** debugging | Free to change. Never the thing a client parses |
| `details` | **Forms** | Per-field errors for validation. Optional, and **absent** rather than `null` when unused |

The split matters because the two audiences want opposite things. A client needs
a value that never changes; a developer needs a message that can be improved. Put
the contract in `code` and you can rewrite every message without breaking anyone.

**Add a request id**, to the body as well as the log. A user reporting "it
failed" with an id turns a search through thousands of lines into one lookup —
and unlike the error itself, an id is safe to expose
([Phase 10 · 02](../../phase-10-app-factory/02-request-id.md)).

## Naming the codes

A `code` is an API surface, so it deserves the same care as a route name:

- **`SCREAMING_SNAKE` or `dot.namespaced`, consistently.** Either works;
  mixing them means clients cannot normalise.
- **Name the condition, not the fix.** `EMAIL_ALREADY_REGISTERED`, not
  `PLEASE_USE_ANOTHER_EMAIL`. The condition is stable; the advice is copy.
- **Do not encode the status in it.** `ERROR_409` tells a client nothing the
  status line did not, and it means two conditions with the same status collide.
- **One code per condition a client would handle differently.** If two failures
  lead to the same client behaviour, they can share a code and differ in
  `message`. Fifty codes nobody branches on is a maintenance cost with no reader.
- 🔴 **Never reuse a code for a different meaning.** That is the one change that
  breaks a client silently rather than loudly — the branch still matches and now
  does the wrong thing.

## `details` for validation

The one place a generic envelope is not enough is a form, where the client needs
to know *which field*:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request body is invalid",
    "details": [
      {"field": "email", "code": "INVALID_FORMAT", "message": "Must be an email address"},
      {"field": "age",   "code": "OUT_OF_RANGE",   "message": "Must be at least 18"}
    ],
    "requestId": "01JC…"
  }
}
```

Three decisions in that shape:

- **An array, not an object keyed by field.** One field can have two problems, and
  a nested field path (`items[0].sku`) is not a clean object key.
- **A `code` per issue**, for the same reason as the outer one — a client that
  highlights differently for "too short" and "already taken" needs a stable value.
- **All the issues at once.** A validator that stops at the first failure makes the
  user fix one field per round trip, which is why `safeParse` beats `parse`
  ([Phase 8 · 02](../../phase-8-validation-authz/02-validation-factory.md)).

## Or use the standard: RFC 9457

There **is** a standardised error format — `application/problem+json`, from
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) (which obsoletes RFC
7807):

```json
{
  "type": "https://example.com/probs/out-of-credit",
  "title": "You do not have enough credit.",
  "status": 403,
  "detail": "Your current balance is 30, but that costs 50.",
  "instance": "/account/12345/msgs/abc"
}
```

| | Custom envelope | `problem+json` |
|---|---|---|
| Machine-readable identity | your `code` | `type`, a URI |
| Client familiarity | none; document it | some tooling understands it |
| Extension | free | explicitly allowed — extra members are fine |
| Content type | `application/json` | `application/problem+json` |

**Use `problem+json` for a public API**, especially one with third-party
integrators or generated SDKs: it is a standard, it is documented once by
reference, and `type` as a URI can point at a page explaining the condition. **Use
a custom envelope for an internal or first-party API**, where the extra ceremony
buys nothing and a short `code` is easier to read in a switch.

What matters far more than the choice is **making one and applying it
everywhere**. Either format, applied consistently, beats a better format applied
to two-thirds of your routes.

## Trade-off

A single envelope for every failure means clients write one parser, and you can
add fields without breaking them. The cost is uniformity where it is sometimes
unhelpful: a validation failure and a database outage arrive in the same shape,
so clients must inspect `code` to tell a retry from a fix-your-input. That is the
right trade — the alternative, per-endpoint error shapes, pushes the same problem
onto every client and multiplies it.

**The real cost is discipline.** One handler that forgets the envelope, or one
route that responds with `res.status(400).send('bad')`, and the contract is a
suggestion. [Chunk 03](03-making-it-stick.md) is about enforcing it.

## Gotchas

**Symptom:** Production returns an HTML error page instead of JSON
**Cause:** No custom error handler, so Express's default responded
**Fix:** Register the four-argument handler. The default is HTML by design

**Symptom:** A client's error handling breaks after a copy edit
**Cause:** They were matching on `message` because `code` was missing or
inconsistent
**Fix:** Always send `code`, document it, and treat it as a public API — changing
one is a breaking change

**Symptom:** `details` is `null` in some responses and absent in others
**Cause:** `JSON.stringify` **omits `undefined` properties but serialises `null`**
([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify))
**Fix:** Pick one and be consistent. Leaving the field `undefined` when unused
keeps it out of the payload entirely, which is usually what you want

**Symptom:** Two different conditions return the same `code` after a refactor
**Cause:** A code was reused for a new meaning
**Fix:** Add a new code. Reuse is the one change that breaks clients silently —
their branch still matches and now does the wrong thing

**Symptom:** A form shows one error at a time
**Cause:** The validator stopped at the first failure
**Fix:** Collect all issues into `details` — `safeParse` rather than `parse`

## Interview questions

**★ Why send a `code` when the message already says what happened?**
Because the message is for humans and will be rewritten; the code is the
contract. Clients that branch on message text break the first time someone
improves the copy — and that break is silent for them and invisible to you.

**★ What does Express do by default with an unhandled error, and why is that
wrong for an API?**
It responds with an HTML page — or `err.stack` outside production — with the
status taken from `err.status`/`err.statusCode`. Wrong on two counts: the content
type is not JSON, and what leaks is decided by `NODE_ENV` rather than by you.

**★ How should validation errors be shaped?**
As an array of per-issue objects with a `field`, a `code` and a `message`, all
collected in one response. An array because one field can have two problems and a
nested path is not a clean object key; all at once because otherwise the user
fixes one field per round trip.

**★ Is there a standard for this?**
Yes — `application/problem+json`, RFC 9457, which obsoletes RFC 7807. It is worth
using on a public API, where a standard format and a `type` URI pay for
themselves. A custom envelope is fine internally. What matters more is applying
one of them everywhere.

**Why include a request id in the error body?**
It is the only field that links a user's report to your logs, and it is safe to
expose. Without it, "I got an error at about 2pm" is not a searchable fact.

**How many error codes should an API have?**
One per condition a client would handle differently. Failures that lead to the
same client behaviour can share a code and differ in `message`; fifty codes
nobody branches on is a maintenance cost with no reader.

---

Index: [Error contract](README.md) · Next → [What is safe to expose](02-what-is-safe-to-expose.md)
