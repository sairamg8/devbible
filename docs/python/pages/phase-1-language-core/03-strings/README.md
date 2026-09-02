---
title: "Strings: immutable code points, a small method vocabulary, and three interpolation syntaxes"
sidebar_label: "03 · Strings"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [Text Sequence Type — `str`](https://docs.python.org/3.14/library/stdtypes.html#text-sequence-type-str)
> and [String Methods](https://docs.python.org/3.14/library/stdtypes.html#string-methods),
> the Language Reference
> §2.4 [String and Bytes literals](https://docs.python.org/3.14/reference/lexical_analysis.html),
> the [Format Specification Mini-Language](https://docs.python.org/3.14/library/string.html#format-specification-mini-language),
> the [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html), and
> [PEP 498](https://peps.python.org/pep-0498/),
> [PEP 701](https://peps.python.org/pep-0701/),
> [PEP 682](https://peps.python.org/pep-0682/) and
> [PEP 750](https://peps.python.org/pep-0750/).
> Target: **CPython 3.14**.

**A `str` is an immutable sequence of Unicode code points. Every other fact in
this topic is a consequence: strings can be dict keys because they cannot
change; building one with `+=` in a loop is quadratic because each step copies;
`len()` disagrees with what the user counted because code points are not
glyphs; and every method returns a new string rather than editing one. On top
of that sits a method vocabulary of about two dozen calls that replaces most
hand-rolled parsing, and three interpolation syntaxes — `%`, `str.format` and
the f-string — plus a fourth that is new in 3.14 and exists specifically to
close the injection hole the other three leave open.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Immutability and identity](01-immutability-and-identity.md)** | No mutating operation; hashability; code points vs bytes vs graphemes; normalisation; sequence operations; code-point ordering |
| 1b | **[Building strings and interning](01b-building-and-interning.md)** | The quadratic `+=` loop and `join`; `io.StringIO`; interning and why `is` accidentally works; `str` vs `repr` |
| 2 | **[The method vocabulary](02-the-method-vocabulary.md)** | `split` with and without a separator; `splitlines`; `partition`; `join`; `strip` as a character set; `removeprefix`/`removesuffix`; `find` vs `index`; `startswith` with a tuple |
| 2b | **[Replacing, case and classification](02b-replacing-case-and-classification.md)** | `replace` and `translate`; `casefold` vs `lower`; why `title()` is wrong for names; `isdigit` vs `isdecimal` vs `isnumeric`; padding |
| 3 | **[f-strings](03-f-strings.md)** | Compiled, not parsed; the `=` debug specifier; `!s`/`!r`/`!a`; what PEP 701 changed in 3.12; the walrus inside a field |
| 3b | **[When not to use an f-string](03b-when-not-to-use-an-f-string.md)** | `logging`; SQL, shell and HTML; `str.format` on a user-supplied template; templates that arrive at runtime |
| 3c | **[The format spec mini-language](03c-the-format-spec-mini-language.md)** | Fill, align, sign, `z`, `#`, `0`, width, grouping, precision and the type codes — and why `n` is a trap on a server |
| 3d | **[The `__format__` protocol](03d-the-format-protocol.md)** | `format()` calls the type; `str.format` field syntax and `format_map`; types with their own spec languages; writing `__format__` |
| 4 | **[t-strings](04-t-strings.md)** | New in 3.14 (PEP 750): `Template` and `Interpolation`, and the injection problem they exist to solve |

## The one paragraph the whole topic expands

You cannot change a string, so every "modification" is a new object and a copy;
that makes strings safe to share and hash, and makes naive concatenation
expensive. You cannot assume `len()` matches what a person sees, because a
`str` counts code points and a person counts glyphs. You cannot compare
user-supplied text without normalising and case-folding it first. And you
cannot interpolate a value into another language — SQL, HTML, a shell command —
with an f-string, because by the time the library sees the result the value and
the template are the same string.

## Where this connects

- **[`bytes` vs `str`](../04-bytes-and-encoding/README.md)** is the other half of text
  handling: this topic works entirely in `str`, and that one covers getting in
  and out of it.
- **[Comparisons](../06-comparisons/README.md)** picks up the `is` versus `==` rule
  that interning makes tempting to get wrong.
- **Phase 3 — Collections** relies on string hashability for every `dict` it
  builds.
- **Phase 9 — The web service** is where the injection material in chunk 3b
  stops being theoretical.

---

← Prev: [Numbers](../02-numbers/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [`bytes` vs `str`](../04-bytes-and-encoding/README.md)
