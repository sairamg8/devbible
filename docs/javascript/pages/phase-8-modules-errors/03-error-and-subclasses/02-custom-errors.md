---
title: "03.2 · Custom error classes"
sidebar_label: "02 · Custom error classes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.captureStackTrace()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/captureStackTrace), [`class` extends](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends). Documentation-validated.

**A custom error class exists so callers can branch on the *type* of failure without touching
the message.** That is the whole justification, and it is enough.

## MDN's template

```js
class CustomError extends Error {
  constructor(foo = "bar", ...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (non-standard)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }

    this.name = "CustomError";
    // Custom debugging information
    this.foo = foo;
    this.date = new Date();
  }
}
```

Four things are happening, and three of them are easy to omit.

## 1. Forward `options` to `super` — or lose `cause`

MDN is explicit:

> "Need to pass `options` as the second parameter to install the 'cause' property."

```js
class MyError extends Error {
  constructor(message, options) {
    super(message, options);
  }
}

console.log(new MyError("test", { cause: new Error("cause") }).cause);
// Error: cause
```

🔴 **A constructor written as `super(message)` silently discards every `cause` a caller
passes.** Nothing throws; `cause` is just `undefined`, and you discover it while debugging
the incident it was supposed to explain.

If your subclass takes extra parameters, keep `options` in the signature:

```js
class HttpError extends Error {
  constructor(status, message, options) {
    super(message, options);           // ✅ cause survives
    this.name = "HttpError";
    this.status = status;
  }
}
```

## 2. Set `name` explicitly

`name` comes from the prototype, and `Error.prototype.name` is `"Error"`. Subclassing does
**not** change it, so without the assignment your error introduces itself as an `Error`:

```js
class NotFoundError extends Error {}
String(new NotFoundError("nope"));       // "Error: nope"  ⚠️
```

Two ways, and the difference matters slightly:

```js
this.name = "NotFoundError";                       // own property on every instance
// or
NotFoundError.prototype.name = "NotFoundError";    // one shared property
```

The instance property is what MDN's template does and what everyone writes. The prototype
version avoids one property per instance — irrelevant unless you are creating errors in
enormous numbers, which is itself a smell.

**A neat variant that survives minification badly:**

```js
this.name = this.constructor.name;    // ⚠️ becomes "e" after minification
```

Write the string literally.

## 3. `captureStackTrace` — V8 only, and optional

MDN's template guards it, and the guard is the point:

```js
if (Error.captureStackTrace) {
  Error.captureStackTrace(this, CustomError);
}
```

It is a **V8 extension** (Node, Chrome), which is why the `if` exists. What it buys is
removing the constructor's own frame from the trace, so the top frame is the line that
*threw* rather than the line inside your error class. Nice, not essential — and since `stack`
is non-standard anyway ([chunk 01](./01-the-error-object.md)), this is polish rather than
correctness.

## 4. Add the data the handler needs

This is the actual value, and the part most implementations under-use:

```js
class ValidationError extends Error {
  constructor(field, value, options) {
    super(`${field} is invalid`, options);
    this.name = "ValidationError";
    this.field = field;                 // machine-readable
    this.value = value;
  }
}
```

Now a handler can do something specific without parsing anything:

```js
} catch (e) {
  if (e instanceof ValidationError) return res.status(400).json({ field: e.field });
  throw e;
}
```

**The test is: what will the `catch` block want to know?** Put exactly that on the error.

## Typed errors at a module boundary

The pattern that pays for itself is a small set of error types exported alongside the
functions that throw them:

```js
// users.js
export class NotFoundError extends Error { … }
export class ConflictError extends Error { … }
export async function getUser(id) { … }
```

The caller imports the classes and branches on them. Three properties follow:

- **The interface is explicit.** The errors are part of the module's exports, like the
  functions.
- **`instanceof` works** — same realm, same module instance
  ([02 · 01](../02-module-semantics/01-singletons-and-strict.md)).
- **Renaming a message cannot break a caller.**

