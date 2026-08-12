---
title: "Part 2 — SQL"
sidebar_label: "2 · SQL"
sidebar_position: 2
---

> **Phases 4–6 · 49 topics · 14 Master**
> The query language itself: reading and writing rows, combining tables, and
> summarising them.

This is the part that makes Part 3 possible. Every row here is shown twice —
as SQL you can paste into `psql`, and as the `pg` call that issues it with
`$1` placeholders.

---

## Phase 4 — CRUD and DML

📖 **Explanation written:** [Phase 4 — CRUD](../pages/phase-4-crud/)


*20 topics.* The user asked for CRUD, table creation and data insertion by name.
Table creation is Phase 3; **this phase is the other two**, and it is the single
most-used phase in the syllabus. `RETURNING` and `ON CONFLICT` are PostgreSQL's
two best answers to problems people normally solve with extra round trips.

| Topic | Tier |
|---|---|
| **The `SELECT` shape** — select list, `FROM`, `WHERE`, `ORDER BY`, `LIMIT` | <span className="db-tier t-master">Master</span> |
| **`WHERE` predicates** — comparison, `BETWEEN`, `IN`, `LIKE`/`ILIKE`, `~` regex, `IS DISTINCT FROM` | <span className="db-tier t-master">Master</span> |
| **`LIMIT`/`OFFSET`** — and why OFFSET pagination degrades as the offset grows | <span className="db-tier t-master">Master</span> |
| **`INSERT`** — single row, multi-row `VALUES`, and `INSERT ... SELECT` | <span className="db-tier t-master">Master</span> |
| **`RETURNING`** — getting the generated id back without a second query | <span className="db-tier t-master">Master</span> |
| **`INSERT ... ON CONFLICT`** — `DO NOTHING`, `DO UPDATE`, `EXCLUDED`, and choosing the conflict target | <span className="db-tier t-master">Master</span> |
| **`UPDATE`** — `SET`, `WHERE`, `FROM` for join-updates, `RETURNING` | <span className="db-tier t-master">Master</span> |
| **Parameterized queries — why you never string-build values** — safety rationale; driver `$1` mechanics in [Phase 7](../pages/phase-7-pg-driver/) | <span className="db-tier t-master">Master</span> |
| **The logical query processing order** — `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT`, and why a select alias fails in `WHERE` | <span className="db-tier t-understand">Understand</span> |
| `ORDER BY` — multiple keys, `NULLS FIRST`/`LAST`, ordering by expression | <span className="db-tier t-understand">Understand</span> |
| **`DELETE`** — `USING`, `RETURNING`, and soft delete as a deliberate design choice | <span className="db-tier t-understand">Understand</span> |
| `DISTINCT` and **`DISTINCT ON`** — the PostgreSQL-specific one worth knowing | <span className="db-tier t-understand">Understand</span> |
| **`MERGE`** — the SQL-standard upsert, and when it beats `ON CONFLICT` | <span className="db-tier t-understand">Understand</span> |
| `TRUNCATE` vs `DELETE` — speed, sequence restart, FK behaviour, and transactionality | <span className="db-tier t-understand">Understand</span> |
| Expressions and operators — arithmetic, `||`, `CASE`, `COALESCE`, `GREATEST`/`LEAST` | <span className="db-tier t-understand">Understand</span> |
| String functions — `lower`, `trim`, `substring`, `split_part`, `format`, `concat_ws` | <span className="db-tier t-understand">Understand</span> |
| Date/time functions — `now()`, `date_trunc`, `age`, `extract`, `to_char`, and `now()` inside a transaction | <span className="db-tier t-understand">Understand</span> |
| Numeric functions, `random()`, and **`generate_series` for building test data** | <span className="db-tier t-understand">Understand</span> |
| **`VALUES` as a standalone relation, and `unnest` for bulk parameter arrays** — the bridge to Phase 8's bulk insert | <span className="db-tier t-understand">Understand</span> |
| Row constructors and tuple comparison — `(created_at, id) < ($1, $2)`, the keyset pagination primitive | <span className="db-tier t-understand">Understand</span> |

---

## Phase 5 — Joins and set operations

📖 **Explanation written:** [Phase 5 — Joins](../pages/phase-5-joins/)


*13 topics.* Small phase, huge payoff. The `LEFT JOIN` + `WHERE` bug and the
`NOT IN` NULL trap are the two SQL mistakes most likely to ship silently.

