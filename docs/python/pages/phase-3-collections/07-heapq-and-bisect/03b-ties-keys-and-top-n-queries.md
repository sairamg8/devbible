---
title: "nlargest returns the first-seen of equal items, calls key once per element and never compares the elements themselves — so ties are only as deterministic as the input order, dicts need a key, and a top-N that lives in a database belongs in ORDER BY … LIMIT"
sidebar_label: "03b · Ties, keys and top-N queries"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq.nlargest`](https://docs.python.org/3.14/library/heapq.html#heapq.nlargest), [`max()`](https://docs.python.org/3.14/library/functions.html#max) and [`min()`](https://docs.python.org/3.14/library/functions.html#min) (the tie rule), [`collections.Counter.most_common`](https://docs.python.org/3.14/library/collections.html#collections.Counter.most_common) — and CPython **v3.14.7** [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 519–535, 577–593: the key paths). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**[03](03-nlargest-and-nsmallest.md) is how `nlargest` works; this is what it hands back. Two elements that compare equal come out in the order they arrived, exactly as a stable sort would give them — so a top-N over a set, over rows fetched without `ORDER BY`, or over results gathered from threads can differ from run to run in which tied item makes the cut. With `key=`, the key is computed once per element and the entry carries a unique sequence number, so the elements themselves are never compared: dicts and arbitrary objects are fine. Without a key, the elements are compared directly, and a dict is ranked by its keys. And when the data is already in a database, the fastest `nlargest` is the one you did not run: `ORDER BY … LIMIT` on an indexed column reads K rows instead of shipping N.**

## Ties: first encountered wins

`nlargest` and `nsmallest` are documented as equivalent to the `sorted(...)[:n]` expression,
and `sorted` is stable. The documentation for `max` and `min` states the resulting rule and
names these functions as following it:

> *"If multiple items are maximal, the function returns the first one encountered. This is
> consistent with other sort-stability preserving tools such as
> `sorted(iterable, key=keyfunc, reverse=True)[0]` and `heapq.nlargest(1, iterable, key=keyfunc)`."*

Mechanically it comes from two lines in the source: each entry is decorated with its arrival
order, and a new element replaces the root only if it is **strictly** better (`top < elem` in
`nlargest`, `elem < top` in `nsmallest`). An element equal to the current K-th best is ignored.

That makes the result deterministic **for a given input order** — and no more. If the order of
the input is not fixed, neither is which tied item you get:

```python
import heapq

scores = {"ana": 91, "bo": 91, "cy": 88, "dee": 91}
# dict order is insertion order, so this is stable across runs:
top_two = heapq.nlargest(2, scores.items(), key=lambda kv: kv[1])

tagged_users = {"ana", "bo", "dee"}               # a set of str: order varies per process
# which of three tied users lands in the top two can change between deploys:
risky = heapq.nlargest(2, tagged_users, key=lambda u: scores[u])

# Make the tie-break part of the key and the answer stops depending on arrival order:
stable = heapq.nsmallest(2, tagged_users, key=lambda u: (-scores[u], u))
```

The last line is also the answer to "highest score first, then alphabetical": a key of
`(score, name)` under `nlargest` would put the tied names in *descending* order, because the
whole key is reversed. Negating the numeric part and switching to `nsmallest` gives descending
score and ascending name in one call. A non-numeric primary field cannot be negated — that case
is a two-pass stable sort, which **10 · Sorting compound data** *(not written yet)* owns.

## `key=`: once per element, and the elements never meet

The key path of `nsmallest` in v3.14.7:

```python
# Lib/heapq.py, v3.14.7 — nsmallest, general case
it = iter(iterable)
result = [(key(elem), i, elem) for i, elem in zip(range(n), it)]
if not result:
    return result
heapify_max(result)
top = result[0][0]
order = n
_heapreplace = heapreplace_max
for elem in it:
    k = key(elem)
    if k < top:
        _heapreplace(result, (k, order, elem))
        top, _order, _elem = result[0]
        order += 1
result.sort()
return [elem for (k, order, elem) in result]
```

Two consequences:

- **`key` runs exactly once per input element** — N calls, never more. (Contrast `bisect`,
  where the key is re-run on every probe — **07b · The `key=` parameter** *(not written yet)*.) An expensive key — a distance calculation, a parsed timestamp — is paid
  once per item, which is the minimum possible.
- **Entries are `(key, unique_index, element)`**, so tuple comparison is always decided by the
  first two positions. The element is carried, never compared. A top-N over dicts, ORM objects
  or anything without `__lt__` works as long as the key values order.

Without a key, the entry is `(elem, index)` and the elements are compared directly — equal
elements fall through to the index, but unequal unorderable ones raise:

```python
import heapq
from operator import itemgetter

