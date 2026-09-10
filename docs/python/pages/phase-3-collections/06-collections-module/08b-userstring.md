---
title: "UserString wraps a str in a class whose methods re-wrap their results in your subclass — including a + b and a % args with any untrusted value — while split, join and format hand back plain str, and nothing that checks for a real str will accept it"
sidebar_label: "08b · UserString"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.UserString`](https://docs.python.org/3.14/library/collections.html#userstring-objects), [`str.join`](https://docs.python.org/3.14/library/stdtypes.html#str.join), [`object.__format__`](https://docs.python.org/3.14/reference/datamodel.html#object.__format__), [`os.fspath`](https://docs.python.org/3.14/library/os.html#os.fspath), [`json`](https://docs.python.org/3.14/library/json.html), [`html.escape`](https://docs.python.org/3.14/library/html.html#html.escape). Every method read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`class UserString`, lines 1363–1612). Target: **Python 3.14.7**. **No sandbox run.**

**`UserString` is the least-used class in the module and the one with the sharpest edge. It is a `collections.abc.Sequence` holding a real string in `self.data`, and about twenty of its methods — `upper`, `strip`, `replace`, slicing, `+`, `*` and `%` among them — return `self.__class__(result)`, so a subclass's type survives string operations automatically. That is the reason to use it, and it is also the danger: `+` converts *any* right-hand operand with `str()` and wraps the result in your class, so a "safe", "validated" or "escaped" string type built on `UserString` launders unsafe input the moment someone concatenates or `%`-formats with it. Meanwhile other methods — `split`, `join`, `partition`, `format` — return plain `str` and drop the type silently. And because it is not a `str` subclass, everything that insists on a real string refuses it: `json.dumps`, `", ".join(...)`, `open()` and a format spec in an f-string. For value types — an email address, an ID, a slug — a `str` subclass is almost always the better base.**

## The model

> *"The class, `UserString` acts as a wrapper around string objects. The need for this class has
> been partially supplanted by the ability to subclass directly from `str`; however, this class can
> be easier to work with because the underlying string is accessible as an attribute."*

> *"Class that simulates a string object. The instance's content is kept in a regular string object,
> which is accessible via the `data` attribute of `UserString` instances. The instance's contents are
> initially set to a copy of *seq*. The *seq* argument can be any object which can be converted into a
> string using the built-in `str()` function."*

So `UserString(42)` holds `"42"`, and `UserString(None)` holds `"None"` — the constructor is `str(seq)` for anything that is not already a string.

## What comes back as your class, and what does not

From the `v3.14.7` source:

| Returns `self.__class__(...)` | Returns a plain value |
|---|---|
| `s[i]`, `s[i:j]` | `s.split()`, `s.rsplit()`, `s.splitlines()` → `list[str]` |
| `s + x`, `x + s`, `s * n` | `s.join(items)` → `str` |
| `s % args`, `template % s` | `s.partition()`, `s.rpartition()` → tuple of `str` |
| `capitalize`, `casefold`, `center`, `expandtabs`, `ljust`, `lower`, `lstrip`, `removeprefix`, `removesuffix`, `replace`, `rjust`, `rstrip`, `strip`, `swapcase`, `title`, `translate`, `upper`, `zfill` | `s.format(...)`, `s.format_map(...)` → `str` |
| | `s.encode()` → `bytes`; `count`, `find`, `index`, `startswith`, `is*` → `int`/`bool` |

A pipeline that normalises with `strip().lower()` keeps your type; the same pipeline with a `split(",")` in the middle returns plain strings and your type is gone.

## The laundering problem

`__add__` and `__mod__` in `v3.14.7`:

```python
# Lib/collections/__init__.py, v3.14.7 — UserString
def __add__(self, other):
    if isinstance(other, UserString):
        return self.__class__(self.data + other.data)
    elif isinstance(other, str):
        return self.__class__(self.data + other)
    return self.__class__(self.data + str(other))

def __radd__(self, other):
    if isinstance(other, str):
        return self.__class__(other + self.data)
    return self.__class__(str(other) + self.data)

def __mod__(self, args):
    return self.__class__(self.data % args)
```

Every result is your class — whatever was concatenated in. A "this string is already HTML-safe" type is the textbook case:

```python
from collections import UserString


class SafeHTML(UserString):
    """Markup that has already been escaped and may be emitted verbatim."""


header = SafeHTML("<h1>Welcome</h1>")
comment = "<script>steal()</script>"                   # untrusted

