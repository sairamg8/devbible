---
title: "finally — the guarantees and the fine print"
sidebar_label: "2 · finally — the fine print"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.20.2 (Execution of
> `try`-`finally` and `try`-`catch`-`finally`) — the abrupt-completion
> table's "reason R is discarded" wording — and §14.17 (the `return`
> statement's interaction with `finally`).

**`finally` promises one thing: if the `try` block was *entered*, the
`finally` block runs on the way out — normal completion, caught exception,
uncaught exception, `return`, `break`, `continue`. The fine print is what
happens when `finally` itself completes abruptly: the JLS rules that its
reason *replaces* whatever was in flight. That single sentence is the
mechanism behind two of Java's classic silent bugs — the `return` that
swallows exceptions, and the cleanup exception that destroys the real
one.**

## What runs, and when

```java
try {
    risky();               // may throw, may return, may finish
} catch (IOException e) {
    handle(e);             // runs only for matching exceptions
} finally {
    cleanup();             // runs in every case below
}
```

Order of events, per the JLS:

1. `try` body completes — normally, or abruptly (throw / `return` /
   `break` / `continue`).
2. If abruptly by an exception with a matching clause: that catch block
   runs first.
3. `finally` runs — after the body and after any catch block, before
   control or the exception leaves the statement.
4. Whatever was "in flight" (the pending exception, the pending return)
   resumes — **unless `finally` itself completed abruptly, in which case
   the pending reason is discarded and `finally`'s reason wins.**

When `finally` does *not* run — worth listing because "always" is the
interview trap:

- The `try` block was never entered.
- The JVM exits first: `System.exit(...)`, `Runtime.halt`, a fatal `Error`
  that kills the process, `kill -9`, power loss.
- The thread is blocked forever inside `try` (deadlock), or the whole
  process is stopped — no code runs, `finally` included.
- Daemon threads at JVM shutdown: the JVM does not wait for them, so their
  `finally` blocks may simply never execute.

## The two killer traps, both shown

**Trap 1 — `return` in `finally` discards a pending exception.**

```java
int parseCount(String s) {
    try {
        return Integer.parseInt(s);   // NumberFormatException on bad input…
    } finally {
        return -1;                    // …which this DISCARDS, silently
    }
}
```

