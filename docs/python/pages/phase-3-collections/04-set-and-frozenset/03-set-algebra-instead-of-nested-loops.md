---
title: "Every nested loop that asks \"which of these are also in that\" is a set operation in disguise — intersection, difference, union and symmetric difference replace O(n·m) comparisons with O(n + m) hashing, and the subset operators replace `all(x in b for x in a)`"
sidebar_label: "3 · Set algebra instead of nested loops"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset) (the
> operation table and the comparison paragraphs),
> [dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html);
> the language reference — [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons);
> and CPython v3.14.7 [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c)
> (`set_intersection`, `set_union`) for mechanism the documentation does not state — marked as
> implementation detail. Documentation-verified — **no sandbox run, no timings**.

**A nested loop that compares every element of one collection with every element of another is
almost always asking one of four questions: which elements are in both, which are in the first
but not the second, which are in either, which are in exactly one. Those are intersection,
difference, union and symmetric difference, and each is a single operator on two sets — `&`, `-`,
`|`, `^` — whose documented cost is linear in the sizes of the operands rather than their product.
Two more questions — *is every element of this in that?* and *do they share anything?* — are
`<=` and `isdisjoint`. The translation is mechanical once you see the shape, and the one trap in it
is that set comparison is a partial order, so the negation of a subset test is not the superset
test** — [3c](03c-set-comparison-is-a-partial-order.md).

## The four operations, as documented

| Operator | Method | Verbatim |
|---|---|---|
| `s \| t \| ...` | `s.union(*others)` | *"Return a new set with elements from the set and all others."* |
| `s & t & ...` | `s.intersection(*others)` | *"Return a new set with elements common to the set and all others."* |
| `s - t - ...` | `s.difference(*others)` | *"Return a new set with elements in the set that are not in the others."* |
| `s ^ t` | `s.symmetric_difference(other)` | *"Return a new set with elements in either the set or other but not both."* |
| `s <= t` | `s.issubset(other)` | *"Test whether every element in the set is in other."* |
| `s >= t` | `s.issuperset(other)` | *"Test whether every element in other is in the set."* |
| — | `s.isdisjoint(other)` | *"Return `True` if the set has no elements in common with other. Sets are disjoint if and only if their intersection is the empty set."* |

— [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset). Every
operation returns a *new* set; the in-place forms and the operator-versus-method rules are
[3b](03b-operators-versus-methods.md).

## Six nested loops and the operator each one was

**Which customers ordered in both months?** The loop version is worse than it looks — the
`not in both` check is a third scan inside the other two:

```python
def customers_active_both_months(january_orders, february_orders):
    both = []
    for jan in january_orders:
        for feb in february_orders:                                   # 🔴 n × m
            if jan["customer_id"] == feb["customer_id"] and jan["customer_id"] not in both:
                both.append(jan["customer_id"])
    return both


def customers_active_both_months(january_orders, february_orders):
    january = {order["customer_id"] for order in january_orders}
    february = {order["customer_id"] for order in february_orders}
    return january & february                                         # O(min(n, m))
```

**Who was invited but has not signed up?**

```python
def pending_invitations(invited_emails, registered_emails):
    return set(invited_emails) - set(registered_emails)
```

**Every distinct tag across a thousand posts** — the `if tag not in seen: seen.append(tag)` loop:

```python
def all_tags(posts):
    return set().union(*(post["tags"] for post in posts))   # methods take any iterable
```

**Which configuration keys exist in one environment only?** Dictionary key views are set-like, so
the dicts need no conversion:

```python
def config_drift(staging: dict, production: dict) -> set:
    return staging.keys() ^ production.keys()
```

> *"For set-like views, all of the operations defined for the abstract base class
> `collections.abc.Set` are available (for example, `==`, `<`, or `^`)."* —
> [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects)

**Does this user hold every required permission?** `all(p in granted for p in required)` is fine
when `granted` is a set — and a hidden nested loop when it is the list a JSON token decoded to:

```python
def has_all_permissions(required: frozenset, granted: frozenset) -> bool:
    return required <= granted
```

**Does a post carry any blocked tag?**

```python
def carries_blocked_tag(post_tags, blocked_tags: frozenset) -> bool:
    return not blocked_tags.isdisjoint(post_tags)     # stops at the first common tag
```

## What each operation costs

From the 3.14 cost table, for two sets: union O(len(s1) + len(s2)); intersection
O(min(len(s1), len(s2))); difference O(len(s1)); symmetric difference O(len(s1) + len(s2)). The
nested loops they replace were O(len(s1) × len(s2)). The notes in
[1d](01d-a-table-that-never-shrinks.md) apply: a non-set argument to a method costs its full
length, and a set that was once much larger costs its former size to walk.

Two of those figures have a mechanism worth knowing (CPython 3.14.7, implementation detail).
**Intersection** iterates whichever operand is smaller and probes the other, which is where
*min* comes from — `a & b` and `b & a` cost the same. **Difference** iterates the left operand and
probes the right, so it is proportional to the left side only; `huge - tiny` is expensive and
`tiny - huge` is cheap, although they answer different questions.

## Many operands at once

Chained operators build an intermediate set per operator: `a | b | c | d` makes three sets and
keeps one. The method forms take any number of arguments and build one result:

```python
def reachable_regions(primary, failover, burst, edge):
    return primary.union(failover, burst, edge)      # one result set, any iterables
```

Intersection across a variable number of groups — *users who have every one of these tags* — needs
care, because `set.intersection(*groups)` calls the method on the first group and fails when there
is none:

```python
def users_with_all_tags(tags, users_by_tag: dict) -> set:
    """Intersect the per-tag user sets, smallest first; an empty tag list matches nobody."""
    groups = sorted((users_by_tag.get(tag, set()) for tag in tags), key=len)
    if not groups:
        return set()
    return groups[0].intersection(*groups[1:])
```

Sorting by size is not needed for correctness — CPython already iterates the smaller operand of
each pairwise intersection — but starting from the smallest group makes the running result small
immediately, and an empty group short-circuits the rest to an empty result.

## When the loop joins on a key, not on equality

Real nested loops usually compare a *field* of two record lists. Project the field into sets, do
the algebra on the keys, and map back through dicts:

```python
def reconcile(invoices, payments):
    invoices_by_ref = {inv["reference"]: inv for inv in invoices}
    payments_by_ref = {pay["reference"]: pay for pay in payments}

    matched = invoices_by_ref.keys() & payments_by_ref.keys()
    unpaid = invoices_by_ref.keys() - payments_by_ref.keys()
    orphaned = payments_by_ref.keys() - invoices_by_ref.keys()

    pairs = [(invoices_by_ref[ref], payments_by_ref[ref]) for ref in sorted(matched)]
    return pairs, sorted(unpaid), sorted(orphaned)
```

Key views accept the operators directly and return plain sets. Two things the loop kept that this
drops: duplicate references (a dict comprehension keeps the *last* record per key), and the order
of the inputs — hence the `sorted` calls on everything that leaves the function
(**8** *(not written yet)*).

## Gotchas

**★ Symptom: a nightly report that matches two exports times out once both exports pass a few
hundred thousand rows.** Cause: a nested loop comparing every row of one with every row of the
other — O(n·m) — often with a list-based "already added" check inside. Fix: project to sets of keys
and intersect.

```python
january = {order["customer_id"] for order in january_orders}
february = {order["customer_id"] for order in february_orders}
repeat_customers = january & february
```

**★ Symptom: `set.intersection(*groups)` raises `TypeError` for a search with no filters, or for a
first group that is a list.** Cause: the unbound method needs its first argument to be the set it
is called on; with no groups there is none, and a list is not a set. Fix: convert, and decide what
an empty filter means.

```python
groups = [set(g) for g in groups]
common = groups[0].intersection(*groups[1:]) if groups else set()
```

**★ Symptom: a merged permission set is missing exactly the permissions both roles had.** Cause:
`^` is symmetric difference — *"either the set or other but not both"* — not union. Fix: `|` for
"either or both".

```python
effective = role_permissions | group_permissions
```

**Symptom: a sync job reports every existing row as "to delete" and nothing as "to create".**
Cause: the operands of `-` are swapped — difference is not symmetric. Fix: name the result after
the question, so the direction reads correctly.

```python
to_create = incoming_ids - existing_ids
to_delete = existing_ids - incoming_ids
```

**Symptom: a reconciliation reports fewer matched payments than there are payments.** Cause: the
dict comprehension that indexes payments by reference silently kept only the last payment for a
duplicated reference. Fix: detect duplicates before keying on a field you assumed was unique.

```python
from collections import Counter

duplicate_refs = [ref for ref, n in Counter(p["reference"] for p in payments).items() if n > 1]
if duplicate_refs:
    raise ValueError(f"duplicate payment references: {sorted(duplicate_refs)}")
```

## Interview questions

**★ Rewrite a nested loop that finds the elements two lists have in common. What are the
complexities before and after?**
Build a set from each list and intersect: `set(a) & set(b)`. The nested loop compares every pair,
O(len(a) × len(b)), and if it also de-duplicates with a list it adds another linear scan per match.
The set version costs one hash per element to build the two sets, O(len(a) + len(b)), plus an
intersection that is O(min(len(a), len(b))) on the 3.14 cost table. What you give up is order and
duplicates — the result is a set.

**★ How do you check that a user has all of a set of permissions? Any of them? None of them?**
All: `required <= granted` (or `required.issubset(granted)`). Any: `not required.isdisjoint(granted)`,
which stops at the first shared element. None: `required.isdisjoint(granted)`. Each reads as the
sentence it implements, and none of them is a nested loop. The one to avoid is deriving any of these
from the negation of another comparison, because set comparison is only a partial order.

**Why does `a & b` cost O(min(len(a), len(b))) rather than O(len(a) + len(b))?**
Because an intersection only needs to examine the elements of one operand: each element of the
smaller set is looked up in the larger one, at O(1) average per lookup, and the result can never be
larger than the smaller set. CPython swaps the operands internally so it always iterates the smaller
one. That holds when both operands are sets; with a non-set argument to `intersection()` the whole
iterable has to be read and hashed.

**Why is `a - b` O(len(a)) and not O(len(a) + len(b))?**
A difference keeps the elements of `a` that are not in `b`, so it iterates `a` and probes `b` —
nothing in `b` needs to be visited except through lookups. The table's note 9 raises it to
O(len(a) + len(b)) when `b` is not a set, because then `b` has to be read in full.

**When would you use symmetric difference?**
When the question is "what changed" without caring which side it changed on: configuration keys
present in one environment only, feature flags enabled in exactly one of two tenants, files in one
snapshot but not the other. In a sync job you usually want the two one-sided differences separately
instead, because *create* and *delete* are different actions — `a ^ b` equals `(a - b) | (b - a)`
and throws away which side each element came from.

---

← Prev: [The membership test in a loop](02-the-membership-test-in-a-loop.md) · [Topic index](README.md) · Next → [Set comparison is a partial order](03c-set-comparison-is-a-partial-order.md)