page = header + comment                                # 🔴 SafeHTML — the script is now "safe"
row = SafeHTML("<td>%s</td>") % comment                # 🔴 SafeHTML again
also = comment + header                                # 🔴 __radd__: SafeHTML
```

`+` did not even require the other operand to be a string — `SafeHTML("<b>") + 5` is `SafeHTML("<b>5")` where `"<b>" + 5` would have raised `TypeError`. A type that carries a guarantee must decide what every combining operation does with untrusted input:

```python
import html
from collections import UserString


class SafeHTML(UserString):
    @staticmethod
    def _escape(value: object) -> str:
        if isinstance(value, SafeHTML):
            return value.data
        return html.escape(str(value))

    def __add__(self, other: object) -> "SafeHTML":
        return SafeHTML(self.data + self._escape(other))

    def __radd__(self, other: object) -> "SafeHTML":
        return SafeHTML(self._escape(other) + self.data)

    def __mod__(self, args: object) -> "SafeHTML":
        if isinstance(args, tuple):
            return SafeHTML(self.data % tuple(self._escape(a) for a in args))
        return SafeHTML(self.data % self._escape(args))

    def __rmod__(self, template: object) -> "SafeHTML":
        return SafeHTML(self._escape(template) % self.data)
```

That still leaves `replace`, `join` (returns plain `str`), `format` (plain `str`), `center`, `ljust` and every other method to audit — which is the real argument against building security types on a class whose defaults propagate the type through operations you did not think about.

## Where a `UserString` is refused

It is not a `str`, so anything that requires one refuses it:

```python
import json
import os
from collections import UserString

slug = UserString("quarterly-report")

json.dumps({"slug": slug})          # TypeError: Object of type UserString is not JSON serializable
", ".join([slug, "draft"])          # TypeError — str.join accepts only str items
open(UserString("report.csv"))      # TypeError — not str, bytes or os.PathLike
f"{slug:>20}"                       # TypeError — no __format__, and object.__format__ refuses a spec
f"{slug}"                           # fine — an empty spec delegates to __str__
```

The sources for each: the `json` encoder only encodes `str` instances as strings and falls back to `default()`, which raises; `str.join` — *"A `TypeError` will be raised if there are any non-string values in *iterable*"*; `os.fspath` — *"If `str` or `bytes` is passed in, it is returned unchanged. Otherwise `__fspath__()` is called … In all other cases, `TypeError` is raised"* (UserString defines no `__fspath__`); and `object.__format__` — *"The default implementation by the `object` class should be given an empty *format_spec* string"*, with the 3.4 change that it *"raises a `TypeError` if passed any non-empty string."* The fix at every boundary is `str(slug)` or `slug.data`.

## It is hashable, and equal to the plain string

`__hash__` is `hash(self.data)` and `__eq__` compares `self.data` with the other string, so `UserString("eu") == "eu"` and both hash the same: a `UserString` finds a `str` key in a dict and vice versa. Because `data` is an ordinary attribute, a subclass that mutates `self.data` after the object has been used as a key strands it in the dict — the same failure as any key whose hash changes ([7 · The key that mutates](../03-dict/03c-the-key-that-mutates.md)). Treat `data` as write-once.

## The usual right answer: subclass `str`

```python
import re


class Email(str):
    """A validated, normalised email address. Still a real str."""

    _pattern = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    def __new__(cls, value: str) -> "Email":
        normalised = value.strip().lower()
        if not cls._pattern.match(normalised):
            raise ValueError(f"invalid email: {value!r}")
        return super().__new__(cls, normalised)


address = Email("  Ada@Example.COM ")
isinstance(address, str)            # True — json, join, open, f-string specs all accept it
address.upper()                     # a plain str — str methods return str, not Email
```

A `str` subclass is a real string everywhere, validated once in `__new__` (strings are immutable, so it cannot become invalid later), and its methods return plain `str` — the opposite propagation rule from `UserString`, and the safer one for a type that carries a guarantee: operations produce ordinary strings that have to be re-validated to regain the type.

## Gotchas

**★ Symptom: user input rendered unescaped although every template fragment was typed `SafeHTML`.** Cause: `UserString.__add__`, `__radd__`, `__mod__` and `__rmod__` wrap any combination in the subclass, so unescaped input becomes "safe" by concatenation. Fix: escape non-safe operands in every combining method — or do not base a trust type on `UserString`.

```python
def __add__(self, other: object) -> "SafeHTML":
    return SafeHTML(self.data + self._escape(other))
