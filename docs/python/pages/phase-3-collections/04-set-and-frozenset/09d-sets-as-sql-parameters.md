---
title: "A set cannot be bound to a query as it is — it is not a sequence, `executemany` binds each element as a whole parameter list so a string ID becomes one parameter per character, an `IN` list has a placeholder ceiling and an empty one is a syntax error almost everywhere but SQLite; sort it, tuple it, batch it, and apply the plan in one transaction"
sidebar_label: "9d · Sets as SQL parameters"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html) (placeholders, `executemany`,
> `getlimit`, the connection context manager) and
> [`itertools.batched`](https://docs.python.org/3.14/library/itertools.html#itertools.batched);
> CPython v3.14.7 [`Modules/_sqlite/cursor.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_sqlite/cursor.c)
> (`bind_parameters` and the `executemany` loop, for the two error strings and the order of
> execution); SQLite's [Limits](https://www.sqlite.org/limits.html),
> [SQL expressions — IN and NOT IN](https://www.sqlite.org/lang_expr.html#the_in_and_not_in_operators)
> and [JSON functions](https://www.sqlite.org/json1.html). Documentation-verified — **no sandbox
> run, no program output**.

**The plan from [9](09-diffing-id-sets.md) is a handful of sets of keys, and applying it means
handing those sets to a database driver — which speaks in sequences. `sqlite3`'s qmark style wants a
sequence exactly as long as the placeholders; a set has no positions and is refused. `executemany`
takes any iterable, which lets a set through and then binds each element as a whole parameter
sequence — fine for a one-tuple, broken for an `int`, and quietly broken for a `str`, which is a
sequence of characters. An `IN` list needs one placeholder per element and has a ceiling on how many
there may be. The fix is the same shape every time: sort the set, turn it into tuples, batch it, and
run the whole plan inside one transaction.**

## A set is not a parameter list

The `sqlite3` rules, verbatim:

> *"For the qmark style, parameters must be a sequence whose length must match the number of
> placeholders, or a `ProgrammingError` is raised."* —
> [How to use placeholders](https://docs.python.org/3.14/library/sqlite3.html#sqlite3-placeholders)

A set is not a sequence — it has no positions ([1b](01b-what-the-table-costs-you.md)) — so
`con.execute(sql, ids)` with a set fails; the 3.14.7 source raises `ProgrammingError` with the
message `parameters are of unsupported type` (`bind_parameters` in `Modules/_sqlite/cursor.c`).

`executemany` is the subtler trap. Its *parameters* is *"An iterable of parameters to bind with the
placeholders in sql"* — a set is a fine iterable, and each **element** is bound as one statement's
parameters. An `int` element is not a sequence, and fails as above. A `str` element **is** a
sequence — of characters — so `"SKU-1"` is five parameters for a statement with one placeholder, and
the source's message is `Incorrect number of bindings supplied. The current statement uses 1, and
there are 5 supplied.` A one-character ID binds correctly, so a test fixture with IDs `"a"`, `"b"`,
`"c"` passes. Wrap each element in a one-tuple, and sort so the statements run in the same order on
every retry:

```python
import sqlite3


def delete_one_by_one(con: sqlite3.Connection, ids: set[str]) -> None:
    with con:                                                  # all or nothing
        con.executemany(
            "DELETE FROM products WHERE external_id = ?",
            [(external_id,) for external_id in sorted(ids)],
        )
```

The 3.14.7 source also shows that `executemany` binds and executes each item in turn, so items before
a bad one have already run when it raises. The `with con:` block is what makes that harmless:

> *"If the body of the `with` statement finishes without exceptions, the transaction is committed. If
> this commit fails, or if the body of the `with` statement raises an uncaught exception, the
> transaction is rolled back."* —
> [`sqlite3`, how to use the connection context manager](https://docs.python.org/3.14/library/sqlite3.html#sqlite3-connection-context-manager)

## `IN` lists: one placeholder per element, under the ceiling

One statement per batch is the other shape. Build one `?` per element, never format the values into
the SQL — *"Always use placeholders instead of string formatting to bind Python values to SQL
statements, to avoid SQL injection attacks"* — and cap the batch:

> *"… the maximum value of a host parameter number is SQLITE_MAX_VARIABLE_NUMBER, which defaults to
> 999 for SQLite versions prior to 3.32.0 (2020-05-22) or 32766 for SQLite versions after
> 3.32.0."* — [SQLite, Limits](https://www.sqlite.org/limits.html)

```python
import sqlite3
from itertools import batched


def delete_external_ids(con: sqlite3.Connection, ids: set[int], batch_size: int = 500) -> int:
    if not ids:
        return 0                                               # never emit "IN ()"
    batch_size = min(batch_size, con.getlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER))
    deleted = 0
    with con:
        for batch in batched(sorted(ids), batch_size):         # tuples: valid parameter sequences
            placeholders = ", ".join("?" * len(batch))
            cur = con.execute(f"DELETE FROM products WHERE external_id IN ({placeholders})", batch)
            deleted += cur.rowcount
    return deleted
```

`batched` (3.12+) yields tuples — *"Batch data from the iterable into tuples of length n. The last
batch may be shorter than n."* — which is exactly the sequence type the placeholders need.
`getlimit` (3.11+) reads the connection's actual ceiling instead of assuming the default; other
engines and drivers have their own limits, and I have not verified theirs. The `if not ids` guard
matters beyond SQLite:

> *"Note that SQLite allows the parenthesized list of scalar values on the right-hand side of an IN or
> NOT IN operator to be an empty list but most other SQL database engines and the SQL92 standard
> require the list to contain at least one element."* —
> [SQLite, the IN and NOT IN operators](https://www.sqlite.org/lang_expr.html#the_in_and_not_in_operators)

The f-string formats only `?` characters into the statement — the values still travel as
parameters. Its side effect is a different SQL text per batch length; sorted input and a fixed batch
size keep that to two distinct statements (full batches and the last one).

### One parameter instead of many: a JSON array

SQLite can also take the whole set as **one** parameter — a JSON array — and expand it server-side.
*"The JSON functions and operators are built into SQLite by default, as of SQLite version 3.38.0
(2022-02-22)."* `json_each` is a table-valued function — *"The json_each(X) and jsonb_each(X)
functions walk only the immediate children of the top-level array or object, or just the top-level
element itself if the top-level element is a primitive value"* — so an array of IDs becomes one row
per ID:

```python
import json
import sqlite3


def delete_via_json(con: sqlite3.Connection, ids: set[int]) -> int:
    with con:
        cur = con.execute(
            "DELETE FROM products WHERE external_id IN (SELECT value FROM json_each(?))",
            (json.dumps(sorted(ids)),),
        )
    return cur.rowcount
```

There is no placeholder ceiling to respect and no batching, and an empty set becomes `"[]"`, which
matches nothing. The cost is portability — this is SQLite syntax, and a build compiled with
`-DSQLITE_OMIT_JSON` does not have it. Other engines have their own array-parameter forms; check
your driver's documentation rather than assuming one.

## Apply the whole plan in one transaction

A plan is creates, updates and deletes that only make sense together. Committed statement by
statement, a crash half-way leaves rows deleted and their replacements never created — and a retry
computes a new plan against that half-applied state:

```python
def apply_plan(con: sqlite3.Connection, plan: "SyncPlan", incoming: dict[int, tuple[str, int]]) -> None:
    with con:
        delete_external_ids(con, set(plan.to_delete))   # 🔴 its own `with con:` commits here
        con.executemany(
            "INSERT INTO products (external_id, name, price_cents) VALUES (?, ?, ?)",
            [(k, *incoming[k]) for k in plan.to_create],
        )
        con.executemany(
            "UPDATE products SET name = ?, price_cents = ? WHERE external_id = ?",
            [(*incoming[k], k) for k in plan.to_update],
        )
```

⚠️ The `sqlite3` context manager is not a savepoint: *"The context manager neither implicitly opens a
new transaction nor closes the connection."* The inner `with con:` inside `delete_external_ids`
therefore **commits** at its own exit — so the deletes are durable before the inserts start. For a
real all-or-nothing plan, give the helpers a flag or split them into a "build statements" and an
"execute" half, and keep exactly one `with con:` at the top:

```python
def delete_external_ids_in_tx(con: sqlite3.Connection, ids: set[int], batch_size: int = 500) -> int:
    """Same as delete_external_ids, but never commits: the caller owns the transaction."""
    if not ids:
        return 0
    batch_size = min(batch_size, con.getlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER))
    deleted = 0
    for batch in batched(sorted(ids), batch_size):
        placeholders = ", ".join("?" * len(batch))
        deleted += con.execute(f"DELETE FROM products WHERE external_id IN ({placeholders})", batch).rowcount
    return deleted
