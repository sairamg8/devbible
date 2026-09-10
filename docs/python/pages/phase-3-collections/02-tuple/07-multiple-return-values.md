---
title: "Returning a tuple is the right answer for two or three values whose order is obvious — and the wrong one the day a caller has to count commas, because a bare tuple has positions, not names"
sidebar_label: "7 · Multiple return values"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 design FAQ —
> [Why are there separate tuple and list data types?](https://docs.python.org/3.14/faq/design.html#why-are-there-separate-tuple-and-list-data-types);
> [Tuples](https://docs.python.org/3.14/library/stdtypes.html#tuple) in the library reference;
> the tutorial on [Tuples and Sequences](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences);
> [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache);
> [PEP 557 — *Why not just use namedtuple?*](https://peps.python.org/pep-0557/#why-not-just-use-namedtuple);
> and CPython 3.14 [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> for the unpacking error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**Python has no multiple return values. It has one return value that is very often a
tuple, built by the comma in `return a, b` and taken apart by the unpacking at the call
site. That is a record — a fixed number of positions, each with its own meaning — and the
design FAQ describes tuples in exactly those terms. The idiom is excellent while the record
is small and its order is self-evident, and it degrades in three predictable ways: two
fields of the same type get transposed, a new field breaks every caller, and a function
that sometimes returns `None` instead of the pair crashes at the unpack rather than where
the problem is. Each of those has a specific fix, and the biggest of them is a named
record.**

## A tuple is a record, and a list is an array

The design FAQ states the division of labour directly:

> *"Lists and tuples, while similar in many respects, are generally used in fundamentally
> different ways.  Tuples can be thought of as being similar to Pascal ``records`` or C
> ``structs``; they're small collections of related data which may be of different types
> which are operated on as a group.  For example, a Cartesian coordinate is appropriately
> represented as a tuple of two or three numbers."*

> *"Lists, on the other hand, are more like arrays in other languages.  They tend to hold a
> varying number of objects all of which have the same type and which are operated on
> one-by-one."* —
> [Why are there separate tuple and list data types?](https://docs.python.org/3.14/faq/design.html#why-are-there-separate-tuple-and-list-data-types)

The tutorial adds the access pattern that goes with each:

> *"Tuples are immutable, and usually contain a heterogeneous sequence of elements that are
> accessed via unpacking (see later in this section) or indexing (or even by attribute in
> the case of namedtuples). Lists are mutable, and their elements are usually homogeneous
> and are accessed by iterating over the list."* —
> [Tuples and Sequences](https://docs.python.org/3.14/tutorial/datastructures.html#tuples-and-sequences)

So the type you return is a message to the caller. A tuple says "this many values, in this
order, each meaning something different — unpack me". A list says "some number of the same
kind of thing — iterate me". A function returning `[host, port]` is sending the wrong
message: the caller cannot tell whether a third element might appear, and can `append` to
the result.

⚠️ The convention is not a law. The library reference also says tuples are used *"for cases
where an immutable sequence of homogeneous data is needed (such as allowing storage in a set
or dict instance)"* — `tuple(sorted(scopes))` as a cache key is homogeneous and still
correct. The record framing is about **returns and fixed shapes**; hashability is the other
legitimate reason to choose a tuple.

## `return a, b` is packing, and the caller unpacks

```python
def split_address(addr: str) -> tuple[str, int]:
    host, _, port = addr.rpartition(":")
    return host, int(port)             # the comma builds the tuple

host, port = split_address("db.internal:5432")   # unpacking checks the arity
```

`return host, int(port)` and `return (host, int(port))` are the same statement — the
parentheses are grouping, as [5](05-the-comma-makes-the-tuple.md) establishes — and the
caller's `host, port = …` is the sequence unpacking of [6](06-packing-and-unpacking.md). The
arity check is what makes this safe: if `split_address` ever returns three things, every
two-name call site raises `ValueError` with both numbers in the message.

Generators use the same shape for the same reason: `yield key, value` yields a 2-tuple, and
`for key, value in pairs()` unpacks it.

## Where the idiom breaks, and why each break is predictable

### 1 · Two positions of the same type get transposed

```python
def bounding_box(points) -> tuple[float, float, float, float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)

min_x, max_x, min_y, max_y = bounding_box(points)   # 🔴 wrong order, no error, ever
```

Four floats unpack into four names regardless of what the names mean. Unpacking checks
*count*, never *meaning*; nothing — not the interpreter, not a type checker looking at
`tuple[float, float, float, float]` — can tell that the second position is `min_y`. The
failure mode is a wrong answer, not an exception.

### 2 · Adding a field breaks every caller

The arity check that protects you is also what makes the return shape a hard API. PEP 557
used this exact case as an argument against `namedtuple` as a public return type:

> *"Instances are always iterable, which can make it difficult to add fields.  If a library
> defines: `Time = namedtuple('Time', ['hour', 'minute'])` … Then if a user uses this code
> as: `hour, minute = get_time()` then it would not be possible to add a second field to
> `Time` without breaking the user's code."* —
> [PEP 557](https://peps.python.org/pep-0557/#why-not-just-use-namedtuple)

(The PEP says "second"; it means one more field beyond the two.) 🔴 **Note what that
sentence implies: switching to a named tuple does not fix this.** A named tuple is still a
tuple, so every caller who unpacked it still breaks. Only a return type that cannot be
unpacked — a dataclass without `__iter__` — forces callers onto attribute access, which is
the one access pattern that survives a new field. The full comparison is
[8d · When a dataclass beats a 4-tuple](08d-when-a-dataclass-beats-a-tuple.md).

### 3 · The caller wants one field and has to count

```python
name, _, _, email, _, _ = load_user(uid)   # which underscore was the tier?
```

Past three positions, the call site stops documenting itself. The FAQ's own example of a
good tuple — *"a Cartesian coordinate … two or three numbers"* — is small for a reason.

### 4 · The shape depends on whether anything was found

The fourth break is the function that returns a pair on success and `None` on failure, which
fails at the unpack with a `TypeError` far from its cause; together with the related problem
of a cached function handing every caller the same result object, it is
[7b · Absence, errors and shared results](07b-absence-and-shared-results.md). How to annotate
all of these shapes — `tuple[str, int]` versus `tuple[str, ...]` versus a bare `tuple` — is
[7c · Annotating tuples](07c-annotating-tuples.md).

## Gotchas

**★ Symptom: map pins land in the ocean, off by the transposition of latitude and
longitude.** Cause: `return lat, lon` and `lon, lat = geocode(addr)` are both valid; two
floats unpack in either order. Fix: return a type whose fields have names and read them by
name.

```python
from typing import NamedTuple

class LatLon(NamedTuple):
    lat: float
    lon: float

pos = geocode(addr)
place_pin(lat=pos.lat, lon=pos.lon)
```

**★ Symptom: a new third return value broke forty call sites with `ValueError: too many
values to unpack (expected 2)` — even after the return type became a `NamedTuple`.** Cause: a
named tuple is still a tuple, so positional unpacking still checks the arity; PEP 557 makes
exactly this argument. Fix: for a return shape expected to grow, return a record that cannot
be unpacked, and read fields by name.

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class UserSummary:
    name: str
    email: str
    tier: str           # added later: no caller breaks

summary = load_user_summary(uid)
send_mail(summary.email)
```

**Symptom: a function "returns a pair" and the caller gets a 1-tuple containing a pair.**
Cause: `return (host, port),` — a trailing comma wraps the intended tuple in another one; see
[5b](05b-trailing-comma-bugs.md). Fix: delete the comma, and let the annotation catch the next
one.

```python
def endpoint() -> tuple[str, int]:
    return host, port
```

**Symptom: code review cannot tell what `_, _, email, _ = load_user(uid)` extracts.**
Cause: a four-position record read positionally makes every reader count. Fix: attribute
access on a named record, which also stops breaking when the record grows.

```python
email = load_user(uid).email
```

## Interview questions

**★ Does Python support multiple return values?**
Not as a language feature. A function returns one object; `return a, b` builds a tuple
because the comma is the tuple constructor, and `x, y = f()` is ordinary sequence unpacking of
that tuple. The distinction matters in practice: the caller can keep the tuple whole
(`result = f()`), index it, store it as a key, or unpack it, and unpacking is where the arity
check — and therefore the breakage when the shape changes — happens.

**★ When should a function return a tuple, and when a dataclass?**
A tuple when there are two, perhaps three, values whose order is self-evident at the call
site (`host, port`; `quotient, remainder`) and the shape will not grow. A named record when
any two positions share a type and could be swapped, when the caller routinely wants only
some fields, or when the shape may gain fields — and specifically a dataclass rather than a
named tuple if you need adding a field to be non-breaking, because PEP 557 points out a named
tuple stays iterable and so stays unpackable. No document gives a numeric threshold; "the
caller has to count" is the practical one.

**Why return a tuple rather than a list for a fixed set of results?**
Because the type communicates the shape. The design FAQ describes tuples as records —
*"small collections of related data which may be of different types which are operated on as
a group"* — and lists as arrays of a varying number of same-typed items. A tuple also cannot be
mutated by a caller, which matters whenever the result is shared: a cached result, a module
constant, a value handed to another thread.

**★ A function returns a 2-tuple and now needs to return a third value. How do you change it
without breaking callers?**
If callers unpack it, you cannot change it in place — every `a, b = f()` raises on the new
arity, and switching to a named tuple does not help because a named tuple still unpacks. The
options are to add a new function (or a keyword flag) that returns the richer result and
deprecate the old one, or to accept a coordinated breaking change. The lesson is the design
rule: a result likely to grow should start life as a type read by attribute — a frozen
dataclass — so that adding a field is not an interface change.

**Why does unpacking protect against a wrong count but not a wrong order?**
Because the check is structural: `ValueError` compares the number of targets with the number of
items, and nothing else. Positions carry no names, so `lo, hi = f()` and `hi, lo = f()` are
equally valid for any two-item result, and a type checker sees two positions of the same type.
Only names — attribute access on a record, or keyword-only construction — make order
irrelevant, which is why transposition is the first reason to leave a bare tuple.

---

← [Stars beyond assignment](06d-stars-beyond-assignment.md) · [Topic index](README.md) · Next → [Absence, errors and shared results](07b-absence-and-shared-results.md)
