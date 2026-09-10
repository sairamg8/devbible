---
title: "A `set` cannot be an element or a key because it is mutable, and `frozenset` is the same table made immutable and therefore hashable — the type you need for sets of sets, set-valued cache keys and undirected pairs, with a hash that ignores order, is computed once, and changes between processes"
sidebar_label: "5 · frozenset — hashable sets"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [time complexity](https://docs.python.org/3.14/library/time-complexity.html), the
> [glossary](https://docs.python.org/3.14/glossary.html#term-hashable),
> [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache)
> (its docstring in `Lib/functools.py`), the [3.14 What's New](https://docs.python.org/3.14/whatsnew/3.14.html)
> — and CPython v3.14.7 `Objects/setobject.c` and `Python/flowgraph.c`, marked *implementation
> detail* wherever the docs are silent. Documentation-verified — **no sandbox run, no program output**.

**Everything a set does depends on its elements' hashes never changing. A `set` can change, so it
has no hash — and therefore cannot be an element of another set or a key in a dict. `frozenset` is
the same hash table with the mutating methods removed, which is exactly what makes it hashable. It
is the answer to four recurring needs: a set of sets, a dict keyed by a combination, a cache keyed by
a set argument, and a pair whose order does not matter. Each comes with a trap: the hash ignores
order by design, is computed once, and — for strings — differs in every process.**

## Why a `set` cannot be an element or a key

> *"The `set` type is mutable — the contents can be changed using methods like `add()` and
> `remove()`. Since it is mutable, it has no hash value and cannot be used as either a dictionary
> key or as an element of another set. The `frozenset` type is immutable and hashable — its contents
> cannot be altered after it is created; it can therefore be used as a dictionary key or as an
> element of another set."*

> *"To represent sets of sets, the inner sets must be `frozenset` objects."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

The reason is the one [1b](01b-what-the-table-costs-you.md) gives for every element: the table
files an element under its hash and never re-hashes it. If a set could be an element and then grow,
the outer table would hold it under a hash that no longer matches its contents. On 3.14 the attempt
is reported with the new wrapper message — `cannot use 'set' as a set element (unhashable type:
'set')` for a set, `cannot use 'set' as a dict key (unhashable type: 'set')` for a key
(`Objects/setobject.c` and `Objects/dictobject.c` format strings; the change is listed under
*"Improved error message when trying to add an instance of an unhashable type to a `dict` or
`set`"* in [What's New](https://docs.python.org/3.14/whatsnew/3.14.html)).

## Making one

There is no literal. `frozenset(iterable)` is the only spelling, and `frozenset({"a", "b"})` builds a
temporary set to pass it — which is why a frozenset used as a constant belongs at module level, not
inside a hot function. The exception is the membership test on a literal: in 3.14.7 the compiler
turns `x in {"GET", "HEAD"}` into a test against a constant frozenset (`optimize_lists_and_sets`,
implementation detail), so that spelling costs nothing per call ([2](02-the-membership-test-in-a-loop.md)
has the details).

What a frozenset cannot do is listed once:

> *"A `frozenset` is immutable, so it does not support adding, discarding, or the in-place update
> operations. The others below apply to it at the same costs."* —
> [time complexity](https://docs.python.org/3.14/library/time-complexity.html)

One cost is lower. Footnote 6 of the same table: *"Copying a `frozenset` is O(1) as it returns the
original object."* In 3.14.7 `frozenset(fs)` of an exact frozenset also returns the same object
(`make_new_frozenset`: *"frozenset(f) is idempotent"*). A defensive copy of an immutable object is a
no-op, and there is no reason to test it with `is`.

## Every frozenset is hashable

The glossary puts frozensets beside tuples:

> *"Most of Python's immutable built-in objects are hashable; mutable containers (such as lists or
> dictionaries) are not; immutable containers (such as tuples and frozensets) are only hashable if
> their elements are hashable."* — [glossary](https://docs.python.org/3.14/glossary.html#term-hashable)

For a tuple that condition bites — `(1, [2])` is a tuple and is unhashable. For a frozenset it is
already met: its elements had to be hashable to get in. **Every frozenset that exists is hashable**,
and in 3.14.7 hashing it never calls an element's `__hash__` again — the hash is computed from the
per-slot stored hashes and then cached on the object (`frozenset_hash`, implementation detail).

The hash has to ignore order, because two frozensets with the same members are equal regardless of
how they were built, and equal objects must hash equal. CPython achieves that by combining the
element hashes with XOR, which is commutative; the source comment is *"xor is commutative and a
frozenset hash should be independent of order"*. The consequence you can rely on is the documented
one — equal frozensets hash equal — not the algorithm.

What you cannot rely on is the number. A frozenset of strings hashes through string hashes, and
those are salted per process ([1c](01c-what-constant-time-does-not-promise.md)).
`hash(frozenset(roles))` is a fine dict key inside one process and meaningless in a database, a cache server or
another worker. The general argument is [tuple · 3b](../02-tuple/03b-what-a-hash-value-is-not.md).
When a set must name something outside the process, derive a canonical, stable form:

```python
import hashlib

def stable_key(roles: frozenset[str]) -> str:
    canonical = "\x1f".join(sorted(roles))          # order-free, separator unlikely in a role name
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
```

## Four jobs only a hashable set can do

**A set of sets** — the distinct combinations present in the data:

```python
from collections import Counter

def flag_combinations(users: list[dict]) -> Counter[frozenset[str]]:
    return Counter(frozenset(user["flags"]) for user in users)   # one entry per distinct combination
```

**A dict keyed by a combination** — the policy for each role set, computed once:

```python
POLICIES: dict[frozenset[str], str] = {
    frozenset({"viewer"}): "read-only",
    frozenset({"viewer", "editor"}): "read-write",
    frozenset({"admin"}): "full",
}

def policy_for(roles: set[str]) -> str:
    return POLICIES.get(frozenset(roles), "none")    # convert the probe: a set cannot be looked up
```

**A cache keyed by a set argument.** `functools.lru_cache` keys its cache on the arguments, and its
docstring states the consequence: *"Arguments to the cached function must be hashable."* Take a
frozenset in the signature and convert at the call site:

```python
from functools import lru_cache

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "viewer": frozenset({"posts:read"}),
    "editor": frozenset({"posts:read", "posts:write"}),
}

@lru_cache(maxsize=1024)
def effective_permissions(roles: frozenset[str]) -> frozenset[str]:
    granted: set[str] = set()
    for role in roles:
        granted |= ROLE_PERMISSIONS.get(role, frozenset())
    return frozenset(granted)                          # immutable result: callers cannot poison the cache
```

Returning a frozenset matters as much as accepting one: a cached `set` is the same object handed to
every caller, and the first caller to `.add()` to it changes the answer for everyone after.

**An unordered pair.** An undirected edge between `a` and `b` is the same edge as between `b` and
`a`; `frozenset((a, b)) == frozenset((b, a))`, so it works as a key where a tuple would store the edge
twice:

```python
def edge_weights(pairs: list[tuple[str, str, float]]) -> dict[frozenset[str], float]:
    weights: dict[frozenset[str], float] = {}
    for a, b, w in pairs:
        edge = frozenset((a, b))
        weights[edge] = weights.get(edge, 0.0) + w
    return weights
```

A self-loop (`a == b`) becomes a one-element frozenset, so code that later does `u, v = edge` raises
`ValueError`. If self-loops are possible and you need both ends back, key on
`tuple(sorted((a, b)))` instead — still order-free, always two elements, but it needs orderable node
IDs.

## Looking up with a mutable set

The set type has one convenience for this situation, and the dict does not:

> *"Note, the elem argument to the `__contains__()`, `remove()`, and `discard()` methods may be a
> set. To support searching for an equivalent frozenset, a temporary one is created from elem."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

So `{"viewer"} in combinations` works when `combinations` is a set of frozensets, and
`combinations.discard({"viewer"})` removes the matching frozenset. `POLICIES[{"viewer"}]` and
`{"viewer"} in POLICIES` do not — a dict has no such rule, hashing the probe fails, and the lookup
raises `TypeError`. Convert the probe with `frozenset(...)`, as `policy_for` does. Equality
itself is not the obstacle: *"`set('abc') == frozenset('abc')` returns `True` and so does
`set('abc') in set([frozenset('abc')])`"*.

The mixed-type rules — which type `frozenset | set` returns, why a frozenset is not an instance of
`set`, and what a frozen dataclass does with a set field — continue in
[5b · frozenset beside set](05b-frozenset-beside-set.md).

## Gotchas

**★ Symptom: `TypeError: cannot use 'set' as a set element (unhashable type: 'set')` while collecting
the distinct combinations.** Cause: a set is mutable and has no hash; the documented rule is that
inner sets *"must be `frozenset` objects"*. Fix: freeze each inner set as it goes in —
`flag_combinations` above.

**★ Symptom: `TypeError` about an unhashable `set` from a function that just gained `@lru_cache`.**
Cause: the cache is keyed by the arguments, which *"must be hashable"*. Fix: accept a
`frozenset` and convert at the call site — `effective_permissions(frozenset(user.roles))` — and
return an immutable value so cached results cannot be mutated by a caller.

**★ Symptom: after a deploy, a cache keyed by `hash(frozenset(roles))` misses every time, or two
workers disagree about the key for the same roles.** Cause: string hashes — and therefore the hash
of a frozenset of strings — are salted per process. Fix: a canonical, stable key — `stable_key`
above.

**Symptom: `TypeError` from `POLICIES[current_roles]` although `current_roles == some_key` is
`True`.** Cause: the probe is a mutable `set`; the dict must hash it, and cannot. The temporary-
frozenset convenience exists only for a set's `__contains__`, `remove` and `discard`. Fix:
`POLICIES.get(frozenset(current_roles))`.

**Symptom: `ValueError: not enough values to unpack` when walking the edges of a graph keyed by
frozenset.** Cause: a self-loop's frozenset has one element. Fix: handle `len(edge) == 1`, or key on
`tuple(sorted((a, b)))` when node IDs are orderable.

**Symptom: one caller's permissions leak into another's.** Cause: a cached function returned a
mutable `set`, a caller added to it, and every later cache hit returned the modified object. Fix:
return a `frozenset` from cached functions.

**Symptom: a hot request handler spends measurable time in `frozenset()`.** Cause: a
`frozenset({...})` written inside the function is rebuilt on every call; only the membership-test
literal `x in {...}` is compiled to a constant. Fix: hoist the constant to module level.

```python
PRIVILEGED = frozenset({"admin", "owner"})

def is_privileged(roles: frozenset[str]) -> bool:
    return not PRIVILEGED.isdisjoint(roles)
```

## Interview questions

**★ Why can't a set contain another set, and what do you use instead?**
Set membership works by filing each element under its hash, and the table never re-hashes an
element after inserting it. A mutable set could change after insertion, so it would sit under a
stale hash; Python therefore gives `set` no hash at all. `frozenset` is immutable, so its hash can
be computed once and never goes stale — the docs say inner sets *"must be `frozenset` objects"*.

**★ How would you use a set of roles as a dictionary key or a cache key?**
Convert it to a `frozenset`: `policies[frozenset(roles)]`, and give cached functions `frozenset`
parameters so `lru_cache` — whose arguments *"must be hashable"* — can key on them. Equal
frozensets hash equal regardless of the order the roles were added, which is exactly the key
semantics you want. For a key that leaves the process, do not use `hash()`; build a sorted canonical
string and digest it, because string hashes are salted per process.

**Is every frozenset hashable? Is every tuple?**
Every frozenset is: its elements had to be hashable to be inserted, so the glossary's condition —
immutable containers are hashable *"only if their elements are hashable"* — is always met. A tuple
can hold anything, so `(1, [2])` is a tuple and is not hashable.

**Why must a frozenset's hash be independent of insertion order, and how does CPython achieve it?**
Because `frozenset([1, 2]) == frozenset([2, 1])`, and objects that compare equal must hash equal. In
3.14.7 the element hashes are mixed and combined with XOR, which is commutative, so any insertion
order gives the same result. The hash is computed once and cached, and it reuses the per-slot stored
hashes instead of calling each element's `__hash__` again.

**Why does `{"a"} in set_of_frozensets` work while `dict_with_frozenset_keys[{"a"}]` raises?**
The set type documents a special case: when the argument to `__contains__`, `remove` or `discard` is
a set, a temporary frozenset is created from it for the search. The dict has no such rule; it tries
to hash the probe, a `set` is unhashable, and the lookup raises `TypeError`.

---

← Prev: [Dedupe: equality and the container](04b-dedupe-equality-and-the-container.md) · [Topic index](README.md) · Next → [frozenset beside set](05b-frozenset-beside-set.md)
