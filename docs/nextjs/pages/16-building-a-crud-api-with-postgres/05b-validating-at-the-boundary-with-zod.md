---
title: "The schema that validates a request body is not the schema that describes a card, and conflating them is how clients get to set `version`, `createdAt` and `id` — parse at the boundary, into a type the rest of the application is allowed to trust"
sidebar_label: "05b · Validation at the boundary"
sidebar_position: 20
description: "Request schema vs domain schema, why z.object() strips silently and when that is wrong, the coercion and refinement-ordering traps probed on zod 4.4.3, and the three classes of rule a schema structurally cannot check."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Zod v4 documentation — [Basic usage](https://zod.dev/basics), [Defining schemas](https://zod.dev/api), [Error formatting](https://zod.dev/error-formatting) — and the Next.js [data security guide](https://nextjs.org/docs/app/guides/data-security) (`version: 16.3.4`).
> API surface and every behaviour below **probed on the installed package** (`zod` **4.4.3**, `node -e`, version printed alongside); the messages quoted are probe output, not recalled.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · `zod` **4.4.3** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · Node **24.20.0**.

**A validation schema draws a line in your program: on one side is `unknown` that arrived over a socket, on the other is a type the rest of the application may treat as fact. That is the entire value, and it is destroyed the moment the schema on the boundary is the same object as the schema describing your domain — because a domain schema has an `id`, a `version` and a `createdAt`, and a request schema that has those fields is an invitation for a client to set them. This chunk builds the request schema for a card create, shows the four ways zod 4.4.3 will silently accept something you did not mean, and names the three kinds of rule no schema can enforce, which is why [05c](05c-constraint-violations-and-sqlstate.md) exists.**

## Two schemas, and why they are not one schema

The `cards` table has eleven columns. A create request may legitimately supply four of them.

| Column | In the request? | Who owns it |
|---|---|---|
| `id` | no | `defaultRandom()` — unless you deliberately accept a client id, [05e](05e-client-supplied-ids-and-identifier-choice.md) |
| `boardId` | no — it is in the **path** | the URL, validated separately |
| `title` | **yes**, required | the client |
| `body` | **yes**, optional | the client |
| `status` | **yes**, optional, defaults `todo` | the client |
| `position` | **yes**, optional — computed if absent, [05ea](05ea-the-position-value-and-concurrent-creates.md) | client or server |
| `version` | no | topic 07 owns it; a client that can set it can defeat optimistic concurrency |
| `createdAt` | no | `defaultNow()` |
| `updatedAt` | no | `defaultNow()`, then topic 07 |
| `deletedAt` | no | topic 08 owns it; a client that can set it can soft-delete on create |

```ts
// lib/schemas/card.ts
import { z } from 'zod'

export const CardStatus = z.enum(['todo', 'doing', 'done'])

export const CreateCardRequest = z.strictObject({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(10_000).nullish(),
  status: CardStatus.optional(),
  position: z.number().finite().optional(),
})

export type CreateCardInput = z.infer<typeof CreateCardRequest>

// The path parameter is input too, and it is not covered by the body schema.
export const BoardIdParam = z.uuid()
```

Note what is **absent**, and note that this is a different object from any `createSelectSchema(cards)` you might generate from the Drizzle table. A generated schema mirrors the table, which is exactly what you do not want on the boundary: it will grow a field every time the table does, and the day someone adds `internalNotes` it becomes settable by any client that guesses the name.

🔴 **`boardId` is validated separately and this is not pedantry.** The path segment reaches you as an arbitrary string. Hand `'; DROP TABLE'` to a `uuid` column and PostgreSQL raises SQLSTATE `22P02` (`invalid_text_representation`) — a database error for what is a client error, and if your handler maps unknown database errors to 500, an unauthenticated caller can make your error rate spike with a malformed URL. `BoardIdParam.safeParse(boardId)` turns that into a 400 before a connection is checked out.

## `parse` throws, `safeParse` returns — and at a boundary you want the return

```ts
// throws ZodError; useful in a DAL where a bad value is a programming error
const input = CreateCardRequest.parse(raw)

// returns a discriminated union; correct at an HTTP boundary
const parsed = CreateCardRequest.safeParse(raw)
if (!parsed.success) {
  // parsed.error is a ZodError; parsed.error.issues is the array
  return validationFailed(parsed.error)
}
const input = parsed.data // typed CreateCardInput, narrowed by the check above
```

The distinction is not stylistic. A `ZodError` thrown out of a handler joins the same `catch` block as a connection timeout and a constraint violation, and whatever generic mapper sits there has to reverse-engineer which of the three it was. `safeParse` keeps the client-error path out of the exception channel entirely, so the only things reaching your `catch` are failures you did not anticipate.

**The issue shape, probed on 4.4.3.** Each entry in `error.issues` carries the keys `expected`, `code`, `path`, `message`. Two helpers reshape the array; both are top-level functions in v4, not methods:

```ts
import { z } from 'zod'

z.flattenError(parsed.error)
// { formErrors: [], fieldErrors: { title: ['Invalid input: expected string, received number'] } }

z.treeifyError(parsed.error)
// { errors: [], properties: { title: { errors: ['Invalid input: expected string, received number'] } } }
```

Those two objects are probe output from `zod` 4.4.3, printed with `JSON.stringify`. `flattenError` is one level deep and is the right shape for a flat form; `treeifyError` nests and is what you need once a schema has objects inside objects. There is also `z.prettifyError` for a human-readable string — useful in a log line, never in a response body, because the message text is not a stable API.

⚠️ **Do not ship `error.issues` verbatim as your public contract.** The messages are English prose generated by the library and they change between versions — *"Invalid input: expected string, received number"* is a 4.4.3 string, not a promise. Map `issue.path` and `issue.code` into your own field-error shape; the envelope that carries it is argued in [ch7 · Designing the error envelope](../07-error-handling-loading-states-and-resilience/04b-designing-the-error-envelope.md).

## Four ways zod 4.4.3 accepts what you did not mean

Every one of these was probed on the installed 4.4.3.

### 1 · `z.object()` strips unknown keys, silently

```ts
z.object({ title: z.string() }).parse({ title: 'a', id: 'x', version: 99 })
// -> { title: 'a' }
```

The extra keys are **dropped, not rejected**. For a create body that is the safe default — `id` and `version` never reach your insert. But it also means a client that sends `titel` instead of `title` gets a `title is required` error with no hint about the field it actually sent, and a client sending `postion` for `position` gets a card at a position it did not choose, with a 201 and no complaint at all.

`z.strictObject()` (the standalone form of `.strict()`) rejects instead:

```ts
z.strictObject({ title: z.string() }).safeParse({ title: 'a', id: 'x' })
// success: false — issue code 'unrecognized_keys', message 'Unrecognized key: "id"'
```

**Use `strictObject` for a create body.** The cost is that a client sending a field from a newer API version gets a 422 instead of having it ignored, which is a real forward-compatibility trade — but for a first-party API the diagnostic value of *"you sent `postion` and there is no such field"* is worth more than tolerating typos.

### 2 · `z.coerce` turns nothing into zero

```ts
z.coerce.number().safeParse('').data   // -> 0
z.coerce.number().safeParse(null).data // -> 0
```

Both probed. `z.coerce.number()` runs `Number()`, and `Number('')` and `Number(null)` are both `0`. An empty form field becomes a valid `position: 0`, which for the cards resource means the top of the board. Coercion belongs on query strings, where everything genuinely is a string; it does not belong on a JSON body, where a number arrives as a number and a string arriving where a number belongs is information you want.

```ts
// wrong on a JSON body
position: z.coerce.number().optional()
// right — a JSON body has real types; a non-number is a client bug worth reporting
position: z.number().finite().optional()
```

`.finite()` matters: `z.number()` already rejects `NaN` and `Infinity` (probed), but `JSON.parse` cannot produce them anyway, so the guard is really about a schema reused on a non-JSON path.

### 3 · Refinement order changes the result, and one order is silently wrong

```ts
z.string().min(1).trim().safeParse('   ')  // { success: true, data: '' }
z.string().trim().min(1).safeParse('   ')  // success: false
```

Both probed on 4.4.3. Checks run left to right, so `.min(1)` in the first line sees the three spaces, passes, and `.trim()` then produces an empty string that nothing re-checks. **You get a card titled `""` and a 201.** The fix is ordering, and it is one token:

```ts
title: z.string().trim().min(1).max(200)
```

This is worth a test, because both lines type-check identically and read almost identically.

### 4 · `optional` and `nullable` are different holes

`z.string().optional()` accepts `undefined`; `z.string().nullable()` accepts `null`; `.nullish()` accepts both. JSON has no `undefined` — a client omits a key or sends `null` — so on a request body the meaningful pair is *"key absent"* and *"key present and null"*. For `body`, which is a nullable column, `.nullish()` is right: absent means *do not set it*, `null` means *explicitly empty*, and the DAL collapses both with `input.body ?? null`. For a column that is `NOT NULL`, `.optional()` alone is right, because accepting `null` there just moves a 422 into a `23502` from the database.

## The three rules a schema structurally cannot check

This is the part that decides whether topic 05c exists, and it does.

**Uniqueness.** *"No two cards on this board share a title"* is a statement about rows the schema cannot see. Checking it with a `SELECT` before the `INSERT` is a check-then-act race: two concurrent requests both find nothing and both insert. Only a `UNIQUE` constraint decides it, and it reports the decision as SQLSTATE `23505`.

**Referential existence.** *"`boardId` names a board that exists"* is `z.uuid()`'s hard limit — the string is a well-formed UUID and there is no such board. Only the foreign key decides it, as `23503`.

**Authorisation.** The Next.js data-security guide states this in the exact terms that matter here:

> *"Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item` object can still refer to a row the caller does not own."*

A perfectly valid `boardId` belonging to another team passes every check in `CreateCardRequest`. The ownership predicate lives in the Data Access Layer — [04c · The ownership predicate](04c-the-ownership-predicate.md) — and no amount of schema work substitutes for it.

**So the database is your last validator, and it speaks SQLSTATE.** That is [05c](05c-constraint-violations-and-sqlstate.md).

## One schema, two entry points

The schema is a module, and both entry points import it:

```ts
// app/api/boards/[boardId]/cards/route.ts — HTTP
const parsed = CreateCardRequest.safeParse(await request.json())
if (!parsed.success) return Response.json(toEnvelope(parsed.error), { status: 422 })

// app/actions/create-card.ts — Server Action
'use server'
import 'server-only'
export async function createCardAction(boardId: string, form: FormData) {
  const parsed = CreateCardRequest.safeParse({
    title: form.get('title'),
    body: form.get('body'),
    status: form.get('status') ?? undefined,
  })
  if (!parsed.success) {
    // an action has no status code; the failure is a typed return value
    return { ok: false as const, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const card = await createCard(boardId, parsed.data)
  return { ok: true as const, card }
}
```

🔴 **Note the asymmetry, because it is the reason topic 10 exists.** The same validation failure is an HTTP 422 on one path and a plain object on the other; a Server Action has no status code to return. Both call the same `createCard`, so the *rule* is shared and only the *rendering* differs. How that rendering is centralised is [10 · Errors and one response shape](10-errors-and-one-response-shape.md).

Note also that `FormData` values are strings or `File`, never numbers — this is the one place `z.coerce` is defensible, and it is precisely because the transport has no types, not because coercion is generally good.

## Gotchas

**★ Symptom: a card is created with an empty title and the API returned 201.** Cause: `z.string().min(1).trim()` — the length check ran against the untrimmed string and the trim then produced `""`. Probed on 4.4.3: that schema returns `{ success: true, data: '' }` for input `'   '`. Fix: `z.string().trim().min(1)`. Checks apply in written order; put transforms before the assertions that depend on them.

**★ Symptom: a client sends `postion` and gets a 201 with the card at the wrong place.** Cause: `z.object()` strips unknown keys silently, so the typo vanished and `position` fell back to the server-computed value. Fix: `z.strictObject()` on request bodies, which raises `unrecognized_keys` with the message `Unrecognized key: "postion"` — probed. Accept the forward-compatibility cost deliberately.

**★ Symptom: a client sets `version: 500` and optimistic concurrency stops rejecting anything.** Cause: the boundary schema was generated from the Drizzle table, so it has every column the table has, including the ones the server owns. Fix: hand-write the request schema listing only the fields a client may supply. A generated schema is the right tool for a *response* DTO and the wrong tool for a request body — the two grow in opposite directions.

**★ Symptom: an empty form field produces `position: 0`, putting every incomplete card at the top of the board.** Cause: `z.coerce.number()` on `''` yields `0`; probed. Fix: drop coercion on JSON bodies — `z.number().finite().optional()` — and where you genuinely must coerce a `FormData` string, pre-empt the empty case explicitly:

```ts
position: z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().finite().optional(),
)
```

**★ Symptom: a `PATCH` schema built with `.partial()` lets a client clear `title`.** Cause: `.partial()` makes every field optional but does not make it non-nullable, and a `title` of `null` then reaches a `NOT NULL` column. Fix: derive the update schema by picking fields explicitly rather than by blanket `.partial()`, and keep the nullability of each field the same as it is on create. (Topic 07 owns the rest of the update story.)

**★ Symptom: a malformed `boardId` in the URL returns 500.** Cause: the path parameter never went through a schema, so an arbitrary string was passed to a `uuid` column and PostgreSQL raised `22P02` (`invalid_text_representation`, from the class 22 data-exception codes in the [PostgreSQL 18 error-codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html)) — which a generic handler maps to a server error. Fix: validate params as input:

```ts
const { boardId } = await ctx.params
const id = BoardIdParam.safeParse(boardId)
if (!id.success) {
  return Response.json(
    { error: { code: 'invalid_board_id', message: 'boardId must be a UUID' } },
    { status: 400 },
  )
}
```

**★ Symptom: the client's error UI breaks after a dependency bump, with no code change.** Cause: `parsed.error.issues[0].message` was rendered directly, and zod's generated message strings are not a versioned contract. Fix: map `issue.code` and `issue.path` to your own message catalogue on the server, and send that. `z.prettifyError` is for logs.

**★ Symptom: the same bad input is a 422 from the REST endpoint and a thrown error from the Server Action.** Cause: the handler used `safeParse` and the action used `parse`. Fix: use `safeParse` on both, and make the action return a typed failure — an action's caller is a React component, and a thrown error there escalates to an error boundary instead of showing a field-level message.

**★ Symptom: validation passes, the insert succeeds, and the card lands on a board belonging to a different team.** Cause: the schema validated that `boardId` is a UUID, which is a statement about the string, not about the caller's relationship to a row. Fix: nothing in the schema layer fixes this. The ownership predicate is enforced inside the DAL — `await requireBoardAccess(boardId)` before the insert — and that is the whole reason the chapter puts a Data Access Layer between the handler and the driver.

## Interview questions

**★ Why should the schema that validates a POST body not be generated from the table definition?**
Because they answer different questions and they evolve in opposite directions. The table describes everything a row is, including the columns the server owns — `id`, `version`, `createdAt`, `deletedAt`. The request schema describes the strictly smaller set a client is permitted to supply. Generating one from the other means that every column added by a migration is automatically accepted from the network, which is mass assignment with a code generator doing the work. The generated schema is genuinely useful in the other direction, for typing a response DTO, because there the table growing and the response growing are at least plausibly the same event — and even then, only if the projection is explicit.

**★ When is `z.object()`'s silent stripping the right behaviour, and when is it a bug?**
Stripping is right when you are ingesting a document you do not control and only care about a subset — a third-party webhook payload, a config file with vendor extensions. It is a bug on a first-party create endpoint, because there the extra keys are almost always a client mistake, and silently discarding them turns a typo into a successful request with wrong data. The observable difference is what a misspelled field produces: with `object`, a confusing complaint about a *different* field being missing; with `strictObject`, `Unrecognized key: "postion"`, which names the actual problem. The forward-compatibility cost is real but bounded — it only bites when an old server meets a new client, which for a first-party API is a deploy-ordering question you already have.

**★ `parse` or `safeParse` at an HTTP boundary — and does it actually matter?**
`safeParse`, and it matters because of what shares the `catch` block. If validation throws, a `ZodError`, a connection timeout, a unique violation and a genuine bug all arrive at the same handler, and something there has to sort them by `instanceof` — so you have moved a control-flow decision into an exception channel for no gain. With `safeParse` the client-error path returns early and never becomes an exception, and the `catch` block is left holding only the things you did not predict, which is what makes it safe to log those loudly and return 500 for them. `parse` is right in a DAL, where a schema failure means a caller inside your own codebase passed garbage, and that genuinely is an exception.

**★ Name a rule you would rather enforce in zod than in the database, and one that must be in the database.**
Field length is the first: `title` at most 200 characters is cheap to check in the schema, produces a precise field-level message, and rejecting it costs no connection. Duplicating it as a `CHECK` is fine belt-and-braces but the schema is the useful copy. Uniqueness is the second and it *cannot* live in the schema: *"no two cards on this board share a title"* is a statement about other rows, and any pre-flight `SELECT` you write is a check-then-act race that two concurrent requests both win. Only a `UNIQUE` index decides it atomically, and it reports the decision as `23505`. The general rule: a schema can validate the request; only the database can validate the request *against the current state of the world*.

**★ Why is validating the path parameter not redundant when the database will reject a bad UUID anyway?**
Because of what the two rejections cost and what they look like. Validating in the handler costs a regex and produces a 400 that names the parameter. Letting it reach Postgres costs a pool checkout, a round trip, and a `22P02` error that your mapper has probably never seen — so it falls through to the unknown-error branch and becomes a 500. That means an unauthenticated caller can raise your server-error rate and burn connections by sending malformed URLs, and your alerting will be paging on what is really a well-behaved rejection. The general principle is that everything from the network is input, and the URL is from the network.

**★ A schema-validated request creates a row on a board the caller cannot see. Which layer failed?**
None of them, which is the point. The schema did its job — it confirmed the input has the right shape. The database did its job — the foreign key confirmed the board exists. Neither is capable of knowing who the caller is, because neither is given that information. The failure is architectural: the ownership predicate was never expressed anywhere. The Next.js data-security guide says it plainly, that *"A well-formed `Item` object can still refer to a row the caller does not own"*. That is why the chapter puts authorisation inside the Data Access Layer rather than treating validation as a security control.

---

← [05 · CREATE](05-create.md) · [Chapter 16 overview](01-explanation.md) · Next → [05c · Constraint violations and SQLSTATE](05c-constraint-violations-and-sqlstate.md)
