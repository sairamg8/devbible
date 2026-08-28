---
title: "`__format__`: the protocol that lets any type define its own spec language"
sidebar_label: "3d · The `__format__` protocol"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14
> [`object.__format__`](https://docs.python.org/3.14/reference/datamodel.html#object.__format__)
> data-model entry,
> [`format()`](https://docs.python.org/3.14/library/functions.html#format),
> the [Format String Syntax](https://docs.python.org/3.14/library/string.html#format-string-syntax)
> grammar for nested replacement fields, and
> [`datetime.__format__`](https://docs.python.org/3.14/library/datetime.html#datetime.datetime.__format__).
> Target: **CPython 3.14**.

**The format spec is a string that Python hands to the value and does not read.
`f"{value:spec}"` compiles to `format(value, "spec")`, which is
`type(value).__format__(value, "spec")` — so the mini-language in the previous
chunk is not *the* format language, it is the one `int`, `float`, `str` and
`Decimal` happen to implement. `datetime` implements `strftime` codes in the
same slot. Your own types can implement anything, and the one rule is that the
empty spec must work.**

## Nested replacement fields in the spec

A spec may itself contain `{}`, evaluated first:

```python
width, places = 12, 3
f"{value:>{width}.{places}f}"
f"{label:{fill}^{width}}"
```

This is how you build a table whose column widths are computed from the data.

## Any type can define its own spec

`format(value, spec)` calls `value.__format__(spec)`. The mini-language above is
what `int`, `float`, `str`, `Decimal` and `complex` implement — but a type is
free to interpret the spec however it likes, and several standard ones do:

```python
from datetime import datetime
f"{datetime.now():%Y-%m-%d %H:%M}"      # strftime codes, not the grammar above
```

Your own classes can join in — the worked example is in
[Writing `__format__` well](#writing-__format__-well) below.

The empty spec is the one contract to honour: `f"{obj}"` passes `""`, and
returning something reasonable there is what makes the object printable.
`object.__format__` raises `TypeError` for any non-empty spec, so a class that
does not override it will reject `f"{obj:>10}"`.

## The three callers of `__format__`

```python
value = 1234.5

f"{value:,.2f}"                     # f-string  — compiled, values from scope
"{:,.2f}".format(value)             # str.format — template can arrive at runtime
format(value, ",.2f")               # format()   — one value, spec as data
```

All three end in the same call. `format(value, spec)` is the one to reach for
when the spec itself is a variable and there is no surrounding text — it says
what it does with no template to read past.

## `str.format` field syntax

`str.format` supports more inside the braces than an f-string needs to, because
it has no surrounding scope to draw on:

```python
"{} {}".format(a, b)                # automatic numbering
"{0} {1} {0}".format(a, b)          # manual numbering — reuse an argument
"{name} <{email}>".format(name=n, email=e)   # named
"{0.email}".format(user)            # attribute access
"{0[2]}".format(row)                # index access — note: no quotes on the key
"{d[key]}".format(d=mapping)        # mapping key, also unquoted
"{:{}}".format(value, spec)         # a nested field supplying the whole spec
```

Automatic and manual numbering cannot be mixed in one template — `"{} {0}"`
raises `ValueError`. The index and key forms take their contents literally, so
`"{d[key]}"` looks up the *string* `"key"`; there is no expression evaluation
and no way to use a non-string key.

`format_map` (3.2) is `format(**mapping)` without building the intermediate
dict, which matters when the mapping is a custom class:

```python
class Defaulting(dict):
    def __missing__(self, key: str) -> str:
        return f"<{key}>"

"{greeting} {name}".format_map(Defaulting(greeting="Hi"))
# "Hi <name>" — the missing field renders instead of raising KeyError
```

That `__missing__` trick is the standard way to make a template tolerant of
absent keys, and it is only reachable through `format_map`.

## Standard types with their own spec languages

- **`datetime`, `date`, `time`** — the spec is a `strftime` format string, and
  an empty spec falls back to `isoformat()`.
- **`Decimal`** — implements the numeric mini-language, with the important
  difference that it formats the value's own precision rather than a float
  approximation.
- **`Enum`** — since 3.12 a plain `Enum` formats as `str(member)`, which is
  `"Colour.RED"`; a mixin enum such as `IntEnum` formats as its value. If you
  need one specific rendering, ask for it (`member.name`, `member.value`)
  rather than relying on the default.
- **`complex`** — the numeric mini-language, with the alignment option `=`
  explicitly excluded.

## Writing `__format__` well

```python
from decimal import Decimal

class Money:
    __slots__ = ("amount", "currency")

    def __init__(self, amount: Decimal, currency: str = "USD") -> None:
        self.amount = amount
        self.currency = currency

    def __str__(self) -> str:
        return f"{self.amount:,.2f} {self.currency}"

    def __repr__(self) -> str:
        return f"Money({self.amount!r}, {self.currency!r})"

    def __format__(self, spec: str) -> str:
        if spec == "":                            # f"{money}" — the common case
            return str(self)
        if spec == "c":                           # our own code: "compact"
            return f"{self.amount:,.0f}{self.currency}"
        return format(self.amount, spec)          # delegate the rest
```

Three rules that keep a `__format__` usable:

1. **The empty spec must work** — `f"{obj}"` passes `""`, and it is the case
   every reader will write first. Returning `str(self)` there is almost always
   right.
2. **Delegate what you do not own.** Passing the spec down to the wrapped value
   gives you the entire numeric mini-language for free.
3. **Raise for a spec you do not understand**, rather than ignoring it — a
   silently dropped `>20` produces a misaligned table nobody debugs.

If a type only needs alignment and padding, the whole implementation is one
line:

```python
def __format__(self, spec: str) -> str:
    return format(str(self), spec)
```

## Gotchas

### A custom class rejecting a format spec
**Symptom.** `TypeError: unsupported format string passed to MyClass.__format__`
the first time someone writes `f"{obj:>20}"`.
**Cause.** `object.__format__` accepts only the empty spec.
**Fix.** Implement `__format__`, delegating to `str` when you only want
alignment:
```python
def __format__(self, spec: str) -> str:
    return format(str(self), spec)
```

### Mixing automatic and manual numbering in `str.format`
**Symptom.** `ValueError: cannot switch from automatic field numbering to
manual field specification`.
**Cause.** `"{} {0}"` asks the template to do both. One template picks one
scheme.
**Fix.** Number every field, or number none of them.

### Quoting a key inside a `str.format` field
**Symptom.** `KeyError: "'key'"` — with the quotes visibly part of the key.
**Cause.** `"{d[key]}"` takes the text between the brackets literally, so
`"{d['key']}"` looks up the four-character string `'key'` including quotes.
**Fix.** Drop the quotes: `"{d[key]}"`. (An f-string is the opposite — there
the brackets contain a real expression and the quotes are required.)

### Relying on the default `Enum` format
**Symptom.** A rendered value changes from `"1"` to `"Colour.RED"` after an
enum gains or loses an `int` mixin.
**Cause.** `Enum.__format__` follows `__str__`, and mixin enums differ from
plain ones.
**Fix.** Be explicit: `f"{member.value}"` or `f"{member.name}"`.

## Interview questions

**Q: Where does the format spec actually go?**
`f"{value:spec}"` compiles to `format(value, "spec")`, which calls
`value.__format__("spec")`. The f-string machinery never interprets the spec —
the type does.

**Q: How do you compute a width at runtime?**
Nest a replacement field inside the spec: `f"{value:>{width}.{places}f}"`.

**Q: Why does `f"{now:%Y-%m-%d}"` work when `%Y` is nowhere in the format
grammar?**
Because `datetime.__format__` interprets the spec itself, passing it to
`strftime`. Any type may define its own spec language.

**Q: What does `object.__format__` do with a non-empty spec?**
Raises `TypeError`. A class that wants `f"{obj:>20}"` to work must implement
`__format__`, typically as `format(str(self), spec)`.

**Q: `format(x, spec)` versus `"{:spec}".format(x)` versus `f"{x:spec}"` — when
does each read best?**
The f-string when the template is in the source and the values are in scope;
`str.format` when the template arrives at runtime; `format()` when there is one
value and the spec is itself data, with no surrounding text to read past.

**Q: Why does `"{d['key']}".format(d=m)` raise a `KeyError` mentioning quotes?**
Inside a `str.format` replacement field the text between brackets is taken
literally — there is no expression evaluation — so the quotes become part of
the key. Write `"{d[key]}"`. f-strings are the reverse: they hold a real
expression, so quotes are required there.

**Q: What is `format_map` for?**
Formatting from a mapping without copying it into keyword arguments — which
matters when the mapping is a subclass. Combined with `__missing__` it is the
standard way to render a template that tolerates absent keys instead of raising.

**Q: Can you mix `"{}"` and `"{0}"` in one template?**
No — `ValueError`. Automatic and manual field numbering are mutually exclusive
per template.

**Q: What should `__format__` do with a spec it does not recognise?**
Raise. Silently ignoring it produces misaligned output that nobody traces back
to the class. Delegating the unrecognised part to the wrapped value —
`format(self.amount, spec)` — is usually better still.

---

← Prev: [The format spec mini-language](03c-the-format-spec-mini-language.md) · Index: [Strings](README.md) · Next → [t-strings](04-t-strings.md)
