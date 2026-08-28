---
title: "The `errors=` handlers: eight ways to not raise, and when each is the right one"
sidebar_label: "2b · Error handlers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14
> [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html),
> [`codecs` — Error Handlers](https://docs.python.org/3.14/library/codecs.html#error-handlers),
> [`os.fsencode`/`os.fsdecode`](https://docs.python.org/3.14/library/os.html#os.fsencode),
> and [PEP 383](https://peps.python.org/pep-0383/) (`surrogateescape`).
> Target: **CPython 3.14**.

**`encode` and `decode` both take an `errors=` argument, and the default is
`strict` — raise. The other handlers are not degrees of leniency; they are
different *decisions about what to do with data you cannot represent*, and they
differ in whether the loss is silent, visible, or reversible. Choosing between
them is a design question about your program's contract, not a way to make an
exception go away.**

## The handlers

| Handler | Direction | What it does |
|---|---|---|
| `strict` | both | Raise `UnicodeDecodeError`/`UnicodeEncodeError`. **The default.** |
| `ignore` | both | Drop the offending data. Silent and irreversible. |
| `replace` | decode | Insert `U+FFFD` `�` REPLACEMENT CHARACTER |
| `replace` | encode | Insert `?` |
| `backslashreplace` | both | Insert a `\xNN` (decode) or `\uNNNN` (encode) escape |
| `xmlcharrefreplace` | encode | Insert an XML character reference, `&#233;` |
| `namereplace` | encode | Insert a `\N{...}` named escape |
| `surrogateescape` | both | Map undecodable bytes to `U+DC80`–`U+DCFF` — **reversible** |
| `surrogatepass` | both | Allow surrogate code points through, normally illegal in UTF-8 |

```python
raw = b"caf\xe9"                        # latin-1 bytes, claimed as UTF-8

raw.decode("utf-8")                     # UnicodeDecodeError
raw.decode("utf-8", "ignore")           # 'caf'      — the byte is gone
raw.decode("utf-8", "replace")          # 'caf�' — renders as 'caf�'
raw.decode("utf-8", "backslashreplace") # 'caf\\xe9'  — visible and diagnosable
raw.decode("utf-8", "surrogateescape")  # 'caf\udce9' — and it round-trips

"café".encode("ascii", "ignore")            # b'caf'
"café".encode("ascii", "replace")           # b'caf?'
"café".encode("ascii", "backslashreplace")  # b'caf\\xe9'
"café".encode("ascii", "xmlcharrefreplace") # b'caf&#233;'
"café".encode("ascii", "namereplace")       # b'caf\\N{LATIN SMALL LETTER E WITH ACUTE}'
```

## How to choose

**`strict` — the default, and correct far more often than it is used.** If the
input is supposed to be UTF-8 and is not, that is a fact about the input worth
knowing. Reach for another handler only after deciding what the program should
do with damaged data.

**`replace` — when the data must flow and a human will read it.** The `�` is
the point: it is *visible*. A log viewer, a preview pane, a search index over
scraped documents. The damage is obvious to whoever looks at it, which is
exactly what `ignore` denies them.

**`ignore` — almost never.** It destroys data silently, which is the single
worst option in the table. The narrow legitimate case is stripping known noise
from a field you are about to hash or compare loosely, and even then say so in
a comment.

**`backslashreplace` — for diagnostics.** It is lossless in the sense that a
human can read the offending byte out of the output, which makes it the right
choice for an error message or a debug dump about data you could not decode.

**`xmlcharrefreplace` / `namereplace` — for a target format that has an escape
syntax.** XML output that must be ASCII, or generating Python/JSON source.
Narrow, but exactly right in their niche.

**`surrogatepass` — for talking to systems that allow lone surrogates**, such
as reading UTF-16 data produced by a Windows API or a JSON document containing
an unpaired `\uD800`. Normal UTF-8 forbids these; `surrogatepass` lets them
through unchanged.

## `surrogateescape`: the reversible one

This is the handler worth understanding properly, because it solves a problem
the others cannot. The HOWTO: *"The `surrogateescape` error handler will decode
any non-ASCII bytes as code points in a special range running from U+DC80 to
U+DCFF. These code points will then turn back into the same bytes when the
`surrogateescape` error handler is used to encode the data and write it back
out."*

That is the whole trick: undecodable bytes are parked in a reserved region of
the code space and come back out identical. So you can process a file whose
encoding you do not know, edit the parts you *do* understand, and write it back
without corrupting the parts you did not:

```python
with open(path, "r", encoding="ascii", errors="surrogateescape") as f:
    data = f.read()

data = data.replace("old-hostname", "new-hostname")

with open(path + ".new", "w", encoding="ascii", errors="surrogateescape") as f:
    f.write(data)
```

Every byte the ASCII decoder could not handle is preserved exactly.

**This is how Python itself handles filenames** (PEP 383). A POSIX filename is
a bag of bytes with no guaranteed encoding, but `os.listdir(".")` returns
`str`, so undecodable names come back with surrogates in them, and
`os.fsencode` turns them back into the original bytes:

```python
for name in os.listdir("."):
    os.stat(name)                 # works even for an undecodable name
    raw = os.fsencode(name)       # the original bytes, exactly
```

The catch, and it is a real one: **a string containing surrogates cannot be
encoded to UTF-8 with `strict`.** So the moment such a name reaches JSON, a
log, a database or an HTTP response, you get a `UnicodeEncodeError` far from
where the string was created:

```python
json.dumps({"file": name})
# UnicodeEncodeError: 'utf-8' codec can't encode character '\udce9'
#                     in position ...: surrogates not allowed
```

Handle it at the point of output, not by abandoning `surrogateescape`:

```python
safe = name.encode("utf-8", "surrogateescape").decode("utf-8", "replace")
```

## Registering your own

`codecs.register_error(name, handler)` adds a handler usable by name anywhere
`errors=` is accepted. The handler receives the exception object and returns a
`(replacement, resume_position)` pair:

```python
import codecs

def log_and_replace(exc: UnicodeError):
    logging.warning("undecodable byte %#04x at %d", exc.object[exc.start], exc.start)
    return ("�", exc.end)

codecs.register_error("log_and_replace", log_and_replace)
raw.decode("utf-8", "log_and_replace")
```

This is the honest answer when you must keep processing but must not lose the
audit trail — the combination `replace` alone cannot give you.

## Gotchas

### `errors="ignore"` as the reflex fix
**Symptom.** Records silently shorter than the source; a name that loses its
accent; a hash that does not match the sender's.
**Cause.** `ignore` deletes the offending data and leaves no trace that
anything happened.
**Fix.** Use `replace` if the data must flow (`�` is visible),
`backslashreplace` if a human is diagnosing, `surrogateescape` if it must round
trip — and `strict` if the input is genuinely supposed to be valid.

### A `UnicodeEncodeError` about surrogates, far from the cause
**Symptom.** `'utf-8' codec can't encode character '\udce9': surrogates not
allowed`, thrown by `json.dumps` or a logger, on data that was read hours ago.
**Cause.** A string produced by `surrogateescape` — very often a filename from
`os.listdir` — reached an output boundary that encodes strictly.
**Fix.** Sanitise at the boundary rather than at the source:
```python
def printable(s: str) -> str:
    return s.encode("utf-8", "surrogateescape").decode("utf-8", "replace")
```

### `replace` on the encode side inserting `?`
**Symptom.** A CSV full of `?` where accented characters should be.
**Cause.** On encode, `replace` inserts `?`, not `�` — and `?` is a perfectly
ordinary character that no downstream check will flag.
**Fix.** Encode to UTF-8, which can represent everything, instead of to a
legacy encoding with a lossy handler.

### Expecting `surrogateescape` to survive a re-decode
**Symptom.** Data that round-tripped correctly through one function comes back
mangled after passing through another.
**Cause.** The round trip only works if **both** the encode and the decode use
`surrogateescape`. One `strict` step in the middle either raises or loses it.
**Fix.** Keep the surrogate-bearing string inside one layer and convert at its
edges deliberately.

### `strict` treated as the aggressive option
**Symptom.** A codebase where every `decode` call has an `errors=` argument.
**Cause.** The habit of silencing the first `UnicodeDecodeError` that appeared.
**Fix.** Default to `strict` and justify each exception. A raised error at the
boundary is cheap; corrupted data in a database is not.

## Interview questions

**Q: What is the default `errors=` value and why does it matter?**
`strict` — raise. It matters because every other handler trades a loud failure
for some form of data loss, and that trade should be a deliberate decision
rather than a reflex.

**Q: Rank `ignore`, `replace` and `backslashreplace` by how much they cost you.**
`ignore` is worst: silent and irreversible. `replace` loses the same data but
makes the loss visible (`�` on decode, `?` on encode). `backslashreplace` loses
nothing a human cannot read back, which makes it the diagnostic choice.

**Q: What does `surrogateescape` do, and what is it for?**
It decodes undecodable bytes into the reserved range U+DC80–U+DCFF, and encodes
those code points back to the original bytes. It makes a decode/encode round
trip lossless for data whose encoding you do not know — which is exactly the
POSIX filename problem, and why Python uses it for the filesystem encoding
(PEP 383).

**Q: What is the cost of `surrogateescape`?**
The resulting string cannot be encoded to UTF-8 with `strict`, so it raises
`UnicodeEncodeError: surrogates not allowed` the moment it reaches JSON, a
logger or an HTTP response — typically far from where it was created. You have
to sanitise deliberately at each output boundary.

**Q: How do you turn a surrogate-bearing string into something safe to log?**
`s.encode("utf-8", "surrogateescape").decode("utf-8", "replace")` — go back to
the original bytes, then decode leniently so the bad parts become `�`.

**Q: `surrogateescape` versus `surrogatepass` — what is the difference?**
`surrogateescape` *creates* surrogates from undecodable bytes and turns them
back. `surrogatepass` lets surrogate code points that are already in the data
pass through a UTF-8 codec that would normally reject them — for talking to
systems, typically Windows or UTF-16 sources, that permit lone surrogates.

**Q: When would you use `xmlcharrefreplace`?**
Encoding to a target that must be ASCII but has its own escape syntax — XML or
HTML output. The characters survive as `&#233;` rather than being lost.

**Q: Can you write your own handler?**
Yes — `codecs.register_error(name, fn)`, where `fn` takes the exception and
returns `(replacement, resume_position)`. The standard reason to do it is to
log or count the failures while still producing output, which no built-in
handler does.

**Q: Why does `replace` behave differently on encode and decode?**
Because the replacement has to be valid in the target. Decoding produces text,
so it uses the Unicode replacement character `U+FFFD`; encoding produces bytes
in an encoding that may not have `U+FFFD`, so it uses ASCII `?`.

---

← Prev: [Encode and decode](02-encode-and-decode.md) · Index: [`bytes` vs `str`](README.md) · Next → [The default encoding](03-the-default-encoding.md)
