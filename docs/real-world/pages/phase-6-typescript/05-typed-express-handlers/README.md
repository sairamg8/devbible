---
title: "Typed Express handlers and middleware"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against **`@types/express-serve-static-core` 5.1.3** read
> directly in this repo — the `global.Express` namespace, `Request`,
> `RequestHandler`, `ErrorRequestHandler`, `Locals`, `ParamsDictionary` — the
> TypeScript handbook's
> [declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
> and the Express guide on
> [error handling](https://expressjs.com/en/guide/error-handling.html).
> Target: **TypeScript 7.0.2**, Express **5**, Node **24.19.0**, zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**Express hands every handler one global `Request` type, so the choice is to
extend it once by declaration merging or to cast in every handler.** This
chapter makes the first choice and then follows it through the three places it
bites: the three routes that cannot use
[chapter 02's route helper](../02-zod-as-the-source-of-truth/03b-the-route-helper.md)
and need the raw generics, middleware and `res.locals`, and the error handler —
the one function whose *arity* Express reads at runtime and TypeScript cannot
see.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Merging, not casts](01-declaration-merging-not-casts.md)** | The `global.Express` namespace and why `Request` is extended by merging, not by subclassing; the session and user fields declared once; 🔴 the cast parade the merge replaces |
| 2 | **[The five generics](02-the-five-generics-in-practice.md)** | `Request<P, ResBody, ReqBody, ReqQuery, Locals>` for the three routes the helper cannot type; 🔴 the parameter order the compiler will not check; `ParsedQs` and why `req.query` is never a string |
| 3 | **[Typed middleware](03-typed-middleware.md)** | Middleware typed by the constant it is assigned to; the session resolver and the role gate with one annotation each; `next()` and the Express 5 promise rule |
| 3b | **[`res.locals`](03b-res-locals.md)** | Two type sources that intersect — the global `Locals` merge and the fifth generic; narrowing a nullable local for one handler |
| 3c | **[The error contract, typed](03c-the-typed-error-handler.md)** | `unknown` in, the shared `ErrorBody` out; the two generics the handler needs; an error code outside the union cannot compile |
| 3d | **[Classify and the handler](03d-the-classify-table-and-the-handler.md)** | The classify table needs type guards where the JavaScript had dots; a handler written so no path through it can throw |
| 3e | **[The arity trap](03e-the-arity-trap.md)** | 🔴 Express identifies an error handler by counting declared parameters; TypeScript cannot count them; the three-parameter error handler that compiles and is never called |

## The four sentences to keep

1. **Merge once, cast never.** A field every handler reads is declared on
   `Express.Request` in one file, or it is cast in every file.
2. **The generics are positional and the compiler does not care which
   position you meant.** Name them with a type alias per route.
3. **`res.locals` is an intersection**, so the global merge and the fifth
   generic both apply, and a nullable local narrows per handler.
4. **Arity is runtime, types are compile time.** An error handler is the one
   signature you spell out in full, unused parameter and all.

## Phase gate

You are done with this topic when you can extend `Request` without a cast and
say which file owns the merge, write a route with the raw generics and name
what each position is, type a middleware by its assignment, narrow a
`res.locals` field for one handler, write the error handler against the shared
`ErrorBody` and explain why deleting its fourth parameter silently breaks it.

## Where this connects

Backwards to
[the route helper](../02-zod-as-the-source-of-truth/03b-the-route-helper.md),
which types the routes this chapter's generics do not have to, and to
[the transition table](../04-discriminated-unions/02-the-transition-table.md),
whose guard becomes an endpoint here. Forwards to
[Typing the custom hooks](../06-typing-the-custom-hooks/README.md), where the same `AsyncState`
discipline applies on the client, and to
[The typed API client](../07-the-typed-api-client/README.md), which consumes the `ErrorBody`
this chapter's error handler produces.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
← Prev chapter: [Discriminated unions](../04-discriminated-unions/README.md) ·
Next chapter → [Typing the custom hooks](../06-typing-the-custom-hooks/README.md)
