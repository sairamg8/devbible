---
title: "json.dumps turns every dict key into a string on the way out and json.loads never turns it back — so loads(dumps(d)) == d is false for any non-string key, two distinct keys can serialise to one name, sort_keys sorts before converting, and the default= hook you wrote for values is never called for keys"
sidebar_label: "26 · Dicts and JSON"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 [`json` documentation](https://docs.python.org/3.14/library/json.html) — `dumps` note on keys, `skipkeys`, `default`, `sort_keys`, `object_pairs_hook`, the conversion table, and *Repeated Names Within an Object*. Key conversion order and error strings read from [`Lib/json/encoder.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/json/encoder.py) and [`Modules/_json.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_json.c) at CPython **v3.14.7**, not from a run. Target: **CPython 3.14** (3.14.7). **No sandbox run.**

**A Python dict and a JSON object look identical and are not. A JSON object's names are always strings; a dict's keys can be any hashable. `json.dumps` bridges the gap by converting `int`, `float`, `bool` and `None` keys to strings and raising on everything else — and `json.loads` hands you back strings, never the original types. The documentation says so in one sentence: *"`loads(dumps(x)) != x` if x has non-string keys."* Every bug on this page is a consequence: the cache keyed by user id that misses after a restart, the two keys that became one name, the UUID-keyed dict your custom encoder still cannot serialise, and the signature that changes when a dict round-trips.**

## The documented rule

> *"Keys in key/value pairs of JSON are always of the type `str`. When a dictionary is converted into JSON, all the keys of the dictionary are coerced to strings. As a result of this, if a dictionary is converted into JSON and then back into a dictionary, the dictionary may not equal the original one. That is, `loads(dumps(x)) != x` if x has non-string keys."*

```python
import json

hits = {101: 5, 102: 7}
restored = json.loads(json.dumps(hits))
restored == hits          # False — the keys are now '101' and '102'
restored[101]             # KeyError
restored["101"]           # 5
```

[08 · Equal keys that collide](03d-equal-keys-that-collide.md) covers the `1` versus `"1"` half of this. This chunk is the whole conversion.

## What each key type becomes

The encoder's key branch, in the order `v3.14.7` checks it (`_iterencode_dict` in `Lib/json/encoder.py`; the C encoder in `Modules/_json.c` uses the same order):

| Key | Written as | Note |
|---|---|---|
| `str` | itself | — |
| `float` | the float's string form: `1.5` → `"1.5"`, `1.0` → `"1.0"` | `nan`/`inf` → `"NaN"`/`"Infinity"`, or `ValueError` with `allow_nan=False` |
| `True` / `False` | `"true"` / `"false"` | checked **before** `int` — the C source: *"This must come before the PyLong_Check because True and False are also 1 and 0."* |
| `None` | `"null"` | — |
| `int` (including `IntEnum`) | the decimal string: `101` → `"101"` | uses `int`'s repr, so an `IntEnum` member becomes `"1"`, not `"Level.LOW"` |
| anything else | `TypeError: keys must be str, int, float, bool or None, not <type>` | or silently dropped with `skipkeys=True` |

Three rows deserve a second look.

**`StrEnum` keys stay readable; `Enum` keys fail.** A `StrEnum` member *is* a `str`, so it is written as its value. A plain `Enum` member is none of the accepted types and raises.

**`1` and `1.0` are one dict key but two JSON spellings.** `{1: "a"}` and `{1.0: "a"}` are equal dicts; they serialise as `{"1": "a"}` and `{"1.0": "a"}`. Which one you get depends on which key object was inserted *first*, because updating an existing key keeps the original key object — so two equal dicts can produce different JSON.

**`True` is not `"True"`.** A bool key becomes the JSON literal spelling, lower-case, as a string.

## The `default=` hook never sees keys

`default` is documented as *"A function that is called for objects that can't otherwise be serialized."* In `v3.14.7` the key branch never calls it: a key that is not `str`/`int`/`float`/`bool`/`None` goes straight to `skipkeys` or `raise TypeError(...)`. So an encoder that handles `UUID`, `datetime` or `Decimal` perfectly as *values* still fails on a dict keyed by them:

```python
import json
import uuid
from datetime import date

def encode(obj: object) -> object:
    if isinstance(obj, (uuid.UUID, date)):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

json.dumps({"id": uuid.uuid4()}, default=encode)            # fine: UUID is a value
json.dumps({uuid.uuid4(): "alice"}, default=encode)         # TypeError: keys must be str, int, float, bool or None, not UUID
```

Keys have to be converted before serialisation, recursively if the structure nests:

```python
def stringify_keys(obj: object) -> object:
    if isinstance(obj, dict):
        return {str(key): stringify_keys(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [stringify_keys(item) for item in obj]
    return obj

json.dumps(stringify_keys(owners_by_id), default=encode)
```

## `skipkeys=True` is data loss with the error turned off

> *"If `True`, keys that are not of a basic type (`str`, `int`, `float`, `bool`, `None`) will be skipped instead of raising a `TypeError`."*

"Skipped" means the entry is not written. Nothing is logged, nothing is returned to tell you. A payload that loses a tuple-keyed section this way deserialises fine and is simply missing data. Use it only where dropping unrepresentable entries is the specified behaviour, never as a way to make an error go away.

## Two keys, one name

Coercion can map distinct dict keys to the same JSON name, and the encoder writes both:

```python
json.dumps({1: "int key", "1": "str key"})       # '{"1": "int key", "1": "str key"}'
json.dumps({None: "none", "null": "text"})       # '{"null": "none", "null": "text"}'
```

That is a JSON object with a repeated name. Python's decoder accepts it and keeps the last:

> *"The RFC specifies that the names within a JSON object should be unique, but does not mandate how repeated names in JSON objects should be handled. By default, this module does not raise an exception; instead, it ignores all but the last name-value pair for a given name"*

So the round trip silently drops one entry — and a consumer in another language may keep the *first* instead, because the RFC leaves it open. Detect repeated names on input with `object_pairs_hook`, which receives *"an ordered list of pairs"* before any dict is built:

```python
def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON name {key!r}")
        result[key] = value
    return result

payload = json.loads(raw, object_pairs_hook=reject_duplicates)
```

## `sort_keys` sorts the original keys

`sort_keys` defaults to `False`, so output follows insertion order ([04 · Working with the order](02b-working-with-the-order.md)). When it is `True`, `v3.14.7` sorts **before** converting keys — `items = sorted(dct.items())` in the Python encoder, `PyList_Sort(items)` on the item list in C. Two consequences:

**Mixed key types raise.** `{1: "a", "b": 2}` cannot be sorted — `int` and `str` do not order — so `json.dumps(..., sort_keys=True)` raises `TypeError` from the comparison.

**The canonical form changes after a round trip.** Integer keys sort numerically before conversion; after a round trip they are strings and sort lexicographically:

```python
original = {2: "b", 10: "a"}
json.dumps(original, sort_keys=True)                       # '{"2": "b", "10": "a"}'   — 2 < 10
json.dumps(json.loads(json.dumps(original)), sort_keys=True)  # '{"10": "a", "2": "b"}' — "10" < "2"
```

A signature, cache key or content hash computed over `dumps(sort_keys=True)` of an int-keyed dict does not match the same computation over the dict after it has been through JSON once. Canonicalise with string keys from the start:

```python
def canonical(payload: dict) -> str:
    return json.dumps(stringify_keys(payload), sort_keys=True, separators=(",", ":"))
```

## Values change too

Keys are the sharp edge, but the conversion table is lossy for values as well: `list, tuple` both become a JSON array and come back as `list`, so a dict of tuples round-trips into a dict of lists. `set` has no row in the table at all and raises unless `default` handles it. Any mapping that is not a `dict` — `UserDict`, `MappingProxyType`, `ChainMap` — also has no row and reaches `default`; see [23 · `UserDict` and the mapping ABCs](09b-userdict-and-the-mapping-abcs.md).

## Restoring key types on the way in

JSON carries no type information for keys, so the reader must know the schema. Convert explicitly, at the boundary:

```python
def load_hits(raw: str) -> dict[int, int]:
    return {int(user_id): count for user_id, count in json.loads(raw).items()}
```

For nested structures, `object_pairs_hook` runs for every object in the document and is the place to apply a key conversion everywhere at once:

```python
def int_keys_where_possible(pairs: list[tuple[str, object]]) -> dict[object, object]:
    def convert(key: str) -> object:
        try:
            return int(key)
        except ValueError:
            return key
    return {convert(key): value for key, value in pairs}

data = json.loads(raw, object_pairs_hook=int_keys_where_possible)
```

⚠️ That heuristic is exactly as good as your schema: it will also turn a zip code or a zero-padded id like `"007"` into an int, and `int()` accepts more spellings than a JSON writer would produce — surrounding whitespace, underscores between digits. Prefer an explicit conversion per known field.

## Gotchas

**★ Symptom: a cache keyed by integer id misses every entry after being reloaded from JSON.** Cause: keys were coerced to strings on `dumps` and `loads` never converts back — *"`loads(dumps(x)) != x` if x has non-string keys."* Fix: convert keys when loading.

```python
cache = {int(key): value for key, value in json.loads(raw).items()}
```

**★ Symptom: `TypeError: keys must be str, int, float, bool or None, not UUID` even though a `default=` handler covers `UUID`.** Cause: the encoder's key branch never calls `default`. Fix: stringify keys before encoding.

```python
json.dumps({str(k): v for k, v in owners_by_id.items()}, default=encode)
```

**★ Symptom: a section of a payload is missing on the receiving side and nothing failed.** Cause: `skipkeys=True` silently dropped entries whose keys were tuples or other non-basic types. Fix: remove `skipkeys` and convert those keys deliberately.

```python
wire = {"|".join(key): value for key, value in metrics.items()}
json.dumps(wire)
```

**★ Symptom: after a round trip, one of two entries is gone.** Cause: two distinct keys — `1` and `"1"`, `None` and `"null"`, `True` and `"true"` — coerced to the same JSON name, and `loads` *"ignores all but the last name-value pair"*. Fix: do not mix key types in a dict that crosses JSON; detect collisions before encoding.

```python
def json_name(key: object) -> str:
    """The object name json.dumps will write for this key (v3.14.7 conversion order)."""
    if isinstance(key, str):
        return key
    if key is True:
        return "true"
    if key is False:
        return "false"
    if key is None:
        return "null"
    if isinstance(key, float):
        return float.__repr__(key)
    if isinstance(key, int):
        return int.__repr__(key)
    raise TypeError(f"not a JSON key type: {type(key).__name__}")

names = [json_name(k) for k in d]
if len(set(names)) != len(names):
    raise ValueError("keys collide after JSON coercion")
```

**★ Symptom: an HMAC over `json.dumps(payload, sort_keys=True)` fails verification after the payload is stored and reloaded.** Cause: int keys were sorted numerically before the round trip and as strings after it. Fix: canonicalise with string keys on both sides.

```python
body = json.dumps(stringify_keys(payload), sort_keys=True, separators=(",", ":"))
```

**Symptom: `json.dumps(d, sort_keys=True)` raises `TypeError` about `<` between `str` and `int`.** Cause: `sort_keys` sorts the original keys before converting them, and mixed types do not order. Fix: stringify the keys first.

```python
json.dumps({str(k): v for k, v in d.items()}, sort_keys=True)
```

**Symptom: a document with a repeated name is accepted and a security-relevant field has an unexpected value.** Cause: by default the decoder keeps the last occurrence; another parser in the chain may keep the first. Fix: reject repeated names with `object_pairs_hook`.

```python
json.loads(raw, object_pairs_hook=reject_duplicates)
```

**Symptom: a dict keyed by `Enum` members cannot be serialised, but one keyed by `IntEnum` members serialises as `"1"`, `"2"`.** Cause: `IntEnum` members are ints and use int's repr; plain `Enum` members are not an accepted key type. Fix: key by `.value` (or `.name`) explicitly, so the wire format does not depend on the enum's base class.

```python
json.dumps({level.name: count for level, count in by_level.items()})
```

**Symptom: two equal dicts serialise differently — one as `{"1": ...}`, one as `{"1.0": ...}`.** Cause: `1` and `1.0` are one dict key, and the dict keeps whichever key object was inserted first; the encoder writes that object's type. Fix: normalise key types before they enter the dict.

```python
prices = {int(k): v for k, v in raw_prices.items()}
```

**Symptom: output containing `NaN` is rejected by another service's JSON parser.** Cause: with the default `allow_nan=True`, a NaN *value* is written as the bare token `NaN` — *"This behavior is not JSON specification compliant"* — while a NaN *key* becomes the string `"NaN"`, which is valid JSON and a meaningless key. Fix: `allow_nan=False`, which raises `ValueError` for out-of-range floats in keys and values alike, and keep NaN out of keys entirely.

```python
json.dumps(payload, allow_nan=False)
```

**Symptom: tuple values come back as lists and a `(lat, lon) in known_points` check fails.** Cause: the conversion table maps both `list` and `tuple` to a JSON array, decoded as `list`. Fix: rebuild the tuples at load time.

```python
points = {name: tuple(coords) for name, coords in json.loads(raw).items()}
```

## Interview questions

**★ Why doesn't `json.loads(json.dumps(d)) == d` hold for `d = {1: "a"}`?**
Because JSON object names are always strings, so `dumps` converts the key `1` to `"1"`, and `loads` has no type information to convert it back. The documentation states the consequence in exactly those terms: *"`loads(dumps(x)) != x` if x has non-string keys."* The fix is schema knowledge at the boundary — convert keys explicitly after loading, or keep string keys in anything that crosses JSON.

**★ Your encoder's `default=` handles `UUID`. Why does a UUID-keyed dict still fail?**
Because `default` is only consulted for values the encoder cannot otherwise serialise. The key branch of the encoder converts `str`, `int`, `float`, `bool` and `None` and otherwise either skips the entry (`skipkeys=True`) or raises `TypeError: keys must be str, int, float, bool or None, not UUID` — it never calls `default`. Keys must be converted before `dumps` sees the dict.

**★ How can serialising a dict lose data without an error?**
Three ways. `skipkeys=True` drops entries with non-basic keys. Two distinct keys that coerce to the same name — `1` and `"1"`, `None` and `"null"` — are both written, and the decoder keeps only the last. And values lose type: tuples come back as lists. None of these raises, so each needs an explicit guard: no `skipkeys`, a collision check before encoding, and type restoration on load.

**Why can `sort_keys=True` produce different output for a dict before and after a JSON round trip?**
Because the encoder sorts the dict's items by their *original* keys and converts them to strings afterwards. Integer keys sort numerically (`2` before `10`); after a round trip they are strings and sort lexicographically (`"10"` before `"2"`). Anything computed over the canonical form — signatures, ETags, cache keys — changes. Canonicalise with string keys from the start. The same ordering-before-conversion is why mixed `int`/`str` keys make `sort_keys=True` raise.

**What does Python do with a JSON object that repeats a name, and how do you change it?**
It accepts it and keeps the last value — *"it ignores all but the last name-value pair for a given name"*, which the RFC permits because it leaves the behaviour undefined. Other parsers may keep the first, which makes repeated names a known vector for inconsistent interpretation between services. `object_pairs_hook` receives the raw list of pairs for every object, so a hook that raises on a repeated key makes the decoder strict.

**How do you restore integer keys when loading?**
Explicitly, with schema knowledge: `{int(k): v for k, v in json.loads(raw).items()}` for a known field, or an `object_pairs_hook` that converts keys for every object in the document when the whole structure is uniformly int-keyed. A generic "convert anything that looks numeric" hook is a trap — it turns zip codes and zero-padded identifiers into integers — so prefer per-field conversion.

**Why does the key `True` become `"true"` rather than `"1"`?**
Because the encoder checks for `True`, `False` and `None` before it checks for `int`, and writes JSON's own literal spellings. The C encoder's source comment gives the reason for the order: *"This must come before the PyLong_Check because True and False are also 1 and 0."* The consequence to remember is that `True` and `1` are the same *dict* key but would produce different JSON names — so the name you get depends on which key object was stored first.

---

← [25 · `dict` across threads](10-dict-across-threads.md) · [Topic index](README.md) · Next topic → **04 · `set` and `frozenset`** *(not written yet)* · [Phase index](../README.md)
