---
title: "`existing - incoming` trusts that `incoming` is the whole of upstream — an empty response, a pager that stopped early or offset paging over moving data turns the difference into a delete instruction for everything the fetch missed, so the fetch has to prove it is complete and one run has to be capped in what it may delete"
sidebar_label: "9c · The incomplete snapshot"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset) and
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3-connection-context-manager)
> (the connection context manager); PostgreSQL 18
> [LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html) for the paging
> precondition. Documentation-verified — **no sandbox run, no program output**.

**[9](09-diffing-id-sets.md) and [9b](09b-composite-keys-nulls-and-values.md) produce a correct plan
from correct inputs. The most destructive sync failure is a correct plan from an incomplete input.
`existing - incoming` has no idea whether `incoming` is the whole of upstream or the first three
pages of it; every ID the fetch did not see is, by definition, in the difference. An HTTP error
converted to `[]`, an outage that answers 200 with an empty list, a pager that hit its safety limit,
a page that shifted under offset paging — each one becomes a set of deletes that the job executes
faithfully. The fix is not in the algebra: the fetch has to prove it is complete, the set has to
stop hiding the evidence that it was not, and one run has to be capped in what it may destroy.**

## 🔴 An empty set is a claim that upstream has nothing

`existing - incoming` is exactly as large as `existing` when `incoming` is empty. The set algebra is
not wrong — it answered the question it was given. So make completeness explicit, carry the raw
count alongside the deduplicated set, and put a ceiling on deletes:

```python
from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class Snapshot:
    ids: frozenset[int]
    complete: bool                   # the pager reached the upstream's documented end
    items_seen: int                  # raw count, before the set deduplicated anything


def fetch_all_ids(fetch_page: Callable[[str | None], dict], max_pages: int = 10_000) -> Snapshot:
    ids: set[int] = set()
    seen = 0
    cursor: str | None = None
    for _ in range(max_pages):
        page = fetch_page(cursor)                      # must raise on failure, never return []
        items = page["items"]
        seen += len(items)
        ids.update(parse_external_id(item["id"]) for item in items)
        cursor = page.get("next_cursor")
        if cursor is None:
            return Snapshot(frozenset(ids), complete=True, items_seen=seen)
    return Snapshot(frozenset(ids), complete=False, items_seen=seen)


MAX_DELETE_FRACTION = 0.05


def safe_deletes(existing: set[int], snapshot: Snapshot) -> list[int]:
    if not snapshot.complete:
        raise RuntimeError("upstream snapshot incomplete; refusing to delete")
    if snapshot.items_seen != len(snapshot.ids):
        raise RuntimeError("pages overlapped: rows moved during the fetch, so some were skipped")
    to_delete = existing - snapshot.ids
    if existing and len(to_delete) > MAX_DELETE_FRACTION * len(existing):
        raise RuntimeError(f"would delete {len(to_delete)} of {len(existing)} rows; needs review")
    return sorted(to_delete)
```

Three guards, three failure modes. `complete` catches the loop that ran out of pages. The ceiling
catches the empty list that looked like success. The `items_seen` check catches the one the set
itself hides, below. The ceiling's number is a policy choice — 5% here — and the right one is the
largest deletion your upstream legitimately produces in one run; a run over it stops and waits for a
human instead of executing.

`fetch_page` raising is the contract everything rests on. A helper that logs and returns
`{"items": [], "next_cursor": None}` on a timeout produces a *complete, empty* snapshot, and only
the ceiling stands between it and the table.

## The set hides the evidence of a shifted page

Offset pagination — `?offset=200&limit=100` — addresses rows by position, and positions move when
the data changes during the fetch. A row inserted before your offset pushes every later row one
place back, so the next page starts with a row you already saw: a **repeat**. A row deleted before
your offset pulls every later row one place forward, so the first row of the next page was on the
page you already read: a **skip**. The skip is the dangerous one — that ID is missing from
`incoming`, and the diff deletes it. PostgreSQL's documentation states the precondition for paging
at all:

> *"When using LIMIT, it is important to use an ORDER BY clause that constrains the result rows into
> a unique order. Otherwise you will get an unpredictable subset of the query's rows."* —
> [PostgreSQL 18, LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html)

A unique order makes each page well-defined; it does not stop positions moving between requests.
Two things help. **Page by key, not position**: a cursor that encodes the last key seen
(`WHERE id > ? ORDER BY id LIMIT ?`) does not shift when rows are inserted or deleted behind it —
which is why `fetch_all_ids` follows a `next_cursor`. And **count before you deduplicate**: a
`set.update` quietly swallows a repeated ID, so a set of IDs can never tell you the pages overlapped.
Carrying `items_seen` does — and where there was a repeat, there was probably a skip too. Paging
itself is
[Slicing in real code: pagination](../05-slicing/11-slicing-in-real-code.md) in the slicing topic.

## A second guard: absence has to persist

Even a complete, non-overlapping snapshot can be wrong: an upstream bug hides a category for one
run, an eventually-consistent index lags. Deleting on first absence makes every such blip
permanent. Mark-and-sweep turns "absent once" into "absent for N consecutive complete runs":