invoices = [
    {"id": "inv-104", "total": 1250.00},
    {"id": "inv-105", "total": 980.50},
    {"id": "inv-106", "total": 4410.75},
]
# heapq.nlargest(2, invoices)                     # TypeError: dict < dict
biggest_two = heapq.nlargest(2, invoices, key=itemgetter("total"))
```

## A dict is ranked by its keys

Iterating a dict yields its keys, so `nlargest(3, scores)` returns the three largest *keys* —
the alphabetically last usernames — not the three best scores. `Counter` is a dict and behaves
the same way; its own ranking method is the right call, and it is `nlargest` underneath
([06 · `Counter` top-N](../06-collections-module/03b-counter-top-n.md)):

```python
import heapq
from collections import Counter

scores = {"ana": 91, "bo": 78, "cy": 88, "dee": 95}

best_three_names = heapq.nlargest(3, scores, key=scores.get)         # keys ranked by value
best_three_pairs = heapq.nlargest(3, scores.items(), key=lambda kv: kv[1])

page_views = Counter({"/home": 1203, "/pricing": 388, "/docs": 941})
top_pages = page_views.most_common(2)             # heapq.nlargest(2, items, key=count)
```

## Top-N per group, in one pass

"The three most expensive orders per customer" over a stream: keep one bounded min-heap per
group and apply the streaming rule from [02](02-push-pop-replace-pushpop.md) to each. Every entry
needs a tie-break so two orders with the same total never compare their payloads:

```python
import heapq
from collections import defaultdict
from collections.abc import Iterable

def top_orders_per_customer(
    orders: Iterable[tuple[str, float, str]], k: int = 3
) -> dict[str, list[tuple[float, str]]]:
    heaps: defaultdict[str, list[tuple[float, str]]] = defaultdict(list)
    for customer_id, total, order_id in orders:
        heap = heaps[customer_id]
        entry = (total, order_id)             # order_id is unique: it breaks ties
        if len(heap) < k:
            heapq.heappush(heap, entry)
        else:
            heapq.heappushpop(heap, entry)
    return {c: sorted(h, reverse=True) for c, h in heaps.items()}
```

Memory is O(groups × K). With a handful of groups that is nothing; with one group per user of a
consumer product it is a heap per user held in one process — and the question has become an
aggregation the database should be doing.

## When the rows are in a database

`heapq.nlargest(10, cursor.fetchall(), key=...)` ships every row across the network, builds a
Python object for each, and then discards all but ten. The database can answer the same question
reading only the ten rows it returns, if an index on the ranking column exists — a B-tree index
is already in sorted order, so `ORDER BY … LIMIT` walks it from one end and stops
([PostgreSQL — B-tree indexes](../../../../postgresql/pages/phase-10-indexes/02-btree.md)):

```sql
CREATE INDEX invoices_total_idx ON invoices (total DESC, id);

