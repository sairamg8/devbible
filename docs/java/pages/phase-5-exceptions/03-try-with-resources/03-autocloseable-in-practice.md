---
title: "AutoCloseable in practice"
sidebar_label: "3 · AutoCloseable in practice"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `AutoCloseable`,
> `java.io.Closeable`, `java.sql.Connection`/`Statement`/`ResultSet`,
> `java.util.stream.Stream` (the "Closing stream operations" note),
> `Files.lines` and `ExecutorService.close()`, plus JLS SE 25 §14.20.3.

**`AutoCloseable` is the language-facing contract ("this can go in a try
header") and `Closeable` is the older, stricter I/O contract layered on top
of it. The differences — what `close()` may throw, and whether calling it
twice is safe — are exactly the decisions you face when writing your own
resource class, and JDBC and `Stream` each stress the contract in their own
way. Getting `close()` right is API design, not boilerplate.**

## `AutoCloseable` vs `Closeable`

```java
public interface AutoCloseable {                    // java.lang, JDK 7
    void close() throws Exception;
}
public interface Closeable extends AutoCloseable {  // java.io, JDK 5
    void close() throws IOException;                // narrowed
}
```

| | `Closeable` | `AutoCloseable` |
|---|---|---|
| `close()` throws | `IOException` only | `Exception` — anything |
| Calling `close()` twice | **required no-op** (idempotent by contract) | *not* required safe — Javadoc merely urges implementers to make it so |
| Home turf | streams, channels, readers/writers | everything else — JDBC, `Stream`, your classes |

Both asymmetries run the same direction: `Closeable` is the tighter
promise. That is why `Closeable` could extend `AutoCloseable` when the
latter arrived (a narrower throws clause and a stronger behavioural
guarantee are both valid strengthenings) and not the other way around.

Two further Javadoc directives for implementers of `AutoCloseable`:

- **Don't throw `InterruptedException` from `close()`.** Interruption has
  runtime-visible semantics (the interrupt flag, and
  [Phase 6 · Concurrency](../../phase-6-concurrency/README.md) owns them); if it can be raised during
  close and then gets *suppressed* onto a primary exception, the
  interruption is effectively swallowed. Handle it inside `close`, restore
  the flag, throw something else.
- **Prefer failing on close over never returning.** `close` should
  relinquish the resource and complete; a close that blocks forever turns
  every try statement over it into a hang.

## JDBC — the three-deep stack

JDBC is where reverse close order stops being trivia. `Connection` →
`PreparedStatement` → `ResultSet` is a dependency chain, and all three are
`AutoCloseable`:

```java
try (Connection conn = pool.getConnection();
     PreparedStatement ps = conn.prepareStatement(SQL)) {
    ps.setLong(1, orderId);
    try (ResultSet rs = ps.executeQuery()) {    // nested: rs needs ps configured first
        while (rs.next()) { ... }
    }
}
// closes rs, then ps, then conn — innermost first, guaranteed
```

Details the header handles that manual code always fumbled:

- Closing a `Statement` closes its current `ResultSet`, and JDBC drivers
  auto-close a `ResultSet` when its statement re-executes — but *relying*
  on that couples you to driver behaviour; the explicit nested header keeps
  ownership visible.
- On a **pooled** connection, `close()` doesn't destroy the socket — it
  returns the connection to the pool. The idiom is unchanged; "close" means
  "release ownership", and the pool's proxy implements it. Forgetting it is
  the classic "connection pool exhausted at 3am" incident — a leak the
  header makes structurally impossible on every path, early returns and
  exceptions included.
- Layer translation of the `SQLException` this code throws belongs one
  level up — [custom exceptions and translation](../04-custom-exceptions-translation.md).

## Streams that need closing

`Stream` implements `AutoCloseable`, and almost no stream needs it — a
stream over a `List` holds nothing. The exception is documented per-source:
**streams backed by I/O**, `Files.lines` first among them, hold an open
file until closed:

```java
try (Stream<String> lines = Files.lines(path)) {
    return lines.filter(l -> l.contains(needle)).count();
}   // closes the stream, which closes the underlying file channel
```

The trap is that nothing *reminds* you: the pipeline compiles and runs
without the header, terminal ops do **not** close the source, and the
leaked descriptor only surfaces later as "too many open files" under load.
The rule that keeps it straight: **if a factory method's Javadoc mentions
`close` (`Files.lines`, `Files.walk`, `Files.list`,
`Files.newDirectoryStream`), it goes in a try header; collection streams
don't.** How I/O-backed pipelines behave mid-stream is
[pipelines in practice](../../phase-4-lambdas-streams/03-stream-pipeline/03-pipelines-in-practice.md);
what the checked `IOException` inside those lambdas does to your code is
[topic 06](../06-checked-exceptions-lambdas.md).

## Writing your own `AutoCloseable` honestly

Any class owning a native handle, a connection, a file, a subscription — or
*another* closeable — should implement it. The honest implementation makes
four decisions:

```java
public final class MetricsBatch implements AutoCloseable {
    private final BufferedWriter out;
    private boolean closed = false;                  // 1 — idempotency by hand

    public void record(Metric m) throws IOException {
        if (closed) throw new IllegalStateException("batch already closed");  // 2
        out.write(m.toLine());
    }

    @Override
    public void close() throws IOException {         // 3 — narrowest real type,
        if (closed) return;                          //     never bare Exception
        closed = true;                               // set BEFORE the risky call:
        out.close();                                 // a failed close stays closed —
    }                                                // 4 — don't half-reopen on failure
}
```

1. **Make `close()` idempotent** even though `AutoCloseable` doesn't force
   you — callers *will* double-close (a manual call plus the header, two
   wrapping layers), and "second close throws" turns their cleanup paths
   into minefields.
2. **Fail method calls after close** with `IllegalStateException` — using a
   released resource is a caller bug and should say so, not half-work.
3. **Declare the narrowest real exception type.** `throws Exception`
   forces every try statement around you to catch `Exception`, widening
   *their* catch far past what they meant to handle. If close genuinely
   can't fail, declare nothing and `@Override` without a throws clause —
   overrides may narrow.
4. **Set `closed` before the underlying call**, so a close that fails
   doesn't leave a zombie accepting further writes.

**When close failure is data loss.** `BufferedWriter.close()` flushes the
buffer *first* — the last kilobytes of output travel inside `close()`. A
swallowed close exception there is a silently truncated file. This is
exactly the desugaring's success-path behaviour working for you
([chunk 1](01-the-desugaring.md)): body succeeded → close failure
propagates loudly. For readers, by contrast, a close failure genuinely is
ignorable noise — you already have every byte. Judge close failures by
whether the resource still owed you work.

## Gotchas

**Symptom:** "connection pool exhausted" under load; heap dumps show hundreds of proxies waiting on nothing
**Cause:** a code path — usually an early `return` or an exception between acquire and the manual `close()` — leaks pooled connections; `close()` is how a pooled connection gets *returned*
**Fix:** acquisition and the try header on the same line, always; treat any bare `pool.getConnection()` outside a header as a review-blocking defect

**Symptom:** "too many open files" hours after a deploy; the diff only touched a config-file scanner
**Cause:** `Files.lines`/`Files.walk` pipelines without a try header — terminal operations don't close I/O-backed streams
**Fix:** every stream from a `Files.*` factory goes in a header; add a leak canary in tests if the platform offers one

**Symptom:** wrapping a resource in two decorators double-closes the innermost one, and it throws on the second close
**Cause:** the resource implements `AutoCloseable` without idempotency — legal per the interface, hostile in practice, since JDK decorators (`BufferedWriter`, `GZIPOutputStream`) close their delegate
**Fix:** implement the closed-flag pattern in your own classes; when consuming a suspect third-party one, ensure exactly one owner closes it

**Symptom:** callers of your `Widget implements AutoCloseable` are forced into `catch (Exception e)` and start swallowing unrelated bugs
**Cause:** `close() throws Exception` left at the interface's width instead of being narrowed in the implementation
**Fix:** narrow the override — a specific type, or no throws clause at all; the interface's `Exception` is a ceiling, not a recommendation

**Symptom:** thread pool shutdown hangs; stacks show a thread parked inside a `close()`
**Cause:** a close that blocks indefinitely (waiting to flush to a dead endpoint) — violating the Javadoc's guidance that close should complete
**Fix:** bound the wait inside close (timeout, then throw); a close that *fails* is recoverable, a close that never returns is an outage

**Symptom:** file written through a `BufferedWriter` is truncated, yet no exception was ever logged
**Cause:** manual `finally { try { w.close(); } catch (IOException ignored) {} }` — the final flush lives in close, and the swallow discarded the write failure
**Fix:** try-with-resources with no catch around the close path; on the success path a close failure propagates, which for flush-on-close writers is the correct loudness

**Symptom:** `IllegalStateException: stream has already been operated upon or closed` after "adding logging" to a stream pipeline
**Cause:** the closed/consumed stream was reused — `Stream` is single-shot, and close (like a terminal op) ends its life
**Fix:** rebuild the pipeline from the source per use; store the *source* (the path, the list), never the stream

**Symptom:** a request handler that wraps its `ExecutorService` in a try header "hangs" at the end of the block
**Cause:** `ExecutorService` is `AutoCloseable` (JDK 21+), and its `close()` is shutdown-and-*await*: it blocks until submitted tasks finish
**Fix:** that blocking is the feature for scoped, per-operation executors (all tasks done when the block exits); long-lived shared pools don't belong in a try header at all — they are closed once, at application shutdown

## Interview questions

**★ `Closeable` vs `AutoCloseable` — the two contract differences?**
Throws clause: `IOException` vs `Exception`. Idempotency: `Closeable.close`
is a required no-op on repeat calls; `AutoCloseable` only *encourages* it.
`Closeable extends AutoCloseable` works because both differences make
`Closeable` the stronger promise.

**★ Why does closing a pooled JDBC connection not close the socket, and why is calling `close()` still mandatory?**
The pool hands out a proxy whose `close()` returns the connection to the
pool — "close" means "release ownership". Skipping it leaks the slot, and
enough leaked slots exhaust the pool: the incident presents as a database
outage while the database is fine.

**★ Which streams must be closed, and how do you know?**
Streams over I/O sources — `Files.lines`, `Files.walk`, `Files.list`,
directory streams — because they hold OS resources until closed; the
factory's Javadoc says so, and terminal operations do not close them.
Collection/array streams hold nothing and need nothing.

**★ Design `close()` for a class that owns a `BufferedWriter`. What are the decisions?**
Idempotent via a closed flag set *before* delegating; post-close use throws
`IllegalStateException`; declare `throws IOException` (narrowed, not
`Exception`); and do **not** swallow the delegate's close failure — the
final flush happens there, so failure means lost data and must propagate.

**★ Why shouldn't `close()` throw `InterruptedException`?**
Because inside a try statement a close exception may be *suppressed* onto a
primary — and a suppressed interruption is a lost cancellation signal.
Handle interrupts inside close and restore the interrupt flag instead.

**★ Is the closed-flag pattern thread-safe, and does it need to be?**
As written, no — a plain `boolean` is fine for the normal case, where one
thread owns the resource for its whole life inside one try statement. It
needs to be (volatile flag, or synchronization around close-vs-use) only
when the resource is deliberately shared across threads — at which point
close-while-in-use becomes a design question, not a flag question, and you
are in [Phase 6 · Concurrency](../../phase-6-concurrency/README.md) territory. The
`AutoCloseable` contract itself demands no thread safety.

**★ Your `AutoCloseable` wraps three closeables. Write `close()`.**
Close all three in reverse acquisition order, attempting every one:
remember the first failure as primary, `addSuppressed` the rest onto it,
throw the primary at the end — the by-hand fan-out from
[chunk 2](02-suppressed-exceptions.md); alternatively delegate to a nested
try-with-resources and let the compiler generate it.

---

← Prev: [Suppressed exceptions](02-suppressed-exceptions.md) · Index: [try-with-resources](README.md) · Next → [Custom exceptions and layer translation](../04-custom-exceptions-translation.md)
