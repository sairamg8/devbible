---
title: "Building a string, and the interning that makes `is` accidentally work"
sidebar_label: "1b · Building strings and interning"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [`str.join`](https://docs.python.org/3.14/library/stdtypes.html#str.join),
> [`sys.intern()`](https://docs.python.org/3.14/library/sys.html#sys.intern),
> [`io.StringIO`](https://docs.python.org/3.14/library/io.html#io.StringIO),
> [`repr()`](https://docs.python.org/3.14/library/functions.html#repr), and
> [What's New in Python 3.8](https://docs.python.org/3.14/whatsnew/3.8.html)
> (the `SyntaxWarning` for `is` against a literal).
> Target: **CPython 3.14**.

**Immutability has a price and a dividend, and this chunk is both. The price is
that assembling a string piece by piece with `+` copies everything you have so
far on every step — the accidental O(n²) that turns a fast report generator
into a slow one at scale. The dividend is that CPython can safely hand the same
object to two names holding the same text, which is why `is` appears to work on
strings right up until the value comes from a file instead of a literal. Both
behaviours come from the previous chunk's one sentence.**

## Building strings: the quadratic loop

Because each `+` makes a new string and copies both operands, concatenating in
a loop is O(n²) in the total length:

```python
# Do not do this for large n
out = ""
for chunk in chunks:
    out += chunk          # copies everything accumulated so far, every time
```

The fix is to collect and join once:

```python
out = "".join(chunks)                       # one allocation, one pass

parts = []
for record in records:
    parts.append(format_row(record))
out = "\n".join(parts)
```

`join` is a method on the *separator* rather than on the list because it must
work for any iterable of strings — including a generator, which is the version
you want when the pieces are large:

```python
out = "\n".join(format_row(r) for r in records)
```

CPython does have an optimisation that can make `s += t` amortised-linear when
`s` has a reference count of one, so a small benchmark may show the naive loop
performing fine. **Do not build on it.** It is a CPython implementation detail,
not a language guarantee; it evaporates the moment a second name, a list, or a
debugger frame holds a reference to `s`; and it does not exist in other
implementations. Write the `join`.

For genuinely incremental construction — a template engine, a serialiser —
`io.StringIO` is the standard mutable-buffer answer:

```python
import io

buf = io.StringIO()
for record in records:
    buf.write(format_row(record))
    buf.write("\n")
out = buf.getvalue()
```

## Interning, and why `is` sometimes lies

CPython reuses string objects in several situations: short identifier-like
literals are interned at compile time, and constants inside one code object are
merged. So identity comparison can accidentally appear to work.

```python
a = "hello"
b = "hello"
a is b            # commonly True — both names reach the same interned object

x = "hello world!"
y = "hello world!"
x is y            # may be True or False depending on how they were compiled
```

None of this is a promise. **Compare strings with `==`.** `is` asks "the same
object?", and the only string question that should ever be asked that way is
none at all — reserve `is` for `None`, `True` and `False`, as
[Comparisons](../06-comparisons.md) covers.

Since 3.8, comparing against a literal with `is` raises a `SyntaxWarning`
naming the mistake, which is the interpreter telling you the same thing.

`sys.intern(s)` forces a string into the interned table and returns the
canonical object. It is a real optimisation in exactly one shape: millions of
strings drawn from a small vocabulary — parsed field names, repeated tags —
where interning collapses the memory and makes dictionary lookups hit the
identity fast path. Outside that shape it is noise.

```python
import sys

field_names = [sys.intern(name) for name in parse_header(line)]
```

## `str()` versus `repr()`

Two conversions, two audiences:

```python
s = "line\n"
str(s)            # "line\n"  — the value itself
repr(s)           # "'line\\n'" — a quoted form showing the escape
print(s)          # prints the value and a newline
print(repr(s))    # shows you that the trailing newline is there
```

`repr` is the debugging tool: it makes trailing whitespace, embedded newlines
and the difference between `"1"` and `1` visible. The f-string conversion `!r`
is the same thing inline, and it belongs in almost every log message that
interpolates untrusted text — see [f-strings](03-f-strings.md).

## Gotchas

### Building a string in a loop with `+=`
**Symptom.** A report generator that is instant for 100 rows takes minutes at
100,000 — with no obvious hot spot, because the time is spread across a
`memcpy` that grows every iteration.
**Cause.** Strings are immutable, so `out += chunk` allocates a new string and
copies both operands. Over *n* chunks that is O(n²) bytes copied. The CPython
refcount-1 in-place optimisation hides it in toy benchmarks and stops applying
the moment anything else references `out`.
**Fix.**
```python
parts = []
for record in records:
    parts.append(format_row(record))
out = "\n".join(parts)
```

### Using `is` to compare strings
**Symptom.** `if status is "active":` works in a script and fails in production
— or works until the value arrives from JSON instead of a literal.
**Cause.** `is` compares identity. Literal interning makes it *accidentally*
`True` for short literals compiled together; a string built at runtime, read
from a file or parsed from JSON is a different object with the same value.
**Fix.** Use `==`. Reserve `is` for `None`, `True`, `False` and sentinels.
```python
if status == "active":
    ...
```

### Reaching for `sys.intern` as a general speed-up
**Symptom.** Code littered with `sys.intern()` calls and no measurable gain.
**Cause.** Interning helps only when a huge number of strings are drawn from a
small vocabulary. Each call itself costs a hash and a table lookup.
**Fix.** Intern parsed field names and repeated tags in a hot parser; leave
everything else alone.

## Interview questions

**Q: What is the time complexity of building a string with `+=` in a loop, and
why?**
O(n²) in the total output length. Each `+=` allocates a new string and copies
both operands, so the accumulated prefix is copied on every iteration. Use
`"".join(parts)` — one allocation and one pass.

**Q: But I benchmarked `+=` and it was fast. Explain.**
CPython has an optimisation that resizes in place when the target's reference
count is one. It is an implementation detail, not a language guarantee; it
stops applying as soon as another name, container or frame references the
string, and other implementations do not have it. Never design around it.

**Q: Why is `join` a method on the separator instead of on the list?**
Because it has to work for any iterable of strings — lists, tuples, sets,
generators — and putting it on `str` gives one implementation instead of one
per container type. It also reads as what it is: a string joining things with
itself.

**Q: When does `is` return True for two equal strings?**
When they happen to be the same object: short identifier-like literals interned
at compile time, constants merged inside one code object, or anything passed
through `sys.intern`. It is never something to rely on. Compare with `==`.

**Q: What is `sys.intern` actually for?**
Collapsing many duplicate strings from a small vocabulary into one object —
parsed field names, repeated tags — saving memory and letting dict lookups take
the identity fast path. It is a targeted optimisation, not a default.

**Q: `str` versus `repr` — when do you want each?**
`str` for the value a user should see, `repr` for the unambiguous debugging
form that shows quoting and escapes. In logs, interpolate with `!r` so an empty
string, a trailing newline or stray whitespace is visible rather than invisible.

**Q: What is the mutable counterpart to `str` for incremental building?**
`io.StringIO` — write into it and call `getvalue()` once. For byte output the
same role is played by `io.BytesIO` or a `bytearray`.

---

← Prev: [Immutability and identity](01-immutability-and-identity.md) · Index: [Strings](README.md) · Next → [The method vocabulary](02-the-method-vocabulary.md)
