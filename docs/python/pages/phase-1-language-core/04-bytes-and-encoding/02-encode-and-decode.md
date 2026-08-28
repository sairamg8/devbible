---
title: "Decode at the boundary, work in `str`, encode on the way out"
sidebar_label: "2 · Encode and decode"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html),
> [`str.encode`](https://docs.python.org/3.14/library/stdtypes.html#str.encode)
> and [`bytes.decode`](https://docs.python.org/3.14/library/stdtypes.html#bytes.decode),
> [`codecs`](https://docs.python.org/3.14/library/codecs.html), and
> [`UnicodeDecodeError`](https://docs.python.org/3.14/library/exceptions.html#UnicodeDecodeError).
> Target: **CPython 3.14**.

**There is one architectural rule for text in Python, and the Unicode HOWTO
states it outright: *"Software should only work with Unicode strings
internally, decoding the input data as soon as possible and encoding the output
only at the end."* Everything else in this topic is a consequence. A program
that decodes at its edges has exactly two places where an encoding can be
wrong, and both are visible in the source. A program that passes `bytes`
inward has an encoding question at every function boundary, and it will get one
of them wrong on data it has not seen yet.**

## The two operations

```python
"café".encode("utf-8")          # b'caf\xc3\xa9'  — text → octets
b"caf\xc3\xa9".decode("utf-8")  # "café"          — octets → text
```

Both default to UTF-8 when the encoding is omitted:

```python
"café".encode()                 # b'caf\xc3\xa9'
b"caf\xc3\xa9".decode()         # 'café'
```

That default is a *method* default and is not the same thing as the default
`open()` uses, which is the trap covered in
[The default encoding](03-the-default-encoding.md). Write the encoding
explicitly anyway: `s.encode("utf-8")` costs nine characters and removes an
entire category of "works on my machine".

The direction words are worth fixing in memory, because reversing them is the
most common confusion in the topic:

- **encode**: `str` → `bytes`. You are *encoding text for transport*.
- **decode**: `bytes` → `str`. You are *decoding what arrived*.

A `bytes` has no `.encode()` and a `str` has no `.decode()`. When you find
yourself reaching for the one that does not exist, you have the direction
backwards — or you are one layer away from where the conversion belongs.

## What goes wrong, and what the exception tells you

Two exceptions, both subclasses of `UnicodeError` which is a `ValueError`:

**`UnicodeDecodeError`** — the bytes are not valid in the encoding you claimed:

```python
b"caf\xe9".decode("utf-8")
# UnicodeDecodeError: 'utf-8' codec can't decode byte 0xe9 in position 3:
#                     invalid continuation byte
```

**`UnicodeEncodeError`** — the text contains a character the target encoding
cannot represent:

```python
"café".encode("ascii")
# UnicodeEncodeError: 'ascii' codec can't encode character '\xe9' in position 3:
#                     ordinal not in range(128)
```

Both carry structured attributes, which is what makes a useful error message
possible instead of a re-raise:

```python
try:
    text = raw.decode("utf-8")
except UnicodeDecodeError as exc:
    raise ValueError(
        f"{path}: not UTF-8 — byte {exc.object[exc.start]:#04x} "
        f"at offset {exc.start} ({exc.reason})"
    ) from exc
```

`exc.encoding`, `exc.object`, `exc.start`, `exc.end` and `exc.reason` are all
available. Reporting the *offset* is what lets somebody actually find the bad
byte in a 400 MB file.

## UTF-8, and why it is the answer

UTF-8 is a variable-width encoding: one byte for ASCII, up to four for
everything else. Three properties make it the correct default:

- **ASCII is a subset.** Any pure-ASCII file is byte-identical in UTF-8, so
  every legacy pipeline that only ever saw ASCII keeps working.
- **It is self-synchronising.** Continuation bytes are distinguishable from
  lead bytes, so a decoder can resynchronise after damage — and, more useful in
  practice, *invalid* UTF-8 is very likely to be detected rather than silently
  producing wrong characters.
- **It represents all of Unicode.** There is no character it cannot encode, so
  `UnicodeEncodeError` on output essentially disappears.

That last point is why encoding errors are almost always a sign that something
upstream chose a legacy encoding. The one-byte encodings — `latin-1`,
`cp1252` — can represent 256 characters and will raise on the rest.

## `latin-1`: the encoding that never fails, and why that is a trap

```python
b"\x89\xff\x00\x01".decode("latin-1")   # always succeeds — any byte is valid
```

`latin-1` maps bytes `0x00`–`0xFF` to code points `U+0000`–`U+00FF`, one to
one. It therefore **cannot raise a `UnicodeDecodeError`**, which makes it the
tempting "fix" when a decode fails. It is not a fix — it is a way of turning a
loud failure into silent garbage, the exact trade the language's two-type
design exists to prevent. `"café"` encoded as UTF-8 and decoded as `latin-1`
becomes `"cafÃ©"`, and that string will now be re-encoded and stored, so the
corruption is permanent.

*Mojibake* is the name for this, and the shape is recognisable: `Ã©` for `é`,
`â€™` for a curly apostrophe, `Ã¢â‚¬â„¢` when it has happened twice.

There is exactly one legitimate use for `latin-1`: as a **byte-transparent
transport** when a protocol forces you through a `str` API but the payload is
binary. HTTP header handling does this. If you are not consciously doing that,
you want UTF-8 and a real error.

## Round-tripping is not guaranteed

```python
"café".encode("utf-8").decode("utf-8")      # "café" — fine
"café".encode("ascii", errors="ignore")     # b'caf' — the é is gone forever
"café".encode("utf-8").decode("latin-1")    # "cafÃ©" — wrong, and it will stick
```

An encode/decode round trip is lossless only when the encoding can represent
every character *and* both sides name the same one. The moment an error handler
other than `strict` is involved, or the two sides disagree, information is lost
and no later step can recover it. This is why the boundary rule matters: one
decode in, one encode out, both explicit, and nothing in between has to think
about it.

## Where the boundaries actually are

```python
# File — say the encoding, always
with open(path, encoding="utf-8") as f:
    text = f.read()

# Network — decode what arrived
body = response.content.decode("utf-8")

# Subprocess — let it decode, or do it yourself
subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

# Database drivers decode for you; they are configured by the connection
# HTTP request/response bodies: the Content-Type charset parameter is the source of truth
# JSON: json.loads accepts bytes and str; JSON itself is defined as UTF-8
```

`json` is the one place the boundary is handled for you correctly by default:
`json.loads` accepts `bytes` and assumes UTF-8, which is what RFC 8259
mandates, and `json.dumps` returns `str`. Do not "help" it by decoding with
something else first.

## Gotchas

### Decoding with `latin-1` to make the error go away
**Symptom.** `Ã©` where `é` should be, spreading through the database over
weeks.
**Cause.** `latin-1` maps every byte to a code point and can never raise, so it
converts a detected error into undetected corruption.
**Fix.** Find the real encoding. If the source genuinely is unknown and mixed,
use `errors="replace"` so the damage is *visible* as `�`, or
`errors="surrogateescape"` so it round-trips — never `latin-1`.

### `str` has no `.decode`
**Symptom.** `AttributeError: 'str' object has no attribute 'decode'` — usually
in code being ported from Python 2.
**Cause.** In Python 3 a `str` is already decoded. The call is either backwards
or in the wrong layer.
**Fix.** Delete it. If you truly need bytes, `s.encode("utf-8")`.

### An encoding that is not specified
**Symptom.** A CSV reads fine on the developer's Linux machine and fails or
mangles accents on a Windows CI runner.
**Cause.** `open()` without `encoding=` uses the locale encoding, which differs
by platform.
**Fix.** `open(path, encoding="utf-8")` — every time. See
[the next chunk](03-the-default-encoding.md).

### Re-raising a `UnicodeDecodeError` with no location
**Symptom.** "Failed to parse input file" and a 400 MB file nobody can search.
**Cause.** The exception's structured attributes were discarded.
**Fix.**
```python
except UnicodeDecodeError as exc:
    raise ValueError(f"{path}: byte {exc.object[exc.start]:#04x} at offset {exc.start}") from exc
```

### Encoding twice
**Symptom.** `AttributeError: 'bytes' object has no attribute 'encode'`, or
base64 of base64.
**Cause.** A helper already encoded, and the caller encoded again — the usual
sign that the boundary is not in one place.
**Fix.** Push the conversion to the edge and type-annotate the layers: a
function that takes `bytes` should say so.

### Assuming UTF-8 is the file's encoding because it is the method default
**Symptom.** A file written by Excel on a Windows machine decodes with a
`UnicodeDecodeError` on byte `0x92`.
**Cause.** `bytes.decode()` defaults to UTF-8; the *file* was written in
`cp1252`, where `0x92` is a curly apostrophe.
**Fix.** Name the source's encoding — `raw.decode("cp1252")` — or ask the
producer to emit UTF-8. For Excel specifically, `utf-8-sig` handles the BOM it
writes.

### A BOM appearing as `﻿` at the start of the text
**Symptom.** The first column header of a CSV is `"﻿id"` and never matches
`"id"`.
**Cause.** The file starts with a UTF-8 byte-order mark, which decodes to
U+FEFF as an ordinary character.
**Fix.** Decode with `utf-8-sig`, which consumes the BOM if present and is
otherwise identical to `utf-8`.

## Interview questions

**Q: State the rule for handling text in a program.**
Decode at the input boundary, work only in `str` internally, encode once at the
output boundary. The Unicode HOWTO puts it as *"decoding the input data as soon
as possible and encoding the output only at the end."* It confines every
encoding decision to two visible places.

**Q: Which direction is `encode` and which is `decode`?**
`str.encode()` gives `bytes` — encoding text for transport. `bytes.decode()`
gives `str` — decoding what arrived. A `str` has no `.decode` and a `bytes` has
no `.encode`.

**Q: What is the default encoding of `str.encode()` and `bytes.decode()`?**
UTF-8, for both. That is *not* the same as `open()`'s default, which is the
locale encoding — a difference that has caused a great deal of confusion, and
which 3.15 finally removes.

**Q: Why is `latin-1` a dangerous "fix" for a `UnicodeDecodeError`?**
Because it maps every one of the 256 byte values to a code point, so it can
never fail. Using it converts a detected error into undetected corruption that
gets re-encoded and stored permanently — mojibake such as `Ã©` for `é`.

**Q: Is there any legitimate use for `latin-1`?**
Yes, as a byte-transparent transport when a protocol forces binary data through
a `str` API — HTTP header handling being the standard example. Outside that it
is almost always a bug.

**Q: What attributes does `UnicodeDecodeError` carry, and why do they matter?**
`encoding`, `object`, `start`, `end` and `reason`. They let you report the
offending byte and its offset, which is the difference between an actionable
error and "failed to parse the file".

**Q: What makes UTF-8 the right default?**
ASCII is a byte-identical subset, it is self-synchronising so invalid sequences
are detected rather than silently mistranslated, and it can represent every
Unicode character, which effectively eliminates `UnicodeEncodeError` on output.

**Q: When is an encode/decode round trip lossless?**
Only when the encoding can represent every character in the text, both sides
name the same encoding, and the error handler is `strict`. `errors="ignore"`
and a mismatched pair both destroy information irrecoverably.

**Q: What is `utf-8-sig` and when do you need it?**
UTF-8 that consumes a leading byte-order mark on decode (and writes one on
encode). You need it for files produced by Windows tools such as Excel;
without it the BOM decodes to a literal `﻿` that silently breaks the first
field name.

**Q: How does `json.loads` handle the boundary?**
It accepts `bytes` and decodes as UTF-8, which is what RFC 8259 requires of
JSON, and returns `str` throughout. It is one of the few APIs where the default
is already correct.

---

← Prev: [Two types that never mix](01-two-types-that-never-mix.md) · Index: [`bytes` vs `str`](README.md) · Next → [Error handlers](02b-error-handlers.md)
