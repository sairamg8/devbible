---
title: "The glossary promises a tuple is thread-safe and the reference refuses to promise two equal tuples are one object — both statements are narrower than they look"
sidebar_label: "1b · Thread safety and identity"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference —
> [Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types)
> and [Parenthesized forms](https://docs.python.org/3.14/reference/expressions.html#parenthesized-forms);
> the glossary entries for [*immutable*](https://docs.python.org/3.14/glossary.html#term-immutable)
> and [*hashable*](https://docs.python.org/3.14/glossary.html#term-hashable);
> [`id()`](https://docs.python.org/3.14/library/functions.html#id) and
> [`sys.intern()`](https://docs.python.org/3.14/library/sys.html#sys.intern).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Two claims get attached to tuples in code review, and exactly one of them is in the
documentation. "It's immutable, so it's thread-safe" is a real guarantee with a hard
boundary one level deep. "Two equal tuples are the same object" is not a guarantee at
all — the reference explicitly declines to make it, twice, and CPython's answer differs
between a literal in a function body and a tuple built at runtime. Getting the first
right stops a data race; getting the second wrong ships a test that passes locally and
fails on another build.**

## The thread-safety claim, quoted exactly

> *"An object with a fixed value.  Immutable objects include numbers, strings and tuples.
> Such an object cannot be altered.  A new object has to be created if a different value
> has to be stored.  They play an important role in places where a constant hash value is
> needed, for example as a key in a dictionary.  **Immutable objects are inherently
> thread-safe because their state cannot be modified after creation, eliminating concerns
> about improperly synchronized concurrent modification.**"* —
> [glossary — *immutable*](https://docs.python.org/3.14/glossary.html#term-immutable)

Every word of that sentence is about **the immutable object itself**. Its state cannot be
modified, therefore there is no write to synchronise, therefore there is no race. It is a
statement about one object's own storage — not about the transitive graph reachable from
it.

So:

```python
# Safe to publish to any number of threads: every slot is immutable.
ROUTE = ("GET", "/v1/orders", frozenset({"read:orders"}))

# NOT safe, and the tuple wrapper contributes nothing:
STATS = ("worker-1", [])          # two threads calling STATS[1].append(x)
                                  # are racing on an unsynchronised list
```

The check is **one level of recursion, not one level of type**. `isinstance(x, tuple)`
tells you nothing about whether `x` is safe to share; you need every element to be
immutable, and every element of every element.

⚠️ This distinction sharpens under a free-threaded build (PEP 703, available as a
supported option from 3.13 onwards). The documentation's thread-safety sentence does not
change, but the cost of getting the recursion wrong does: a list mutated from two threads
without the GIL serialising bytecode is a genuine data race, not merely a logically
interleaved one.

### The pattern that makes this safe in practice

Publish a **new** tuple instead of mutating a shared one. Rebinding a module-level or
attribute name is a single reference store; readers either see the old tuple or the new
one, never a half-written one.

```python
class RouteTable:
    def __init__(self):
        self._routes = ()          # tuple of immutable route records

    def add(self, method, path):
        # Build a new tuple and swap it in. Readers holding the old tuple
        # keep a consistent snapshot for as long as they need it.
        self._routes = self._routes + ((method, path),)

    def snapshot(self):
        return self._routes        # no copy needed: it cannot change
```

That is the whole reason immutable records are worth the syntax. `snapshot()` needs no
lock and no defensive copy, because the object it returns is closed to modification.

🔴 **`add()` here is the quadratic pattern the sequence docs warn about** — fine for a
route table configured once at start-up, wrong inside a hot loop. See
[10b · What operations cost](10b-what-operations-cost.md).

## Identity is deliberately unspecified

Now the claim that is *not* in the documentation. The reference goes out of its way to
say the opposite:

> *"Types affect almost all aspects of object behavior.  Even the importance of object
> identity is affected in some sense: **for immutable types, operations that compute new
> values may actually return a reference to any existing object with the same type and
> value**, while for mutable objects this is not allowed. For example, after ``a = 1; b =
> 1``, *a* and *b* may or may not refer to the same object with the value one, depending
> on the implementation. … **This behaviour depends on the implementation used, so should
> not be relied upon**, but is something to be aware of when making use of object identity
> tests."* —
> [Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types)

and repeats it for the one case where you might think the answer is obvious — the empty
tuple:

> *"An empty pair of parentheses yields an empty tuple object.  Since tuples are
> immutable, the same rules as for literals apply (i.e., **two occurrences of the empty
> tuple may or may not yield the same object**)."* —
> [Parenthesized forms](https://docs.python.org/3.14/reference/expressions.html#parenthesized-forms)

Compare the same paragraph's treatment of a mutable literal, where the language *does*
commit:

> *"However, after ``c = []; d = []``, *c* and *d* are guaranteed to refer to two
> different, unique, newly created empty lists. (Note that ``e = f = []`` assigns the
> *same* object to both *e* and *f*.)"*

That asymmetry is the point. **Mutable literals must be distinct objects; immutable ones
need not be.** An implementation is free to cache, fold, or share them — and free not to.

### What this rules out

- Tuple **interning**. There is no documented tuple equivalent of
  [`sys.intern()`](https://docs.python.org/3.14/library/sys.html#sys.intern), whose
  documentation covers strings only. Whether CPython keeps a free-list of small tuples,
  or reuses a folded constant for a literal, is an implementation detail I could not find
  any guarantee for in the 3.14 documentation. **Treat it as unspecified.**
- Constant **folding** of tuple literals. A tuple of constants may be built once at
  compile time and shared by every execution of that line; a tuple built from variables
  cannot be. The docs do not promise either behaviour, so `is` will give you different
  answers for `("a", "b")` written literally and `(x, y)` built from names holding the
  same values — with no rule you can cite about which.
- Using `id()` as a durable handle. The `id()` documentation is explicit that *"Two
  objects with non-overlapping lifetimes may have the same `id()` value"*, so an id
  recorded for a tuple that has since been collected can be reissued to something else
  entirely.

### What you should do instead

```python
# Compare tuples by value. Always.
if request_key == cached_key:
    ...

# Use `is` only against a sentinel object you created yourself.
_MISSING = object()

def get_config(store, name):
    value = store.get(name, _MISSING)
    if value is _MISSING:              # correct: one object, by construction
        raise KeyError(name)
    return value
```

`is` on a tuple is only ever right when you are asking "is this the *same* record I put
in", which is a question about provenance, not about value — and even then, prefer an
explicit id field.

## Where hashing rescues you

The identity question is a distraction for the use tuples are actually for. A dict does
not care whether two equal keys are one object:

> *"Hashable objects which compare equal must have the same hash value."* —
> [glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable)

and the design FAQ says the rule directly:

> *"dictionary keys should be compared using ``==``, not using `is`."* —
> [Why must dictionary keys be immutable?](https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable)

So `d[(tenant, day)]` finds the entry you stored under an equal-but-distinct tuple, every
time, with no reliance on caching. That is covered in
[3 · Hashability](03-hashability.md) and [4 · Tuples as keys](04-tuples-as-keys.md).

## Gotchas

**★ Symptom: `t1 is t2` is `True` in the REPL or in one function and `False` in
another.** Cause: you compared identity on an immutable value the language explicitly
declines to give identity rules for; whether a literal was folded into a shared constant
depends on where it appears. Fix: compare values.

```python
# Wrong — an implementation detail dressed up as a test
assert build_key(a, b) is EXPECTED_KEY
# Right
assert build_key(a, b) == EXPECTED_KEY
```

**★ Symptom: two workers in a thread pool see interleaved writes to something you stored
in a tuple.** Cause: the tuple is thread-safe; the list inside it is not, and the
glossary's guarantee does not extend to contained objects. Fix: store immutable contents,
or guard the mutable one with a lock — the tuple is not a synchronisation primitive.

```python
import threading

# Before: the tuple is decoration, the race is real.
COUNTS = ("worker-1", [])

# After, option A — nothing mutable to race on:
COUNTS = ("worker-1", ())            # rebind a new tuple to publish an update

# After, option B — keep the list, add the lock it always needed:
_lock = threading.Lock()
with _lock:
    COUNTS[1].append(value)
```

**Symptom: a cache keyed on `id(some_tuple)` returns the wrong entry.** Cause: `id()` is
unique only for an object's lifetime — *"Two objects with non-overlapping lifetimes may
have the same `id()` value"* — and a temporary tuple is collected the moment the last
reference drops, freeing its id for reuse. Fix: key on the tuple itself; that is what
hashability is for.

```python
cache = {}
cache[(tenant_id, day)] = rows       # value-keyed, correct
```

**Symptom: `snapshot()` returns a tuple and a caller still sees it change.** Cause: you
returned a tuple over mutable elements, so the outer array is a snapshot and the contents
are live. Fix: the elements have to be immutable for the snapshot to mean anything.

```python
def snapshot(self):
    return tuple(tuple(row) for row in self._rows)
```

**Symptom: code review asks you to `copy.deepcopy()` a tuple before returning it.**
Cause: someone applied the list rule to a tuple. If every element is immutable the copy is
pure cost — there is nothing that could change. Fix: skip the copy, and say why.

```python
def get_route(self):
    return self._route       # ("GET", "/v1/orders") — deep-copying this is waste
```

## Interview questions

**★ Someone hands you a tuple and says "this is safe to share between threads". When are
they wrong?**
Whenever any element is mutable. The glossary's thread-safety claim is about the
immutable object itself — its state cannot be modified, so there is nothing to
synchronise. A list inside the tuple has state, has no lock, and is now reachable from
every thread that got the tuple. The correct sentence is "a tuple of immutable objects is
safe to share", and the check is one level of recursion, not one level of type.

**★ Can you rely on `(1, 2) is (1, 2)`?**
No. For immutable types the reference says operations that compute new values *"may
actually return a reference to any existing object with the same type and value"*, and it
states directly that two occurrences of the empty tuple *"may or may not yield the same
object"*. Whether CPython folds a literal into a constant or reuses a cached object is an
implementation detail with no documented promise, and it can differ between a literal and
an equal tuple built from variables. Use `==`.

**Why does the language guarantee that `c = []; d = []` produces two distinct lists but
refuses the same guarantee for tuples?**
Because for a mutable object, identity is observable through mutation: if `c` and `d`
were the same list, `c.append(1)` would change `d`, and no program could reason about
anything. For an immutable object there is no operation that can tell the two cases
apart — except `is` and `id()`, which the documentation is telling you not to use for
this. Sharing is therefore a legal optimisation for tuples and an illegal one for lists.

**Is there a `sys.intern()` for tuples?**
No. `sys.intern()` is documented for strings, and I could not find any documented
interning mechanism for tuples in the 3.14 sources. If you need canonical instances —
say, so that `is` becomes a valid cheap check — build the table yourself with a dict
keyed on the tuple, which works precisely because tuples are hashable and compare by
value.

**Does publishing a new tuple instead of mutating a shared list need a lock?**
Rebinding one name to a new object is a single reference store, and readers see either
the old object or the new one. That gives you a consistent *snapshot* without a lock,
which is the main practical reason to use immutable records. It does **not** give you
atomicity across a read-modify-write: `self._routes = self._routes + (r,)` can lose an
update if two threads run it concurrently, because the read and the write are separate
steps. Snapshot reads are free; compound updates still need the lock.

**Your test asserts `cache_key is expected_key` and it passes. Why is that a bad test?**
Because it is asserting an implementation detail the documentation refuses to specify,
and it will keep passing until the day the two tuples stop being built on the same code
path — a refactor, a different Python build, a value that arrives from a variable rather
than a literal. The assertion you meant is `==`, which is what every consumer of the key
(a dict, a set, a comparison) actually uses.

---

← [What immutability freezes](01-what-immutability-freezes.md) · [Topic index](README.md) · Next → [The `+=` that raises and mutates](02-the-augmented-assignment-trap.md)
