---
title: "A page is `rows[(page - 1) * size : page * size]` — two multiplications that each hide a bug: a page number below 1 makes a negative start that counts back from the end, a page past the last is silently empty, and the same slice pushed into SQL as `OFFSET` walks every skipped row and shifts whenever the data does"
sidebar_label: "11 · Slicing in real code: pagination"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [common sequence operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (notes 3 and 4), [ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges),
> [An informal introduction](https://docs.python.org/3.14/tutorial/introduction.html#text) (the
> half-open identity), [time complexity](https://docs.python.org/3.14/library/time-complexity.html)
> and [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3-placeholders); PostgreSQL
> 18 [LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html). Documentation-verified
> — **no sandbox run, no program output**.

**Chunks [01](01-the-three-numbers.md)–[10d](10d-typing-and-multidimensional-keys.md) are the
mechanism. This page and the next two are the three jobs that mechanism does most often in a
service: cutting a result into pages, cutting work into batches ([11b](11b-batching.md)),
and cutting a record into fields (**11c · Fixed-width records** *(not written yet)*). Pagination is the one that
arrives from the outside: the page number and size come from a query string, and every property of
slicing that is a convenience inside a program — negative indices count from the end, out-of-range
bounds clamp, nothing raises — becomes a way for a request to get the wrong rows without an error.
And the moment the rows live in a database, the same slice is spelled `LIMIT … OFFSET`, which keeps
the shape of a slice and loses its cost.**

## The arithmetic, and why pages tile

A 1-based page number `p` of size `n` is the half-open run of indices `(p - 1) * n` up to `p * n`.
Because a slice includes its start and excludes its stop, consecutive pages meet exactly:

> *"Note how the start is always included, and the end always excluded. This makes sure that
> `s[:i] + s[i:]` is always equal to `s`"* —
> [An informal introduction to Python](https://docs.python.org/3.14/tutorial/introduction.html#text)

So page 1 ends at the index page 2 starts at, and concatenating every page gives the list back — no
row twice, no row skipped. An inclusive habit (`rows[start:start + size - 1]`) breaks that and drops
one row per page. Validate before you multiply:

```python
from collections.abc import Sequence
from dataclasses import dataclass

MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class Page:
    items: Sequence
    number: int
    size: int
    total: int

    @property
    def page_count(self) -> int:
        return -(-self.total // self.size)            # ceiling division in integers

    @property
    def has_next(self) -> bool:
        return self.number < self.page_count


class PageNotFound(LookupError):
    pass


def paginate(rows: Sequence, number: int, size: int) -> Page:
    if not 1 <= size <= MAX_PAGE_SIZE:
        raise ValueError(f"size must be between 1 and {MAX_PAGE_SIZE}, got {size}")
    if number < 1:
        raise ValueError(f"page numbers start at 1, got {number}")
    start = (number - 1) * size
    if start >= len(rows) and number != 1:            # page 1 of an empty result is valid
        raise PageNotFound(f"page {number} of {-(-len(rows) // size)}")
    return Page(rows[start:start + size], number, size, len(rows))
```

Three decisions are in there. **The number is checked before it becomes an index** — the next
section is why. **A page past the end is an error, not an empty page** — slicing would return `[]`
without complaint ([03](03-out-of-range-never-raises.md)), and "no results" and "no such page" are
different answers. **The page count is ceiling division in integers**: `total // size` floors and
makes the last partial page unreachable; `math.ceil(total / size)` goes through a float.

## Page zero and page minus one

Remove the `number < 1` check and let a client send `?page=0` or `?page=-1`:

> *"If *i* or *j* is negative, the index is relative to the end of sequence *s*: `len(s) + i` or
> `len(s) + j` is substituted. But note that `-0` is still `0`."* —
> [Common sequence operations, note 3](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)

With 95 rows and a size of 10:

| Request | Slice computed | After note 3 | Result |
|---|---|---|---|
| `page=1` | `rows[0:10]` | — | rows 0–9 |
| `page=0` | `rows[-10:0]` | `rows[85:0]` | empty — start ≥ stop |
| `page=-1` | `rows[-20:-10]` | `rows[75:85]` | 🔴 **ten real rows from near the end** |
| `page=-100` | `rows[-1010:-1000]` | both below `-len`, clamped to 0 (note 4) | empty |

Page 0 looks like "no results". Page −1 is worse: it returns a full page of plausible data, just
not the page anyone asked for — and a cache keyed by the query string stores it. Nothing in the
slice can tell a negative number that was meant to count from the end from one that arrived by
accident; that is why the check has to happen before the multiplication.

## Page bounds without the rows: slice a `range`

A label such as "Rows 21–25 of 25", or a pager that has only a count from `SELECT COUNT(*)`, needs
the clamped bounds but not the items. A `range` does the same clamping and costs nothing to slice:

> *"Range objects implement the `collections.abc.Sequence` ABC, and provide features such as
> containment tests, element index lookup, slicing and support for negative indices"* —
> [Ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges)

```python
def page_label(total: int, number: int, size: int) -> str:
    window = range(total)[(number - 1) * size:number * size]    # clamped exactly like a list slice
    if not window:
        return f"No rows on page {number}"
    return f"Rows {window.start + 1}–{window.stop} of {total}"
```

`range(25)[20:30]` is `range(20, 25)`: the stop clamps to the length, just as `rows[20:30]` would
return five rows. The 3.14 cost table prices a range slice at O(1) — it computes a new `range`
rather than producing elements. The list version of the same label bug is in
[01](01-the-three-numbers.md).

## In the database, the slice is `LIMIT … OFFSET`

`rows[offset:offset + size]` against a table is `LIMIT size OFFSET offset`, and fetching everything
to slice it in Python moves the whole table over the connection to keep ten rows:

```python
import sqlite3


def page_of_orders(con: sqlite3.Connection, number: int, size: int) -> list[tuple]:
    if number < 1 or not 1 <= size <= MAX_PAGE_SIZE:
        raise ValueError("bad page request")
    return con.execute(
        "SELECT id, created_at, total_cents FROM orders "
        "ORDER BY created_at, id LIMIT ? OFFSET ?",          # id breaks ties: a unique order
        (size, (number - 1) * size),
    ).fetchall()
```

PostgreSQL's documentation states the two properties a slice does not have:

> *"OFFSET says to skip that many rows before beginning to return rows."* · *"When using LIMIT, it is
> important to use an ORDER BY clause that constrains the result rows into a unique order.
> Otherwise you will get an unpredictable subset of the query's rows."* · *"The rows skipped by an
> OFFSET clause still have to be computed inside the server; therefore a large OFFSET might be
> inefficient."* — [PostgreSQL 18, LIMIT and OFFSET](https://www.postgresql.org/docs/18/queries-limit.html)

A list slice jumps to its start — the cost table gives `l[i:j]` as O(j − i). `OFFSET` does not jump;
it is [`islice`](07c-islice-in-practice.md) run by the server, and page 10,000 costs the 99,990 rows
before it. And a list does not reorder itself between two requests, while a table does: a row
inserted or deleted ahead of the offset moves every later row by one, so the next page repeats a row
or skips one.

## Keyset pagination: resume after a key, not a position

Remember the last key of the page and ask for rows after it. The index finds the start directly, and
rows inserted or deleted behind the key do not move the next page:

```python
from collections.abc import Iterator


def orders_after(con: sqlite3.Connection, after_id: int, size: int) -> list[tuple]:
    return con.execute(
        "SELECT id, created_at, total_cents FROM orders WHERE id > ? ORDER BY id LIMIT ?",
        (after_id, size),
    ).fetchall()


def all_orders(con: sqlite3.Connection, size: int = 500) -> Iterator[tuple]:
    last_id = 0
    while page := orders_after(con, last_id, size):
        yield from page
        last_id = page[-1][0]                     # the next page starts after this key
```

The trade is the one slicing makes obvious: a key cannot say "page 37". Keyset pagination gives
*next* and *previous*, not random access, which suits infinite scroll, API cursors and batch jobs —
and a batch job that deletes what a paged fetch did not see must page by key
([set · 9c](../04-set-and-frozenset/09c-the-incomplete-snapshot.md)).

## Gotchas

**★ Symptom: `?page=-1` returns a full page of orders — the wrong ones — and the CDN caches it.**
Cause: `(page - 1) * size` went negative, and a negative slice bound counts from the end (note 3).
Fix: validate the page number before computing any bound.

```python
if number < 1:
    raise ValueError(f"page numbers start at 1, got {number}")
```

**★ Symptom: an admin list gets slower the deeper the user pages, although each page is ten rows.**
Cause: `LIMIT 10 OFFSET 99990` makes the server produce and discard every skipped row. Fix: keyset
pagination — `WHERE id > ? ORDER BY id LIMIT ?` — as in `orders_after` above.

**★ Symptom: the same order appears at the bottom of page 3 and the top of page 4, and another
never appears.** Cause: `ORDER BY created_at` alone; rows with equal timestamps have no defined
order, and the database may return them differently for each query. Fix: a tie-breaker that makes
the order unique.

```python
"SELECT id, created_at FROM orders ORDER BY created_at, id LIMIT ? OFFSET ?"
```

**Symptom: the pager shows 9 pages for 97 results, and the last 7 can never be reached.** Cause:
`total // size` floors. Fix: ceiling division in integers.

```python
page_count = -(-total // size)
```

**Symptom: an endpoint's memory spikes when a client sends `?size=1000000`.** Cause: the page size
is user input and was never bounded; the slice happily returns everything. Fix: clamp or reject.

```python
if not 1 <= size <= MAX_PAGE_SIZE:
    raise ValueError(f"size must be between 1 and {MAX_PAGE_SIZE}")
```

**Symptom: a paged API is slow for every page, even page 1.** Cause: the handler runs the full query,
calls `fetchall()`, and slices the list in Python — every request transfers the whole result. Fix:
let the database apply the bounds.

```python
rows = con.execute("SELECT id, name FROM products ORDER BY id LIMIT ? OFFSET ?",
                   (size, (number - 1) * size)).fetchall()
```

**Symptom: page 5 of a filtered list returns an empty page instead of a 404 after the filter
narrowed the results.** Cause: a slice past the end is empty, not an error. Fix: decide what a
missing page means and raise it — `PageNotFound` in `paginate` above.

## Interview questions

**★ How do you paginate a Python list, and what goes wrong with page 0 or −1?**
`rows[(page - 1) * size : page * size]` for 1-based pages. Half-open slices make consecutive pages
tile the list exactly. Without validation, page 0 produces `rows[-size:0]`, which is empty because
the re-based start is past the stop, and page −1 produces `rows[-2*size:-size]`, which is a real page
near the end — negative bounds count from the end. Check `page >= 1` and bound `size` before
computing indices, and decide whether a page past the end is empty or an error, because slicing
will not tell you.

**★ What is the difference between `LIMIT/OFFSET` and keyset pagination?**
`OFFSET n` asks the server to produce and skip `n` rows, so deep pages cost more and more, and
because it addresses rows by position, inserts and deletes between requests shift pages — rows
repeat or disappear. Keyset pagination remembers the last key and asks for `WHERE key > ? ORDER BY
key LIMIT ?`; an index finds the start directly and changes behind the key do not move the next
page. The cost is random access: you cannot jump to page 37.

**Why must a paged query's `ORDER BY` be unique?**
Because rows that tie on the sort key have no defined order, and separate queries may return them in
different orders, so a tied row can land on two pages or none. Adding the primary key as the last
sort column makes every row's position well-defined — the documentation's wording is that the
`ORDER BY` must *"constrain the result rows into a unique order"*.

**How do you compute the number of pages without floating point?**
Ceiling division: `-(-total // size)`, or `(total + size - 1) // size`. Floor division alone loses
the last partial page, and `math.ceil(total / size)` goes through a float, which cannot represent every
integer above 2⁵³.

**Why does slicing a `range` give you page bounds for free?**
A range is a sequence that slices with exactly the list clamping rules but computes its result
instead of copying elements, so `range(total)[start:stop]` returns the clamped window as a new range
in constant time. Its `start` and `stop` are the first index and one past the last index actually on
the page, which is what a "Rows 21–25 of 25" label needs when you only have a count.

---

← Prev: [10d · Typing and multi-dimensional keys](10d-typing-and-multidimensional-keys.md) · [Topic index](README.md) · Next → [11b · Slicing in real code: batching](11b-batching.md)
