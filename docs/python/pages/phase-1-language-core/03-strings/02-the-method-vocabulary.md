---
title: "The str method vocabulary: the twenty calls that replace most of your parsing code"
sidebar_label: "2 · The method vocabulary"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [String Methods](https://docs.python.org/3.14/library/stdtypes.html#string-methods),
> including the documented behaviour of
> [`str.split`](https://docs.python.org/3.14/library/stdtypes.html#str.split),
> [`str.strip`](https://docs.python.org/3.14/library/stdtypes.html#str.strip),
> [`str.removeprefix`](https://docs.python.org/3.14/library/stdtypes.html#str.removeprefix)
> (added 3.9), [`str.casefold`](https://docs.python.org/3.14/library/stdtypes.html#str.casefold),
> and the [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html).
> Target: **CPython 3.14**.

**Most hand-rolled string parsing in a Python codebase is a method that already
exists, written badly. The vocabulary is small — under two dozen calls carry
almost all real work — but four of them have documented behaviour that reads as
a surprise the first time it bites: `split()` with no argument is a different
algorithm from `split(sep)`, `strip()` takes a set of characters rather than a
prefix, `find()` returns a falsy `0` on success, and `isdigit()` accepts
characters `int()` will refuse. Learn those four properly and the rest is
lookup.**

## Splitting

```python
"a,b,c".split(",")            # ['a', 'b', 'c']
"a,,c".split(",")             # ['a', '', 'c']   — consecutive separators yield empties
"a,b,c".split(",", maxsplit=1)  # ['a', 'b,c']
"a,b,c".rsplit(",", maxsplit=1) # ['a,b', 'c']   — split from the right
```

With **no argument** it is a genuinely different algorithm. The docs are
explicit: *"If sep is not specified or is `None`, a different splitting
algorithm is applied: runs of consecutive whitespace are regarded as a single
separator, and the result will contain no empty strings at the start or end if
the string has leading or trailing whitespace."*

```python
"  a   b  c ".split()         # ['a', 'b', 'c']  — no empties anywhere
"  a   b  c ".split(" ")      # ['', '', 'a', '', '', 'b', '', 'c', '']
"".split()                    # []               — note: NOT ['']
"".split(",")                 # ['']             — one empty field
```

That last pair is the edge case that produces an off-by-one in every CSV parser
written by hand. An empty line has zero whitespace-separated words and one
comma-separated field, and both answers are correct.

`splitlines()` is not `split("\n")`:

```python
"a\nb\n".splitlines()         # ['a', 'b']       — a trailing break adds no line
"a\nb\n".split("\n")          # ['a', 'b', '']
"".splitlines()               # []
"".split("\n")                # ['']
```

`splitlines()` also splits on `\r`, `\r\n`, `\v`, `\f`, `\x1c`–`\x1e`, `\x85`,
` ` and ` `. That is the right behaviour for text of unknown origin
and the wrong behaviour for a protocol where only `\n` is a record separator —
a stray `\x0b` inside a field will split a record that should have stayed whole.

`partition` is the underused one, and the right tool whenever there is exactly
one separator:

```python
key, sep, value = "Content-Type: text/html".partition(": ")
# ('Content-Type', ': ', 'text/html')

key, sep, value = "malformed-header".partition(": ")
# ('malformed-header', '', '')  — sep is "" when not found
if not sep:
    raise ValueError("missing ':' in header line")
```

It always returns three items, so it never raises and never needs a length
check, and the middle element tells you whether the separator was there at all.
`rpartition` does the same from the right — the correct way to split a filename
from its extension when the name itself may contain dots.

## Joining

```python
", ".join(["a", "b", "c"])    # "a, b, c"
"".join(parts)                # concatenate
"\n".join(f"{k}={v}" for k, v in items)   # generators are fine
", ".join([1, 2, 3])          # TypeError: sequence item 0: expected str instance, int found
```

`join` does not stringify for you. Map first:

```python
", ".join(str(n) for n in [1, 2, 3])      # "1, 2, 3"
", ".join(map(str, ids))                  # same, slightly faster for a plain call
```

## Stripping — a set of characters, not a prefix

This is the single most misread method in the type. The docs: *"The chars
argument is a string specifying the set of characters to be removed… The chars
argument is not a prefix or suffix; rather, all combinations of its values are
stripped."*

```python
"   spacious   ".strip()              # "spacious"
"www.example.com".strip("cmowz.")     # "example"
"example.com".strip(".com")           # "example" — but by accident
"connection.com".strip(".com")        # "nnection" — the 'c' and 'o' were eaten
```

`strip(".com")` means "remove any of `.`, `c`, `o`, `m` from either end,
repeatedly". It is not a suffix removal, and the day the data starts with one
of those letters it silently corrupts the value. Since 3.9 the correct tool
exists:

```python
"connection.com".removesuffix(".com")   # "connection"
"TestHook".removeprefix("Test")         # "Hook"
"BaseTestCase".removeprefix("Test")     # "BaseTestCase" — unchanged, no error
```

Both return the original string unchanged when the affix is absent, which makes
them safe to apply unconditionally.

## Searching

```python
"spam, spam".find("spam")     # 0
"spam, spam".find("eggs")     # -1  — the sentinel
"spam, spam".index("eggs")    # ValueError: substring not found
"spam, spam".rfind("spam")    # 6
"spam".count("")              # 5   — every position, including both ends
```

`find` returns `-1` for "not found" and `0` for "found at the start", and `0`
is falsy. So:

```python
if s.find("prefix"):          # WRONG — False when found at position 0,
    ...                       #         True when not found at all (-1)

if s.find("prefix") != -1:    # correct, if you need the position
    ...

if "prefix" in s:             # correct and clearer, if you do not
    ...
```

Use `in` for a yes/no question, `find` only when you need the index, and
`index` when absence is a bug you want raised.

`startswith` and `endswith` accept a **tuple** of candidates, which removes a
whole category of chained `or`:

```python
name.endswith((".py", ".pyi", ".pyx"))
url.startswith(("http://", "https://"))
```

They also take `start` and `end` bounds, so you can test a prefix in the middle
of a string without slicing a copy out first.

## Gotchas

### `strip()` used as suffix removal
**Symptom.** `"connection.com".strip(".com")` returns `"nnection"`. A hostname
column quietly loses leading letters, and only for hosts that happen to start
with `c`, `o` or `m`.
**Cause.** `chars` is a *set* of characters stripped repeatedly from both ends,
not a prefix or suffix to match.
**Fix.**
```python
host = raw.removesuffix(".com")     # 3.9+; unchanged if the suffix is absent
```

### `if s.find(x):` as a membership test
**Symptom.** A prefix check reports the opposite of the truth: `False` when the
match is at position 0, `True` when there is no match at all.
**Cause.** `find` returns the index, or `-1` when absent. `0` is falsy and `-1`
is truthy.
**Fix.**
```python
if x in s:              # membership
    ...
if s.find(x) != -1:     # membership, when you also want the index
    ...
```

### `split(" ")` on human-entered text
**Symptom.** A list of "words" full of empty strings, and a word count that is
double what it should be.
**Cause.** `split(" ")` treats every single space as a separator, so a double
space yields an empty field. `split()` with no argument collapses runs of
whitespace and drops leading and trailing empties.
**Fix.**
```python
words = text.split()        # not text.split(" ")
```

### `splitlines()` on protocol data
**Symptom.** A record splits in two because a field contained a form feed or a
`\x85`.
**Cause.** `splitlines()` splits on every Unicode line boundary, not just `\n`.
**Fix.** When exactly one separator is legal, name it: `data.split("\n")`.

### `join` on a list of non-strings
**Symptom.** `TypeError: sequence item 0: expected str instance, int found`.
**Cause.** `join` does not call `str()` on its items — deliberately, so that
joining bytes and text cannot silently half-work.
**Fix.** `", ".join(str(x) for x in items)`.

## Interview questions

**Q: What is the difference between `s.split()` and `s.split(" ")`?**
`split()` with no separator uses a different algorithm: runs of consecutive
whitespace count as one separator and leading/trailing whitespace produces no
empty strings. `split(" ")` treats each single space as a separator, so
`"a  b".split(" ")` is `['a', '', 'b']`. For human-entered text you almost
always want the no-argument form.

**Q: `"".split()` and `"".split(",")` — same answer?**
No. `[]` and `[""]` respectively. The empty string has no whitespace-separated
words but does have one comma-separated field.

**Q: What does `"connection.com".strip(".com")` return, and why?**
`"nnection"`. `chars` is a set of characters to strip repeatedly from both
ends, so the leading `c` and `o` go too. Use `removesuffix(".com")`.

**Q: When did `removeprefix`/`removesuffix` arrive and what problem did they
solve?**
Python 3.9. They replaced the `strip()` misuse above and the verbose
`s[len(p):] if s.startswith(p) else s` idiom, and they are no-ops when the
affix is absent.

**Q: Why is `if s.find(sub):` a bug?**
`find` returns the index or `-1`. Index `0` — a match at the very start — is
falsy, and `-1` — no match — is truthy, so the condition is inverted exactly
where it matters. Use `in`, or compare against `-1`.

**Q: `find` versus `index`?**
Identical search; `find` returns `-1` when absent, `index` raises
`ValueError`. Choose by whether "absent" is a normal outcome or a bug.

**Q: What does `partition` give you that `split` does not?**
A guaranteed three-tuple and an explicit "was the separator there" signal in
the middle element, with no length check and no exception. It is the right tool
for `key: value` lines.

**Q: `splitlines()` versus `split("\n")`?**
`splitlines()` splits on every Unicode line boundary (`\r`, `\r\n`, `\v`, `\f`,
`\x85`, ` `, …) and does not produce a trailing empty string for a
terminal newline. `split("\n")` splits on exactly one character and does.
Use `splitlines()` for text, `split("\n")` for a protocol with one legal
separator.

**Q: Why does `", ".join([1, 2, 3])` raise?**
`join` requires an iterable of `str` and does not stringify. That is
deliberate — implicit conversion here would let `bytes` and `str` mix silently.
Use `", ".join(map(str, items))`.

**Q: What does `startswith` accept besides a string?**
A tuple of strings, tested as "any of these", plus optional `start`/`end`
bounds so you can test a prefix mid-string without slicing.

---

← Prev: [Building strings and interning](01b-building-and-interning.md) · Index: [Strings](README.md) · Next → [Replacing, case and classification](02b-replacing-case-and-classification.md)
