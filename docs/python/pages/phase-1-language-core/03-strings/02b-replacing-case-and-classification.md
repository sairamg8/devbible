---
title: "Replacing, recasing and classifying: the methods whose defaults are wrong for your data"
sidebar_label: "2b · Replacing, case and classification"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [String Methods](https://docs.python.org/3.14/library/stdtypes.html#string-methods) —
> [`str.replace`](https://docs.python.org/3.14/library/stdtypes.html#str.replace)
> (keyword `count` added 3.13),
> [`str.translate`](https://docs.python.org/3.14/library/stdtypes.html#str.translate),
> [`str.casefold`](https://docs.python.org/3.14/library/stdtypes.html#str.casefold),
> the `is*` family, and
> [`html.escape`](https://docs.python.org/3.14/library/html.html#html.escape).
> Target: **CPython 3.14**.

**Four methods in this half look like they do what their name says and do
something subtly wider. `replace` chained three times can escape its own
output. `lower()` is not the caseless comparison you want. `title()` is not how
names are capitalised. `isdigit()` says yes to characters `int()` refuses. Each
one is documented, each one is defensible in isolation, and each one produces a
bug that only shows up on real user data rather than on the test fixture.**

## Replacing and translating

```python
"a-b-c".replace("-", "_")             # "a_b_c"
"a-b-c".replace("-", "_", 1)          # "a_b-c" — count limits the replacements
"a-b-c".replace("-", "_", count=1)    # count as a keyword: added in 3.13
```

For many single-character substitutions at once, `translate` beats chained
`replace` calls — it is one pass, and chained replaces can re-replace their own
output:

```python
table = str.maketrans({"<": "&lt;", ">": "&gt;", "&": "&amp;"})
"<b> & </b>".translate(table)         # "&lt;b&gt; &amp; &lt;/b&gt;"

drop = str.maketrans("", "", "-_ ")   # third argument: characters to delete
"01-23 45_67".translate(drop)         # "01234567"
```

The chained-`replace` bug is worth seeing: escaping `&` *after* `<` turns the
`&lt;` you just produced into `&amp;lt;`. `translate` cannot make that mistake
because it never looks at its own output.

## Case

```python
"HeLLo".lower()               # "hello"
"HeLLo".upper()               # "HELLO"
"hello world".capitalize()    # "Hello world"
"hello world".title()         # "Hello World"
"HeLLo".swapcase()            # "hEllO"
```

For **caseless comparison**, `casefold` is the correct method, not `lower`.
The docs call it *"similar to lowercasing but more aggressive because it is
intended to remove all case distinctions in a string"*:

```python
"ß".lower()                   # "ß"  — unchanged
"ß".casefold()                # "ss" — now it matches "SS".casefold()

def same_user(a: str, b: str) -> bool:
    return a.casefold() == b.casefold()
```

`title()` is almost always the wrong tool for human names — it uppercases after
every non-letter, so `"o'brien"` becomes `"O'Brien"` (right) and `"mcdonald"`
becomes `"Mcdonald"` (wrong), while `"JEAN-LUC"` becomes `"Jean-Luc"` (right by
luck). Display the name the user typed.

## Classification

The `is*` family answers "is every character in this string of kind X", and
they are all `False` for the empty string except `isascii()`, which is `True`
for it.

```python
"42".isdigit()        # True
"4²".isdigit()        # True  — superscript two is a digit character
"4²".isdecimal()      # False — decimal is base-10 digits only
"⅕".isnumeric()       # True  — numeric includes fractions
"⅕".isdigit()         # False
```

Only `isdecimal()` matches what `int()` will accept. This is a live input bug:

```python
if raw.isdigit():
    n = int(raw)      # ValueError on "4²" — isdigit said yes, int says no
```

```python
if raw.isdecimal():   # correct guard for int()
    n = int(raw)
```

Even `isdecimal()` is narrower than `int()` in one direction — it is `False`
for `"-1"` and for `" 42 "`, both of which `int()` accepts. When the question
is genuinely "can this be parsed", the honest answer is to try:

```python
try:
    n = int(raw)
except ValueError:
    n = None
```

That is [EAFP](../12-eafp-vs-lbyl/README.md), and this is the textbook case for it.

The rest of the family: `isalpha`, `isalnum`, `isspace`, `isidentifier`,
`islower`, `isupper`, `istitle`, `isprintable`, `isascii` (3.7).
`isidentifier()` is the correct check before using a string as an attribute or
keyword-argument name, and it does not check against keywords — pair it with
`keyword.iskeyword()`.

## Padding and alignment

```python
"Python".ljust(10)            # "Python    "
"Python".rjust(10, ".")       # "....Python"
"Python".center(10)           # "  Python  "
"42".zfill(5)                 # "00042"
"-42".zfill(5)                # "-0042"  — sign-aware, unlike rjust("0")
"a\tb".expandtabs(4)          # "a   b"
```

These predate the format mini-language and still read well for fixed-width
output, but `f"{value:>10}"` does the same job with alignment and type handling
in one place — see [the format spec mini-language](03c-the-format-spec-mini-language.md).

## Gotchas

### Chained `replace` for HTML escaping
**Symptom.** `&lt;` in the output becomes `&amp;lt;`.
**Cause.** Replacing `<` first inserts an `&`, which the later `&` replacement
then escapes again.
**Fix.** One pass with `translate`, or better, use the library:
```python
import html
html.escape(user_text)      # handles &, <, > and quotes, in the right order
```

### `lower()` for caseless comparison
**Symptom.** Two users register as `"straße"` and `"STRASSE"` and are treated as
different accounts.
**Cause.** `lower()` performs simple lowercasing; German sharp s has no
lowercase form to fold into `ss`.
**Fix.** `a.casefold() == b.casefold()`, after Unicode normalisation.

### `title()` on names
**Symptom.** `"mcdonald"` renders as `"Mcdonald"`, `"o'brien"` becomes
`"O'Brien"` in one place and something else in another.
**Cause.** `title()` uppercases the first cased character after every uncased
one — an approximation that no naming convention actually follows.
**Fix.** Store and display what the user typed; do not "helpfully" recase names.

### `isdigit()` guarding `int()`
**Symptom.** `ValueError: invalid literal for int() with base 10` on a line the
code has just verified is "all digits".
**Cause.** `isdigit()` is `True` for compatibility digit characters such as
superscripts that `int()` rejects. `isnumeric()` is broader still and accepts
fractions.
**Fix.** Either narrow the guard, or stop guarding and catch.
```python
try:
    n = int(raw)
except ValueError:
    raise ValueError(f"not an integer: {raw!r}") from None
```

## Interview questions

**Q: `lower()` or `casefold()` for a case-insensitive comparison?**
`casefold()`. It is more aggressive and designed for caseless matching —
`"ß".casefold()` is `"ss"` while `"ß".lower()` is unchanged. Normalise Unicode
first if the input is user-supplied.

**Q: `isdigit()`, `isdecimal()`, `isnumeric()` — rank them and say which guards
`int()`.**
`isdecimal()` ⊂ `isdigit()` ⊂ `isnumeric()`. Only `isdecimal()` is close to
what `int()` accepts, and it is still wrong for `"-1"` and `" 42 "`. The
reliable check is `try: int(raw) except ValueError`.

**Q: How do you strip several characters out of a string in one pass?**
`s.translate(str.maketrans("", "", "-_ "))` — the third `maketrans` argument is
a set of characters to delete.

**Q: Why prefer `translate` over chained `replace` for escaping?**
`translate` makes a single pass and never re-examines its own output. Chained
`replace` calls can escape the escape — replacing `<` with `&lt;` and then `&`
with `&amp;` yields `&amp;lt;`.

**Q: Which `is*` method should you use before treating a string as an attribute
name?**
`str.isidentifier()`, paired with `keyword.iskeyword()` — `isidentifier()`
returns `True` for `"class"`, which is a valid identifier shape but a reserved
word.

---

← Prev: [The method vocabulary](02-the-method-vocabulary.md) · Index: [Strings](README.md) · Next → [f-strings](03-f-strings.md)
