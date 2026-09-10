---
title: "1, 1.0 and True are one dictionary key, not three — the documentation says so outright, and the entry that survives is not the one you would guess"
sidebar_label: "08 · Equal keys that collide"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [`hash()`](https://docs.python.org/3.14/library/functions.html#hash), [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types), [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex), [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations), [`enum.IntEnum`](https://docs.python.org/3.14/library/enum.html#enum.IntEnum). Key-retention behaviour read from `insertdict` in `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A dictionary does not have three keys `1`, `1.0` and `True` — it has one. That is not a quirk, it is the direct consequence of the rule that equal objects must hash equally, applied to a numeric tower where `1 == 1.0` and `True == 1`. The documentation states the outcome in a single sentence in the `dict` reference. What it does not tell you, and what surprises everyone, is which of the three key objects survives: the first one inserted, forever, no matter how many times a different-looking equal key overwrites the value.**

## The sentence, and the rule beneath it

🔴 > *"Values that compare equal (such as `1`, `1.0`, and `True`) can be used interchangeably to index the same dictionary entry."*

That sits directly under the sentence about hashable keys in `stdtypes`, and it is the whole behaviour. Two supporting rules produce it.

**Booleans are integers.** From the numeric types section:

> *"There are three distinct numeric types: integers, floating-point numbers, and complex numbers. In addition, Booleans are a subtype of integers."*

So `True == 1` and `False == 0` are ordinary integer comparisons, not coercions.

**Numeric hashing is defined across types.** From `hash()`:

> *"Numeric values that compare equal have the same hash value (even if they are of different types, as is the case for 1 and 1.0)."*

and from the numeric-hash section, the reason it can be guaranteed at all:

> *"For numbers `x` and `y`, possibly of different types, it's a requirement that `hash(x) == hash(y)` whenever `x == y` … For ease of implementation and efficiency across a variety of numeric types (including `int`, `float`, `decimal.Decimal` and `fractions.Fraction`) Python's hash for numeric types is based on a single mathematical function that's defined for any rational number … Essentially, this function is given by reduction modulo `P` for a fixed prime `P`."*

So this is not just `int` and `float`. **`Decimal("1")`, `Fraction(1, 1)`, `1`, `1.0`, `True` and `complex(1, 0)` are all the same dictionary key.**

## What actually ends up in the dict

```python
flags = {}
flags[1] = "int"
flags[1.0] = "float"
flags[True] = "bool"

len(flags)          # 1
```

One entry. The value is `"bool"` — the last write wins, as it does for any repeated assignment. The key, however, is **`1`**, the integer that was inserted first.

That is because assigning to an existing key writes only the value. `insertdict` in `Objects/dictobject.c` at `v3.14.7` looks the key up, finds an existing value, and reaches `STORE_VALUE(ep, value)` — it never touches the stored `me_key`, and it releases its reference to the key you passed in. The user-visible half of the same fact is documented: *"Note that updating a key does not affect the order."* Position and identity of the key both survive; only the value changes.

The literal form has the same outcome, and the language reference explains why it is not an error:

> *"you can specify the same key multiple times in the dict item list, and the final dictionary's value for that key will be the last one given."*

> *"Clashes between duplicate keys are not detected; the last value (textually rightmost in the display) stored for a given key value prevails."*

```python
{1: "int", 1.0: "float", True: "bool"}     # one entry: key 1, value "bool"
{"a": 1, "a": 2}                            # one entry: key "a", value 2
```

🔴 **"Clashes … are not detected."** There is no warning, no linter default, and nothing at runtime. A config literal with a duplicated key silently loses one of them.

## Where this actually bites

**A "type-tagged" cache.** Two logically different things collapse:

```python
# intended: separate buckets for the boolean flag and the numeric level
results = {}
results[True] = compute_for_enabled()
results[1] = compute_for_level_one()      # 🔴 overwrote the True entry
```

**A JSON round-trip.** JSON object keys are strings — always. A dict keyed on integers survives `dumps`/`loads` as a dict keyed on the *string forms*, and `1 != "1"`:

```python
import json

counts = {1: "one", 2: "two"}
restored = json.loads(json.dumps(counts))
restored                       # keys are now "1" and "2"
restored[1]                    # KeyError — the key is the string "1"
```

There is no collision here — `1` and `"1"` are genuinely different keys, which is the *opposite* failure and just as common. Convert explicitly on the way back in:

```python
restored = {int(k): v for k, v in json.loads(raw).items()}
```

**`IntEnum` members.** The enum documentation says *"IntEnum is the same as Enum, but its members are also integers and can be used anywhere that an integer can be used"* — including as the same dictionary key as the bare integer:

```python
from enum import Enum, IntEnum

class Level(IntEnum):
    LOW = 1
    HIGH = 2

d = {Level.LOW: "enum", 1: "int"}      # one entry — Level.LOW == 1
```

A plain `Enum` does not do this; its members are not equal to their values, so `{Colour.RED: ...}` and `{"r": ...}` are two keys. That asymmetry is a good reason to prefer plain `Enum` for anything that becomes a dict key, and to reach for `IntEnum`/`StrEnum` only where interoperability with a protocol actually demands it.

**Redis, HTTP headers and other string-keyed stores.** Anything that goes over a wire comes back as text. `d[b"key"]` and `d["key"]` are different entries — `bytes` and `str` never compare equal — which is the same class of bug as the JSON one and shows up in every `redis-py` codebase that has not set `decode_responses=True`.

## The floating-point corner cases

**`-0.0` and `0.0` are the same key.** They compare equal, so they must hash equally.

```python
d = {0.0: "zero"}
d[-0.0] = "negative zero"
len(d)                      # 1 — the value is overwritten
```

**`nan` is a key you can insert and often cannot look up.** `float("nan")` is not equal to itself, so an *equal* lookup can never match. It still works when you present the identical object, because membership and lookup are defined with an identity shortcut. The language reference states it for containers generally:

> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."*

```python
nan = float("nan")
d = {nan: "first"}

d[nan]                       # works — the *same object*, matched by identity
d[float("nan")]              # KeyError — a different nan object, and nan != nan
len({float("nan"): 1, float("nan"): 2})    # 2 — two distinct entries
```

⚠️ Two different `nan` objects can therefore both live in the same dict, and neither can be found by constructing a fresh `nan`. If NaN can reach your keys, filter it at the boundary:

```python
import math

clean = {k: v for k, v in raw.items() if not (isinstance(k, float) and math.isnan(k))}
```

**Large integers and floats stop colliding where the float loses precision.** `10**16 == 1e16` is `True` and they are one key; `10**16 + 1 == 1e16` is `False` and they are two. There is nothing special about `dict` here — it is float precision, and the dict faithfully reflects it. The consequence is that "ints and floats are the same key" holds exactly as far as `==` does, and no further.

## Preventing the collision instead of documenting it

If two logically distinct things must be distinct keys, **make the key carry the distinction**. A tuple with a discriminator is the cheap, readable version:

```python
results = {}
results[("flag", True)] = compute_for_enabled()
results[("level", 1)] = compute_for_level_one()
```

For a key space that arrives as text, normalise once at the edge and annotate the type so the collapse cannot happen:

```python
def parse_levels(raw: dict[str, str]) -> dict[int, str]:
    return {int(key): value for key, value in raw.items()}
```

## Gotchas

**★ Symptom: a dict literal with three entries has `len() == 2`.** Cause: two keys compare equal — most often `1` and `True`, or `1` and `1.0`, or a duplicated string key. *"Clashes between duplicate keys are not detected; the last value … prevails."* Fix: discriminate the keys with a tuple tag, or use different types that genuinely do not compare equal.

```python
handlers = {("bool", True): on_enabled, ("int", 1): on_level_one}
```

**★ Symptom: `d[True]` returns the value someone wrote under `d[1]`.** Cause: *"Booleans are a subtype of integers"*, so `True == 1` and they hash identically — they are one entry. Fix: never mix boolean and integer keys in one mapping; if a mapping is keyed by "either a flag or a level", it is really two mappings.

**★ Symptom: after a JSON round-trip, every integer-keyed lookup raises `KeyError`.** Cause: JSON object keys are strings, and `1 != "1"`. Fix: convert on the way back, explicitly.

```python
restored = {int(key): value for key, value in json.loads(raw).items()}
```

**★ Symptom: the key stored in the dict has a different type from the one you last assigned.** Cause: assignment to an existing key replaces the value and keeps the original key object — visible in `insertdict`, which reaches `STORE_VALUE` without touching the stored key. Fix: if the key's type matters downstream (it usually does for serialisation), delete and reinsert to replace it, and accept that this also moves the entry to the end.

```python
del d[1]
d[1.0] = value     # now the stored key really is the float — and it is last
```

**★ Symptom: `Level.LOW` and `1` are the same entry in a routing table.** Cause: `IntEnum` members *"are also integers and can be used anywhere that an integer can be used"*. Fix: use a plain `Enum` for keys — its members are not equal to their values, so no collision is possible.

```python
from enum import Enum

class Level(Enum):
    LOW = 1
    HIGH = 2
```

**Symptom: a `Decimal` price key does not create a separate entry from the `float` one.** Cause: the numeric hash is *"based on a single mathematical function that's defined for any rational number"*, so `Decimal("1")`, `1` and `1.0` all hash and compare equal. Fix: key on the string form when the representation is part of the identity.

```python
prices[str(amount)] = row          # "1" and "1.0" are then distinct
```

**Symptom: `-0.0` overwrote the `0.0` entry.** Cause: `-0.0 == 0.0`, so equal hashes, so one entry. Fix: normalise the sign at the boundary if the distinction matters.

```python
key = value + 0.0          # collapses -0.0 to 0.0 explicitly, at one place
```

**Symptom: a dict grows without bound and the extra keys all look identical in a log.** Cause: `nan` keys. Each fresh `float("nan")` is a new entry, because `nan != nan` means an equality match can never happen and the identity shortcut only matches the same object. Fix: reject NaN before it reaches a key.

```python
if isinstance(key, float) and math.isnan(key):
    raise ValueError("NaN is not a valid key")
```

**Symptom: `d[nan]` works in one place and raises `KeyError` in another with "the same" key.** Cause: the working call passed the identical object; the failing one passed a different `nan`. `in` and lookup are *"equivalent to `any(x is e or x == e for e in y)"`* — identity first, then equality, and equality never succeeds for NaN. Fix: as above; do not key on NaN.

**Symptom: `redis` lookups miss although the key "is right there".** Cause: the client returned `bytes` and your dict is keyed on `str`; they never compare equal. Fix: decode at the client boundary rather than at each call site.

```python
client = redis.Redis(decode_responses=True)     # everything comes back as str
```

## Interview questions

**★ How many entries does `{1: "a", 1.0: "b", True: "c"}` have, and what is in it?**
One. The `dict` documentation states the rule directly — *"Values that compare equal (such as 1, 1.0, and True) can be used interchangeably to index the same dictionary entry."* The value is `"c"`, because later assignments to an existing key overwrite. The key is the integer `1`: assignment to an existing key updates only the value, so the first key object inserted is the one that stays. `True` is involved at all because *"Booleans are a subtype of integers"* — `True == 1` is an ordinary integer comparison.

**★ Why must `1` and `1.0` be the same key? Could Python have chosen otherwise?**
Only by giving up on `1 == 1.0`, or by breaking the invariant that equal objects hash equally. Since the numeric tower deliberately makes `int`, `float`, `Decimal` and `Fraction` comparable, and the glossary requires that *"Hashable objects which compare equal must have the same hash value"*, cross-type numeric equality forces cross-type hash equality. The documentation makes that a design commitment rather than an accident: *"For numbers x and y, possibly of different types, it's a requirement that hash(x) == hash(y) whenever x == y."*

**★ You round-trip a dict with integer keys through JSON and every lookup fails. Why?**
Because JSON object keys are strings by specification, so `1` becomes `"1"` on the way out and stays `"1"` on the way back. `1 == "1"` is `False`, so these are two genuinely different keys — the opposite problem from the `1`/`True` collision, and the reason both belong on the same page. The fix is an explicit conversion on load, `{int(k): v for k, v in loaded.items()}`, which also has the virtue of failing loudly on a key that is not an integer.

**★ Can you put `float("nan")` in a dict, and can you get it back out?**
You can put it in — NaN is hashable. Getting it back depends on *which* NaN you present. Lookup is defined as identity-or-equality (*"`x in y` is equivalent to `any(x is e or x == e for e in y)"`*), and NaN is never equal to anything including itself, so only the identical object matches. A freshly constructed `float("nan")` raises `KeyError`, and inserting two separately constructed NaNs gives you two entries. In practice this means NaN keys accumulate and cannot be looked up by value, which is why filtering them at the boundary is the only sane policy.

**Why is `IntEnum` a bad choice for dictionary keys?**
Because its members *"are also integers and can be used anywhere that an integer can be used"* — including as the same key as the bare integer. A mapping that holds both `Level.LOW` and `1` has one entry, and which of the two you get back depends on insertion order. A plain `Enum` has no such equality with its value, so its members are always distinct keys. Reach for `IntEnum` when a protocol needs the integer, and convert at that boundary rather than letting the dual identity leak into your data structures.

**A dict literal has a duplicated key. What does Python do?**
Nothing you will notice. The language reference is explicit: *"Clashes between duplicate keys are not detected; the last value (textually rightmost in the display) stored for a given key value prevails."* No exception, no warning. This is the same rule that makes `{**defaults, **overrides}` work, so it cannot be changed — but it does mean a hand-maintained configuration literal can lose an entry to a copy-paste and stay syntactically perfect. That is what a schema check or a linter rule is for, not the interpreter.

---

← [07 · The key that mutates](03c-the-key-that-mutates.md) · [Topic index](README.md) · Next → [09 · Reading a key](04-reading-a-key.md)
