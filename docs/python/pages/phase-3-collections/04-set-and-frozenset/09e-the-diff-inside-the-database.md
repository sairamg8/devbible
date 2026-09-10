---
title: "When the ID sets are too large to hold, move the difference, not the data — a temporary table and `EXCEPT` or `NOT EXISTS` in the database, or a merge over two streams sorted the same way — and bring the equality with you, because SQL's `NULL`, its column types and its collations are not a Python set's `==`"
sidebar_label: "9e · The diff inside the database"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html) and the
> [language reference, value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons);
> SQLite's [SQL expressions — IN and NOT IN](https://www.sqlite.org/lang_expr.html#the_in_and_not_in_operators),
> [compound SELECT](https://www.sqlite.org/lang_select.html#compound_select_statements),
> [CREATE TABLE](https://www.sqlite.org/lang_createtable.html) and
> [collating sequences](https://www.sqlite.org/datatype3.html#collation); RFC 3629
> ([UTF-8](https://www.rfc-editor.org/rfc/rfc3629)) for byte order. Documentation-verified — **no
> sandbox run, no program output, no memory figures**.

**Everything in [9](09-diffing-id-sets.md)–[9d](09d-sets-as-sql-parameters.md) holds both ID sets in
Python memory. When the table has tens of millions of rows, that is two hash tables of that size
before a single row is compared ([1b](01b-what-the-table-costs-you.md)). There are two ways out, and
both keep the set algebra while dropping the sets: push the incoming IDs into the database and let
SQL compute the differences, or read both sides in the same sorted order and merge them, holding one
key from each at a time. Both move the comparison out of Python's `==` — into SQL's, with `NULL`
and collations, or into `<`, with its ordering — and that is where these go wrong.**

## Move the difference into SQL

Stream the incoming IDs into a temporary table in batches, then ask SQL the two questions:

```python
import sqlite3
from collections.abc import Iterable
from itertools import batched


def load_incoming(con: sqlite3.Connection, incoming_ids: Iterable[int]) -> None:
    con.execute("CREATE TEMP TABLE IF NOT EXISTS incoming_ids (id INTEGER PRIMARY KEY)")
    con.execute("DELETE FROM incoming_ids")                        # reused connection: start empty
    for batch in batched(incoming_ids, 1000):
        con.executemany("INSERT INTO incoming_ids (id) VALUES (?)", [(i,) for i in batch])


def diff_in_database(con: sqlite3.Connection) -> tuple[list[int], list[int]]:
    to_create = [i for (i,) in con.execute(
        "SELECT id FROM incoming_ids EXCEPT SELECT external_id FROM products ORDER BY 1")]
    to_delete = [i for (i,) in con.execute(
        "SELECT external_id FROM products WHERE external_id IS NOT NULL "
        "EXCEPT SELECT id FROM incoming_ids ORDER BY 1")]
    return to_create, to_delete
```

*"If the "TEMP" or "TEMPORARY" keyword occurs between the "CREATE" and "TABLE" then the new table is
created in the temp database"* ([CREATE TABLE](https://www.sqlite.org/lang_createtable.html)) — so
other connections do not see it, and a pooled connection that ran the sync before still has it,
which is why `load_incoming` empties it first. The `PRIMARY KEY` makes a duplicate incoming ID
raise `IntegrityError` rather than vanish — the same "a duplicate is an error" rule as
[9b](09b-composite-keys-nulls-and-values.md), and the overlapping-pages signal from
[9c](09c-the-incomplete-snapshot.md). The results come back already sorted, and
`to_delete` is still subject to every guard in [9c](09c-the-incomplete-snapshot.md): the database
computes the same difference Python would, from the same possibly-incomplete input.

`EXCEPT` is set difference, with rules of its own:

> *"The EXCEPT operator returns the subset of rows returned by the left SELECT that are not also
> returned by the right-hand SELECT. Duplicate rows are removed from the results of INTERSECT and
> EXCEPT operators before the result set is returned."* · *"For the purposes of determining duplicate
> rows for the results of compound SELECT operators, NULL values are considered equal to other NULL
> values and distinct from all non-NULL values."* · *"No affinity transformations are applied to any
> values when comparing rows as part of a compound SELECT."* —
> [SQLite, compound SELECT](https://www.sqlite.org/lang_select.html#compound_select_statements)

Two of those sentences are [9](09-diffing-id-sets.md)'s type trap, relocated. `NULL` is one value
for `EXCEPT` — the same collapse a Python set does to `None`. And *no affinity transformations*
means an integer `42` in `products.external_id` and a text `'42'` in a temp column are two different
values: declare the temporary column with the real column's type and bind the same Python type, or
`EXCEPT` reports every row on both sides.

The same page settles collations in `EXCEPT`'s favour: *"The collation sequence used to compare two
text values is determined as if the columns of the left and right-hand SELECT statements were the
left and right-hand operands of the equals (=) operator"*. A `NOCASE` column's rows are compared
case-insensitively by `EXCEPT` exactly as by `=` — which is an argument for computing the diff where
the equality lives. In Python, you have to rebuild that equality yourself (below).

## `NULL` in `IN` and `NOT IN`: three-valued logic

`EXCEPT` treats `NULL`s as equal. `NOT IN` does not treat them as anything. In Python, `None` is an
element like any other: `2 not in {None, 1}` is `True`. In SQL, a `NULL` on the right of `NOT IN`
makes the result unknown for every value not found. SQLite's truth table has this row — left operand
not `NULL`, right operand contains `NULL`, value not found — and gives `NULL` for both `IN` and
`NOT IN`. A `WHERE` clause keeps only rows where the condition is true, so the "what to create"
anti-join written as

```sql
SELECT id FROM incoming_ids
WHERE id NOT IN (SELECT external_id FROM products);
```

returns **no rows** as soon as `products` holds one unmapped row — one `NULL` external ID, the rows
[9b](09b-composite-keys-nulls-and-values.md) set aside — and a sync built on it reports "nothing to
create" forever. (`incoming_ids.id` cannot be the culprit: an `INTEGER PRIMARY KEY` column is never
`NULL`.) The same table's first rule is the empty-snapshot hazard again, in SQL:

> *"When the right operand is an empty set, the result of IN is false and the result of NOT IN is
> true, regardless of the left operand and even if the left operand is NULL."* —
> [SQLite, the IN and NOT IN operators](https://www.sqlite.org/lang_expr.html#the_in_and_not_in_operators)

`NOT EXISTS` tests for a matching row rather than comparing against a list, so a `NULL` in the
subquery cannot poison it:

```sql
SELECT i.id FROM incoming_ids AS i
WHERE NOT EXISTS (SELECT 1 FROM products AS p WHERE p.external_id = i.id);
```

## Merge two sorted streams instead of building two sets

If both sides can be read **in the same order** — `ORDER BY external_id` on the table, an upstream
that pages by ascending ID — the diff needs no set at all. Walk both streams like the merge step of
merge sort: the smaller key is on one side only; equal keys are in both.

```python
from collections.abc import Iterable, Iterator

_END = object()


def _strictly_increasing(keys: Iterable, side: str) -> Iterator:
    previous = _END
    for key in keys:
        if previous is not _END and not previous < key:
            raise ValueError(f"{side} stream is not strictly increasing: {previous!r} then {key!r}")
        previous = key
        yield key


def merge_diff(existing: Iterable, incoming: Iterable) -> Iterator[tuple[str, object]]:
    """Diff two key streams sorted the same way; memory does not grow with their length."""
    ex = _strictly_increasing(existing, "existing")
    inc = _strictly_increasing(incoming, "incoming")
    a, b = next(ex, _END), next(inc, _END)
    while a is not _END or b is not _END:
        if b is _END or (a is not _END and a < b):
            yield "delete", a
            a = next(ex, _END)
        elif a is _END or b < a:
            yield "create", b
            b = next(inc, _END)
        else:                                               # equal: present on both sides
            a, b = next(ex, _END), next(inc, _END)


def stream_existing(con: sqlite3.Connection) -> Iterator[int]:
    for (external_id,) in con.execute("SELECT external_id FROM products "
                                      "WHERE external_id IS NOT NULL ORDER BY external_id"):
        yield external_id
```

The merge is correct only if both sides use **the same ordering as Python's `<`** — and the
`_strictly_increasing` check is not optional, because a merge over mis-ordered input does not fail;
it emits wrong creates and deletes. Where the orders come from:

- **Integers** sort the same everywhere — provided both sides *are* integers. An upstream that sorts
  its IDs as strings puts `"10"` before `"9"`; parsed into `int`s, that stream is no longer
  increasing, and the check raises instead of mis-merging.
- **Python strings** compare *"at the level of Unicode code points"*
  ([value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)).
- **SQLite's default `BINARY` collation** *"Compares string data using memcmp(), regardless of text
  encoding"* ([collating sequences](https://www.sqlite.org/datatype3.html#collation)) — and for UTF-8,
  *"The byte-value lexicographic sorting order of UTF-8 strings is the same as if ordered by
  character numbers"* ([RFC 3629](https://www.rfc-editor.org/rfc/rfc3629)). So in a database whose
  text encoding is UTF-8, `ORDER BY` with `BINARY` matches Python's `sorted`. A column declared
  `COLLATE NOCASE`, or a database that sorts by a locale's collation, does not.

## Collations change equality too

A collation decides what *equal* means, not just what *before* means:

> *"NOCASE - Similar to binary, except that it uses sqlite3_strnicmp() for the comparison. Hence the
> 26 upper case characters of ASCII are folded to their lower case equivalents before the comparison
> is performed. Note that only ASCII characters are case folded."* · *"RTRIM - The same as binary,
> except that trailing space characters are ignored."* —
> [SQLite, collating sequences](https://www.sqlite.org/datatype3.html#collation)

With `external_id TEXT UNIQUE COLLATE NOCASE`, the database holds `"ABC-1"` and upstream sends
`"abc-1"`. A Python set says they differ, so the plan creates `"abc-1"` and deletes `"ABC-1"` — and the
insert violates the unique constraint (or, if deletes run first, the row is replaced and anything
referencing its local ID is orphaned). The fix is to make the Python key **exactly** the database's
equality — not something close to it:

```python
import string

_ASCII_UPPER_TO_LOWER = str.maketrans(string.ascii_uppercase, string.ascii_lowercase)


def nocase_key(value: str) -> str:
    """SQLite NOCASE equality: fold A-Z only. casefold() would also merge 'É' and 'é'."""
    return value.translate(_ASCII_UPPER_TO_LOWER)


def rtrim_key(value: str) -> str:
    """SQLite RTRIM equality: trailing spaces ignored."""
    return value.rstrip(" ")
```

`str.casefold()` is the wrong tool here precisely because it is better: it folds far beyond ASCII, so
Python would merge two IDs the `NOCASE` column stores as distinct rows.

## Gotchas

**★ Symptom: the `NOT IN` anti-join has found no new products since the day the first unmapped row
was added.** Cause: the subquery's column contains a `NULL`, and `x NOT IN (..., NULL)` is `NULL` for
every `x` not found. Fix: `NOT EXISTS`, or filter `NULL`s out of the subquery.

```sql
WHERE NOT EXISTS (SELECT 1 FROM products AS p WHERE p.external_id = i.id)
```

**★ Symptom: after moving the diff into SQL, `EXCEPT` reports every row on both sides.** Cause: the
temporary column was declared `TEXT` (or bound Python strings) while `products.external_id` holds
integers, and compound SELECTs apply no affinity transformations — `42` and `'42'` are different.
Fix: same declared type, same bound type.

```python
con.execute("CREATE TEMP TABLE IF NOT EXISTS incoming_ids (id INTEGER PRIMARY KEY)")
con.executemany("INSERT INTO incoming_ids (id) VALUES (?)",
                [(parse_external_id(raw),) for raw in raw_ids])
```

**★ Symptom: the merge diff creates and deletes the same products on alternate runs.** Cause: the
two streams are ordered differently — the table by a `NOCASE` or locale collation, the upstream by
code point, or one side numerically and the other as strings — and the merge was written without an
order check. Fix: sort both sides by the same rule, and verify it while merging.

```python
existing = con.execute("SELECT external_id FROM products ORDER BY external_id COLLATE BINARY")
for action, key in merge_diff((k for (k,) in existing), incoming_stream):
    apply(action, key)
```

**Symptom: `IntegrityError: UNIQUE constraint failed` inserting IDs the diff said were new.** Cause:
the column's collation (`NOCASE`, `RTRIM`) calls two strings equal that a Python set keeps apart.
Fix: build the Python keys with the column's own equality.

```python
existing = {nocase_key(k) for (k,) in con.execute("SELECT external_id FROM products")}
incoming = {nocase_key(item["id"]) for item in payload["items"]}
```

**Symptom: after "normalising" IDs with `casefold()`, two distinct products share one plan entry
and one of them is never updated.** Cause: `casefold` folds non-ASCII letters too, so it merges IDs
the `NOCASE` column treats as distinct. Fix: `nocase_key`, which folds only what the database folds.

**Symptom: the second sync on a pooled connection sees yesterday's incoming IDs.** Cause: a `TEMP`
table lives as long as the connection, and the pool reused it. Fix: empty it at the start of each
run.

```python
con.execute("DELETE FROM incoming_ids")
```

## Interview questions

**★ How does `NULL` behave differently in SQL `NOT IN` from `None` in a Python set?**
In Python, `None` is an ordinary element: it is either in the set or not, and `x not in s` is always
`True` or `False`. In SQL, `NOT IN` against a list that contains `NULL` evaluates to `NULL` for
every value not found, and a `WHERE` clause drops rows whose condition is not true — so the anti-join
returns nothing. `NOT EXISTS` avoids it, because it tests whether a matching row exists instead of
comparing against every value. `EXCEPT`, meanwhile, treats `NULL`s as equal to each other — closer
to the Python set.

**★ The ID sets no longer fit comfortably in memory. How do you still compute the diff?**
Either move the incoming IDs into the database — a temporary table filled in batches — and let SQL
compute both differences with `EXCEPT` or `NOT EXISTS`, which also returns the results sorted; or
read both sides in the same sorted order and merge them, holding one key per side at a time. The
guards against an incomplete snapshot still apply to either, and each brings a new equality: SQL's
types, `NULL` rules and collations, or the merge's reliance on both sides agreeing with Python's `<`.

**What has to be true for a merge-based diff to be correct?**
Both streams must be sorted by the same total order, and that order must agree with the comparison
the merge uses. Integers are safe if both sides really are integers. Strings are safe when the
database sorts by code point — SQLite's `BINARY` collation on UTF-8 text does, because UTF-8 byte
order equals code point order — and unsafe under `NOCASE` or a locale collation. Because a merge over
mis-ordered input silently emits wrong actions, check strict increase as you go.

**Why can a diff computed in Python raise a unique-constraint error when applied, and why is
`casefold()` not the fix?**
Because the database's equality for that column is not Python's: a `NOCASE` column treats `"ABC-1"`
and `"abc-1"` as the same value, a Python set does not, so the plan inserts a duplicate. The fix is to
build the Python key with exactly the column's equality. SQLite's `NOCASE` folds only the 26 ASCII
letters; `casefold()` folds much more and would merge values the column stores separately — trading
one mismatch for the opposite one.

---

← Prev: [Sets as SQL parameters](09d-sets-as-sql-parameters.md) · [Topic index](README.md)
