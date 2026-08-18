---
title: "Suppressed exceptions"
sidebar_label: "2 · Suppressed exceptions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.20.3, the JDK 25 Javadoc for
> `Throwable.addSuppressed`, `Throwable.getSuppressed` and the
> `Throwable(String, Throwable, boolean, boolean)` protected constructor,
> and `Throwable.printStackTrace()`'s documented output format.

**Suppression answers one question the language had no answer for before
JDK 7: when two exceptions are in flight at once — the body's and the
`close()`'s — which one wins, and where does the loser go? The rule:
the body's exception is *primary* and propagates; the close failure is
attached to it via `addSuppressed` and travels along, readable later with
`getSuppressed()` and printed under a `Suppressed:` label. Nothing is
destroyed. That is the semantic upgrade over `finally`, which silently
replaced the interesting exception with the boring one.**

## The four combinations

For a body B and a resource close C, the statement's outcome is fully
determined:

| Body | `close()` | What propagates | Where the other went |
|---|---|---|---|
| succeeds | succeeds | nothing | — |
| **throws** | succeeds | the body's exception | — |
| succeeds | **throws** | **the close exception** | — (no primary existed to suppress it onto) |
| **throws** | **throws** | the body's exception | attached via `addSuppressed`, visible in `getSuppressed()` |

Row 3 surprises people symmetrically to row 4: when the body succeeded,
the close failure is *not* suppressed — it is the statement's own,
fully-loud exception. Suppression only happens when there is already a
primary to protect.

The priority rule is worth saying plainly: **the body's exception always
outranks the close's.** Rationale: the body's failure is almost always the
root cause (a broken connection makes *both* the query and the close fail),
so propagating the close failure instead — which is what `finally` did —
routinely pointed debugging at the wrong exception.

## What it looks like in a trace

