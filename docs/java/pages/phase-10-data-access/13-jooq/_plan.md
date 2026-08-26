# Topic 13 · jOOQ — chunk plan

Tier: **Know**. Target: jOOQ 3.20.x (⚠️ verify the current release), Spring Boot 4.1.0,
PostgreSQL 18, JDK 25.

## Boundary

- **13 owns** — jOOQ as the typed-SQL alternative: code generation, the DSL, and where it
  beats both JPA and `JdbcClient`.
- **05 owns `JdbcTemplate`/`JdbcClient`** and already argues the SQL-first case. 13 is the
  *generated, type-checked* version of that argument — contrast, do not repeat.
- **06/07/08** own JPA. 13 says plainly where JPA is the better choice.

## Chunks (a PLAN, not a budget — split at 301 lines, rule 1)

| # | File | What it argues |
|---|---|---|
| 1 | `01-what-jooq-is.md` | SQL as a typed Java DSL — the compiler checks your query |
| 1b | `01b-the-licence-question.md` | ⚠️ Open source for open-source databases; commercial for the rest — **verify the current terms**, this decides adoption |
| 2 | `02-code-generation.md` | The generator reads your schema; the schema is the source of truth |
| 2b | `02b-generating-from-migrations.md` | Flyway → testcontainer → generate; links to topic 11 |
| 3 | `03-the-dsl.md` | `select().from().where()` — and how it differs from a string |
| 3b | `03b-joins-and-aliasing.md` | Where the type safety actually pays |
| 4 | `04-mapping-results.md` | `Record`, `into(Class)`, `fetchInto`, and Java records |
| 5 | `05-writes.md` | `insertInto`, `update`, `mergeInto`, returning generated keys |
| 6 | `06-postgres-specifics.md` | Window functions, CTEs, `jsonb`, arrays — the reason people adopt it |
| 7 | `07-transactions-and-spring.md` | Sharing Spring's `DataSource` and `@Transactional` |
| 8 | `08-jooq-vs-jpa.md` | The honest comparison — reporting and complex joins vs. an aggregate you mutate |
| 8b | `08b-using-both.md` | jOOQ for reads, JPA for writes: when that is sane and when it is two models |
| 9 | `09-the-cost.md` | A build step, a generated source tree, and a team that must know SQL |

## Traps to verify, not assume

- ⚠️ **The licensing model is the single most consequential fact on this topic** and it has
  changed. Verify against jooq.org before writing a word about it.
- ⚠️ Boot's jOOQ auto-configuration and the `spring-boot-starter-jooq` state in 4.1.
- ⚠️ jOOQ's minimum Java version and the free-edition JDK support matrix.
