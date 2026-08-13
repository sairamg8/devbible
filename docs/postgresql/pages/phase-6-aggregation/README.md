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
| 09 | **[CTEs WITH](09-ctes.md)** | <span className="db-tier t-understand">Understand</span> | readability MATERIALIZED |
| 10 | **[Data-modifying CTEs](10-modifying-ctes.md)** | <span className="db-tier t-understand">Understand</span> | DELETE RETURNING chain |
| 11 | **[Subqueries](11-subqueries.md)** | <span className="db-tier t-understand">Understand</span> | correlated cost |
| 12 | **[Counting for pagination](12-pagination-counts.md)** | <span className="db-tier t-understand">Understand</span> | limit plus one |
| 13 | **[Ordered-set aggregates](13-ordered-set.md)** | <span className="db-tier t-know">Know</span> | percentile_cont |
| 14 | **[Window frames](14-frames.md)** | <span className="db-tier t-know">Know</span> | ROWS BETWEEN |
| 15 | **[Recursive CTEs](15-recursive-cte.md)** | <span className="db-tier t-know">Know</span> | trees graphs |
| 16 | **[GROUPING SETS ROLLUP CUBE](16-grouping-sets.md)** | <span className="db-tier t-when">When Needed</span> | multi aggregates |

## Phase gate

Move on when you can GROUP BY correctly and write a basic window.

---

← Syllabus: [Part 2](../../syllabus/02-sql.md) · Start → [GROUP BY and aggregates](group-by/)
