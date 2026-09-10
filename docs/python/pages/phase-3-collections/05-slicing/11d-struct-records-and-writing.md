---
title: "Records written back to back with no terminator are a `struct` layout of `s` fields cut with `iter_unpack`, and writing any fixed-width record is a width check you own — `ljust`, `rjust` and `zfill` never truncate, a slice truncates silently, and `struct.pack` truncates and pads with NUL bytes without a word"
sidebar_label: "11d · Slicing in real code: struct records and writing"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`struct`](https://docs.python.org/3.14/library/struct.html) (`Struct`, `iter_unpack`,
> `unpack_from`, the `s` format) and
> [`str.ljust` / `zfill` and `bytes.ljust`](https://docs.python.org/3.14/library/stdtypes.html#str.ljust);
> CPython v3.14.7 [`Modules/_struct.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_struct.c)
> for one error string. Split out of [11c · Fixed-width records](11c-fixed-width-records.md) on a
> concept boundary. Documentation-verified — **no sandbox run, no program output**.

**[11c](11c-fixed-width-records.md) reads line-based fixed-width files with a layout of slices. Two
jobs remain. Some formats have no line terminators at all — records follow each other byte for byte
— and there the natural tool is `struct`, which is a layout of fixed widths compiled once and applied
to a whole buffer. And every format has to be written as well as read, where the trap is inverted:
the reader's slices are only right if every field the writer produced is exactly its width, and
none of the standard padding tools will refuse a value that is too long.**

## Records with no line terminators: `struct`

Some formats write records back to back with no newline at all. `struct` cuts a whole buffer into
fixed-size records in one pass, and its `s` format is a byte field of a given width:

> *"For the `'s'` format character, the count is interpreted as the length of the byte string, not a
> repeat count like for the other format characters; for example, `'10s'` means a single 10-byte
> string"* · *"For unpacking, the resulting `bytes` object always has exactly the specified number
> of bytes."* — [`struct`, format characters](https://docs.python.org/3.14/library/struct.html)

```python
import struct
from collections.abc import Iterator

RECORD_WIDTH = 29                            # the layout from 11c
RECORD = struct.Struct("=10s4s12s3s")        # "=": standard sizes, no alignment padding
assert RECORD.size == RECORD_WIDTH           # the struct and the slice layout must agree

def iter_payments(data: bytes) -> Iterator[tuple[str, str, int, str]]:
    if len(data) % RECORD.size:
        raise ValueError(f"{len(data)} bytes is not a whole number of {RECORD.size}-byte records")
    for account, branch, amount, currency in RECORD.iter_unpack(data):
        yield account.decode("ascii"), branch.decode("ascii"), int(amount), currency.decode("ascii")

def payment_at(data: bytes, index: int) -> tuple[bytes, ...]:
    if not 0 <= index < len(data) // RECORD.size:
        raise IndexError(f"no record {index}")
    return RECORD.unpack_from(data, index * RECORD.size)
```

`iter_unpack` requires that *"The buffer's size in bytes must be a multiple of `size`"*; the 3.14.7
source raises `struct.error` with `iterative unpacking requires a buffer of a multiple of 29 bytes`
otherwise — a stray trailing newline is enough, hence the explicit check with a better message.
`int()` accepts the `bytes` field directly and tolerates its leading zeros. `payment_at` validates the
index because `unpack_from` has slicing's habit: *"A negative *offset* counts from the end of
*buffer*."* Record −1 would read the last record, the same trap as page −1 in
[11](11-slicing-in-real-code.md).

## Writing records: the width is yours to enforce

Every padding tool pads and none of them truncates:

> `str.ljust`: *"The original string is returned if *width* is less than or equal to `len(s)`."* ·
> `str.zfill`: *"The original string is returned if *width* is less than or equal to `len(s)`."* ·
> `bytes.ljust`: *"For `bytes` objects, the original sequence is returned if *width* is less than or
> equal to `len(s)`."* — [String methods](https://docs.python.org/3.14/library/stdtypes.html#str.ljust)

A value one character too long produces a record one character too long, and the reader's slices
shift every later field. Slicing the value to the width (`value[:width]`) fixes the record and loses
data silently. And `struct.pack` does both wrong: *"For packing, the byte string is truncated or
padded with null bytes as appropriate to make it fit"* — silent truncation, and NUL padding instead of
whatever pad character the specification names. Measure, then pad:

```python
def fit_text(value: str, width: int, encoding: str = "ascii") -> bytes:
    raw = value.encode(encoding)                         # measure what will be written
    if len(raw) > width:
        raise ValueError(f"{value!r} needs {len(raw)} bytes; the field has {width}")
    return raw.ljust(width, b" ")

def fit_number(value: int, width: int) -> bytes:
    if value < 0:
        raise ValueError("negative values need the specification's sign convention")
    digits = str(value).zfill(width)
    if len(digits) > width:
        raise ValueError(f"{value} does not fit in {width} digits")
    return digits.encode("ascii")

def write_payment(account: str, branch: str, amount_cents: int, currency: str) -> bytes:
    record = (fit_text(account, 10) + fit_text(branch, 4)
              + fit_number(amount_cents, 12) + fit_text(currency, 3))
    assert len(record) == RECORD_WIDTH
    return record + b"\r\n"
```

## Gotchas

**★ Symptom: the bank rejects an export file — one record is 31 characters in a 29-character
format.** Cause: `name.ljust(10)` with an eleven-character name returns the name unchanged; padding
never truncates. Fix: measure and raise — `fit_text` above.

**Symptom: amounts in an export are silently wrong for the largest payments.** Cause: the writer
sliced each value to its width — `str(amount)[:12]` — which keeps the leading digits of an overlong
number and drops the rest. Fix: refuse values that do not fit.

```python
if len(digits) > width:
    raise ValueError(f"{value} does not fit in {width} digits")
```

**Symptom: a downstream system shows `\x00` characters after short names.** Cause: `struct.pack`
with an `s` field pads with null bytes. Fix: pad with spaces yourself before packing, or build the
record with `fit_text`.

```python
packed = RECORD.pack(fit_text(account, 10), fit_text(branch, 4), fit_number(cents, 12), b"GBP")
```

**Symptom: `struct.error: iterative unpacking requires a buffer of a multiple of 29 bytes` on a file
that looks complete.** Cause: the producer appended a final newline, one byte that is not a record.
Fix: check the remainder explicitly and strip a documented trailer before unpacking.

```python
if data.endswith(b"\n") and len(data) % RECORD.size == 1:
    data = data[:-1]
```

**Symptom: a lookup by record number returns the last record in the file for a request with
`index=-1`.** Cause: `unpack_from` treats a negative offset as counting from the end of the buffer,
exactly as a slice does. Fix: validate the index before computing the offset — `payment_at` above.

```python
if not 0 <= index < len(data) // RECORD.size:
    raise IndexError(f"no record {index}")
```

## Interview questions

**★ Why is `ljust` not enough to write a fixed-width field?**
Because it only pads: a value longer than the width is returned unchanged, and the record comes out
too long. Truncating with a slice makes the record the right width by silently destroying data.
The writer has to measure the encoded value, raise if it does not fit, and pad only then.

**How do you parse a file of fixed-length records with no line terminators?**
Compile the layout with `struct.Struct` using `s` fields of each width and call `iter_unpack` on the
whole buffer, which requires the buffer to be a whole number of records; or slice a `memoryview` at
multiples of the record size. `unpack_from(buffer, offset)` reads one record at an offset — and, like
slicing, treats a negative offset as counting from the end, so validate the index.

**How do you keep a `struct` format and a slice layout for the same record from drifting apart?**
Derive one from the other, or assert that they agree when the module loads: `Struct.size` is the
total width the format describes, so `assert RECORD.size == RECORD_WIDTH` fails the moment a field is
widened in one and not the other. The contiguity check on the slice layout
([04](04-slice-objects.md)) covers the slices themselves.

---

← Prev: [11c · Slicing in real code: fixed-width records](11c-fixed-width-records.md) · [Topic index](README.md)
