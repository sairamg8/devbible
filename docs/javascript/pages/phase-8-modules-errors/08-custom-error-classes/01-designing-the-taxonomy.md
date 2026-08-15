---
title: "01 · Designing the taxonomy"
sidebar_label: "01 · The taxonomy"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause), [`Error.prototype.name`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/name), [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException), [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError) — and Node.js [Errors § `error.code`](https://nodejs.org/api/errors.html#errorcode). Documentation-validated; **no timings, no console blocks**.

⚠️ **How to write the class is Master material** — the constructor, forwarding `options` so
`cause` survives, setting `name` as a literal, `captureStackTrace` and the transpilation trap are
[03 · Custom errors](../03-error-and-subclasses/02-custom-errors.md). **This page is the design
question that comes before it:** *which* classes should exist at all, and what each should carry.

🔴 **The point of a custom error is that a caller can branch on it without reading the message.**
Every decision below follows from that. If no caller will ever branch, you do not need a class —
you need a good message.

## The test: what will the `catch` block do differently?

Ask it once per proposed class, and answer in terms of *behaviour*:

| The caller will… | Deserves a distinction |
|---|---|
| retry | ✅ — transient versus permanent must be separable |
| show a field-level message to the user | ✅ — validation, with the field on the error |
| ask the user to sign in | ✅ — authentication versus authorisation |
| render "not found" instead of an error page | ✅ |
| log and give up | ❌ — that is the default; no class needed |

**If two classes always take the same branch, they are one class.** That is the whole rule, and
it is what stops the failure mode the Master page names: twenty error classes and nobody
remembering which to catch.

## Class or `code`? Use both, for different jobs

```js
class AppError extends Error {
  constructor(message, { code, ...options } = {}) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}
```

| | A **class** | A **`code` string** |
|---|---|---|
| Answers | "whose problem is this?" | "which specific failure?" |
| Checked with | `instanceof` | `err.code === 'ORDER_LOCKED'` |
| Survives serialisation | ❌ — a class is lost over JSON, `postMessage`, a network hop | ✅ — it is a string |
| Survives duplicate package copies / realms | ❌ | ✅ |
| Good for | a handful of broad categories | the long tail |

🔴 **A small number of classes, each carrying a `code`, is the shape that scales.** The classes
give you `instanceof` to separate *your* failures from genuine bugs; the codes carry the detail
without a class explosion, and they survive every boundary a class does not.

**Node's own libraries work exactly this way** — a small set of error types plus a stable
`error.code` such as `ENOENT` — and that stability is what makes code-based checks safe while
message matching never is.

⚠️ **Never branch on `err.message`.** Messages are for humans: they get reworded, translated and
interpolated, and a `.includes('not found')` check breaks on the first copy edit.

## A taxonomy that covers most applications

Four or five categories is usually enough:

```js
class ValidationError extends AppError { }    // the input was wrong — the user can fix it
class NotFoundError   extends AppError { }    // the thing does not exist
class AuthError       extends AppError { }    // who you are, or what you may do
class ConflictError   extends AppError { }    // the state moved under you
class DependencyError extends AppError { }    // something we depend on failed
```

**The shared base class earns its place**: `err instanceof AppError` distinguishes "a failure this
program anticipated" from "a `TypeError` from a bug", which is the single most useful branch in
any handler.

```js
} catch (err) {
  if (!(err instanceof AppError)) throw err;     // 🔴 a bug — do not swallow it
  respond(err);
}
```

That line is the design version of the narrow-`try` discipline from
[07 · The statements](../07-throw-try-catch/01-the-statements.md): handle what you anticipated,
and let everything else reach the global handler where it will be seen.

## Put what the handler needs *on* the error

```js
class ValidationError extends AppError {
  constructor(message, { field, value, ...options } = {}) {
    super(message, options);
    this.name = 'ValidationError';
    this.field = field;          // ✅ the handler highlights this input
    this.value = value;
  }
}
```

**The test is what the `catch` block wants to know**, and the answer is almost never "the
message". A field name, a status, a retry hint, an id — machine-readable values that let the
handler act.

⚠️ **Do not put secrets or whole payloads on an error.** Errors get logged, serialised and shipped
to a third-party reporter; a password, a token or a full request body on an error object is a
disclosure with a wide blast radius. Carry an id, and look the rest up if you need it.

## Where the classes live

**In the module that owns the failure, exported alongside it.** A `PaymentError` defined next to
the payment client is discoverable by everyone who calls it; the same class in a shared
`errors.js` grab-bag becomes a dumping ground that every module imports and nobody owns.

🔴 **A shared `errors.js` is also a classic cycle source** — everything imports it and it ends up
importing something back ([06 · Diagnosing and fixing](../06-circular-imports/02-diagnosing-and-fixing.md)).
A base class in a leaf module with no imports of its own is safe; a grab-bag is not.

## Do not wrap what the platform already types

```js
if (err.name === 'AbortError')   { … }   // ✅ a DOMException — leave it as it is
if (err instanceof TypeError)    { … }   // ✅ a bug, or fetch's network failure
```

The platform's errors already have names and codes worth branching on — `AbortError`,
`TimeoutError`, `SyntaxError`, Node's `ENOENT`. **Re-wrapping them in your own class buys
nothing** unless you are deliberately translating at a boundary
([02 · Cause chains and boundaries](./02-cause-chains-and-boundaries.md)), and it costs you the
platform's own classification.

## Gotchas

**Symptom: twenty error classes and callers `catch` the wrong one.**
Cause — a class per failure mode instead of per caller behaviour.
Fix — a handful of classes plus a `code` string for the long tail.

**Symptom: a handler parses the message to decide what to do.**
Cause — the error carries no machine-readable field.
Fix — put `code`, `field` or `status` on the error and branch on that.

**Symptom: an error check breaks after someone rewords a message.**
Cause — branching on `err.message`.
Fix — a stable `code`; messages are for humans.

**Symptom: a `TypeError` from a typo is rendered to the user as a friendly failure.**
Cause — the handler did not separate anticipated failures from bugs.
Fix — `if (!(err instanceof AppError)) throw err;` before handling.

**Symptom: `instanceof` fails for an error from a worker or another bundle copy.**
Cause — class identity does not cross realms or duplicated package copies.
Fix — check `err.code`; keep classes for in-process branching.

**Symptom: a token appears in the error tracker.**
Cause — the error object carried request data.
Fix — carry ids only; look up details from logs when needed.

**Symptom: importing the shared `errors.js` created a cycle.**
Cause — the grab-bag imports back into the modules that import it.
Fix — define errors next to the code that throws them; keep any base class in a leaf module.

## Interview questions

**★ When is a custom error class worth defining?**
When a caller will branch on it and do something different — retry, prompt a sign-in, highlight a
field. If every caller logs and gives up, a good message is enough.

**★ Class or error code?**
Both, for different jobs. A few classes answer "whose problem is this?" and support `instanceof`;
a `code` string answers "which failure?", carries the long tail, and survives serialisation and
realm boundaries where a class does not.

**★ Why never branch on the message?**
Messages are human-facing: reworded, translated, interpolated. A `code` is a contract; a message
is not.

**★ What is the single most useful branch in an error handler?**
`err instanceof AppError` — anticipated failure versus a bug. Rethrow the bug so it reaches your
error reporting instead of being rendered as a friendly message.

**★ Where should error classes live?**
Next to the module that throws them. A shared grab-bag becomes unowned and is a common source of
import cycles.

**★ Should you wrap platform errors in your own classes?**
Not by default — `AbortError`, `TimeoutError` and Node's `code` values are already good
classification. Wrap only when you are deliberately translating at a boundary.

**What must never go on an error object?**
Secrets and whole payloads. Errors are logged and shipped to third parties; carry ids instead.

---

[Topic index](./README.md) · [02 · Cause chains and boundaries](./02-cause-chains-and-boundaries.md) →
