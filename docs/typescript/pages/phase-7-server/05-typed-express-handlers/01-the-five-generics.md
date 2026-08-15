---
title: "The five generics, in order"
sidebar_label: "01 · The five generics"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 by reading the **DefinitelyTyped sources directly** —
> `types/express-serve-static-core/index.d.ts` for `Request`, `Response`,
> `RequestHandler`, `ErrorRequestHandler` and `ParamsDictionary`, and
> `types/qs/index.d.ts` for `ParsedQs`. **Every declaration quoted below is
> verbatim from those files**, not recalled; the generic order and the defaults
> are the whole point of the page, so recalling them would have been the exact
> mistake it warns about. Express **5** is the target. **No sandbox, no console
> block.**

The syllabus row for this topic says *"the `Request` generics (`Params`,
`ResBody`, `ReqBody`, `Query`)"* — four slots. **There are five.** That is a
reasonable place to start, because almost everything written about this API is
one version out of date, and the cost of being one version out of date here is
silent.

## The declaration, verbatim

```ts
Request<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
>
```

Read the order twice, because it is the source of the most common bug on this
page:

| # | Slot | Default | What it types |
|---|---|---|---|
| 1 | `P` | `ParamsDictionary` | `req.params` — the route parameters |
| 2 | **`ResBody`** | `any` | the **response** body |
| 3 | **`ReqBody`** | `any` | `req.body` — the **request** body |
| 4 | `ReqQuery` | `ParsedQs` | `req.query` |
| 5 | `LocalsObj` | `Record<string, any>` | `res.locals` |

🔴 **`ResBody` comes before `ReqBody`.** So the natural-looking thing —

```ts
app.post('/users', (req: Request<{}, CreateUserBody>, res) => {
  req.body.email;      // any — you typed the RESPONSE body
});
```

— types the wrong end of the request, and **says nothing**, because `ReqBody`
falls back to its default of `any` and `any` permits `.email`. There is no
error, no red squiggle, and the property you access does not exist in the type
you wrote.

The correct form needs the third slot, which means naming the first two:

```ts
app.post('/users', (req: Request<ParamsDictionary, unknown, CreateUserBody>, res) => {
  req.body.email;      // string
});
```

📌 Why is the *response* body on the **request** type at all? Because `Request`
and `Response` are typed as a pair — `RequestHandler` threads one set of
parameters through both, so `res.json()` can be checked against the same
`ResBody`. It is a sensible design that produces a confusing parameter order.

## What the defaults actually give you

This is the part that matters more than the ordering, because it is true of
every handler nobody annotated — which is most of them.

### `req.body` is `any`

`ReqBody = any`. So in an unannotated handler:

```ts
app.post('/users', (req, res) => {
  const email: string = req.body.email;        // no error, no check
  const age: number = req.body.email;          // also no error
});
```

🔴 **The most untrusted value in the entire program is typed `any` by default.**
Everything phase 7 has argued so far — the annotation is a claim, not a check —
applies here at maximum strength, and worse: there is not even a claim. `any`
disables checking rather than asserting something false.

That is [chunk 02](./02-a-promise-the-compiler-cannot-keep.md)'s subject.

### `req.params` is not `string`

```ts
export interface ParamsDictionary {
    [key: string]: string | string[];
    [key: number]: string;
}
```

⚠️ `req.params.id` is **`string | string[]`**, not `string`. Repeated route
parameters can produce an array, and the current declaration reflects that. Code
that does `parseInt(req.params.id, 10)` fails to compile once you look at it
honestly — and code that compiled under an older `@types/express` was relying on
a declaration that has since been corrected.

The way to get a `string` is to say which route you are on:

```ts
app.get('/users/:id', (req: Request<{ id: string }>, res) => {
  req.params.id;      // string
});
```

Naming `P` explicitly is worth doing on every parameterised route. It is the one
generic slot where the annotation is genuinely *more* accurate than the default,
because the route pattern is a fact the type system cannot see and you can.

### `req.query` is a recursive union

```ts
interface ParsedQs {
    [key: string]: undefined | string | ParsedQs | (string | ParsedQs)[];
}
```

`req.query.page` is `undefined | string | ParsedQs | (string | ParsedQs)[]`.
That is not pedantry — it is what `qs` can actually produce. `?page=1` gives a
string; `?page=1&page=2` gives an array; `?page[n]=1` gives a nested object.

**Every one of those is attacker-controlled**, which is the real reason the type
is that wide. A handler that assumes `req.query.page` is a string is one query
string away from `parseInt(anObject)`.

📌 The honest response is not to annotate `ReqQuery` into a lie. It is to
**parse** — chunk 02, and phase 9.

### `res.locals` is `Record<string, any>`

The fifth slot, and the one the syllabus row omits. `res.locals` is a per-request
scratch space, typed as a bag of `any`. Typing it is the same declaration-merging
question as `req.user`, which is **topic 06** *(not written yet)*.

## `RequestHandler` — the alternative spelling

```ts
export interface RequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
> {
    (
        req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
        res: Response<ResBody, LocalsObj>,
        next: NextFunction,
    ): unknown;
}
```