🔴 **The failure mode of this pattern is a class per error.** Twenty error classes is a
taxonomy nobody remembers. Prefer a handful of classes carrying a `code`:

```js
class AppError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "AppError";
    this.code = code;                  // "NOT_FOUND", "CONFLICT", …
  }
}
```

`instanceof AppError` separates *your* failures from bugs; `code` distinguishes among them;
and a new failure mode costs a string rather than a class.

## The `extends Error` transpilation trap

If code is compiled down to ES5 — an old `tsconfig` `target`, an old Babel preset —
`instanceof YourError` can return **`false`**, because ES5 has no way to subclass a built-in
correctly. The historic workaround is:

```js
Object.setPrototypeOf(this, CustomError.prototype);
```

**This is not needed when targeting ES2015 or later**, which is essentially everything now.
It survives in blog posts and copy-pasted base classes, so recognise it as a legacy artefact
rather than something to add. If `instanceof` fails on a modern runtime, look at the realm
question in [chunk 01](./01-the-error-object.md) first — that cause is far more likely today.

## Gotchas

**Symptom:** `cause` is `undefined` on your custom error
**Cause:** The constructor called `super(message)` without `options`.
**Fix:** `super(message, options)` — MDN's own note.

**Symptom:** Your error logs as `"Error: …"` instead of its own name
**Cause:** `name` comes from `Error.prototype`; subclassing does not change it.
**Fix:** `this.name = "NotFoundError"` — as a **literal**, not `this.constructor.name`, which
minifies away.

**Symptom:** `this.constructor.name` gives a single letter in production
**Cause:** Minification renamed the class.
**Fix:** Write the string.

**Symptom:** `Error.captureStackTrace is not a function` in a browser
**Cause:** It is a **V8 extension**.
**Fix:** Guard it, as MDN's template does.

**Symptom:** `instanceof` returns `false` for your own error class
**Cause:** Either a **realm** boundary, or ES5-targeted transpilation of `extends Error`.
**Fix:** Check the realm first on a modern runtime; the `Object.setPrototypeOf` workaround is
only for ES5 targets.

**Symptom:** Twenty error classes and nobody remembers which to catch
**Cause:** A class per failure mode.
**Fix:** A few classes carrying a `code` string. `instanceof` separates yours from bugs;
`code` distinguishes among yours.

**Symptom:** A handler needs information the error does not carry, so it parses the message
**Cause:** The error was built without asking what the `catch` block needs.
**Fix:** Put the machine-readable fields on the error — `field`, `status`, `code`.

## Interview questions

**★ What must a custom error constructor do?**
Call `super(message, options)` — **forwarding `options`, or `cause` is silently dropped** —
and set `this.name`, because `name` comes from `Error.prototype` and subclassing does not
change it. Optionally guard `Error.captureStackTrace`, which is V8-only.

**★ Why not `this.name = this.constructor.name`?**
Minification renames the class, so the name becomes a single letter in production. Write the
string literally.

**★ Why is a custom error class worth having at all?**
So callers branch on the **type** rather than the message. The message is human-facing copy
that will be reworded; a class is a contract, and it can carry machine-readable fields the
handler needs.

**★ When does `instanceof` fail on a custom error?**
Across a **realm** — iframe, worker, `vm` — because the prototype chain came from a different
global. Historically also under ES5-targeted transpilation, which is why
`Object.setPrototypeOf(this, X.prototype)` appears in older code; it is unnecessary when
targeting ES2015+.

**★ Class per error, or one class with a code?**
A handful of classes with a `code` string scales better. `instanceof AppError` separates your
failures from genuine bugs, `code` distinguishes among them, and adding a failure mode costs
a string instead of a class.

**What is `Error.captureStackTrace` for, and where does it work?**
Removing the error constructor's own frame from the stack so the top frame is the throwing
line. It is a **V8 extension**, so MDN's template guards it with an `if`.

---

← Prev [01 · The `Error` object](./01-the-error-object.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
