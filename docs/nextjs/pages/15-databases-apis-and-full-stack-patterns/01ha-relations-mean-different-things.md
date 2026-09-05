---
title: "A Drizzle `relations()` block creates no foreign key — so a schema can declare a complete, type-checked, correctly-joining relation graph and still produce a database with no referential integrity at all"
sidebar_label: "01ha · Relations mean different things"
sidebar_position: 10
description: "Prisma's virtual back-relation versus Drizzle's two separate declarations, why only one of them touches the database, the `defineRelations` API that the docs show and npm does not ship, and what an implicit many-to-many costs you later."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Prisma ORM documentation — [Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) — and the Drizzle ORM documentation — [Relations](https://orm.drizzle.team/docs/relations), [`llms-full.txt`](https://orm.drizzle.team/llms-full.txt). The stable-line API surface was confirmed by reading the published typings at `https://unpkg.com/drizzle-orm@0.45.2/relations.d.ts`.
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** · **`drizzle-orm` 0.45.2** (`drizzle-kit` 0.31.10) · PostgreSQL 18.4 · Next.js 16.3.4.

**[01h](01h-prisma-and-drizzle-as-models.md) declared `boards` and `cards` in both tools and left one thing hanging: the two `relations()` blocks at the bottom of the Drizzle schema. They are not what a Prisma reader assumes they are. In Prisma, one `@relation` attribute does two jobs — it gives you a navigation property *and* it is what Migrate turns into a real foreign key. In Drizzle those are two unrelated declarations, and only one of them reaches the database. Get this wrong and you ship a schema that compiles, joins correctly, passes your tests, and permits orphan rows forever. It is the most expensive misunderstanding available in Drizzle, and there is no Prisma equivalent of it.**

## In Prisma, the relation field is virtual and the foreign key is real

> *"The model that stores the connection carries two fields: a scalar field for the foreign key column, and a relation field"*
> *"The `posts Post[]` field on `User` is the back-relation: it stores nothing in the database and is inferred from the foreign key"*
> *"Because the list field is virtual, you never write to it."*
> — [Prisma · Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)

In the `Card` model from [01h](01h-prisma-and-drizzle-as-models.md), `boardId String` is the column and `board Board @relation(fields: [boardId], references: [id], onDelete: Cascade)` is the navigation handle. Crucially, **that one attribute is also what Prisma Migrate turns into `REFERENCES boards(id) ON DELETE CASCADE` in the database.** One declaration, both jobs, and they cannot get out of step with each other because there is only one of them.

The `cards Card[]` on `Board` is the other half, and it is the virtual one. It occupies no column; Prisma computes it from the foreign key on the far side. Which is why writing to it does nothing:

```ts
// wrong — the list field is virtual, this assignment reaches no database
const board = await prisma.board.findUniqueOrThrow({ where: { id } });
board.cards.push({ title: "Ship it", position: 0 } as never);

// right — write the scalar side
await prisma.card.create({ data: { title: "Ship it", position: 0, boardId: id } });

// or use the nested write, which Prisma translates into the same insert
await prisma.board.update({
  where: { id },
  data: { cards: { create: { title: "Ship it", position: 0 } } },
});
```

## In Drizzle, they are two declarations doing two jobs, and only one touches the database

> *"The sole purpose of Drizzle relations is to let you query your relational data in the most simple and concise way."*
> *"Foreign keys are a database level constraint… On the other hand, `relations` are a higher level abstraction, they are used to define relations between tables on the application level only."*
> *"they do not affect the database schema in any way and do not create foreign keys implicitly."*
> — [Drizzle · Relations](https://orm.drizzle.team/docs/relations)

Read that last sentence twice, then look back at the schema:

```ts
export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),   // ← the ONLY foreign key
});

export const cardsRelations = relations(cards, ({ one }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
}));                                                          // ← creates nothing in the DB
```

The constraint comes from `.references()` and *only* from there. The `relations()` block underneath creates nothing whatsoever in the database; it exists so that `db.query.cards.findMany({ with: { board: true } })` knows how to join.

🔴 **Therefore a Drizzle schema can declare a complete, working, type-checked relation graph and produce a database with no referential integrity at all.** Delete the `.references()` call and keep the `relations()` block: everything still compiles, `with: { board: true }` still returns the right rows because the join is driven by the columns you named in `fields`/`references` at the *application* level, and the migration drizzle-kit generates has no foreign key in it. Orphan cards become possible the moment a board is deleted. Your test suite is unlikely to notice, because your tests delete through your own code, which cascades in application logic that will one day not run.

There is no way to make this mistake in Prisma. A `@relation` cannot half-exist.

### The one place the separation is a feature

It is worth being fair to the design, because the split is not an oversight. Drizzle lets the query-level relation and the database-level constraint differ **deliberately**, which is exactly what you need against a database you do not own:

- a **read replica** or a **view**, where you cannot add constraints but still want `with:` to work;
- a **legacy schema** whose foreign keys were dropped years ago for bulk-load performance;
- a **cross-database** or cross-service boundary, where the referenced table is not in this database at all;
- a **soft-delete** design where the constraint would block the parent row's tombstone.

Prisma's coupling is the right default; Drizzle's separation is the right escape hatch. The failure is not that Drizzle separated them — it is that the separation is invisible unless you already know about it.

## The API the docs show is not the API npm ships

⚠️ **This is a live discrepancy as of 2026-09-05, not a historical note.**

The published Drizzle relations documentation describes the **1.0 release-candidate** line (`drizzle-orm@rc`). It shows a `defineRelations` API, with helpers written as `r.many.posts()` — *"`r.many.posts()` defines that `feed` will be an array of objects from the `posts` table rather than just an object"* — and `r.one.users`.

npm `latest` for `drizzle-orm` is **0.45.2**. Reading its published typings at `https://unpkg.com/drizzle-orm@0.45.2/relations.d.ts` shows **no `defineRelations` export at all**. The stable line exports:

```ts
export declare function relations<
  TTableName extends string,
  TRelations extends Record<string, Relation<any>>
>(
  table: AnyTable<{ name: TTableName }>,
  relations: (helpers: TableRelationsHelpers<TTableName>) => TRelations,
): Relations<TTableName, TRelations>;
```

alongside `One` and `Many` classes — which is the `relations(table, ({ one, many }) => ({ … }))` form used throughout [01h](01h-prisma-and-drizzle-as-models.md) and this page.

**Write the form your installed version exports, not the form on the website.** Expect the relations layer to be the first thing that breaks when you take the 1.0 upgrade, and pin the version rather than following a dist-tag: `drizzle-orm@rc` is a different API, not a newer patch of the same one.

## Querying across the relation

The surface ergonomics converge far more than the underlying models do:

```ts
// Prisma
const board = await prisma.board.findUnique({
  where: { id },
  include: { cards: { orderBy: { position: "asc" } } },
});
```

```ts
// Drizzle, relational query builder
const board = await db.query.boards.findFirst({
  where: (b, { eq }) => eq(b.id, id),
  with: { cards: { orderBy: (c, { asc }) => [asc(c.position)] } },
});
```

Two things to know about the Drizzle call.

**`db.query` only exists if you passed the schema.** The namespace is built from the `schema` option, so a `db` constructed as `drizzle(pool)` has `select`, `insert` and `update` but no `query` at all — which surfaces as a `Cannot read properties of undefined (reading 'boards')` at the call site, some distance from the construction that caused it:

```ts
import * as schema from "@/db/schema";
export const db = drizzle(pool, { schema });   // relations included, because they are exported
```

**`with:` is the only consumer of `relations()`.** A hand-written join ignores them entirely and works whether or not you declared any:

```ts
const rows = await db
  .select({ card: cards, board: boards })
  .from(cards)
  .innerJoin(boards, eq(cards.boardId, boards.id));   // no relations() needed
```

That is worth knowing in both directions: you can adopt Drizzle without declaring a single relation, and you can have a fully-declared relation graph that half your codebase never touches.

## Where implicit many-to-many parts company

Prisma models both shapes:

> *"A one-to-many relation (`1:n`) connects one record to many: one user writes many posts, and each post belongs to one user."*
> *"A many-to-many relation (`m:n`) connects many records on each side: a post has many tags, and a tag applies to many posts."*

and it can maintain the junction table for you when you declare a list on both sides, without your ever writing a join model. Drizzle has no such thing: a many-to-many is a junction table you declare like any other table, with two `.references()` columns and its own `relations()` block wiring both sides.

```ts
export const cardLabels = pgTable(
  "card_labels",
  {
    cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    labelId: uuid("label_id").notNull().references(() => labels.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);

export const cardLabelsRelations = relations(cardLabels, ({ one }) => ({
  card: one(cards, { fields: [cardLabels.cardId], references: [cards.id] }),
  label: one(labels, { fields: [cardLabels.labelId], references: [labels.id] }),
}));
```

That is more typing, and it is also more honest — the table exists either way. The Prisma version has naming and column conventions you have to look up the moment anything other than Prisma needs to read it, and it cannot carry a column of its own. `addedAt` above is the tell: the instant a join row needs a fact about the join, an implicit m:n has to be converted into an explicit one, and that conversion is a data migration rather than a schema edit.

## Gotchas

**★ Symptom: cards survive the deletion of their board; the database holds orphan rows nothing in the app can reach.** Cause: the `relations()` block was declared and `.references()` was not. Drizzle's relations *"do not affect the database schema in any way and do not create foreign keys implicitly"*, so the join worked and the constraint never existed. Fix: the constraint lives on the column, always — the relation block is additive, never a substitute:

```ts
boardId: uuid("board_id")
  .notNull()
  .references(() => boards.id, { onDelete: "cascade" }),
```

Then audit what actually shipped instead of trusting the schema file:

```sql
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
```

**★ Symptom: `db.query` is `undefined` at runtime, though `db.select()` works fine.** Cause: the relational query builder is constructed from the `schema` option; `drizzle(pool)` with no second argument has no `query` namespace. Fix: pass the whole schema module, so tables and relations arrive together:

```ts
import * as schema from "@/db/schema";
export const db = drizzle(pool, { schema });
```

**★ Symptom: `with: { cards: true }` throws about a missing relation even though the column and the foreign key are both correct.** Cause: `.references()` gives the database its constraint but tells the query builder nothing; `db.query` reads only the `relations()` declarations. Fix: declare both — and **export** the relations object, because an unexported `relations()` never reaches the `import * as schema` spread and so never reaches `db.query`.

**★ Symptom: `defineRelations` is not exported from `drizzle-orm`, though the documentation uses it throughout.** Cause: the published docs describe the 1.0 release candidate; npm `latest` is 0.45.2, whose typings export `relations` and no `defineRelations`. Fix: use `relations(table, ({ one, many }) => ({ … }))` on the stable line, and pin the version deliberately rather than following `latest` or `rc`.

**★ Symptom: assigning to `board.cards` on a Prisma result appears to work and writes nothing.** Cause: the back-relation is virtual — *"it stores nothing in the database and is inferred from the foreign key"*, and *"Because the list field is virtual, you never write to it."* Fix: write the scalar side, or use a nested write:

```ts
await prisma.board.update({
  where: { id: boardId },
  data: { cards: { create: { title, position } } },
});
```

**★ Symptom: a many-to-many query written against a Prisma implicit relation cannot be reproduced in raw SQL because nobody knows the junction table's name.** Cause: an implicit m:n means Prisma owns the junction table's naming and column conventions, and nobody ever wrote them down. Fix: declare the join model explicitly whenever anything other than Prisma will touch it — analytics SQL, a bulk loader, or a migration to another tool. The conversion is cheap before there is data in it and a migration afterwards.

**★ Symptom: `onDelete: Cascade` is in the Prisma schema and deletes still fail with a foreign key violation.** Cause: the referential action is emitted into the migration, so a schema edit with no corresponding applied migration leaves the database with whatever action it had before — usually `NO ACTION`. Fix: this is the same class as `@@map` added late, in [01h](01h-prisma-and-drizzle-as-models.md): the attribute is a claim, the migration makes it true. Check what the database actually has with the `pg_constraint` query above, which reports the action as part of the constraint definition.

**★ Symptom: a Drizzle `with:` query returns the parent rows but every nested array is empty.** Cause: the relation was declared in one direction only. `relations(cards, …)` giving `cards.board` does not give you `boards.cards`; each side is its own declaration, and a missing one is not an error — it just means `with: { cards: … }` has nothing to resolve. Fix: declare both directions, and treat them as a pair that changes together:

```ts
export const boardsRelations = relations(boards, ({ many }) => ({ cards: many(cards) }));
export const cardsRelations = relations(cards, ({ one }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
}));
```

## Interview questions

**★ A colleague says Drizzle's `relations()` gives you referential integrity. What is wrong with that?**
Everything, and it is the most expensive misunderstanding available in the tool. Its own documentation says relations *"do not affect the database schema in any way and do not create foreign keys implicitly"* — they exist so the relational query builder knows how to join. The foreign key comes from `.references()` on the column, separately and independently. A schema with relations and no `.references()` compiles, joins correctly, passes tests that delete through application code, and produces a database that will happily orphan rows.

**★ Prisma declares the relation once and Drizzle declares it twice. Is Prisma's version strictly better?**
It is safer, because the two halves cannot get out of step. It is less flexible for exactly the same reason. Drizzle lets the query-level relation and the database-level constraint differ deliberately, which is what you need against a read replica, a view, a legacy schema whose constraints were dropped, or a boundary where the referenced table lives in another database entirely. Prisma's coupling is the right default and Drizzle's separation is the right escape hatch; the real criticism is that Drizzle's separation is invisible rather than that it exists.

**★ How would you actually verify that the foreign keys you think you declared exist?**
Query the catalog, not the schema file — `pg_constraint` filtered to `contype = 'f'`, or `\d+ tablename` in `psql`. The whole point of this failure mode is that every artifact under your control agrees with you and the database does not, so the only evidence that settles it comes from the database. In CI this is worth automating as an assertion that the constraint count matches expectations, because the defect has no other signal.

**★ Why does `db.select().from(...).innerJoin(...)` work when `db.query...with` does not?**
Because they consume different things. The manual join is SQL you wrote: the tables and the `eq()` predicate are all it needs, and `relations()` is irrelevant to it. The relational query builder derives its joins from the `relations()` declarations exposed through the `schema` option, so it fails when a relation is undeclared, unexported, or declared in only one direction. They are two APIs over the same tables, not two spellings of one API.

**★ Under what circumstances would you deliberately declare a Prisma many-to-many explicitly rather than implicitly?**
Whenever anything other than Prisma will touch the junction table — hand-written analytics SQL, a bulk loader, a migration to another tool — or when the join row needs a column of its own, such as `addedAt` or `addedBy`. An implicit m:n cannot carry extra columns at all, and converting it later is a data migration rather than a schema edit, so the cheap moment to decide is before there is data in the table.

**★ What is the difference between a relation field and a scalar relation field in Prisma, and why does it matter operationally?**
The scalar field is the actual foreign key column and the relation field is the navigation handle Prisma computes from it. It matters because only one of them is writable: the list side *"stores nothing in the database"*, so mutating it in application code is a no-op that looks like a write. It also matters for `select`, where asking for the relation field costs a join or a second query while asking for the scalar costs nothing.

**★ You inherit a Drizzle codebase and want to know, quickly, whether its relation graph is trustworthy. What do you check?**
Three greps and one query. Count `.references(` occurrences against the number of foreign-key-shaped columns; count `relations(` blocks against the number of tables; check that every `relations` binding is exported. Then run the `pg_constraint` query against a real database and compare. The mismatch you are hunting is more `relations()` declarations than `.references()` calls, which is the signature of a schema where the joins work and the constraints do not exist.

---

← [01h · Prisma and Drizzle as models](01h-prisma-and-drizzle-as-models.md) · Next → [01hb · Generated types and inferred types](01hb-generated-types-and-inferred-types.md)
