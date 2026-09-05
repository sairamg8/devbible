---
title: "A validation schema that folds an absent field and an explicitly null field into the same value cannot express a partial update, and the way it fails is to clear a column nobody asked it to clear"
sidebar_label: "07b · Absent vs null"
sidebar_position: 51
description: "Why `undefined` and `null` are two different instructions in a PATCH body, what zod 4.4.3 actually produces for each, how to build a SET map that only contains the keys the client sent, and the three shapes that get this wrong."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against RFC 7396 §1 (JSON Merge Patch) — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc7396.html) — and RFC 5789 §2 — [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc5789.html).
> `zod` behaviour below was **probed on the installed package** (`zod` **4.4.3**, matching the corpus pin) with `Object.keys` and the `in` operator; nothing was measured or timed.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**A PATCH body has three possible things to say about a nullable column, and most handlers can only hear two of them. "I did not mention `body`" means leave it alone. "I sent `body: null`" means clear it. "I sent `body: 'text'`" means set it. Collapse the first two — and every schema that marks the field `.optional()` and then checks `if (input.body !== undefined)` collapses them — and one of two bugs is now permanent: either the API can never clear a nullable column, or it clears the column on every patch that does not mention it. The second is worse, because it is silent, it looks like data loss with no cause, and the request that caused it returned 200.**

## Three instructions, not two

RFC 7396 is unambiguous about what a null member means:

> *"If the provided merge patch contains members that do not appear within the target, those members are added. If the target does contain the member, the value is replaced. Null values in the merge patch are given special meaning to indicate the removal of existing values in the target."*

Mapped onto the SprintDesk `cards` row, where `body` is `text` and nullable:

| Request body | Merge-patch meaning | SQL that should run |
|---|---|---|
| `{"title":"Ship it"}` | set title; **say nothing about body** | `SET title = 'Ship it'` |
| `{"body":null}` | remove body | `SET body = NULL` |
| `{"body":"notes"}` | set body | `SET body = 'notes'` |
| `{}` | change nothing | no `UPDATE` at all |

Row four is not a curiosity. An empty patch is a legitimate request and the correct response is the current representation with nothing written — not an `UPDATE` with an empty `SET`, which is a syntax error, and not a `SET updated_at = now()`, which lies about the row having changed.

## What JavaScript loses on the way in

`JSON.parse` cannot produce `undefined`. A JSON body therefore carries the distinction perfectly: an absent key is absent from the parsed object, and `null` is the value `null`. The distinction is destroyed later, by your own code, in one of three places.

**1 — the schema.** `.optional()` and `.nullable()` are different modifiers and mean different things:

```ts
z.string().optional()             // string | undefined   — may be absent
z.string().nullable()             // string | null        — may be null
z.string().nullable().optional()  // string | null | undefined — may be either
```

**2 — the check.** `if (input.body !== undefined)` cannot distinguish "absent" from "present and undefined", and `if (input.body)` additionally treats `''` and `null` as absent.

**3 — the spread.** `set({ ...input })` hands Drizzle every key the schema produced, including ones the client never sent.

## What zod 4.4.3 actually produces

Probed on the installed package, version printed alongside:

```ts
import { z } from 'zod'
const S = z.object({ title: z.string().optional(), body: z.string().nullable().optional() })

S.parse({ title: 'x' })              // → { title: 'x' }          — 'body' in result === false
S.parse({ title: 'x', body: null })  // → { title: 'x', body: null } — key present, value null
S.parse({ title: 'x', body: undefined }) // → key IS present, value undefined
```

Two facts to carry away:

- **zod preserves absence.** An optional key the input did not contain does **not** appear in the parsed object. `'body' in parsed` is a reliable test for "the client sent this field".
- ⚠️ **An explicit `undefined` property survives as a present key.** That cannot happen from `JSON.parse`, so a Route Handler is safe — but a **Server Action** receives a real JavaScript object, and `{ body: undefined }` built by a client component will arrive with the key present. If both entry points share the DAL, normalise in the action before calling it:

```ts
// lib/normalize.ts — drop keys whose value is literally undefined
export function dropUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
```

## The schema that can tell them apart

```ts
// lib/schemas/card.ts
import { z } from 'zod'

export const cardStatus = z.enum(['todo', 'doing', 'done'])

/** PATCH: every field optional. `body` may additionally be null, meaning "clear it". */
export const CardPatch = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20_000).nullable().optional(),
  status: cardStatus.optional(),
  position: z.number().finite().optional(),
  boardId: z.uuid().optional(),
})

export type CardPatch = z.infer<typeof CardPatch>
// { title?: string; body?: string | null; status?: 'todo'|'doing'|'done';
//   position?: number; boardId?: string }
```

