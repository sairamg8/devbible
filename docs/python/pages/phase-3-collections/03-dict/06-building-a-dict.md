---
title: "There are five ways to build a dict, and they disagree about exactly three things — what counts as a key/value pair, which keys are legal, and which duplicate wins — and none of them warns you when it silently drops data"
sidebar_label: "17 · Building a dict"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays), [`zip()`](https://docs.python.org/3.14/library/functions.html#zip), [PEP 584](https://peps.python.org/pep-0584/) (the `dict(d1, **d2)` example), [PEP 448](https://peps.python.org/pep-0448/). Constructor dispatch and the pair-length error string read from `dict_update_arg` / `merge_from_seq2_lock_held` in `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag, not from a run. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**`{"a": 1}`, `dict(a=1)`, `dict([("a", 1)])`, `dict(other)` and `{k: v for …}` all produce an equal dictionary, and the documentation says so with a six-way `==`. They are not interchangeable at the edges. A display silently drops a duplicated key; the keyword form refuses any key that is not an identifier; the pairs form accepts a two-character string as a pair; `dict(zip(...))` truncates to the shorter input without a word; and every one of them copies only one level deep. This chunk is the constructor's rules, read from the documentation and the one C function that implements them.**

## The five spellings

The `stdtypes` documentation lists them and then shows they agree — *"the following examples all return a dictionary equal to `{"one": 1, "two": 2, "three": 3}`"*. Its example, verbatim:

```python
a = dict(one=1, two=2, three=3)
b = {'one': 1, 'two': 2, 'three': 3}
c = dict(zip(['one', 'two', 'three'], [1, 2, 3]))
d = dict([('two', 2), ('one', 1), ('three', 3)])
e = dict({'three': 3, 'one': 1, 'two': 2})
f = dict({'one': 1, 'three': 3}, two=2)
a == b == c == d == e == f        # the documentation shows: True
```

Note what that `==` does *not* say: the six dictionaries iterate in different orders (`d`, `e` and `f` were built in different sequences), because equality ignores order — [03 · Order is a guarantee](02-insertion-order-is-a-guarantee.md). The comprehension, the fifth spelling, has its own chunk: [18 · Dict comprehensions](06b-dict-comprehensions.md).

## Displays: left to right, last one wins, nobody tells you

> *"If a comma-separated sequence of dict items is given, they are evaluated from left to right to define the entries of the dictionary: each key object is used as a key into the dictionary to store the corresponding value. This means that you can specify the same key multiple times in the dict item list, and the final dictionary's value for that key will be the last one given."*

```python
RETRY_POLICY = {
    "max_attempts": 5,
    "backoff": "exponential",
    "max_attempts": 3,          # 🔴 silently wins; the 5 is gone
}
```

The key keeps its *first* position and takes its *last* value — the same rule as `d[k] = v` on an existing key. Nothing at runtime flags it. The defence is a linter, not the interpreter.

**`**` unpacking in a display** (PEP 448, 3.5) follows the same rule:

> *"A double asterisk `**` denotes dictionary unpacking. Its operand must be a mapping. Each mapping item is added to the new dictionary. Later values replace values already set by earlier dict items and earlier dictionary unpackings."*

```python
request_headers = {**DEFAULT_HEADERS, "Accept": "application/json", **caller_headers}
```

Left to right, last write wins: the caller's headers override the explicit `Accept`, which overrides the defaults. That is a merge, and [19 · Merging](07-merging.md) covers when to prefer `|`.

## `dict(x)`: mapping or pairs, decided by one attribute

The documentation states the dispatch:

> *"If a positional argument is given and it defines a `keys()` method, a dictionary is created by calling `__getitem__` on the argument with each returned key from the method. Otherwise, the positional argument must be an iterable object. Each item in the iterable must itself be an iterable with exactly two elements. The first element of each item becomes a key in the new dictionary, and the second element the corresponding value. If a key occurs more than once, the last value for that key becomes the corresponding value in the new dictionary."*

In `v3.14.7` that is `dict_update_arg`: an exact `dict` is merged directly; otherwise it checks whether the argument *has an attribute called `keys`* and, if so, treats it as a mapping; otherwise it treats it as an iterable of pairs.

**The mapping path is duck-typed.** Anything with `keys()` and `__getitem__` works — a `MappingProxyType`, a `ChainMap`, a database row object, your own class:

```python
class Row:
    def __init__(self, columns: list[str], values: tuple[object, ...]) -> None:
        self._data = dict(zip(columns, values, strict=True))

    def keys(self) -> list[str]:
        return list(self._data)

    def __getitem__(self, column: str) -> object:
        return self._data[column]


record = dict(Row(["id", "email"], (7, "a@example.com")))     # mapping path
```

**The pairs path accepts anything of length two.** Each item goes through `PySequence_Fast` and must have exactly two elements, else:

> `"dictionary update sequence element #%zd has length %zd; 2 is required"` — the `ValueError` format string in `merge_from_seq2_lock_held`, `v3.14.7`.

"Anything of length two" includes a two-character string:

```python
dict(["ab", "cd"])            # {'a': 'b', 'c': 'd'} — no error
dict(["ab", "cde"])           # ValueError: ... element #1 has length 3; 2 is required
```

That is how a list of two-letter country codes becomes a nonsense dictionary without an exception, and how `dict(sorted(d))` fails or succeeds depending on the length of your keys ([04 · Working with the order](02b-working-with-the-order.md)).

## `dict(zip(keys, values))` and the silent truncation

`zip` stops at the shortest input, and the `zip` documentation is blunt about the consequence:

> *"Without the `strict=True` argument, any bug that results in iterables of different lengths will be silenced, possibly manifesting as a hard-to-find bug in another part of the program."*

```python
header = ["id", "email", "created_at"]
row = (7, "a@example.com")                        # a column went missing upstream

dict(zip(header, row))                            # {'id': 7, 'email': ...} — created_at vanished
dict(zip(header, row, strict=True))               # ValueError — the bug surfaces here
```

`strict` arrived in 3.10 — *"Changed in version 3.10: Added the `strict` argument."* On anything newer, `dict(zip(..., strict=True))` should be the only spelling used for zipping two sequences that are meant to line up.

## Keyword arguments: identifiers only

> *"If keyword arguments are given, the keyword arguments and their values are added to the dictionary created from the positional argument. If a key being added is already present, the value from the keyword argument replaces the value from the positional argument."*

> *"Providing keyword arguments as in the first example only works for keys that are valid Python identifiers. Otherwise, any valid keys can be used."*

```python
dict(content_type="text/html")         # key is 'content_type', not 'content-type'
dict(class="btn")                      # SyntaxError — 'class' is a keyword
dict(**{"content-type": "text/html"})  # works: ** passes any str key through
dict(**{1: "one"})                     # TypeError: keywords must be strings
```

PEP 584 uses exactly this to reject `dict(d1, **d2)` as a merge idiom — it *"only works when d2 is entirely string-keyed"*, and its example ends in `TypeError: keywords must be strings`.

## Copying: every constructor is one level deep

`dict(d)`, `d.copy()` and `{**d}` all produce a new dictionary holding **the same value objects**. `copy()` is documented as *"Return a shallow copy of the dictionary."*

```python
defaults = {"retries": 3, "hosts": ["a", "b"]}
config = dict(defaults)

config["retries"] = 5            # fine: rebinds a key in the new dict
config["hosts"].append("c")      # 🔴 mutates the list both dicts share
defaults["hosts"]                # ['a', 'b', 'c']
```

The complete answer to "copy a nested structure" is `copy.deepcopy`, which belongs to **08 · `copy` vs `deepcopy`** *(not written yet)*. The dict-specific facts: all three spellings are *O*(n) — *"`d.copy()` O(n)"* on the complexity page — and for a `dict` *subclass* all three return a plain `dict`, which is [22 · Subclassing dict](09-subclassing-dict.md).

## `{}` is a dict

```python
empty_map = {}          # dict
empty_set = set()       # the only literal-free way to spell an empty set
```

A set display needs at least one element; `{}` was a dict before sets had literals, and it stayed one.

## Gotchas

**★ Symptom: a config value from a literal is not the one written at the top of the block.** Cause: the key is duplicated further down; *"the final dictionary's value for that key will be the last one given"*, and *"Clashes between duplicate keys are not detected."* Fix: for literals, rely on a linter's repeated-key check — the interpreter will never complain; for data that arrives as pairs, detect it yourself.

```python
def strict_dict(pairs: Iterable[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key {key!r}")
        result[key] = value
    return result
```

**★ Symptom: `dict(codes)` over a list of two-letter strings returns `{'U': 'S', 'G': 'B'}`.** Cause: the pairs path accepts any item with exactly two elements, and a two-character string is one. Fix: build the pairs you mean.

```python
code_to_name = {code: COUNTRY_NAMES[code] for code in codes}
```

**★ Symptom: `ValueError: dictionary update sequence element #0 has length 3; 2 is required`.** Cause: `dict()` fell through to the pairs path — the argument has no `keys` attribute — and the first item is not a pair. Commonly `dict(list_of_rows)` where rows are 3-tuples. Fix: say which two fields are the key and value.

```python
by_id = {row_id: (name, email) for row_id, name, email in rows}
```

**★ Symptom: a row dict built with `dict(zip(header, row))` is missing its last columns.** Cause: `zip` truncates to the shorter input and says nothing. Fix: `strict=True` (3.10+).

```python
record = dict(zip(header, row, strict=True))
```

**★ Symptom: mutating a list inside a "copied" dict changes the original.** Cause: `dict(d)`, `d.copy()` and `{**d}` are shallow — the values are shared objects. Fix: deep-copy when the values are mutable containers you intend to change.

```python
import copy
config = copy.deepcopy(DEFAULTS)
```

**Symptom: `dict(class="primary")` is a `SyntaxError`, or `dict(content_type=...)` produces the wrong key.** Cause: keyword arguments are identifiers — *"only works for keys that are valid Python identifiers."* Fix: use a display for any key that is not an identifier.

```python
attrs = {"class": "primary", "data-id": "42", "content-type": "text/html"}
```

**Symptom: `dict(base, **overrides)` raises `TypeError: keywords must be strings`.** Cause: `**` in a call passes keys as keyword names; an int or tuple key cannot be one. PEP 584 calls the idiom a *"neat trick"* that *"only works when d2 is entirely string-keyed"*. Fix: a real merge.

```python
merged = base | overrides
```

**Symptom: the second `dict(gen)` over the same generator is empty.** Cause: a generator is consumed by the first construction. Fix: materialise once, or build the generator inside a function called each time.

```python
pairs = list(parse_pairs(stream))
first, second = dict(pairs), dict(pairs)
```

**Symptom: `x = {}` followed by `x.add(item)` raises `AttributeError: 'dict' object has no attribute 'add'`.** Cause: `{}` is an empty dict; there is no empty-set literal. Fix: `set()`.

```python
seen = set()
```

**Symptom: `dict(obj)` on your own class raises `KeyError: 0` — or a `TypeError` that it is not iterable — though the class has `__getitem__`.** Cause: the mapping path is chosen by the presence of a `keys` attribute; without it `dict()` iterates `obj` as pairs. With `__getitem__` but no `__iter__`, iteration falls back to the old sequence protocol and asks for `obj[0]`; with neither, it is a `TypeError`. Fix: give the class a `keys()` method, or subclass `collections.abc.Mapping`, which supplies one.

```python
from collections.abc import Mapping

class Settings(Mapping[str, str]):
    def __init__(self, data: dict[str, str]) -> None:
        self._data = data
    def __getitem__(self, key: str) -> str:
        return self._data[key]
    def __iter__(self):
        return iter(self._data)
    def __len__(self) -> int:
        return len(self._data)

snapshot = dict(Settings({"region": "eu"}))
```

**Symptom: a dict built from two parallel lists has fewer keys than the lists have elements.** Cause: duplicate keys in the key list — later pairs overwrote earlier ones, as documented: *"If a key occurs more than once, the last value for that key becomes the corresponding value."* Fix: check, if duplicates mean corrupt input.

```python
if len(set(keys)) != len(keys):
    raise ValueError("duplicate keys in input")
lookup = dict(zip(keys, values, strict=True))
```

## Interview questions

**★ How does `dict()` decide whether its argument is a mapping or a sequence of pairs?**
By asking whether it has a `keys` attribute. The documentation: *"If a positional argument is given and it defines a `keys()` method, a dictionary is created by calling `__getitem__` on the argument with each returned key from the method. Otherwise, the positional argument must be an iterable object"* of two-element items. CPython's `dict_update_arg` does exactly that — exact dict, else `keys` attribute, else pairs. It is duck typing: any object with `keys()` and `__getitem__` is treated as a mapping, whether or not it inherits from anything.

**★ What happens when a dict literal contains the same key twice?**
The last value wins and the key keeps the position of its first occurrence; there is no error and no warning. The language reference says *"the final dictionary's value for that key will be the last one given"* and, of comprehensions and displays generally, *"Clashes between duplicate keys are not detected."* The same "last seen wins" rule governs `dict(pairs)`, `**` unpacking, `update`, and `|`, which is why it is consistent — and why a copy-paste error in a large config literal is silent.

**★ Why is `dict(zip(a, b))` dangerous, and what is the fix?**
Because `zip` stops at the shorter iterable, so a missing element upstream silently drops keys rather than failing. The `zip` documentation warns that without `strict=True` *"any bug that results in iterables of different lengths will be silenced."* Since 3.10, `dict(zip(a, b, strict=True))` raises `ValueError` at the point of construction instead.

**★ Are `d.copy()`, `dict(d)` and `{**d}` the same?**
For a plain dict, effectively yes: all three create a new dictionary with the same keys and the *same value objects* — a shallow copy, *O*(n). They differ on subclasses (`d.copy()` and `dict(d)` both return a plain `dict` for a `dict` subclass unless it overrides `copy`) and on non-dict mappings (`{**m}` and `dict(m)` work for any mapping; `.copy()` only exists where the type defines it). None of them copies nested containers; that is `copy.deepcopy`.

**Why does `dict(**{1: "a"})` fail when `{1: "a"}` is fine?**
Because `**` in a *call* expands the mapping into keyword arguments, and keyword argument names must be strings. The dictionary itself is perfectly legal; the call syntax is the constraint. The same rule is why `dict(base, **overrides)` is not a general merge — PEP 584 rejects it for exactly this reason — and why `{**base, **overrides}` (a display, not a call) does work with any keys.

**What does `dict(["ab", "cd"])` return, and why?**
`{'a': 'b', 'c': 'd'}`. The pairs path only requires each item to be an iterable with exactly two elements, and a two-character string qualifies. It is a useful question because it shows the constructor does not check types, only lengths — which is also why a list of two-letter codes, or a list of 2-tuples that were meant to be something else, produce a valid-looking dictionary instead of an error.

**How would you build a dict from rows and fail on duplicate keys?**
With a loop, not a comprehension or `dict(pairs)` — both of those implement "last one wins" and never report a clash. The loop checks `if key in result` before assigning and raises with the offending key. It is the same length as the comprehension plus two lines, and it turns a silent data loss into an error at the point where the bad input entered.

---

← [16 · Set operations on views](05d-set-operations-on-views.md) · [Topic index](README.md) · Next → [18 · Dict comprehensions](06b-dict-comprehensions.md)
