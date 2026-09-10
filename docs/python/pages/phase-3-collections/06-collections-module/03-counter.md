---
title: "A Counter is a dict of element → count whose missing keys read as zero without being stored — and its constructor, update() and zero counts each mean something different from the dict they look like, which is where every counting bug comes from"
sidebar_label: "03 · Counter — counting semantics"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#counter-objects) (constructor, `elements`, `subtract`, `total`, `fromkeys`, `update`, the type-restrictions note, the common-patterns block), [`json`](https://docs.python.org/3.14/library/json.html). Method bodies read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`class Counter`, lines 551–991) and the C counting helper in [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c) — implementation detail where the docs are silent. Target: **Python 3.14.7**. **No sandbox run.**

**`Counter` is the documentation's *"dict subclass for counting hashable objects"*: elements are the keys, counts are the values, and a missing element reads as `0`. That last rule is implemented as a `__missing__` that returns `0` *without inserting* — so, unlike `defaultdict(int)`, reading a Counter never grows it. Everything else that trips people up is a place where Counter deliberately differs from `dict`: the constructor and `update()` treat a plain iterable as *elements to count*, so a string is counted letter by letter and a list of `(key, count)` pairs is counted as tuples; `update()` *adds* instead of replacing; a count set to zero stays in the counter until you `del` it; `del` on a missing element does not raise; `fromkeys()` refuses to run; and the `repr` is sorted by count, not by insertion. Each is documented or visible in thirty lines of source, and each is a bug in somebody's report job.**

## What it is

> *"A `Counter` is a `dict` subclass for counting hashable objects. It is a collection where
> elements are stored as dictionary keys and their counts are stored as dictionary values. Counts
> are allowed to be any integer value including zero or negative counts. The `Counter` class is
> similar to bags or multisets in other languages."*

```python
from collections import Counter

status_codes = Counter(response.status for response in responses)
status_codes[200]          # how many 200s
status_codes[418]          # 0 — never seen, and still not a key afterwards
```

`Counter.__missing__` in `v3.14.7` is two lines — the comment *"Needed so that self[missing_item] does not raise KeyError"* and `return 0`. It stores nothing. So you can read counts for arbitrary keys from a request handler, inside a loop over the same counter, or in a report, without the growth problem that makes a `defaultdict(int)` dangerous ([02b](02b-defaultdict-in-production.md)). The key is inserted only when you write — `c[k] += 1` reads `0`, adds one, and assigns.

## The constructor counts elements — so it depends on what you pass

> *"Elements are counted from an *iterable* or initialized from another *mapping* (or counter)"*

The documentation's four forms:

```python
c = Counter()                           # a new, empty counter
c = Counter("gallahad")                 # a new counter from an iterable
c = Counter({"red": 4, "blue": 2})      # a new counter from a mapping
c = Counter(cats=4, dogs=8)             # a new counter from keyword args
```

In `v3.14.7`, `__init__` is `super().__init__()` followed by `self.update(iterable, **kwds)`, and `update` branches on one test: `isinstance(iterable, collections.abc.Mapping)`. A mapping supplies counts; anything else is iterated and each item is counted once. Two consequences:

```python
Counter("error")                    # counts 'e', 'r', 'o' — a str is an iterable of characters
Counter(["error"])                  # Counter({'error': 1}) — what was meant

pairs = [("timeout", 3), ("dns", 1)]
Counter(pairs)                      # counts the TUPLES: {('timeout', 3): 1, ('dns', 1): 1}
Counter(dict(pairs))                # {'timeout': 3, 'dns': 1} — the documented conversion
```

The documentation says it outright for `update` — *"the *iterable* is expected to be a sequence of elements, not a sequence of `(key, value)` pairs"* — and its common-patterns block lists `Counter(dict(list_of_pairs))` as the way to *"convert from a list of (elem, cnt) pairs"*.

## `update()` adds; `subtract()` subtracts; neither replaces

> *"Like `dict.update()` but adds counts instead of replacing them."*

