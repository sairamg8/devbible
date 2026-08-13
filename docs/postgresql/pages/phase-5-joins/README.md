---
title: "Phase 5 — Joins and set operations"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[INNER JOIN](inner-join/)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | one row per pair; fan-out and the wrong `sum()` |
| 02 | **[LEFT JOIN](left-join/)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | manufactured NULLs; the `ON` vs `WHERE` bug |
| 03 | **[Semi and anti joins](semi-anti/)** *(2 chunks)* | <span className="db-tier t-master">Master</span> | `EXISTS` beats `JOIN`+`DISTINCT`; the `NOT IN` trap |
| 04 | **[Multi-table joins](04-multi-join.md)** | <span className="db-tier t-understand">Understand</span> | chains, reordering, compounding fan-out |
| 05 | **[Reading N-N relationships](05-nn-join-table.md)** | <span className="db-tier t-understand">Understand</span> | junction tables and `array_agg` |
| 06 | **[RIGHT and FULL OUTER](06-outer-joins.md)** | <span className="db-tier t-understand">Understand</span> | reconciliation, both-sides gaps |
| 07 | **[CROSS JOIN](07-cross-join.md)** | <span className="db-tier t-understand">Understand</span> | calendar spines, cartesian accidents |
| 08 | **[ON vs USING vs NATURAL](08-on-using-natural.md)** | <span className="db-tier t-understand">Understand</span> | never `NATURAL` |
| 09 | **[Self joins](09-self-join.md)** | <span className="db-tier t-understand">Understand</span> | hierarchies and `WITH RECURSIVE` |
| 10 | **[LATERAL](10-lateral.md)** | <span className="db-tier t-understand">Understand</span> | top-N-per-group, measured 5.6× |
| 11 | **[UNION INTERSECT EXCEPT](11-set-ops.md)** | <span className="db-tier t-understand">Understand</span> | `UNION ALL` costs 3.5× less |
| 12 | **[Alias discipline](12-alias-discipline.md)** | <span className="db-tier t-understand">Understand</span> | qualify every column |
| 13 | **[Joining on expressions](13-join-expressions.md)** | <span className="db-tier t-know">Know</span> | ranges and expression indexes |

## Phase gate

Move on when you can explain the LEFT JOIN + WHERE bug from the evaluation order rather
than from memory, avoid the `NOT IN` NULL trap by reflex, and predict whether a query with
a join and a `sum()` is double-counting before you run it.

---

← Syllabus: [Part 2](../../syllabus/02-sql.md) · Start → [INNER JOIN](inner-join/)