Same five parameters, threaded through both `req` and `res`. Annotating the
*handler* rather than the *parameter* is usually better:

```ts
const createUser: RequestHandler<ParamsDictionary, UserResponse, CreateUserBody> =
  (req, res) => { … };

app.post('/users', createUser);
```

Two advantages that are worth the extra keystrokes:

- **`req`, `res` and `next` are all inferred**, so you never annotate `res` or
  forget `next`.
- **`res.json()` is checked against `ResBody`**, because `Response<ResBody, …>`
  received the same parameter. That is the payoff for the confusing order — and
  it is real: returning the wrong shape becomes a compile error at the one place
  it can be caught.

⚠️ Note the return type: **`unknown`**, not `void`. That is deliberate in the v5
declarations and it changes what you may return from a handler — including an
`async` function's promise. The consequences are **topic 09 · Async handlers**
*(not written yet)*.

## 🔴 `ErrorRequestHandler` hands you `any`

```ts
export type ErrorRequestHandler<
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs,
    LocalsObj extends Record<string, any> = Record<string, any>,
> = (
    err: any,
    req: Request<P, ResBody, ReqBody, ReqQuery, LocalsObj>,
    res: Response<ResBody, LocalsObj>,
    next: NextFunction,
) => unknown;
```

**`err: any`.** In the one function in an Express application whose entire job is
to handle a value of unknown provenance, the type is `any` —
[topic 04](../04-catch-e-unknown/01-proving-it-on-a-server.md) spent a chunk
explaining why that is the mistake, and here the framework's own declaration
makes it for you.

It cannot be otherwise: `next(err)` accepts anything, so the parameter genuinely
is unknown-provenance. But `any` and `unknown` model that differently, and only
one of them makes you prove what you have.

The fix costs nothing, because a parameter may always be *narrower* than the
type it satisfies:

```ts
const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (isAppError(err)) { … }
};
```

Annotating `err: unknown` still satisfies `err: any`, and restores every guard
from topic 04. **Do this in every Express application you write.**

The four-argument arity that makes Express treat this as an error handler at all
is not something TypeScript can enforce — that is **topic 08 · Typed middleware**
*(not written yet)*.

## Gotchas

**Symptom:** you typed the request body and `req.body` is still `any`.
**Cause:** the annotation landed in `ResBody`, the second slot. `ReqBody` is
third and fell back to `any`.
**Fix:** `Request<ParamsDictionary, unknown, MyBody>`, or annotate the handler
with `RequestHandler<…>` so the slots are named in one place.

**Symptom:** `parseInt(req.params.id, 10)` stopped compiling after a
`@types/express` bump.
**Cause:** `ParamsDictionary` indexes to `string | string[]`. The older
declaration was wrong, not the new one.
**Fix:** name `P` for the route — `Request<{ id: string }>` — which is both more
accurate and more readable than a cast.

**Symptom:** `req.query.page` behaves like a string in development and is an
object in production.
**Cause:** `qs` parses `?page[x]=1` into a nested object, and `?page=1&page=2`
into an array. `ParsedQs` says so; the code assumed otherwise.
**Fix:** parse the query rather than annotating it.

**Symptom:** `res.json(...)` accepts any shape at all.
**Cause:** `ResBody` defaults to `any`, and nothing supplied it.
**Fix:** annotate the handler with `RequestHandler<P, ResponseShape, …>`; the
same parameter reaches `Response`, and `res.json` is checked.

**Symptom:** the error handler compiles happily while doing `err.message`.
**Cause:** `ErrorRequestHandler` declares `err: any`.
**Fix:** annotate the parameter `err: unknown`. It is legal — a narrower
parameter type still satisfies the signature.

## Interview questions

**What is the order of `Request`'s type parameters, and why does getting it
wrong fail silently?**
`P`, `ResBody`, `ReqBody`, `ReqQuery`, `LocalsObj`. Writing
`Request<{}, MyBody>` types the *response* body, and `ReqBody` then falls back
to its default of `any` — so `req.body.anything` still compiles. There is no
error because `any` permits every access; the annotation simply had no effect
where you intended it.

**What is `req.body` typed as in a handler nobody annotated, and why does that
matter more than the ordering trap?**
`any`, from `ReqBody = any`. It matters more because `any` disables checking
rather than making a false claim — the most untrusted value in the program is
the least checked, and no annotation is required for that to be true.

**Why is `req.params.id` not a `string`?**
`ParamsDictionary`'s string index signature is `string | string[]`, because a
repeated parameter can produce an array. Supplying `P` explicitly for the route
— `Request<{ id: string }>` — is the accurate fix, and it encodes the route
pattern, which the type system otherwise cannot see.

**Express's own `ErrorRequestHandler` types `err` as `any`. What do you do?**
Annotate the parameter `unknown` in your own handler. A narrower parameter type
still satisfies the signature, so it compiles, and it restores the "prove what
you caught" discipline in the one function whose whole purpose is handling a
value of unknown provenance.

---

← [Topic index](./README.md) · Next → [02 · A promise the compiler cannot keep](./02-a-promise-the-compiler-cannot-keep.md)
