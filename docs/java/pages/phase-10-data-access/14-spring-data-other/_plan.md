# Topic 14 · Spring Data for MongoDB and Redis — chunk plan

Tier: **Know**. Target: Spring Data MongoDB 5.x / Spring Data Redis 4.x (⚠️ verify the
versions Boot 4.1.0 manages), MongoDB 8.x, Redis 8.x, JDK 25.

## Boundary

- **14 owns** — the *repository idiom over another store*: what carries across from Spring
  Data JPA, what does not, and where the abstraction leaks.
- **09 owns** Spring Data JPA itself. 14 assumes it and contrasts.
- The **MongoDB** and **Redis** sections of this bible own those databases. 14 owns only
  the Java boundary — never re-teach the query language or the data model here.
- This is the phase's closing topic: it should end by naming what the whole phase taught.

## Chunks (a PLAN, not a budget — split at 301 lines, rule 1)

| # | File | What it argues |
|---|---|---|
| 1 | `01-one-idiom-many-stores.md` | The repository interface is the same; nothing underneath it is |
| 2 | `02-mongodb-repositories.md` | `MongoRepository`, derived queries, `@Query` with JSON |
| 2b | `02b-documents-and-mapping.md` | `@Document`, `@Id`, `@Field`, and the `_class` discriminator |
| 3 | `03-mongotemplate.md` | Where the repository stops and the template starts |
| 3b | `03b-aggregation-from-java.md` | Building a pipeline in the DSL |
| 4 | `04-transactions-in-mongo.md` | ⚠️ Multi-document transactions need a replica set — verify, and say what a standalone dev instance cannot do |
| 5 | `05-redis-repositories.md` | `@RedisHash`, secondary indexes, TTL — and their real cost |
| 5b | `05b-when-a-repository-is-the-wrong-shape.md` | Redis is a data-structure server; a repository hides that |
| 6 | `06-redistemplate.md` | `RedisTemplate`, `StringRedisTemplate`, serializers |
| 7 | `07-what-does-not-carry-across.md` | No dirty checking, no persistence context, no JPQL, different transaction semantics |
| 8 | `08-choosing-a-store.md` | The closing argument of the phase |

## Traps to verify, not assume

- ⚠️ **Verify the Spring Data module versions Boot 4.1.0 actually manages** — the module
  version numbers diverged from the release-train names.
- ⚠️ Spring Data Redis repository secondary indexes cost extra keys and are not free.
- 🔴 **No Mongo or Redis server on this machine and no sandbox** — no console blocks, no
  `mongosh` transcripts, no `redis-cli` output, ever.
