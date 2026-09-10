---
title: "Every O(1) in the dict complexity table is an average-case claim resting on three preconditions, and production is where they stop holding"
sidebar_label: "02 · What O(1) does not promise"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html), [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__), [`PYTHONHASHSEED`](https://docs.python.org/3.14/using/cmdline.html#envvar-PYTHONHASHSEED), [`-R`](https://docs.python.org/3.14/using/cmdline.html#cmdoption-R). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run, no timings**.

**The complexity page does not say a dict lookup is *O*(1). It says it is *O*(1) on average, given three assumptions it names in the same paragraph, and it states the failure mode outright: when every key hashes to the same value, each of those operations is *O*(n) instead. That is not a theoretical footnote — it is a published denial-of-service class that Python ships a mitigation for, turned on by default, that you can accidentally turn off. This chunk is what breaks the *O*(1), what Python does about it, and what part of the mitigation is yours.**

## The precondition paragraph, in full

> *"The times listed for dict objects are average-case times, as they assume the hash function for the objects is sufficiently robust to make collisions uncommon. They also assume the keys are well-distributed among the set of possible keys. In the worst case, when every key hashes to the same value, each of the *O*(1) operations below instead takes *O*(*n*) time. They also assume that hashing and comparing a key is *O*(1)."*

Four claims, and each one is a distinct way a real system degrades:

| Assumption | How it fails in production |
|---|---|
| the hash function is *"sufficiently robust"* | a hand-written `__hash__` that returns a constant, or hashes only one field of a composite key |
| keys are *"well-distributed"* | attacker-chosen keys; or a natural key space that clusters under a weak hash |
| hashing a key is *O*(1) | `__hash__` over a large tuple, a frozenset, or a long string built per lookup |
| comparing a key is *O*(1) | a dataclass `__eq__` over many fields, or keys that share a long common prefix |

And one more, from the top of the same page and easy to skip:

> *"This page documents the time complexity of various operations on built-in types in CPython. Other Python implementations may have different performance characteristics. Additionally, **the listed costs assume exact built-in types, as instances of subclasses may have different costs.**"*

So the table is about `dict`, not about `defaultdict`, `Counter`, `OrderedDict` or your own `class CaseInsensitiveDict(dict)`. A subclass that overrides `__getitem__` in Python has a Python-level function call on every single lookup, and no table in the documentation covers it.

## The constant-hash catastrophe, written by hand

The worst case is not exotic. This is the single most common way a team creates it:

```python
class Point:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Point) and (self.x, self.y) == (other.x, other.y)

    def __hash__(self) -> int:
        return 0            # 🔴 "legal, because equal objects hash equal"
```

That `__hash__` satisfies the *only* rule the data model imposes —

> *"The only required property is that objects which compare equal have the same hash value"*

— and turns every dictionary keyed on `Point` into a linked list. Every insert compares the new key against every existing key. Building an *n*-entry dictionary becomes *O*(n²), and the complexity table still says *O*(1). The documentation's own advice is the fix, and it is one line:

> *"it is advised to mix together the hash values of the components of the object that also play a part in comparison of objects by packing them into a tuple and hashing the tuple"*

```python
class Point:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Point) and (self.x, self.y) == (other.x, other.y)

    def __hash__(self) -> int:
        return hash((self.x, self.y))     # the docs' own recommended shape
```

Note the symmetry: the tuple inside `__hash__` contains exactly the fields the `__eq__` compares. When those two lists drift apart you get a bug that no test catches until the dictionary is big — which is [05 · Hashability](03-hashability-the-contract.md).

## Hash randomisation: a security feature you can turn off by accident

Because the *O*(n²) worst case is reachable by choosing keys, `str` and `bytes` hashing is salted per process. The data model note:

> *"By default, the `__hash__()` values of str and bytes objects are "salted" with an unpredictable random value. Although they remain constant within an individual Python process, they are not predictable between repeated invocations of Python."*

> *"This is intended to provide protection against a denial-of-service caused by carefully chosen inputs that exploit the worst case performance of a dict insertion, *O*(*n*²) complexity."*

The threat model is concrete: a web service that puts unvalidated request keys into a dictionary — form fields, JSON object keys, HTTP headers — will build one dictionary per request from data the caller controls. Without a per-process salt, an attacker who knows the hash function can precompute thousands of colliding keys and turn each request into a quadratic loop.

Three facts about it that matter operationally:

1. **It covers `str` and `bytes` only.** The note names those two types. Integer keys are not salted, so `hash(1)` is the same in every process — which is exactly why `1`, `1.0` and `True` collide identically everywhere (see [08 · Equal keys that collide](03d-equal-keys-that-collide.md)).
2. **It is on by default.** The `-R` flag's documentation says so plainly: *"This option only has an effect if the `PYTHONHASHSEED` environment variable is set to anything other than `random`, since hash randomization is enabled by default."*
3. 🔴 **`PYTHONHASHSEED=0` disables it.** The environment-variable docs: *"Specifying the value 0 will disable hash randomization."* People set it to make a flaky test reproducible, then it ends up in a Dockerfile or a systemd unit.

The legitimate uses are named in the docs and are narrow:

> *"Its purpose is to allow repeatable hashing, such as for selftests for the interpreter itself, or to allow a cluster of python processes to share hash values."*

If a test needs determinism, pin the seed to a *non-zero* value in the test runner's environment only, never in the image:

```bash
# tests only — deterministic *and* still randomised
PYTHONHASHSEED=12345 python -m pytest

# 🔴 never in a Dockerfile / systemd unit: this removes the DoS mitigation
# ENV PYTHONHASHSEED=0
```

⚠️ A test that *needs* a fixed hash seed is usually a test asserting on the iteration order of a **`set`**, not a `dict` — `dict` order is guaranteed and does not vary with the seed. Fix the test with `sorted()`, not with the environment.

## The resize is amortised, and one insert is not

`d[key] = value` is listed at *O*(1), but the entry carries footnote markers on the complexity page, and the mechanism from [01](01-the-hash-table-underneath.md) explains why: when the table crosses its load threshold, the insertion that crossed it rebuilds the whole table. That single insert is *O*(n); the *sequence* of inserts averages out to *O*(1) each.

That distinction only bites in one place, and it is a real place: a latency budget expressed as a p99.9 rather than a mean. A dictionary being filled inside a request path will occasionally pay a rebuild on one insert. The fix is not to fight it, it is to build the mapping once, outside the hot path:

```python
# a rebuild can land inside any request
ROUTES: dict[str, Handler] = {}

def register(path: str, handler: Handler) -> None:
    ROUTES[path] = handler          # amortised O(1), occasionally O(n)

# build it at import, so every resize happens before the first request
ROUTES: dict[str, Handler] = {
    "/health": health,
    "/orders": list_orders,
    "/orders/{id}": get_order,
}
```

## When *O*(1) is the wrong question entirely

A dictionary is *O*(1) for **exact-key** access and nothing else. Every other access shape is a full scan, and the complexity page lists iteration at *O*(*n*):

```python
# O(1) — the only thing a dict is fast at
user = users_by_id["u-7712"]

# O(n) — a scan; the dict gives you nothing here
admins = [u for u in users_by_id.values() if u.role == "admin"]

# O(n) — a scan, wearing a dict comprehension's clothes
by_email = {u.email: u for u in users_by_id.values()}
```

If your access pattern is "find every user whose role is admin", the answer is a second index built once, not a cleverer expression over the first:

```python
users_by_id: dict[str, User] = {u.id: u for u in all_users}
users_by_role: dict[str, list[User]] = {}
for user in all_users:
    users_by_role.setdefault(user.role, []).append(user)

admins = users_by_role.get("admin", [])     # O(1) to the bucket
```

And if the answer is "find every user whose signup date is between two dates", a dictionary is the wrong structure — hash tables have no order over keys at all. That is `bisect` on a sorted list, or a database index; [07 · `heapq` and `bisect`](../07-heapq-and-bisect/README.md) and **11 · Choosing a structure** *(not written yet)* are where that decision lives.

## Gotchas

**★ Symptom: a service degrades under a specific customer's traffic and the profiler points at dictionary construction.** Cause: keys derived from caller-controlled data, colliding — the exact *O*(n²) *"denial-of-service caused by carefully chosen inputs"* the docs describe. Fix: confirm hash randomisation is actually on before hunting further, because a disabled seed makes the attack trivially repeatable.

```bash
# the environment is the definitive check: unset, or the literal 'random', means on
env | grep PYTHONHASHSEED

# the interpreter's own report of the -R flag (documented as sys.flags.hash_randomization)
python -c "import sys; print(sys.flags.hash_randomization)"
```

⚠️ `sys.flags.hash_randomization` is documented only as the flag corresponding to `-R`; the
documentation does not spell out its value when randomisation is on *by default* rather than
via `-R`. Treat the environment variable as the authority and the flag as corroboration.

**★ Symptom: a dict keyed on your own class is fast in tests and quadratic in production.** Cause: a `__hash__` that returns a constant, or one that hashes fewer fields than `__eq__` compares — legal, but it funnels everything into one bucket. Fix: hash the same tuple of fields that `__eq__` compares.

```python
def __eq__(self, other: object) -> bool:
    return isinstance(other, Order) and (self.tenant, self.number) == (other.tenant, other.number)

def __hash__(self) -> int:
    return hash((self.tenant, self.number))    # same fields, same order
```

**★ Symptom: a test only passes when `PYTHONHASHSEED=0` is set.** Cause: the test asserts on an order that Python does not guarantee — almost always `set` iteration order, or the order of `dict.keys()` built *from* a set. `dict` insertion order is guaranteed and never varies with the seed, so a seed-sensitive dict test is a set test in disguise. Fix: sort at the assertion, and delete the environment variable.

```python
# seed-sensitive: set iteration order is not guaranteed
assert list(tags) == ["beta", "alpha"]

# stable under any seed
assert sorted(tags) == ["alpha", "beta"]
```

**Symptom: `PYTHONHASHSEED=0` is in the production image "for reproducible builds".** Cause: someone conflated reproducible *builds* with reproducible *hashing*; build reproducibility comes from `SOURCE_DATE_EPOCH` and pinned dependencies, not from the hash seed. Fix: remove it from the image and scope it to the test command.

```dockerfile
# 🔴 remove — this disables the documented DoS mitigation for every request
# ENV PYTHONHASHSEED=0
```

**Symptom: the complexity table was quoted in a design review about a `Counter`, and the numbers did not hold.** Cause: *"the listed costs assume exact built-in types, as instances of subclasses may have different costs."* `Counter.__missing__`, `defaultdict.__missing__` and any Python-level `__getitem__` override add work the table does not model. Fix: quote the table for `dict` and measure — separately, deliberately — for the subclass; do not extrapolate.

**Symptom: a "cache" dictionary keyed on a freshly built tuple is slower than the function it caches.** Cause: the key is constructed, hashed and compared on every call, and `hash()` of a tuple hashes every element. When the wrapped computation is small, key construction dominates. Fix: key on something already interned and cheap, or do not cache at all.

```python
# the key costs more than the work
def area(shape: Shape) -> float:
    key = (shape.kind, tuple(shape.points))     # hashes every point, every call
    return _areas[key]

# key on identity-stable, cheap data the caller already has
def area(shape: Shape) -> float:
    key = shape.id                              # one interned str
    return _areas[key]
```

**Symptom: p99 latency spikes on a code path that only inserts into a dictionary.** Cause: the amortised resize — the insert that crosses the load threshold rebuilds the table, so one insert in a growth series is *O*(n). Fix: build the mapping before the latency-sensitive path starts, or accept it and stop looking, but know which one you chose.

## Interview questions

**★ The docs say dict lookup is *O*(1). When is it not, and what is it then?**
It is *O*(n). The complexity page states the worst case explicitly: *"In the worst case, when every key hashes to the same value, each of the O(1) operations below instead takes O(n) time."* Getting there requires only that the keys collide — which happens by accident when someone writes a weak `__hash__`, and on purpose when an attacker chooses the keys. Building an *n*-key dictionary in that state is *O*(n²), which is why hash randomisation exists.

**★ What is hash randomisation protecting against, and what does it *not* cover?**
It protects against an attacker constructing many strings that hash to the same value and feeding them in as dictionary keys — the docs name the failure as a *"denial-of-service caused by carefully chosen inputs that exploit the worst case performance of a dict insertion, O(n²) complexity."* Salting `str` and `bytes` hashes with a per-process random value makes those collisions unpredictable across processes, so a precomputed attack list does not carry over. It does **not** cover integers (unsalted), it does not cover your own `__hash__` implementations, and it does nothing about a key type whose hashing is simply slow.

**★ Someone sets `PYTHONHASHSEED=0` to make a flaky test pass. What do you say?**
Two things. First, the value `0` is special — *"Specifying the value 0 will disable hash randomization"* — so it does not merely pin the seed, it removes the mitigation; if determinism really is needed, any non-zero value pins the seed while keeping randomisation semantics. Second, the flakiness is almost certainly an assertion on unordered iteration, and since Python 3.7 `dict` order *is* guaranteed, that means the test is really about a `set`. The correct fix is `sorted()` at the assertion, and the environment variable belongs nowhere near the production image.

**Why can't you take the published complexity table and apply it to `collections.Counter`?**
Because the page's own preamble scopes it: *"the listed costs assume exact built-in types, as instances of subclasses may have different costs."* A subclass may define `__missing__` (both `Counter` and `defaultdict` do), may override `__getitem__` in Python rather than C, and may do extra work per operation. The asymptotic class is often the same, but the constants are not, and the table makes no claim about them.

**What does "amortised *O*(1)" mean for an insert, and when does the difference matter?**
It means the average cost over a sequence of inserts is constant, not that every individual insert is. When the table crosses its load threshold it is rebuilt, and the insert that triggered the rebuild pays proportional to the number of entries. For throughput that is irrelevant — the rebuilds are geometrically rare. For a tail-latency budget it is not: one request in a growth series absorbs the rebuild. The mitigation is to construct the mapping before the latency-sensitive path, not to try to outsmart the resize.

**A colleague proposes storing 200,000 rows in a dict keyed by id "because dicts are O(1)". What do you ask?**
What the *other* queries are. A dict is *O*(1) for exact-key access and *O*(n) for absolutely everything else — range queries, prefix matches, "all rows where status is X", ordering by a non-key field. If the workload is only ever "give me the row with this id", the dict is right. As soon as a second access pattern appears you are either building a second index by hand, or you have rediscovered why databases exist.

---

← [01 · The hash table underneath](01-the-hash-table-underneath.md) · [Topic index](README.md) · Next → [03 · Insertion order is a language guarantee](02-insertion-order-is-a-guarantee.md)
