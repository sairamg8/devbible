# Topic 03 · Database-per-service — chunk plan

Tier: **Understand**. 🔴 Read `../_PHASE-NOTES.md` first — it is binding.

## Boundary
Owns **the data consequence of a boundary**: what you lose when each service keeps its own
store, and what you do instead. 🔴 **02 owns drawing the line** — do not re-argue where the
boundary goes. 🔴 **Sagas belong to phase 15 topic 10** — name the problem ("you no longer
have a transaction across two services"), show why the naive fix is wrong, and hand off.
🔴 **Phase 10 owns JPA and SQL mechanics** — link, do not re-teach.

## Chunks (a PLAN, not a budget)
| # | File | What it argues |
|---|---|---|
| 1 | `01-the-rule-and-why-it-exists.md` | Private data is what makes a service deployable alone |
| 2 | `02-what-shared-database-actually-costs.md` | The schema becomes a public API nobody versions |
| 2b | `02b-when-a-shared-database-is-still-right.md` | The honest exception: one team, one deploy, real deadlines |
| 3 | `03-the-join-you-just-lost.md` | The query that spanned two tables now spans two networks |
| 4 | `04-api-composition.md` | The gateway/aggregator does the join in memory — and its limits |
| 4b | `04b-when-composition-falls-over.md` | Pagination, sorting and filtering across services |
| 5 | `05-cqrs-read-models.md` | A denormalized view maintained from events; the read side as a cache |
| 5b | `05b-the-read-model-is-stale-and-that-is-fine.md` | Eventual consistency stated as a product decision, not a bug |
| 6 | `06-duplicated-reference-data.md` | Country codes, currencies, the product name on an order line |
| 6b | `06b-copy-versus-lookup.md` | The rule: copy what must not change under you, look up what must be current |
| 7 | `07-foreign-keys-across-services.md` | Referential integrity is now the application's job |
| 7b | `07b-orphans-and-reconciliation.md` | What actually happens when the other side deletes a row |
| 8 | `08-the-transaction-you-cannot-have.md` | Two-phase commit, why it is not the answer, and the hand-off to sagas |
| 9 | `09-one-schema-per-service-in-one-instance.md` | The pragmatic middle: separate schemas, separate credentials, one server |
| 10 | `10-migrations-per-service.md` | Flyway/Liquibase ownership; the deploy that must not touch another service's tables |
| 11 | `11-reporting-and-analytics.md` | The question nobody asks until go-live: where does the BI query run |
| 12 | `12-choosing-a-store-per-service.md` | Polyglot persistence as a real option and as a real cost |
| 13 | `13-the-checklist.md` | Reading a proposed split and asking what happens to each query |

## Verify, do not assume
- ⚠️ Quote microservices.io's `database-per-service`, `api-composition`, `cqrs` and
  `shared-database` pattern pages by name; do not paraphrase them into a different claim.
- ⚠️ Check what phase 10 already wrote before repeating any JPA/Flyway mechanics:
  `ls ../../phase-10-data-access/`. Link to it.
- ⚠️ Do not describe saga mechanics — confirm phase 15 topic 10 is where it lands and say so.
- ⚠️ Any availability or consistency claim must be reasoned, not measured. **No sandbox.**
