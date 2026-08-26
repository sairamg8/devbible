# Topic 11 · Migrations with Flyway — chunk plan

Tier: **Understand**. Target: Flyway 12.4.0, Spring Boot 4.1.0, PostgreSQL 18, JDK 25.

## Boundary

- **11 owns** — versioned schema change: the migration file, the history table, ordering,
  checksums, repeatable migrations, baselining an existing database, and running
  migrations safely against a live service.
- **06 owns `ddl-auto`** and already argues `update` is never production. 11 picks the
  argument up at "so what do you do instead" and links back.
- Liquibase is named and contrasted, not taught.

## Chunks (a PLAN, not a budget — split at 301 lines, rule 1)

| # | File | What it argues |
|---|---|---|
| 1 | `01-why-schema-is-code.md` | The diff nobody reviewed is the outage nobody predicted |
| 2 | `02-the-migration-file.md` | `V1__…sql` — the naming grammar, in full |
| 2b | `02b-where-they-live.md` | `classpath:db/migration`, vendor-specific locations, Boot's defaults |
| 3 | `03-the-history-table.md` | `flyway_schema_history` — every column and what it is for |
| 4 | `04-checksums-and-immutability.md` | Editing an applied migration is the cardinal sin; `repair` and when it is legitimate |
| 5 | `05-repeatable-migrations.md` | `R__…` for views, functions, seed data |
| 6 | `06-baselining.md` | Adopting Flyway on a database that already exists |
| 7 | `07-boot-integration.md` | What Boot auto-configures, the properties that matter, and running before JPA validates |
| 7b | `07b-validate-not-update.md` | `ddl-auto: validate` as the safety net that catches drift |
| 8 | `08-migrating-a-live-service.md` | Expand/contract — why a rename is three deploys |
| 8b | `08b-locks-and-long-migrations.md` | `ACCESS EXCLUSIVE`, `lock_timeout`, the `ALTER TABLE` that took the site down |
| 9 | `09-many-instances-one-database.md` | Flyway's lock, and what happens when ten pods start at once |
| 10 | `10-data-migrations.md` | When the change is rows, not columns |
| 11 | `11-testing-migrations.md` | The test that runs them from empty — hand off to Phase 11 |
| 12 | `12-the-checklist.md` | Reviewing a migration in a pull request |

## Traps to verify, not assume

- ⚠️ **Flyway's edition split** (Community vs Teams) moved features between editions; verify
  what 12.x Community actually includes before claiming a feature.
- ⚠️ PostgreSQL DDL is transactional — Flyway wraps each migration in a transaction where
  the database allows it. Verify the exceptions (`CREATE INDEX CONCURRENTLY`).
- ⚠️ Boot property names live under `spring.flyway.*`; quote the reference.
