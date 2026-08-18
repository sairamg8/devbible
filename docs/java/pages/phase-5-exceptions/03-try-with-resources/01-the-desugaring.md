---
title: "The statement and its desugaring"
sidebar_label: "1 · The desugaring"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.20.3 (try-with-resources,
> basic and extended forms, and the specified translation), the JDK 25
> Javadoc for `AutoCloseable`, and JEP 213 (Milling Project Coin — the
> JDK 9 effectively-final resource form).

**try-with-resources is not a convenience wrapper around `finally` — it is
a different statement with better semantics, and the JLS specifies its
translation precisely. The compiler generates a nested `try` per resource
that closes each one in reverse declaration order, and — the part `finally`
never had — when both the body and a `close()` throw, it keeps the *body's*
exception as primary and attaches the close failure via `addSuppressed`
instead of letting it destroy the interesting one. Knowing the generated
shape is what makes every edge case (null resource, close order, a throwing
constructor) predictable instead of memorized.**

## The syntax, and what qualifies

Anything `AutoCloseable` can go in the header. Semicolons separate
resources; the last semicolon is optional:

```java
try (var in  = new FileInputStream(src);
     var out = new FileOutputStream(dst)) {
    in.transferTo(out);
}           // out closes first, then in — reverse declaration order
```

Three header forms are legal in Java 25:

```java
try (BufferedReader r = Files.newBufferedReader(path)) { ... }  // JDK 7: declaration
try (var r = Files.newBufferedReader(path))            { ... }  // JDK 10: var works too
try (reader) { ... }   // JDK 9 (JEP 213): an existing effectively-final variable
```

The JDK 9 form matters for resources you *receive* rather than create — a
`Connection` handed in by a caller, a socket accepted elsewhere. The
variable must be final or effectively final; reassigning it anywhere makes
the header a compile error, because the statement must be certain which
object it will close.

**Resource variables are implicitly final** (JLS §14.20.3): assigning to
`in` inside the body is a compile error. That is not pedantry — it
guarantees the object the statement closes is the object the header opened.

## The translation the compiler performs

A single-resource statement:

```java
try (Resource r = expr) {
    body;
}
```

is specified (JLS §14.20.3.1) to behave as:

```java
final Resource r = expr;
Throwable primary = null;
try {
    body;
} catch (Throwable t) {
    primary = t;
    throw t;
} finally {
    if (r != null) {
        if (primary != null) {
            try {
                r.close();
            } catch (Throwable closeFailure) {
                primary.addSuppressed(closeFailure);   // never replaces the body's exception
            }
        } else {
            r.close();          // body succeeded → a close failure propagates normally
        }
    }
}
```

Read the two branches carefully, because they answer the exam questions:

- **Body threw** → `close()` runs, and if it *also* throws, that failure is
  attached to the primary with `addSuppressed` — the body's exception is
  what propagates. [Chunk 2](02-suppressed-exceptions.md) reads the result.
- **Body succeeded** → the close failure has no primary to hide behind, so
  it propagates as the statement's own exception. A "successful" write that
  fails on close still fails loudly — which is exactly what you want from a
  `BufferedWriter` whose final flush happens inside `close()`
  ([chunk 3](03-autocloseable-in-practice.md)).
- **`if (r != null)`** — a resource expression that evaluates to null is
  simply skipped; `close()` is never invoked on it, and there is no NPE
  *from the close machinery* (the body dereferencing the null is its own
  problem).

Multiple resources nest this translation — each resource wraps the next, so
the innermost (last-declared) closes first, and a failure in a *later*
resource's initializer still closes every resource already opened:

```java
try (var a = openA(); var b = openB()) { body; }
// ≈ try (var a = openA()) {
//       try (var b = openB()) { body; }
//   }
// openB() throwing → a.close() still runs, its failure suppressed if needed
```

## `catch` and `finally` still compose with it

The *extended* form (JLS §14.20.3.2) allows `catch` and `finally` clauses on
the same statement — and they wrap the *translated* statement, meaning **the
resources are already closed by the time your `catch` or `finally` runs**:

```java
try (var conn = pool.getConnection()) {
    return runQuery(conn);
} catch (SQLException e) {
    // conn is closed here — safe to retry with a NEW connection,
    // wrong to touch the old one
    throw new RepositoryException("query failed", e);
}
```

That ordering removes a classic manual-cleanup bug: a `catch` block that
retries on the half-broken resource it just failed on.

## What it replaced, and why the old shape was unfixable

The pre-JDK 7 idiom needed a null check, a nested try, and still got the
semantics wrong:

```java
InputStream in = null;
try {
    in = new FileInputStream(src);
    process(in);
} finally {
    if (in != null) {
        in.close();     // throws? The exception from process() is GONE.
    }
}
```

