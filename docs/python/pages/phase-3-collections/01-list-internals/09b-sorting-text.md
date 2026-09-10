---
title: "Python sorts strings by Unicode code point, which is nobody's idea of alphabetical — uppercase before lowercase, 'file10' before 'file2', '3.10' before '3.9', and 'Å' after 'Z' — and every fix is a key function"
sidebar_label: "09b · Sorting text"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Language Reference
> [§6.10.1 Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)
> (and its footnote on code points),
> [`str.casefold`](https://docs.python.org/3.14/library/stdtypes.html#str.casefold),
> [`locale.strxfrm` / `setlocale`](https://docs.python.org/3.14/library/locale.html#locale.strxfrm),
> and the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html) — *Operator
> Module Functions and Partial Function Evaluation*, *Strategies For Unorderable Types
> and Values*, *Odds and Ends*. Documentation-validated; **no sandbox run** — the only
> outputs shown are the HOWTO's own doctests, quoted. Target: **Python 3.14** (3.14.7).

**`sorted(names)` does exactly one thing: it compares code points, left to right.
The Language Reference says so in a sentence, and adds that this *"may be
counter-intuitive to humans"* — which undersells it. Every capital letter sorts before
every lowercase one; accented letters land after `z`; digits inside strings compare one
character at a time, so `"file10"` beats `"file2"` and `"3.10"` beats `"3.9"`; and two
strings that look identical on screen can compare unequal because one is precomposed
and the other is not. None of this is a bug to report. It is a key to write:
`str.casefold` for case, `unicodedata.normalize` for composition, a digit-splitting
tuple for natural order, and `locale.strxfrm` when the answer has to match a human
language's own rules.**

## The rule

> *"Strings (instances of str) compare lexicographically using the numerical Unicode
> code points (the result of the built-in function ord()) of their characters."*

> *"Strings and binary sequences cannot be directly compared."*

And the footnote that explains why "looks the same" is not "compares equal":

> *"The comparison operators on strings compare at the level of Unicode code points.
> This may be counter-intuitive to humans. For example, \"\\u00C7\" == \"\\u0043\\u0327\"
> is False, even though both strings represent the same abstract character \"LATIN
> CAPITAL LETTER C WITH CEDILLA\"."*

> *"To compare strings at the level of abstract characters (that is, in a way intuitive
> to humans), use unicodedata.normalize()."*

Four consequences, each read straight off `ord()`:

| You expect | Code points give you | Because |
|---|---|---|
| `apple` before `Zebra` | `Zebra` first | `ord("Z")` is 90, `ord("a")` is 97 |
| `file2` before `file10` | `file10` first | `"1" < "2"` decides at the fifth character |
| `3.9` before `3.10` | `3.10` first | `"1" < "9"` at the third character |
| `Åse` next to `Anna` | `Åse` after `Zoe` | `Å` is U+00C5, above every ASCII letter |

## Case: `casefold`, not `lower`

`key=str.lower` is the example in the `list.sort` docs, and it is fine for ASCII. For
real text, the `str` docs explain why it is not enough:

> *"Casefolding is similar to lowercasing but more aggressive because it is intended
> to remove all case distinctions in a string. For example, the German lowercase letter
> 'ß' is equivalent to \"ss\". Since it is already lowercase, lower() would do nothing
> to 'ß'; casefold() converts it to \"ss\"."*

```python
names.sort(key=str.casefold)
names.sort(key=lambda s: (s.casefold(), s))   # and a deterministic tiebreak
```

## Composition: normalise first

`functools.partial` turns a multi-argument function into a key:

> *"The partial() function can reduce the arity of a multi-argument function making it
> suitable for use as a key-function."*

The HOWTO's own example is Unicode normalisation, and its output shows the effect —
verbatim:

```python
>>> from functools import partial
>>> from unicodedata import normalize

>>> names = 'Zoë Åbjørn Núñez Élana Zeke Abe Nubia Eloise'.split()

>>> sorted(names, key=partial(normalize, 'NFD'))
['Abe', 'Åbjørn', 'Eloise', 'Élana', 'Nubia', 'Núñez', 'Zeke', 'Zoë']

>>> sorted(names, key=partial(normalize, 'NFC'))
['Abe', 'Eloise', 'Nubia', 'Núñez', 'Zeke', 'Zoë', 'Åbjørn', 'Élana']
```

Why: NFD decomposes `Å` into `A` followed by a combining ring, so its first code point
is plain `A` and it sorts among the A-names. NFC keeps the single precomposed code
point, which is above `Z`. NFD is a cheap, dependency-free approximation of "accents
do not change the letter"; it is not a language's collation.

## Language rules: `locale.strxfrm`

> *"For locale aware sorting, use locale.strxfrm() for a key function or
> locale.strcoll() for a comparison function. This is necessary because
> \"alphabetical\" sort orderings can vary across cultures even if the underlying
> alphabet is the same."*

> *"Transforms a string to one that can be used in locale-aware comparisons. For
> example, strxfrm(s1) < strxfrm(s2) is equivalent to strcoll(s1, s2) < 0."*

```python
import locale
locale.setlocale(locale.LC_COLLATE, "de_DE.UTF-8")   # process-wide; set once, at startup
names.sort(key=locale.strxfrm)
```

⚠️ Two constraints from the `locale` docs. The locale must exist on the host — *"If the
modification of the locale fails, the exception Error is raised."* And it is global
state: *"setlocale() is not thread-safe on most systems."* Set it once at startup;
never per request, and never to sort one list in one language while another thread
sorts in another.

## Numbers inside strings: natural order