The source comment explains why the method was redefined rather than inherited: *"The regular dict.update() operation makes no sense here because the replace behavior results in some of the original untouched counts being mixed-in with all of the other counts for a mismash that doesn't have a straight-forward interpretation in most counting contexts."*

```python
errors = Counter({"timeout": 3})
errors.update({"timeout": 2, "dns": 1})     # adds: timeout 5, dns 1
errors.update(["dns", "dns"])               # elements: dns 3
errors.update("dns")                        # 🔴 characters: 'd', 'n', 's' each +1
errors.subtract({"timeout": 6})             # timeout -1 — counts may go negative
```

`subtract` — *"Both inputs and outputs may be zero or negative."* That is by design for running balances (stock levels, quota accounting), and it means a counter that went through `subtract` can hold negative counts that every later consumer has to expect.

## Zero is a count, not an absence

> *"Setting a count to zero does not remove an element from a counter. Use `del` to remove it
> entirely"*

The class docstring in the source repeats it for decrements: *"If a count is set to zero or reduced to zero, it will remain in the counter until the entry is deleted or the counter is cleared"*. A zero-count key is a real key: it is in `len(c)`, `list(c)`, `set(c)`, `c.keys()`, `k in c`, and `most_common()`:

```python
active_sessions = Counter({"ada": 2, "grace": 1})
active_sessions["grace"] -= 1            # grace: 0 — still a key

"grace" in active_sessions               # True
len(active_sessions)                     # 2
active_sessions["grace"] > 0             # False — the question you meant to ask
```

Three ways to get the multiset view, where only positive counts exist:

```python
+active_sessions                         # new Counter, zero and negative counts dropped
active_sessions += Counter()             # the same, in place — the source comment's own idiom
del active_sessions["grace"]             # remove one element entirely
```

`del` is overridden too: `Counter.__delitem__` is *"Like dict.__delitem__() but does not raise KeyError for missing values"* — convenient for "decrement and remove at zero" code, and a place where a misspelt key disappears silently.

## `total()`, `elements()`, and the refused `fromkeys()`

`total()` (3.10) — *"Compute the sum of the counts"* — is `sum(self.values())`, so negative counts subtract from it.

`elements()` — *"Return an iterator over elements repeating each as many times as its count. Elements are returned in the order first encountered. If an element's count is less than one, `elements()` will ignore it."* In the source it is `chain.from_iterable(starmap(repeat, self.items()))`, which is why the type note says it *"requires integer counts"* — `repeat` will not repeat something 2.5 times. The method's docstring in the `v3.14.7` source uses Knuth's example: prime factors as a counter, `Counter({2: 2, 3: 3, 17: 1})`, multiplied back out with `math.prod(prime_factors.elements())`.

`fromkeys()` — *"This class method is not implemented for `Counter` objects."* It raises `NotImplementedError('Counter.fromkeys() is undefined.  Use Counter(iterable) instead.')`; the source comment gives the reason — *"the semantics would be ambiguous in cases such as Counter.fromkeys('aaabbc', v=2)"* — and the alternatives:

```python
Counter(set(tags))                        # every distinct tag with a count of one
Counter(dict.fromkeys(expected_codes, 0)) # explicit zeros, e.g. so a report lists every code
```

## The `repr` is sorted by count

`Counter.__repr__` in `v3.14.7` builds `dict(self.most_common())` — so what you see in a log or a debugger is ordered most-common first, while iteration, `items()` and `dict(c)` keep insertion order (the 3.7 change: *"As a `dict` subclass, `Counter` inherited the capability to remember insertion order."*). Two counters with the same counts print the same even if they were built in different orders; one counter prints in a different order from the one its `for` loop visits. If the values are not orderable, the `repr` falls back to plain insertion order.

## Values that are not integers

> *"The `Counter` class itself is a dictionary subclass with no restrictions on its keys and
> values. The values are intended to be numbers representing counts, but you *could* store
> anything in the value field."*
> *"For in-place operations such as `c[key] += 1`, the value type need only support addition and
> subtraction. So fractions, floats, and decimals would work and negative values are supported."*

