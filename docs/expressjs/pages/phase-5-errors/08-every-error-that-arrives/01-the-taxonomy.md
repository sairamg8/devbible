---
title: "The taxonomy"
sidebar_label: "01 · The taxonomy"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**One handler receives everything: your own errors, a validation library's, a
database driver's, a `TypeError` from a typo, and things that are not `Error`
objects at all. The design question is not how to handle them all in one place —
it is where each one gets translated before it arrives.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** Express's error handling is one documented mechanism: a
> middleware with **four arguments** is the error handler, defined last
> ([error handling](https://expressjs.com/en/guide/error-handling.html)), and
> anything passed to `next(err)` — or, in Express 5, **thrown or rejected inside a
> handler** — reaches it. Express applies no interpretation of its own: the
> built-in handler reads `err.status` / `err.statusCode`, otherwise responds
> **500**, and *"the stack trace is not included in the production environment"*.
> Express has **no** knowledge of database drivers, HTTP clients or validation
> libraries — every mapping on these pages is application code. Status semantics
> are [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).
> **The taxonomy, the translation rule and the fallback design are this bible's.**

## Six families, and only one of them is yours

Everything that reaches the handler belongs to one of these. The column that
matters is the last one — **who is in a position to know what it means**:

| Family | Example | Who can translate it |
|---|---|---|
| **1 · Yours, deliberate** | `throw new NotFoundError()` | already translated |
| **2 · Validation** | a Zod issue list | the validation middleware |
| **3 · Infrastructure** | `23505`, `E11000`, `ECONNREFUSED` | **the repository / client wrapper** |
| **4 · Framework** | `entity.parse.failed`, `entity.too.large` | Express, via `err.status` |
| **5 · Programmer** | `TypeError`, `ReferenceError` | **nobody** — it is a bug |
| **6 · Not an `Error` at all** | `throw 'nope'`, `throw {code: 1}` | nobody — normalise and treat as 5 |

Families 1, 2 and 4 arrive already carrying a status. **Family 3 is the whole
problem**, and family 5 is the one that decides what your fallback looks like.

## The rule: translate at the boundary that knows

🔴 **The global handler must not be a `switch` over every library's error codes.**
It is the tempting design and it fails for a specific reason: the handler is the
one place in the application with **no context**. It does not know that `23505`
came from the email column of a signup, nor that `ECONNREFUSED` was the pricing
service rather than the database — so a central mapping produces technically
correct statuses with useless messages, and it grows a dependency on every library
the app uses.

```js
// ⛔ the god handler — every driver's vocabulary, no context
app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json(…);
  if (err.code === 'E11000') return res.status(409).json(…);
  if (err.code === 'ECONNREFUSED') return res.status(503).json(…);
  …
});
```

```js
// ✅ the repository translates, because it knows which constraint means what
async function insertUser(row) {
  try {
    return await db.query(INSERT, row);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      throw new ConflictError('EMAIL_TAKEN', {cause: err});
    }
    throw err;                       // unknown ⇒ not mine to interpret
  }
}
```

Three properties follow, and they are the argument
([Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md)):

1. **The translation sits where the vocabulary is understood.** The repository
   already knows the constraint names; the handler never will.
2. **The domain stops leaking upward.** Nothing above the repository imports the
   driver or matches on its codes, so swapping the driver changes one layer
   ([Phase 7 · 02](../../phase-7-layering/02-domain-vs-transport.md)).
3. **The handler shrinks to two jobs**: format the errors that carry a status, and
   turn everything else into a 500 that leaks nothing.

⚠️ **`throw err` for the unrecognised case is deliberate.** A repository that maps
*every* driver error to a 500 with a friendly message destroys the information
that would have identified the bug. Translate what you recognise; re-throw the
rest untouched, with the original preserved as `cause`.

## What a translated error looks like

The four fields the rest of the phase depends on:

```js
export class HttpError extends Error {
  constructor(status, code, {message, cause, expose, headers} = {}) {
    super(message ?? code, {cause});          // `cause` keeps the original
    this.status = status;                     // read by the default handler too
    this.code = code;                         // the client's stable identifier
    this.expose = expose ?? status < 500;     // may the message be shown?
    this.headers = headers;                   // e.g. Retry-After, WWW-Authenticate
    this.name = this.constructor.name;
  }
}
```

- **`status`** — Express's built-in handler reads `err.status`/`err.statusCode`
  too, so even an unhandled error keeps its status
  ([topic 01 · chunk 02](../01-error-middleware/02-the-default-handler.md)).
- **`code`** — the string clients branch on. It is the API's contract, so it
  changes only with a version ([topic 03](../03-error-contract/README.md)).
- **`expose`** — the single flag separating "safe to show" from "internal". Below
  500 the message is yours to write and therefore safe; at 500 it never is
  ([topic 05](../05-operational-vs-programmer.md)).
- **`cause`** — the standard option on the `Error` constructor. It is what makes a
  translated error debuggable: the log gets the driver's original, the client gets
  none of it ([topic 07](../07-error-logging.md)).

## Normalise before you inspect

Nothing guarantees the thing you caught is an `Error`. A library may `throw` a
string, a plain object, a `DOMException`, or reject with `undefined`; and any
handler code reading `err.status` on a string is one step from a second failure
inside the error path.

```js
// the first line of the error handler, before any decision
function normalise(err) {
  if (err instanceof Error) return err;
  const wrapped = new Error(typeof err === 'string' ? err : 'Non-Error thrown');
  wrapped.cause = err;                       // keep whatever it was
  wrapped.nonError = true;                   // and record that it was not one
  return wrapped;
}
```

🔴 **A non-`Error` throw is a programmer error even when it carries a status.**
Something in the stack is not using the language's error channel properly, and the
`nonError` marker is what lets you find it in the logs rather than discovering it
in a year.

⚠️ **`null` and `undefined` are the pathological cases.** `throw undefined` and a
rejected promise with no reason both reach Express, and `err.status` on either
throws. The `instanceof` check above handles them because everything that is not
an `Error` takes the same branch.

## Where each family is already covered

This topic is the catalogue; the mechanics live where they were argued, and are
not restated:

| Family | Covered in |
|---|---|
| How anything reaches the handler at all | [topic 01](../01-error-middleware/README.md) |
| Async, promises, timers, emitters, callbacks | [topic 02](../02-async-errors/README.md) |
| The envelope, codes, and what is safe to expose | [topic 03](../03-error-contract/README.md) |
| Which status an operational failure deserves | [topic 04](../04-mapping-to-http.md) |
| Operational versus programmer | [topic 05](../05-operational-vs-programmer.md) |
| Body parser failures — 400 and 413 | [Phase 3 · 05](../../phase-3-requests/05-malformed-bodies.md) |
| Validation failures — 400 with a `details` array | [Phase 8 · 02](../../phase-8-validation-authz/02-validation-factory/README.md) |
| Conflicts and preconditions — 409, 412, 428 | [Phase 6 · 02](../../phase-6-rest-surface/02-status-mapping/README.md) |

**What was missing, and is [chunk 02](02-database-and-network.md) and
[chunk 03](03-programmer-errors-and-the-fallback.md):** the infrastructure
vocabulary — database codes, HTTP client and network failures — and what happens
to the errors nobody translated.

## Gotchas

**Symptom:** The error handler imports the database driver
**Cause:** Driver codes are being matched centrally
**Fix:** Translate in the repository; the handler formats, it does not interpret

**Symptom:** A 409 says "duplicate key value violates unique constraint"
**Cause:** A driver message passed through to the client
**Fix:** Map to your own code (`EMAIL_TAKEN`) and keep the original as `cause`

**Symptom:** A second error is thrown inside the error handler
**Cause:** It read a property off something that was not an `Error`
**Fix:** Normalise first — one `instanceof` check before any decision

**Symptom:** A rejected promise reaches the handler as `undefined`
**Cause:** `Promise.reject()` with no reason, or `throw undefined`
**Fix:** The same normalisation; treat it as a programmer error and mark it

**Symptom:** Every unexpected failure is a 500 with no way to tell them apart
**Cause:** The repository mapped all driver errors instead of only the ones it
recognises
**Fix:** Translate what you recognise, re-throw the rest untouched

**Symptom:** Swapping the database driver touched twenty files
**Cause:** Driver error codes matched above the repository layer
**Fix:** One translation boundary — the domain never sees a SQLSTATE

## Interview questions

**★ Should the global error handler map database error codes?**
No. The handler is the one place with no context — it cannot know which
constraint or which service failed, so a central mapping yields correct statuses
with useless messages and couples the handler to every library. Translate in the
repository or client wrapper, which understands the vocabulary, and let the
handler format what already carries a status.

**★ What are the fields a translated error should carry?**
`status` (which Express's own default handler also reads), `code` as the client's
stable identifier, `expose` to separate showable messages from internal ones, and
`cause` holding the original so the log is debuggable while the response is not.

**★ What happens if something throws a string?**
It still reaches the handler, and any code reading `err.status` off it is one
step from failing inside the error path. Normalise with a single `instanceof
Error` check, wrap non-errors, keep the thrown value as `cause`, and mark it —
because a non-`Error` throw is itself a bug worth finding.

**★ Why re-throw driver errors you do not recognise?**
Because mapping everything to a friendly 500 destroys the information that
identifies the bug. Recognised codes become domain errors; the rest travel
untouched to the fallback, which logs them in full and tells the client nothing.

**Which error families arrive already carrying a status?**
Your own deliberate errors, validation failures, and framework errors such as
body-parser's 400 and 413. Infrastructure errors do not, and programmer errors
must not.

**What is the handler's actual job, then?**
Two things: format the errors that carry a status into the API's envelope, and
turn everything else into a 500 that leaks nothing while logging everything.

---

Index: [Every error that arrives](README.md) · Next → [Database and network](02-database-and-network.md)
