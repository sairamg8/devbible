---
title: "An `in` test against a 50,000-element list inside a loop is the most common accidental O(n·m) in a Python service — build the set once, outside the loop, and the same line costs one hash per iteration; build it inside the loop and you have made it worse"
sidebar_label: "2 · The membership test in a loop"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html)
> (`x in l`, `x in s`), [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects);
> the language reference — [membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations);
> and CPython v3.14.7 [`Python/flowgraph.c`](https://github.com/python/cpython/blob/v3.14.7/Python/flowgraph.c)
> (constant folding of literals in `in` tests) and [`Objects/dictobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c)
> (view membership) — implementation detail, marked where used. Documentation-verified — **no
> sandbox run, no timings**; every cost below is the documented complexity multiplied out.

**The documented cost of `x in some_list` is O(n) and the documented cost of `x in some_set` is
O(1). Inside a loop of *m* iterations that is the difference between O(n·m) and O(m), and it is the
single most common reason a batch job or an endpoint gets slower in proportion to the *product* of
two data sizes. The fix is one line — build a set from the list once, before the loop — and the
two ways to get it wrong are just as short: building the set *inside* the loop, which adds a full
hashing pass to every iteration, and converting without noticing that a set asks more of the values
than a list does. This page shows the bug, the fix, the anti-fix, and the preconditions.**

## The bug

A nightly job holds orders from customers on a block list. Fifty thousand blocked customers, two
hundred thousand orders:

```python
def orders_to_hold(orders, blocked_rows):
    blocked_customer_ids = [row["customer_id"] for row in blocked_rows]     # a list
    held = []
    for order in orders:
        if order["customer_id"] in blocked_customer_ids:                    # 🔴 a scan
            held.append(order)
    return held
```

The cost table gives `x in l` as O(n). The reference says what that scan is:

> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the
> expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."* —
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)

`any` stops at the first match, so a *hit* costs, on average, half the list — and a *miss* costs
all of it. Most orders are not from blocked customers, so most iterations are misses: 200,000 orders
× 50,000 comparisons each is up to ten billion element comparisons in the worst case. Nothing is
wrong with the result; the job is simply proportional to *orders × blocked customers*, and both
numbers grow.

## The fix

```python
def orders_to_hold(orders, blocked_rows):
    blocked_customer_ids = {row["customer_id"] for row in blocked_rows}     # built once
    return [order for order in orders if order["customer_id"] in blocked_customer_ids]
```

Building the set is one pass over 50,000 rows — one hash each. Every test after that is O(1) on
average: one hash of the probe and, typically, no equality call at all
([1](01-the-hash-table-underneath.md)). The job is now proportional to *orders + blocked
customers*.

## The anti-fix

```python
def orders_to_hold(orders, blocked_customer_ids):
    held = []
    for order in orders:
        if order["customer_id"] in set(blocked_customer_ids):     # 🔴 rebuilt every iteration
            held.append(order)
    return held
```

This is *worse* than the list. `set(list)` iterates and hashes all 50,000 elements and allocates a
table, on every iteration, before the O(1) lookup even starts; the list version at least stopped
early on a hit. The same mistake hides in comprehensions and helper calls:

```python
held = [o for o in orders if o["customer_id"] in {r["customer_id"] for r in blocked_rows}]  # 🔴

def is_blocked(customer_id, blocked_rows):
    return customer_id in {r["customer_id"] for r in blocked_rows}        # 🔴 per call
```

A comprehension's condition runs once per element, and a helper's body runs once per call. The set
has to be built where the *data* is loaded, not where the *question* is asked.

## When the list is fine

- **A handful of constants.** `status in ("paid", "refunded")` scans two elements. There is nothing
  to optimise. In CPython 3.14.7 the compiler goes further (implementation detail): its optimiser
  turns a literal set of constants used directly in `in` or `not in` into a constant `frozenset`,
  and a literal list of constants into a constant tuple — `Python/flowgraph.c` says *"Change literal
  list or set of constants into constant tuple or frozenset respectively"*. So
  `method in {"GET", "HEAD", "OPTIONS"}` builds nothing at run time. A display of *names*,
  `x in {a, b}`, is rebuilt on every evaluation; and that pass skips literals longer than 30
  items, so a long allowlist belongs in a module-level `frozenset` regardless.
- **One question.** Testing one value against a list once costs one scan; converting the list to a
  set first costs a full hashing pass plus a table, then the lookup. The set pays off from the
  second lookup onwards, not the first.
- **You already have a dict.** `x in d` and `x in d.keys()` are hash lookups. If blocked customers
  are already loaded into a dict keyed by ID, that dict *is* the membership structure.

## What changes when a list test becomes a set test

The documented answer is the same — identity or equality — but a set adds preconditions a list
never had:

1. **The probe must be hashable.** `["a"] in ["x", "y"]` is `False`; `["a"] in {"x", "y"}` raises
   `TypeError: cannot use 'list' as a set element (unhashable type: 'list')` in 3.14. A value that
   came from JSON can be a list or a dict.
2. **Every element must be hashable.** Building the set from rows that are dicts fails at
   construction ([1b](01b-what-the-table-costs-you.md)).
3. **Equality must agree with the hash.** A list compares every element with `==`; a set only
   compares elements whose hash matches. Two values that compare equal but hash differently — a
   broken custom `__hash__` — are found by the list and missed by the set.
4. **Nothing about types is fixed.** `"4812" in {4812}` is `False`, exactly as `"4812" in [4812]`
   was. The conversion does not repair a type mismatch between the probe and the data; normalise at
   the boundary (**14b** *(not written yet)*).

## The same bug in other clothes

```python
# 1. membership by attribute: a generator scan per order — still O(n·m)
held = [o for o in orders if any(c.id == o["customer_id"] for c in blocked_customers)]
blocked_ids = {c.id for c in blocked_customers}                       # fix

# 2. membership in dict values: a values view has no __contains__, so `in` iterates it
if email in emails_by_user_id.values():                                # scan
    notify_duplicate(email)
known_emails = set(emails_by_user_id.values())                         # fix, if hashable

# 3. list.index / list.count used as a membership test inside a loop
positions = {sku: i for i, sku in enumerate(catalogue_skus)}           # fix: one dict

# 4. dedupe with a list: `if x not in seen: seen.append(x)` — see 4b
```

The dict views quote explains the second one: *"Values views are not treated as set-like since the
entries are generally not unique."* In CPython 3.14.7 the keys view has a hash-based
`__contains__` and the values view has none, so membership in `d.values()` falls back to iterating.

## Gotchas

**★ Symptom: a batch job's run time grows with the product of two input sizes — double the orders
and double the blocked customers, and it takes four times as long.** Cause: `in` against a list
inside the loop; each miss scans the whole list. Fix: build a set once, before the loop.

```python
blocked_customer_ids = {row["customer_id"] for row in blocked_rows}
held = [o for o in orders if o["customer_id"] in blocked_customer_ids]
```

**★ Symptom: "optimising" the membership test with `set(...)` made the job slower.** Cause: the
set was built inside the loop, so every iteration hashes the entire collection. Fix: hoist the
construction to where the data is loaded; pass the set, not the rows, to helpers.

```python
def load_blocklist(rows) -> frozenset:
    return frozenset(row["customer_id"] for row in rows)

def is_blocked(customer_id, blocklist: frozenset) -> bool:
    return customer_id in blocklist
```

**★ Symptom: after switching to a set, an endpoint returns 500 for some requests with `TypeError:
cannot use 'list' as a set element (unhashable type: 'list')`.** Cause: a client sent a list (or an
object) where a string was expected; the list-based `in` had quietly returned `False`, the set
cannot hash the probe. Fix: validate the type at the boundary, before the membership test.

```python
def is_allowed_region(value, allowed: frozenset) -> bool:
    if not isinstance(value, str):
        raise ValueError(f"region must be a string, got {type(value).__name__}")
    return value in allowed
```

**★ Symptom: a duplicate-email check in a signup loop is slow even though the users are in a
dict.** Cause: `email in users_by_id.values()` iterates every value — values views are not
set-like. Fix: keep a set (or a dict) keyed by the thing you look up.

```python
known_emails = {user.email.casefold() for user in users_by_id.values()}
is_duplicate = candidate.casefold() in known_emails
```

**Symptom: nothing is ever held, although blocked customers certainly placed orders.** Cause: the
block list came from the database as `int` and the order payload carries `customer_id` as a JSON
string; `"4812" in {4812}` is `False` for a set exactly as for a list. Fix: normalise once, at the
boundary, to the type the data store uses.

```python
blocked_customer_ids = {int(row["customer_id"]) for row in blocked_rows}
held = [o for o in orders if int(o["customer_id"]) in blocked_customer_ids]
```

**Symptom: a helper `is_valid(code)` is called a million times and profiles as a set
construction.** Cause: the allowlist is written as a display of *names* inside the function,
`code in {PRIMARY, SECONDARY, FALLBACK}`, which is rebuilt per call; only a display of *constants*
is folded into a frozenset by the compiler. Fix: a module-level `frozenset`.

```python
VALID_CODES = frozenset({PRIMARY, SECONDARY, FALLBACK})

def is_valid(code):
    return code in VALID_CODES
```

**Symptom: `any(c.id == customer_id for c in blocked_customers)` in a loop is as slow as the list
version.** Cause: it is the list version — a generator scan per iteration. Fix: project the
attribute into a set once.

```python
blocked_ids = {c.id for c in blocked_customers}
```

## Interview questions

**★ Why is `x in some_list` O(n) and `x in some_set` O(1)?**
Because they do different work to reach the same documented answer. A list evaluates
`any(x is e or x == e for e in y)` literally — it walks the elements and compares, stopping at the
first match, so a miss visits everything. A set hashes `x`, jumps to the slot the hash selects and
compares only against elements whose stored hash matches, so the number of elements examined does
not grow with the set's size. The O(1) is an average over well-behaved hashes; the O(n) is exact
for a miss.

**★ A colleague replaced `if x in items` with `if x in set(items)` inside a loop and the code got
slower. Why?**
`set(items)` costs a full pass over `items` — one hash per element plus allocating and filling a
table — and it now runs on every iteration. The list version was O(n) per iteration too, but it
stopped early on hits and allocated nothing. The optimisation only works when the set is built once
and reused across lookups; a set used for a single lookup is strictly more work than the scan it
replaced.

**When is keeping a list or tuple the right choice for membership?**
When it is tiny and constant — a status in two or three literal values — where a scan is trivially
cheap and CPython even compiles a literal of constants in an `in` test into a constant tuple or
frozenset. When you test once and throw the collection away, because building a set costs more
than one scan. And when the values are unhashable, where a set is not an option without first
projecting them to a hashable key. For repeated lookups against anything that grows with the data,
a set or dict.

**Does `if method in {"GET", "HEAD"}` build a new set on every call?**
Not in CPython 3.14. The optimiser recognises a literal set of constants used directly as the right
operand of `in` and replaces it with a constant `frozenset` stored with the function's code. That
is an implementation detail, and it does not apply to a display containing names or to very long
literals — which is why a module-level `frozenset` constant is still the idiom for allowlists that
matter.

**What changes semantically when you convert a list membership test to a set?**
The probe and the elements must be hashable, so a list- or dict-valued input that used to return
`False` now raises `TypeError`. Equality has to agree with hashing, so a custom type whose `__eq__`
and `__hash__` disagree can be found by the list and not by the set. What does not change is the
comparison itself: a string ID never equals an integer ID in either container, so the conversion
neither causes nor fixes a type mismatch.

**Why is the miss the worst case for a list and not for a set?**
A list cannot know an element is absent until it has compared against every element; the scan stops
early only on a hit. A set knows an element is absent as soon as its probe reaches an empty slot,
which on a table kept under about 60% full happens after a short probe on average. The CPython
source says the set is deliberately tuned for *"both the found and not-found case"*, because
membership tests are the use case where absence is common.

---

← Prev: [A table that never shrinks](01d-a-table-that-never-shrinks.md) · [Topic index](README.md) · Next → [Set algebra instead of nested loops](03-set-algebra-instead-of-nested-loops.md)
