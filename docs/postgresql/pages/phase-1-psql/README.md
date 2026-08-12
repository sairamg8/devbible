---
title: "Phase 1 — psql, mastered"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.** Every console line executed against the sandbox.

`psql` is the verification tool for the rest of the syllabus. Master the shell before racing ahead to SQL text.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Connecting with psql](01-connecting.md)** | <span className="db-tier t-master">Master</span> | -h/-p/-U/-d, URIs, into a container |
| 02 | **[Daily meta-commands](02-daily-meta-commands.md)** | <span className="db-tier t-master">Master</span> | \l \c \dt \dn \df \di \dv \ds |
| 03 | **[\d and \d+ in full](03-describe-table.md)** | <span className="db-tier t-master">Master</span> | Columns, indexes, constraints, FKs |
| 04 | **[Output control](04-output-control.md)** | <span className="db-tier t-master">Master</span> | \x, \pset, csv, unaligned |
| 05 | **[\? and \h](05-help.md)** | <span className="db-tier t-master">Master</span> | Built-in reference |
| 06 | **[Scripting psql](06-scripting.md)** | <span className="db-tier t-understand">Understand</span> | -c -f ON_ERROR_STOP exit codes |
| 07 | **[Query buffer and editor](07-query-buffer.md)** | <span className="db-tier t-understand">Understand</span> | \e \p \g semicolon |
| 08 | **[psql variables](08-variables.md)** | <span className="db-tier t-understand">Understand</span> | :var interpolation traps |
| 09 | **[\copy vs COPY](09-copy.md)** | <span className="db-tier t-understand">Understand</span> | Client vs server file access |
| 10 | **[\timing and \watch](10-timing-watch.md)** | <span className="db-tier t-understand">Understand</span> | Honest shell measurement |
| 11 | **[\i and \ir](11-include-files.md)** | <span className="db-tier t-understand">Understand</span> | SQL files and seed scripts |
| 12 | **[\conninfo \du \dp](12-who-and-privileges.md)** | <span className="db-tier t-understand">Understand</span> | Who am I, what can I touch |
| 13 | **[.psqlrc and prompt](13-psqlrc.md)** | <span className="db-tier t-know">Know</span> | Config, HISTFILE, autocomplete |
| 14 | **[\errverbose and SQLSTATE](14-errverbose.md)** | <span className="db-tier t-know">Know</span> | Full errors for Node matching |
| 15 | **[Piping psql](15-piping.md)** | <span className="db-tier t-when">When Needed</span> | Reports and pipelines |

## Phase gate

Move on when you can connect without guessing, describe a table with `\d`, script SQL with `ON_ERROR_STOP=1`, and map a SQLSTATE from Node.

---

← Syllabus: [Part 1](../../syllabus/01-foundations.md) · Start → [Connecting with psql](01-connecting.md)