Schematic — placeholder frames illustrating the format
`printStackTrace()` documents, not captured output (the reading conventions
are [topic 05's](../05-reading-stack-traces/01-anatomy-and-the-scan.md)):

```text
com.shop.export.ExportFailedException: writing report failed
    at com.shop.export.ReportWriter.write(ReportWriter.java:31)
    at ...
    Suppressed: java.io.IOException: <close failure message>
        at com.shop.export.ReportWriter.close(ReportWriter.java:58)
        ... 1 more
Caused by: java.io.IOException: <underlying write failure>
    ...
```

Distinguish the two attachments, because they answer different questions:

- **`Caused by:`** — the cause *chain*, set at construction
  (`new X("...", cause)`): "this exception exists because that one did."
  Vertical history, one exception wrapped in another.
- **`Suppressed:`** — set after construction (`addSuppressed`): "while this
  exception was propagating, this *other, independent* failure also
  happened." Horizontal simultaneity, indented under the exception it rode
  along with. Each suppressed exception can carry its own `Caused by:`
  chain, nested and further indented.

Usually the primary is the story and the suppressed close failure is noise.
But not always: a body that failed *because the connection died* may print
a generic primary while the suppressed close exception names the connection
reset — **read the `Suppressed:` block before declaring a trace
uninformative.**

## The API — and using it by hand

```java
public final void addSuppressed(Throwable exception)  // appends; self or null → throws
public final Throwable[] getSuppressed()              // returns a copy; empty, never null
```

The pattern generalizes beyond resources: **complete every step of a
cleanup fan-out, fail with the first exception, lose none of the others.**

```java
public void closeAll(List<AutoCloseable> resources) throws Exception {
    Exception primary = null;
    for (var r : resources.reversed()) {         // teardown: reverse order, always
        try {
            r.close();
        } catch (Exception e) {
            if (primary == null) primary = e;
            else primary.addSuppressed(e);
        }
    }
    if (primary != null) throw primary;
}
```

The same shape appears in the JDK and frameworks wherever several
independent failures must survive as one throw — batch shutdowns,
multi-task cancellation, composite lifecycles. If you find yourself
keeping a `List<Exception>` and throwing only the first, you are
hand-rolling this — use `addSuppressed` and the trace stays complete.

Two `addSuppressed` contract details that bite:

- `t.addSuppressed(t)` throws `IllegalArgumentException` — an exception
  cannot suppress itself (guards accidental self-reference in loops).
- `addSuppressed(null)` throws `NullPointerException` — unlike `initCause`,
  there is no "clear it" form; the list only grows.

## Where suppression is disabled

`Throwable`'s protected four-argument constructor exists precisely to opt
out:

```java
protected Throwable(String message, Throwable cause,
                    boolean enableSuppression, boolean writableStackTrace)
```

With `enableSuppression = false`, `addSuppressed` becomes a silent no-op
and `getSuppressed()` stays empty. The JDK uses it for shared, reusable
throwable instances — the kind some frameworks pre-allocate as sentinels
(often paired with `writableStackTrace = false`, the same flag
[topic 07](../07-exceptions-as-control-flow.md) prices) — where letting
arbitrary code append to a shared suppression list would be both a memory
leak and a cross-request information leak. If you build a cached sentinel
exception, disable both flags; if you throw normal exceptions, never touch
this constructor.

## Gotchas

**Symptom:** post-mortem blames the close failure; the real bug — the body's exception — appears nowhere in the logs
**Cause:** manual `try`/`finally` cleanup — `finally`'s throw *replaces* the in-flight exception ([the fine print](../02-try-catch-finally/02-finally-the-fine-print.md)); this is the exact defect suppression fixes
**Fix:** convert to try-with-resources; where the structure genuinely can't be (conditional cleanup), hand-write the primary/`addSuppressed` pattern above

**Symptom:** log shows only `e.getMessage()` and the incident hid a suppressed exception nobody saw
**Cause:** custom log formatting that prints message and cause chain but never calls `getSuppressed()` — suppressed exceptions only appear if the printer looks
**Fix:** log the throwable object itself and let the framework render it (logback/log4j2 print `Suppressed:` blocks); never re-implement trace printing by hand

**Symptom:** exactly one cleanup failure is reported from a shutdown that had four
**Cause:** a `catch` inside the cleanup loop that overwrites `primary = e` each iteration, or throws on the first failure and skips the rest of the loop
**Fix:** first failure becomes primary, the rest attach via `addSuppressed`, and the loop always runs to completion — throw once at the end

**Symptom:** `IllegalArgumentException: Self-suppression not permitted` from cleanup code
**Cause:** the same exception object reached `addSuppressed` as both primary and suppressed — typically one shared/cached exception instance thrown from two places, or rethrow logic feeding `e` back into itself
**Fix:** stop sharing throwable instances across throw sites; each failure gets a fresh exception object

**Symptom:** framework sentinel exception "ignores" suppression in tests asserting on `getSuppressed()`
**Cause:** it was constructed with `enableSuppression = false`, so `addSuppressed` is a specified no-op
**Fix:** working as designed — assert on the primary path instead; sentinels are for control signaling, not diagnosis

**Symptom:** `Suppressed:` block in a trace read as "a second bug" and filed separately, doubling the incident count
**Cause:** treating suppressed exceptions as independent failures — the close failure is usually a *consequence* of the same broken resource the primary reports
**Fix:** triage the primary and the deepest `Caused by:` first; treat the suppressed block as corroborating context unless it names a different resource

## Interview questions

**★ Body throws A, close throws B — what does the caller catch, and where is B?**
A. B is attached to A via `addSuppressed`, retrievable with
`A.getSuppressed()`, printed indented under `Suppressed:`. Nothing is lost
— the improvement over `finally`, which would have propagated B and
destroyed A.

**★ Body *succeeds* and close throws — same answer?**
No — the close exception propagates as-is. Suppression needs a primary to
attach to; with none, the close failure is the statement's own exception.
For flush-on-close writers this is essential: a failed final flush must not
be silent ([chunk 3](03-autocloseable-in-practice.md)).

**★ `Caused by` vs `Suppressed` — one sentence each.**
Cause: "I exist because that exception happened" — set at construction,
vertical wrapping history. Suppressed: "while I was propagating, that
independent failure also occurred" — attached afterward, horizontal
simultaneity. A translator sets a cause; a cleanup path adds suppression.

**★ Why does the body's exception win rather than the close's?**
Diagnostic value: when both fail it is usually the *same* underlying breakage,
first observed by the body — the close failure is an echo. Propagating the
echo (pre-JDK 7 behaviour) sent debuggers to the wrong place; the JLS
translation hard-codes the better default.

**★ When would you call `addSuppressed` yourself?**
Any many-failures-one-throw shape the compiler doesn't generate for you:
closing a list of resources where every close must be *attempted*, shutdown
hooks, composite task cancellation. First failure is primary, later ones
suppress onto it, throw after the loop completes.

**★ How can suppression be off, and why would anyone want that?**
The protected `Throwable(msg, cause, enableSuppression, writableStackTrace)`
constructor with `enableSuppression = false` — for shared/pre-allocated
exception instances, where appending to a shared mutable list from
arbitrary threads would leak memory and cross-contaminate diagnostics.

---

← Prev: [The statement and its desugaring](01-the-desugaring.md) · Index: [try-with-resources](README.md) · Next → [`AutoCloseable` in practice](03-autocloseable-in-practice.md)
