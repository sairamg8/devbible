---
title: "Every restriction on a set — elements that must be hashable, no index, no order, and a stored hash the set never re-checks — is the lookup mechanism showing through, and 3.14 changed what the first of them looks like when it fails"
sidebar_label: "1b · What the table costs you"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [Time complexity](https://docs.python.org/3.14/library/time-complexity.html) (note 5),
> [`random.sample`](https://docs.python.org/3.14/library/random.html#random.sample);
> the language reference — [set types](https://docs.python.org/3.14/reference/datamodel.html#set-types)
> in the data model; the [glossary entry for *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable);
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html) (improved error
> messages); and CPython v3.14.7 [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c),
> [`Include/cpython/setobject.h`](https://github.com/python/cpython/blob/v3.14.7/Include/cpython/setobject.h),
> `Objects/object.c`, `Objects/abstract.c` and `Lib/random.py` for error text and for mechanism
> the documentation does not describe (marked as implementation detail). Documentation-verified —
> **no sandbox run, no program output**.

**The lookup in [1](01-the-hash-table-underneath.md) buys constant-time membership with three
concessions, and each one is a sentence you can derive from the mechanism rather than memorise.
The slot comes from the hash, so the hash must exist and must never change: elements must be
hashable. The slot is chosen by arithmetic, not by you, so "the third element" names nothing
stable: no index, no order. And the table keeps each element's hash beside it and trusts that
value for the element's whole stay: it never re-hashes, not when it grows and not when you copy
it. Python 3.14 also changed the message you get when the first concession is violated, which
matters to anything that matches on error text.**

## Why elements must be hashable

> *"An object is hashable if it has a hash value which never changes during its lifetime (it
> needs a `__hash__()` method), and can be compared to other objects (it needs an `__eq__()`
> method). Hashable objects which compare equal must have the same hash value."*

> *"Hashability makes an object usable as a dictionary key and a set member, because these data
> structures use the hash value internally."* —
> [glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable)

The data model applies the dict-key rules to set elements word for word:

> *"For set elements, the same immutability rules apply as for dictionary keys."* —
> [Set types](https://docs.python.org/3.14/reference/datamodel.html#set-types)

The argument for the rule — a mutable key would sit in a bucket chosen from a hash it no longer
has, where no lookup will ever look — is the design FAQ's, and it is worked through for tuples in
[tuple · 3 Hashability](../02-tuple/03-hashability.md). It transfers to set elements unchanged:
step 2 of the lookup computes the slot from the hash, so the hash must not change while the
element is stored. The built-in types enforce it by refusing to hash anything mutable:

> *"The `set` type is mutable --- the contents can be changed using methods like `add()` and
> `remove()`. Since it is mutable, it has no hash value and cannot be used as either a dictionary
> key or as an element of another set."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

That sentence is also why sets of sets need **`frozenset`** *(not written yet)*.

### What the failure looks like in 3.14

> *"Improved error message when trying to add an instance of an unhashable type to a `dict` or
> `set`."* — [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)

Its example, `s.add({'pages': 12, 'grade': 'A'})`, ends in
`TypeError: cannot use 'dict' as a set element (unhashable type: 'dict')`. The source is one
`PyErr_Format(PyExc_TypeError, "cannot use '%T' as a set element (%S)", key, exc)` in
`set_unhashable_type`, reached from the paths behind `add`, `in`, `remove`, `discard`, the
constructor, set displays and set comprehensions. `%T` is the element's own type — module-qualified
for your own classes, per the C API's *"fully qualified name"* rule — and `%S` is the original
error. So an element that is a *tuple holding a list* now reports both —
`cannot use 'tuple' as a set element (unhashable type: 'list')` — while a bare `hash()` call still
raises only the inner `unhashable type: 'list'` from `Objects/object.c`. The dict path has the
same wrapper with *as a dict key*.

Two consequences for code that already runs in production: log searches and alert rules keyed on
the string `unhashable type` still match, because the old text survives in the parentheses; tests
and handlers that anchored on the *start* of the message do not.

## Why there is no index and no order

A slot is chosen by the hash, and iteration walks the table from slot 0 upward. "The third
element" therefore means "whatever the hashes happened to put third", which changes as the table
grows. The data model states the consequence directly:

> *"These represent unordered, finite sets of unique, immutable objects. As such, they cannot be
> indexed by any subscript. However, they can be iterated over, and the built-in function `len()`
> returns the number of items in a set."* —
> [Set types](https://docs.python.org/3.14/reference/datamodel.html#set-types)

Subscripting raises the generic `'set' object is not subscriptable` from `Objects/abstract.c`.
Anything in the standard library that needs positions refuses a set for the same reason —
`random.sample` explicitly, since 3.11:

> *"The population must be a sequence. Automatic conversion of sets to lists is no longer
> supported."* — [`random.sample`](https://docs.python.org/3.14/library/random.html#random.sample)

What order you *do* see when you iterate, and why it differs between runs, is
**8** *(not written yet)*.

## The table remembers each element's hash

Each slot is two words — CPython v3.14.7 `Include/cpython/setobject.h`:

```c
typedef struct {
    PyObject *key;
    Py_hash_t hash;             /* Cached hash code of the key */
} setentry;
```

Storing the hash beside the reference buys three things, all implementation details:

- **Cheap rejection.** A lookup compares two integers before it considers calling `__eq__`.
- **Resizing never calls `__hash__`.** When the table grows, elements are re-placed using the
  stored hash. Building a set from another set or from a dict copies the stored hashes too
  (`set_merge` copies each entry's hash; the dict path reads the dict's stored hashes); only an
  arbitrary iterable — a list, a generator — is hashed element by element.
- **The set never notices a hash change.** If an element's hash changes after insertion, the stale
  value stays in the slot — and, by the previous bullet, travels with the element into any set
  built from this one. That is harmless for built-in immutable types and the whole problem in
  **10** *(not written yet)*.

`len(s)` is not counted either: *"The number of elements is stored in the object, so `len()`
does not need to count them."* ([Time complexity](https://docs.python.org/3.14/library/time-complexity.html),
note 5).

## Gotchas

**★ Symptom: `TypeError: 'set' object is not subscriptable` on `roles[0]`.** Cause: a set has no
positions — the data model says sets *"cannot be indexed by any subscript"*. Code that wanted
"the first role" wanted a rule, and the set cannot supply one. Fix: say which element you mean.

```python
primary_role = min(user_roles)            # deterministic: the smallest
some_role = next(iter(user_roles))        # any one; which one is unspecified
ordered_roles = sorted(user_roles)        # a list, when positions really matter
```

**★ Symptom: `TypeError: cannot use 'dict' as a set element (unhashable type: 'dict')` while
de-duplicating rows parsed from JSON.** Cause: a `dict` is mutable, so it has no hash, and a set
cannot compute a slot for it. Fix: put a hashable projection of the row in the set, not the row.

```python
def unique_rows_by_id(rows):
    seen_ids = set()
    unique = []
    for row in rows:
        if row["id"] not in seen_ids:
            seen_ids.add(row["id"])
            unique.append(row)          # first row per id wins, input order kept
    return unique
```

**★ Symptom: a test that passed on 3.13 fails on 3.14 with an assertion about the error message.**
Cause: the test anchored a regex on the old text (`^unhashable type`); since 3.14 the message for
set and dict operations starts `cannot use '…' as a set element`, with the old text in
parentheses. Fix: match the part that is still present, unanchored — `assertRaisesRegex` uses
`re.search`.

```python
import unittest

def build_tag_index(tags):
    return set(tags)

class TagIndexTests(unittest.TestCase):
    def test_rejects_unhashable_tags(self):
        with self.assertRaisesRegex(TypeError, r"unhashable type: 'list'"):
            build_tag_index([["red", "blue"]])
```

**Symptom: `random.choice(allowed_regions)` raises `TypeError: 'set' object is not subscriptable`,
and `random.sample(allowed_regions, 2)` raises `Population must be a sequence.  For dicts or sets,
use sorted(d).`** Cause: both need positions — `choice` indexes after checking `len()` (`Lib/random.py`),
and `sample` has refused non-sequences since 3.11. Fix: give them a sequence, sorted so a seeded
generator stays reproducible.

```python
import random

regions = sorted(allowed_regions)
canary_region = random.choice(regions)
rollout_wave = random.sample(regions, 2)
```

**Symptom: after fixing a bug that mutated elements in place, `pending = set(pending)` still cannot
find them.** Cause: copying a set copies each entry's *stored* hash, so a stale hash moves into the
new table with the element; nothing is re-hashed. Fix: rebuild from a non-set iterable, which
hashes every element afresh — and then stop mutating hashed fields (**10** *(not written yet)*).

```python
pending = set(list(pending))              # a list forces a fresh hash per element
```

## Interview questions

**★ Why must set elements be hashable, and why is a list not?**
Because the slot an element lives in is computed from its hash, and a later lookup has to compute
the same slot. If an element's hash could change while it was stored — which is what mutability
would allow for a list whose contents define its equality — the element would sit in a slot chosen
from an old hash, and lookups would start somewhere else. The data model applies *"the same
immutability rules … as for dictionary keys"*, and a list is unhashable for the same reason it
cannot be a dict key. The failure is loud on purpose: a `TypeError` on insertion beats an element
that is present but unfindable.

**★ What changed about the unhashable-element error in 3.14, and why should you care?**
Adding, testing or removing an unhashable value now raises `cannot use 'X' as a set element
(unhashable type: 'Y')` instead of the bare `unhashable type: 'Y'`, and the dict path says *as a
dict key*. The outer name is the value you passed; the inner one is the part that could not be
hashed — useful when a tuple or frozenset-like wrapper hides a list. It matters to anything that
parses messages: an unanchored search for `unhashable type` still matches, an anchored one or an
exact-equality assertion does not. And a bare `hash(x)` still produces only the old form, so the
two call sites now report differently.

**Why can't you index a set, and why is there no `s.sort()`?**
Position in a set is decided by the hash and the current table size, not by the order you added
elements, so an index would name nothing stable — it would change as the table grew. The data
model says sets *"cannot be indexed by any subscript"*; the library reference says they *"do not
record element position or order of insertion"*. Sorting is available as `sorted(s)`, which returns
a list — the type that does have positions.

**Why does CPython store each element's hash next to the element?**
So that lookups can reject most slots by comparing two integers instead of calling `__eq__`, and so
that resizing the table can re-place every element without calling `__hash__` again. The header
declares the field as *"Cached hash code of the key"*. The trade-off is that the set trusts that
value forever: an element whose hash changes after insertion is not re-filed, and copying the set
copies the stale value. That is why hashability demands a hash that *"never changes during its
lifetime"* rather than merely one that exists.

**Does `set(other_set)` call `__hash__` on the elements?**
Not in CPython 3.14.7. Building from another set or frozenset copies the stored hashes
(`set_merge`), and building from an exact dict reads the dict's stored hashes; only a general
iterable is hashed element by element. It is an implementation detail, but a useful one to know
twice over: copying a large set costs no hashing, and copying a set whose elements' hashes went
stale preserves the damage.

---

← Prev: [The hash table underneath](01-the-hash-table-underneath.md) · [Topic index](README.md) · Next → [What O(1) does not promise](01c-what-constant-time-does-not-promise.md)
