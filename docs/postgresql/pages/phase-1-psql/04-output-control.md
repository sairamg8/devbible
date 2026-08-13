---
title: "Output control"
sidebar_label: "04 · Output control"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex31-psql-basics.sh`.

**Two audiences, two settings. For your eyes: `\x` so a wide row is readable. For another
program: `-At` or `--csv` so nothing has to be parsed out of ASCII art. The one that
silently misleads is the default rendering of `NULL`.**

## `\x` — expanded output

```console
$ ./ex31-psql-basics.sh
=== 04b. \x expanded — one column per line ===
Expanded display is on.
-[ RECORD 1 ]--------
id          | 1
customer_id | 2
status      | paid
total_cents | 100
note        | note 1
-[ RECORD 2 ]--------
id          | 2
```

One column per line instead of one row per line. For any table wider than the terminal
this is the difference between reading the data and fighting it. `\x` toggles; `\x on` and
`\x off` are explicit.

```console
=== 04c. \x auto — expanded only when the row is too wide ===
Expanded display is used automatically.
 id | status
----+---------
  1 | paid
  2 | shipped
```

**`\x auto` is the setting to keep permanently** — normal alignment when the row fits,
expanded when it does not. Put it in [`.psqlrc`](13-psqlrc.md) and stop thinking about it.

## Machine-readable output

```console
=== 04d. -A unaligned, -t tuples-only, -F field separator ===
1,paid,100
2,shipped,200
3,open,300

=== 04e. --csv is the one to pipe into other tools ===
id,status,note
1,paid,note 1
2,shipped,note 2
3,open,note 3
```

| Flag | In-session | Effect |
|---|---|---|
| `-A` | `\a` | unaligned — no column padding |
| `-t` | `\t` | tuples only — no header, no `(N rows)` footer |
| `-F ','` | `\pset fieldsep ','` | field separator |
| `--csv` | `\pset format csv` | proper CSV, including quoting |

**`-At` is the pipe-friendly pair** and the one to memorise: no header, no padding, no row
count. For a single value it gives exactly the value and nothing else, which is what a
shell variable needs.

Prefer `--csv` over `-A -F ','` whenever the data might contain commas or quotes: `--csv`
quotes correctly, hand-rolled separators do not. More on this in
[Piping psql](15-piping.md).

## The `NULL` trap

```console
=== 04f. NULL is invisible by default — make it visible ===
 id | note
----+------
  4 |
  8 |
(2 rows)

Null display is "(null)".
 id |  note
----+--------
  4 | (null)
  8 | (null)
(2 rows)
```

**By default a `NULL` and an empty string render identically — as nothing at all.** That
is a real source of wasted debugging: you look at a blank cell and cannot tell whether the
column is empty text or was never set, which are completely different for `IS NULL`
predicates, `COALESCE`, and any [index on that column](../phase-10-indexes/09-partial.md).

```sql
\pset null '(null)'      -- or 'ø', or 'NULL'
```

Put this in `.psqlrc` on day one. It is the highest-value single line in that file.

## Other `\pset` knobs

```console
=== 04g. other \pset knobs worth knowing ===
Border style is 2.
+----+---------+
| id | status  |
+----+---------+
|  1 | paid    |
|  2 | shipped |
+----+---------+
```

```sql
\pset border 2            -- 0 none, 1 default, 2 full box
\pset format wrapped      -- wrap wide columns instead of overflowing
\pset columns 40          -- target width for wrapped
\pset pager off           -- stop paging output through less
\pset linestyle unicode   -- box-drawing characters
\pset title 'Open orders' -- a caption above the table
```

`\pset pager off` is worth knowing for the case where output "disappears" — it went to the
pager, and the pager exited. `\pset format wrapped` keeps a wide text column inside the
terminal rather than letting it run off the edge.

`\pset` with no arguments prints every current setting, which beats remembering them.

## Sending output somewhere

```sql
\o /tmp/report.txt        -- redirect subsequent output to a file
SELECT * FROM p1_orders;
\o                        -- back to the terminal

\g /tmp/one_query.txt     -- send just this query's output to a file
\g | wc -l                -- or pipe it to a command
```

`\o` is a mode; `\g file` is one-shot. Both write the rendered output, so set `--csv`
first if the destination is another program rather than a person.

## Trade-off

**Every readability setting makes the output worse for machines, and vice versa.** Aligned
output with borders is unusable in a pipeline; `-At` is unreadable in a wide table. The
resolution is not a compromise but a split: set the human defaults permanently in
`.psqlrc`, and pass the machine flags explicitly on the command line where they apply.
Scripts should never inherit interactive settings — which is exactly what
[`-X`](13-psqlrc.md) is for.

## Gotchas

**Symptom:** A column is blank and you cannot tell if it is `NULL` or `''`
**Cause:** Both render as nothing by default
**Fix:** `\pset null '(null)'`, ideally in `.psqlrc`

**Symptom:** Parsing psql output in a script gives ragged fields
**Cause:** Default aligned output pads with spaces and adds a header and row count
**Fix:** `-At`, or `--csv` if values may contain separators

**Symptom:** CSV output breaks on values containing commas
**Cause:** `-A -F ','` does not quote; it just joins with a comma
**Fix:** `--csv`, which quotes properly

**Symptom:** Query output vanished
**Cause:** It went through the pager
**Fix:** `\pset pager off`, or set `PAGER`/`PSQL_PAGER`

**Symptom:** Wide rows wrap into unreadable mush
**Cause:** Aligned format on a narrow terminal
**Fix:** `\x auto`, or `\pset format wrapped` with `\pset columns`

**Symptom:** A script's output format changed after editing `.psqlrc`
**Cause:** Scripts inherit the startup file
**Fix:** Run scripts with `-X`

## Interview questions

**★ How do you make a wide row readable?**
`\x` for expanded output, or `\x auto` to switch automatically only when the row does not
fit. `auto` is the setting to keep in `.psqlrc`.

**★ What is the pipe-friendly output mode?**
`-At` — unaligned, tuples only, so no header, padding or row-count footer. For structured
data use `--csv`, which quotes values correctly.

**★ Why set `\pset null`?**
Because `NULL` and the empty string are both rendered as blank by default, and they behave
completely differently in predicates. Measured: the same rows displayed as empty, then as
`(null)`.

**★ `--csv` or `-A -F ','`?**
`--csv`. The separator flags only join fields; they do not quote, so any value containing
a comma or quote corrupts the output.

**★ How do you send query output to a file?**
`\o file` for a mode that persists, or `\g file` for a single query. `\g | command` pipes
instead.

**Where did my output go?**
Most likely the pager. `\pset pager off` disables it.

**How do you see all current formatting settings?**
`\pset` with no arguments prints them all.

---

← [\d and \d+ in full](03-describe-table.md) · Next → [\? and \h](05-help.md)