```

## Gotchas

**★ Symptom: `ProgrammingError: parameters are of unsupported type` from a query built for a set of
IDs.** Cause: a qmark-style query needs a sequence and a set is not one. Fix: a sorted tuple — which
also makes the placeholder order and the statement text reproducible.

```python
params = tuple(sorted(ids))
sql = f"SELECT external_id FROM products WHERE external_id IN ({', '.join('?' * len(params))})"
rows = con.execute(sql, params).fetchall()
```

**★ Symptom: `executemany` with a set of string IDs fails with `Incorrect number of bindings
supplied`, but only in production.** Cause: each element is bound as a parameter sequence, and a
string is a sequence of characters; the test fixtures used one-character IDs. Fix: one-tuples.

```python
con.executemany("DELETE FROM products WHERE external_id = ?", [(i,) for i in sorted(ids)])
```

**Symptom: a large cleanup fails once the ID list grows past some size, although small runs work.**
Cause: one placeholder per ID in a single `IN` list exceeds the engine's host-parameter limit —
32766 by default in current SQLite, 999 before 3.32.0, lower if the application set it. Fix: batches
no larger than `con.getlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER)` — `delete_external_ids` above —
or one JSON parameter with `json_each`.

**Symptom: a run with nothing to delete fails with a syntax error on the production database but
passed against SQLite in tests.** Cause: `IN ()` with an empty list is accepted by SQLite and
rejected by most other engines. Fix: return before building the statement.

```python
if not ids:
    return 0
