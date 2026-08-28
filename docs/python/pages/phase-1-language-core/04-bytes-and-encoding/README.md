---
title: "`bytes` vs `str`: decode at the boundary, work in text, encode on the way out"
sidebar_label: "04 · bytes vs str"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14
> [Unicode HOWTO](https://docs.python.org/3.14/howto/unicode.html),
> [Binary Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#binary-sequence-types-bytes-bytearray-memoryview),
> [`open()`](https://docs.python.org/3.14/library/functions.html#open),
> [`codecs` error handlers](https://docs.python.org/3.14/library/codecs.html#error-handlers),
> and [PEP 383](https://peps.python.org/pep-0383/),
> [PEP 540](https://peps.python.org/pep-0540/),
> [PEP 597](https://peps.python.org/pep-0597/),
> [PEP 686](https://peps.python.org/pep-0686/).
> Target: **CPython 3.14**.

**Python 3 keeps text and octets in two types that never mix, and that refusal
to guess is the whole design. `str` is Unicode code points and means text;
`bytes` is integers `0..255` and means what is on the wire. There is one
architectural rule — the Unicode HOWTO's own words, *"decoding the input data
as soon as possible and encoding the output only at the end"* — and one live
trap: `open()` in text mode does **not** default to UTF-8, it defaults to the
locale's encoding, so the same program reads the same file differently on
Linux and on Windows. PEP 686 is Final and fixes that in 3.15.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Two types that never mix](01-two-types-that-never-mix.md)** | No implicit conversion; `b"x" == "x"` silently False; indexing gives an `int`; bytes literals are ASCII-only; `bytearray` and `memoryview`; which library hands you which |
| 2 | **[Encode and decode](02-encode-and-decode.md)** | The boundary rule; the two exceptions and the attributes that make them useful; why UTF-8 is the answer; `latin-1` as a trap; where the boundaries actually are |
| 2b | **[Error handlers](02b-error-handlers.md)** | `strict`/`ignore`/`replace`/`backslashreplace`/`xmlcharrefreplace`/`namereplace`; `surrogateescape` as the reversible one and the POSIX-filename problem it solves; registering your own |
| 3 | **[The default encoding](03-the-default-encoding.md)** | `open()` uses the locale, not UTF-8; UTF-8 Mode (PEP 540); `EncodingWarning` (PEP 597); **PEP 686 makes UTF-8 the default in 3.15**; the filesystem encoding |

⚠️ **This topic is complete for what it claims but one planned chunk was not
written** — a *"where it bites in real code"* walk through CSV, subprocess,
HTTP and database boundaries. The material it would have carried is present in
chunk 2's *Where the boundaries actually are* and in the gotchas of chunks 2b
and 3; what is missing is the worked end-to-end example, not a fact.

## The one paragraph the whole topic expands

Decode once, at the edge, naming the encoding. Work in `str` everywhere
inside — no function in the middle of your program should have an opinion
about encodings. Encode once, at the other edge, naming the encoding again.
When a decode fails, that is information: `latin-1` will make the exception go
away and replace it with permanent silent corruption, so choose an error
handler on purpose — `replace` when a human will see the `�`,
`backslashreplace` when someone is diagnosing, `surrogateescape` when the bytes
must survive a round trip, and `ignore` essentially never.

## Where this connects

- **[Strings](../03-strings/README.md)** is the other half: everything this
  topic decodes *into*.
- **Phase 0 — [Running code](../../phase-0-runtime/06-running-code/README.md)**
  covers the interpreter flags this topic uses — `-X utf8`, `-X warn_default_encoding`.
- **Phase 7 — Packaging** is where `PYTHONUTF8=1` belongs in a container image.
- **Phase 9 — The web service** and **Phase 10 — Data, files and integrations**
  are where these boundaries stop being one file and become a request cycle.

---

← Prev: [Strings](../03-strings/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → **Truthiness** *(not written yet)*
