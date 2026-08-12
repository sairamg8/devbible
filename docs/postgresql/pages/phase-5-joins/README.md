---
title: "Phase 5 — Joins and set operations"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[INNER JOIN](01-inner-join.md)** | <span className="db-tier t-master">Master</span> | mental model |
| 02 | **[LEFT JOIN](02-left-join.md)** | <span className="db-tier t-master">Master</span> | WHERE bug |
| 03 | **[Semi and anti joins](03-semi-anti.md)** | <span className="db-tier t-master">Master</span> | EXISTS NOT IN trap |
| 04 | **[Multi-table joins](04-multi-join.md)** | <span className="db-tier t-understand">Understand</span> | readability |
| 05 | **[Reading N-N relationships](05-nn-join-table.md)** | <span className="db-tier t-understand">Understand</span> | join table |
| 06 | **[RIGHT and FULL OUTER](06-outer-joins.md)** | <span className="db-tier t-understand">Understand</span> | rare but real |
| 07 | **[CROSS JOIN](07-cross-join.md)** | <span className="db-tier t-understand">Understand</span> | cartesian accidents |
| 08 | **[ON vs USING vs NATURAL](08-on-using-natural.md)** | <span className="db-tier t-understand">Understand</span> | never NATURAL |
| 09 | **[Self joins](09-self-join.md)** | <span className="db-tier t-understand">Understand</span> | hierarchies |
| 10 | **[LATERAL](10-lateral.md)** | <span className="db-tier t-understand">Understand</span> | top-N-per-group |
| 11 | **[UNION INTERSECT EXCEPT](11-set-ops.md)** | <span className="db-tier t-understand">Understand</span> | UNION ALL cost |
| 12 | **[Alias discipline](12-alias-discipline.md)** | <span className="db-tier t-understand">Understand</span> | qualify columns |
| 13 | **[Joining on expressions](13-join-expressions.md)** | <span className="db-tier t-know">Know</span> | ranges |

## Phase gate

Move on when you can explain the LEFT JOIN + WHERE bug and avoid NOT IN null traps.

---

← Syllabus: [Part 2](../../syllabus/02-sql.md) · Start → [INNER JOIN](01-inner-join.md)
