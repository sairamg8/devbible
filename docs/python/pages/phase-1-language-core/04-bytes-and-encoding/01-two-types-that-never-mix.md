---
title: "Two types that never mix: text is `str`, bytes are `bytes`, and Python refuses to guess"
sidebar_label: "1 · Two types that never mix"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [Binary Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#binary-sequence-types-bytes-bytearray-memoryview),
> the Language Reference §2.4 [Bytes literals](https://docs.python.org/3.14/reference/lexical_analysis.html#string-and-bytes-literals),
> the [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html), and
> [`BytesWarning`](https://docs.python.org/3.14/library/exceptions.html#BytesWarning).
> Target: **CPython 3.14**.

**Python 3 has two sequence types for what Python 2 called "a string", and they
do not interoperate at all. `str` is a sequence of Unicode code points and means
*text*. `bytes` is a sequence of integers in `0..255` and means *octets on a
wire or on a disk*. You cannot concatenate them, they never compare equal, and
no operation silently converts one to the other. That refusal is the feature —
it is what turns the entire class of encoding bugs from "wrong characters
appear in production three months later" into "a `TypeError` on line 40 during
development".**

## The refusal, demonstrated

```python
b"hello" + "world"      # TypeError: can't concat str to bytes
b"hello" == "hello"     # False — never equal, and no warning by default
"hello"[0]              # "h"   — a length-1 str
b"hello"[0]             # 104   — an int!
b"hello"[0:1]           # b"h"  — slicing gives bytes
```

That indexing asymmetry is the one that trips everyone. `b"hello"[0]` is an
`int` because a `bytes` *is* a sequence of integers; only slicing gives you a
`bytes` back. So the loop shapes differ:

```python
for ch in "abc":        # "a", "b", "c"  — each a str
    ...
for n in b"abc":        # 97, 98, 99     — each an int
    ...
for chunk in [b"abc"[i:i+1] for i in range(3)]:   # b"a", b"b", b"c"
    ...
```

`b"hello" == "hello"` returning `False` rather than raising is worth pausing
on: it is a *silent* wrong answer, and the usual way it appears is a dictionary
lookup that misses because the keys came from a socket and the lookup used a
literal. Run with `-b` to turn such comparisons into a `BytesWarning`, and with
`-bb` to make them errors — a genuinely useful flag for a test suite that
handles both kinds of data.

## Bytes literals

```python
b"PNG"                  # ASCII characters only
b"\x89PNG\r\n\x1a\n"    # anything outside ASCII must be an escape
rb"C:\path"             # raw bytes literal
bytes([137, 80, 78])    # from a list of ints
bytes(4)                # b"\x00\x00\x00\x00" — a zero-filled buffer of length 4!
bytes.fromhex("89 50 4e 47")
b"\x89PNG".hex()        # "8950 4e47" style hex text, back out again
```

The docs are explicit about the literal restriction: bytes literals *"may only
contain ASCII characters; bytes with a numeric value of 128 or greater must be
expressed with escape sequences"*. So `b"café"` is a `SyntaxError` — there is no
"the encoding of the source file" answer, because a bytes literal is not text.

`bytes(4)` is the trap in that list: passing an `int` gives a zero-filled buffer
of that length, not the digit. `bytes("4")` raises — a `str` needs an encoding —
and `b"4"` is what you meant.

## The three binary types

| Type | Mutable | What it is for |
|---|---|---|
| `bytes` | no | The default. An immutable octet sequence — a message, a file's contents, a hash |
| `bytearray` | **yes** | Building or patching a buffer in place |
| `memoryview` | (follows its target) | A **zero-copy** view into another object's buffer |

```python
buf = bytearray(b"Hello")
buf[0] = ord("J")               # in-place — bytes cannot do this
buf.extend(b"!")                # bytearray(b"Jello!")
bytes(buf)                      # freeze it back to an immutable bytes

data = bytearray(1024 * 1024)
view = memoryview(data)
view[100:200] = payload         # writes into `data` with no copy
header = view[:16]              # a view, not a copy
```

`memoryview` is what makes it possible to parse a multi-megabyte frame without
allocating a new object per field. Slicing `bytes` copies; slicing a
`memoryview` does not. Two rules keep it usable: `bytes(view)` when you need a
real object to keep, and release the view (or use it in a `with` block) before
resizing the underlying `bytearray`, which raises
`BufferError: Existing exports of data: object cannot be re-sized` while a view
is alive.

## The method vocabulary is (almost) the same

`bytes` and `bytearray` carry parallels of nearly every `str` method — `split`,
`join`, `strip`, `startswith`, `find`, `replace`, `partition`, `splitlines`,
`upper`, `ljust`, the `is*` family — with the same semantics, operating on
ASCII:

```python
b"a,b,c".split(b",")            # [b'a', b'b', b'c'] — the separator must be bytes too
b", ".join([b"a", b"b"])        # b'a, b'
b"  x  ".strip()                # b'x'
b"file.PNG".lower()             # b'file.png' — ASCII case only
```

The arguments must be `bytes` as well; `b"a,b".split(",")` raises. What is
*missing* is the text-only material: there is no `casefold`, no `encode` (a
`bytes` has nothing to encode), no format spec mini-language, and no f-string —
`bf"..."` is not a valid prefix. `%`-formatting *is* supported on `bytes`
(restored in 3.5 by PEP 461) precisely because binary protocols need it:

```python
b"GET %s HTTP/1.1\r\n" % (path_bytes,)
```

## Which one does a library hand you?

This is the practical question, and the answers are not uniform:

| Source | Gives you |
|---|---|
| `open(path)` (text mode) | `str` — decoded for you, with an encoding you should have specified |
| `open(path, "rb")` | `bytes` |
| `socket.recv()` | `bytes` |
| `subprocess.run(...).stdout` | `bytes`, unless `text=True` |
| `requests` `.content` / `.text` | `bytes` / `str` |
| `json.loads` | accepts both; always returns `str` inside |
| `hashlib.sha256(...)` | requires `bytes`; `.hexdigest()` gives `str` |
| `os.listdir(".")` / `os.listdir(b".")` | `str` / `bytes` — the argument's type decides |
| `base64.b64encode` | `bytes` **in and out** — a very common surprise |

That last row is worth its own line: `base64.b64encode(b"x")` returns
`b"eA=="`, not `"eA=="`. Base64 output is ASCII text conceptually, and `bytes`
mechanically, so it almost always needs a `.decode("ascii")` before it goes
into JSON.

## Gotchas

### `b"x" == "x"` is silently False
**Symptom.** A dictionary lookup misses, a membership test fails, or a branch
never fires — with no exception anywhere.
**Cause.** `bytes` and `str` are never equal. Unlike concatenation, comparison
does not raise; it returns `False`.
**Fix.** Decode at the boundary so only one type circulates, and run tests with
`-bb` to turn the comparison into an error.
```python
python -bb -m pytest        # BytesWarning becomes an exception
```

### Indexing a `bytes` gives an `int`
**Symptom.** `TypeError: a bytes-like object is required, not 'int'` one line
after an index, or a comparison against `b"\n"` that is never true.
**Cause.** `b"abc"[0]` is `97`. Only slicing returns `bytes`.
**Fix.** Slice instead of index, or compare against the integer.
```python
if data[0:1] == b"\n":  ...
if data[0] == 0x0A:     ...
```

### `bytes(n)` where `b"n"` was meant
**Symptom.** A mysterious run of NUL bytes in the output.
**Cause.** `bytes(4)` allocates a zero-filled buffer of length 4. Passing an
`int` is the buffer constructor, not a conversion.
**Fix.** `b"4"`, or `str(4).encode()` if the number is a variable.

### Forgetting `base64` returns `bytes`
**Symptom.** `TypeError: Object of type bytes is not JSON serializable`.
**Cause.** `b64encode` takes `bytes` and returns `bytes`, even though the
result is ASCII by construction.
**Fix.**
```python
token = base64.b64encode(raw).decode("ascii")
```

### A non-ASCII character in a bytes literal
**Symptom.** `SyntaxError: bytes can only contain ASCII literal characters`.
**Cause.** A bytes literal has no encoding, so there is no answer to what
`b"café"` should contain.
**Fix.** Write the text as a `str` and encode it explicitly:
`"café".encode("utf-8")`.

### Resizing a `bytearray` that a `memoryview` is watching
**Symptom.** `BufferError: Existing exports of data: object cannot be re-sized`.
**Cause.** A live `memoryview` pins the buffer; appending would move it.
**Fix.** Release the view first — `view.release()`, or use it inside a `with`
block so it closes deterministically.

### Mixing types in a `bytes` method argument
**Symptom.** `TypeError: a bytes-like object is required, not 'str'` inside
`split`, `strip`, `replace` or `startswith`.
**Cause.** The parallel methods take `bytes` arguments; there is no coercion.
**Fix.** Prefix the literal: `data.split(b",")`, `data.startswith(b"HTTP/")`.

## Interview questions

**Q: What is the difference between `str` and `bytes` in Python 3?**
`str` is an immutable sequence of Unicode code points and represents text.
`bytes` is an immutable sequence of integers in `0..255` and represents octets.
They do not concatenate, never compare equal and are never implicitly
converted — `str.encode()` and `bytes.decode()` are the only bridges.

**Q: Why is `b"abc"[0]` an int?**
Because a `bytes` object is genuinely a sequence of integers, so indexing
yields an element of that sequence. Slicing — `b"abc"[0:1]` — is what gives you
a one-byte `bytes` back.

**Q: `b"x" == "x"` — does it raise?**
No, it returns `False`, which makes it more dangerous than concatenation. Run
with `-b` to get a `BytesWarning` or `-bb` to make it an error.

**Q: What does `bytes(4)` produce?**
`b"\x00\x00\x00\x00"` — a zero-filled buffer of length four. The `int`
constructor is an allocation, not a conversion.

**Q: When do you reach for `bytearray` instead of `bytes`?**
When you are building or patching a buffer in place. `bytes` is immutable, so
appending in a loop has the same quadratic problem as string concatenation;
`bytearray.extend` does not.

**Q: What is `memoryview` for?**
Zero-copy access to another object's buffer. Slicing `bytes` copies; slicing a
`memoryview` returns another view over the same memory. It is how you parse a
large frame without allocating a new object per field. Its cost is that it pins
the buffer — the underlying `bytearray` cannot be resized while a view is live.

**Q: Why can a bytes literal not contain `é`?**
Because a bytes literal has no encoding; the docs restrict it to ASCII and
require bytes ≥ 128 to be written as escapes. `"é".encode("utf-8")` is the
explicit form, and it makes the encoding decision visible.

**Q: Can you use an f-string with bytes?**
No — `bf"..."` is not a valid prefix, deliberately, since interpolation implies
a text-formatting model. `%`-formatting *does* work on `bytes` (PEP 461, 3.5),
which is what binary protocol code uses.

**Q: What does `base64.b64encode` return?**
`bytes`. The output is ASCII by construction but the type is binary, so it
usually needs `.decode("ascii")` before it goes anywhere text-shaped like JSON.

**Q: How do `os.listdir(".")` and `os.listdir(b".")` differ?**
The argument type selects the result type: a `str` argument yields `str`
names, a `bytes` argument yields raw `bytes` names. The `bytes` form is how you
handle filenames that are not valid in the filesystem encoding.

---

← Prev: [Strings](../03-strings/README.md) · Index: [`bytes` vs `str`](README.md) · Next → [Encode and decode](02-encode-and-decode.md)
