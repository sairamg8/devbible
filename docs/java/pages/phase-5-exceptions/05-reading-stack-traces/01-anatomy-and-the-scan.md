---
title: "Anatomy and the fast scan"
sidebar_label: "1 · Anatomy and the scan"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for
> `Throwable.printStackTrace()`, which specifies the output format —
> including the `Caused by:`, `Suppressed:` and `... n more` conventions —
> and `Throwable.getStackTrace()` / `StackTraceElement`.

**A stack trace prints the call stack *at the moment the exception was
constructed* — innermost frame first. That one fact orients everything: the
top line under the exception is where things went wrong, the lines below it
are how execution got there, and the `Caused by:` sections underneath are
earlier exceptions the printed one was wrapped around. Read type → message →
first your-code frame → deepest `Caused by`, in that order, and skip the
rest until you need it.**

## The format, piece by piece

The skeleton below is a *schematic* — placeholder names illustrating the
form `printStackTrace` documents, not captured output:

```text
Exception in thread "main" com.shop.OrderPlacementException: order 7f3a could not be placed
    at com.shop.order.OrderService.place(OrderService.java:42)
    at com.shop.api.OrderController.post(OrderController.java:18)
    ...
Caused by: com.shop.order.OrderRepositoryException: loading order 7f3a failed
    at com.shop.order.OrderRepository.findOrder(OrderRepository.java:77)
    at com.shop.order.OrderService.place(OrderService.java:39)
    ... 1 more
Caused by: java.sql.SQLException: <driver message>
    at <driver frames>
    ... 2 more
```

Element by element:

- **The header** — thread name, exception's fully-qualified class, then the
  message. The *type* is half the diagnosis on its own
  (`NullPointerException` vs `SQLException` vs your domain type); the
  message is whatever the thrower put there
  ([topic 04](../04-custom-exceptions-translation.md)'s craft).
- **Frames, innermost first.** Each `at` line is one
  `StackTraceElement`: class, method, source file, line number. The first
  frame is the method that *constructed* the exception — usually, but not
  always, where the problem is (a validation method that throws for its
  caller's bad argument points one frame down).
- **`Caused by:`** — the cause chain, outermost wrapper printed first. The
  *deepest* `Caused by` is the original failure; everything above it is
  translation layers adding context. **Scan to the bottom-most cause
  first**; that's where the driver/OS/library truth lives.
- **`... N more`** — not lost information. It means: the remaining N frames
  of this cause's stack are identical to the frames already printed for the
  enclosing exception (both stacks share their outer call path). Look up at
  the enclosing trace to read them.
- **`Suppressed:`** — exceptions attached via `addSuppressed`, indented
  under their primary. In practice these come from try-with-resources: the
  body's exception prints as primary, a `close()` failure prints suppressed
  (**topic 03 · try-with-resources** owns the mechanics). A suppressed
  `close` failure under a primary that *is* the interesting one is common;
  occasionally the suppressed exception is the real story — read both.

## The three-step scan

1. **Type and message** of the *first* header. Is this a symptom type
   (`NullPointerException` in a web framework frame) or a told-you type
   (a domain exception with an order ID in the message)? Helpful NPE
   messages (standard since JDK 15) often name the exact null expression —
   read them fully; they can end the investigation at step 1.
2. **First your-code frame.** Scan down past framework/JDK frames to the
   first `at` line in *your* package namespace. That file:line is where to
   set the breakpoint or open the editor. Framework frames above it are
   plumbing; frames below it are how the request arrived.
3. **Bottom-most `Caused by`.** If there is a chain, the deepest cause is
   the ground truth; re-run steps 1–2 on it. A chain that *ends* in a
   domain exception with no low-level cause under it usually means someone
   dropped the cause mid-chain ([chunk 2](02-the-pathologies.md)).

Total time when practiced: seconds, on traces of any length.

## Reading multi-exception output

Order of printing ≠ order of occurrence:

- **Chronologically**, the deepest `Caused by` happened *first*; wrapping
  proceeded outward as the stack unwound.
- **The printed frame lists get shorter** going down the chain (thanks to
  `... N more`) — don't misread a short cause trace as "little happened":
  the elided frames are the shared outer path, printed once above.
- On a **thread dump** (many stacks, no exception) the same frame-reading
  skill applies, but there is no culprit line — that's a different exercise
  (phase 12 territory).

## What a frame can and cannot tell you

- `(OrderService.java:42)` — line numbers come from debug info in the class
  file (`javac` includes them by default; some release builds strip them,
  leaving `(Unknown Source)`).
- `(Native Method)` — the frame is in native code; no Java line exists.
- A frame names where the *call* was, not where the data went wrong: an
  NPE thrown at line 42 can be caused by a field nulled three requests ago.
  The trace locates the *detonation*, not the *arming* — that distinction
  drives half of [phase 1's null topic](../../phase-1-language-core/13-null-and-npe/README.md).

## Gotchas

**Symptom:** engineer opens the file named in the *bottom* `at` line of the first block and finds `main()` or a server loop
**Cause:** reading frames outermost-first — the trace is innermost-first; the bottom is the program's entry point
**Fix:** culprit at the top; the bottom only tells you which entry path ran

**Symptom:** the `Caused by` trace looks truncated — "only three frames, where's the rest?"
**Cause:** `... N more` misread as loss — those N frames equal the enclosing trace's lower frames
**Fix:** read the enclosing block's frames from where the counts align; nothing is missing

**Symptom:** diagnosis chases the top exception while the real failure was a `close()` that broke the response mid-stream
**Cause:** `Suppressed:` blocks skipped in the scan
**Fix:** after the causes, one pass over suppressed entries — especially when the primary looks too bland to explain the impact

**Symptom:** breakpoint at the first frame never fires under the failing request
**Cause:** the first frame is where the exception was *constructed* — a helper that builds-and-throws for its caller (`Objects.requireNonNull`, a validator)
**Fix:** step down frames until the first one with domain logic; that caller supplied the bad state

**Symptom:** trace shows `(Unknown Source)` everywhere, investigation stalls
**Cause:** classes compiled or repackaged without line-number debug info
**Fix:** keep `-g:source,lines` (javac default) in production builds; the runtime cost is zero and the trace is the payoff

**Symptom:** two teammates argue whether the exception in the log happened before or after the one above it
**Cause:** print order confused with time order in a cause chain
**Fix:** within one trace, deepest cause = earliest event; separate traces order by log timestamp, not adjacency

**Symptom:** the chain ends in `[CIRCULAR REFERENCE: …]` instead of a root cause
**Cause:** the cause chain loops — an exception instance ended up as its own transitive cause (shared/reused instances, careless `initCause` wiring); `printStackTrace` detects the cycle and stops rather than recursing forever
**Fix:** every wrap constructs a *new* exception around the caught one; never cache and reuse exception instances across failure paths

## Interview questions

**★ Someone hands you a 60-line trace. Narrate your first ten seconds.**
Type and message of the top header; if a cause chain exists, jump to the
bottom-most `Caused by` and read *its* type and message; then find the
first frame in our package namespace in that deepest block. That file:line
plus the root type/message is usually the diagnosis; the 50 other lines are
context I read only if those disagree.

**★ What exactly does `... 17 more` mean?**
The cause's remaining 17 frames are identical to the bottom 17 frames of
the enclosing exception's trace, so printing elides them. They are
recoverable by reading the enclosing block — it is deduplication, not
truncation.

**★ Why can the top frame of a trace be the "wrong" place to look?**
Because it marks where the exception object was constructed. Validators,
`requireNonNull`, and assertion helpers throw on behalf of their callers —
the defect is one or more frames down, where the bad value was passed.

**★ Where do `Suppressed:` exceptions come from and when do they matter?**
`Throwable.addSuppressed`, called automatically by try-with-resources when
`close()` throws while a body exception is already in flight. They matter
when the close failure is the real impact (a flush that never happened) or
when the primary is just the visible symptom of the same underlying fault.

**★ In a `Caused by` chain, which exception happened first in time?**
The deepest one. It was thrown, caught, and wrapped; each wrapper above it
was constructed later as the stack unwound through translation layers.

**★ Who prints `Exception in thread "main"` — and why does it matter?**
Not `printStackTrace`: that prefix comes from the thread's *uncaught
exception handler* (the default one prints the thread name, then the
trace) when an exception reaches the top of a thread with nobody catching.
Seeing it means no handler in the application ever took responsibility —
which in a service is itself a finding: the global boundary
([topic 08](../08-global-handler.md)) was bypassed or missing.

**★ The trace's line numbers don't match the source you're reading. What are the candidate explanations?**
Different build deployed than the source checked out; debug info stripped
or altered (`Unknown Source`); instrumentation/AOP weaving shifting lines;
or an inlined/synthetic frame from a lambda or bridge method. Verify the
artifact version first — it's the usual answer.

---

← Index: [Reading a stack trace fast](README.md) · Next → [The pathologies](02-the-pathologies.md)
