---
title: "Counter's operators are multiset arithmetic, not dict arithmetic — + and - drop every result that is zero or less, & and | take the min and max, <= asks whether one multiset fits inside another, and the in-place forms quietly delete zero counts you never touched"
sidebar_label: "03c · Counter — multiset arithmetic"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#counter-objects) (the multiset-operations paragraph and doctest, unary operators, rich comparisons, the type-restrictions note). Operator bodies read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (lines 766–991) — implementation detail where the docs are silent. Target: **Python 3.14.7**. **No sandbox run.**

**A Counter is a multiset, and its operators implement multiset algebra: `c + d` adds counts, `c - d` subtracts them, `c & d` takes the minimum of each count, `c | d` the maximum, and `c <= d` asks whether every count in `c` fits within `d`. The rule that makes them surprising is stated once in the documentation and applies to all of them: *"the output will exclude results with counts of zero or less."* So `stock - order` cannot tell you an item is overdrawn — the negative result is dropped — while `stock.subtract(order)` can. The in-place forms apply the same rule to the *whole* left-hand counter, so `stock -= order` also deletes every SKU that was sitting at zero before the operation began. And the operators require a `Counter` on the right, except for the in-place ones, which accept any mapping. Used deliberately, these are the shortest correct way to write fulfilment checks, list diffs with duplicates, and anagram tests.**

## The five binary operators

> *"Several mathematical operations are provided for combining `Counter` objects to produce
> multisets (counters that have counts greater than zero). Addition and subtraction combine
> counters by adding or subtracting the counts of corresponding elements. Intersection and union
> return the minimum and maximum of corresponding counts. Equality and inclusion compare
> corresponding counts. Each operation can accept inputs with signed counts, but the output will
> exclude results with counts of zero or less."*

The documentation's own doctest, with `c = Counter(a=3, b=1)` and `d = Counter(a=1, b=2)`:

| Expression | Meaning (doc comment) | Documented result |
|---|---|---|
| `c + d` | *"add two counters together: c[x] + d[x]"* | `Counter({'a': 4, 'b': 3})` |
| `c - d` | *"subtract (keeping only positive counts)"* | `Counter({'a': 2})` |
| `c & d` | *"intersection: min(c[x], d[x])"* | `Counter({'a': 1, 'b': 1})` |
| `c \| d` | *"union: max(c[x], d[x])"* | `Counter({'a': 3, 'b': 2})` |
| `c == d` | *"equality: c[x] == d[x]"* | `False` |
| `c <= d` | *"inclusion: c[x] &lt;= d[x]"* | `False` |

In `c - d`, `b` would be `1 - 2 = -1`; it is not in the result. Result order follows the 3.7 note — *"Results are ordered according to when an element is first encountered in the left operand and then by the order encountered in the right operand."*

**Unary `+` and `-`** — *"shortcuts for adding an empty counter or subtracting from an empty counter"*: with `c = Counter(a=2, b=-4)`, the documentation shows `+c` → `Counter({'a': 2})` and `-c` → `Counter({'b': 4})`. `+c` is the "strip zero and negative counts" idiom; `-c` turns *negative* counts into positive ones and drops the rest — exactly "what is overdrawn, and by how much".

## `-` versus `subtract()`: the one that hides the shortfall

```python
from collections import Counter

stock = Counter({"widget": 5, "gadget": 1})
order = Counter({"widget": 2, "gadget": 3})

stock - order                     # Counter({'widget': 3}) — gadget would be -2, so it is GONE

remaining = stock.copy()
remaining.subtract(order)         # Counter({'widget': 3, 'gadget': -2}) — the shortfall is visible
shortfall = -remaining            # Counter({'gadget': 2})
```

`-` answers "what is left of the multiset", where nothing can be less than zero. `subtract` answers "what is the balance", which can be. For fulfilment you usually want the question answered before anything changes:

```python
def can_fulfil(order: Counter[str], stock: Counter[str]) -> bool:
    return order <= stock                           # every requested count fits (3.10+)


def missing_for(order: Counter[str], stock: Counter[str]) -> Counter[str]:
    return order - stock                            # only what is short, positive counts
```

`order - stock` is the elegant one: elements where the order exceeds the stock, by how much, and nothing else.

## The in-place operators rewrite the whole counter

In `v3.14.7`, `__iadd__`, `__isub__`, `__ior__` and `__iand__` update `self` from `other` and then `return self._keep_positive()` — which is:

```python
# Lib/collections/__init__.py, v3.14.7 — Counter._keep_positive
nonpositive = [elem for elem, count in self.items() if not count > 0]
for elem in nonpositive:
    del self[elem]
return self
```

Every non-positive entry of `self` is deleted — not only the ones `other` touched. That is how the source comment's *"To strip negative and zero counts, add-in an empty counter: c += Counter()"* works, and it is a surprise when zero was deliberate:

```python
inventory = Counter({"widget": 4, "gadget": 0, "gizmo": 0})   # every SKU listed, even at zero
inventory -= Counter({"widget": 1})
inventory                          # Counter({'widget': 3}) — gadget and gizmo were deleted too
```

