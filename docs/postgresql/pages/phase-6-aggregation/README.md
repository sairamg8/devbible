---
title: "Phase 6 — Aggregation, windows and CTEs"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[GROUP BY and aggregates](group-by/)** | <span className="db-tier t-master">Master</span> | one row per group, and what `NULL` does to it |
| 02 | **[count variants](count-variants/)** | <span className="db-tier t-master">Master</span> | three different questions, and what each costs |
| 03 | **[HAVING vs WHERE](having/)** | <span className="db-tier t-master">Master</span> | filter groups, not rows |
| 04 | **[FILTER (WHERE ...)](filter-clause/)** | <span className="db-tier t-understand">Understand</span> | several aggregations, one scan |
| 05 | **[string_agg, array_agg, jsonb_agg](json-agg/)** | <span className="db-tier t-understand">Understand</span> | shape an API payload in SQL |
| 06 | **[Window functions](windows-intro/)** | <span className="db-tier t-understand">Understand</span> | aggregates that keep the rows |
| 07 | **[Ranking functions](ranking/)** | <span className="db-tier t-understand">Understand</span> | ties, and top-N per group |
| 08 | **[lag, lead, first/last_value](lag-lead/)** | <span className="db-tier t-understand">Understand</span> | reaching into neighbouring rows |
| 09 | **[CTEs (WITH)](ctes/)** | <span className="db-tier t-understand">Understand</span> | a name for a subquery — and when it is a fence |
| 10 | **[Data-modifying CTEs](modifying-ctes/)** | <span className="db-tier t-understand">Understand</span> | several writes in one atomic statement, and the write one of them loses |
| 11 | **[Subqueries](subqueries/)** | <span className="db-tier t-understand">Understand</span> | scalar, correlated, and the `NOT IN` that returns nothing |
| 12 | **[Counting for pagination](pagination-counts/)** | <span className="db-tier t-understand">Understand</span> | the page costs 2 ms and the total costs 49 |
| 13 | **[Ordered-set aggregates](ordered-set/)** | <span className="db-tier t-know">Know</span> | percentiles, and what `mode()` hides |
| 14 | **[Window frames](frames/)** | <span className="db-tier t-know">Know</span> | `ROWS` vs `RANGE`, and the default that merges peers |
| 15 | **[Recursive CTEs](recursive-cte/)** | <span className="db-tier t-know">Know</span> | trees, graphs, and the cycle that never terminates |
| 16 | **[GROUPING SETS ROLLUP CUBE](grouping-sets/)** | <span className="db-tier t-when">When Needed</span> | subtotals in one pass — which is not always faster |

## Phase gate

Move on when you can `GROUP BY` correctly, write a window function with a deliberate frame,
say whether a CTE is inlined or fenced, and explain why `NOT IN` over a nullable subquery
returns nothing.

---

← Syllabus: [Part 2](../../syllabus/02-sql.md) · Start → [GROUP BY and aggregates](group-by/)
