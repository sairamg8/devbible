---
title: "A cache returns the same object to every caller, so one caller's mutation is written into the cache — and a long-lived worker gives that mutation the rest of the day to spread"
sidebar_label: "11c · Caches, workers and ORM"
sidebar_position: 94
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`functools.lru_cache` and `functools.cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache),
> [`functools.cached_property`](https://docs.python.org/3.14/library/functools.html#functools.cached_property),
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`weakref`](https://docs.python.org/3.14/library/weakref.html),
> and [`tracemalloc`](https://docs.python.org/3.14/library/tracemalloc.html).
> Target: **CPython 3.14**.

**Memoisation and aliasing are the same mechanism pointed in opposite
directions. A cache exists precisely so that the second call returns *the
object* the first call produced — which means every caller shares it, and one
caller's `.append()` is now part of the cached value. The `functools`
documentation says as much in its list of what not to cache; this chunk is what
that sentence means when the cached value is a dict, the process lives for
days, and the object came out of an ORM.**

## The cache that returns the same object

```python
@functools.lru_cache(maxsize=128)
def load_permissions(role: str) -> dict:
    return json.loads(read_file(f"perms/{role}.json"))

perms = load_permissions("editor")
perms["admin"] = True            # "just for this request"

load_permissions("editor")       # every future caller now sees admin=True
```

There is no bug in `lru_cache`. It did exactly its job: return the cached
object. The bug is that the cached value is mutable and was published to a
caller who wrote to it. The docs name the shape directly:

> *"In general, the LRU cache should only be used when you want to reuse
> previously computed values. Accordingly, it doesn't make sense to cache
> functions with side-effects, functions that need to create distinct mutable
> objects on each call (such as generators and async functions), or impure
> functions such as `time()` or `random()`."*

*"Functions that need to create distinct mutable objects on each call"* is the
sentence. If callers need their own object, the function cannot be memoised as
written.

**Three fixes, in order of preference.**

1. **Cache an immutable value.** The real repair:

   ```python
   @functools.lru_cache(maxsize=128)
   def load_permissions(role: str) -> frozenset[str]:
       return frozenset(json.loads(read_file(f"perms/{role}.json")))
   ```

   A frozen dataclass, a tuple, a `NamedTuple` or a
   `MappingProxyType(dict(...))` all work. Sharing is now free and the cache
   needs no discipline from callers.

2. **Copy on the way out**, when the value must stay mutable:

   ```python
   def load_permissions(role):
       return copy.deepcopy(_load_permissions_cached(role))
   ```

   This preserves the expensive part (parsing, I/O) and pays a copy per call.
   Measure — for a large structure the copy can cost more than the work you
   cached.

3. **Document that the result is shared and must not be mutated** — the weakest
   option, and it fails the first time someone new touches the code. If you
   choose it, name the function so the contract is visible
   (`get_shared_permissions`).

## What the cache keeps alive

> *"The cache keeps references to the arguments and return values until they
> age out of the cache or until the cache is cleared."*

Two consequences for a long-lived process.

**Unbounded caches are unbounded.** `@functools.cache` and
`lru_cache(maxsize=None)` never evict, so every distinct argument tuple ever
seen is retained along with its result. A cache keyed on user id in a
long-running worker is a memory leak with a plausible-looking decorator on it.
Give it a `maxsize`, or a TTL cache, or key it on something with a small domain.

**`lru_cache` on a method retains every instance.** The decorated function's
first argument is `self`, so `self` becomes part of the cache key and is held by
the cache for as long as the entry lives. The cache lives on the *class* — one
per function, not one per instance — so instances are never collected:

```python
class Report:
    @functools.lru_cache(maxsize=None)      # keeps every Report alive, forever
    def totals(self): ...
