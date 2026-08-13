---
title: "The query buffer and the editor"
sidebar_label: "07 · Query buffer"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**psql accumulates what you type into a buffer and sends it only when something tells it
to. Understanding that one mechanism explains the classic "I pressed enter and nothing
happened", and unlocks `\e`, `\g`, `\gx` and `\gset`.**

## Nothing is sent until you terminate the statement

```console
$ ./ex31-psql-basics.sh
=== 07d. a missing semicolon is why 'nothing happened' ===
nothing ran - psql is still collecting input
SELECT 'no semicolon so this just sits in the buffer' AS msg
                     msg
----------------------------------------------
 no semicolon so this just sits in the buffer
(1 row)
```

The `\echo` ran immediately — **meta-commands execute as soon as they are typed** — while
the `SELECT` sat in the buffer. `\p` then printed the pending text, and the statement only
ran at end of input.

Interactively you can see this in the prompt itself:

```
devbible=#     ready for a new statement
devbible-#     mid-statement, buffer has content
devbible'#     inside an unterminated single-quoted string
devbible(#     inside unbalanced parentheses
```

**When psql seems unresponsive, read the prompt.** `'#` means a quote was never closed and
everything you type is going into a string; `(#` means a missing `)`. Ctrl-C clears the
buffer and returns to `=#`.

## `\g` and its variants

```console
=== 07a. \g re-runs the buffer; \gx runs it expanded ===
 id | status
----+---------
  1 | paid
  2 | shipped
(2 rows)

-[ RECORD 1 ]---
id     | 1
status | paid
-[ RECORD 2 ]---
id     | 2
status | shipped
```

The buffer was sent twice — once by `\g`, once by `\gx` — from a single typed statement.

| Command | Does |
|---|---|
| `;` | send the buffer |
| `\g` | send the buffer (identical to `;`) |
| `\g file` | send it, write the output to a file |
| `\g \| cmd` | send it, pipe the output to a command |
| `\gx` | send it, forcing [expanded output](04-output-control.md) for this result only |
| `\gexec` | run the buffer, then execute each returned value as SQL |
| `\gdesc` | describe the result's columns **without running** the query |
| `\gset` | run it and store the single result row into variables |

**`\gx` is the daily one**: run a query normally, discover the row is too wide, press
`\gx` to see it expanded — no retyping. **`\gdesc` is the underused one**: it tells you the
result column types without executing, which is how you check what a complicated
expression actually returns.

## `\gset` — a query result into a variable

```console
=== 07b. \gset captures a single row into variables ===
orders = 12 biggest = 1200
```

```sql
SELECT count(*) AS n_orders, max(total_cents) AS biggest FROM p1_orders
\gset
\echo 'orders =' :n_orders 'biggest =' :biggest
```

Each output column becomes a psql variable named after it. The query must return **exactly
one row** — zero rows leaves the variables unset, more than one is an error. A prefix
avoids collisions: `\gset stats_` produces `:stats_n_orders`.

This is what makes psql scripts able to branch on data, together with `\if`:

```sql
SELECT count(*) = 0 AS is_empty FROM p1_orders
\gset
\if :is_empty
  \echo 'seeding...'
  \i seed.sql
\else
  \echo 'already seeded'
\endif
```

## Editing the buffer

```sql
\p            -- print the current buffer
\r            -- reset (clear) it
\w file       -- write the buffer to a file
\e            -- open the buffer in $EDITOR; on save, it becomes the buffer
\e file       -- edit a file, then load it into the buffer
\ef funcname  -- edit an existing function's definition
\ev viewname  -- edit an existing view's definition
```

```console
=== 07c. \p prints the buffer, \r resets it ===
SELECT 1,
       2
Query buffer reset (cleared).
Query buffer is empty.
```

**`\e` is the feature that makes psql usable for anything longer than one line.** It opens
`$EDITOR` (set it — the default is often `vi`), and on exit the edited text becomes the
buffer. A caveat worth knowing: if the edited text ends with a semicolon it is executed
immediately on save, so leave the semicolon off while iterating.

`\ef` and `\ev` are the same idea applied to existing objects — psql fetches the current
definition, opens it in the editor, and the result becomes the buffer as a `CREATE OR
REPLACE`. That is by far the fastest way to change a view.

## History

Interactively, up-arrow walks history, and Ctrl-R searches it backwards. `\s` prints the
history; `\s file` writes it out. History persists across sessions in `~/.psql_history` —
see [.psqlrc](13-psqlrc.md) for sizing and per-database history files.

## Trade-off

**The buffer makes psql forgiving for long statements and confusing for beginners.**
Nothing is sent until you say so, which means typos are cheap to fix and a missing
semicolon looks like a hang. The alternative — sending each line as typed — would make
multi-line SQL impossible. Learn the prompt suffixes (`-#`, `'#`, `(#`) and the confusion
disappears; that is the entire cost.

## Gotchas

**Symptom:** Pressed enter and nothing happened
**Cause:** No semicolon — the statement is still in the buffer
**Fix:** `;` or `\g`; check the prompt suffix to see what psql is waiting for

**Symptom:** Everything you type is being swallowed, prompt shows `'#`
**Cause:** An unterminated string literal
**Fix:** Ctrl-C to discard the buffer, then retype

**Symptom:** `\gset` did not set anything
**Cause:** The query returned zero rows, or more than one
**Fix:** Ensure exactly one row; aggregate or add `LIMIT 1`

**Symptom:** `\e` executed the query on save when you only wanted to edit
**Cause:** The edited text ended in a semicolon
**Fix:** Leave the semicolon off until you actually want to run it

**Symptom:** `\e` fails or opens something unusable
**Cause:** `$EDITOR` is unset or wrong
**Fix:** `export EDITOR=nano` (or your editor) — `\setenv EDITOR nano` inside psql

**Symptom:** Variable names from `\gset` collide with existing ones
**Cause:** Column names became variable names directly
**Fix:** Use a prefix: `\gset myprefix_`

## Interview questions

**★ Why does nothing happen when you press enter?**
psql buffers input until the statement is terminated. Without a semicolon or `\g` it just
keeps collecting — measured, the `SELECT` sat unexecuted while a `\echo` on the next line
ran immediately.

**★ What is the difference between `;` and `\g`?**
None for a plain send. `\g` additionally accepts a file or a pipe (`\g out.txt`,
`\g | wc -l`), and `\gx` forces expanded output for that one result.

**★ What does `\gset` do?**
Runs the buffer and stores each column of the single result row into a psql variable named
after it. Requires exactly one row. Measured: `orders = 12 biggest = 1200`.

**★ How do you edit a long query without retyping?**
`\e` opens the buffer in `$EDITOR` and the saved text replaces it. `\ef` and `\ev` do the
same for an existing function or view definition.

**★ What do the prompt suffixes mean?**
`=#` ready, `-#` mid-statement, `'#` inside an unterminated string, `(#` inside unbalanced
parentheses. They tell you exactly why psql appears stuck.

**How do you check what a query returns without running it?**
`\gdesc` — it reports the result columns and types without execution.

**What is `\gexec` for?**
Executing the SQL that a query generates — for example running a `format()`-built
`COMMENT ON` or `ALTER TABLE` across many tables at once.

---

← [Scripting psql](06-scripting.md) · Next → [psql variables](08-variables.md)
