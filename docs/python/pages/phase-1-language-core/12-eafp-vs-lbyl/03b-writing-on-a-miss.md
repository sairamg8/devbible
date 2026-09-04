---
title: "setdefault and defaultdict turn a lookup into a write, and that is either the feature you wanted or a dictionary that grows behind your back — the difference is whether the code is building the structure or reading it"
sidebar_label: "03b · Writing on a miss"
sidebar_position: 126
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 documentation —
> [`dict.setdefault`](https://docs.python.org/3.14/library/stdtypes.html#dict.setdefault),
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict)
> (`__missing__`, `default_factory`, the `setdefault` comparison),
> [`d[key]` and `__missing__`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [`collections.UserDict`](https://docs.python.org/3.14/library/collections.html#collections.UserDict),
> [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter).
> One claim the docs do not make — whether reading a missing `Counter` key inserts it —
> was **probed** on the installed interpreter, CPython **3.14.4**, one patch behind the
> corpus pin of **Python 3.14.7**. Target: **Python 3.14**; no sandbox run.

**Two of the seven spellings mutate the dictionary on a miss, and both of them look like
reads at the call site. `d.setdefault(k, [])` and `defaultdict(list)[k]` insert the key
and return the new value, which is exactly right while you are *building* a structure
and exactly wrong while you are *reading* one — a config lookup that inserts changes what
`in`, `len` and `json.dumps` report afterwards. There is a second consequence people meet
as a mystery rather than as a rule: on a `defaultdict`, `try`/`except KeyError` around a
subscript is dead code, because `__missing__` supplies a value instead of raising.**

## `setdefault`: one operation, and an eagerly built default

`setdefault` is the atomic form of "give me the entry, creating it if needed", and it is
the right tool for building an index in one pass:

```python
index: dict[str, list[str]] = {}
for path, tag in tagged_files:
    index.setdefault(tag, []).append(path)
```

Two traps, both mechanical.

**The default is always constructed**, whether or not it is used — it is an ordinary
argument, evaluated before the call. With `[]` that is a wasted empty list; with anything
real it is a wasted round trip:

```python
# 🔴 build_profile() runs on every iteration, hit or miss.
cache.setdefault(user_id, build_profile(user_id))

# The factory form runs only on a miss.
try:
    profile = cache[user_id]
except KeyError:
    profile = cache[user_id] = build_profile(user_id)
```

**And the "insert" is invisible at the call site.** `d.setdefault(k, [])` reads like an
accessor and is a mutation. When the dict is a cache you serialise, or a config you
compare against a schema, the keys grow behind you. For the grouping case, the
`collections` documentation says which to prefer outright — of `defaultdict(list)` versus
`d.setdefault(k, []).append(v)`:

> *"This technique is simpler and faster than an equivalent technique using
> `dict.setdefault()`."*

## `defaultdict`: the read that writes, and the handler that never runs

The mechanism is `__missing__`, and the documentation states it precisely:

> *"If the `default_factory` attribute is `None`, this raises a `KeyError` exception with
> the key as argument. If `default_factory` is not `None`, it is called without arguments
> to provide a default value for the given key, this value is inserted in the dictionary
> for the key, and returned. If calling `default_factory` raises an exception this
> exception is propagated unchanged."*

> *"This method is called by the `__getitem__()` method of the `dict` class when the
> requested key is not found; whatever it returns or raises is then returned or raised by
> `__getitem__()`."*

Three consequences that bite in real code.

**A `try`/`except KeyError` around a `defaultdict` subscript is dead code.** There is no
`KeyError` to catch, because `__missing__` returned a value instead. The handler never
runs, the key is now in the dict, and the bug shows up as a mysteriously growing
dictionary rather than as an exception.

```python
from collections import defaultdict

buckets = defaultdict(list)

# 🔴 The except branch is unreachable, and this line INSERTED buckets["missing"].
try:
    items = buckets["missing"]
except KeyError:
    items = []

# Read a defaultdict without writing to it: get() does not consult the factory.
items = buckets.get("missing", [])
```

**`get` bypasses the factory**, which the docs call out because it surprises everyone:

> *"Note that `__missing__()` is not called for any operations besides `__getitem__()`.
> This means that `get()` will, like normal dictionaries, return `None` as a default rather
> than using `default_factory`."*

So on a `defaultdict(list)`, `d[k]` gives `[]` and `d.get(k)` gives `None` — and code
that mixes the two spellings has two different notions of "empty", one of which is not
iterable.

**A factory that raises, raises through the subscript.** *"If calling `default_factory`
raises an exception this exception is propagated unchanged"* — so `defaultdict(SomeClass)`
where the constructor validates will raise that validation error from a line that looks
like a lookup.

## `__missing__` on your own mapping

The same hook is available on a `dict` subclass, and it is the documented way to make a
mapping whose miss policy is part of its type:

> *"If a subclass of `dict` defines a method `__missing__()` and key is not present, the
> `d[key]` operation calls that method with the key key as argument."*

```python
class Settings(dict):
    """A settings mapping whose misses are a configuration error, with context."""

    def __init__(self, *args, source: str, **kwargs):
        super().__init__(*args, **kwargs)
        self.source = source

    def __missing__(self, key):
        raise ConfigKeyMissing(f"{key!r} is not set in {self.source}")


settings = Settings({"port": 8080}, source="config/app.toml")
settings["port"]        # 8080
settings["host"]        # ConfigKeyMissing, naming the file — not a bare KeyError
```

This is EAFP made *better* rather than avoided: the leap still happens, and the exception
it raises now carries the diagnosis the caller needs. Note the two limits — `__missing__`
fires only for `__getitem__`, so `get`, `in` and `pop` keep the base-class behaviour, and
`collections.UserDict` is the safer base when you want every method routed through your
own logic.

## Gotchas

**★ Symptom: a `try`/`except KeyError` handler is never entered, and a `defaultdict`
keeps growing.** Cause: `__missing__` returns instead of raising, so the subscript both
succeeds and inserts. Fix: `d.get(key, default)` to read without writing; keep the
subscript only where the insert is what you want.

**★ Symptom: `TypeError: 'NoneType' object is not iterable` on a `defaultdict(list)`.**
Cause: the code used `.get(key)`, which the docs say ignores `default_factory` and
returns `None`. Fix: `d[key]` if the insert is wanted, or `d.get(key, [])` if it is not —
and pick one spelling per module.

**★ Symptom: a config dictionary contains keys nobody set.** Cause: `setdefault` or a
`defaultdict` subscript on a read path — both write on a miss, and a read that mutates
does not look like a mutation at the call site. Fix: reads use `get`; only the code that
is *building* the structure uses `setdefault`.

**★ Symptom: an expensive call runs on every loop iteration despite a `setdefault`
"cache".** Cause: the default argument is evaluated eagerly, before the method is
entered — it is an ordinary argument, not a factory. Fix: EAFP with an insert in the
handler, or `defaultdict` with a factory; both run the expensive thing only on a miss.

```python
try:
    profile = cache[user_id]
except KeyError:
    profile = cache[user_id] = build_profile(user_id)
```

**Symptom: `json.dumps` output gained keys, or a schema comparison started failing after
a "read-only" refactor.** Cause: a `defaultdict` was passed where a plain `dict` was
expected, and something read a missing key. Fix: convert at the boundary — `dict(dd)` —
so the structure that leaves your module has no factory attached.

**Symptom: `d.setdefault(k, [])` returns a list, mutating it works, and then one day it
silently does nothing.** Cause: it works exactly when the key was absent — the list you
got is the one now in the dict — and returns whatever was already there otherwise: a
tuple, a string, `None`. Appending to that is either a `TypeError` or a no-op on a copy.
Fix: type the structure and validate where it is parsed; a heterogeneous dict makes every
access spelling wrong somewhere.

**Symptom: a validation error surfaces from a line that is only a dictionary lookup.**
Cause: `defaultdict(SomeClass)` with a constructor that validates — the docs say *"if
calling `default_factory` raises an exception this exception is propagated unchanged"*, so
the factory's error comes out of the subscript. Fix: keep factories trivial (`list`,
`dict`, `int`, `lambda: Config()` with no validation) and do the validating work
explicitly where it can be read.

**Symptom: a recursive `defaultdict` "auto-vivifies" a whole path that was a typo.**
Cause: `tree = defaultdict(lambda: defaultdict(dict))` inserts at every level it is
walked, so `tree["typo"]["also_typo"]` creates two nodes and reports success. Fix: build
with the auto-vivifying structure if you must, then freeze it — `dict(tree)` at the
boundary, or drop the factory before the read phase (`tree.default_factory = None`, after
which a miss raises `KeyError` *"with the key as argument"*).

**Symptom: `setdefault` is used for its return value and the insert is unwanted.**
Cause: it is the only stdlib spelling that reads *and* repairs, so it gets reached for
whenever a fallback is needed. Fix: `get` when you only want the value; `setdefault` when
you want the entry to exist afterwards. Say which of the two you meant in the line above
if it is not obvious.

**Symptom: `__missing__` is defined on a subclass and `get` still returns `None`.**
Cause: the documented hook covers `__getitem__` only — *"`__missing__()` is not called for
any operations besides `__getitem__()`"*. Fix: subclass `collections.UserDict` if every
accessor must route through your logic, or override `get` explicitly and delegate.

## Interview questions

**★ What does `try: d[k]` / `except KeyError` do on a `defaultdict`?**
Nothing you wanted. `__missing__` runs, the factory produces a value, the value is
*inserted*, and the subscript returns it — so no exception is raised, the handler is dead
code, and the dict has grown by one key on what the author believed was a read. To read a
`defaultdict` without writing to it, use `get`, which the documentation says does not
consult `default_factory`.

**★ Why does `dict.setdefault` evaluate its default even when the key is present?**
Because it is an ordinary function argument, and Python evaluates arguments before the
call. There is no laziness in the protocol — that is precisely the gap `defaultdict`
fills, since it takes a *factory* and calls it *"without arguments"* only when
`__missing__` runs. The practical rule: `setdefault` for cheap literals, `defaultdict` or
EAFP-with-insert for anything that costs something.

**★ `d.setdefault(k, []).append(v)` versus `defaultdict(list)` — which, and on whose
authority?**
The `collections` documentation compares them directly and says the `defaultdict` form
*"is simpler and faster than an equivalent technique using `dict.setdefault()`"*. Use
`defaultdict` when the whole structure has one miss policy, and `setdefault` when only
this one call site does — mixing a `defaultdict` into code that also reads with `get`
gives you two different empties.

**How would you make a mapping whose missing keys raise a domain error rather than
`KeyError`?**
Subclass `dict` and define `__missing__`, which the documentation says `d[key]` calls
*"with the key key as argument"* when the key is absent. Raise your own exception there,
with the context the caller needs — the file the settings came from, the tenant id, the
schema version. Remember it hooks `__getitem__` only, so `get`, `in` and `pop` keep base
behaviour; `collections.UserDict` is the better base when you want every access routed
through your own code.

**Is a `defaultdict` a way of avoiding EAFP, or a way of doing it?**
Neither, and that is the point of the "third family". It is not a pre-check and it is not
a handler: it is a data structure whose miss policy is declared once, at construction,
instead of at every access. That is usually the best available answer, because the policy
stops being a per-call-site decision that can drift — but it costs you the ability to
notice a miss, which is why a `defaultdict` is wrong for reading configuration and right
for grouping.

**★ What is the difference between `defaultdict(int)` for counting and `Counter`?**
`defaultdict(int)` gives you `d[k] += 1` with no setup and remains a plain mapping, but it
inserts on every read of a missing key. `Counter` is a `dict` subclass built for the job —
`most_common`, arithmetic between counters, `update` from an iterable — and the docs say
its objects *"have a dictionary interface except that they return a zero count for missing
items instead of raising a `KeyError`"*. The documentation does not say whether that read
inserts; probed on the installed CPython **3.14.4**, it does **not**: after reading a
missing key, `Counter` still reports it absent while `defaultdict(int)` has gained a
`0` entry. So `Counter` is the only one of the three that answers "how many?" without
changing the answer to "which keys?" — reach for it for pure counting, and keep
`defaultdict(int)` for tallies embedded in a larger structure you are building anyway.

**When does the mutation-on-read behaviour actually cause a production bug rather than
just untidiness?**
When something downstream reads the dict's *shape*: a serialiser, a diff against a
schema, an "unknown keys" validator, a cache-size limit, an iteration that now yields a
key created by the previous line, or an equality assertion in a test. The insert is
invisible where it happens and visible everywhere else, which is what makes it hard to
find — the failing code is never the code that grew the dict.

---

← Prev: [Mappings: the decision table](03-mappings-the-decision-table.md) · Index: [EAFP vs LBYL](README.md) · Next → [Sequences, sets and nesting](03c-sequences-sets-and-nested-lookups.md)
