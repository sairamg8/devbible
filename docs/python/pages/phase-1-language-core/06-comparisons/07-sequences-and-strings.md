---
title: "Sequences compare lexicographically, so a tuple key sorts by its first differing element and a string sorts by raw code point — which is not alphabetical order in any human language"
sidebar_label: "7 · Sequences and strings"
sidebar_position: 74
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> the library reference on
> [`str.casefold`](https://docs.python.org/3.14/library/stdtypes.html#str.casefold)
> and [`unicodedata.normalize`](https://docs.python.org/3.14/library/unicodedata.html#unicodedata.normalize),
> [`locale.strxfrm`](https://docs.python.org/3.14/library/locale.html#locale.strxfrm),
> and [`functools.cmp_to_key`](https://docs.python.org/3.14/library/functools.html#functools.cmp_to_key).
> Version spine: **CPython 3.14**.

**Lexicographic comparison is one rule applied uniformly: walk both sequences in
parallel, and the answer is decided entirely by the first pair of elements that are
not equal; if you run out of one sequence first, the shorter one sorts first. Every
tuple sort key you have ever written is that rule, and so is `"apple" < "banana"`.
The trap is what "not equal" means for a `str` — Python compares raw Unicode code
points, so `"Z" < "a"`, `"é" > "z"`, and `"e\\u0301"` is not equal to `"é"` even though
both render identically.**

## The lexicographic rule

> *"Sequences compare lexicographically using comparison of corresponding elements."*
>
> *"For two collections to compare equal, they must be of the same type, have the same
> length, and each pair of corresponding elements must compare equal (for example,
> `[1,2] == (1,2)` is false because the type is not the same)."*
>
> *"Collections that support order comparison are ordered the same as their first
> unequal elements (for example, `[1,2,x] <= [1,2,y]` has the same value as `x <= y`).
> If a corresponding element does not exist, the shorter collection is ordered first
> (for example, `[1,2] < [1,2,3]` is true)."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

Three operational facts drop out:

**1 · Comparison is short-circuiting.** `[1, 2, x] <= [1, 2, y]` never compares
anything after the first differing position — so elements past that point are never
touched, may be of un-orderable types, and may be arbitrarily expensive without
costing anything. This is the property that makes the null-partitioning key of
[05c](05c-none-never-orders.md) and the `heapq` sequence-number trick of
[05](05-cross-type-comparison.md) work.

**2 · Prefix sorts first.** `[1, 2] < [1, 2, 3]`, `"ab" < "abc"`, `(1,) < (1, 0)`.
There is no "longer is greater" rule beyond the prefix case; `[9] > [1, 2, 3]` because
the first elements decide it.

**3 · Equality checks length before elements.** Two sequences of different lengths are
unequal without any element comparison.

## Tuple keys: the workhorse

Every multi-level sort in Python is the lexicographic rule wearing a hat:

```python
sorted(employees, key=lambda e: (e.department, e.last_name, e.first_name))
```

The first element decides; ties fall through to the second, then the third. That is
identical to SQL's `ORDER BY department, last_name, first_name`, and it is why you
almost never need a comparison function.

Two consequences worth internalising:

```python
# The elements after the first difference are never compared, so they may be
# un-orderable — this is the escape hatch for heterogeneous data:
sorted(items, key=lambda v: (v is None, isinstance(v, str), v))

# But when they ARE reached, they must be orderable — this is the heapq bug:
heapq.heappush(h, (priority, some_object))   # blows up only when priorities tie
```

## Strings compare by code point, not by alphabet

> *"Strings (instances of `str`) compare lexicographically using the numerical Unicode
> code points (the result of the built-in function `ord()`) of their characters."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

This is ASCIIbetical order extended to all of Unicode, and it is not the order any
human expects:

```python
"Z" < "a"       # True — ord("Z") is 90, ord("a") is 97
"apple" < "Apple"   # False — uppercase letters all precede lowercase
"z" < "é"       # True — ord("z") is 122, ord("é") is 233
"10" < "9"      # True — string comparison, '1' < '9'
```

The last one is the digit trap: any list of numeric strings sorts "1, 10, 11, 2, 20,
3" unless you convert or pad. `sorted(files, key=lambda s: int(s.split(".")[0]))` or a
natural-sort key.

### Case-insensitive ordering

`str.lower()` is not the right tool; `str.casefold()` is:

```python
sorted(names, key=str.casefold)
```

`casefold()` is documented as *"similar to lowercasing but more aggressive because it
is intended to remove all case distinctions in a string"*, and the docs give the
German `ß` as the example: `"ß".casefold()` is `"ss"`, so `"straße"` and `"strasse"`
fold together, while `"ß".lower()` leaves it unchanged. For matching and grouping,
casefold. For display, do not fold at all.

### Normalisation: two identical-looking strings that are not equal

Unicode lets the same grapheme be encoded more than one way. `"é"` can be U+00E9
(precomposed, NFC) or `"e"` + U+0301 combining acute (decomposed, NFD). They render
identically and compare unequal, because `==` on `str` is code-point equality:

```python
import unicodedata
a = "é"           # é   — one code point
b = "é"          # é   — two code points
a == b                 # False
len(a), len(b)         # 1, 2
unicodedata.normalize("NFC", b) == a     # True
```

This arrives from macOS filesystems (which historically store NFD), from copy-paste,
from some IME input, and from any system that normalised differently from yours. The
rule for a service: **normalise on ingest** — `unicodedata.normalize("NFC", s)` at the
boundary — so every comparison downstream is between canonical forms. `NFKC` folds
compatibility characters too (`"ﬁ"` → `"fi"`, full-width digits → ASCII), which is
right for identifiers and search and wrong for anything that must round-trip
verbatim.

### Locale-aware collation

Code-point order is not alphabetical order in Swedish, German, Czech or any language
with accented letters or digraphs. The standard library's answer is `locale.strxfrm`
as a key, or `locale.strcoll` via `cmp_to_key` — and the `functools` docs use exactly
that as their example:

```python
sorted(iterable, key=cmp_to_key(locale.strcoll))  # locale-aware sort order
```

`locale.strxfrm` is the key-function form and is the better choice, because it
transforms each string once rather than comparing pairs. Both require
`locale.setlocale` to have been called, both are process-global, and both are
therefore awkward in a server. For serious collation, `PyICU` implements the Unicode
Collation Algorithm properly; the standard library does not.

I could not find a documented guarantee in the Python docs about `strxfrm`'s output
being comparable across locales or across processes — treat the transformed values as
opaque and ephemeral, and do not persist them.

### `startswith`, `in` and prefix comparison

`s.startswith(p)` is not a comparison operator and does not chain, but it is the right
tool for the prefix question that people write as `s[:len(p)] == p`. It accepts a
tuple of prefixes, which the slice form cannot:

```python
if path.startswith(("/api/", "/internal/")):
```

`in` on strings is substring containment, which the reference states separately from
the container rule:

> *"For the string and bytes types, `x in y` is `True` if and only if x is a substring
> of y. An equivalent test is `y.find(x) != -1`. Empty strings are always considered
> to be a substring of any other string, so `"" in "abc"` will return `True`."* —
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)

`"" in anything` being `True` is a real edge case in validation code: a check like
`if user_input in allowed_page:` passes for empty input.

## Nested sequences

The rule recurses. A list of tuples compares by the first differing tuple, which
itself compares by its first differing element:

```python
[(1, "a"), (2, "b")] < [(1, "a"), (2, "c")]     # True — decided at "b" < "c"
```

And it inherits everything, including the `TypeError`s: a list of tuples where one
tuple has a `None` in position 2 will raise only when two tuples tie on positions 0
and 1.

## Gotchas

**★ `sorted(names)` putting every capitalised name before every lowercase one.**
Code-point order: `A`–`Z` is 65–90, `a`–`z` is 97–122. Fix: `key=str.casefold` for
case-insensitive order; do not `.lower()` the data itself unless you intend to lose
the original.

**★ `"file10.txt" < "file9.txt"` being `True`.** Lexicographic comparison of digits as
characters. Fix: a key that extracts and converts the number, or zero-pad the names at
creation time.

**★ Two strings that look identical comparing unequal.** One is NFC, the other NFD —
`"é"` as U+00E9 versus `"e"` + U+0301. Fix: `unicodedata.normalize("NFC", s)` at every
ingest boundary, and store the normalised form.

**★ A username uniqueness check passing for a name that already exists.** Same cause:
the existing row is NFC and the new input is NFD, or one uses a full-width character.
Fix: normalise with `NFKC` and casefold before the uniqueness comparison; store both
the display form and the folded form.

**★ `"ß".lower() != "ss"` breaking a case-insensitive match.** `lower()` is not
case *folding*. Fix: `casefold()`, which is documented as more aggressive precisely
for this.

**★ `if user_input in page_name:` passing for empty input.** The reference states that
an empty string is a substring of every string. Fix: guard the empty case explicitly,
or use `==` / `startswith` if that is what you meant.

**★ `sorted()` on a list of tuples raising only for some inputs.** Tuple comparison
stops at the first unequal element, so an un-orderable value in position 2 is only
reached when positions 0 and 1 tie. Fix: null-guard and type-guard every element of a
composite key, not just the first.

**★ `[1, 2] == (1, 2)` being `False` in a test assertion.** Equality requires the same
type. Fix: compare like with like, or convert explicitly.

**★ A "sort by name" feature that reorders itself when the server locale changes.**
`locale.strxfrm`/`strcoll` depend on process-global locale state set by
`locale.setlocale`. Fix: set the locale explicitly and once at startup, or use PyICU
with an explicit collator, or accept code-point order and document it.

**★ `s[:len(p)] == p` used as a prefix test and going wrong for a short `s`.** It
happens to work (`"ab"[:5]` is `"ab"`, unequal to a 5-char prefix), but it allocates a
slice and cannot take multiple prefixes. Fix: `s.startswith(p)`, which also accepts a
tuple.

## Interview questions

**★ Q: How do two lists compare?**
Element-wise, left to right, and the result is decided by the first pair that is not
equal — the reference's example is `[1,2,x] <= [1,2,y]` having the same value as
`x <= y`. If one runs out first, the shorter sorts first: `[1,2] < [1,2,3]`. For
*equality*, both must be the same type and the same length before elements are
compared at all.

**★ Q: Why does `sorted()` put `"Zebra"` before `"apple"`?**
Strings compare by numerical Unicode code point, and every ASCII uppercase letter has
a lower code point than every ASCII lowercase letter. It is not alphabetical order and
never claimed to be. Use `key=str.casefold` for case-insensitive order, or a real
collator for language-correct order.

**★ Q: Two strings print identically but `==` says they differ. What happened?**
Unicode normalisation. The same grapheme can be a single precomposed code point (NFC)
or a base plus combining marks (NFD), and `str` equality is code-point equality.
Normalise both with `unicodedata.normalize("NFC", s)` — and do it at the ingest
boundary so the question never arises downstream.

**★ Q: Why does a tuple sort key work for multi-level sorting?**
Because tuple comparison is lexicographic: the first element decides, ties fall
through to the second, and so on — exactly `ORDER BY a, b, c`. And because it
short-circuits at the first unequal pair, later elements are only compared when
earlier ones tie, which is what makes the null-partitioning and heap-tiebreaker
idioms safe.

**Q: `lower()` or `casefold()` for case-insensitive comparison?**
`casefold()`. It is documented as more aggressive than lowercasing because it is
intended to remove *all* case distinctions — the standard example being German `ß`,
which casefolds to `ss` and lowercases to itself. `lower()` will miss matches that
`casefold()` finds.

**Q: How do you sort strings in a language-correct order?**
Not with `<`. The standard library offers `locale.strxfrm` as a key function (or
`locale.strcoll` through `functools.cmp_to_key`, which is the example in the
`functools` docs), both depending on process-global locale state. For anything
serious, use PyICU, which implements the Unicode Collation Algorithm with explicit,
non-global collators.

**Q: Why does `"" in "abc"` return `True`?**
Because the reference defines it that way: for `str` and `bytes`, `x in y` is true if
and only if `x` is a substring of `y`, and the empty string is a substring of every
string. It is a real edge case in input validation — an empty query matches
everything.

**Q: In `sorted(rows, key=lambda r: (r.a, r.b))`, when is `r.b` compared?**
Only when two rows have equal `a`. Tuple comparison is short-circuiting, so if `a`
values are all distinct, `b` is never compared at all — which is why a
`TypeError`-producing `b` can lurk undetected until a tie occurs.

---

← Prev: [NaN and the comparison protocol](06-nan-and-the-protocol.md) · Index: [Comparisons](README.md) · Next → [Mappings and sets](07b-mappings-and-sets.md)