So a Counter is a reasonable "sum by key" for money in `Decimal` or durations in `float` — `spend[customer] += order.total`. `most_common` then needs only orderable values; `elements()` stops working (integer counts only); and the multiset operators of [03c · `Counter` — multiset arithmetic](03c-counter-multiset-math.md) need addition, subtraction and comparison.

## Gotchas

**★ Symptom: a word counter reports `'e': 412, 'r': 390` instead of words.** Cause: a `str` was passed where an iterable of words was expected — `Counter(line)` or `counter.update(word)` — and a string is iterated character by character. Fix: pass an iterable of the elements, or wrap a single element.

```python
words = Counter(line.split())
words.update([word])                     # or: words[word] += 1
```

**★ Symptom: `Counter([("timeout", 3), ("dns", 1)])` gives every pair a count of 1.** Cause: a non-mapping iterable is *elements*, and each tuple is an element. Fix: turn the pairs into a mapping first.

```python
errors = Counter(dict(pairs))
```

**★ Symptom: a report lists users with zero active sessions, and `if user in sessions:` is true for users who logged out.** Cause: a count decremented to zero stays as a key. Fix: test the count, or strip non-positive counts before reporting.

```python
logged_in = [user for user, n in sessions.items() if n > 0]
report = +sessions
```

**★ Symptom: counts keyed by HTTP status read as zero after a round trip through a JSON cache.** Cause: JSON object keys are strings, so `{404: 3}` comes back as `{'404': 3}`, and `c[404]` is a missing key — which a Counter silently reads as `0` instead of raising. Fix: convert keys on the way back in.

```python
codes = Counter({int(code): n for code, n in json.loads(raw).items()})
```

**Symptom: `NotImplementedError: Counter.fromkeys() is undefined.  Use Counter(iterable) instead.`** Cause: the method is deliberately refused. Fix: say which counts you mean.

```python
seen_once = Counter(set(items))
all_zero = Counter(dict.fromkeys(keys, 0))
```

**Symptom: `del counts["tiemout"]` "works" and the timeout count is still there.** Cause: `Counter.__delitem__` does not raise for a missing key, so the typo is silent. Fix: when absence is a bug, check first — or use `pop`, which is inherited from `dict` and does raise.

```python
counts.pop("timeout")                    # KeyError if the key is not there
```

**Symptom: a stock-level counter shows negative quantities in the dashboard.** Cause: `subtract()` and `c[k] -= n` allow negative results — *"Both inputs and outputs may be zero or negative."* Fix: decide what negative means; clamp at the boundary, or use the multiset `-` operator, which drops non-positive results ([03c · `Counter` — multiset arithmetic](03c-counter-multiset-math.md)).

```python
shortfall = {sku: -n for sku, n in stock.items() if n < 0}
available = +stock
```

**Symptom: `TypeError` from `list(c.elements())` on a counter of weights.** Cause: `elements()` repeats each key `count` times with `itertools.repeat` and *"requires integer counts"*. Fix: do not use `elements()` on non-integer counts; iterate `items()`.

```python
weighted = [(key, weight) for key, weight in c.items() if weight > 0]
```

**Symptom: after `Counter(events)`, a second loop over `events` does nothing.** Cause: `events` was a generator (a query cursor, `map`, a file); counting consumed it. Fix: materialise once if you need two passes, or compute everything in the one pass.

```python
events = list(fetch_events())
by_type = Counter(e.kind for e in events)
by_user = Counter(e.user_id for e in events)
```

**Symptom: a "remaining quota" counter shows `-1` for a user who never had a quota.** Cause: `c[k] -= 1` on a missing key reads `0` through `__missing__`, subtracts, and *inserts* `-1`. Fix: decide whether absence is allowed before decrementing.

```python
if quota[user] <= 0:
    raise QuotaExceeded(user)
quota[user] -= 1
```

**Symptom: a log line shows a counter in a different order from the one the code processed it in.** Cause: `repr` sorts by `most_common()`; iteration follows insertion. Fix: log what you mean.

