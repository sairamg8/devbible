---
title: "03.1 · The Error object"
sidebar_label: "01 · The Error object"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Error.prototype.stack`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/stack), [`Error.prototype.cause`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause). Documentation-validated.

**An error is an ordinary object with four properties that matter, and one of them is not
standard.**

## The four properties

MDN:

- **`message`** — "Error message. For user-created `Error` objects, this is the string
  provided as the constructor's first argument."
- **`name`** — "Represents the name for the type of error. For `Error.prototype.name`, the
  initial value is `"Error"`. Subclasses like `TypeError` and `SyntaxError` provide their own
  `name` properties."
- **`cause`** — "Error cause indicating the reason why the current error is thrown — usually
  another caught error."
- **`stack`** — "**A non-standard property** for a stack trace."

🔴 **`stack` is non-standard.** Every engine provides it, and every engine formats it
differently. So it is fine for a human to read and fine to ship to a log, but **never parse
it, and never branch on it**. A test that asserts on a stack string is a test that breaks on
a runtime upgrade.

The same warning applies more strongly to `message`, for a different reason: it is *your*
string, and someone will eventually reword it. Which leads to the rule this whole topic
serves.

## Never branch on the message

```js
} catch (e) {
  if (e.message === "User not found") return null;   // ⚠️ breaks on a reword
}
```

Even MDN's own `cause` example, which switches on `err.message`, is illustrating the
*mechanism* rather than recommending the practice — it is a two-case toy. In real code the
message is for humans, and matching on it couples your control flow to your copy. A
translated or reworded message silently changes behaviour, and nothing fails until
production.

**Three better tests, in increasing order of robustness:**

```js
if (e instanceof TypeError) …          // built-in class
if (e instanceof NotFoundError) …      // your own class — see chunk 02
if (e.code === "ENOENT") …             // a code property, works across realms
```

The `code` approach is what Node uses throughout, and it survives the one case `instanceof`
does not: an error crossing a **realm** boundary (an iframe, a worker, a `vm` context) is not
an instance of *your* `Error`, because it came from a different global with a different
prototype chain. A string `code` compares equal regardless.

## The built-in subclasses

MDN's list, with what each actually means when you see it:

| Class | MDN's description | In practice |
|---|---|---|
| **`TypeError`** | "a variable or parameter is not of a valid type" | the one you will see most — calling a non-function, reading a property of `undefined` |
| **`ReferenceError`** | "de-referencing an invalid reference" | undeclared variable, or a TDZ access |
| **`SyntaxError`** | "a syntax error" | parse failures — including `JSON.parse` on bad input |
| **`RangeError`** | "a numeric variable or parameter is outside its valid range" | `new Array(-1)`, `toFixed(101)`, and stack overflow in some engines |
| **`URIError`** | "`encodeURI()` or `decodeURI()` are passed invalid parameters" | rare, and always about percent-encoding |
| **`AggregateError`** | "several errors wrapped in a single error… for example by `Promise.any()`" | see [Phase 7 · 10 · 02](../../phase-7-async/10-combinators/02-race-and-any.md) |
| **`EvalError`** | "regarding the global function `eval()`" | effectively vestigial; not thrown by modern engines |
| **`InternalError`** | "an internal error in the JavaScript engine… E.g. 'too much recursion'" | **non-standard**, SpiderMonkey only |

Two worth knowing precisely:

**`SyntaxError` is thrown at runtime by `JSON.parse`.** It is not only a parse-time error, so
`catch (e) { if (e instanceof SyntaxError) … }` is a legitimate way to detect malformed JSON.

**`AggregateError` carries `.errors`**, an array — the only built-in that reports more than
one failure, and the reason `Promise.any` can tell you why every source failed.

## `cause` — chaining without losing the original

MDN:

> "Pass the original error to the new `Error` in the constructor's `options` parameter as its
> `cause` property"

```js
function doWork() {
  try {
    doFailSomeWay();
  } catch (err) {
    throw new Error("Failed in some way", { cause: err });
  }
}
```

🔴 **This is the fix for the most common error-handling mistake: re-throwing a new error and
discarding the one that told you what actually happened.**

```js
} catch (e) {
  throw new Error("Could not load config");            // ⚠️ the real cause is gone
  throw new Error("Could not load config", { cause: e }); // ✅ both preserved
}
```

The value is that each layer can add the context it has — *"could not load config"* at the
top, *"ENOENT /etc/app.json"* at the bottom — without any layer having to know the whole
story. Walk the chain when reporting:

```js
function chain(e) {
  const out = [];
  for (let cur = e; cur; cur = cur.cause) out.push(`${cur.name}: ${cur.message}`);
  return out.join("\n  caused by: ");
}
```

**`cause` accepts any value, not just an `Error`** — it is whatever you passed. Pass errors.

One trap that belongs with it: when you write your own subclass, **`options` must be
forwarded to `super`** or `cause` is silently dropped. MDN:

> "Need to pass `options` as the second parameter to install the 'cause' property."

```js
class MyError extends Error {
  constructor(message, options) {
    super(message, options);      // ⚠️ omit `options` and every `cause` you pass is lost
  }
}
```

That is covered fully in [chunk 02](./02-custom-errors.md).

## Throwing non-errors

`throw` accepts any value. Doing so costs you everything above:

```js
throw "something went wrong";     // ⚠️ no stack, no name, no cause
throw { code: 500 };              // ⚠️ same
```

A caught string has no `stack`, so you lose the one thing that tells you where it happened;
it is not an `instanceof` anything; and most reporting tools will record it as
`"[object Object]"` or drop it. **Always throw an `Error` or a subclass.**

The defensive corollary, in any `catch` handling values you did not create — a rejected
promise from a library, a message from a worker:

```js
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
}
```

TypeScript makes this unavoidable rather than optional: under `useUnknownInCatchVariables`
(part of `strict`), the catch parameter is `unknown` and must be narrowed before use — which
is the type system encoding exactly this hazard.

## Gotchas

**Symptom:** A test asserting on `e.stack` breaks after a runtime upgrade
**Cause:** MDN: `stack` is **"a non-standard property"**; format varies by engine.
**Fix:** Never parse or assert on it. Assert on `name`, a class, or a `code`.

**Symptom:** Error handling breaks after someone rewords a message
**Cause:** Control flow was branching on `e.message`, which is human-facing copy.
**Fix:** `instanceof`, or a stable `code` property.

**Symptom:** `instanceof` fails for an error that is obviously the right type
**Cause:** It crossed a **realm** — iframe, worker, `vm` context — so its prototype chain
comes from a different global.
**Fix:** Compare a string `code` instead.

**Symptom:** A re-thrown error tells you nothing about the real failure
**Cause:** The original was discarded rather than passed as `cause`.
**Fix:** `throw new Error("context", { cause: e })`, and walk the chain when reporting.

**Symptom:** `cause` is `undefined` on your custom error even though you passed it
**Cause:** The subclass constructor did not forward `options` to `super`.
**Fix:** `super(message, options)` — MDN: *"Need to pass `options` as the second
parameter."*

**Symptom:** A caught value has no `.message` and the logger records `[object Object]`
**Cause:** Something threw a non-`Error`.
**Fix:** Always throw an `Error`; normalise at the boundary with
`e instanceof Error ? e : new Error(String(e))`.

**Symptom:** `JSON.parse` failures are not caught by your `catch (e) { if (e instanceof
SyntaxError) }`… but they should be
**Cause:** They are — `JSON.parse` throws a **`SyntaxError` at runtime**. Check the code path
instead.
**Fix:** Expected behaviour; `SyntaxError` is not only a parse-time class.

## Interview questions

**★ Which `Error` properties can you rely on?**
`message`, `name` and `cause` are standard. 🔴 **`stack` is not** — MDN calls it *"a
non-standard property"*, and every engine formats it differently. Read it, log it, never
parse or assert on it.

**★ How should you distinguish one error from another?**
By class (`instanceof`) or by a stable `code` property — never by `message`, which is
human-facing copy that someone will reword. `code` also survives a **realm** boundary, where
`instanceof` fails because the prototype chain came from a different global.

**★ What is `cause` for?**
Preserving the original error when you re-throw with more context —
`throw new Error("Could not load config", { cause: e })`. Each layer adds what it knows
without needing the whole story, and a reporter walks the `cause` chain.

**★ What breaks `cause` on a custom error class?**
Not forwarding `options` to `super`. MDN: *"Need to pass `options` as the second parameter to
install the 'cause' property."* Omit it and every `cause` is silently dropped.

**★ Why always throw an `Error` rather than a string?**
A string has no `stack`, no `name`, no `cause`, and is not an `instanceof` anything —
reporting tools frequently drop it or record `[object Object]`. Normalise anything you did
not create with `e instanceof Error ? e : new Error(String(e))`.

**Which built-in error carries more than one failure?**
`AggregateError`, via its `errors` array — MDN describes it as *"several errors wrapped in a
single error… for example by `Promise.any()`."*

---

[Topic index](./README.md) · Next → [02 · Custom error classes](./02-custom-errors.md)
