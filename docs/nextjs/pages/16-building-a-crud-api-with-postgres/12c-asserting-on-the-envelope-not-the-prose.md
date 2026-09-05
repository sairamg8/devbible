---
title: "The error envelope's `code` is a contract the client is allowed to branch on and its `message` is prose that a designer will rewrite on a Tuesday, so a test that asserts the message string is a test that fails for a reason nobody wanted to be told about"
sidebar_label: "12c · Asserting on the envelope"
sidebar_position: 58
description: "Why code is the contract and message is not, the fields that are unstable by construction, when a whole-body toEqual is exactly right rather than brittle, the leak test every error path needs, and asserting a status and a code together because status alone is ambiguous."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [RFC 9110 · HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.txt) §15.5 (fetched as raw text from rfc-editor.org), the PostgreSQL 18 [Error Codes appendix](https://www.postgresql.org/docs/18/errcodes-appendix.html), and [Zod · Error formatting](https://zod.dev/error-formatting). Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · Zod **4.4.3** · Vitest **5.0.0** · Node **24.20.0**.

**[Topic 10](10-errors-and-one-response-shape.md) gave this API one response shape for every failure, and the reason it is one shape is so a client can write one piece of code that handles all of them. That makes the envelope a public interface, and like every public interface some of it is promised and some of it is not. `code` is promised: it is a closed set, it is exhaustive over `FailureKind`, and a client is explicitly allowed to `switch` on it. `message` is not promised: it exists so a human sees something useful, and it will be rewritten by whoever owns the product's voice, in a pull request that touches no logic. A suite that asserts on `message` converts every copy edit into a red build, and — worse — trains the team to update assertions without reading them. This page separates the parts of a response you may assert on from the parts that are unstable by construction, and then makes the case for the one whole-body assertion that is not brittle at all: the one that proves you are not leaking a column.**

## The envelope, split into promised and not

```json
{
  "error": {
    "code": "duplicate_title",
    "message": "A card with that title already exists on this board",
    "details": { "field": "title" },
    "correlationId": "7c1b…"
  }
}
```

| Field | Promised? | What a test may assert |
|---|---|---|
| `code` | 🔴 **yes** — a closed set, exhaustive over `FailureKind` | the exact string |
| `details` **keys** | yes — field names come from the schema and the constraint map | which fields are named |
| `details` **messages** | no — Zod's wording changes between minor versions | nothing |
| `message` | **no** — human prose, owned by product | that it is a non-empty string, at most |
| `correlationId` | its *presence* and *format*, never its value | `expect.stringMatching(UUID_RE)` |
| HTTP status | yes | the exact number, **together with the code** |

The rule condenses to: **assert the machine-readable half, assert the shape of the human-readable half, assert the value of neither.**

```ts
// ✅ every part of this survives a copy edit
expect(res.status).toBe(409)
const body = await res.json()
expect(body.error.code).toBe('duplicate_title')
expect(body.error.details).toEqual({ field: 'title' })
expect(typeof body.error.message).toBe('string')
expect(body.error.correlationId).toMatch(/^[0-9a-f-]{36}$/)
```

```ts
// ❌ this one breaks the day someone drops "on this board"
expect(body.error.message).toBe('A card with that title already exists on this board')
```

## Status alone is ambiguous, so never assert it alone

This API returns `409` for at least three unrelated reasons and `422` for several more. A test that asserts only `expect(res.status).toBe(409)` passes when the wrong conflict fired.

| Status | Causes in this API | Distinguished by |
|---|---|---|
| `409` | duplicate title · a `23P01` exclusion overlap · a state conflict with no client precondition | `code` |
| `412` | a stale `If-Match` — and only that ([07e](07e-etag-if-match-and-412.md)) | `code: 'precondition_failed'` |
| `422` | Zod rejected the body · a `CHECK` fired · a foreign key named a missing board | `code` and `details.field` |
| `404` | the card is genuinely absent · the caller is not a member ([11](11-ownership-on-the-api-surface.md)) | 🔴 **deliberately indistinguishable** — see [12e](12e-the-ownership-negative-test.md) |

🔴 **Always assert `status` and `code` in the same expectation.** The pair is the contract; either one alone is a coin flip.

```ts
// a small helper that makes the pair the default unit of assertion
async function expectFailure(res: Response, status: number, code: string) {
  expect(res.status).toBe(status)
  const body = await res.json()
  expect(body.error.code).toBe(code)
  return body.error
}
```

The `404` row is the interesting one: it is the single place in the API where two different causes must produce an *identical* response, so the assertion there is not "status and code" but "these two responses are the same response". That test lives in [12e](12e-the-ownership-negative-test.md).

## The fields that are unstable by construction

Three values in a response of this API change every time you produce one, and every one of them has been the cause of an intermittently-failing snapshot test somewhere.

**`correlationId`** is `crypto.randomUUID()` per response, generated inside `toHttpResponse`. It is unstable on purpose — that is what makes it useful in a log. Assert the format.

**`createdAt` / `updatedAt`** come from `now()`, which PostgreSQL evaluates as the transaction start time. Two rows written in one transaction share a value; two rows written in two transactions do not. Assert relationships, never literals — [12d](12d-representation-assertions-and-what-not-to-assert.md) has the full argument.

**`id`** is `gen_random_uuid()`. A test may assert that the `id` in a `201` body equals the one in the `Location` header — a real, checkable invariant — and must never assert the value.

```ts
// ✅ the invariant, not the value
const res = await POST(req, { params: Promise.resolve({ boardId }) })
expect(res.status).toBe(201)
const body = await res.json()
expect(res.headers.get('location')).toBe(`/api/cards/${body.id}`)
```

## When a whole-body assertion is exactly right

The standard advice — "use `toMatchObject`, never `toEqual`, on a response body" — is right for the *presence* of expected fields and wrong for the risk this API actually has.

[04d](04d-projections-not-rows.md) introduced `CARD_COLUMNS` because a `SELECT *` returns whatever the table currently has, including a column added by a migration three months from now. `toMatchObject` cannot see an extra field. If someone adds `internal_notes` to `cards` and a query drifts back to selecting the row rather than the projection, every `toMatchObject` assertion in the suite still passes and the API is now serving a column nobody meant to publish.

🔴 **So the representation gets one exact-shape test, and it is a keys test rather than a values test:**

```ts
// ✅ test/boundary/representation.test.ts
const PUBLIC_CARD_KEYS = [
  'id', 'boardId', 'title', 'body', 'status', 'position', 'version', 'createdAt', 'updatedAt',
].sort()

it('publishes exactly the documented fields and no others', async () => {
  const res = await GET(req, { params: Promise.resolve({ cardId }) })
  const body = await res.json()
  expect(Object.keys(body).sort()).toEqual(PUBLIC_CARD_KEYS)
})
```

Two things to notice. `deletedAt` is **not** in the list — soft-delete state is internal ([08b](08b-what-soft-delete-costs-every-read.md)), and this test is what stops it escaping. And the assertion is on *keys*, so it is stable against every value the database produces while still failing loudly on a new column.

The same test written as a Zod schema in `.strict()` mode gives you the same guarantee plus type checking on the fixture, which is what [ch13 · 3d](../13-testing-and-developer-experience/03d-zod-contract-tests-at-the-boundaries.md) argues for at the request boundary — the response boundary deserves the same treatment:

```ts
// lib/contracts/card.ts — shared by the test and, if you like, by the client
import { z } from 'zod'

export const CardRepresentation = z.strictObject({
  id: z.uuid(),
  boardId: z.uuid(),
  title: z.string().min(1).max(200),
  body: z.string().nullable(),
  status: z.enum(['todo', 'doing', 'done']),
  position: z.number().finite(),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
```

`z.strictObject` rejects unknown keys, which is the whole point; `z.object` would not. And `position: z.number().finite()` is not decoration — [05ea](05ea-the-position-value-and-concurrent-creates.md) noted that repeated bisection of the same gap eventually exhausts double precision, and a `NaN` or an `Infinity` reaching the wire is a contract violation this schema catches.

## The leak test every error path needs

[10b](10b-never-leak-a-driver-error.md) argues that a driver error must never reach a client. That is a claim about *every* error path, including the ones you have not thought of, so it should be asserted structurally rather than per endpoint.

```ts
// ✅ test/boundary/no-leak.test.ts
const ErrorEnvelope = z.strictObject({
  error: z.strictObject({
    code: z.string().regex(/^[a-z_]+$/),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    correlationId: z.uuid(),
  }),
})

const LEAKY = ['detail', 'hint', 'position', 'schema', 'table', 'column', 'constraint',
               'severity', 'routine', 'stack', 'query']

it.each(everyFailureFixture)('renders %s without leaking driver fields', async (fixture) => {
  const res = toHttpResponse(fixture.thrown)
  const body = await res.json()
  expect(() => ErrorEnvelope.parse(body)).not.toThrow()
  const serialised = JSON.stringify(body)
  for (const field of LEAKY) expect(serialised).not.toContain(`"${field}"`)
})
```

The `LEAKY` list is not arbitrary — those are the field names PostgreSQL's `ErrorResponse` carries and `pg` copies onto the thrown error object. The `strictObject` catches a leak by *structure*; the string scan catches a leak that got nested inside `details`. Both are cheap and neither needs a database.

⚠️ **Include a fixture for a thrown value that is not an `Error` at all.** `toHttpResponse` takes `unknown`, and the paths that actually leak are the ones where something threw a string, a `TypeError` from a null dereference, or an object from a third-party library. A fixture list containing only well-formed `DomainError`s tests the case that was never going to leak.

## The 401 you decided to send, and writing the deviation into the test

[11](11-ownership-on-the-api-surface.md) is honest that a cookie-session API usually returns a bare `401` with no `WWW-Authenticate` header, which deviates from the specification. RFC 9110 says of `401`:

> *"The server generating a 401 response MUST send a WWW-Authenticate header field (Section 11.6.1) containing at least one challenge applicable to the target resource."*
> — [RFC 9110 §15.5.2](https://www.rfc-editor.org/rfc/rfc9110.txt)

You are probably not going to comply, and that is a defensible product decision. **What is not defensible is having no record of the decision.** The test is the record:

```ts
// Deliberate deviation from RFC 9110 §15.5.2: this is a cookie-session API and there is
// no HTTP authentication scheme to challenge with. Documented in topic 11.
it('returns a bare 401 with no WWW-Authenticate challenge', async () => {
  const res = await GET(unauthenticatedRequest, { params: Promise.resolve({ cardId }) })
  expect(res.status).toBe(401)
  expect(res.headers.get('www-authenticate')).toBeNull()
})
```

A test named for the deviation is worth more than a conformant header nobody uses, because the next person to read it learns that the absence is a choice rather than an oversight.

## Gotchas

**★ Symptom: a pull request that only changed copy turned twenty tests red.** Cause: assertions on `message`. Fix: assert `code`; assert `typeof message === 'string'` if you want a guard that the field is populated at all. If a specific phrase genuinely matters to the product, it belongs in a localisation file with its own test, not in an API assertion.

**★ Symptom: a snapshot test fails on every run with a one-character diff.** Cause: `correlationId` is a fresh UUID per response and `createdAt` is a fresh timestamp per insert, so the snapshot can never match twice. Fix: do not snapshot response bodies from this API. Use a keys assertion for shape and targeted assertions for values; if you insist on a snapshot, replace the unstable fields first — but at that point the snapshot is asserting less than three explicit expectations would.

**★ Symptom: the API started returning an internal column and every test passed.** Cause: `toMatchObject` everywhere, which is blind to extra keys, plus a query that drifted from `CARD_COLUMNS` back to a bare row select. Fix: one `z.strictObject` (or sorted-keys `toEqual`) assertion on the card representation. It is the only test in the suite that can fail on an *addition*, which is precisely the failure mode a projection exists to prevent.

**★ Symptom: `expect(res.status).toBe(409)` passes for the wrong conflict.** Cause: status is a coarse classification and this API has three distinct 409s. Fix: assert the pair. Make `expectFailure(res, 409, 'duplicate_title')` the only way the suite is allowed to assert a failure, so it is impossible to write the loose version by accident.

**★ Symptom: a Zod minor upgrade broke validation tests.** Cause: assertions on Zod's generated message strings, which are not a stable interface. Fix: assert on `details` keys — which field failed — and never on the wording. The field name comes from your schema and is as stable as your schema is.

**★ Symptom: a `500` in production contained the SQL text of the failing statement.** Cause: an unmapped error was passed to the envelope with its `cause` serialised, and no test covered an error that was not a `DomainError`. Fix: the structural leak test above, with a fixture list that includes a raw `pg` error object, a plain string throw, and a `TypeError`. The `strictObject` parse fails on any extra key, so a serialised cause cannot survive it.

**★ Symptom: the `Location` header on a `201` is an absolute URL in production and a relative one in tests.** Cause: the handler builds it from `req.url` or from an environment variable that is unset under the test runner. Fix: assert the invariant rather than the literal — that `Location` ends with `/api/cards/${body.id}` — and, separately, decide once whether the API emits relative or absolute and enforce that in one place. RFC 9110 permits a relative reference in `Location`, so either is legal; inconsistency is not.

**★ Symptom: an assertion on `details` fails because it is `undefined` rather than `{}`.** Cause: `toHttpResponse` omits `details` when there is none, and `JSON.stringify` drops undefined properties, so the key is absent from the parsed body rather than present-and-empty. Fix: decide which the contract says. If `details` is optional, mark it `.optional()` in the envelope schema and assert with `toBeUndefined()`; if it is always present, emit `{}` explicitly in the translator. Do not let the two coexist.

## Interview questions

**★ Why is the error `code` part of the contract and the `message` not?**
Because they have different audiences and therefore different change rates. `code` exists so a client can branch — retry on `conflict`, re-fetch on `precondition_failed`, show a field error on `title_blank` — which means changing it is a breaking API change and it is treated as one. `message` exists so a human reading a response or a log sees something useful, and it will be rewritten by product, design or a translator without anyone considering it an API change. Asserting on `message` therefore encodes a promise the API never made, and the cost lands as recurring false failures.

**★ When is a whole-body `toEqual` on a response the right assertion rather than a brittle one?**
When the property under test is *absence*. `toMatchObject` can only fail on a missing or wrong field; it cannot fail on an extra one. This API has a real risk of extra fields — a migration adds a column, a query drifts from the projection to a row select, and an internal value ships. One exact-keys assertion on the public representation is the only test that catches that, and phrasing it against keys rather than values keeps it stable while it does so.

**★ How do you test that a driver error never reaches the client, given you cannot enumerate every possible driver error?**
Structurally rather than by enumeration. Parse every error response through a strict schema that rejects unknown keys, and additionally scan the serialised body for the field names PostgreSQL's `ErrorResponse` carries — `detail`, `hint`, `constraint`, `table`, `routine` and the rest. Feed the translator a fixture set that deliberately includes non-`Error` throws, because those are the paths where a generic serialisation is most likely to have been written. The test asserts a property of the translator rather than a list of cases, so an error class you have not met yet is still covered.

**★ Two responses in this API must be byte-identical. Which, and how would you assert that?**
The `404` for a card that does not exist and the `404` for a card the caller is not a member of the owning team for — topic 11 makes them indistinguishable on purpose, so that a `403` cannot be used as an existence oracle. The assertion is not "both are 404"; it is that the status, the `code`, the `details` and the header set are the same, with `correlationId` excluded since it is unstable by design. Writing it as a comparison of the two responses rather than as two separate expectations is what keeps it honest when someone later adds a header to one path.

**★ Why should a test record a deliberate specification deviation rather than the suite simply not mentioning it?**
Because an absent assertion and a deliberate omission look identical six months later, and the default reaction to noticing a missing `WWW-Authenticate` header is to add one — which changes browser behaviour, potentially triggering a native credentials dialog on a cookie-session API. A test named for the deviation, with the section reference in a comment, converts tribal knowledge into something the build enforces and a newcomer can read.

---

← [12b · The database under test](12b-the-database-is-the-thing-under-test.md) · [Chapter 16 overview](01-explanation.md) · Next → [12d · Representation assertions and what not to assert](12d-representation-assertions-and-what-not-to-assert.md)
