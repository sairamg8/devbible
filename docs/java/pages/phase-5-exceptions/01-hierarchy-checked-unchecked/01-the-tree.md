---
title: "The tree, and what each branch means"
sidebar_label: "1 · The tree"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §11.1 (The Kinds and Causes of
> Exceptions) and §11.5 (The Exception Hierarchy), plus the JDK 25 Javadoc
> for `Throwable`, `Error`, `Exception`, `RuntimeException`,
> `OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError` and
> `AssertionError`.

**Only `Throwable` and its subclasses can be thrown or caught — that is a
compile-time rule, not a convention. Everything below it is a statement
about *who broke what*: `Error` means the platform is failing under you,
`RuntimeException` means a programmer wrote a bug, and checked `Exception`
means the outside world did something your code was told to expect. Reading
the tree as those three statements is what makes every downstream decision —
catch it? declare it? translate it? — mechanical instead of stylistic.**

## The tree itself

```java
Throwable                     // the only thing `throw` and `catch` accept
├── Error                     // JVM/platform failure — unchecked, don't catch
│   ├── OutOfMemoryError
│   ├── StackOverflowError    // extends VirtualMachineError
│   ├── NoClassDefFoundError  // extends LinkageError
│   └── AssertionError
└── Exception                 // program-level failure
    ├── RuntimeException      // unchecked — programming bugs
    │   ├── NullPointerException
    │   ├── IllegalArgumentException
    │   ├── IllegalStateException
    │   ├── IndexOutOfBoundsException
    │   └── ConcurrentModificationException
    ├── IOException           // checked — the environment failed
    ├── SQLException          // checked
    └── InterruptedException  // checked — and special (phase 6)
```

The JLS carves the *unchecked* set precisely: `RuntimeException` and its
subclasses, plus `Error` and its subclasses (JLS §11.1.1). Everything else
under `Throwable` is *checked* — the catch-or-declare rule of
[chunk 2](02-checked-mechanics-debate.md) applies to it.

Two facts people misplace in interviews:

- **`Exception` itself is checked.** `catch (Exception e)` catches both
  checked exceptions and every `RuntimeException` — which is why a blanket
  `catch (Exception e)` swallows your bugs along with the I/O failures.
- **`Throwable` is a class, not an interface** — it carries state (message,
  cause, stack trace, suppressed list), which is why creating one is not
  free ([chunk 3](03-modern-lean-and-cost.md) prices it).

## What each branch means operationally

**`Error` — the platform is failing.** The Javadoc for `Error` says it
"indicates serious problems that a reasonable application should not try to
catch". The operational content: by the time an `Error` reaches you, the
invariants your recovery code would depend on may already be gone.

- **`OutOfMemoryError`** — the heap (or metaspace, or thread-stack
  allocation) is exhausted. Catching it and continuing means running the
  rest of the request mix against a heap that may fail *any* allocation —
  including the allocations your catch block needs. Some frameworks catch it
  at the very top to attempt a log-and-die; that is a crash handler, not
  recovery. The honest response is a heap dump flag
  (`-XX:+HeapDumpOnOutOfMemoryError`) and a supervisor that restarts the
  process — **Phase 12 · The JVM in production** *(not written yet)* owns
  that runbook.
- **`StackOverflowError`** — a thread blew its stack, almost always
  unbounded recursion. It is technically sometimes survivable (the stack
  unwinds as it propagates, freeing frames), which tempts people to catch
  it in tree-walking code — but the frames it destroyed may have been
  mid-mutation in library code, so the objects it touched are suspect.
  Fix the recursion (or convert to an explicit stack/iteration); don't
  catch the symptom.
- **`NoClassDefFoundError`** — the class was present at compile time and
  missing (or failed to initialize) at run time. Its most confusing form:
  a static initializer threw once, and every *later* use of the class gets
  `NoClassDefFoundError` with barely any message, the original cause long
  gone from the logs. It is a deployment/classpath/init bug; catching it
  in application code just hides which of the three it was.
- **`AssertionError`** — an `assert` failed (or code threw it by hand to
  mark "impossible" branches). It means an invariant you *proved* to
  yourself is false — the one case where crashing is unambiguously
  correct.