`body?: string | null` is the type that carries all three instructions. `body?: string` cannot express "clear it"; `body: string | null` (no `?`) cannot express "leave it alone".

## The SET map that only contains what was sent

🔴 **Never spread the parsed object into `.set()`.** Build the update column by column, using `in` — not a truthiness or `undefined` test — so that a deliberate `null` survives and an absent field never appears.

```ts
// lib/dal/cards.ts
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { cards } from '@/db/schema'
import type { CardPatch } from '@/lib/schemas/card'

type CardSet = Partial<typeof cards.$inferInsert>

export function buildCardSet(patch: CardPatch): CardSet {
  const set: CardSet = {}
  if ('title' in patch) set.title = patch.title!
  if ('body' in patch) set.body = patch.body ?? null      // null survives on purpose
  if ('status' in patch) set.status = patch.status!
  if ('position' in patch) set.position = patch.position!
  if ('boardId' in patch) set.boardId = patch.boardId!
  return set
}
```

And the caller that treats "nothing to do" as a real case rather than an error:

```ts
export async function patchCard(cardId: string, patch: CardPatch, callerId: string) {
  const set = buildCardSet(patch)

  // An empty patch is a valid request. Do not write; return what is there.
  if (Object.keys(set).length === 0) return readCardForCaller(cardId, callerId)

  set.updatedAt = sql`now()`   // server clock, never the client's — see 07g

  const [row] = await db.update(cards)
    .set(set)
    .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
    .returning()

  return row ?? null   // null means "no such visible card" — the handler maps that to 404
}
```

Three details that are load-bearing:

