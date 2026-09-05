---
title: "Prisma writes your types to disk and Drizzle computes them from the table objects — which means one can go stale and the other cannot, and neither of them knows a single thing about the database that is actually running"
sidebar_label: "01hb · Generated vs inferred types"
sidebar_position: 110
description: "`$inferSelect` and `$inferInsert` against the generated model type, why both tools narrow on partial selects, the exact ceiling of ORM type safety, and what happens to your types the moment you drop to raw SQL."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Drizzle ORM documentation — [Goodies](https://orm.drizzle.team/docs/goodies), [`llms-full.txt`](https://orm.drizzle.team/llms-full.txt) — and the Prisma ORM documentation — [Models](https://www.prisma.io/docs/orm/prisma-schema/data-model/models), [Generating Prisma Client](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client).
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** · **`drizzle-orm` 0.45.2** · TypeScript 5.x · Next.js 16.3.4 · PostgreSQL 18.4.

**"Type-safe ORM" is two different promises depending on which one you bought. Prisma's types are a build artifact: `prisma generate` writes a declaration file and you import a `Board` type by name. Drizzle's types are a computation: nothing exists on disk and `typeof boards.$inferSelect` asks the table object what a row looks like. That difference decides exactly one thing — whether your types can lag your schema file — and it is worth being precise about it, because the far more dangerous gap is the one both tools share and neither advertises: a compiler that has never seen your database and cannot tell you when the two disagree.**

## Written down versus computed

**Prisma writes the types down.** After `prisma generate` there is a real declaration file at the `output` path v7 makes you choose ([01g](01g-prisma-the-generated-client-and-driver-adapters.md)), with a `Board` type in it that you import by name:

```ts
import type { Board, Card } from "@/prisma/generated/client";

function boardTitle(board: Board): string {
  return board.title;
}
```

**Drizzle computes them.** There is nothing on disk; you ask the table object what its row shape is:

```ts
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { boards } from "@/db/schema";

type Board = typeof boards.$inferSelect;      // what a SELECT returns
type NewBoard = typeof boards.$inferInsert;   // what an INSERT accepts

// the equivalent named-helper form, if you prefer it
type BoardAlt = InferSelectModel<typeof boards>;
type NewBoardAlt = InferInsertModel<typeof boards>;
```

The two spellings are interchangeable. `$inferSelect` reads better inline; `InferSelectModel` reads better in a generic constraint, where `typeof x.$inferSelect` gets noisy.

### Two row types, not one

Drizzle gives you **two** row types where Prisma's model type is one, and the pairing is genuinely useful. Against the `boards` table from [01h](01h-prisma-and-drizzle-as-models.md):

| | `$inferSelect` | `$inferInsert` |
|---|---|---|
| `id` (has `defaultRandom()`) | `string`, required | `string`, **optional** |
| `title` (`.notNull()`) | `string`, required | `string`, required |
| `description` (nullable) | `string \| null` | `string \| null \| undefined` |
| `createdAt` (has `defaultNow()`) | `Date`, required | `Date`, **optional** |

The type of *"a row I am about to create"* is not the type of *"a row I read back"*, and defaults are exactly where they diverge.

Prisma has the same distinction — it just does not present it as a matched pair. The read shape is `Board`; the write shape is `Prisma.BoardCreateInput`. Because only one of them is named after the model, people reach for `Board` on the write path and then rebuild the insert shape by hand:

```ts
// don't — this drifts silently the moment a column gains a default
type NewBoard = Omit<Board, "id" | "createdAt">;

// do — the generated input type tracks the schema
import type { Prisma } from "@/prisma/generated/client";
async function createBoard(data: Prisma.BoardCreateInput) {
  return prisma.board.create({ data });
}
```

The `Omit` version compiles forever and is wrong from the first migration that adds a defaulted column.

## The ceiling, and it is the same ceiling for both

🔴 **Neither Prisma's generated types nor Drizzle's inferred types know anything about the database that is actually running.** They describe the schema *file*. If the file says `title` is `NOT NULL` and the deployed database has a nullable `title` because a migration was generated and never applied, both tools hand you a `string`, and both hand you `null` at runtime.

Type safety here means *"your code agrees with your schema file"* — not *"your code agrees with your database"*. What makes those two agree is a migration you actually ran, which is **01i · Migrations in each** *(not written yet)*, and the reason that page has to exist is precisely that no type system closes this gap.

Within that ceiling, the failure modes differ, and the difference is smaller than the marketing on either side:

- Prisma's types can be **stale relative to the schema file**, because they are a build artifact. Edit `schema.prisma`, skip `prisma generate`, and the compiler cheerfully checks your code against yesterday's model.
- Drizzle's types **cannot** be stale relative to the schema file — there is nothing to lag — but they can be stale relative to the *database*, exactly as Prisma's can, and with less to remind you, because nothing regenerates and so nothing ever visibly fails.

Neither is safer overall. Prisma converts one drift class into a loud module-resolution error; Drizzle deletes that class entirely and leaves the quieter, more dangerous one untouched. Anyone who tells you Drizzle is "more type-safe" is describing the class that was deleted and ignoring the one that was not.

## Narrowing is more similar than the marketing suggests

Both narrow the return type when you ask for fewer columns. Prisma does it with generics over the `select` object:

```ts
const rows = await prisma.board.findMany({
  select: { id: true, title: true },
});
// rows: { id: string; title: string }[] — no createdAt on the type
```

Drizzle builds the type from the selection you passed:

```ts
const rows = await db
  .select({ id: boards.id, title: boards.title })
  .from(boards);
// rows: { id: string; title: string }[]
```

The distinction people reach for — *"Prisma returns whole models, Drizzle returns what you selected"* — is not the real one. Both narrow, and both narrow correctly.

The real distinction shows up in **joins**. A Drizzle `leftJoin` widens the joined side to `T | null` in the result type, because a left join can produce no matching row — which is correct, and which people report as a bug roughly once per project:

```ts
const rows = await db
  .select({ card: cards, board: boards })
  .from(cards)
  .leftJoin(boards, eq(cards.boardId, boards.id));
// rows: { card: Card; board: Board | null }[]  ← the null is the join's, not a schema error
```

Switch to `innerJoin` and the `| null` disappears, because an inner join cannot produce one. The type is tracking the SQL, which is the whole design.

## Where both type systems stop: raw SQL

Every ORM has a floor, and it is the point where the query you need is not expressible in the builder — a window function, `DISTINCT ON`, a recursive CTE, `SELECT … FOR UPDATE SKIP LOCKED`. What each tool does at that floor is a real difference.

**Prisma hands you an untyped escape.** `$queryRaw` returns whatever you assert:

```ts
const rows = await prisma.$queryRaw<{ boardId: string; cardCount: bigint }[]>`
  SELECT board_id AS "boardId", COUNT(*) AS "cardCount"
  FROM cards GROUP BY board_id
`;
```

That type parameter is an assertion, not a check. Nothing verifies the column names or that `COUNT(*)` comes back as `bigint` — which it does, and which will surprise anyone who wrote `number` and then tried to `JSON.stringify` it. The tagged-template form does parameterise your interpolations, so it is safe against injection; it is only the *types* you are on your own for.

**Drizzle keeps you inside the same expression.** The `sql` template can be typed and composed with the builder rather than replacing it:

```ts
import { sql, eq } from "drizzle-orm";

const rows = await db
  .select({
    boardId: cards.boardId,
    cardCount: sql<number>`count(*)::int`.as("card_count"),
  })
  .from(cards)
  .groupBy(cards.boardId);
```

`sql<number>` is still an assertion — Drizzle cannot type-check SQL either — but the cast to `int` is right there next to it, the rest of the query stays typed, and you have not left the builder to get one aggregate.

Neither tool type-checks SQL. The difference is how much of your query you have to abandon typing for in order to write the part it cannot express.

### `.toSQL()`, and why it is more useful than it sounds

Drizzle will hand you the generated SQL without a database:

```ts
const { sql: text, params } = db
  .select({ id: boards.id, title: boards.title })
  .from(boards)
  .groupBy(boards.id)
  .toSQL();
```

The documentation notes this works standalone, without a connection instance. That makes the generated SQL a thing you can assert on in a unit test, paste into `EXPLAIN`, or show in a code review — none of which requires a running database, a container, or a fixture. It is the cheapest possible answer to *"what is this ORM actually sending?"*, and Prisma's equivalent is query-event logging, which needs a client and a connection.

## Gotchas

**★ Symptom: the types are stale — a column visible in `schema.prisma` is not on the model type.** Cause: the client was generated before the schema changed, most often by pulling a teammate's migration. Fix: `npx prisma generate`, then **restart the TypeScript server** — the editor caches the old declaration file even after the one on disk is replaced, so the regenerate appears not to have worked.

**★ Symptom: `Omit<Board, "id" | "createdAt">` compiles but rejects a valid insert after a migration.** Cause: a hand-rolled insert type does not track new defaulted columns; the schema gained one and the `Omit` list did not. Fix: use the generated `Prisma.BoardCreateInput` in Prisma, or `typeof boards.$inferInsert` in Drizzle. Both are derived, so neither can drift.

**★ Symptom: `COUNT(*)` from `$queryRaw` breaks `JSON.stringify` with `Do not know how to serialize a BigInt`.** Cause: Postgres returns `count` as `bigint`, the driver maps it to a JavaScript `BigInt`, and the type parameter you wrote said `number` without anything checking. Fix: cast in SQL so the value really is what the type claims:

```ts
const rows = await prisma.$queryRaw<{ cardCount: number }[]>`
  SELECT COUNT(*)::int AS "cardCount" FROM cards
`;
```

**★ Symptom: a Drizzle `leftJoin` result has `| null` on a side you know always matches.** Cause: nothing is wrong — the type tracks the join, and a left join is allowed to produce no row. Fix: if the match is guaranteed by a foreign key, say so in SQL rather than in a non-null assertion:

```ts
.innerJoin(boards, eq(cards.boardId, boards.id))   // now the type has no | null
```

**★ Symptom: `sql<number>` returns a string at runtime.** Cause: the generic is an assertion about a value the driver produced, not an instruction to the driver. `count(*)` is `bigint` and several Postgres types arrive as strings by default. Fix: put the cast in the SQL, where it has an effect — `` sql<number>`count(*)::int` `` — and treat every `sql<T>` without a matching cast as a claim you have not checked.

**★ Symptom: a Prisma type import resolves in one developer's editor and not another's, on the same commit.** Cause: the generated client is a build artifact at a path *you* chose, so its presence is a property of the working copy rather than of the repository. Fix: generate on `postinstall` as well as in `build` — the CI shape is in [01g](01g-prisma-the-generated-client-and-driver-adapters.md). Drizzle has no equivalent failure, because there is nothing to generate.

**★ Symptom: `select` narrowed the type but the runtime object still has every column.** Cause: in Prisma this should not happen and usually means a `select` written inside `include`, or a raw query typed as a model. In Drizzle it happens when you pass a *table* rather than a column map — `db.select().from(boards)` selects everything by design. Fix: pass the explicit column map when you want narrowing, and remember that the empty `select()` is "all columns", not "no columns".

**★ Symptom: the types are perfect and production still throws on `null`.** Cause: the ceiling — the schema file and the deployed database disagree, and no compiler can see it. Fix: make "the migration ran" a deploy-time assertion rather than an assumption, and until **01i · Migrations in each** *(not written yet)* lands, treat any type-versus-runtime mismatch as a migration question first and a code question second.

## Interview questions

**★ What exactly does "type-safe" guarantee in Prisma or Drizzle, and what does it not?**
It guarantees your code agrees with your *schema definition*. It guarantees nothing about the database that is running. Both tools will type a column as `string` because the schema says so, and both will hand you `null` if the deployed table permits it. The only thing that makes the schema and the database agree is an applied migration — which is why a migration story is not an optional extra bolted onto either tool, it is the part actually carrying the guarantee people think the types are carrying.

**★ Where can a Prisma type go stale, and where can a Drizzle type go stale?**
Prisma's can lag the schema file, because it is generated: edit `schema.prisma`, skip `prisma generate`, and you are type-checking against yesterday. Drizzle's cannot — there is no artifact — but both can lag the database. Prisma converts one drift class into a loud module-resolution error and Drizzle deletes that class outright, while the quieter and more dangerous class is identical in both.

**★ Why does Drizzle give you two row types where Prisma gives you one?**
Because the shape of a row you insert genuinely differs from the shape of a row you read: defaults and generated columns are optional going in and guaranteed coming out. `$inferSelect` and `$inferInsert` name that difference directly. Prisma has the same distinction — `Board` is the read shape and `Prisma.BoardCreateInput` is the write shape — but because only one is named after the model, people reach for the model type on the write path and rebuild the insert type with `Omit`, which drifts the moment a column gains a default.

**★ Someone proposes committing the generated Prisma client so CI does not need a generate step. What do you say?**
That it trades a loud failure for a silent one. Uncommitted, a missing generate is a module-resolution error that stops the build; committed, a stale generate is a client that compiles and queries columns which no longer exist. It also puts thousands of lines of machine-written code into every diff, making review worthless and merges unresolvable. The fix is to make generation unskippable — `postinstall` and `build` both — not to remove the step.

**★ A `sql<number>` in Drizzle and a `$queryRaw<T>` in Prisma are both assertions. Is one better?**
Neither is checked, so on safety they are equal — both will happily claim a `bigint` is a `number`. The difference is scope. `$queryRaw` replaces the whole query, so one aggregate that the builder cannot express costs you typing on every column in it. Drizzle's `sql` template composes into the builder, so the untyped fragment is the fragment and the rest of the query stays typed. That is an argument about blast radius, not about correctness.

**★ Why does a `leftJoin` change the result type and an `innerJoin` not?**
Because a left join is defined to emit a row when the right side has no match, so the joined columns are genuinely nullable in the result set; an inner join emits nothing in that case, so they are not. The type is describing SQL semantics rather than schema semantics, which is why a `| null` can appear on a column declared `NOT NULL`. Reaching for `!` there is treating a correct type as a bug — the honest fixes are to use an inner join or to handle the null.

**★ What can you learn from `.toSQL()` that you cannot learn from the types?**
Whether the query you wrote is the query you meant. Types describe the shape of the result; `.toSQL()` shows the statement and its parameters, and it works without a database connection, so it can be asserted on in an ordinary unit test or pasted straight into `EXPLAIN`. Every real performance question — is this one query or N, is the index used, did the ORM add a subquery you did not ask for — is answered by the SQL, and never by the types.

**★ If neither ORM's types can see the database, what is the actual value of ORM type safety?**
Refactoring, and rename safety in particular. When the schema file changes, every call site that no longer matches it fails to compile, which is a genuine and large benefit over string-keyed query code. What it does not buy is a runtime guarantee, and conflating the two is how teams end up with no migration verification, no runtime validation at the edges, and a great deal of confidence.

---

← [01ha · Relations mean different things](01ha-relations-mean-different-things.md) · Next → [01hc · Ergonomics, size and when each is wrong](01hc-ergonomics-size-and-when-each-is-wrong.md)
