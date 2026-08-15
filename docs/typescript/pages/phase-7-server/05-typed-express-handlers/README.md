---
title: "Typed Express handlers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 by reading the **DefinitelyTyped sources directly** —
> `types/express-serve-static-core/index.d.ts` (`Request`, `Response`,
> `RequestHandler`, `ErrorRequestHandler`, `ParamsDictionary`) and
> `types/qs/index.d.ts` (`ParsedQs`). Every declaration on these pages is
> **quoted verbatim** rather than recalled — the generic *order* and the
> *defaults* are the subject, so recalling them would have been the exact
> mistake the topic warns about. Express **5**. **No sandbox, no console block.**

The topic where phase 7's thesis meets the framework most people actually use,
and where the framework's defaults are working against it.

Two claims, one per chunk:

> **There are five generic slots, not four, and `ResBody` comes before
> `ReqBody`.** Getting the order wrong fails **silently**, because the slot you
> meant falls back to `any` and `any` permits everything.
>
> **A typed request body is a promise the compiler cannot keep.** `ReqBody` is
> `as CreateUserBody` written as a generic argument, applied to the output of
> `JSON.parse` on bytes from the network.

And the asymmetry that ties them together:

> **The same generic mechanism is a guarantee on the way out and an assertion on
> the way in** — `ResBody` checks data your code produced; `ReqBody` claims a
> shape for data the internet sent. Typing helps exactly where you control the
> data.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [The five generics](./01-the-five-generics.md) | The verbatim declaration and the order trap; what the defaults really give you — `req.body` as `any`, `req.params` as `string \| string[]`, `req.query` as a recursive union; `RequestHandler` vs annotating the parameter; the `unknown` return type; and `ErrorRequestHandler` handing you `any` |
| 02 | [A promise it cannot keep](./02-a-promise-the-compiler-cannot-keep.md) | Where `req.body` comes from and why supplying `ReqBody` is an assertion; why `any` and a false claim fail differently; parse-at-the-edge with `z.infer`; why validation middleware usually loses the type on `res.locals`; and why `ResBody` is the slot that actually delivers |

## Phase gate

You are done when you can write a handler in which **`req.body` is `unknown`
until a parse succeeds, and `res.json` is checked against a declared response
type** — and when, shown `Request<{}, CreateUserBody>`, you can say immediately
which end of the request that types and why nothing errors.

The tell that it has not landed: `RequestHandler<…, CreateUserBody>` with no
validation anywhere, which reads as safe and is not.

## Where this connects

- **← [03 · Typing `process.env`](../03-typing-process-env/README.md)** — the
  same assertion-versus-check argument, one boundary further in. `ReqBody` is to
  a request body what a `ProcessEnv` augmentation is to an environment variable.
- **← [04 · `catch (e: unknown)`](../04-catch-e-unknown/README.md)** — why
  `ErrorRequestHandler`'s `err: any` is worth overriding to `unknown` in every
  application you write.
- **← [Phase 3 · Generics](../../phase-3-generics/README.md)** —
  `Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>` is a five-parameter
  generic wearing domain names, and the defaults are
  [default type parameters](../../phase-3-generics/08-default-type-parameters.md)
  doing exactly what that page describes.
- **→ 06 · Augmenting `Express.Request`** *(dropped 2026-08-15)* — `req.user` and
  `res.locals`, by declaration merging.
- **→ 08 · Typed middleware** *(dropped 2026-08-15)* — the four-argument error
  handler arity TypeScript cannot enforce, and carrying typed data across
  `next()`.
- **→ 09 · Async handlers** *(dropped 2026-08-15)* — what the `unknown` return type
  on `RequestHandler` permits, and Express 5's rejected-promise forwarding.
- **→ 11 · DTOs vs domain types vs row types** *(dropped 2026-08-15)* — why the
  response type is not the domain type.

---

← [Phase 7 index](../README.md) · Start → [01 · The five generics](./01-the-five-generics.md)
