---
title: "A typed query builder removes string concatenation from your `WHERE` clause and does nothing at all for your `ORDER BY` — the real injection risk in this stack is an allow-list that is not an allow-list, and it fails as a lookup that falls through rather than as a quote that escapes"
sidebar_label: "06b · Filtering and sorting"
sidebar_position: 39
description: "Where Drizzle parameterises and where it does not, sql versus sql.raw, the allow-list written as a map rather than as an includes check, validating the query string as input, and the filter that quietly bypasses the ownership predicate."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 `LIMIT` and `OFFSET` reference](https://www.postgresql.org/docs/18/queries-limit.html), the [PostgreSQL 18 `SELECT` reference](https://www.postgresql.org/docs/18/sql-select.html), and the Next.js [`route.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/route) (`version: 16.3.4`).
> `sql` versus `sql.raw` behaviour and the `.where()` replacement semantics **read from the published `drizzle-orm` 0.45.2 build** (`sql/sql.js`, `pg-core/query-builders/select.js`); the condition-helper surface probed from the published `0.45.2` typings (`sql/expressions/conditions.d.ts`).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `zod` **4.4.3** · Node **24.20.0**.

**Everyone learns SQL injection as a story about quotes: a value gets concatenated into a statement, an apostrophe escapes the literal, and the rest of the input is code. A typed query builder genuinely closes that, and it closes it for values only. The parts of a statement that are not values — the column you sort by, the direction, the column you filter on — cannot be parameters, because a bind parameter can never be an identifier. So the query builder hands them back to you as strings, and the safety of your endpoint comes down to whether the thing you called an allow-list actually is one.**

## Where the builder parameterises, and where it cannot

A bind parameter stands in for a *value*. PostgreSQL will not accept `ORDER BY $1` as "sort by the column named in `$1`" — it would sort every row by the same constant, which is a no-op, not an error. That is not a Drizzle limitation; it is how the protocol works, and it means identifiers are always assembled by your code.

| Part of the query | Parameterised? | Who is responsible |
|---|---|---|
| `WHERE status = ?` — the value | ✅ bind parameter | the builder |
| `WHERE title ILIKE ?` — the pattern | ✅ bind parameter | the builder, but see the `%` gotcha below |
| `LIMIT ?` / `OFFSET ?` — the numbers | ✅ bind parameter | the builder, if you pass numbers |
| `ORDER BY <column>` — the identifier | ❌ impossible | **you** |
| `ORDER BY … ASC\|DESC` — the direction | ❌ impossible | **you** |
| `WHERE <column> = ?` — which column | ❌ impossible | **you** |

Three of six rows are yours. That is the actual attack surface of a "safe" query builder.

## `sql` is safe, `sql.raw` is not, and they are one character apart

Drizzle's tagged template interpolates each `${}` as a parameter. `sql.raw` concatenates the string into the statement text. Read from the published 0.45.2 build, `sql/sql.js`:

```js
function raw(str) {
  return new SQL([new StringChunk(str)]);
}
```

A `StringChunk` goes into the query text verbatim; only interpolated `Param` chunks become bind parameters. So:

```ts
// ✅ the value is a bind parameter
db.select().from(cards).where(sql`${cards.title} ilike ${pattern}`)

// 🔴 the string is the statement. This is the one dangerous call in the library.
db.select().from(cards).orderBy(sql.raw(`${sortColumn} ${direction}`))
```

The second form is exactly what people reach for when they discover `orderBy` needs a dynamic column, and it is a straight concatenation of request input into SQL. There is no quoting to get right, because there are no quotes involved — the input *is* code.

⚠️ `sql.raw` is not a mistake in the library. It is necessary for identifiers, savepoint names and DDL fragments, which is why Drizzle's own transaction code uses it — ``sql.raw(`savepoint ${savepointName}`)`` appears in the 0.45.2 node-postgres session. **The rule is that its argument must never come from a request**, directly or after a transformation you wrote.

## The allow-list that is not an allow-list

Here is the shape that gets written, reviewed, and shipped:

```ts
// 🔴 wrong, and it looks right
const SORTABLE = ['createdAt', 'title', 'position', 'status']

function buildOrderBy(sort: string, dir: string) {
  if (!SORTABLE.includes(sort)) sort = 'createdAt'
  return sql.raw(`${sort} ${dir === 'desc' ? 'desc' : 'asc'}`)
}
```

The `dir` is handled. The `sort` is checked. And there are still three defects.

**1 · It reassigns instead of rejecting.** An unknown column silently becomes `createdAt`. The client asked for something specific and got something else with a 200, which is the worst possible answer — worse than a 400, because nothing tells anyone it happened.

**2 · The list holds *TypeScript* names, and the SQL needs *column* names.** `createdAt` is the property; the column is `created_at`. So the "validated" string is then interpolated into SQL where it is wrong, and whoever fixes that reaches for a second mapping — which is the map you should have had in the first place.

**3 · The membership test and the interpolation are two separate steps, and nothing ties them together.** A refactor that adds a column to `SORTABLE`, a caller that skips `buildOrderBy`, a second sort parameter added six months later — each of them can pass the input through without the check, and neither the compiler nor the type system objects, because the value is a `string` at every point.

### The allow-list as a map from input to column object

```ts
// lib/dal/card-query.ts
import 'server-only'
import { asc, desc, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { cards } from '@/db/schema'

/**
 * The allow-list IS the mapping. There is no path from a request string to a
 * column that does not go through this object, because the values are column
 * objects — not names — and a column object cannot be produced from a string.
 */
const SORT_COLUMNS = {
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
  title: cards.title,
  position: cards.position,
  status: cards.status,
} as const

export const SortKey = z.enum(
  Object.keys(SORT_COLUMNS) as [keyof typeof SORT_COLUMNS],
)
export const SortDir = z.enum(['asc', 'desc'])

export function orderByFor(
  key: z.infer<typeof SortKey>,
  dir: z.infer<typeof SortDir>,
): SQL[] {
  const column = SORT_COLUMNS[key]
  const direction = dir === 'desc' ? desc : asc
  // The id tiebreaker makes the order total; see 06 and 06d for why.
  return [direction(column), asc(cards.id)]
}
```

🔴 **The property that makes this safe is not the check — it is that the unsafe value never exists.** `SORT_COLUMNS[key]` returns a Drizzle column object, and `asc(column)` builds a properly-quoted identifier from that object's real name. At no point is there a string that could be concatenated into SQL, so there is no line anyone could later write that would bypass the list. Compare that to the `includes()` version, where a validated `string` is still a `string` and the interpolation is one refactor away.

The `z.enum` is derived from the same object with `Object.keys`, so adding a sortable column is one edit and forgetting to update the validator is impossible.

## The whole query string is input

```ts
// lib/schemas/card-query.ts
import { z } from 'zod'
import { SortKey, SortDir } from '@/lib/dal/card-query'

export const CardStatus = z.enum(['todo', 'doing', 'done'])

export const ListCardsQuery = z.object({
  status: CardStatus.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: SortKey.default('createdAt'),
  dir: SortDir.default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
})
```

```ts
// app/api/boards/[boardId]/cards/route.ts
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/boards/[boardId]/cards'>,
) {
  const { boardId } = await ctx.params
  const id = BoardIdParam.safeParse(boardId)
  if (!id.success) return errorResponse(400, 'invalid_board_id', 'boardId must be a UUID')

  const query = ListCardsQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!query.success) return validationResponse(query.error)

  const page = await listCards(id.data, query.data)
  return Response.json(page)
}
```

Four things about that schema are deliberate.

**`z.coerce` is correct here and wrong on a JSON body.** A query string has no types — everything is a string — so coercing `limit` is the honest move. [05b](05b-validating-at-the-boundary-with-zod.md) argues the opposite case, and the difference is entirely about the transport.

**`.max(100)` on `limit` is not politeness, it is the bound.** Without a server-side ceiling, `?limit=1000000` is an unauthenticated way to make your database materialise a million rows and your function serialise them. `.int()` matters too: `?limit=1.5` reaching `LIMIT` is a type error at the driver, which surfaces as a 500.

**`.default()` on `sort` and `dir` means the DAL never receives `undefined`.** The alternative — defaulting inside `orderByFor` — puts a second definition of "the default sort" in a second file.

**`Object.fromEntries(searchParams)` keeps only the last value of a repeated key.** `?status=todo&status=done` yields `done`, silently. If repeated keys should be a filter list, use `searchParams.getAll` explicitly and validate an array; if they should be an error, `z.strictObject` will not help you, because `fromEntries` has already collapsed them. Decide, and write the decision down.

## Filters that are not injection but are still holes

**A filter must never be able to widen the result set beyond the ownership predicate.** The predicate says *cards on boards whose team the caller belongs to*. A filter parameter that reaches the query as a `boardId` — say `?boardId=` on a global cards endpoint — hands the caller a way to select rows outside that scope, and no amount of parameterisation stops it, because the value is perfectly well-quoted. It is authorisation, not injection.

```ts
// lib/dal/cards.ts
export async function listCards(boardId: string, q: ListCardsInput) {
  await requireBoardAccess(boardId)     // the scope, fixed by the URL

  const conditions: SQL[] = [
    eq(cards.boardId, boardId),         // NOT from the query string
    isNull(cards.deletedAt),            // every read, without exception
  ]
  if (q.status) conditions.push(eq(cards.status, q.status))
  if (q.q) conditions.push(ilike(cards.title, `%${escapeLike(q.q)}%`))

  return db
    .select(CARD_COLUMNS)
    .from(cards)
    .where(and(...conditions))          // ONE where() call — see below
    .orderBy(...orderByFor(q.sort, q.dir))
    .limit(q.limit)
}
```

The scope comes from the path, which the ownership check has already validated. The filters come from the query string and can only ever narrow.

### Escaping `LIKE` metacharacters, which parameterisation does not do

``ilike(cards.title, `%${q}%`)`` binds the whole pattern as one parameter — so there is no injection — and the user's own `%` and `_` are still pattern syntax inside it. A search for `100%` matches every title containing `100`, and a search for `%` matches everything on the board, which on a large table is a full scan a client can trigger at will.

```ts
/** Escape LIKE/ILIKE metacharacters. Pair with ESCAPE '\' in the pattern. */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`)
}

