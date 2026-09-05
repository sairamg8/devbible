---
title: "The representation is the half of the contract that has no status code to hide behind — every field you return is a promise about a value's name, its type, its nullability and its meaning, and the ones you never wrote down are the ones a client is already depending on"
sidebar_label: "01c · What the client may rely on"
sidebar_position: 12
description: "The card representation field by field, the difference between null and absent, why timestamps are strings and ids are opaque, the collection envelope decided once, additive-only evolution, and the four things this API explicitly refuses to promise."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [RFC 9110 · HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html) (§8.8.3 `ETag`), [RFC 3339 · Date and Time on the Internet](https://www.rfc-editor.org/rfc/rfc3339.html), [RFC 8259 · JSON](https://www.rfc-editor.org/rfc/rfc8259.html) (§6 Numbers) and the [PostgreSQL 18 date/time types reference](https://www.postgresql.org/docs/18/datatype-datetime.html).
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**[01b](01b-the-six-routes-and-the-codes-they-commit-to.md) fixed the codes. This page fixes the body, and it is the harder half, because a status code is a small closed set and a JSON object is not. Every key you emit becomes something a client parses; every key you emit *by accident* becomes something a client parses without either of you noticing. The discipline is to state the representation once — names, types, nullability, meaning, stability — and to state just as explicitly the things you refuse to promise, because the promises you never made are exactly the ones that get discovered when you break them.**

## The card representation

```ts
// contracts/cards.ts — the same file 01 introduced, filled in.

export type CardRepresentation = {
  /** Opaque. A UUID today; treat it as a string forever. Stable for the card's life. */
  id: string

  /** The board the card is currently on. Changes when a card is moved. */
  boardId: string

  /** 1..200 characters after trimming. Never empty, never null. */
  title: string

  /** The description. `null` means the user has not written one; "" is not produced. */
  body: string | null

  /** A closed set. New members may be ADDED in a future version; existing ones never change. */
  status: 'todo' | 'doing' | 'done'

  /** Ordering key within a board. Higher is later. Not an index, not contiguous, not an integer. */
  position: number

  /** Increments by at least one on every accepted write. Use it with If-Match. */
  version: number

  /** RFC 3339, UTC, always with a numeric offset. Never changes. */
  createdAt: string

  /** RFC 3339, UTC, always with a numeric offset. Changes on every accepted write. */
  updatedAt: string
}
```

Nine fields, and every line of comment above is a commitment somebody can hold you to. Six of them are worth arguing for individually.

### `id` is opaque

The schema in [02](02-the-schema-and-the-migration-story.md) uses `uuid` with `defaultRandom()`, and the contract says *string*. That gap is deliberate. The moment a client parses your id — checks its length, validates it as a v4 UUID, sorts by it — the storage decision has become a public interface, and switching to `uuidv7()` for index locality becomes a breaking change to somebody else's regular expression. PostgreSQL 18 added exactly that function:

> *"Add `UUID` version 7 generation function `uuidv7()` … This `UUID` value is temporally sortable."*
> — [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)

Whether you want it is a schema question. Whether you *can* take it later is a contract question, and the answer is yes only if the contract said "opaque string" rather than "UUID".

### `body: string | null` — null and absent are not the same thing

Two different states, and a contract that does not distinguish them will be asked to.

- **`"body": null`** — the field exists, the card has no description. This is what `GET` returns.
- **the key is absent** — in a `PATCH` body, "do not touch this field". In a response, it never happens: every response carries all nine keys.

That second rule is what makes `PATCH` expressible at all. `{"body": null}` means *clear the description*; `{}` means *change nothing*. If responses sometimes omitted null fields, a client that round-trips a card — `GET`, edit one field, `PUT` back — would silently drop every field that happened to be null at read time. Always emitting every key costs a few bytes and removes an entire class of data loss.

⚠️ **`""` is not in the contract.** Empty string and null are two spellings of "no description", and having both means every consumer needs `if (body === null || body === '')`. The DAL normalises an empty trimmed string to `null` on write; the contract says the read side never sees `""`.

### `status` is a closed set that may grow

`'todo' | 'doing' | 'done'` is backed by a Postgres enum, and the contract's promise is asymmetric on purpose: **members may be added, never removed or renamed.** A client that writes `switch (status)` with three cases and no default will break when a fourth arrives; a client that has a default will not. Say so, so the client author gets to decide which one they are.

Adding an enum value is a migration with its own hazards — that is [02e](02e-expand-and-contract.md).

### `position` is a number, not an index

`double precision` in the database. The contract says only: a number, higher is later, within one board. It does **not** say contiguous, does not say integer, does not say starting at zero.

That looseness is the feature. Sparse doubles let a card be inserted between two neighbours by writing one row — the new position is the midpoint of the two around it — instead of renumbering every card after the insertion point. Promise "an integer index" in the contract and you have promised an update of every subsequent row on every reorder, forever, because a client will start rendering the number.

RFC 8259 is worth knowing about here, because JSON numbers are not IEEE 754 by specification:

> *"This specification allows implementations to set limits on the range and precision of numbers accepted."*
> — [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html)

In practice every JavaScript client parses it as a double, which is what Postgres stored, so round-tripping is exact. A client in a language with arbitrary-precision decimals may render it as `1.5000000000000000` — harmless, and another reason not to let clients display it.

### `version` is the concurrency token

An integer that increases on every accepted write. The client's use for it is `If-Match`, and the response carries the same value as an `ETag`:

> *"An entity-tag is an opaque validator for differentiating between multiple representations of the same resource…"* — [RFC 9110 §8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html)

so `ETag: "7"` and `"version": 7` are the same fact in two places, one for HTTP intermediaries and one for a client that does not speak `ETag`. Topic 07 owns the mechanism; the contract's only job is to say the field exists, that it goes up, and that a client must not assume it goes up by exactly one — a write that triggers a trigger or a retry may skip.

### Timestamps are strings, UTC, with an offset

`timestamp with time zone` in Postgres, RFC 3339 in JSON. Three separate commitments in one field:

1. **A string, not a number.** Epoch milliseconds are smaller and lose the timezone entirely, and no human can read a log line containing one.
2. **Always UTC**, so two cards created on two instances in two regions sort correctly as strings.
3. **Always with an explicit offset** (`2026-09-05T14:03:21.412Z`), so a client that does string comparison and a client that parses both get the same answer.

🔴 **`timestamp with time zone` in PostgreSQL does not store a time zone.** It stores a UTC instant and converts on input and output according to the session's `TimeZone`. That is exactly what you want, and it is also why a session setting that does not survive a transaction pooler ([01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md)) must never be the thing your timestamps depend on. Format the instant in application code from a UTC value; do not `SET TimeZone` and hope.

## The collection envelope, decided once

`GET /api/boards/[boardId]/cards` returns a wrapper, not a bare array:

```ts
export type CardListResponse = {
  data: CardRepresentation[]
  /** Opaque. Pass it back as ?cursor= to get the next page. Absent means no more. */
  nextCursor?: string
}
```

Two decisions, both worth making now because both are painful to change.

**A wrapper, not a top-level array.** A bare `[…]` has nowhere to put pagination, nowhere to put a count, and nowhere to put anything you have not thought of yet — so the first time you need one of those, you break every client. The wrapper costs one level of indirection and buys unlimited additive room.

**A cursor, not an offset.** The cursor is opaque by contract, which is what lets topic 06 change it from an encoded `(createdAt, id)` pair to something else without a version bump. Offset pagination is the thing that looks simpler and degrades at depth; that argument, and the keyset query, is **topic 06 · READ** *(not written yet)*.

Note that the ordering the cursor encodes is the same `(created_at, id)` the index in [02](02-the-schema-and-the-migration-story.md) is built on. That is not a coincidence — the contract's ordering promise, the pagination mechanism and the index are one decision written in three places, and if they ever disagree the symptom is a page that silently skips rows.

## Evolution: what you may change without breaking a client

| Change | Breaking? | Why |
|---|---|---|
| Add a field to the response | No | A client ignoring unknown keys is the baseline expectation |
| Add an optional field to a request body | No | Absent means "unchanged", which was already the rule |
| Add a member to `status` | **Depends** — say so in the contract | Breaks any client that exhaustively switches without a default |
| Rename a field | **Yes** | There is no gentle version of this; it is add-new, dual-write, remove-old |
| Tighten a nullable field to non-null | No for readers, **yes** for writers | Readers get a subset; writers now fail on input you used to accept |
| Loosen a non-null field to nullable | **Yes for readers** | Every consumer that did `.trim()` on it now throws |
| Change a status code for an existing situation | **Yes** | Argued in [01b](01b-the-six-routes-and-the-codes-they-commit-to.md) |
| Change the ordering of the collection | **Yes** | The contract states it; changing it silently reshuffles paginated results |

The pattern in the "yes" rows is identical to the database one in [02e](02e-expand-and-contract.md): **add the new thing, run both, migrate the callers, remove the old thing.** Four steps, and the interesting property is that the API version of it and the schema version of it are the *same* discipline applied to two different sets of consumers — one you deploy, one you do not.

## The four things this API refuses to promise

Stating a non-promise is as load-bearing as stating a promise, because silence gets read as consent.

1. **No total count on the collection.** `COUNT(*)` over a board is a scan, and clients that display "1,204 cards" will make you run it on every page. If a count is genuinely required it is a separate endpoint with its own caching, not a field in the list envelope.
2. **No guarantee that two `GET`s in a row return the same `version`.** Somebody else may be writing. A client that assumes stability between reads is assuming a lock it never took.
3. **No cross-board ordering.** `position` is meaningful within a board and meaningless between boards. Two cards on different boards with the same position are not "tied"; the comparison is undefined.
4. **No promise about `updatedAt` monotonicity across cards.** It is the instant that row was written, taken from the database, and two rows written in the same transaction may share it exactly. Anything that needs a total order uses `(updatedAt, id)`, which is why the cursor does.

## Gotchas

**★ Symptom: a client's card list starts silently skipping rows after a deploy.** Cause: the collection's ordering changed — a new `ORDER BY`, or an index change that made an unordered query come back differently — while cursors encode positions in the old order. Fix: the ordering is a contract term. State it, put a total order in the query including the id as a tiebreaker, and treat a change to it as a breaking change with the same ceremony as renaming a field.

**★ Symptom: a round trip through the UI wipes a card's description.** Cause: the response omitted `body` because it was null, the client `GET`s, spreads, and `PUT`s back an object with no `body` key, and `PUT` is a full replace. Fix: emit every key on every response, null included. This is the single strongest argument for `null` over key-omission and it costs nothing.

**★ Symptom: a client stores `createdAt` and its sort order differs from the server's.** Cause: timestamps serialised without an offset, or in local time, so string comparison and date parsing disagree. Fix: RFC 3339 in UTC with an explicit offset, produced from the application in one place. Never rely on the database session's `TimeZone` — behind a transaction pooler that setting does not reliably survive to the next statement.

**★ Symptom: a partner's integration breaks when you add `'blocked'` to `status`.** Cause: their code exhaustively switched on three values with no default, which was reasonable given a contract that did not say the set could grow. Fix: say it, in the contract, before the fourth value exists — *"members may be added; existing members never change"* — so the client author can write a default. Retrofitting that sentence after the break is an apology, not a contract.

**★ Symptom: someone adds a `boardName` field to the card response "since it is one join away".** Cause: the representation drifting toward whatever the current screen needs. Fix: resist, or accept it permanently — every field is forever, and a denormalised field is also a cache invalidation problem, because renaming a board now has to be visible in every card response. If a screen needs the board name, the screen fetches the board.

**★ Symptom: an internal id, a `deletedAt` or a `teamId` shows up in the API response after a refactor.** Cause: the handler returned the row instead of the projection. Fix: the DAL returns a projection typed as `CardRepresentation`, never a `select *` ([04d](04d-projections-not-rows.md)). The `deletedAt` column exists for soft delete and is not part of the representation — the contract says nothing about it, which is the only reason topic 08 is free to change how it works.

**★ Symptom: a client displays `position` as "card 1.5 of 12".** Cause: the number leaked into the UI because the contract said "number" and the client author had to guess what it meant. Fix: the comment in the contract does real work here — *"Ordering key. Not an index."* Where display order matters, the client renders the array index of what the server sent, which is why the server's ordering promise is the thing that matters and the value is not.

**★ Symptom: the list response is a bare array and product now wants pagination.** Cause: no envelope, so there is nowhere to put a cursor without changing the top-level type. Fix: the wrapper, from day one. Retrofitting it means every client's `for (const card of res)` becomes `for (const card of res.data)`, which is a breaking change bought for nothing.

## Interview questions

**★ Why return `null` for an absent description rather than omitting the key?**
Because the two states have to mean different things somewhere in the API, and the place they usefully differ is the `PATCH` body — an absent key means "leave it alone", an explicit `null` means "clear it". Once absence carries that meaning on the write side, the read side has to be unambiguous, so every response emits every key. The failure this prevents is concrete and silent: a client that reads a card, edits the title and `PUT`s the object back would drop every field that was null at read time, because those fields were never in the object it received. A few bytes per response buys the elimination of a data-loss bug that is nearly impossible to find from the outside.

**★ Why is the id described as an opaque string when you know it is a UUID?**
Because the description is a promise about what you may not change, and "UUID v4" forecloses decisions you will want later. PostgreSQL 18 ships `uuidv7()`, which is temporally sortable and therefore much friendlier to a b-tree index than v4's random distribution; adopting it is a schema change with real performance consequences and zero client impact — *provided* no client validates the version nibble. The same argument applies to any future move to a prefixed id or a shorter encoding. Saying "opaque string" costs nothing today and preserves the option; saying "UUID" sells it.

**★ What is wrong with returning a bare JSON array from a list endpoint?**
It has no room. The moment you need pagination, a total, a warning, a schema version or a partial-failure indicator, the only place to put it is a new top-level shape, and changing a top-level array into an object breaks every consumer's iteration at once. There is also a historical security argument — JSON array responses were once exploitable via array-constructor overriding in older browsers — but the practical reason is simply extensibility. An envelope costs one key and makes every future addition additive rather than breaking, which is the same reason the status enum is documented as growable.

**★ Why does the contract state an ordering, when the client could sort what it receives?**
Because the client cannot sort what it did not receive. Once the collection is paginated, ordering is not presentation — it is the definition of which rows are in which page, and a cursor is meaningless without a stable total order. That is also why the order must include the id as a final tiebreaker: `(created_at)` alone is not a total order, so two cards created in the same transaction can swap between requests and a cursor pointing between them will either skip or repeat one. Stating the order in the contract, indexing it in the schema and encoding it in the cursor are one decision written three times, and they have to agree.

**★ Which changes to a response are safe, and what makes the "add a field" case safe in particular?**
Adding a field is safe because ignoring unknown keys is the baseline behaviour of every JSON parser anyone will use, and because nothing about the existing fields moves. Everything else is a spectrum. Tightening a nullable field to non-null is safe for readers and breaking for writers, because inputs you used to accept now fail. Loosening a non-null field to nullable is the reverse and is the more dangerous of the two, because it breaks readers at runtime rather than at deploy — every consumer that called a string method on it now throws. Renaming is never safe and has no clever version: add the new name, populate both, migrate callers, remove the old one. That is the API-side spelling of expand/contract, and it is the same four steps the database version uses in [02e](02e-expand-and-contract.md).

**★ Why does `version` appear in the body when there is already an `ETag` header?**
Because they serve different consumers. `ETag` and `If-Match` are the HTTP-native mechanism, understood by caches and proxies and by client libraries that implement conditional requests properly. The `version` field is for the client that does not — a browser `fetch` wrapper that never reads response headers, a mobile SDK, a script. Both carry the same fact, so there is one source of truth in the database and two spellings on the wire. What the contract must say, and this is the part people omit, is that the client may not assume the number increases by exactly one; a retried transaction or a trigger can skip values, and code that computes `version + 1` locally instead of echoing what the server sent will fail intermittently.

**★ Why refuse to include a total count in the list response?**
Because it is the cheapest-looking field in the API and one of the most expensive to serve. An exact count means counting rows that match the filter on every request, which is a scan the pagination query itself deliberately avoids; adding it converts a bounded keyset read into an unbounded one and does so invisibly, because the response looks the same. It is also a field clients display, which means once it is there it can never be approximate. If the product genuinely needs it, it belongs on a separate, separately-cached endpoint where the cost is visible and someone has to choose to pay it.

---

← [01b · Six routes, and the codes](01b-the-six-routes-and-the-codes-they-commit-to.md) · Next → [02 · The schema and the migration story](02-the-schema-and-the-migration-story.md)
