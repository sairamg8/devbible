---
title: "A promise the compiler cannot keep"
sidebar_label: "02 · A promise it cannot keep"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **DefinitelyTyped sources** read directly —
> `ReqBody = any` and `body: ReqBody` in
> `types/express-serve-static-core/index.d.ts` — and the **Express 5
> documentation** for `express.json()` and the body-parsing middleware. The
> schema shape is written against **Zod**'s documented `parse` / `safeParse` /
> `z.infer` API; the argument does not depend on which library you pick.
> **No sandbox, no console block.**

[Chunk 01](./01-the-five-generics.md) established the mechanics: five generic
slots, `ReqBody` third, everything defaulting to `any`. This chunk is about the
one that matters, and it is the sentence in the syllabus row:

> **A typed request body is a promise the compiler cannot keep.**

## Where the body comes from

```ts
app.use(express.json());
```

That middleware reads bytes off the socket, and calls `JSON.parse`. The result is
assigned to `req.body`. Nothing between the network and that assignment has any
idea what shape your application expects.

So when you write:

```ts
const createUser: RequestHandler<ParamsDictionary, UserResponse, CreateUserBody> =
  (req, res) => {
    req.body.email.toLowerCase();      // string, says the compiler
  };
```

…you have told the compiler that the output of `JSON.parse` on
attacker-controlled bytes has the shape `CreateUserBody`. **`ReqBody` is
`as CreateUserBody`, spelled as a generic argument.**