```

The alternatives: `functools.cached_property`, whose value lives in the
instance `__dict__` and dies with the instance; a module-level cached function
taking only immutable arguments; or an explicit per-instance dict. If you must
memoise a method, bound the size and know what you are retaining.

`cached_property` has its own version of the first problem, incidentally: it
stores the computed object on the instance and returns *that* object every
time, so a mutable cached value is shared by every caller that reads the
attribute. Cache something immutable there too.

## Long-lived workers make everything permanent

In a script, a mutable default that accumulates is embarrassing. In a gunicorn
or uvicorn worker that serves ten thousand requests before recycling, the same
object accumulates for all ten thousand — memory grows monotonically, and any
data written into it during request 1 is readable during request 9,000. The
same is true of a mutable class attribute, a module-level list, and a
`ContextVar` with a mutable default.

The mirror-image confusion is worth stating too, because teams hit it in the
same week: **module-level state is per-process, not per-application.** With
four workers you have four independent caches, four independent counters and
four independent "singletons". `cache_clear()` in one worker clears one cache;
the other three keep serving the old value. If invalidation must be global, it
belongs in Redis or the database, not in a module global.

Diagnose growth with two `tracemalloc` snapshots taken some thousands of
requests apart and diffed; the allocation site of the leaked objects is
usually the answer on its own.

## ORM instances

Three distinct problems, and it is worth keeping them apart.

**1 — `deepcopy` on a model instance copies far more than the row.** A mapped
instance holds a reference to its session state, which reaches the session, the
identity map, every other loaded instance, and the connection pool. Deep-copying
it either fails from the pickle fallback, takes an unreasonable amount of time,
or produces an object the ORM does not recognise. The fixes are the ones from
[Copy hooks](08c-copy-hooks-and-uncopyable.md): pre-seed the memo with the
session, or — much better — do not copy the model at all. Project the columns
you need into a plain dataclass and copy that.

**2 — identity maps mean two queries can return one object.** SQLAlchemy's
`Session` keeps an identity map, so loading the same primary key twice within a
session returns the same Python object; two pieces of code that each "loaded
the order" are holding one object, and one mutating it changes the other's
view. Django's ORM does *not* do this — two `Model.objects.get(pk=1)` calls
give two distinct instances, so two pieces of code each mutate their own and
whichever saves last wins, silently discarding the other's change. Both
behaviours are documented by their projects and both are correct; what causes
bugs is assuming the one you do not have. Check which framework you are in
before reasoning about whether two loads alias.

**3 — caching ORM instances across requests is a category error.** A model
instance is bound to the session that loaded it; kept past that session it is
detached, its lazy relationships raise, and its data is stale relative to the
database. Cache a serialised representation — a dict, a dataclass, JSON — and
rehydrate. This also happens to remove the aliasing problem, because
deserialisation constructs a fresh object per call.

## In-process caches lie to your tests

```python
_cache: dict[str, dict] = {}          # a test double for Redis
```

Redis returns freshly deserialised bytes on every `get`, so callers can never
alias each other. A dict-backed fake returns the same object, so they always
do. A test suite using the fake will surface aliasing bugs the production path
does not have — and, more dangerously, the reverse: code that relies on getting
a fresh object every time passes against Redis and fails against an in-process
cache added later for performance.

Make the fake behave like the real thing: `copy.deepcopy` on `get`, or store
serialised bytes in the fake as well.

## Gotchas

### A cached value that gains fields over time
**Symptom.** A memoised config or permission set grows keys nobody set on this
request.
**Cause.** Callers mutate the shared cached object; the cache stores no copy.
**Fix.** Cache immutable values, or deep-copy on return. The docs' own guidance
is not to cache functions that must produce distinct mutable objects per call.

### `@lru_cache` on a method and instances never freed
**Symptom.** Memory grows with the number of objects created; `gc` finds
nothing to collect.
**Cause.** The cache lives on the class and holds `self` as part of every key —
and *"the cache keeps references to the arguments and return values"*.
**Fix.** `functools.cached_property` for per-instance memoisation, a
module-level function over immutable arguments, or a bounded per-instance dict.

### `@functools.cache` on a function keyed by user id
**Symptom.** Steadily growing memory in a long-lived worker with no obvious
leak.
**Cause.** `cache` is `lru_cache(maxsize=None)` — nothing is ever evicted.
**Fix.** A bounded `maxsize`, or a TTL cache, or do not cache per-entity data
in process memory at all.

### `cache_clear()` that only clears one worker
**Symptom.** After a deploy or an admin action, some requests serve stale data
and others do not.
**Cause.** Module-level caches are per process; a multi-worker server has one
per worker.
**Fix.** Put invalidation somewhere shared — Redis, a version key in the
database — or recycle workers.

### A `deepcopy` of an ORM object that hangs or explodes
**Symptom.** A "clone this record" feature is slow or raises from deep inside
the ORM.
**Cause.** The instance graph reaches the session, identity map and pool.
**Fix.** Copy the columns you need into a plain dataclass or dict, or pre-seed
the memo with the session. Do not deep-copy mapped instances.

### Two loads of the same row, and one save wins
**Symptom.** A field written by one code path disappears after another path
saves.
**Cause.** An ORM without an identity map returned two distinct instances of
the same row; each holds a full copy of the field values and each save writes
all of them.
**Fix.** Load once and pass the instance, use the ORM's update-specific-fields
API, or use optimistic locking. And know which behaviour your ORM has — with an
identity map the same code aliases instead, which is a different problem.

### A test double that returns the same object as the real cache does not
**Symptom.** Aliasing bugs appear only in tests, or only in production.
**Cause.** An in-process dict fake aliases; a real serialising cache does not.
**Fix.** Make the fake serialise or deep-copy so both paths have the same
sharing semantics.

## Interview questions

**★ Q: What is wrong with `@lru_cache` on a function that returns a dict?**
Every caller receives the same dict, so any caller that mutates it has edited
the cached value for everyone, permanently, with no error. The `functools` docs
warn against caching *"functions that need to create distinct mutable objects
on each call"*. Cache an immutable value — a frozen dataclass, a tuple, a
`frozenset`, or a `MappingProxyType` over a copied dict — or deep-copy on
return and pay for it.

**★ Q: Why is `@lru_cache` on a method a memory leak?**
The cache is created once per decorated function and lives on the class, and
`self` is the first argument, so it becomes part of every cache key. Since
*"the cache keeps references to the arguments and return values"*, every
instance that ever called the method is retained until eviction — and with
`maxsize=None` there is no eviction. Use `cached_property`, whose value lives on
the instance and dies with it.

**★ Q: Why should you not cache ORM model instances across requests?**
Because the instance is bound to the session that loaded it: past that session
it is detached, lazy-loaded relationships fail, and the data is stale against
the database. It is also a shared mutable object, so any caller can edit the
cached copy. Cache a serialised projection and rebuild the object per request.

**Q: Your worker's memory grows over a day. Which aliasing causes do you
check?**
A mutable default argument accumulating across calls; a mutable class attribute
or module-level list used as per-request state; an unbounded `functools.cache`;
`lru_cache` on a method retaining instances; a `ContextVar` with a mutable
default. Two `tracemalloc` snapshots, diffed, name the allocation site.

**Q: You call `cache_clear()` after a deploy and some requests still serve
stale data. Why?**
Because a `functools` cache is per process, and a multi-worker server has one
per worker. You cleared the cache in the worker that handled your request.
Global invalidation has to live outside the process.

**Q: Two parts of your code load the same order and one's changes vanish. What
happened?**
Either the ORM returned two distinct instances of the same row — each carrying
a full set of field values, so the later save overwrites the earlier one — or,
in an ORM with an identity map, they were handed the same object and one
mutated it under the other. The diagnosis is one line: are the two objects
`is`-identical?

**Q: Your in-memory cache fake behaves differently from Redis in tests. Which
direction is dangerous?**
Both, but the dangerous direction is code that works against Redis — which
deserialises a fresh object per `get` — and then breaks when an in-process
cache is added for speed, because callers suddenly share one object. Make the
fake match the real semantics so the difference cannot hide.

---

← Prev: [Publishing state, and the diagnostic toolkit](11b-publishing-state-and-diagnostics.md) · Index: [Assignment and aliasing](README.md) · Next → [Control flow](../08-control-flow/README.md)
