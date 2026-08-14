---
title: "Logging slow queries"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. **Mixed provenance, marked per chunk.** The
> parameter-logging and `ALTER ROLE` plaintext results are **sandbox-measured**
> (`sandbox/pg-api/ex51-secrets.mjs`, PostgreSQL 18.4, Node 24, `pg`); defaults
> and `auto_explain` behaviour are validated against the **PostgreSQL 18**
> documentation ([logging](https://www.postgresql.org/docs/18/runtime-config-logging.html),
> [auto_explain](https://www.postgresql.org/docs/18/auto-explain.html)), cited
> inline.

**PostgreSQL logs almost nothing useful by default, and the one setting people do
turn on is the one that leaks secrets.** Both halves of that are on these pages.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What to log](01-what-to-log.md)** | `log_min_duration_statement`, a prefix worth having, and why `log_statement = 'all'` is not the answer |
| 02 | **[Parameters and auto_explain](02-parameters-and-auto-explain.md)** | the measured finding that `$1` does **not** protect the log, and the plan-capture tool with a serious overhead warning |

## The measured finding worth carrying away

**Parameterised queries keep values out of the statement text and out of
`pg_stat_activity`. They do not keep them out of the log.** With
`log_statement = 'all'`, bound parameters are written as
`DETAIL: Parameters: $1 = '…'`, and `log_parameter_max_length` defaults to `-1`
— full length, untruncated. Database logs are credential-bearing.

## The three-legged stool

| Tool | Answers | Blind to |
|---|---|---|
| `pg_stat_activity` | what is running **now** | anything already finished |
| `pg_stat_statements` | what costs most **in aggregate** | which single execution was slow |
| **the log** | **which statements were slow, and when** | the cheap query run a million times |

You need all three. [09 · Monitoring](../09-monitoring/README.md) covers the first
two.

## Phase gate

You are done here when your database logs slow statements, lock waits and temp
file spills with a prefix that identifies the service — and when you can explain
why `log_statement = 'all'` is not a safe production setting, for two independent
reasons.

## Where this connects

- [Monitoring views](../09-monitoring/README.md) — the other two legs, and the
  `temp_bytes` trend that `log_temp_files` gives you statements for.
- [Key configuration](../10-config-keys/README.md) — every setting here is a
  reload except `logging_collector` and `shared_preload_libraries`; the context
  rules are there.
- [Secrets](../02-secrets/README.md) — the rest of the measured credential-leak
  results, including the pool object and the connection string.
- [Indexes and the planner](../../phase-10-indexes/README.md) — where an
  `auto_explain` plan gets interpreted.

---

← [Phase index](../README.md) · Start → [What to log](01-what-to-log.md)