A report that lists `inventory` now omits the two out-of-stock SKUs it was built to show. For balances, use `subtract` and `update`, which never delete; use the operators when you want multiset semantics.

## Which operands are accepted

The binary operators and comparisons begin, in `v3.14.7`, with `if not isinstance(other, Counter): return NotImplemented`. The in-place operators do not check — they iterate `other.items()`. So:

```python
counts = Counter(a=1)

counts += {"a": 1}                 # works: __iadd__ just reads other.items()
counts + {"a": 1}                  # TypeError: dict has no + to fall back to
counts <= {"a": 3}                 # TypeError: dict defines no ordering either
counts | {"a": 5}                  # 🔴 no error — falls back to dict's |, returns a plain dict
counts == {"a": 2}                 # plain dict equality — see the dict-equality chunk
```

The `|` case is the dangerous one, because nothing raises: [20 · What a merge returns](../03-dict/07b-what-a-merge-returns.md) walks through it. Equality between a Counter and a dict falls back to dict equality, where zero counts matter — [24 · Dict equality](../03-dict/09c-dict-equality.md). The fix is the same everywhere: wrap the other side in `Counter(...)`.

## Inclusion is a partial order

> *"Counters support rich comparison operators for equality, subset, and superset relationships:
> `==`, `!=`, `<`, `<=`, `>`, `>=`. All of those tests treat missing elements as having zero
> counts so that `Counter(a=1) == Counter(a=1, b=0)` returns true."* (3.10)

`__le__` is `all(self[e] <= other[e] for c in (self, other) for e in c)`, and `__lt__` is `self <= other and self != other`. Two counters can each have something the other lacks, and then neither `<=` nor `>=` holds:

```python
morning = Counter(coffee=2, tea=1)
evening = Counter(coffee=1, wine=1)

morning <= evening, morning >= evening       # (False, False)
not (morning <= evening)                     # True — and yet `morning > evening` is False
```

This is the same partial order sets have ([3c · Set comparison is a partial order](../04-set-and-frozenset/03c-set-comparison-is-a-partial-order.md)); `max(counters)` or `sorted(counters)` over a list of Counters therefore does not produce a meaningful ranking.

## Three jobs these operators do in one line

**Diffing two lists that may contain duplicates** — the set difference loses multiplicity ([4 · Dedupe and what it destroys](../04-set-and-frozenset/04-dedupe-and-what-it-destroys.md)); the Counter difference keeps it:

```python
def diff_line_items(expected: list[str], actual: list[str]) -> tuple[Counter[str], Counter[str]]:
    want, got = Counter(expected), Counter(actual)
    return want - got, got - want           # (missing, unexpected), each with how many

missing, extra = diff_line_items(["sku-1", "sku-1", "sku-2"], ["sku-1", "sku-3"])
# missing: sku-1 ×1, sku-2 ×1 — extra: sku-3 ×1
```

**Anagram and permutation checks** — `Counter(a) == Counter(b)`, an O(*n*) comparison that does not sort.

**Merging independent samples by maximum** — `c | d` keeps, for each key, the larger count: the peak concurrent sessions per region across two monitoring hosts that each saw a subset, for example. `c + d` would double-count.

## Subclasses come back as `Counter`

Every binary and unary operator in `v3.14.7` builds its result with `result = Counter()` — the base class, not `type(self)`. A `class Inventory(Counter)` with extra methods gets a plain `Counter` back from `+`, `-`, `&`, `|`, `+x` and `-x`; the in-place forms keep the type because they return `self`. `copy()` does keep the type (`self.__class__(self)`). If a subclass must survive arithmetic, override the operators — or keep the behaviour in functions that take a Counter.

## Gotchas

**★ Symptom: an order is accepted although one item is out of stock — the check was `if stock - order:`.** Cause: `-` drops results of zero or less, so an overdrawn item simply disappears; any other item keeps the result truthy. Fix: test inclusion before touching the stock.

```python
if not order <= stock:
    raise OutOfStock(order - stock)
stock.subtract(order)
```

**★ Symptom: out-of-stock SKUs vanish from the inventory report after an unrelated sale.** Cause: `inventory -= sale` ends with `_keep_positive()`, deleting every non-positive entry in the whole counter. Fix: use `subtract` for balances, which never deletes.

```python
inventory.subtract(sale)
```

**★ Symptom: `counts + {"a": 1}` raises `TypeError`, although `counts += {"a": 1}` worked a line earlier.** Cause: binary operators return `NotImplemented` for a non-Counter and a plain dict has no `+`; the in-place operator reads `other.items()` without checking. Fix: make both sides Counters.

```python
merged = counts + Counter({"a": 1})
```

**★ Symptom: `stock_a | stock_b` returned a plain dict with lower counts.** Cause: one side was a plain dict, so `Counter.__or__` declined and dict's last-wins `|` ran. Fix: convert before combining — [20 · What a merge returns](../03-dict/07b-what-a-merge-returns.md).