**Why "catching them lies":** a `catch (Throwable t)` or
`catch (Error e)` block *runs* — the language allows it — but its premise is
false. The block claims "the program can continue from here", while the
condition it caught says "continuation guarantees are void". The lie
compounds: the service keeps answering health checks while every real
request fails allocation, which is strictly worse than a dead process a
supervisor would have restarted. The narrow legitimate uses — a top-level
last-words logger, a test harness isolating a task, a plugin container
killing a misbehaving plugin's thread — all share one property: **they do
not continue the work that was interrupted; they report and shut the
compartment down.**

**`RuntimeException` — a programmer wrote a bug.** `NullPointerException`,
`IllegalArgumentException`, `IndexOutOfBoundsException`,
`ConcurrentModificationException`: each one, when it fires, points at code
that must be *fixed*, not a condition to be *handled*. That is the real
reason they are unchecked — forcing every caller of `list.get(i)` to write
`catch (IndexOutOfBoundsException e)` would produce handlers for a
condition whose only correct handling is "fix the index math". They are
also the exceptions you *throw* to enforce your own preconditions:
`Objects.requireNonNull(order, "order")`,
`throw new IllegalStateException("connection already closed")` — see
[NPE messages and designing nulls out](../../phase-1-language-core/13-null-and-npe/README.md).

**Checked `Exception` — the world did something you were told to expect.**
`IOException` (the disk filled, the socket dropped), `SQLException` (the
database went away mid-transaction): conditions a *correct* program running
in an *imperfect* environment will still meet. The compiler makes them part
of the method's type so the caller is confronted with them at compile time.
Whether that confrontation helps or hurts is the debate of
[chunk 2](02-checked-mechanics-debate.md).

## The boundary cases that test the model

- **`InterruptedException`** is checked and *behavioural*: catching it
  without restoring the interrupt flag (`Thread.currentThread().interrupt()`)
  breaks cooperative cancellation — **Phase 6 · Concurrency** *(not written
  yet)* treats it fully.
- **`NumberFormatException`** (unchecked, extends
  `IllegalArgumentException`) fires for *user input* — an expected-world
  condition wearing a bug-class costume. It is the standard exhibit for
  "the tree is advisory": validate before parsing, or catch it tightly
  around the parse.
