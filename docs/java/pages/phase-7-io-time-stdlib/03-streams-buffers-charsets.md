---
title: "Streams, buffers and charsets"
sidebar_label: "03 · Streams, buffers, charsets"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for `java.io`
> (`InputStream`, `Reader`, `InputStreamReader`, `BufferedReader`,
> `FileReader`), `java.nio.charset` (`Charset`, `StandardCharsets`,
> `CharsetDecoder`), `Files.readString`, and JEP 400 (UTF-8 by default,
> JDK 18) including its notes on `file.encoding`, `native.encoding` and
> the console streams.

**Java's I/O splits the world in two: byte streams (`InputStream`/
`OutputStream`) move raw octets, character streams (`Reader`/`Writer`)
move text — and every text-corruption bug lives at the bridge between
them, where bytes are decoded through a *charset*. Since JDK 18 (JEP 400)
that charset defaults to UTF-8 everywhere, which killed most mojibake;
what remains is knowing where the bridge is, why buffering wraps it, and
which APIs still pick a different default.**

## Bytes or characters — pick the right hierarchy

| You are moving | Use | Examples |
|---|---|---|
| Raw octets — images, zips, protocol frames | `InputStream` / `OutputStream` | `FileInputStream`, socket streams |
| Text | `Reader` / `Writer` | `BufferedReader`, `FileWriter` |

Reading text through a byte stream and calling `new String(bytes)` works —
but it decodes with *some* charset whether you thought about it or not.
The explicit bridge is:

```java
try (var reader = new BufferedReader(
        new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {
    String line = reader.readLine();
}
```

`InputStreamReader` is the decoder; `OutputStreamWriter` the encoder.
Naming the charset at the bridge is the whole discipline — every
constructor that omits it is a decision made silently.

## Buffering: why, and when not

A `FileInputStream.read()` of one byte can cost a system call. Buffered
wrappers batch those into chunked reads from an internal array (default
8 KiB), which is why almost every real stream is wrapped:

```java
try (var in = new BufferedInputStream(new FileInputStream(path))) { ... }
```

When *not* to wrap:

- **Already-in-memory sources** — `ByteArrayInputStream`, `StringReader`.
  There is no syscall to amortize; the extra copy is pure loss.
- **Already-buffered layers** — wrapping a `BufferedReader` in another
  buffer, or buffering a stream you only ever `readAllBytes()` from
  (one bulk read either way).
- **When you need write-through timing** — a buffer holds bytes until it
  is full, `flush()`ed or closed; a heartbeat written but not flushed
  hasn't been sent.

`readLine()` needs look-ahead, so `BufferedReader` is also the *API* for
line-oriented text, not just an optimization.

## JEP 400 — UTF-8 by default since JDK 18

Before 18, the default charset came from the OS locale: UTF-8 on Linux
and macOS, `windows-1252` (or another ANSI code page) on Windows. The
same program read the same file differently per machine. JDK 18 pinned
`file.encoding` to UTF-8 everywhere, so `FileReader`, `Files.readString`,
`new String(bytes)`, `String.getBytes()` and friends agree across
platforms.

What JEP 400 did **not** change:

- **`native.encoding`** reports what the platform would have used —
  set `-Dfile.encoding=COMPAT` to restore pre-18 behavior during
  migration.
- **The console** — `System.out`/`System.err` keep encoding for the
  attached terminal; the `stdout.encoding`/`stderr.encoding` properties
  name it. A ✓ printing fine in the IDE but as garbage in `cmd.exe` is
  the console's encoding, not `file.encoding`.
- **Old data** — files written by a pre-18 JVM on Windows are still
  `windows-1252` on disk; read them with the charset they were written
  in, not with today's default.

## Decoding failure is a policy, and the JDK ships two

Invalid bytes (say, ISO-8859-1 bytes fed to a UTF-8 decoder) are handled
differently by API:

- `new String(bytes, UTF_8)`, `InputStreamReader` — **replace**: bad
  sequences become `U+FFFD` (`�`) silently. The data is corrupted but no
  exception says so.