Split each string into text and digit runs, and compare the digit runs as integers:

```python
import re

_DIGITS = re.compile(r"(\d+)")

def natural_key(s):
    parts = _DIGITS.split(s)            # text, digits, text, digits, …, text
    return tuple(int(p) if i % 2 else p.casefold() for i, p in enumerate(parts))

files.sort(key=natural_key)             # file2 before file10
```

Two details make this safe. `re.split` with a capturing group always returns text at
even indices and digit runs at odd ones — even when the string starts with a digit,
index 0 is an empty string — so at every position the tuples compare `str` with `str`
or `int` with `int`, never across types. And choosing by *index parity* rather than
`p.isdigit()` avoids characters such as superscript digits, which `str.isdigit`
accepts but `int()` rejects.

For dotted version numbers, the same idea is a tuple of ints:

```python
versions.sort(key=lambda v: tuple(int(x) for x in v.split(".")))   # 3.9 before 3.10
```

That handles `"3.9"` and `"3.10"`; it raises on pre-release tags like `"3.14.0rc1"`,
which need a real version parser rather than string splitting.

## Gotchas

**★ Symptom: `"Zebra"` sorts before `"apple"`.** Cause: code-point order puts every
ASCII capital before every lowercase letter. Fix:

```python
names.sort(key=str.casefold)
```

**★ Symptom: `file10.csv` is processed before `file2.csv`.** Cause: digits compare as
characters. Fix: a natural-order key, as above:

```python
for path in sorted(paths, key=lambda p: natural_key(p.name)):
    ingest(path)
```

**Symptom: "latest version" logic picks `3.9` over `3.10`.** Cause: `max(versions)` on
strings compares character by character. Fix: compare numeric tuples:

```python
latest = max(versions, key=lambda v: tuple(int(x) for x in v.split(".")))
```

**Symptom: "Straße" and "STRASSE" do not sort together under `key=str.lower`.** Cause:
`lower()` leaves `'ß'` alone; only `casefold()` maps it to `"ss"`. Fix:

```python
names.sort(key=str.casefold)
```

**Symptom: accented names are all at the end of the list.** Cause: precomposed letters
such as `É` and `Å` have code points above `z`. Fix: normalise to NFD for a
dependency-free approximation, or collate by locale when correctness per language
matters:

```python
names.sort(key=lambda s: normalize("NFD", s).casefold())
```

**Symptom: two entries that look identical sort apart, or a dedupe keeps both.** Cause:
one is precomposed and the other decomposed — the reference's own example is
`"\u00C7"` versus `"\u0043\u0327"`. Fix: normalise once, at the boundary where the
text enters the system:

```python
clean = [normalize("NFC", s) for s in raw_names]
```

**Symptom: `locale.Error` at startup on one host only.** Cause: the collation locale
is not installed there; *"If the modification of the locale fails, the exception Error
is raised."* Fix: fail with a clear message, or fall back deliberately:

```python
try:
    locale.setlocale(locale.LC_COLLATE, "de_DE.UTF-8")
    text_key = locale.strxfrm
except locale.Error:
    text_key = str.casefold            # documented, degraded ordering
```

**Symptom: `TypeError` sorting a list of file names from mixed sources.** Cause: some
are `bytes` (from a bytes path API) and some `str`, and *"Strings and binary sequences
cannot be directly compared."* Fix: decode at the boundary:

```python
import os
names = sorted(os.fsdecode(n) for n in raw_names)
```

## Interview questions

**★ How does Python compare two strings?**
Lexicographically by Unicode code point — the first differing character decides, by
`ord()`, and a string that is a prefix of another sorts first. So uppercase precedes
lowercase, digits compare character by character, and precomposed accented letters sit
above `z`. The reference itself warns it *"may be counter-intuitive to humans"*.

**★ How do you sort `file1, file2, … file10` in human order?**
With a natural-order key: split each name into text and digit runs with
`re.split(r"(\d+)", s)`, convert the odd-indexed runs to `int`, and return a tuple.
Because the split keeps text at even positions and digits at odd ones, the tuples
always compare like types at each position.

**Why does `key=str.lower` fail for some languages, and what do you use instead?**
Lowercasing does not remove all case distinctions — the docs' example is German `'ß'`,
which `lower()` leaves alone and `casefold()` maps to `"ss"`. For caseless matching,
`str.casefold`. For culturally correct alphabetical order, `locale.strxfrm` as the key
with a collation locale set at startup.

**Why can two strings that print identically compare unequal?**
Because comparison is by code point, and many characters have both a precomposed form
and a base-plus-combining-mark form. The reference's example is `"\u00C7"` versus
`"\u0043\u0327"`, both "C with cedilla", which compare unequal. Normalise with
`unicodedata.normalize` — NFC or NFD, consistently — before comparing or sorting.

**What does `locale.strxfrm` give you that `casefold` does not, and what does it cost?**
Language-specific collation: the order a German, Swedish or Spanish reader expects,
which differs even on shared letters. The cost is global state — `setlocale` is
process-wide and documented as not thread-safe on most systems — and a dependency on
the locale being installed on every host.

**Why does `"3.10" < "3.9"` evaluate to true?**
Both strings agree on `"3."`, then `"1"` is compared with `"9"`, and `"1"` is smaller.
String comparison has no notion of numbers. Compare a tuple of ints built from
`v.split(".")` instead, or use a version parser when tags like `rc1` appear.

---

← [Key functions](09-key-functions-and-cmp-to-key.md) · [Topic index](README.md) · Next → [Comparisons and `cmp_to_key`](09c-comparisons-and-cmp-to-key.md)
