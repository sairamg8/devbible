---
title: "Phase 6 — Aggregation, windows and CTEs"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[GROUP BY and aggregates](01-group-by.md)** | <span className="db-tier t-master">Master</span> | count sum avg |
| 02 | **[count variants](02-count-variants.md)** | <span className="db-tier t-master">Master</span> | three different questions |
| 03 | **[HAVING vs WHERE](03-having.md)** | <span className="db-tier t-master">Master</span> | filter groups |
| 04 | **[FILTER WHERE aggregates](04-filter-clause.md)** | <span className="db-tier t-understand">Understand</span> | conditional aggregates |
| 05 | **[jsonb_agg and friends](05-json-agg.md)** | <span className="db-tier t-understand">Understand</span> | shape API in SQL |
| 06 | **[Window functions intro](06-windows-intro.md)** | <span className="db-tier t-understand">Understand</span> | OVER vs GROUP BY |
| 07 | **[Ranking functions](07-ranking.md)** | <span className="db-tier t-understand">Understand</span> | row_number rank |
| 08 | **[lag lead first_value](08-lag-lead.md)** | <span className="db-tier t-understand">Understand</span> | neighbor rows |
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

← Syllabus: [Part 2](../../syllabus/02-sql.md) · Start → [GROUP BY and aggregates](01-group-by.md)