```python
combined = Counter(stock_a) | Counter(stock_b)
```

**Symptom: `sorted(list_of_counters)` produces an order that makes no sense.** Cause: `<` between Counters is multiset inclusion, a partial order, so most pairs compare `False` both ways and the sort's result is arbitrary. Fix: sort by a number you choose.

```python
ranked = sorted(list_of_counters, key=Counter.total, reverse=True)
```

**Symptom: `TypeError: '<=' not supported between instances of 'Counter' and 'dict'`.** Cause: inclusion is defined only between Counters; `dict` has no ordering to fall back to. Fix: wrap the dict. *(Message format from `Objects/object.c` at `v3.14.7`: `"'%s' not supported between instances of '%.100s' and '%.100s'"`.)*

```python
fits = order <= Counter(stock_dict)
```

**Symptom: an `Inventory(Counter)` subclass loses its methods after `a + b`.** Cause: the operators construct `Counter()`, not `type(self)()`. Fix: re-wrap, or override the operator.

```python
class Inventory(Counter):
    def __add__(self, other: object) -> "Inventory":
        result = super().__add__(other)
        return result if result is NotImplemented else Inventory(result)
```

**Symptom: a total built with `sum(daily, Counter())` differs from one built with `update` when some days had corrections (negative counts).** Cause: `+` drops non-positive results at every step; `update` keeps signed counts. Fix: pick the semantics on purpose — `update` for balances.

```python
total = Counter()
for day in daily:
    total.update(day)
```

## Interview questions

**★ What is the difference between `c - d` and `c.subtract(d)`?**
`c - d` is multiset difference: a new Counter with `c[x] - d[x]` for each element, keeping only positive results, so anything that would go to zero or below disappears. `c.subtract(d)` mutates `c`, subtracts every count and keeps zero and negative results — *"Both inputs and outputs may be zero or negative."* Use `-` for "what remains of this multiset" and "what is missing" (`order - stock`); use `subtract` for running balances where a negative value is information.

**★ How would you check that a warehouse can fulfil an order?**
Represent both as Counters and use inclusion: `order <= stock` is true when every requested count is at most the stocked count, with missing elements treated as zero (3.10+). If it is false, `order - stock` gives exactly the short items and quantities. Then apply the order with `stock.subtract(order)` — not `stock -= order`, which would also delete every zero-stock SKU from the counter.

**★ Why do `+`, `-`, `&` and `|` drop zero and negative counts?**
Because they are defined as multiset operations, and a multiset has no notion of a zero or negative multiplicity: the documentation says the operations *"produce multisets (counters that have counts greater than zero)"* and *"the output will exclude results with counts of zero or less."* The source comment adds that when all multiplicities are zero or one, the operations are exactly the corresponding set operations. Counter's other methods — `update`, `subtract`, `c[k] -= 1` — are the signed, balance-style interface.

**Why does `counter += {"x": 1}` work while `counter + {"x": 1}` raises?**
The binary operators start with `if not isinstance(other, Counter): return NotImplemented`, and Python then tries the dict's reflected operator — `dict` has no `+`, so `TypeError`. The in-place `__iadd__` has no such check; it iterates `other.items()` and adds, so any mapping works. `|` is the nasty variant: `dict` *does* have `|`, so `counter | {"x": 1}` silently returns a last-wins plain dict.

**Is `<=` on Counters a total order?**
No, it is a partial order — multiset inclusion. `Counter(coffee=2, tea=1)` and `Counter(coffee=1, wine=1)` each contain something the other does not, so neither `<=` nor `>=` holds, and `not (a <= b)` does not imply `a > b`. That makes Counters unsuitable as sort keys; sort a list of Counters by `total()` or another scalar.

**★ Can a ransom note be built from the letters of a magazine?**
`Counter(note) <= Counter(magazine)` — multiset inclusion: every letter the note needs appears in the magazine at least as many times (3.10+). If you also want what is missing, `Counter(note) - Counter(magazine)` is exactly the letters short, with how many. It is O(*n* + *m*) and says in one expression what a loop with a dict of counts and early exits says in ten lines — the same shape as "does the warehouse have enough stock for this order".

**In what order are the elements of `c + d` or `c | d`?**
The 3.7 note in the documentation: *"Results are ordered according to when an element is first encountered in the left operand and then by the order encountered in the right operand."* The operators iterate `self` first and then `other`, inserting into a fresh Counter, so the left operand's order wins for shared keys and new keys from the right come after. The `repr` does not show this — it sorts by count — so check `list(result)` if order matters.

**How do you diff two lists that may contain duplicates?**
`Counter(expected) - Counter(actual)` gives what is missing with multiplicity, and `Counter(actual) - Counter(expected)` what is extra. A set difference cannot do this, because converting to a set discards how many times each element appeared. `Counter(a) == Counter(b)` is the equality form — the multiset (anagram) check.

---

← Prev: [03b · `Counter` — top-N and per-group tallies](03b-counter-top-n.md) · [Topic index](README.md) · Next → [04 · `deque` — the block list underneath](04-deque-the-block-list.md)