- `Files.readString`, `Files.lines` — **report**: they throw
  (`MalformedInputException` surfaces, wrapped per the method's contract).

Neither is wrong; not knowing which one you're using is. For explicit
control, build a `CharsetDecoder` and choose `onMalformedInput(...)`
yourself. Related trap: Java's UTF-8 decoder does **not** strip a BOM —
a leading `U+FEFF` stays in your first string.

## The small print that bites

- **`read()` returns `int`, not `byte`/`char`** — `-1` is end-of-stream.
  Cast to `char` *before* the `-1` check and EOF becomes `'￿'`, an
  infinite loop or a corrupt tail.
- **`transferTo(out)`** (JDK 9) replaces the hand-rolled copy loop;
  `readAllBytes()`/`readNBytes()` slurp — fine for bounded payloads,
  an OOM invitation on unbounded ones.
- **`available()` is not the length** — it estimates what can be read
  *without blocking*; using it to size a buffer for the whole stream is
  a classic network-stream bug.
- **`mark`/`reset`** only work where `markSupported()` is true (buffered
  streams, in-memory streams), and a mark is invalidated once you read
  past its `readlimit`.
- **Closing the outer wrapper closes the chain** — `close()` on the
  `BufferedReader` closes the `InputStreamReader` closes the socket
  stream. One try-with-resources on the outermost wrapper is enough
  ([try-with-resources](../phase-5-exceptions/03-try-with-resources/README.md)),
  and close flushes first for writers.

## Gotchas

**Symptom:** text files that read fine on the Linux servers come out with `Ã©`/`â€™` sequences on one old Windows box
**Cause:** the box runs a pre-18 JVM whose default charset is the ANSI code page; UTF-8 bytes are being decoded as `windows-1252`
**Fix:** name the charset at every bridge (`new InputStreamReader(in, UTF_8)`); upgrade the JVM or run it with `-Dfile.encoding=UTF-8` until then

**Symptom:** parsing a UTF-8 CSV works for every file except ones exported from Excel — the first header never matches `equals`
**Cause:** the file starts with a BOM; Java's UTF-8 decoder keeps `U+FEFF` as the first character of the first field
**Fix:** strip a leading `﻿` explicitly after decoding (or use a BOM-aware reader from a library); don't trust `trim()` — BOM is not whitespace

**Symptom:** search finds `�` characters in stored user names weeks after import
**Cause:** the import decoded with `new String(bytes, UTF_8)`, whose malformed-input action is REPLACE — bad bytes became `U+FFFD` silently instead of failing the row
**Fix:** decode with a reporting policy where corruption must be caught: `Files.readString` (throws), or a `CharsetDecoder` with `CodingErrorAction.REPORT`

**Symptom:** copying a binary file through a `Reader`/`Writer` pair corrupts it
**Cause:** bytes were decoded to chars and re-encoded — any byte sequence invalid in the charset is replaced on the way through
**Fix:** binary data never touches the character hierarchy; copy `InputStream → OutputStream` (`in.transferTo(out)`)

**Symptom:** a "streaming" heartbeat protocol works in tests but the peer times out in production
**Cause:** the heartbeat is written into a `BufferedWriter` and sits in the 8 KiB buffer — nothing reaches the wire until the buffer fills or the stream closes
**Fix:** `flush()` after each message that must be delivered now; buffering batches writes by design

**Symptom:** reading a socket with `readAllBytes()` to "get the request" never returns
**Cause:** `readAllBytes` reads until end-of-stream, and an open socket has no end until the peer closes — it isn't message-framed
**Fix:** read the protocol's framing (length prefix, delimiter via `readLine`, fixed count via `readNBytes`); `readAllBytes` is for bounded inputs

**Symptom:** `while ((c = (char) in.read()) != -1)` loops forever at end of file
**Cause:** the cast happens before the comparison — `-1` became `'￿'`, which never equals `-1` after re-widening
**Fix:** keep the result an `int`, compare to `-1`, cast only after the check

**Symptom:** wrapping `System.in` in try-with-resources breaks all later console input in the process
**Cause:** closing the outer wrapper closed `System.in` itself; standard streams are process-wide singletons
**Fix:** don't close streams you don't own — wrap `System.in` without try-with-resources, or close only wrappers over resources you opened

## Interview questions

**★ Byte streams vs character streams — and where exactly does the charset live?**
`InputStream`/`OutputStream` move octets and know nothing about text;
`Reader`/`Writer` move `char`s. The charset lives at the bridge —
`InputStreamReader`/`OutputStreamWriter` — which decodes/encodes between
the two worlds. Any API that hands you text from bytes (`FileReader`,
`new String(bytes)`, `Files.readString`) has a bridge inside it, using
the default charset unless you name one.

**★ What did JEP 400 change, and name two places it deliberately didn't touch.**
JDK 18 made UTF-8 the default charset (`file.encoding`) on every
platform, ending the OS-locale-dependent default that made Windows
decode differently from Linux. Untouched: the console streams
(`System.out` encodes for the attached terminal — see
`stdout.encoding`), and `native.encoding` still reports the platform
charset so `-Dfile.encoding=COMPAT` can restore old behavior for
migration. Data written under the old default is also unchanged on disk.

**★ Why does `BufferedReader` exist — two independent reasons?**
Performance: it amortizes system calls by reading chunks into an 8 KiB
array, turning per-character reads into array access. API: `readLine()`
needs look-ahead over the underlying stream, so line-oriented reading
lives on the buffered class. Even with fast underlying I/O you'd still
use it for the second reason.

**★ `new String(bytes, UTF_8)` vs `Files.readString(path)` on a corrupt file — different outcomes?**
Yes, and that's the trap: the `String` constructor replaces malformed
sequences with `U+FFFD` and returns normally; `Files.readString` uses a
reporting decoder and throws on malformed input. Choose by whether
silent replacement or loud failure is correct for the data — and if you
need it explicit, use a `CharsetDecoder` with a chosen
`CodingErrorAction`.

**★ What does closing the outermost stream in a decorator chain do, and what follows for try-with-resources?**
`close()` propagates inward: `BufferedReader` → `InputStreamReader` →
the byte stream → the OS handle. So one try-with-resources declaring
only the outermost wrapper releases everything, and closing a wrapper
around a stream you don't own (like `System.in`) closes that too. For
writers, close also flushes the buffer first.

**★ When is `readAllBytes()` the wrong tool even though the code works in tests?**
Whenever the input's size isn't bounded by contract: uploads, sockets,
piped output. It buffers the entire stream in memory (OOM under a large
input) and on a socket it blocks until the peer closes, because it reads
to end-of-stream, not to end-of-message. Bounded config files: fine.
Anything sized by the outside world: stream it (`transferTo`, chunked
reads) or enforce a limit with `readNBytes`.

---

← Prev: **02 · `Path` and `Files`** *(not written yet)* · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [`HttpClient`](04-httpclient.md)