Bad input never throws here: the `NumberFormatException` is in flight when
`finally` starts, `finally` completes abruptly with `return -1`, and per
JLS §14.20.2 the exception "is discarded". The method quietly returns `-1`
for *every* failure — including ones you never anticipated
(`s == null`'s NPE vanishes too). The compiler warns
(`finally block does not complete normally` with `-Xlint:finally`), and
most linters flag it; the language allows it.

**Trap 2 — `return` in `finally` overrides the `try` block's return.**

```java
int score() {
    try {
        return 42;        // 42 is computed and PENDING…
    } finally {
        return 7;         // …then discarded. Method returns 7.
    }
}
```

Both returns execute their expression; `finally`'s wins. Combined with the
next rule this gets subtler:

**The pending return value is evaluated *before* `finally` runs.**

```java
int size() {
    List<String> items = load();
    try {
        return items.size();   // size() evaluated NOW — say it's 3
    } finally {
        items.clear();         // does NOT change the returned 3
    }
}
```

`return`'s expression is captured at the `return` statement; `finally`
mutating the objects afterwards doesn't alter the already-captured value
(it *can* alter observable state the caller reads later — a different
bug). For a mutable holder the distinction matters: returning `buffer`
captures the *reference*; `finally` mutating the buffer's contents *is*
visible to the caller, but reassigning the variable (`buffer = other`) is
not.

**Trap 3 — an exception in `finally` replaces the primary exception.**

```java
try (var out = open(path)) {     // the fix: see below
    write(out, data);
} 
// vs the old shape:
OutputStream out = open(path);
try {
    write(out, data);            // throws DiskFullException…
} finally {
    out.close();                 // …close() also throws → DiskFullException LOST
}
```

If `write` throws and then `close` throws, the `close` exception
propagates and the disk-full one is *gone* — not in the cause chain, not
suppressed, nowhere. Before JDK 7 this was endemic in I/O code: the
diagnostic exception lost, the trivial close-failure reported. This exact
flaw is what try-with-resources' suppression mechanism was built to fix —
[the next topic](../03-try-with-resources/README.md) shows the suppressed
exception surviving.

**The rule of style that follows from all three:** a `finally` block
contains only statements that complete normally — no `return`, no `throw`,
no `break`/`continue` out of it, and calls that can throw get their own
guard (`try { res.close(); } catch (Exception e) { log(e); }`) *only* when
you've decided the primary must win. Cleanup that can itself fail
meaningfully is try-with-resources' job, not `finally`'s.

## `finally` for cleanup vs try-with-resources

`try`/`finally` remains correct for cleanup that is not a resource close —
unlocking a lock, restoring a thread-local, resetting a flag:

```java
lock.lock();
try {
    criticalSection();
} finally {
    lock.unlock();        // cannot throw; the canonical finally
}
```

The dividing line: **`finally` for cleanup that cannot fail; TWR for
`AutoCloseable`s, whose close *can* fail.** `Lock.unlock` throwing means a
bug so severe nothing sensible remains; `close()` throwing is a Tuesday.

## Gotchas

**Symptom:** a method "never throws" on inputs that must throw; failures surface far downstream as wrong values
**Cause:** `return` (or `break`/`continue`) in `finally` discarding pending exceptions per JLS §14.20.2
**Fix:** no abrupt completion in `finally`, ever; enable `-Xlint:finally` and make the warning an error in CI

**Symptom:** disk-full incidents logged as "stream closed" / socket-close errors; the real cause absent from every log
**Cause:** `close()` in `finally` threw over the pending primary exception — pre-TWR masking
**Fix:** try-with-resources for anything `AutoCloseable`; the primary propagates, close-failure becomes suppressed

**Symptom:** value returned differs from what `finally` "set it to"
**Cause:** the return expression was evaluated before `finally`; reassigning the local afterwards changes nothing
**Fix:** compute the final value before `return`; never write result-adjusting logic in `finally`

**Symptom:** caller sees a mutated collection despite the method "returning before" the mutation
**Cause:** `return list;` captures the reference; `finally`'s `list.clear()` mutates the same object the caller received
**Fix:** return a copy, or don't mutate in `finally` — reference capture ≠ snapshot

**Symptom:** cleanup didn't run though it was "in a finally"
**Cause:** `System.exit` in the `try`, a killed process, or a daemon thread at shutdown — `finally` needs a surviving JVM and a resuming thread
**Fix:** process-level cleanup belongs in shutdown hooks / the supervisor, not `finally`; in-JVM invariants only

**Symptom:** `-Xlint:finally` warning "finally clause cannot complete normally" on legacy code
**Cause:** a `return`/`throw`/`break` inside `finally` — the discard semantics in waiting
**Fix:** treat every instance as a live bug; the fix is almost always moving the statement after the `try` statement

## Interview questions

**★ State exactly what happens when both the `try` block and the `finally` block throw.**
The `finally` exception propagates; the `try` block's exception is
discarded entirely (JLS §14.20.2) — no cause link, no suppression. (Only
try-with-resources adds suppression machinery, and there the *body's*
exception wins with `close`'s attached via `getSuppressed`.)

**★ Why does `return items.size()` in `try` ignore `items.clear()` in `finally`?**
The return operand is evaluated when the `return` executes; the resulting
value (here the primitive `3`) is held while `finally` runs. `finally` can
neither re-evaluate nor replace it — unless it executes its own `return`,
which replaces the completion wholesale.

**★ Give the legitimate `finally` use cases left in modern Java.**
Non-throwing, non-resource cleanup: `lock.unlock()`, restoring a
`ThreadLocal`, decrementing a gauge, resetting interrupt-state adjacent
code. Resource closing belongs to try-with-resources; result adjustment
belongs nowhere near `finally`.

**★ Is `finally` guaranteed to run?**
Only if the `try` block is entered *and* the JVM and thread survive to
unwind normally. `System.exit`, process death, a never-returning body, and
daemon-thread shutdown all skip it. So: strong enough for in-process
invariants, never a substitute for durable/external guarantees
(transactions, WAL — the database's job, not `finally`'s).

**★ What does the compiler's "finally clause cannot complete normally" warning predict?**
That the block ends in `return`/`throw`/`break`/`continue`, so *every*
pending exception or return through this statement is being discarded or
replaced. It predicts trap 1 and trap 2 exactly; treat it as an error.

**★ Does `finally` run when an `Error` propagates through the `try`?**
Yes — unwinding is unwinding; an `OutOfMemoryError` flying through runs
`finally` on its way like any exception. The caveats are practical, not
semantic: after OOME the cleanup code's own allocations may fail (throwing
a *new* error out of `finally`, which then replaces the original), and a
JVM that dies outright never unwinds at all. Skipping happens at the
process level, not the language level.

**★ A junior wraps `close()` in try/catch-log inside `finally` "to be safe". Review it.**
It protects the primary exception (good instinct) but silently downgrades
close-failures to log lines even when the body *succeeded* — a data-loss
window for buffered writers, where `close()` is the flush. TWR gets both
cases right: body-failure keeps primacy with close suppressed; body-success
lets close's failure propagate loudly.

---

← Prev: [Catch clauses, ordering and multi-catch](01-catch-ordering-multicatch.md) · Index: [`try`/`catch`/`finally` mechanics](README.md) · Next → [Precise rethrow, and control flow through `try`](03-rethrow-and-control-flow.md)