// The pattern-matching reference: "The default escape character is the
// backslash but a different one can be selected by using the ESCAPE clause."
// So no ESCAPE clause is needed. Note the adjacent warning: with
// standard_conforming_strings turned off, backslashes in literal string
// constants must be doubled.
conditions.push(ilike(cards.title, `%${escapeLike(q.q)}%`))
```

### One `.where()` call, because a second one replaces the first

From the published `pg-core/query-builders/select.js` in 0.45.2, the method body is `this.config.where = where; return this;` — a plain assignment. Building conditions into an array and passing them to a single `and(...)` is not a style preference; chaining two `.where()` calls silently drops the first, which in the code above would drop **both the scope and the soft-delete predicate**.

⚠️ The same source shows the builder mutates `this` and returns `this`, so it is not immutable. A hoisted "base query" is shared mutable state:

```ts
// 🔴 one module-level builder, mutated by every request that touches it
const baseCards = db.select(CARD_COLUMNS).from(cards)
export const listA = () => baseCards.where(eq(cards.status, 'todo'))
export const listB = () => baseCards.where(eq(cards.status, 'done'))

// ✅ a function, so each call gets a fresh builder
const baseCards = () => db.select(CARD_COLUMNS).from(cards)
```

## Gotchas

**★ Symptom: `?sort=` with an unexpected value returns results sorted by something else, with a 200.** Cause: the allow-list check reassigned an unknown key to a default instead of rejecting it. Fix: `z.enum` derived from the allow-list, so an unknown key is a validation failure with a 422 naming the field. A client asking for an ordering you do not support should be told, not quietly given a different one.

**★ Symptom: sorting works for `title` and produces a database error for `createdAt`.** Cause: the allow-list held TypeScript property names and they were interpolated into SQL, where the column is `created_at`. Fix: map to column *objects*, not to names — `SORT_COLUMNS[key]` returns `cards.createdAt` and `asc()` emits the correctly-quoted identifier. The bug and the injection risk have the same root and the same fix.

**★ Symptom: a penetration test reports SQL injection in a codebase with no string concatenation.** Cause: `sql.raw` in the `orderBy`. It is the one call in the library that puts its argument into the statement text verbatim — the 0.45.2 implementation wraps the argument in a `StringChunk`, which is emitted into the statement text unchanged — so a request-derived string reaching it is code. Fix: `sql.raw` may take literals and internally-generated names only. A lint rule banning `sql.raw` with a non-literal argument catches this at review time, which is the only time it is cheap.

**★ Symptom: adding a second filter made the endpoint return every card in the table.** Cause: the second condition was added with a second `.where()`, which in Drizzle 0.45.2 assigns over the first — taking the board scope and the soft-delete predicate with it. Fix: collect conditions in an array and pass one `and(...conditions)`. Never chain `.where()`.

**★ Symptom: two endpoints interfere with each other's filters, intermittently and only under load.** Cause: a module-level query builder was shared, and the builder mutates `this` rather than returning a new object. Fix: make the base query a function so each call constructs a fresh builder. A `const` holding a builder is shared mutable state across every concurrent request in the process.

**★ Symptom: searching for `100%` returns every card containing `100`.** Cause: `%` and `_` are `LIKE` metacharacters inside the bound pattern; parameterisation prevents injection and does not neutralise pattern syntax. Fix: escape them before interpolating into the pattern, with `escapeLike` above.

**★ Symptom: a single search request pins a database core.** Cause: a leading-wildcard `ILIKE '%term%'` cannot use a B-tree index, so every search is a full scan of the board's rows — and a query of `%` matches everything. Fix: bound it and then replace it. Bound it by requiring a minimum query length and a `LIMIT`; replace it with a trigram index or full-text search, which the separate `docs/postgresql/` track owns. Do not ship an unbounded substring search on a table you expect to grow.

**★ Symptom: `?limit=100000` works.** Cause: the limit was validated as a number and not as a *bounded* number. Fix: `.int().min(1).max(100)` in the schema, and a default well below the maximum. The ceiling belongs on the server because the client is the party you are protecting yourself from.

**★ Symptom: `?limit=abc` returns 500.** Cause: `z.coerce.number()` on a non-numeric string yields `NaN`, which passes a bare `z.number()` in some pipelines and reaches the driver as an invalid `LIMIT`. Fix: `z.coerce.number().int()` rejects `NaN` — probed on `zod` 4.4.3, `z.number().safeParse(NaN).success` is `false` — and the `.min()`/`.max()` bounds then reject the rest.

**★ Symptom: `?status=todo&status=done` filters by `done` only.** Cause: `Object.fromEntries(searchParams)` keeps the last value for a repeated key. Fix: decide what a repeated key means and implement it explicitly — `searchParams.getAll('status')` validated as an array with `inArray(cards.status, values)`, or an explicit rejection. What you must not do is leave it to the collapse, because the behaviour is invisible and surprising.

**★ Symptom: a filter parameter lets a caller read cards from a board they are not on.** Cause: the scope came from the query string rather than from the path, so the ownership check validated one board and the query selected another. Fix: the scope is a path segment, the ownership check runs on it, and filters from the query string may only ever narrow. This is an authorisation bug that parameterisation cannot touch — the value was perfectly well quoted.

**★ Symptom: sorting by `title` returns pages that repeat and skip rows.** Cause: `ORDER BY title` alone is not a unique order, and the `LIMIT` reference warns that without an `ORDER BY` that *"constrains the result rows into a unique order"* you get *"an unpredictable subset of the query's rows"*. Fix: every sort ends with the id — `orderByFor` returns `[direction(column), asc(cards.id)]` — so the ordering is total whatever column the client picked.

## Interview questions

**★ A typed query builder prevents SQL injection. What does that claim actually cover?**
Values, and only values. The builder turns every interpolated value into a bind parameter, which closes the classic quote-escaping attack completely. It does nothing for the parts of a statement that cannot be parameters, because the protocol has no such thing as a parameterised identifier: `ORDER BY $1` would sort by a constant, not by a named column. So the sort column, the sort direction and the choice of which column to filter on are all assembled by your code from request input, and they are the actual attack surface. The dangerous consequence is a false sense of completeness — a team that knows it uses a query builder stops looking, and the one `sql.raw` in the `orderBy` is where the finding is.

**★ Why is a map from key to column object safer than an array plus an `includes()` check, when both reject the same inputs?**
Because they reject the same inputs *today*, and only one of them is still safe after a refactor. With the array, the validated value is a `string`, so it can be interpolated into SQL by any line anyone writes later; the check and the use are separate steps and nothing links them. With the map, the only thing you can obtain from a request key is a Drizzle column object, and there is no way to turn a string into one — so a code path that skips the lookup has nothing to interpolate and does not compile. The safety comes from making the unsafe value non-existent rather than from making it validated. As a bonus, the map also fixes the property-name-versus-column-name bug that the array version has silently, and the `z.enum` derived from `Object.keys` means the validator cannot drift from the list.

**★ Parameterisation stops injection in a search filter. Name two things it does not stop.**
Pattern metacharacters and cost. `ILIKE '%' || $1 || '%'` binds the search term safely, and the user's own `%` and `_` are still `LIKE` syntax inside it — so `100%` matches every title containing `100`, and a bare `%` matches every row on the board. That is a correctness bug for the first user and an availability problem for the second, and it needs explicit escaping of the metacharacters before the pattern is assembled. The cost problem is separate and worse: a leading wildcard cannot use a B-tree index, so every one of those searches is a scan. A well-parameterised query is not necessarily a cheap one, and an unauthenticated caller who can trigger a full scan on demand has a denial-of-service primitive that no amount of quoting addresses.

**★ Why does chaining two `.where()` calls in Drizzle 0.45.2 create a security bug rather than a logic bug?**
Because of what the first `.where()` usually contains. Read from the published build, the method body is `this.config.where = where; return this;` — a plain assignment, so the second call replaces the first rather than conjoining. In a DAL the first `.where()` is where the tenancy scope and the soft-delete predicate live, so adding a filter with a second call does not merely change which rows match; it removes the board restriction and returns tombstones as well. Nothing errors, the types are identical, and the endpoint returns more data than before — which under casual testing looks like the filter working. Building conditions into an array and passing one `and(...)` makes the mistake unexpressible.

**★ When is `z.coerce` correct, given that [05b](05b-validating-at-the-boundary-with-zod.md) argues against it?**
On a query string, because a query string genuinely has no types. Everything in `searchParams` is a string, so `?limit=20` can only ever arrive as `'20'`, and refusing to coerce it means writing the conversion by hand somewhere less visible. The argument against coercion applies to a JSON body, where numbers arrive as numbers and a string turning up where a number belongs is real information about a broken client that coercion would erase. The trap is the same in both places and worth guarding explicitly: `z.coerce.number()` on an empty string yields `0`, so an omitted-but-present parameter silently becomes a valid zero — which for `limit` means a bound check catches it and for an offset means page one forever.

**★ A caller sends a filter that selects rows outside their tenancy. Is that injection?**
No, and calling it injection sends you looking in the wrong place. The value was bound as a parameter, correctly quoted, and the statement is exactly the one you meant to run — the bug is that you meant to run the wrong statement. Injection is about input becoming code; this is about input choosing a scope, which is authorisation. The structural fix reflects that: the scope comes from the path segment that the ownership predicate has already validated, and everything from the query string is only ever conjoined into the `WHERE`, so a filter can narrow the result set and can never widen it. Any endpoint where a query parameter can select the tenant has this bug regardless of how the SQL is built.

---

← [06 · READ](06-read.md) · Next → [06c · Offset pagination and why it degrades](06c-offset-pagination-and-why-it-degrades.md)
