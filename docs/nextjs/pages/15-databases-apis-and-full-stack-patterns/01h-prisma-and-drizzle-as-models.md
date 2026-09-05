---
title: "Prisma and Drizzle disagree about what a schema *is* — one is a DSL you compile into a client, the other is TypeScript you import — and almost everything else about them falls out of that single choice"
sidebar_label: "01h · Prisma and Drizzle as models"
sidebar_position: 9
description: "Declaring the same two tables in both languages, the opposite nullability defaults that quietly destroy every NOT NULL constraint you thought you had, and the export rule that makes a table invisible to the migration generator."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Prisma ORM documentation — [Models](https://www.prisma.io/docs/orm/prisma-schema/data-model/models) — and the Drizzle ORM documentation — [Schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration), [`llms-full.txt`](https://orm.drizzle.team/llms-full.txt). npm dist-tags read from `registry.npmjs.org` on 2026-09-05.
> Documentation-verified; **no sandbox run**.
> Target: **Prisma 7.10.0** · **`drizzle-orm` 0.45.2** (`drizzle-kit` 0.31.10) · Next.js 16.3.4 · PostgreSQL 18.4 · Node 24.20.0.

**The connection story is finished. [01b](01b-the-three-kinds-of-pool.md) through [01ga](01ga-where-the-prisma-instance-lives.md) covered pools, poolers, prepared statements and where the client instance lives, and none of it depends on which ORM you picked — the hub says so, and it is worth repeating, because the internet mostly argues the opposite. This page starts the part that genuinely differs: how each tool lets you say what a table is. Prisma's schema is a separate language in a separate file that a code generator turns into a client; Drizzle's schema is ordinary TypeScript that you `import` and that the compiler reads directly. That is not a syntax preference. It decides whether you have a build step, what your migration tool can even see, and which mistakes are loud — and it is why the two tools break in completely different places.**

## One difference, and everything follows from it

Prisma's model lives in `schema.prisma`, in the Prisma Schema Language:

> *"A model describes one kind of record: a user, an order, a blog post."*
> *"On a relational database, a model becomes a table. On MongoDB, it becomes a collection."*
> — [Prisma · Models](https://www.prisma.io/docs/orm/prisma-schema/data-model/models)

That file is **not** TypeScript and `tsc` never reads it. It is input to `prisma generate`, which — as [01g](01g-prisma-the-generated-client-and-driver-adapters.md) covers — writes a client, types included, to the `output` path v7 now requires you to specify. Your application imports the *artifact*, never the schema.

Drizzle's model lives in a `.ts` file and is the thing you import:

> *"When you define your schema, it serves as the source of truth for future modifications in queries (using Drizzle-ORM) and migrations (using Drizzle-Kit)."*
> — [Drizzle · Schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration)

There is no generate step in that sentence, and that is the whole point. `drizzle-kit` reads the same TypeScript your app reads. Nothing is emitted for your application to import.

Hold that next to a Next.js build and the consequences arrive immediately:

| | Prisma 7 | Drizzle 0.45.2 |
|---|---|---|
| Schema is | `schema.prisma`, its own DSL | `schema.ts`, ordinary TypeScript |
| Types come from | `prisma generate`, written to disk | `tsc`, inferring from the table objects |
| Can types go stale against the schema? | **Yes** — the artifact can lag the file | **No** — there is no artifact to lag |
| Needs a step before `next build`? | **Yes** — generate, or the import does not resolve | No |
| Schema readable without running TypeScript | Yes, it is a plain declarative file | No |
| Migration tooling reads | `schema.prisma` | your **exported** table objects |

Neither column is the good one. The Prisma column buys a declarative artifact that a person, a linter or a diagram tool can read without executing anything, and pays for it with a generation step CI can forget. The Drizzle column deletes the step and pays for it by making the schema legible only to a TypeScript compiler.

## The same two tables, twice

SprintDesk needs `boards` and `cards`: a board owned by a user, cards belonging to a board, one optional description, one array of labels.

```prisma
// prisma/schema.prisma
model Board {
  id          String   @id @default(uuid())
  title       String
  description String?
  labels      String[]
  ownerId     String   @map("owner_id")
  createdAt   DateTime @default(now()) @map("created_at")
  cards       Card[]

  @@index([ownerId])
  @@map("boards")
}

model Card {
  id       String @id @default(uuid())
  title    String
  position Int
  boardId  String @map("board_id")
  board    Board  @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId])
  @@map("cards")
}
```

```ts
// db/schema.ts
import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    labels: text("labels").array().notNull().default([]),
    ownerId: text("owner_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("boards_owner_id_idx").on(t.ownerId)],
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
  },
  (t) => [index("cards_board_id_idx").on(t.boardId)],
);

export const boardsRelations = relations(boards, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  board: one(boards, { fields: [cards.boardId], references: [boards.id] }),
}));
```

Read those side by side and three things deserve naming, because each has bitten somebody. The two `relations()` blocks at the bottom are doing something quite different from what they look like they are doing — that is [01ha](01ha-relations-mean-different-things.md)'s subject and it is the most consequential difference of all.

### Nullability defaults point in opposite directions

In PSL a field is required and you opt *out*:

> *"A trailing `?` makes the field optional: `name String?`"*

In Drizzle a column is nullable and you opt *in*, with `.notNull()`. Nothing warns you either way. A Drizzle table transcribed from a Prisma schema by someone reading down the field list produces a table where **every column is nullable**, migrates cleanly, and hands back `string | null` everywhere for the rest of the project's life.

This is the highest-frequency porting defect between the two, and it fails in the safe-looking direction: a nullable column accepts every write a `NOT NULL` column would, so nothing errors, no test fails, and the missing constraint surfaces months later from a path nobody was thinking about.

### Column naming is a decision in one and a default in the other

Prisma needs `@@map("boards")` for the table and a field-level `@map("owner_id")` for each snake-case column. Drizzle takes the SQL name as the first argument to the column helper — and if you omit it:

> *"By default, Drizzle will use the TypeScript key names for columns in database queries."*

So `ownerId: text()` produces a column literally named `ownerId`. That is legal Postgres, but it is a quoted mixed-case identifier, which means every hand-written query, every `psql` session and every BI tool has to quote it too, forever. Passing the name explicitly, as above, is the version you want in anything that will outlive the prototype.

### Arrays, defaults, and the minimum a table needs

`labels String[]` in PSL —

> *"A trailing `[]` makes it a list: `tags String[]`"*

— is `text("labels").array()` in Drizzle, and the empty-array default has to be said out loud there rather than being implied.

Two structural rules from the Drizzle side are easy to skip and expensive to rediscover:

> *"A table in Drizzle should be defined with at least 1 column, the same as it should be done in database."*

> *"export all the models from those files so that the Drizzle kit can import them and use them in migrations."*

That second sentence is a trap with no error message attached. A table declared with `const` instead of `export const` is invisible to the migration generator while remaining perfectly usable in queries. Everything type-checks and the generated SQL simply has no `CREATE TABLE` in it.

## Gotchas

**★ Symptom: every Drizzle column is nullable and TypeScript makes you handle `null` on fields you know are required.** Cause: PSL and Drizzle default in opposite directions — PSL fields are required unless marked `?`, Drizzle columns are nullable unless you call `.notNull()`. A schema transcribed field-by-field from Prisma silently loses every `NOT NULL`. Fix: make `.notNull()` the reflex and let optionality be marked by its *absence*, the inverse of the habit PSL builds:

```ts
export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),      // required — say so
  description: text("description"),    // genuinely optional — the only bare one
});
```

**★ Symptom: hand-written SQL against a Drizzle-created table fails with `column "ownerid" does not exist`.** Cause: the column name defaulted to the TypeScript key — *"By default, Drizzle will use the TypeScript key names for columns in database queries"* — so the real identifier is the mixed-case `ownerId`, and an unquoted query is folded to lower case by Postgres. Fix: name every column explicitly at declaration time and keep SQL identifiers snake-case:

```ts
ownerId: text("owner_id").notNull(),
```

**★ Symptom: a table you wrote is missing from the generated migration, and nothing errored.** Cause: drizzle-kit works from the exported bindings — *"export all the models from those files so that the Drizzle kit can import them and use them in migrations"* — and the table was declared with `const`. Fix: export every table, and re-export each schema file through one barrel so a new file cannot be forgotten by the migration generator without also breaking the query builder:

```ts
// db/schema.ts
export * from "./schema/boards";
export * from "./schema/cards";
export * from "./schema/comments";
```

**★ Symptom: a `default([])` array column comes back as `null`, and `labels.length` throws on a type that said `string[]`.** Cause: `.array()` alone leaves the column nullable, so an insert that does not mention it stores `NULL` rather than an empty array. Fix: the two modifiers are not interchangeable and you need both:

```ts
labels: text("labels").array().notNull().default([]),
```

**★ Symptom: the Prisma schema and the database agree on structure, but the client queries a table that is not there.** Cause: `@@map` was added after the first migration. It changes the SQL Prisma *generates*; it does not rename anything that already exists, so the model is `Board`, the schema says the table is `boards`, and the deployed database still has `Board`. Fix: `@@map` needs its own migration carrying the rename — add the attribute and the migration in the same change, never the attribute alone.

**★ Symptom: `npm i -D prisma` installs a release candidate.** Cause: the `prisma` CLI's `latest` dist-tag pointed at **`8.0.0-rc.13`** when `registry.npmjs.org` was read on 2026-09-05, with `7.10.0` sitting under `prev`. Fix: pin the CLI to the same version as the client explicitly rather than taking the tag:

```json
{
  "dependencies": { "@prisma/client": "7.10.0" },
  "devDependencies": { "prisma": "7.10.0" }
}
```

A CLI and a client on different majors generate a client the runtime may not accept, and the failure shows up at query time rather than at install time.

**★ Symptom: two developers generate different SQL from the same Drizzle schema.** Cause: drizzle-kit resolves the schema through your TypeScript config, so a path alias, a different `tsconfig` target, or a schema file one of them forgot to add to the barrel produces a different set of visible tables. Fix: point `drizzle.config.ts` at the barrel and nothing else, so there is exactly one door into the schema:

```ts
export default { schema: "./db/schema.ts", dialect: "postgresql" };
```

**★ Symptom: an index you declared in Drizzle does not exist in the database.** Cause: the third argument to `pgTable` is a *callback returning* the index list; a callback that builds an object without returning it, or an arrow body wrapped in braces with no `return`, is silently a no-op. Fix: use the array-returning arrow form, where forgetting to return is a syntax error rather than a quiet omission:

```ts
(t) => [index("boards_owner_id_idx").on(t.ownerId)],
```

## Interview questions

**★ Why does Prisma need a build step and Drizzle does not?**
Because their schemas live in different languages. `schema.prisma` is a DSL that `tsc` cannot read, so something has to translate it into TypeScript before your code can be checked against it — that translation is `prisma generate`, and its product is an artifact on disk that you import. Drizzle's schema is already TypeScript, so the compiler reads the same file your application does and there is nothing to emit. The step is not overhead Prisma failed to remove; it is the price of having a declarative schema file that is not code, and that file is a real benefit for anything that wants to read your schema without executing it.

**★ A Drizzle table exists in the code and never appears in a migration. What happened?**
It was not exported. drizzle-kit discovers tables through the exported bindings of the schema module, so a `const` table is invisible to it while remaining perfectly usable in queries. The tell is that everything type-checks, every query compiles, and the generated SQL simply has no `CREATE TABLE` in it — there is no error to search for, which is why the barrel-export habit is worth adopting before you need it.

**★ Why is the nullability default difference more dangerous than it looks?**
Because it fails in the safe-looking direction. A nullable column accepts every write a `NOT NULL` column would, so nothing errors on insert, no test fails, and the constraint's absence only surfaces when some *other* path writes a `null` — often months later, and often from a batch job rather than the request path. It also turns every derived type into `string | null`, so teams typically paper over it with non-null assertions in application code instead of repairing the column, which locks the defect in permanently.

**★ You are porting a Prisma schema to Drizzle. What is your checklist, in order?**
Constraints first, because they are the ones that vanish silently: every non-`?` PSL field becomes `.notNull()`, and every `@relation` becomes a `.references()` on the column. Then names: `@@map` and `@map` become the explicit string arguments to `pgTable` and each column helper. Then defaults, remembering that an array column needs both `.notNull()` and `.default([])`. Then exports, so drizzle-kit can see everything. Finally, diff the generated SQL against the existing database rather than trusting the two schema files to have said the same thing.

**★ What do you lose by having a schema that is only readable by a TypeScript compiler?**
Every tool that is not a TypeScript compiler. A `schema.prisma` can be read by a diagram generator, a documentation site, a linter, a reviewer on a phone, or a colleague who does not know the language — it is declarative text with no execution semantics. A Drizzle schema is a program; extracting its shape means running it. In practice this shows up when someone wants an ER diagram, when a data team wants to know the column types, or when a security review wants a list of tables holding personal data, and the answer each time is "run the TypeScript".

**★ Why is `@@map` added late a migration problem rather than a schema problem?**
Because Prisma's schema describes the desired state and the migration is what moves the database toward it, but adding `@@map` alone changes only what *future* generated SQL says a table is called. The existing table keeps its old name, the generated client starts querying the new one, and nothing in the type system or the schema file is wrong — the two just describe different databases. It is the clearest small example of the general rule that a schema file is a claim and a migration is the thing that makes the claim true.

---

← [01ga · Where the instance lives](01ga-where-the-prisma-instance-lives.md) · Next → [01ha · Relations mean different things](01ha-relations-mean-different-things.md)
