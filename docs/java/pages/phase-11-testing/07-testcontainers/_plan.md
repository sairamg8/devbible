# Topic 07 · Testcontainers — chunk plan

Tier: **Understand**. Read `../_PHASE-NOTES.md` first.
🔴 **There is no Docker on this machine and no sandbox. No container logs, no timings, no
test-run output — ever.** Java source and documented configuration carry these pages.

## Boundary
Owns **real dependencies in tests**. Phase 10 topic 05 already has a testing chunk that
introduces `@ServiceConnection` for a SQL-first repository — `ls
../../phase-10-data-access/05-sql-first-access/` and **link to it rather than repeating
it**; 07 is the general treatment. **05 owns the context cache**; 07 explains why a
container's lifecycle interacts with it.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-passed-on-h2-proves-nothing.md` | The central argument: an in-memory impostor is a different database |
| 1b | `01b-what-h2-gets-wrong.md` | Concrete divergences from PostgreSQL 18 — types, DDL, isolation, functions |
| 2 | `02-what-testcontainers-is.md` | A Java API over a container runtime; the lifecycle it manages |
| 3 | `03-the-junit-integration.md` | `@Testcontainers`, `@Container`, static vs instance fields |
| 4 | `04-serviceconnection.md` | 🔴 The modern Boot idiom — what it wires, and what it replaced |
| 4b | `04b-dynamicpropertysource.md` | The predecessor, kept because it is still needed for the unsupported cases |
| 5 | `05-the-singleton-pattern.md` | One container for the whole suite, and why the naive `@Container` is slow |
| 5b | `05b-reuse.md` | `withReuse`, `testcontainers.properties`, and the state that leaks between runs |
| 6 | `06-schema-and-data.md` | Migrations on startup (link to Phase 10 · Flyway), init scripts, and per-test cleanup |
| 7 | `07-beyond-postgres.md` | Kafka, Redis, MongoDB, LocalStack, and a generic container |
| 8 | `08-boot-4-support.md` | ⚠️ `@ServiceConnection` coverage, `spring-boot-testcontainers`, and dev-time containers |
| 9 | `09-the-cost.md` | Docker in CI, image pulls, startup time — and when a slice is enough |
| 10 | `10-the-checklist.md` | Reviewing a Testcontainers test |

## Verify, do not assume
- ⚠️ Which containers `@ServiceConnection` supports out of the box in Boot 4.1.
- ⚠️ Whether reuse requires opt-in on the machine as well as in code.
- ⚠️ Testcontainers' minimum JDK and its container-runtime requirements (Podman support).
