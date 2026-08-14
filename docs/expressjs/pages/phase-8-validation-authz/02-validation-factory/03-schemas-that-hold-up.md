---
title: "Schemas that hold up"
sidebar_label: "03 · Schemas that hold up"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**One schema per operation, not one per resource — because `POST` requires every
field, `PATCH` requires none, and a schema that serves both requires nothing.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The Express
> facts referenced are established elsewhere and cited inline: `req.params` values
> are always strings and have a null prototype for string paths
> ([Phase 1 · 02 · chunk 01](../../phase-1-routing/02-params-and-query/01-path-params.md)),
> and `req.query` values are `string | string[]` on the default parser
> ([Phase 1 · 02 · chunk 03](../../phase-1-routing/02-params-and-query/03-shape-and-trust.md))
> — both read from `path-to-regexp@8.4.2` and Node's `querystring` in
> `sandbox/express-verify/node_modules/`. **Schema design is this bible's
> guidance**; the library is your choice and none of this is an Express feature.

## One schema per operation

The tempting shape is one `orderSchema` reused everywhere. It cannot work, because
the operations disagree about what is required:

| Operation | Requires | Forbids |
|---|---|---|
| `POST /orders` | every mandatory field | `id`, `createdAt`, `status` — server-owned |
| `PUT /orders/:id` | every mandatory field, as a full replacement | the same server-owned fields |
| `PATCH /orders/:id` | **nothing** — every field optional | the same, plus an empty body |
| `GET /orders?…` | nothing | anything that is not a known filter |

A single schema that satisfies all four requires nothing and forbids nothing,
which is not a schema.

**Compose instead of duplicating:**

```js
const orderFields = {
  customerId: z.string().uuid(),
  items: z.array(orderItem).min(1).max(100),
  note: z.string().max(1_000).optional(),
};

export const createOrder  = z.object(orderFields).strict();
export const replaceOrder = z.object(orderFields).strict();
export const patchOrder   = z.object(orderFields).partial().strict()
  .refine((v) => Object.keys(v).length > 0, {message: 'At least one field is required'});
```

🔴 **The `refine` on the patch matters.** `.partial()` makes every field optional,
so `{}` becomes valid — and a `PATCH` with an empty body is almost certainly a
client bug that would otherwise return 200 having changed nothing. Recall that an
empty JSON body **parses to `{}`** rather than failing, so the parser will not
catch it for you
([Phase 3 · 02 · chunk 02](../../phase-3-requests/02-json-and-urlencoded/02-the-parsers-and-their-options.md)).

**Server-owned fields are excluded by omission, not by a check.** `id`,
`createdAt`, `updatedAt`, `status`, `ownerId` are simply not in `orderFields`, so
`.strict()` rejects them (or `.strip()` drops them) with no rule to maintain.
That is mass-assignment defence expressed as a schema shape rather than a
denylist — and a denylist is the version that goes stale
([page 01 · chunk 02](../01-validate-at-boundary/02-parse-dont-validate.md)).

## `params` and `query` need different treatment from `body`

Because they arrive differently:

```js
export const orderParams = z.object({
  orderId: z.string().uuid(),          // ALWAYS a string — never z.number()
});

export const listQuery = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(500).optional(),
  status: z.enum(['pending', 'paid', 'cancelled']).optional(),
}).strict();
```

Four things that only apply here:

- **Path params are always strings.** `z.number()` fails for every request;
  `z.coerce.number()` is what you want, with the bounds below.
- 🔴 **`z.coerce.number()` accepts `''` as `0`**, because `Number('')` is `0`. So
  `?limit=` silently becomes a limit of zero. **Always `.min(1)`** — this is the
  single most common coercion trap and it has its own page
  ([page 03](../03-coercion-traps.md)).
- **Query values may be arrays** from repeated keys, on the *default* parser with
  no bracket syntax. A plain `z.string()` correctly rejects `?status=a&status=b`;
  a `z.coerce.string()` would stringify it to `'a,b'`, which is worse than
  failing.
- **`.default()` belongs in the schema**, not in the handler. One place decides
  what "no limit given" means, and the handler receives a number either way.

## Bound everything

Restating from the boundary page because this is where it is written down:

```js
z.object({
  name:  z.string().min(1).max(200),
  tags:  z.array(z.string().max(40)).max(20),
  page:  z.number().int().min(1).max(10_000),
  notes: z.string().max(5_000).optional(),
}).strict();
```

Every string a `.max()`, every array a `.max()` on both the array and its
elements, every number **both** ends. An array of 10,000 short ids is 10,000
queries and the byte limit said nothing about it
([Phase 3 · 03 · chunk 03](../../phase-3-requests/03-size-limits/03-what-it-does-not-protect.md)).

## Error codes per issue

The `code` in each issue is a client contract, exactly like the top-level one
([Phase 5 · 03 · chunk 01](../../phase-5-errors/03-error-contract/01-the-envelope.md)).
Most libraries supply their own (`invalid_type`, `too_small`,
`invalid_string`), and those are usable — but they are the **library's** vocabulary,
so switching libraries becomes a breaking change for clients.

Two positions, both defensible:

- **Pass the library's codes through.** Cheapest, and fine for a first-party API
  where the client is deployed with the server.