📌 This is the *same* mechanism as
[topic 03's `ProcessEnv` augmentation](../03-typing-process-env/02-augmenting-processenv.md),
in a place where the data is far less trustworthy. Environment variables come
from your own deployment; a request body comes from the internet.

Send `{"email": 42}` and `req.body.email.toLowerCase()` throws
`TypeError: req.body.email.toLowerCase is not a function` — from a line the
compiler declared safe. Send `{}` and it throws on `undefined`. Neither is a
TypeScript bug; the compiler did exactly what it was told.

## Why `any` is worse, and why it is the default

Chunk 01 noted that the *default* is `any`, not a false claim. Both are bad, and
they are bad differently:

| | What it does | The failure |
|---|---|---|
| `ReqBody` left as `any` | disables checking | `req.body.emial` compiles. So does `req.body.email.toFixed(2)` |
| `ReqBody = CreateUserBody` | asserts a shape | typos are caught, but the shape is still unverified at runtime |

The annotation is a genuine improvement — it catches *your* mistakes. It just
does not catch *theirs*. That distinction is worth being precise about, because
"annotating the body is pointless" is the wrong lesson.

⚠️ The annotated version is also **more dangerous in one specific way**: it
looks safe. `any` at least makes a reader nervous. A confident
`RequestHandler<…, CreateUserBody>` reads like validation happened somewhere,
and reviewers stop asking.

## The shape that works: parse at the edge

The fix is the one topic 03 chunk 03 argued for, applied one boundary further
out — and it is the same three moves.

```ts
const CreateUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  age: z.number().int().positive().optional(),
});

type CreateUserBody = z.infer<typeof CreateUserBody>;

app.post('/users', (req, res, next) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) return next(new ValidationError(parsed.error));

  //  parsed.data: CreateUserBody — earned, not asserted
  createUser(parsed.data);
});
```

What changed is small and total:

1. **`req.body` stays `unknown`-ish and is read exactly once**, by the parser.
2. **`parsed.data` is typed because a check succeeded**, not because someone
   annotated a generic slot.
3. **The type is derived** — `z.infer<typeof CreateUserBody>` — so the validator
   and the type cannot drift apart.

🔴 **Do not annotate `ReqBody` *and* parse.** Pick one:

```ts
// ✗ the annotation is now actively misleading
const h: RequestHandler<ParamsDictionary, unknown, CreateUserBody> = (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);   // parsing something already "typed"
};
```

If a reader sees `ReqBody` supplied, they will assume `req.body` is trustworthy
somewhere upstream. Leaving it at its default and parsing makes the untrusted
step visible — which is the point.

📌 **The strongest version of this is to make `req.body` `unknown` deliberately.**
`RequestHandler<ParamsDictionary, ResponseShape, unknown>` types the body as
`unknown`, so *nothing* can touch it without narrowing. That is one generic
argument that turns the framework's most dangerous default into its safest, and
it costs nothing.

## Validation middleware, and where its type comes from

Doing this per-handler gets repetitive, so it becomes middleware — and the
interesting part is how the *type* survives the trip.

```ts
function validate<S extends z.ZodType>(schema: S) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(new ValidationError(parsed.error));
    res.locals.body = parsed.data;
    next();
  };
}
```

⚠️ **This is where the type is usually lost.** `res.locals` is
`Record<string, any>` (chunk 01's fifth generic), so `res.locals.body` in the
next handler is `any` — you validated, and then threw the result into an
untyped bag.

Two ways out, and both belong to later topics:

- **Type `res.locals`** via the `LocalsObj` generic, or by declaration merging —
  **topic 06** *(dropped 2026-08-15)*, the same mechanism as `req.user`.
- **Keep the parse in the handler** where its result is a local with a real
  type, and let the middleware only *reject*, not *pass values along*.

The second is simpler and it is what most well-typed Express codebases end up
doing. Middleware that transforms typed data across a `next()` boundary fights
the framework's own typing, and **topic 08 · Typed middleware** *(not written
yet)* is where that fight is documented properly.

## `ResBody` is the slot that actually delivers

An honest counterweight to a chunk that is mostly warnings: the **response**
body generic is checkable, and it works.

```ts
type UserResponse = { id: string; email: string };

const getUser: RequestHandler<{ id: string }, UserResponse> = (req, res) => {
  res.json({ id: req.params.id, emial: '…' });   // error: 'emial' does not exist
};
```

Because `RequestHandler` threads `ResBody` into `Response<ResBody, …>`,
`res.json` is checked against it. Nothing untrusted is involved — the response
is data *you* produced — so the type is a real guarantee rather than a claim.

📌 **The asymmetry is the lesson of the whole topic.** The same generic
mechanism is a guarantee on the way out and an assertion on the way in, because
one end of the request is your code and the other is the network. Typing helps
exactly where you control the data.

This is also the argument for keeping the response type separate from the domain
type — **topic 11 · DTOs vs domain types vs row types** *(dropped 2026-08-15)*.

## Gotchas

**Symptom:** `req.body.email.toLowerCase is not a function` on a line with no
type error.
**Cause:** `ReqBody` was supplied, so the compiler believes the shape. The
request sent a number.
**Fix:** parse; do not annotate. Or annotate `unknown` and narrow.

**Symptom:** validation middleware runs, and the handler still sees `any`.
**Cause:** the parsed value was stashed on `res.locals`, which is
`Record<string, any>`.
**Fix:** parse in the handler where the result is a typed local, or type
`res.locals` deliberately.

**Symptom:** a field was renamed in the schema and a handler still reads the old
name, with no error.
**Cause:** the handler's type came from a hand-written interface rather than
from `z.infer<typeof Schema>`, so the two drifted.
**Fix:** derive the type from the schema. One source of truth.

**Symptom:** reviewers stopped questioning a handler after it was "typed".
**Cause:** a supplied `ReqBody` reads as evidence that validation exists.
**Fix:** leave `ReqBody` as `unknown` and make the parse the visible step. The
type should describe what is *known*, not what is *hoped*.

**Symptom:** `res.json()` returns a shape the client did not expect and nothing
caught it.
**Cause:** `ResBody` was never supplied, so it defaulted to `any`.
**Fix:** supply it. This is the one slot with a real payoff, since the data is
yours.

## Interview questions

**Why is a typed request body "a promise the compiler cannot keep"?**
Because `req.body` is the output of `JSON.parse` on bytes from the network, and
supplying `ReqBody` is an assertion about that value — the generic argument is
`as CreateUserBody` in a different syntax. Nothing verifies it, so a request
sending `{"email": 42}` produces a runtime `TypeError` on a line the compiler
declared safe.

**Is annotating the body therefore pointless?**
No — it catches *your* mistakes: typos, wrong property types, fields you forgot.
It does not catch the client's. The real objection is that it *looks* like
validation, so reviewers stop asking whether any happened. Leaving `ReqBody` as
`unknown` and parsing makes the untrusted step visible.

**Why is `ResBody` a real guarantee when `ReqBody` is not?**
Because the response body is data your code produces, so checking it against a
declared shape is checking your own work — the compiler has full information.
The request body originates outside the program, where the compiler has none.
Same mechanism, opposite epistemics.

**Your validation middleware parses the body and the handler still gets `any`.
Why?**
It almost certainly passed the result through `res.locals`, which is typed
`Record<string, any>`. The validation happened and the type was discarded one
line later. Either type `res.locals`, or keep the parse in the handler where the
result is a properly typed local.

---

← [01 · The five generics](./01-the-five-generics.md) · Next → [Phase 7 index](../README.md)