`finally` has exactly one exception slot — a throw from the `finally` block
*replaces* whatever was propagating
([`finally` — the fine print](../02-try-catch-finally/02-finally-the-fine-print.md)).
No amount of care in user code fixes that without hand-writing the
suppression pattern the compiler now generates. That, plus the six lines per
resource, is why leaked handles were a routine incident class — and why the
fix had to be a language change (JSR 334 / Project Coin, JDK 7), not a
library. Cleanup could never be left to finalization either:
[object lifecycle](../../phase-2-classes-objects/14-object-lifecycle.md)
covers why GC-driven cleanup is unbounded in time and unordered.

## Gotchas

**Symptom:** second resource's constructor throws and the first resource leaks — except it doesn't, and the team's defensive nested-try refactor was pointless
**Cause:** misreading the header as "all initializers run, then the body" — the translation nests, so each opened resource is already inside a `try` that closes it when a later initializer throws
**Fix:** trust the nesting: initializers run left to right, and any already-initialized resource is closed on a later initializer's failure; no manual nesting needed

**Symptom:** `error: auto-closeable resource r may not be assigned` on a header variable
**Cause:** the JDK 9 existing-variable form requires final/effectively final; an assignment anywhere in scope disqualifies it
**Fix:** stop reassigning — introduce a new variable for the reassignment, or declare the resource in the header

**Symptom:** resources close in the "wrong" order and a dependent close fails (statement closed after its connection)
**Cause:** declaration order in the header is close order *reversed* — declaring the `Connection` *after* the `PreparedStatement` closes the connection first
**Fix:** declare in dependency order — outermost resource first (`Connection`, then `Statement`, then `ResultSet`); reverse-close then tears down innermost first

**Symptom:** NPE from inside the body, and a review comment claims try-with-resources "should have thrown earlier" on the null resource
**Cause:** a null resource expression is legal — the statement only skips `close()` for it; it does not validate the reference for you
**Fix:** if null is impossible, let the factory throw; if it's possible, check before the statement — the header is not a null guard

**Symptom:** `close()` visibly runs twice in a debugger on the same object
**Cause:** the resource is *also* closed manually in the body (or wrapped in two headers via the existing-variable form) — the statement always closes what it opened
**Fix:** never call `close()` on a header resource yourself; one owner per resource, and the header is that owner

**Symptom:** a wrapped stream's inner stream stays open after an exception in the wrapper's constructor — `new GZIPOutputStream(new FileOutputStream(f))` in one header slot
**Cause:** the inner `FileOutputStream` is not a resource *variable*, so when `GZIPOutputStream`'s constructor throws (it writes a header), nothing closes the file stream
**Fix:** one header slot per resource: `try (var fos = new FileOutputStream(f); var gz = new GZIPOutputStream(fos))` — now the file stream is tracked independently

## Interview questions

**★ Write the desugaring of a one-resource try-with-resources.**
Nested try/catch/finally: catch `Throwable`, remember it as primary,
rethrow; in `finally`, if the resource is non-null, close it — inside its
own catch when a primary exists, attaching any close failure via
`addSuppressed`; bare `close()` when the body succeeded, so a close failure
propagates. (Sketching this on a whiteboard answers every follow-up about
ordering and suppression before it's asked.)

**★ In what order do multiple resources close, and why that order?**
Reverse declaration order. Resources are declared outermost-first
(connection → statement → result set), and teardown must be innermost-first
so nothing is closed while something built on it is still open. The nesting
of the translation produces exactly that.

**★ What happens when the second resource's initializer throws?**
The first resource — already initialized, already inside the generated
outer try — is closed. If that close also throws, the close failure is
suppressed onto the initializer's exception. Nothing leaks.

**★ Body succeeds, `close()` throws — what does the caller see?**
The close exception itself, uncaught and un-suppressed: with no primary
exception, the translation calls `close()` outside any swallowing
construct. This is deliberate — for flush-on-close writers, close failure
*is* data loss and must be loud.

**★ Why must the JDK 9 form's variable be effectively final?**
The statement guarantees it closes the object the header referenced. If the
variable could be reassigned mid-body, "which object gets closed" would
depend on execution path — so the language forbids the reassignment
outright, same as the implicit finality of declared resources.

**★ Can you use `catch`/`finally` on the same try as the resource header, and when do they run?**
Yes — the extended form. Both apply to the statement *after* translation,
so every resource is already closed when the `catch` or `finally` body
executes. Retry logic in such a `catch` must acquire fresh resources.

---

← Index: [try-with-resources](README.md) · Next → [Suppressed exceptions](02-suppressed-exceptions.md)