1. **`isNull(cards.deletedAt)`** — a soft-deleted card must not be patchable back into existence by accident. That predicate is [08](08-delete.md)'s, and every write repeats it.
2. **`.returning()`** — in `drizzle-orm` **0.45.2** the update builder's result type is the driver's raw query result *unless* a `returning` clause is present, in which case it is an array of rows. Verified against the published typings for 0.45.2: `PgUpdateBase` extends `QueryPromise<TReturning extends undefined ? PgQueryResultKind<TQueryResult, never> : TReturning[]>`. Taking `[row]` therefore also gives you the affected-row count for free — `undefined` means nothing matched.
3. **No ownership check here** — it belongs in [the DAL's ownership predicate](04c-the-ownership-predicate.md), applied to every entry point, and `callerId` is threaded through for it.

## The `boardId` case, which is not a patch at all

`{"boardId": "…"}` looks like one more optional field and is a different operation: it moves a card between boards, so it needs membership on the destination as well as the source, and it interacts with `position` because positions are only ordered *within* a board. Validating it as a UUID and letting it through `buildCardSet` is how a card ends up on a board the caller cannot see. Treat a cross-board move as its own DAL function with its own authorization, and reject `boardId` in the generic patch path if you are not ready to do that:

```ts
export const CardPatch = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20_000).nullable().optional(),
  status: cardStatus.optional(),
  position: z.number().finite().optional(),
  // boardId deliberately NOT here: moving a card is moveCard(), which authorises both boards
})
```

## Gotchas

**★ Symptom: the API can set a card's description but can never clear it.** Cause: the field was typed `body?: string`, so `null` fails validation and the only way to express "empty" is the empty string — which is a different value from `NULL` in Postgres and sorts, indexes and compares differently. Fix: `z.string().max(20_000).nullable().optional()`, giving `body?: string | null`, and map `null` straight through to the column.

**★ Symptom: patching a card's title wipes its description.** Cause: the handler did `set({ title: input.title, body: input.body })` with `input.body` being `undefined`, and something downstream turned `undefined` into `NULL`. Fix: build the `SET` map with `in` so an unsent key never reaches the statement:

```ts
const set: CardSet = {}
if ('body' in patch) set.body = patch.body ?? null
```

**★ Symptom: a PATCH with an empty body `{}` returns 500 with a SQL syntax error.** Cause: the handler built an empty `SET` clause and Postgres rejects `UPDATE cards SET WHERE …`. Fix: short-circuit before the write and return the current representation:

```ts
if (Object.keys(set).length === 0) return readCardForCaller(cardId, callerId)
```

**★ Symptom: an empty PATCH bumps `updated_at`, so the card jumps to the top of a "recently changed" list.** Cause: `updatedAt` was set unconditionally before the emptiness check. Fix: set it **after** deciding there is something to write, as in `patchCard` above — the ordering of those two lines is the whole bug.

**★ Symptom: a client sends `{"body": ""}` expecting to clear the field, and reads back an empty string.** Cause: the API accepted both `''` and `null` as "empty" and the client picked the wrong one. Fix: decide which one the column means and enforce it in the schema, rather than letting both in. If `NULL` is "no description", reject the empty string:

```ts
body: z.string().min(1).max(20_000).nullable().optional()
```

**★ Symptom: a Server Action clears a column that the equivalent Route Handler leaves alone.** Cause: the action received a plain JavaScript object where the key exists with the value `undefined` — something `JSON.parse` can never produce — so the `in` check sees a key the client did not really send. Fix: normalise at the action boundary with `dropUndefined` before calling the DAL, so both entry points hand the DAL the same shape.

**★ Symptom: a client sets `id` or `version` through PATCH.** Cause: the parsed object was spread into `.set()`, and the schema was permissive enough to carry the key through. Fix: `z.strictObject` plus an explicit field-by-field `SET` map. There is no allow-list to maintain because the map itself *is* the allow-list — a column not named in `buildCardSet` is not writable through the API, and that is a property you can read off the function.

**★ Symptom: JSON Patch documents (`[{"op":"replace",…}]`) sent to an endpoint that expects merge-patch are accepted and do nothing.** Cause: the endpoint parsed an array as an object, found no recognised keys, and returned the unchanged resource. Fix: gate on the media type and reject what you do not implement, so the client gets a diagnosis instead of a no-op:

```ts
const ct = req.headers.get('content-type')?.split(';')[0]?.trim()
if (ct !== 'application/json' && ct !== 'application/merge-patch+json') {
  return new Response(null, { status: 415 })
}
```

**★ Symptom: `deletedAt` was patched to `null` by a client and a deleted card came back.** Cause: `deletedAt` is a column, `buildCardSet` was generated from the table type, and nothing excluded it. Fix: restoration is an operation, not a field — it gets its own endpoint and its own authorization, which is [08e](08e-restoring-a-soft-deleted-row.md). The generic patch path never touches `deleted_at`.

## Interview questions

**★ Why is `undefined` not good enough to represent "the client did not send this field"?**
Because it is also what you get from a key that was sent with no value, from a typo'd key after a permissive schema drops it, and from any object literal that mentions the property. The distinction the API needs is *presence*, and the operator that tests presence is `in`, not `!== undefined`. Once the value has been copied into a new object the presence information is gone, which is why the `SET` map is built by copying keys conditionally rather than by spreading.

**★ Under JSON Merge Patch, what does `{"body": null}` mean, and what does `{}` mean?**
`{"body": null}` means remove the existing value — RFC 7396 gives null "special meaning to indicate the removal of existing values in the target". `{}` means change nothing, and the correct handling is to write nothing at all, not to run an `UPDATE` that touches only `updated_at`. Treating the empty patch as a write is how an untouched card ends up at the top of a recently-modified list.

**★ You cannot express "clear this field" if the column is not nullable. So why is `body` nullable at all?**
Because "this card has no description" and "this card has an empty description" are the same thing to a user and different things to a database — they sort differently, `LIKE` matches them differently, and aggregate functions ignore `NULL` but count `''`. Picking one representation and enforcing it in the schema is a schema decision, not an API decision, and the API's job is to make the other one unrepresentable rather than to accept both and hope.

**★ Why should the update map be built column by column rather than spread from the validated input?**
Because the spread makes the set of writable columns a property of the schema *and* of every future edit to the schema, while the explicit map makes it a property of one function you can read in ten seconds. A column added to the table is not writable through the API until someone adds a line to `buildCardSet`, which is exactly the default you want — the failure mode of forgetting is "the new field cannot be set yet", not "the new field can be set by anyone".

**★ A Server Action and a Route Handler share a DAL. Where does the absent-vs-null distinction break?**
At the action, because an action receives a live JavaScript object rather than parsed JSON, and a client component that builds `{ body: someState ?? undefined }` produces an object where the key exists with the value `undefined`. The `in` test then reports the field as sent. Normalising with a `dropUndefined` helper at the action boundary makes the two entry points hand the DAL identical shapes, which is the only way one set of DAL tests covers both.

**★ How do you stop `version` or `deletedAt` being writable through PATCH?**
By never generating the writable-column list from the table type. `z.strictObject` rejects the key at the boundary with a 400, and `buildCardSet` would not copy it even if the schema let it through — two independent gates, neither of which needs an exclusion list that has to be maintained as columns are added. Restoring a soft-deleted row and bumping a version are operations with their own semantics and their own endpoints, not fields.

---

← [07 · UPDATE — PUT vs PATCH](07-update.md) · [Chapter 16 overview](01-explanation.md) · Next → [07c · The lost update](07c-the-lost-update.md)