SELECT id, customer_id, total
FROM invoices
ORDER BY total DESC, id
LIMIT 10;
```

The `id` in both the index and the `ORDER BY` is the SQL form of the tie-break above: without
it, rows with equal totals come back in whatever order the plan produces, and a paginated
"next ten" can repeat or skip them. Use `nlargest` for data that is already in the process — a
log you are streaming, results merged from several services, a computed score the database
cannot see.

## Gotchas

### `heapq.nlargest(3, scores)` on a dict
**Symptom.** The "top three players" are `zoe`, `yusuf` and `xavier` — the alphabetically last
names, with middling scores.
**Cause.** Iterating a dict yields keys; with no key function the keys are what gets ranked.
**Fix.** `heapq.nlargest(3, scores, key=scores.get)` for names, or rank `scores.items()` with a
key on the value.

### The tied item in a top-N changes between deploys
**Symptom.** A "featured sellers" list flips between two sellers with identical ratings after
each restart; nothing in the data changed.
**Cause.** Ties go to the first element encountered, and the input was a set of strings (hash
order varies per process) or rows fetched without `ORDER BY`.
**Fix.** Put a total tie-break into the key:

```python
featured = heapq.nsmallest(10, sellers, key=lambda s: (-s.rating, s.seller_id))
```

### `TypeError` ranking dicts or model objects without a key
**Symptom.** `TypeError: '<' not supported between instances of 'dict' and 'dict'` from
`nlargest`.
**Cause.** Without `key=`, the elements are the comparison.
**Fix.** Always pass the field: `heapq.nlargest(5, invoices, key=itemgetter("total"))`. With a key,
the elements are never compared at all.

### Descending score, ascending name — with `nlargest`
**Symptom.** Tied scores list their names Z to A.
**Cause.** `nlargest` reverses the entire key, secondary fields included.
**Fix.** Negate the numeric field and use `nsmallest`:

```python
leaderboard = heapq.nsmallest(20, players, key=lambda p: (-p.score, p.name))
```

### Negating a key that is not a number
**Symptom.** `TypeError: bad operand type for unary -: 'str'` when trying the trick above on a
string or date primary field.
**Cause.** Only numbers negate.
**Fix.** Two stable sorts — secondary field first, then the primary with `reverse=True`; the
second sort keeps the first sort's order among its ties. The general technique is **10 ·
Sorting compound data** *(not written yet)*:

```python
articles.sort(key=lambda a: a.title)                        # secondary: A to Z
articles.sort(key=lambda a: a.published_on, reverse=True)   # primary: newest first
latest_twenty = articles[:20]
```

### Per-group heaps for an unbounded number of groups
**Symptom.** A worker computing "top 10 events per user" grows until it is killed.
**Cause.** One K-entry heap per distinct user, all alive until the stream ends.
**Fix.** Bound the groups (per time window, per shard), or push the ranking into the store with a
window function over a partition and keep Python for the final page:

```sql
SELECT user_id, event_id, score
FROM (
    SELECT user_id, event_id, score,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY score DESC, event_id) AS rn
    FROM events
) ranked
WHERE rn <= 10;
```

### Ranking a whole table in Python
**Symptom.** A dashboard's "largest invoices" panel is the slowest query on the page, and the
database reports a full-table read for it.
**Cause.** `SELECT *` followed by `nlargest` in the application.
**Fix.** `ORDER BY total DESC, id LIMIT 10` with a matching index, as above.

## Interview questions

**★ Which of several equal elements does `heapq.nlargest` return?**
The ones encountered first, in their arrival order — the same answer `sorted(..., reverse=True)[:n]`
would give, because the functions are documented as equivalent to that expression and each heap
entry carries its arrival index. The corollary is that ties are only as deterministic as the
input order: a set, an unordered query or concurrently gathered results make them vary. If ties
matter, add an explicit tie-break to the key.

**★ How would you compute the top three orders per customer from a stream, in one pass?**
Keep a dictionary of bounded min-heaps, one per customer. For each order push until that
customer's heap holds three, then `heappushpop`, which evicts the weakest only if the new order
beats it. Include a unique field such as the order ID after the total so equal totals never fall
through to comparing payloads. Memory is proportional to customers times three, which is the
point at which to ask whether the database should be doing it.

**★ Why is `ORDER BY total DESC LIMIT 10` better than `nlargest` over the fetched rows?**
Because it moves the work to where the data and the index are. With a B-tree index on `total`,
the database reads ten entries from one end of an already-sorted structure and returns ten rows;
fetching everything and ranking in Python transfers and materialises every row to keep ten. Add
a unique column to the ordering so ties, and pagination over them, are stable.

**Why does `nlargest` with a `key` never compare the elements themselves?**
Each entry is `(key(elem), index, elem)`, and the index is unique, so any two entries are ordered
by their first two fields before the third is reached. That is also why a key-based top-N is
safe over dicts or objects with no ordering, while the key-less form compares the elements
directly.

**How many times does `nlargest` call the key function?**
Once per element of the input. The key is computed as each element is read and stored in the
entry; the heap and the final sort compare stored keys. That is different from `bisect`, whose
search functions recompute the key for every element they probe.

**How do you rank by score descending and name ascending in a single call?**
`heapq.nsmallest(k, rows, key=lambda r: (-r.score, r.name))`. Negating the score turns
"largest" into "smallest", so the name can stay in natural ascending order. It only works when
the primary field is numeric.

---

← Prev: [03 · `nlargest` and `nsmallest`](03-nlargest-and-nsmallest.md) · [Topic index](README.md) · Next → [04 · Max-heaps in 3.14](04-max-heaps.md)