- **`UncheckedIOException`** exists purely to carry a checked `IOException`
  across an interface that declares nothing — the JDK's own admission that
  the two subtrees need a bridge
  ([chunk 3](03-modern-lean-and-cost.md) shows where it's used).

## Gotchas

**Symptom:** service stays "up" but every request fails; logs show `OutOfMemoryError` caught and logged hours ago
**Cause:** `catch (Throwable t)` in a request handler kept a broken JVM serving traffic
**Fix:** let `Error` propagate and die; `-XX:+HeapDumpOnOutOfMemoryError` + supervisor restart; catch `Exception`, not `Throwable`, in handlers

**Symptom:** `NoClassDefFoundError` on a class that is plainly in the jar
**Cause:** the class's static initializer threw earlier (`ExceptionInInitializerError` the first time); the JVM marks the class failed and all later uses get `NoClassDefFoundError` with no cause
**Fix:** search the logs *earlier* for `ExceptionInInitializerError` — the first occurrence has the real stack trace; make static initializers trivial

**Symptom:** `StackOverflowError` caught, retried, and the retry corrupts data
**Cause:** the overflow unwound through library frames mid-mutation; the structures it touched are in undefined states
**Fix:** treat the error as fatal for that computation's state; fix the recursion depth (explicit stack, iteration, or a depth cap that throws a domain exception *before* the JVM limit)

**Symptom:** `catch (Exception e)` block unexpectedly handling `NullPointerException`s from a typo three lines up
**Cause:** `RuntimeException` is under `Exception` — broad catches absorb bugs, not just environmental failures
**Fix:** catch the specific checked types the `try` body actually throws; let bugs escape to the top-level handler where they page someone

**Symptom:** code review shows `throw new Error("unreachable")` in business logic
**Cause:** `Error` misused as a generic "can't happen" — it signals *platform* failure to every reader and to monitoring
**Fix:** `AssertionError` for genuinely impossible branches; `IllegalStateException` for "reachable but invalid"

**Symptom:** interviewer asks "is `Exception` checked or unchecked?" and the room splits
**Cause:** the unchecked set is defined by *two* subtrees (`RuntimeException`, `Error`), not by "everything that isn't `RuntimeException`"
**Fix:** recite the JLS rule: unchecked = `RuntimeException` + `Error` + their subclasses; everything else under `Throwable` — including `Exception` itself — is checked

**Symptom:** a "catch-everything" `catch (Exception e)` wrapper in a worker loop, yet the thread still dies overnight
**Cause:** `Error` is not under `Exception` — `OutOfMemoryError`, `NoClassDefFoundError` and friends sail past the broad clause
**Fix:** usually correct as-is (Errors *should* kill the compartment); if the loop must log last words first, that is the narrow `catch (Throwable t)`-then-terminate case, not a reason to widen and continue

## Interview questions

**★ Walk the `Throwable` tree and say what each branch is *for*.**
`Error`: the JVM/platform failing — unwind and die, don't handle.
`RuntimeException`: programming bugs — fix the code, don't handle.
Checked `Exception`: expected environmental failure — the compiler forces
the caller to confront it. The catch: the sorting is advisory
(`NumberFormatException` is environmental input wearing an unchecked
class), so read each type's meaning, not just its supertype.

**★ Why shouldn't you catch `OutOfMemoryError` and return a 500?**
Because the catch block's own work — logging, building the response —
allocates, and *any* allocation may now fail; and because the heap
exhaustion has already possibly broken other threads mid-operation. You'd
keep a corrupt process answering health checks. Crash, dump the heap,
let the supervisor restart.

**★ When is catching `Throwable` legitimate?**
At compartment boundaries that *terminate* the compartment: a thread pool's
top-level runnable wrapper logging last words, a plugin host unloading a
plugin, a test framework failing a test. The distinguishing feature is that
none of them resume the interrupted work.

**★ `NoClassDefFoundError` vs `ClassNotFoundException` — difference?**
`ClassNotFoundException` is *checked* and thrown from explicit dynamic
loading (`Class.forName`, `ClassLoader.loadClass`) — the string name wasn't
found; a program can meaningfully react. `NoClassDefFoundError` is an
`Error`: the class was there at compile time and is missing or
failed-to-initialize at link time — a deployment or init bug, not a
recoverable condition.

**★ Why is `NullPointerException` unchecked when null returns are so common?**
Because the correct response to an NPE is fixing the code that let null
travel, and a forced `catch` at every dereference would create millions of
handlers with nothing correct to do. The type system alternative for
*expected* absence is [`Optional`](../../phase-4-lambdas-streams/07-optional/README.md)
or a documented `@Nullable` — moving the case into signatures, where the
compiler helps without a catch block.

**★ Why is `Error` unchecked rather than checked?**
Because any code, on any line, can meet an `OutOfMemoryError` or
`StackOverflowError` — a checked `Error` would force `throws` on every
method in existence, conveying nothing. The checked mechanism exists to
make *actionable* failures part of signatures; platform collapse is not
actionable at the caller.

**★ Can anything that isn't a `Throwable` be thrown?**
Not in Java: `throw` requires an expression whose type is `Throwable` or a
subclass, and `catch` parameters are checked the same way — both at compile
time. (The JVM enforces it too: `athrow` verifies the operand is a
`Throwable` reference, so even bytecode written by other languages plays by
the same rule.)

**★ What is special about `AssertionError` in modern code?**
It marks branches the author *proved* unreachable — the `default` of an
exhaustive-looking switch, the "can't happen" catch. Throwing it is honest:
if it ever fires, an invariant is false and crashing is the only response
that doesn't build on the false invariant. (With sealed types and
exhaustive `switch` — [phase 2's sealed ADTs](../../phase-2-classes-objects/09-sealed-adts.md) —
the compiler increasingly removes the need for it.)

---

← Index: [The hierarchy, checked vs unchecked](README.md) · Next → [Checked exceptions — the mechanics and the debate](02-checked-mechanics-debate.md)
