---
title: "A fixed-width specification counts columns from 1 and includes both ends while a slice counts from 0 and excludes its stop — convert once into a checked layout, slice bytes when the specification counts bytes, remove the terminator and nothing else, and strip each field rather than the line"
sidebar_label: "11c · Slicing in real code: fixed-width records"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`int`](https://docs.python.org/3.14/library/functions.html#int), the
> [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html) and the
> [standard encodings](https://docs.python.org/3.14/library/codecs.html#standard-encodings) table.
> Documentation-verified — **no sandbox run, no program output**.

**Bank statements, payroll exports, mainframe extracts and carrier manifests still arrive as records
where each field is a run of columns. [04](04-slice-objects.md) showed the right shape — a table of
named slices, checked for gaps and overlaps, cut with `itemgetter` — and
[03](03-out-of-range-never-raises.md) the length check that turns a short record into an error. This
page is everything between the specification and that table when you read a file: the
specification numbers columns from 1 and includes the last one, it may count bytes rather than
characters, and the line has a terminator that is not part of the record. Records with no
terminators at all, and writing records back, are [11d](11d-struct-records-and-writing.md).**

## From specification columns to slices

A specification says *"Branch: columns 11–14"* — 1-based and inclusive, four characters. The slice
is `slice(10, 14)`: subtract one from the first column, keep the last as the stop. Some
specifications say *"position 11, length 4"* instead, which is the same slice.

```python
def columns(first: int, last: int) -> slice:
    """Specification columns are 1-based and inclusive: columns(11, 14) is four characters."""
    if not 1 <= first <= last:
        raise ValueError(f"bad column range {first}-{last}")
    return slice(first - 1, last)


def at(position: int, length: int) -> slice:
    """'Position 11, length 4' — 1-based start plus a width."""
    if position < 1 or length < 1:
        raise ValueError(f"bad field at {position} length {length}")
    return slice(position - 1, position - 1 + length)


LAYOUT = {
    "account": columns(1, 10),
    "branch": columns(11, 14),
    "amount_cents": columns(15, 26),
    "currency": columns(27, 29),
}
RECORD_WIDTH = 29
```

| Field | Specification | Slice | Width |
|---|---|---|---:|
| account | columns 1–10 | `slice(0, 10)` | 10 |
| branch | columns 11–14 | `slice(10, 14)` | 4 |
| amount_cents | columns 15–26 | `slice(14, 26)` | 12 |
| currency | columns 27–29 | `slice(26, 29)` | 3 |

The two classic conversions are both wrong by one — `slice(first, last)` starts a column late,
`slice(first - 1, last - 1)` ends a column early — and both are caught at import time by the
contiguity check from [04](04-slice-objects.md): with a wrong conversion, one field's stop is no
longer the next field's start, or the layout no longer covers exactly `RECORD_WIDTH`.

```python
check_layout(tuple(LAYOUT.values()), RECORD_WIDTH)     # from 04: raises on any gap or overlap
```

## Bytes or characters: read the specification

A slice of a `str` counts code points; a slice of `bytes` counts bytes. For ASCII data they agree.
The moment a field holds a non-ASCII name they do not — *"If the code point is >= 128, it's turned
into a sequence of two, three, or four bytes"* ([Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html))
— and if the producer padded fields to a width in **bytes**, decoding the line first makes `é` one
position where the file has two, and every field after it starts one column early. The fix is to
slice before decoding, and decode each field with the specification's encoding:

```python
from collections.abc import Iterator
from pathlib import Path


def read_records(path: Path, encoding: str = "ascii") -> Iterator[dict[str, str]]:
    with path.open("rb") as stream:                       # bytes: positions are byte offsets
        for line_no, line in enumerate(stream, start=1):
            record = line.rstrip(b"\r\n")                 # the terminator, and only the terminator
            if len(record) != RECORD_WIDTH:
                raise ValueError(f"line {line_no}: {len(record)} bytes, expected {RECORD_WIDTH}")
            yield {name: record[field].decode(encoding).rstrip(" ")
                   for name, field in LAYOUT.items()}
```

If the specification counts **characters** instead, open in text mode with the stated encoding and
slice the `str`. What matters is that you decided, from the specification rather than from the
sample file, which is usually all ASCII. Legacy encodings are in the
[standard encodings](https://docs.python.org/3.14/library/codecs.html#standard-encodings) table —
`cp1252` for Windows exports, `cp037` and `cp500` among the EBCDIC code pages. Decoding per field
has a useful side effect: a field boundary that falls inside a multi-byte character makes that
field's strict decode raise, instead of silently shifting the rest.

## The terminator is not part of the record

Three ways to remove it, one right:

- `line[:-1]` removes the last character whether or not it is a newline. The final line of a file
  often has no terminator, so its last field loses a character — and the length check, if present,
  reports a record one short.
- `line.rstrip("\n")` leaves the `\r` of a CRLF file on the end: every record is one too long, or the
  last field carries a carriage return into the database.
- `line.strip()` removes the terminator **and the padding**: a record whose last field is blank, or
  whose first field is right-aligned with leading spaces, shrinks. With a length check it is rejected;
  without one, every field after the removed spaces shifts left.

`line.rstrip(b"\r\n")` removes only CR and LF characters from the end; field padding survives until
each field is stripped on its own.

## Parsing field values

- **Numbers**: `int()` accepts leading zeros and surrounding whitespace — *"have leading zeros, be
  surrounded by whitespace"* ([`int`](https://docs.python.org/3.14/library/functions.html#int)) — so
  `"000000012550"` and `"       12550"` both parse. An all-blank field does not: after the
  whitespace there is nothing, and `int` raises `ValueError`. Decide what blank means in the
  specification (zero, absent, an error) and handle it before `int`.
- **Implied decimals**: an amount field in cents stays an `int`; convert to `Decimal` at the edge,
  never to `float`.
- **Text**: strip the pad character the specification names — usually trailing spaces for
  left-justified text, leading zeros or spaces for right-justified numbers — per field.

## Gotchas

**★ Symptom: every field after the first is off by one character — amounts gain a leading digit
from the branch code.** Cause: the specification's 1-based inclusive columns were copied into slices
as `slice(first, last)`. Fix: convert with `columns()` and run the contiguity check at import.

```python
LAYOUT = {"account": columns(1, 10), "branch": columns(11, 14)}
```

**★ Symptom: records for customers with accented names have their amount and currency shifted by
one or two columns.** Cause: the file's widths are in bytes, the parser decoded each line first, and
a two-byte character counted as one position. Fix: read in binary, slice bytes, decode each field.

```python
with path.open("rb") as stream:
    for line in stream:
        record = line.rstrip(b"\r\n")
        fields = {name: record[f].decode("utf-8").rstrip(" ") for name, f in LAYOUT.items()}
```

**★ Symptom: the last record of every file fails the length check, one character short.** Cause:
`line[:-1]` removed the final character of a line that had no terminator. Fix: remove only
terminator characters.

```python
record = line.rstrip(b"\r\n")
```

**Symptom: files produced on Windows fail validation with every record one byte too long.** Cause:
`rstrip(b"\n")` left the `\r` of each CRLF terminator. Fix: strip both — `rstrip(b"\r\n")`.

**Symptom: records whose final field is blank are rejected as short, or parsed with shifted
fields.** Cause: `line.strip()` removed the trailing spaces that pad the last field. Fix: strip the
terminator from the line and padding from each field separately — `read_records` above.

**Symptom: `ValueError: invalid literal for int()` from a numeric field in a small fraction of
records.** Cause: the field was blank — spaces only — which `int()` rejects once the whitespace is
removed. Fix: handle blank before converting.

```python
raw = record[LAYOUT["amount_cents"]].strip()
amount_cents = int(raw) if raw else None
```

## Interview questions

**★ A specification says a field occupies columns 11–14. What is the Python slice, and why?**
`slice(10, 14)`. Specifications number columns from 1 and include both ends; Python indexes from 0
and excludes the stop. Subtracting one from the first column converts the start; the last column,
unchanged, is exactly one past the field's final 0-based index, which is what an exclusive stop
means. The width is `14 - 10 = 4`, matching the four columns 11, 12, 13, 14.

**★ Should you slice a fixed-width record as bytes or as text?**
Whichever unit the specification counts. If widths are in bytes — common where the format predates
Unicode — read the file in binary, slice bytes, and decode each field, because a multi-byte
character would otherwise shift every later field. If widths are in characters, decode first and
slice the string. For pure ASCII the two agree, which is why the difference hides until the first
non-ASCII name.

**Why is `line[:-1]` a bug when reading records?**
It removes the last character unconditionally. The last line of a file often has no terminator, so
its final field loses a real character; and on a CRLF file it leaves the `\r` behind.
`rstrip("\r\n")` — or `rstrip(b"\r\n")` on bytes — removes only terminator characters, and removes
none when there are none.

---

← Prev: [11b · Slicing in real code: batching](11b-batching.md) · [Topic index](README.md) · Next → [11d · Slicing in real code: `struct` records and writing](11d-struct-records-and-writing.md)