```python
import sqlite3

MISSES_BEFORE_DELETE = 3


def mark_and_sweep(con: sqlite3.Connection, existing: set[int], snapshot: Snapshot) -> int:
    if not snapshot.complete:
        raise RuntimeError("upstream snapshot incomplete; refusing to sweep")
    missing = sorted(existing - snapshot.ids)
    present = sorted(existing & snapshot.ids)
    with con:
        con.executemany("UPDATE products SET missing_runs = missing_runs + 1 WHERE external_id = ?",
                        [(i,) for i in missing])
        con.executemany("UPDATE products SET missing_runs = 0 WHERE external_id = ?",
                        [(i,) for i in present])
        cur = con.execute("DELETE FROM products WHERE missing_runs >= ?", (MISSES_BEFORE_DELETE,))
    return cur.rowcount
```

The three statements run in one transaction — *"If the body of the `with` statement finishes without
exceptions, the transaction is committed … if the body of the `with` statement raises an uncaught
exception, the transaction is rolled back"*
([`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3-connection-context-manager))
— so a crash never leaves the counters half-updated. Resetting `present` costs one statement per
live row; for a large table, update only rows whose counter is non-zero. How a set becomes SQL
parameters — the one-tuples above are not decoration — is
[9d](09d-sets-as-sql-parameters.md).

## Gotchas

**★ Symptom: after an upstream outage, the nightly sync deleted the entire catalogue.** Cause: the
fetch helper caught the HTTP error and returned an empty list; `existing - set()` is `existing`.
Fix: a failed fetch raises, completeness is explicit, and deletes have a ceiling.

```python
to_delete = safe_deletes(existing_ids, fetch_all_ids(fetch_page))
```

**★ Symptom: a handful of live products are deleted on some runs and re-created on the next.**
Cause: offset pagination over a table that changed during the fetch — a deletion upstream shifted
every later row forward by one, so one item per shift was never seen. Fix: keyset or cursor paging,
and compare the raw item count with the number of unique IDs.

```python
if snapshot.items_seen != len(snapshot.ids):
    raise RuntimeError("pages overlapped: rows moved during the fetch")
```

**Symptom: once the catalogue passed 10,000 products, everything after the 100th page was deleted
every night.** Cause: the paging loop had a safety cap — `for _ in range(100)` — and treated
reaching it as the end. Fix: hitting the cap means *incomplete*, and incomplete means no deletes.

```python
if cursor is not None:                       # loop ended on the cap, not on the last page
    return Snapshot(frozenset(ids), complete=False, items_seen=seen)
```

**Symptom: one run created tens of thousands of products from categories this service does not
sell.** Cause: upstream renamed a filter parameter and ignored the old one, so the "filtered" fetch
returned everything. The mirror image of the empty snapshot. Fix: a ceiling on creates too, and a
check that every incoming record is inside the scope you asked for.

```python
out_of_scope = [item["id"] for item in items if item["category"] not in requested_categories]
if out_of_scope:
    raise RuntimeError(f"upstream ignored the filter: {len(out_of_scope)} items outside scope")
```

**Symptom: a product vanished for one night because upstream's search index lagged, and its
reviews and order history went with it.** Cause: delete on first absence. Fix: mark-and-sweep — delete
only after several consecutive complete runs have missed it.

```python
deleted = mark_and_sweep(con, existing_ids, snapshot)
```

## Interview questions

**★ Why is an empty "incoming" set dangerous in a sync job, and how do you guard against it?**
Because `existing - incoming` then equals `existing`, and the job deletes everything. An empty set
is indistinguishable from "upstream really has nothing" unless the fetch proves otherwise. Make
fetch failures raise instead of returning empty, mark a snapshot complete only when the pager reached
its documented end, and cap the fraction of rows a single run may delete, so an anomaly stops for
review instead of executing.

**★ How can offset-based pagination cause a sync to delete live rows?**
If the upstream data changes while you page through it, row positions shift. A deletion behind your
offset moves every later row one position earlier, so the first row of your next page was on the
page you already read — it is skipped, it is missing from the incoming set, and the diff deletes it.
Paging by the last key seen avoids the shift; comparing the raw item count with the number of unique
IDs detects the overlapping case, which usually accompanies a skip.

**Why can't the set of IDs itself tell you that pages overlapped?**
Because a set keeps one element per value: a repeated ID is absorbed by `update` without any trace,
and the set is the same whether an ID arrived once or twice. The evidence exists only in the raw
stream, so count items as they arrive and compare with `len(ids)` at the end.

**Why delete on the third consecutive absence rather than the first?**
Because a single complete snapshot can still be wrong — an upstream bug, a lagging index, a
category briefly unpublished — and a delete in your system is usually not reversible: it cascades to
related rows or loses local data. Counting consecutive misses and resetting the counter on every
sighting turns transient absence into a no-op, at the cost of deleting genuinely removed items a
couple of runs later.

---

← Prev: [Composite keys, NULLs and values](09b-composite-keys-nulls-and-values.md) · [Topic index](README.md) · Next → [Sets as SQL parameters](09d-sets-as-sql-parameters.md)
