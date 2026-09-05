---
title: "One is a client that models your data and one is SQL wearing TypeScript — and the bundle-size argument everyone has about them is the wrong argument, because in an App Router codebase neither one should ever reach a browser"
sidebar_label: "01hc · Ergonomics, size, when each is wrong"
sidebar_position: 111
description: "The criteria object versus the query builder, Drizzle's prepared-statement API and the pooler that defeats it, what 7.4kb actually buys you on a server, and an honest list of the cases where each tool is the wrong choice."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Drizzle ORM documentation — [`llms-full.txt`](https://orm.drizzle.team/llms-full.txt) (Overview, Query performance, Migrations fundamentals) — and the Prisma ORM documentation — [Generating Prisma Client](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client), [Connection pool](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool).
> Documentation-verified; **no sandbox run**, **no measurements of our own**.
> Target: **Prisma 7.10.0** · **`drizzle-orm` 0.45.2** (`drizzle-kit` 0.31.10) · Next.js 16.3.4 · PostgreSQL 18.4 · Node 24.20.0.

**[01h](01h-prisma-and-drizzle-as-models.md) covered the schema, [01ha](01ha-relations-mean-different-things.md) the relations and [01hb](01hb-generated-types-and-inferred-types.md) the types. What is left is the part people usually start with and should finish with: how the two feel to write, what they cost at runtime, and when each one is simply the wrong tool. The ergonomic difference is real and reduces to one sentence — Prisma models your data and Drizzle models SQL — but the *size* difference, which is where most comparisons spend their energy, is close to irrelevant in an App Router application, and it is worth explaining exactly why before anyone makes a decision on it.**

## A client that models data, and a builder that models SQL

Prisma gives you a method per model and a criteria object:

```ts
const boards = await prisma.board.findMany({
  where: { ownerId, title: { contains: query, mode: "insensitive" } },
  orderBy: { createdAt: "desc" },
  take: 20,
});
```

Drizzle gives you SQL with the clauses spelled as method calls:

```ts
import { and, eq, ilike, desc } from "drizzle-orm";

const rows = await db
  .select()
  .from(boards)
  .where(and(eq(boards.ownerId, ownerId), ilike(boards.title, `%${query}%`)))
  .orderBy(desc(boards.createdAt))
  .limit(20);
```

Both are readable. The differences that matter are not aesthetic:

| | Prisma | Drizzle |
|---|---|---|
| What you need to know | the client's vocabulary | SQL, plus a thin mapping |
| Discoverability | high — autocomplete on `where` walks you through it | moderate — you must know the operator exists to import it |
| Predicting the emitted SQL | hard; you infer it | direct; the call *is* the clause |
| Transfers to another tool | poorly | almost completely |
| `null` handling | `null` in criteria means `IS NULL` | explicit `isNull(col)` |

The last row is the sort of thing that decides real arguments. `ilike` in Drizzle has to be imported before you can use it, which is friction; `mode: "insensitive"` in Prisma has to be *known about*, which is worse friction, because autocomplete will not suggest a key you have not started typing.

The deeper trade is about who the tool is for. Prisma's criteria object is genuinely better for a team where not everyone writes SQL: it is a smaller vocabulary, it is guided, and it makes a whole class of query impossible to write badly. Drizzle's builder is better for a team that *does* write SQL, because everything they already know transfers, and because — as its own documentation puts it —

> *"we're a thin TypeScript layer on top of SQL with almost 0 overhead"*

which cuts both ways: nothing is hidden, and nothing is provided.

### The escape hatch, and where the ergonomics really bite

The point where the difference becomes concrete is the query the builder cannot express — a window function, `DISTINCT ON`, a recursive CTE, `SELECT … FOR UPDATE SKIP LOCKED`. Prisma sends you out of the client into `$queryRaw` and you lose typing on the whole query; Drizzle's `sql` template composes into the builder so you lose it only on the fragment. That mechanism, with code for both, is in [01hb](01hb-generated-types-and-inferred-types.md#where-both-type-systems-stop-raw-sql) — the ergonomic point here is just how *often* you land there, and the honest answer is: sooner than you expect in any application that reports on its own data, and possibly never in a CRUD application that does not.

## Prepared statements: Drizzle's performance lever, and the pooler that defeats it

Drizzle exposes prepared statements as an explicit API rather than doing it invisibly:

> *"When it comes to Drizzle — we're a thin TypeScript layer on top of SQL with almost 0 overhead and to make it actual 0, you can utilise our prepared statements API."*

> *"With prepared statements you do SQL concatenation once on the Drizzle ORM side and then database driver is able to reuse precompiled binary SQL instead of parsing query all the time."*

```ts
import { sql } from "drizzle-orm";

const boardById = db
  .select()
  .from(boards)
  .where(eq(boards.id, sql.placeholder("id")))
  .prepare("board_by_id");

const board = await boardById.execute({ id });
```

Two things about that, and the second one is the one that costs people a day.

The saving is the *Drizzle-side* SQL construction plus the server-side parse — real, and largest on queries executed in a tight loop. It is not a saving on planning or execution, and it will not rescue a query with no index.

🔴 **A named prepared statement needs a session, and a transaction-mode pooler does not give you one.** This is exactly the mechanism [01d](01d-prepared-statements-under-a-pooler.md) covers for Prisma — where it surfaces as `prepared statement "s0" already exists` — and it is not a Prisma problem, it is a Postgres protocol fact. A `.prepare("board_by_id")` behind PgBouncer in transaction mode is at best a no-op and at worst a name collision across pooled backends. **Prepare against a direct connection or a session-mode pooler, or do not prepare.**

## Bundle size: the right number, applied to the wrong question

Drizzle's size claims are the headline of its own overview and they are not in dispute:

> *"Drizzle ORM is dialect-specific, slim, performant and serverless-ready **by design**."*
> *"Drizzle has exactly 0 dependencies!"*
> *"~7.4kb minified+gzipped"*

Those are real advantages and the zero-dependency claim in particular is worth more than the kilobytes — it is a supply-chain property, not a performance one.

⚠️ **Prisma publishes no comparable minified+gzipped figure for a generated v7 client, and this page will not invent one.** What can be said from the documentation is structural: the client is generated from your models, so its size is a function of how many models you have ([01g](01g-prisma-the-generated-client-and-driver-adapters.md)), and v7's move to driver adapters means the Node driver you supply is a separate dependency you were paying for anyway. Anyone quoting you a precise Prisma-versus-Drizzle byte count should be asked where they measured it and on which schema.

🔴 **Now the part that matters: in an App Router application this is a server-bundle question, and mostly it is not a question at all.** Neither ORM belongs in a client bundle. If either one is in yours, you do not have a size problem — you have a boundary bug, and the diagnosis is in [ch03](../03-server-components-vs-client-components/01-explanation.md): a module that touches the database was imported, directly or transitively, from a `"use client"` file. The fix is the import graph, not the dependency.

So the size number is really about two narrower things:

- **Cold start.** A smaller server bundle initialises faster, which matters on a platform that creates fresh instances under load. How much it matters depends on your host's behaviour, and no primary source gives a figure worth quoting — the honest framing is that it is one input among several, and usually smaller than the connection-establishment cost [01b](01b-the-three-kinds-of-pool.md) describes.
- **Runtimes with a hard budget.** Where the deployment target genuinely caps bundle size, "0 dependencies and ~7.4kb" versus "a generated client that scales with your model count" is a live constraint rather than a talking point.

Outside those two, choosing an ORM on kilobytes is optimising the wrong axis, and the axes that actually decide the outcome are in the next section.

## When each one is the wrong choice

This is the section most comparisons skip, so it gets the space.

### Prisma is the wrong choice when…

- **Your queries are the product.** Reporting, analytics, anything with window functions, lateral joins or recursive CTEs. You will live in `$queryRaw`, which means you bought a client and are using it as a connection pool.
- **You cannot tolerate a codegen step.** Some CI setups, some monorepo caching schemes and some edge build pipelines make `prisma generate` awkward. It is solvable, but if it is a fight every sprint, it is a fight.
- **You need the schema to be the database's, not the file's.** Introspecting an existing, actively-changing database you do not own is not what Prisma's model is shaped for.
- **You need a query the client cannot express and typing matters throughout it.** See above; the loss is total for that query rather than partial.
- **You want one dependency.** The client plus the CLI plus a driver adapter plus the driver is four moving parts on four release cadences — and as [01h](01h-prisma-and-drizzle-as-models.md) notes, the CLI's `latest` tag pointed at an `8.0.0` release candidate on 2026-09-05, which is precisely the kind of thing four moving parts do.

### Drizzle is the wrong choice when…

- **Your team does not write SQL.** Drizzle assumes SQL fluency and gives you nothing when it is missing. Prisma's guided vocabulary is a genuine productivity gain for a team that would otherwise be guessing.
- **You want the constraint safety of a single declaration.** The `.references()` / `relations()` split in [01ha](01ha-relations-mean-different-things.md) is a real, silent footgun and no amount of care removes it entirely from a large team.
- **You want implicit many-to-many.** Drizzle has none. Every junction table is yours to declare, name and maintain.
- **You want the surrounding ecosystem.** Studio-style data browsing, mature adapters for auth libraries, and the sheer volume of Prisma answers on the internet are real assets on a deadline.
- **You need the published documentation to describe the version you installed.** As of 2026-09-05 the Drizzle docs describe the 1.0 release candidate while npm `latest` is 0.45.2, and the relations API differs between them ([01ha](01ha-relations-mean-different-things.md)). That is a tax on every developer you onboard until it resolves.

### And the criteria that should not decide it

Bundle size, unless you are in one of the two narrow cases above. Benchmark numbers from either project's marketing. "Which is more type-safe", which [01hb](01hb-generated-types-and-inferred-types.md) shows to be a question about *which drift class* rather than about degree. And any argument about connection pooling, because as the hub says and [01b](01b-the-three-kinds-of-pool.md) through [01ga](01ga-where-the-prisma-instance-lives.md) demonstrate, both sit on the same three escapes and the ORM choice is orthogonal to that problem entirely.

## Gotchas

**★ Symptom: the ORM appears in a client bundle and the build warns about Node built-ins like `fs` or `net`.** Cause: a module that imports the database module was imported, directly or transitively, from a `"use client"` file — this is a boundary bug, not a size problem. Fix: trace the import chain rather than swapping tools, and put the client behind a server-only module so the mistake becomes a build error instead of a bundle:

```ts
// db/index.ts
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
export const db = drizzle(pool, { schema });
```

**★ Symptom: `.prepare()` behind a connection pooler either does nothing or collides across requests.** Cause: a named prepared statement lives in a session, and transaction-mode pooling does not give you a stable one — the same mechanism as [01d](01d-prepared-statements-under-a-pooler.md). Fix: prepare only against a direct connection or a session-mode pooler; behind a transaction pooler, drop the `.prepare()` and accept the parse cost.

**★ Symptom: a Drizzle query needs `ilike` and the operator is not on the builder.** Cause: operators are named imports, not methods — nothing autocompletes them until they are in scope. Fix: import from `drizzle-orm`, and expect this to be the shape of most early friction with the tool:

```ts
import { and, or, eq, ne, gt, inArray, isNull, ilike, desc, asc } from "drizzle-orm";
```

**★ Symptom: a Prisma `where` with `title: null` matches nothing, or matches everything, depending on who wrote it.** Cause: `null` in a Prisma filter means `IS NULL`, while `undefined` means *"omit this condition"* — so a filter built from an optional variable changes meaning depending on which absent value it received. Fix: never let a possibly-`null` variable reach a criteria object directly:

```ts
const where = { ownerId, ...(title !== undefined ? { title } : {}) };
```

**★ Symptom: a query is slow and nobody can say what SQL ran.** Cause: the criteria object hides the statement, and reasoning about it from the client call is guesswork. Fix: get the SQL rather than arguing about it — Drizzle's `.toSQL()` needs no connection at all ([01hb](01hb-generated-types-and-inferred-types.md)), and Prisma's query event logging needs a client and a running database, which is a real difference in how cheap the answer is.

**★ Symptom: a prepared statement was added for performance and nothing got faster.** Cause: the saving is SQL construction plus server-side parse, and the query was slow for a different reason — a missing index, a sequential scan, N+1 round trips. Fix: read the plan before optimising the parse; a statement executed once per request was never spending meaningful time being parsed.

**★ Symptom: the team picked an ORM on bundle size and then hit the connection limit anyway.** Cause: the two are unrelated. Instance count times pool size is the arithmetic that produces connection exhaustion, and it is identical under both tools. Fix: size the pool and pick the escape as the hub and [01b](01b-the-three-kinds-of-pool.md) describe, and make the ORM decision on schema, relations and team fluency instead.

## Interview questions

**★ Is Drizzle faster than Prisma?**
Not in any way that a well-indexed application will notice, and the question is usually asked about the wrong layer. Drizzle is a thinner layer with less to do per query and a smaller footprint to initialise, which shows up in cold starts and in tight loops. It does not change the plan Postgres chooses, the indexes you have, the number of round trips your code makes, or the connection cost — and those are what determine query latency in practice. Anyone whose ORM is their bottleneck should look at their query count first.

**★ Why is the bundle-size comparison mostly irrelevant in a Next.js App Router app?**
Because neither ORM should ever be in a client bundle. Database access lives on the server, so the size in question is a server bundle, where it affects cold start rather than page weight. If an ORM has reached your client bundle you have an import-boundary bug — something under `"use client"` transitively imports the database module — and the fix is the import graph, not a smaller dependency. The size argument only becomes real on a runtime with a hard bundle cap.

**★ What does Drizzle's `.prepare()` actually save, and when is it unavailable?**
It saves the Drizzle-side SQL construction and the server-side parse, by naming a statement the driver can reuse. It is unavailable in any meaningful sense behind a transaction-mode pooler, because a named prepared statement is session state and transaction pooling does not give you a stable session — the same reason Prisma's use of named statements produces `prepared statement "s0" already exists` behind PgBouncer. Prepare against a direct connection, or do not prepare.

**★ Give a concrete case where Prisma is the wrong tool.**
Anything where the queries are the product. An analytics or reporting surface needs window functions, `DISTINCT ON`, lateral joins and recursive CTEs, none of which the client models — so the work happens in `$queryRaw`, which is untyped and outside the abstraction. At that point you are paying for a client, a CLI, a generation step and a schema DSL to obtain a connection pool, and the honest reading is that the tool is not what the workload needs.

**★ Give a concrete case where Drizzle is the wrong tool.**
A team that does not write SQL. Drizzle's builder is a thin mapping over SQL and it assumes you know what you want to emit; when that fluency is missing it provides no guidance and no guard rails, and query quality tracks the weakest SQL author on the team. Prisma's smaller, guided vocabulary makes a whole class of bad query hard to express, which is worth more than any of the properties Drizzle wins on for that team.

**★ Someone wants to switch ORMs to fix a connection-limit problem. What do you tell them?**
That the ORM is not the variable. Connections are instance count multiplied by pool size, and that arithmetic is identical under Prisma, Drizzle and hand-written `pg`. The escapes — a transaction-mode pooler, an HTTP driver, or fewer instances — are the same three in every case. Switching ORMs mid-incident replaces a known system with an unknown one and does not change the number that is too large.

**★ Both tools drop you into raw SQL eventually. Does that make the abstraction worthless?**
No, it makes it an abstraction. The useful question is what the escape costs. Prisma's `$queryRaw` replaces the whole query, so one inexpressible aggregate costs typing on every column in it; Drizzle's `sql` template composes into the builder, so the untyped part is the fragment. Neither type-checks SQL, and neither can — the difference is blast radius, and it is a reasonable thing to choose on if you know you will be writing that kind of query.

**★ How would you actually run this decision for a new team?**
Write the three or four hardest queries the product needs in both tools before choosing, because that is where the difference is real and the tutorials are silent. Then check the two operational facts: whether a code-generation step fits your CI, and whether your team writes SQL. Everything else — size, benchmarks, type-safety marketing — is noise next to those, and the connection architecture, which is what usually goes wrong first, is the same either way.

---

← [01hb · Generated vs inferred types](01hb-generated-types-and-inferred-types.md) · Next → **01i · Migrations in each** *(not written yet)*
