---
title: "Express identifies an error handler by counting its declared parameters, TypeScript cannot count them, and a three-parameter error handler compiles and runs on every successful request instead"
sidebar_label: "03e · The arity trap"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Express guide on
> [error handling](https://expressjs.com/en/guide/error-handling.html), the
> `fn.length` tests in `lib/router/layer.js` of the `express` copy in this
> repo (a **4.22.2** transitive install — the Express 5 `router` package is not
> present here, and the guide's four-argument rule is what is cited for 5),
> the MDN reference for
> [`Function.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/length),
> and **`@types/express-serve-static-core` 5.1.3**. **TypeScript 7.0.2**,
> Express **5**. Concept home:
> [TypeScript 1·08 — function types](../../../../typescript/pages/phase-1-type-vocabulary/08-function-types.md)
> for why fewer parameters are assignable.

**The one thing Express actually checks about an error handler is the one
thing its type cannot express.** The guide, verbatim: *"error-handling
functions have four arguments instead of three: `(err, req, res, next)`."*
That is not a convention — it is how the router *identifies* an error
handler, by reading the function's declared parameter count at run time. A
TypeScript function with three parameters is assignable to a four-parameter
function type, so the handler that breaks this rule compiles cleanly, is
never given an error, and is run as ordinary middleware on every request that
succeeded.

## How the router decides

From `lib/router/layer.js` in the `express` copy in this repo:

```js
Layer.prototype.handle_error = function handle_error(error, req, res, next) {
  var fn = this.handle;

  if (fn.length !== 4) {
    // not a standard error handler
    return next(error);
  }
  …
};

Layer.prototype.handle_request = function handle(req, res, next) {
  var fn = this.handle;

  if (fn.length > 3) {
    // not a standard request handler
    return next();
  }
  …
};
```

Two complementary tests. A layer whose handler declares exactly four
parameters is offered errors and skipped on success; a layer whose handler
declares three or fewer is offered successes and skipped on errors. There is
no registration flag, no `app.useError` — the count is the whole signal.

`fn.length` is the number of declared parameters **before the first one with
a default value or a rest parameter** — MDN's description of
`Function.prototype.length`. Three consequences follow, and each is a way to
break a handler without changing a type.

## The TypeScript half: fewer parameters are assignable

```ts
// ✗ compiles, and is not an error handler
const broken: ErrorRequestHandler = (err: unknown, req, res) => {
  res.status(500).json({…});
};
```

A function with fewer parameters is assignable to a function type with more —
the same rule that lets `[1, 2].map(x => x * 2)` ignore the index argument —
so the assignment type-checks. At run time `broken.length` is 3, so
`handle_error` skips it, and `handle_request` *runs it on every normal
request* with `req` in the `err` slot, `res` in the `req` slot and `next` in
the `res` slot; `res.status` is then `next.status`, which is `undefined`, and
the throw lands in the real error handler — if there is one — as a
`TypeError`. The symptom is every route in the application failing with an
`INTERNAL` after the error handler was "fixed".

How three-parameter error handlers get written: a linter flags `next` as
unused and someone deletes it, or an autofix does. The fix is the underscore
convention *and* the ESLint rule that honours it:

```ts
(err: unknown, req, res, _next) => { … }   // length is still 4
```

```jsonc
// eslint.config.js — the rule that makes `_next` not a warning
"@typescript-eslint/no-unused-vars": ["error", {"argsIgnorePattern": "^_"}]
```

## The other three ways to change `length`

**A default value.** `(err, req, res, next = noop)` has `length` 3 —
parameters after the first default are not counted — so "defaulting" the
fourth parameter to silence a lint rule breaks the handler as surely as
deleting it.

**A rest parameter.** `(...args: [unknown, Request, Response, NextFunction])`
is the closest TypeScript can come to "exactly four", and its `length` is
**0**: rest parameters are not counted. A tuple-typed rest is the right
*type* and the wrong *function*.

**A wrapper.** Every generic wrapper reduces to one of the two above:

```ts
// ✗ the wrapped function has length 0 — it is a rest parameter
const timed = (h: ErrorRequestHandler): ErrorRequestHandler =>
  (...args) => { const t = Date.now(); try { return h(...args); } finally { … } };

// ✗ bind() subtracts the bound arguments: (config, err, req, res, next).bind(null, cfg) has length 4 — fine —
//   but a second bound argument makes it 3
const handler = errorHandlerWith.bind(null, config, tracker);

// ✓ a wrapper that names all four
const timed = (h: ErrorRequestHandler): ErrorRequestHandler =>
  (err, req, res, next) => { const t = Date.now(); try { return h(err, req, res, next); } finally { … } };
```

`Function.prototype.bind` produces a function whose `length` is the target's
length minus the number of bound arguments, floored at zero — MDN again. A
factory that *returns* an arrow with four named parameters, which is what
[03d](03d-the-classify-table-and-the-handler.md) does with
`errorHandler({config})`, has no such problem: the closure captures `config`
and the returned function's length is 4.

## What can enforce it

🔴 **Nothing in `@types/express-serve-static-core` can.** TypeScript has no
type for "a function whose `.length` is 4"; parameter arity is not part of
assignability in the direction that matters. The concept page filed the
enforcement under a topic it dropped. In this codebase it is three things:

1. **The parameter is named.** Every `ErrorRequestHandler` names all four,
   the unused one `_next`, and the lint config accepts the prefix.
2. **A unit test on the export.** `expect(errorHandler(deps).length).toBe(4)`
   is a one-line test that fails the moment anyone defaults, rests or wraps
   the function. It is the only place in the codebase that tests `length`,
   and the comment above it links here.
3. **The integration test.** A route that throws, a request to it, an
   assertion that the body is JSON with a `code`. This catches the arity trap
   *and* the mount-order trap, because both produce HTML from the default
   handler.

## Gotchas

**★ Assigning a three-parameter function to `ErrorRequestHandler` compiles and
turns it into middleware that runs on every successful request.** Fewer
parameters are assignable to more, and Express selects on `fn.length`. Name all
four, prefix the unused one with `_`, and configure the linter to accept the
prefix rather than deleting the parameter.

**★ A default value on the fourth parameter has the same effect as deleting
it.** `Function.length` counts parameters before the first default. `next =
noop` makes the handler's length 3.

**★ A rest-parameter wrapper has `length` 0 and silently un-registers the
handler it wraps.** `(...args) => h(...args)` is the natural shape for a
timing or tracing wrapper, and it converts an error handler into a
zero-parameter middleware that runs on every request and never on an error.
Wrappers around error handlers name all four parameters.

**★ `bind` subtracts bound arguments from `length`.** Pre-binding two
dependencies onto a five-parameter function leaves a three-parameter
function. Use a factory that closes over its dependencies and returns a
four-parameter arrow.

**★ The failure mode is not "errors are not handled" — it is "every
successful request fails".** Because a three-parameter handler is run as
ordinary middleware with the arguments shifted, the first symptom is that
every route returns a 500 (or hangs, if the shifted `res` is never used). The
error handler is usually the last thing anyone suspects, because it was just
"cleaned up".

**★ The same count applies in reverse to ordinary middleware.**
`handle_request` skips any layer whose handler has more than three parameters.
A `RequestHandler` written `(req, res, next, extra)` — a leftover from a
refactor — is never run on any request and is silently offered errors
instead. It compiles, because an extra parameter is a *wider* signature only
in the direction TypeScript does not check for callbacks.

## Interview questions

**★ How does Express know a function is an error handler, and what can
TypeScript do about it?**
By `fn.length === 4` — the router's `handle_error` skips any layer whose
handler declares fewer than four parameters, and `handle_request` skips any
with more than three. TypeScript can do nothing: a shorter function is
assignable to a longer function type, and there is no type for "declared
parameter count". A three-parameter `ErrorRequestHandler` compiles, is never
given an error, and runs on every successful request with the arguments
shifted one slot. The defence is naming all four parameters, an ESLint
`argsIgnorePattern` for `_next`, a unit test on `.length`, and an integration
test that throws from a route and asserts a JSON body.

**★ What changes a function's `length` besides deleting a parameter?**
A default value — parameters from the first default onward are not counted;
a rest parameter — not counted at all, so `(...args)` has length 0; and
`bind`, which subtracts the number of bound arguments. All three are common
ways to "tidy" an error handler, and all three un-register it.

**★ Why does a broken error handler show up as every route failing rather
than as errors going unhandled?**
Because a function with three declared parameters is, to the router, an
ordinary middleware. It runs on every successful request, receiving `(req,
res, next)` in parameters named `(err, req, res)`, and the first property
access on the misnamed `res` throws. The throw reaches whatever error handler
remains — the default one, if this was the only one — and the site is down.

**★ Can you write a TypeScript type that requires exactly four parameters?**
No, in the direction that matters. `(...args: [A, B, C, D]) => R` describes
the call site precisely, but an implementation with fewer parameters remains
assignable to it, and an implementation written with a rest parameter to
match it has `length` 0. Arity is a runtime property of the function object;
the closest static check is a lint rule, and the honest check is a unit test
on `.length`.

**★ You are asked to add request timing around the error handler. How do
you wrap it without breaking it?**
With a wrapper that names all four parameters and forwards them — `(err,
req, res, next) => { …; return h(err, req, res, next); }` — never with
`(...args)`. And the wrapped export keeps the `.length` unit test, so a later
refactor to a rest wrapper fails the suite rather than the site.

---

← Prev: [The classify table and the handler](03d-the-classify-table-and-the-handler.md) ·
[Overview](README.md) ·
Next chapter → [Typing the custom hooks](../06-typing-the-custom-hooks/README.md)