```

**★ Symptom: a sync that crashed half-way left rows deleted and their replacements never
created.** Cause: statements committed separately — including a helper's own `with con:`, which
commits on exit because the context manager is not a savepoint. Fix: one transaction at the top,
helpers that never commit — `delete_external_ids_in_tx` above.

```python
with con:
    delete_external_ids_in_tx(con, set(plan.to_delete))
    con.executemany("INSERT INTO products (external_id, name, price_cents) VALUES (?, ?, ?)",
                    [(k, *incoming[k]) for k in plan.to_create])
```

**Symptom: a security review flags the sync for SQL injection, though "they are only IDs".** Cause:
the `IN` list was built by formatting the values into the SQL string; string IDs come from upstream
and are attacker-controlled if upstream is. Fix: placeholders only — the values travel as parameters,
and only `?` characters are formatted into the text.

```python
placeholders = ", ".join("?" * len(batch))
con.execute(f"DELETE FROM products WHERE external_id IN ({placeholders})", batch)
```

## Interview questions

**★ How do you pass a Python set of IDs to a parameterised `IN` query?**
Convert it to a sorted tuple and generate one placeholder per element; bind the tuple. A set cannot
be bound directly because a qmark query needs a sequence. Sorting makes the statement and its
parameter order reproducible. For large sets, split the sorted IDs into batches below the engine's
parameter limit — `itertools.batched` gives tuples, which bind directly — and skip the statement
entirely when the set is empty. In SQLite, a single JSON-array parameter expanded with `json_each`
avoids the limit altogether.

**Why does `executemany` with a set of string IDs complain about the number of bindings?**
`executemany` iterates its argument and binds each element as one statement's parameter sequence.
A string is a sequence of characters, so a five-character ID supplies five parameters to a statement
that has one placeholder. One-character IDs happen to work, which is how it gets through tests.
Wrap each ID in a one-tuple.

**Why must the whole plan be applied in one transaction, and what breaks that in `sqlite3`?**
Creates, updates and deletes only make sense together; a partial application leaves a state no plan
described, and the next run diffs against it. `sqlite3`'s connection context manager commits when
the block exits and does not nest as a savepoint, so a helper that uses its own `with con:` commits
in the middle of the caller's plan. Keep one `with con:` at the top and write helpers that execute
without committing.

---

← Prev: [The incomplete snapshot](09c-the-incomplete-snapshot.md) · [Topic index](README.md) · Next → [The diff inside the database](09e-the-diff-inside-the-database.md)