```python
logger.info("codes=%s", dict(codes))            # insertion order
logger.info("top=%s", codes.most_common(5))     # by count
```

## Interview questions

**★ What is the difference between `Counter` and `defaultdict(int)`?**
Both return `0` for a missing key, but a `defaultdict(int)` *stores* the key when you read it, while `Counter.__missing__` returns `0` without inserting — reading a Counter never grows it. Counter also redefines `update` to add counts, adds `most_common`, `elements`, `subtract` and `total`, refuses `fromkeys`, makes `del` of a missing key a no-op, adds multiset arithmetic and inclusion comparisons, and counts an iterable in one constructor call. `defaultdict(int)` is a dict with a default; Counter is a multiset with a dict interface.

**★ What do `Counter("hello")` and `Counter(["hello"])` produce, and why?**
The first counts characters — `h`, `e`, `l` twice, `o` — because a `str` is an iterable and any non-mapping iterable is treated as a stream of elements. The second has one element, `'hello'`, with count 1. The same rule makes `c.update("hello")` add five character counts, and makes `Counter(list_of_pairs)` count the pair tuples rather than use them as counts; the documented conversion for pairs is `Counter(dict(list_of_pairs))`.

**★ Why does an element with count zero still appear in a Counter?**
Because a count is just a dict value, and the documentation says *"Setting a count to zero does not remove an element from a counter. Use `del` to remove it entirely."* Counts may legitimately be zero or negative — a running balance passes through zero. So `k in c` answers "was this key ever written", not "is the count positive". For the multiset view use `+c` (drops zero and negative counts), `c += Counter()` to do it in place, or test `c[k] > 0`.

**Why is `Counter.fromkeys()` not implemented?**
The source says the semantics would be ambiguous — `Counter.fromkeys('aaabbc', v=2)` could mean "each distinct letter with count 2" or "count the letters, then something with 2". It also is not needed: zero is already the default for any missing key, `Counter(set(iterable))` gives every distinct element a count of one, and `Counter(dict.fromkeys(keys, 0))` states explicit zeros when you need them to appear in output.

**Is it safe to read a `Counter` with arbitrary keys inside a loop over the same counter?**
Yes, and that is a real difference from `defaultdict`. A missing-key read calls `__missing__`, which returns `0` and stores nothing, so the dict's size does not change and iteration is not disturbed. Writing — `c[k] += 1` for a new `k` — does insert, and inserting during iteration is the usual `RuntimeError` ([14 · Mutating while iterating](../03-dict/05b-mutating-while-iterating.md)).

**How do you find the elements that occur exactly once — say, the unique visitors in a log?**
Count, then filter: `[item for item, n in Counter(visits).items() if n == 1]`. One pass to count, one pass over the distinct elements, and the result keeps first-seen order because the Counter does. The tempting alternative — `[v for v in visits if visits.count(v) == 1]` — is a full scan per element, the quadratic pattern [03d · Partial sorts and counting](../01-list-internals/03d-partial-sorts-and-counting.md) warns about.

**What does `c[k] -= 1` do when `k` is not in the counter?**
It inserts `k` with a count of `-1`. The augmented assignment reads `c[k]` — `__missing__` returns `0` without inserting — computes `0 - 1`, and assigns the result, which inserts. That is by design for balances (*"Counts are allowed to be any integer value including zero or negative counts"*) and a bug for quotas or stock that must never go below zero; check before decrementing, or use multiset `-`, which never produces a non-positive count.

**Can a `Counter` hold non-integer counts?**
Yes. The documentation's type note: the class has *"no restrictions on its keys and values"*; `c[key] += 1`, `update` and `subtract` need only addition and subtraction, so floats, `Decimal` and `Fraction` work, negative values included; `most_common` needs only orderable values. The limits are `elements()`, which *"requires integer counts"*, and the multiset operators, which need addition, subtraction and comparison and keep only positive results.

---

← Prev: [02b · `defaultdict` in production](02b-defaultdict-in-production.md) · [Topic index](README.md) · Next → [03b · `Counter` — top-N and per-group tallies](03b-counter-top-n.md)