```

**★ Symptom: `TypeError: Object of type UserString is not JSON serializable` (or `TypeError` from `", ".join(...)`).** Cause: neither accepts anything but a real `str`. Fix: convert at the boundary.

```python
json.dumps({"slug": str(slug)})
", ".join(str(part) for part in parts)
```

**★ Symptom: an ID type built on `UserString` silently becomes a plain `str` halfway through a pipeline.** Cause: `split`, `join`, `partition`, `format` and `format_map` return plain `str`. Fix: re-wrap explicitly after those calls, or keep the type at the edges only.

```python
parts = [TenantId(p) for p in raw.split(",")]
```

**Symptom: `"id-" + None` would raise, but `UserString("id-") + None` produces `"id-None"`.** Cause: `__add__` calls `str(other)` for non-string operands. Fix: reject non-strings yourself if that matters.

```python
def __add__(self, other: object):
    if not isinstance(other, (str, UserString)):
        return NotImplemented
    return super().__add__(other)
```

**Symptom: `TypeError` from `f"{name:>20}"` on a `UserString`, while `f"{name}"` works.** Cause: `UserString` defines no `__format__`, and `object.__format__` refuses any non-empty format spec. Fix: format the underlying string.

```python
f"{name.data:>20}"
```

**Symptom: `TypeError` from `open(path)` or `os.fspath(path)` where `path` is a `UserString`.** Cause: filesystem APIs require `str`, `bytes` or an `os.PathLike`, and `UserString` has no `__fspath__`. Fix: pass `str(path)`, or add `__fspath__` to your subclass.

```python
class FilePath(UserString):
    def __fspath__(self) -> str:
        return self.data
```

**Symptom: a dict lookup that worked yesterday misses for a `UserString` key.** Cause: something reassigned `key.data` after it was inserted; `__hash__` is `hash(self.data)`, so the stored entry is under the old hash. Fix: never mutate `data` on an instance that may be a key — build a new instance.

```python
renamed = type(key)(key.data.replace("old", "new"))
```

## Interview questions

**★ When would you use `UserString` instead of subclassing `str`?**
Rarely. The one thing `UserString` offers is propagation: its string-returning methods and operators return `self.__class__(...)`, so a subclass's type survives `strip()`, `lower()`, slicing, `+` and `%`, and the underlying string is reachable as `.data`. A `str` subclass is a real string to every API — `json`, `join`, `open`, format specs — runs at C speed and validates once in `__new__`, but its methods return plain `str`. For value objects (emails, IDs) and anything carrying a guarantee, the `str` subclass is safer; `UserString` suits a wrapper whose type should survive transformations and that never crosses into APIs demanding a real `str`.

**★ Why is a `UserString`-based "safe string" type dangerous?**
Because `+`, the reflected `+`, `%` and the reflected `%` all wrap their result in the subclass regardless of what the other operand was — `__add__` even converts a non-string operand with `str()`. Concatenating or formatting untrusted input with a "safe" value therefore yields a "safe" value containing the untrusted text. A trust-carrying type has to escape or reject foreign operands in every combining method, and `UserString` makes the wrong behaviour the default for about twenty of them.

**Which `UserString` methods lose the subclass type?**
Those that return something other than one string: `split`, `rsplit`, `splitlines` return lists of `str`; `partition` and `rpartition` return tuples of `str`; `join`, `format` and `format_map` return `str`; `encode` returns `bytes`; the search and predicate methods return numbers and booleans. Everything else that produces a single string — case changes, stripping, padding, `replace`, `translate`, slicing, `+`, `*`, `%` — returns `self.__class__(...)`.

**Is a `UserString` hashable, and does it equal the plain string?**
Yes to both: `__hash__` returns `hash(self.data)` and `__eq__` compares `self.data` to the other operand (unwrapping another `UserString`). So `UserString("eu")` and `"eu"` are interchangeable as dict keys. The catch is that `data` is a plain attribute; mutate it after the object is stored as a key and the entry becomes unreachable, exactly like any key whose hash changes.

---

← Prev: [08 · `UserList` and `UserDict` — wrappers, not funnels](08-userlist-and-userdict.md) · [Topic index](README.md) · Next → [09 · Crossing a boundary — JSON, pickle, copy, `isinstance`](09-crossing-a-boundary.md)