| Topic | Tier |
|---|---|
| **`INNER JOIN`** — the mental model, and what a join actually produces | <span className="db-tier t-master">Master</span> |
| **`LEFT JOIN`** — and the classic bug: filtering the right-hand table in `WHERE` turns it back into an inner join | <span className="db-tier t-master">Master</span> |
| **Semi and anti joins** — `EXISTS`, `NOT EXISTS`, `IN`, `NOT IN`, and the `NOT IN` NULL trap | <span className="db-tier t-master">Master</span> |
| Multi-table joins, join order, and formatting a long query so it stays readable | <span className="db-tier t-understand">Understand</span> |
| **Reading an N-N relationship through its join table** | <span className="db-tier t-understand">Understand</span> |
| `RIGHT` and `FULL OUTER JOIN` | <span className="db-tier t-understand">Understand</span> |
| `CROSS JOIN` and accidental cartesian products | <span className="db-tier t-understand">Understand</span> |
| `ON` vs `USING` vs `NATURAL JOIN` — and why never the third | <span className="db-tier t-understand">Understand</span> |
| **Self joins** — hierarchies, and comparing rows within one table | <span className="db-tier t-understand">Understand</span> |
| **`LATERAL`** — a subquery that sees the current row, and top-N-per-group | <span className="db-tier t-understand">Understand</span> |
| `UNION` vs `UNION ALL`, `INTERSECT`, `EXCEPT` — and the cost of the implicit dedup | <span className="db-tier t-understand">Understand</span> |
| Alias discipline, and qualifying every column in a multi-table query | <span className="db-tier t-understand">Understand</span> |
| Joining on expressions and on ranges | <span className="db-tier t-know">Know</span> |

---

## Phase 6 — Aggregation, windows and CTEs

📖 **Explanation written:** [Phase 6 — Aggregation](../pages/phase-6-aggregation/)


*16 topics.* Where SQL stops being a fancy key-value fetch. `jsonb_agg` deserves
special attention: it is how one query returns a fully-shaped API response
instead of Node stitching three result sets together.

| Topic | Tier |
|---|---|
| **`GROUP BY` and the aggregate functions** — `count`, `sum`, `avg`, `min`, `max` | <span className="db-tier t-master">Master</span> |
| **`count(*)` vs `count(col)` vs `count(DISTINCT col)`** — three different questions | <span className="db-tier t-master">Master</span> |
| **`HAVING` vs `WHERE`** — filtering groups vs filtering rows | <span className="db-tier t-master">Master</span> |
| `FILTER (WHERE ...)` — conditional aggregation without a `CASE` pile | <span className="db-tier t-understand">Understand</span> |
| **`string_agg`, `array_agg`, `jsonb_agg`, `jsonb_object_agg`** — shaping an API payload in SQL | <span className="db-tier t-understand">Understand</span> |
| **Window functions** — `OVER`, `PARTITION BY`, `ORDER BY`, and how they differ from `GROUP BY` | <span className="db-tier t-understand">Understand</span> |
| `row_number`, `rank`, `dense_rank`, `ntile` | <span className="db-tier t-understand">Understand</span> |
| `lag`, `lead`, `first_value`, `last_value` | <span className="db-tier t-understand">Understand</span> |
| **CTEs (`WITH`)** — readability, and that PostgreSQL 12+ inlines them unless you say `MATERIALIZED` | <span className="db-tier t-understand">Understand</span> |
| **Data-modifying CTEs** — `WITH moved AS (DELETE ... RETURNING) INSERT ...` | <span className="db-tier t-understand">Understand</span> |
| Scalar, row and correlated subqueries — and when a correlated subquery is an N+1 inside one statement | <span className="db-tier t-understand">Understand</span> |
| **Counting for pagination** — exact `count(*)` vs planner estimate vs fetching `limit + 1` for "has more" | <span className="db-tier t-understand">Understand</span> |
| `bool_and`/`bool_or`, `percentile_cont`, and ordered-set aggregates | <span className="db-tier t-know">Know</span> |
| Frame clauses — `ROWS`/`RANGE BETWEEN`, and running totals | <span className="db-tier t-know">Know</span> |
| **Recursive CTEs** — trees, graphs, and guarding against cycles | <span className="db-tier t-know">Know</span> |
| `GROUPING SETS`, `ROLLUP`, `CUBE` | <span className="db-tier t-when">When Needed</span> |

---

## Where this connects

- **Phase 4 → Phase 9** — every CRUD pattern in the Node part is one of these
  statements with a repository function wrapped around it.
- **Phase 4's tuple comparison → Phase 9's keyset pagination.**
- **Phase 6's `jsonb_agg` → Phase 12's JSON section**, and the "shape it in SQL
  or in JS?" decision in Phase 9.
- **Phase 5 → Phase 10** — join performance only makes sense once you can read a
  plan.
- **Deliberately not here:** query *tuning*. These phases teach correct SQL;
  Phase 10 teaches fast SQL.

---

← [Part 1 — Foundations](./01-foundations.md) · Next: [Part 3 — Node + raw `pg`](./03-node-and-pg.md) →
