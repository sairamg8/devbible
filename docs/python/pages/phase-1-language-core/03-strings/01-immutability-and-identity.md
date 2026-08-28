---
title: "A str is an immutable sequence of code points — and every consequence follows from that"
sidebar_label: "1 · Immutability and identity"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [Text Sequence Type — `str`](https://docs.python.org/3.14/library/stdtypes.html#text-sequence-type-str)
> and [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> the Language Reference §6.10 [Comparisons](https://docs.python.org/3.14/reference/expressions.html),
> [`sys.intern()`](https://docs.python.org/3.14/library/sys.html#sys.intern),
> [`unicodedata`](https://docs.python.org/3.14/library/unicodedata.html), and the
> [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html).
> Target: **CPython 3.14**.

**A `str` cannot be changed. There is no in-place edit, no `s[0] = "X"`, no
"append to the string" — every method that looks like it modifies a string
returns a new one and leaves the original exactly where it was. That single
fact is why strings can be dictionary keys, why building one in a loop can be
accidentally quadratic, why `is` sometimes agrees with `==` and sometimes does
not, and why the method vocabulary in the next chunk is uniformly
*return-a-new-string*. Learn the immutability first and the rest of the type
stops needing memorisation.**

## There is no mutating operation

```python
s = "hello"
s[0] = "H"        # TypeError: 'str' object does not support item assignment
s.upper()         # returns "HELLO" — s is still "hello"
s = s.upper()     # rebinding the name is how you "change" a string
```

The second line is the one that catches people arriving from a language with
mutable strings: `s.upper()` is not a command, it is an expression. Discarding
its result discards the work. Every `str` method in this topic behaves the same
way — `strip`, `replace`, `lower`, `removeprefix`, all of them return and none
of them modify.

This is the same names-bind-to-objects model from
[Everything is an object](../../phase-0-runtime/07-everything-is-an-object/README.md);
immutability just means the object under the label can never surprise you, so
the aliasing bugs that plague lists cannot happen here:

```python
a = "hello"
b = a
b += " world"     # builds a NEW string and rebinds b
print(a)          # "hello" — untouched, and there was never any risk
```

## What immutability buys you

**Hashability.** An object may be a `dict` key or a `set` member only if its
hash cannot change underneath the container. Strings qualify; lists do not.
This is not a small convenience — it is the reason `**kwargs`, attribute
lookup, JSON objects and every configuration dictionary in your codebase work
at all.

```python
counts = {"GET": 10, "POST": 3}          # fine
counts[["GET"]] = 1                      # TypeError: unhashable type: 'list'
```

**Safe sharing.** Passing a string to a function you did not write carries zero
risk that it comes back different. Compare with handing over a list, which is
the central hazard of
[Assignment semantics and aliasing](../07-assignment-and-aliasing.md).

**Caching.** Because the value can never change, CPython is free to reuse one
object for many equal strings — the interning behaviour below.

## A str is a sequence of code points

Not of bytes, and not of "characters" as a human reads them.

```python
len("abc")        # 3
len("café")       # 4 code points — even though UTF-8 encodes it in 5 bytes
"café"[3]         # "é" — indexing returns a length-1 str, not a char type
```

There is no character type in Python. `s[0]` gives you a `str` of length one,
which is why `for ch in s` yields strings and why `s[0].upper()` works.

Three different notions of "length" exist, and they disagree:

| Question | Answer in Python |
|---|---|
| How many code points? | `len(s)` |
| How many bytes on the wire? | `len(s.encode("utf-8"))` — see [`bytes` vs `str`](../04-bytes-and-encoding.md) |
| How many things does a human see? | Neither — that is a *grapheme cluster* count, and the standard library does not provide it |

The gap between the first and the third is where the real bugs live:

```python
len("é")                       # 1 if composed (U+00E9)
len("é")                 # 2 — 'e' plus a COMBINING ACUTE ACCENT
"é" == "é"               # False — they render identically
```

Normalise before comparing user-supplied text:

```python
import unicodedata

def same_text(a: str, b: str) -> bool:
    return unicodedata.normalize("NFC", a) == unicodedata.normalize("NFC", b)
```

`NFC` composes (the single-code-point form), `NFD` decomposes. macOS filesystems
historically hand you `NFD`; almost everything else gives `NFC`. A username
check that skips this step will let two visually identical accounts exist.

Emoji make the same point louder: a family emoji built from several people
joined by zero-width joiners is one thing on screen and several code points to
`len()`. A 280-character limit implemented as `len(s) <= 280` is not counting
what the user is counting.

## Sequence operations

`str` is a sequence, so the whole sequence protocol applies:

```python
s = "hello world"
s[0]              # "h"
s[-1]             # "d"
s[0:5]            # "hello"
s[:5]             # same — a missing bound means "the end"
s[::2]            # "hlowrd" — every second code point
s[::-1]           # "dlrow olleh" — the idiomatic reverse
"ab" * 3          # "ababab"
"lo w" in s       # True
len(s)            # 11
```

Two of these differ from the list you may be picturing:

- **`in` tests for a substring, not an element.** `"ell" in "hello"` is `True`,
  where `["e", "l", "l"] in ["h", "e", "l", "l", "o"]` is `False`. `str` is the
  one built-in sequence whose `in` is not element membership.
- **The empty string is in everything.** `"" in "hello"` is `True`, and so is
  `"" in ""`. A guard written as `if needle in haystack:` passes for an empty
  needle, which is exactly what an empty form field gives you.

Slicing never raises for out-of-range bounds — `"abc"[10:20]` is `""` — while
indexing does. That asymmetry silently converts a bounds bug into an empty
string that flows onward.

## Comparison is by code point, and that is not alphabetical order

```python
"apple" < "banana"     # True
"Zebra" < "apple"      # True  — "Z" is U+005A, "a" is U+0061
"éclair" < "zebra"     # False — "é" is U+00E9, past every ASCII letter
```

`sorted()` on names therefore puts every capitalised name before every
lowercase one and dumps accented names at the end. `key=str.lower` fixes the
first problem and not the second. Genuine locale-aware collation needs
`locale.strxfrm` (process-global locale state, and a footgun in a server) or a
real ICU binding such as `PyICU`. For a database-backed application the honest
answer is usually to sort in the database, where the collation is declared.

For *caseless comparison*, the correct tool is `casefold`, not `lower` — see
[the method vocabulary](02-the-method-vocabulary.md).

## Gotchas

### `len()` is not what the user is counting
**Symptom.** A 280-character limit rejects a message the user counted as 240,
or a "1 character" emoji costs 7 against the budget.
**Cause.** `len()` counts code points. A grapheme the user sees as one symbol
may be a base character plus combining marks, or several emoji joined by
zero-width joiners.
**Fix.** Normalise first, and if the count must match a human's, count grapheme
clusters with a library — the standard library does not do it.
```python
import unicodedata
text = unicodedata.normalize("NFC", raw)   # collapses e + ́  into é
if len(text) > 280:
    raise ValueError("too long")
```

### Two identical-looking strings comparing unequal
**Symptom.** A username lookup fails, a file is "not found" on macOS, a
deduplication pass leaves visible duplicates.
**Cause.** The same text in different normalisation forms — `"é"` as U+00E9
versus `"e"` + U+0301. They render identically and are different sequences.
**Fix.** Normalise both sides at the boundary, once, and store the normalised
form.
```python
import unicodedata

def canonical(name: str) -> str:
    return unicodedata.normalize("NFC", name).casefold()
```

### An empty needle passes every membership test
**Symptom.** A search box with nothing typed in it "matches" every record.
**Cause.** `"" in anything` is `True`, and `str.startswith("")` is `True` too.
**Fix.** Reject the empty query explicitly rather than letting it fall through.
```python
if not query:
    return []
return [r for r in records if query in r.title]
```

### Sorting names puts every capital first
**Symptom.** `["alice", "Bob", "carol"]` sorts as `["Bob", "alice", "carol"]`.
**Cause.** Comparison is code point by code point, and every ASCII uppercase
letter is below every ASCII lowercase one.
**Fix.** Sort on a case-folded key — and be honest that this still sorts by
code point for non-ASCII text.
```python
names.sort(key=str.casefold)
```

### Slicing hides an index bug
**Symptom.** A parser silently produces empty fields instead of raising.
**Cause.** `s[10:20]` on a 3-character string returns `""` rather than raising,
while `s[10]` raises `IndexError`.
**Fix.** Where a slice must contain something, check it — or use `partition`,
which reports whether the separator was found.

## Interview questions

**Q: Why can a string be a dictionary key but a list cannot?**
Dict keys must be hashable, and an object's hash must not change while it is in
the container. `str` is immutable so its hash is fixed and can even be cached;
`list` is mutable, so it deliberately has no `__hash__`, and using one raises
`TypeError: unhashable type: 'list'`.

**Q: `len("é")` — always 1?**
No. It is 1 for the precomposed U+00E9 and 2 for `"e"` plus U+0301, and both
render identically. `len` counts code points, not glyphs.

**Q: How do you compare two user-supplied names for equality "properly"?**
Normalise both to the same Unicode form and case-fold:
`unicodedata.normalize("NFC", a).casefold() == unicodedata.normalize("NFC", b).casefold()`.

**Q: Why is `"" in "hello"` True?**
The empty string is a substring of every string, at every position, including
of itself. It is a mathematically consistent answer that regularly produces a
search bug.

**Q: Why does sorting names give you every capitalised name first?**
Strings compare code point by code point, and ASCII uppercase (U+0041–U+005A)
sorts below ASCII lowercase (U+0061–U+007A). `key=str.casefold` fixes the case
issue; genuine alphabetical order for non-ASCII text needs locale-aware
collation, which the standard library only exposes through process-global
`locale` state.

---

← Prev: [Numbers](../02-numbers.md) · Index: [Strings](README.md) · Next → [Building strings and interning](01b-building-and-interning.md)