- **Map to your own vocabulary** in the factory. One table,
  `{invalid_type: 'INVALID_TYPE', too_small: 'OUT_OF_RANGE', …}`, and the library
  becomes an implementation detail.

For a public API the second is worth it, for the same reason the error envelope
exists at all: **what a client branches on should not change because you changed a
dependency.**

## Testing schemas

Schemas are the one part of validation worth unit-testing directly, because they
are pure functions and the cases are cheap:

```js
it('rejects the payloads that pass a truthiness check', () => {
  for (const bad of [
    {email: {$ne: null}},           // NoSQL operator object
    {email: ['a@b.c', 'x@y.z']},    // array from a repeated key
    {email: 'a'.repeat(10_000)},    // unbounded string
    {email: 'ok@x.com', role: 'admin'},  // mass assignment
  ]) {
    expect(createUser.safeParse(bad).success).toBe(false);
  }
});
```

That test is worth writing once per schema-heavy codebase. It encodes the four
payloads from [page 01](../01-validate-at-boundary/01-what-untrusted-means.md)
and fails loudly if someone relaxes `.strict()` or drops a `.max()`.

**Also test the happy path's *output***, not just that it succeeded:
`expect(Object.keys(result.data)).toEqual(['email', 'password'])` is what catches
a schema that quietly started passing an extra field through.

## Schemas and the API contract

Two consequences worth planning for:

- **A schema change is an API change.** Adding a required field breaks every
  existing client; tightening a `.max()` breaks the ones near the limit. Both need
  the same treatment as any other breaking change
  ([Phase 6 · 05](../../phase-6-rest-surface/05-versioning.md)).
- **The schema is the honest source for documentation.** Generating the OpenAPI
  request bodies from the same schemas the middleware uses removes the drift
  between what is documented and what is accepted — which is otherwise
  guaranteed, because they are maintained separately
  ([Phase 6 · 08](../../phase-6-rest-surface/08-openapi.md)).

And the type consequence: **infer the handler's types from the schema** rather
than declaring them twice, which removes the duplication the trade-off complains
about without removing the check
([page 09](../09-type-inference.md)).

## Gotchas

**Symptom:** A `PATCH` with an empty body returns 200 and changes nothing
**Cause:** `.partial()` makes `{}` valid, and an empty JSON body parses to `{}`
rather than failing
**Fix:** A `refine` requiring at least one key

**Symptom:** `?limit=` produces a limit of zero and an empty page
**Cause:** `z.coerce.number()` on `''` is `0`, because `Number('')` is `0`
**Fix:** `.min(1)` on every coerced number. Both ends, always

**Symptom:** A `z.number()` on a path param rejects every request
**Cause:** Path params are always strings
**Fix:** `z.coerce.number()` with bounds — or keep ids as opaque strings, which is
usually better

**Symptom:** A repeated query parameter is silently joined with a comma
**Cause:** `z.coerce.string()` stringifies the array
**Fix:** Plain `z.string()`, which correctly rejects it. Failing beats coercing to
nonsense

**Symptom:** A server-owned field is accepted on create after a refactor
**Cause:** The schema uses a denylist of forbidden fields, and the new field was
not added to it
**Fix:** Allow-list by omission — server-owned fields are simply absent from the
schema, and `.strict()` does the rest

**Symptom:** Clients broke when the validation library was upgraded
**Cause:** The library's issue codes were passed through as the API contract
**Fix:** Map to your own vocabulary in the factory, for anything public

**Symptom:** The OpenAPI document and the schema disagree
**Cause:** They are maintained separately, so drift is guaranteed
**Fix:** Generate the request bodies from the schemas

## Interview questions

**★ Why one schema per operation rather than one per resource?**
Because the operations disagree about what is required — `POST` requires every
mandatory field, `PATCH` requires none, and both forbid the server-owned ones. A
schema satisfying all of them requires nothing and forbids nothing, which is not
a schema. Compose from shared fields instead.

**★ How do you keep server-owned fields out of a create?**
By omission: `id`, `createdAt`, `status` and `ownerId` are simply not in the
schema, so a strict schema rejects them and a stripping one drops them. That is
allow-listing expressed as shape. A denylist of forbidden fields is the version
that goes stale the next time someone adds a column.

**★ What is wrong with `z.coerce.number()` on `?limit`?**
`Number('')` is `0`, so `?limit=` becomes a limit of zero and returns an empty
page with a 200. Every coerced number needs `.min(1)` — and an upper bound, since
a valid large integer is a denial-of-service.

**★ Why does a `PATCH` schema need a `refine`?**
Because `.partial()` makes `{}` valid, and an empty JSON body **parses to `{}`**
rather than failing at the parser. Without the refine, a client bug that sends
nothing gets a 200 and changes nothing.

**Should you expose the validation library's issue codes to clients?**
Not on a public API. They are the library's vocabulary, so an upgrade becomes a
breaking change for clients. Map them to your own codes in the factory, for the
same reason the error envelope exists at all.

**What should a schema test assert beyond "it rejects bad input"?**
The **output key set** of the happy path. That is what catches a schema which
quietly started letting an extra field through — the failure that a
success/failure assertion cannot see.

---

← Prev: [Mounting and order](02-mounting-and-order.md) · Index: [Validation factory](README.md) · Next topic → [Coercion traps](../03-coercion-traps.md)
