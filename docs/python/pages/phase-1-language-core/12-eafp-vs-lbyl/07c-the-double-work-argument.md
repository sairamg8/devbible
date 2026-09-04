---
title: "LBYL performs the operation twice and that is a claim about the code rather than the clock — which is why it survives review without a benchmark, and why the size of the duplicated unit, from a second hash lookup to a second network round trip, is the thing that decides whether you care"
sidebar_label: "07c · The double-work argument"
sidebar_position: 156
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the Python 3.14 documentation —
> [`hasattr`](https://docs.python.org/3.14/library/functions.html#hasattr),
> [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict)
> (`__missing__`),
> [`pathlib.Path.exists` / `Path.is_file`](https://docs.python.org/3.14/library/pathlib.html),
> [`os.access`](https://docs.python.org/3.14/library/os.html#os.access).
> Target: **Python 3.14**. Documentation-validated; **no timings, nothing run**.

**The strongest thing you can say against LBYL in a code review needs no measurement at
all: it performs the operation twice. That is a statement about the code, checkable by
reading it, and unlike "it is slower" it also tells you when to care — because the
duplicated unit ranges from a second hash lookup, which is nothing, to a second property
evaluation that issues a query, which is unbounded. This chunk prices that duplication
across four cases and then makes the sharper point that follows from it: the two
operations are frequently not even the same question. `key in d` calls `__contains__`
while `d[key]` calls `__getitem__`; `Path.exists()` collapses three different situations
into one `False`; `hasattr` runs the property it is checking. Doing the work twice is the
cost. Doing two *different* things and believing they agree is the bug.**

## The double-work argument — a complexity claim, not a timing claim

**Be precise about which kind of claim you are making.** "LBYL takes twice as long" is a
timing claim and you cannot support it. "LBYL performs the operation twice" is a
statement about the code, and it is simply true — and unlike the timing claim, it also
tells you *when to care*, because the size of that duplicated unit of work varies by
orders of magnitude across these four cases:

```python
# 1 · Two hash lookups. The second unit of work is tiny and in-process.
if key in cache:
    use(cache[key])

# 2 · Two attribute lookups — and hasattr is defined as "call getattr and see whether
#     it raises", so a property's body RUNS. Twice. Side effects included.
if hasattr(order, "total"):
    charge(order.total)       # the property computed total once for the test, once here

# 3 · Two system calls, plus a window in which the answer changes.
if os.path.exists(path):
    with open(path) as fp:    # the file can be gone by now
        data = fp.read()

# 4 · Two network round trips to the database, plus the same window.
if db.execute("SELECT 1 FROM users WHERE email = %s", [email]).fetchone():
    raise DuplicateEmail(email)
db.execute("INSERT INTO users (email) VALUES (%s)", [email])
```

The EAFP spelling of each performs the operation once:

```python
# 1
try:
    use(cache[key])
except KeyError:
    pass

# 2 — one attribute access, so one property evaluation
total = getattr(order, "total", None)
if total is not None:
    charge(total)

# 3
try:
    with open(path) as fp:
        data = fp.read()
except FileNotFoundError:
    data = DEFAULT

# 4 — let the UNIQUE constraint be the check; it is the only atomic one
try:
    db.execute("INSERT INTO users (email) VALUES (%s)", [email])
except UniqueViolation as exc:
    raise DuplicateEmail(email) from exc
```

Case 1 is a rounding error and you should choose on readability. Case 2 duplicates an
**unbounded** amount of work, because a property body can do anything — including issue
a query. Cases 3 and 4 duplicate a syscall and a network round trip respectively, and
those are also the two cases where the duplicated work is *wrong*, not merely wasteful:
the answer can change in the gap. That correctness argument is the real one, and it lives
in [02 · The race between the look and the leap](02-the-race-between-look-and-leap.md)
and [02c · Databases, queues, and when LBYL clears](02c-databases-queues-and-when-lbyl-clears.md).
The `hasattr` case is worked through in [04 · `hasattr` is EAFP in disguise](04-hasattr-is-eafp-in-disguise.md).

## Gotchas

**★ Symptom: a custom mapping passes `key in obj` and then raises `KeyError` on
`obj[key]` in the very next line.** Cause: the two halves of an LBYL lookup call two
different special methods — `__contains__` for the membership test and `__getitem__` for
the subscript — and nothing forces a class to keep them consistent. The duplicated work
is not even the same work. Fix: perform one operation, so only one method can answer.

```python
class CaseInsensitiveHeaders:
    def __init__(self, pairs):
        self._store = {k.lower(): v for k, v in pairs}

    def __contains__(self, key):        # normalises the key
        return key.lower() in self._store

    def __getitem__(self, key):         # does not — so the two can disagree
        return self._store[key]

    def get(self, key, default=None):   # one method answers, consistently
        return self._store.get(key.lower(), default)

headers = CaseInsensitiveHeaders([("Content-Type", "application/json")])

# LBYL: __contains__ says yes, __getitem__ then raises KeyError.
if "Content-Type" in headers:
    value = headers["Content-Type"]

# One operation, one method, no disagreement possible.
value = headers.get("Content-Type", "text/plain")
```

**★ Symptom: an LBYL check on a `defaultdict` leaves keys behind that nobody wrote.**
Cause: the two operations are not equivalent — the membership test does not call
`__missing__`, but the subscript does, and for a `defaultdict` the documented behaviour of
`__missing__` is that the factory value *"is inserted in the dictionary for the key, and
returned"*. So the "harmless" second half of check-then-read mutates the container. Fix:
read with `get`, which the docs note *"will, like normal dictionaries, return `None` as a
default rather than using `default_factory`"*, or accept the insert deliberately.

```python
from collections import defaultdict

groups = defaultdict(list)
groups["platform"].append("ada")

# LBYL reads look harmless, but the two halves behave differently on a miss:
#   "sre" in groups   -> False, and nothing is inserted
#   groups["sre"]     -> calls __missing__, inserts [], and returns it
for team in ("platform", "sre"):
    members = groups[team] if team in groups else ()   # safe: the subscript is guarded
    report(team, members)

members = groups.get(team, ())    # never inserts, never calls the factory
members = groups[team]            # inserts an empty list — do this only on purpose
```

**★ Symptom: a guard consumes the iterator it was guarding, and the loop after it runs
zero times.** Cause: LBYL needs the value twice, and a one-shot iterable cannot supply it
twice — the check is not free here, it is destructive. Fix: take the value once, with a
sentinel default, or materialise deliberately.

```python
_MISSING = object()

results = (parse(line) for line in stream)

# The check drains the generator; the loop then sees nothing.
if list(results):
    for row in results:
        emit(row)

# One pass: take the first item as the check, and keep it.
first = next(results, _MISSING)
if first is _MISSING:
    log.info("no rows")
else:
    emit(first)
    for row in results:
        emit(row)
```

**Symptom: `Path.exists()` returns `False` for a file that is demonstrably on disk, so
the code takes the "missing" branch and reports the wrong error.** Cause: the check answers
a coarser question than the action. The docs say `False` *"will be returned if the path is
invalid, inaccessible or missing"*, and offer exactly one way to tell those apart: *"Use
`Path.stat()` to distinguish between these cases."* — which is to say, do the operation and
catch what it raises. Fix: let the operation classify its own failure.

```python
try:
    data = path.read_text()
except FileNotFoundError:
    data = DEFAULT_DATA          # genuinely absent
except PermissionError:
    raise ConfigUnreadable(path) # present, and a different problem entirely
```

## Interview questions

**★ Is "LBYL does the work twice" a performance argument?**
It is a complexity argument, and that is a stronger position — it is verifiable by
reading the code rather than by running it. What it does not tell you is whether you
care, because the duplicated unit ranges from a second hash lookup (negligible) to a
second property evaluation that issues a query (unbounded) to a second network round trip
(expensive *and* racy). State it as "this performs the operation twice", then let the
nature of the operation decide whether that matters. Never state it as "this is twice as
slow"; nothing you have supports that.

**Why is `hasattr(obj, "x")` a worse instance of double work than `if k in d`?**
Because `hasattr` is documented as being *"implemented by calling `getattr(object, name)`
and seeing whether it raises an `AttributeError` or not"*, so the attribute is genuinely
fetched by the test. If `x` is a property, its body runs during the check and again when
you use the value — and a property body can hit a database, mutate state, or write a log
line. A second dict lookup is bounded and side-effect free; a second attribute access is
neither. `getattr(obj, "x", None)` fetches once.


**When is doing the work twice actually fine?**
When the duplicated unit is small, side-effect free, and the state cannot change between
the two — a `dict` you own, in a single-threaded function, keyed by a plain string. Then
the second lookup is a rounding error and you should choose the spelling on readability
alone. The moment any of those three stops being true it stops being fine: a property or
`__getitem__` with side effects makes the second unit unbounded, a syscall or a query
makes it expensive, and shared state makes the pair racy rather than merely wasteful.
Notice that the second and third conditions are correctness problems, not performance
ones — which is why "does the work twice" is worth raising even when nobody cares about
speed.

---

← Prev: [The miss rate decides](07b-the-miss-rate-decides.md) · Index: [EAFP vs LBYL](README.md) · Next → [Where the cost actually is](07d-where-the-cost-actually-is.md)
