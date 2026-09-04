---
title: "A thread block carries two different state declarations on two adjacent lines — HotSpot's own word for what the thread is doing and the `java.lang.Thread.State` enum — and reading only one of them is how people misdiagnose the most common stuck thread there is"
sidebar_label: "03 · Anatomy of a dump"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools → The
> jstack Utility" — from which the example thread header line below is quoted verbatim — and
> "Troubleshoot Process Hangs and Loops"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> and the **`java.lang.Thread.State` API documentation**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)).
> 🔴 **No sandbox.** The one full header line below is quoted from Oracle's documentation; every
> other fragment is explicitly marked a schematic.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**A dump is a header, then one block per thread, then — if the JVM found one — a deadlock section.
The thread block is the part you read a thousand times, and its first two lines carry more
information than most people take from them: a header naming the thread and describing what
HotSpot thinks it is doing, and a second line giving the formal `java.lang.Thread.State`. Those
two lines can disagree, and the disagreement is meaningful.**

## The thread header line

This is quoted verbatim from the JDK 25 Troubleshooting Guide's jstack example:

> ```
> "DestroyJavaVM" #18 prio=5 tid=0x000001df4706f000 nid=0x744 waiting on condition [0x0000000000000000]
>    java.lang.Thread.State: RUNNABLE
> ```

Field by field:

| Field | What it is | What it is worth |
|---|---|---|
| `"DestroyJavaVM"` | The thread's name | 🔴 **The most useful field in the dump.** Pool threads carry their pool's name and an index |
| `#18` | The JVM's thread number | Stable within a run; lets you match a thread across dumps |
| `prio=5` | Java priority | Almost never relevant — the OS largely ignores it |
| `tid=0x…` | The JVM's internal thread id | Matches across dumps of the same process |
| `nid=0x744` | 🔴 **The native thread id, in hex** | The bridge to OS tools — see below |
| `waiting on condition` | **HotSpot's** description of what it is doing | Free-form; complements the next line |
| `[0x0000…]` | The stack pointer, or all zeros | Rarely useful; zeros usually mean no Java frame |
| `java.lang.Thread.State: RUNNABLE` | The formal enum state | The one people quote, and it is not the whole story |

### `nid` is the field that connects the dump to the operating system

`nid` is the native thread id **in hexadecimal**, and the OS reports thread ids in decimal. That
mismatch is the entire trick and it catches everybody once.

If `top -H` or `ps -L` shows one thread consuming a core, convert its decimal id to hex, then find
that `nid` in the dump — and you have gone from "some thread is burning CPU" to "this exact Java
stack is burning CPU". That is the standard technique for a CPU-loop investigation, and it is why
`nid` matters more than any other numeric field in the header.

⚠️ The conversion direction people get wrong: **the OS gives you decimal, the dump gives you hex.**
A thread id of `1860` from `top` is `nid=0x744` in the dump.

### The two state lines can disagree, and that is the point

The header says `waiting on condition`. The next line says `RUNNABLE`. Both are correct, and they
are answering different questions:

- **`java.lang.Thread.State`** is the JVM's formal enum, and its vocabulary is deliberately
  coarse. Its own documentation defines `RUNNABLE` as *"executing in the Java virtual machine but
  it may be waiting for other resources from the operating system such as processor"* — a
  definition broad enough to include a thread blocked in a native socket read.
- **HotSpot's own description** — `waiting on condition`, `waiting for monitor entry`,
  `in Object.wait()`, `runnable` — is finer-grained and often more honest about what the thread is
  actually doing.

🔴 **Reading only the enum is how people misdiagnose the most common stuck thread there is**: a
thread blocked forever on a socket read reports `RUNNABLE`, and a reader who stops at that line
concludes the thread is fine. [04b](04b-runnable-does-not-mean-running.md) is that argument in
full, and it is the most important page in this topic.

## The stack, and the lock annotations

Below the header comes the stack, innermost frame first, with lock annotations interleaved. This
fragment is quoted from the Troubleshooting Guide's deadlock example:

> ```
> "AWT-EventQueue-0":
>         at java.awt.Container.removeNotify(Container.java:2503)
>         - waiting to lock <0xf0c30560> (a java.awt.Component$AWTTreeLock)
>         at java.awt.Window$1DisposeAction.run(Window.java:604)
>         ...
>         at java.awt.Window$1DisposeAction.run(Window.java:598)
>         - locked <0xf0c41ec8> (a java.util.Vector)
> ```

Three things to take from it:

**The annotations attach to the frame above them.** `- waiting to lock <0xf0c30560>` belongs to
`Container.removeNotify` — that is the frame in which the thread is trying to acquire.

**The hex value is an object identity you can match across the dump.** `<0xf0c30560>` appearing as
`locked` in one thread and `waiting to lock` in another is exactly how you find who holds what.
The identity is stable within a single dump; it is **not** guaranteed stable across dumps, because
a moving collector may relocate the object.

**The type in parentheses tells you what kind of lock it is** — `(a java.util.Vector)` means the
monitor of a `Vector` instance. That is often enough to identify the code without reading it.

[05 · Locks in a dump](05-locks-in-a-dump.md) covers the full vocabulary and the crucial gap:
this annotation style covers **monitors**, and `java.util.concurrent` locks need `-l`.

## The dump's overall structure

```text
<timestamp>
Full thread dump OpenJDK 64-Bit Server VM (25+36 mixed mode, sharing):

Threads class SMR info:
  ...

"<thread name>" #<n> [daemon] prio=<p> ... nid=0x<hex> <hotspot state> [<sp>]
   java.lang.Thread.State: <ENUM>
        at <frame>
        - <lock annotation>
        ...

"<next thread>" ...

"VM Thread" ...
"GC Thread#0" ...
"C2 CompilerThread0" ...

JNI global refs: ...

Found one Java-level deadlock:      <- only if one was detected
...
```

*(Schematic of the overall shape, not a captured dump. The individual lines quoted earlier in this
page are the verbatim ones.)*

**The parts worth knowing about:**

- **The version line** names the JVM build. Worth keeping when you attach a dump to a ticket.
- **Application threads** come first and are the bulk.
- **VM-internal threads** follow — `VM Thread`, GC threads, compiler threads, `Reference
  Handler`, `Finalizer`, `Signal Dispatcher`. They have no application stack and are usually
  noise, with one exception below.
- **The deadlock section**, if present, is at the end, and it is the JVM having done the analysis
  for you ([05b](05b-deadlock.md)).

🔴 **The one VM thread worth checking is `VMThread`.** The Troubleshooting Guide singles it out:
it *"is the special thread used to execute operations like garbage collection"*, and if it
*"appears to be stuck in `SafepointSynchronize::begin`, then this could indicate an issue bringing
the VM to a safepoint"* — which is a JVM-level problem rather than an application one, and a
completely different investigation.

## `daemon`, and why thread names are the most valuable field

The header carries `daemon` for daemon threads. Its practical significance is at shutdown: the JVM
exits when the last non-daemon thread finishes, so a **non-daemon** thread stuck in a dump is a
thread that will keep the process alive forever — the classic "the service will not shut down"
bug, which is topic 12's subject.

**And thread names carry more diagnostic weight than any other field.** `http-nio-8080-exec-42`
tells you the pool, the port and the index in one string; `HikariPool-1 connection adder` tells you
which subsystem; `pool-3-thread-1` tells you somebody created an executor without naming it.

🔴 **That last case is a real cost.** `Executors.newFixedThreadPool(n)` produces
`pool-N-thread-M`, which tells you nothing about what the pool is for — so during an incident you
cannot tell which of four unnamed pools is saturated. Naming your thread factories is a
five-minute change that pays for itself the first time you read a dump under pressure.

## Gotchas

**★ There are two state lines and they can disagree.**
The header carries HotSpot's own description (`waiting on condition`); the next line carries the
`java.lang.Thread.State` enum. A thread can be `waiting on condition` and `RUNNABLE` at once —
the documented example shows exactly that — and reading only one of them loses information.

**★ `nid` is hex and the OS reports decimal.**
Converting between them is what links a CPU-burning OS thread from `top -H` to a Java stack. Every
person who does this for the first time compares the decimal id against the hex `nid` and
concludes the thread is not in the dump.

**★ Lock annotations attach to the frame *above* them.**
`- waiting to lock` describes the frame printed on the preceding line, not the following one.
Reading them the other way misattributes which method is acquiring.

**★ Lock identities are stable within a dump, not across dumps.**
`<0xf0c30560>` matches `locked` to `waiting to lock` inside one file, which is how you find the
holder. A moving collector can relocate the object between dumps, so the same lock may show a
different address in the next one.

**★ `RUNNABLE` in the enum does not mean the thread is running.**
The API definition explicitly allows a `RUNNABLE` thread to be *"waiting for other resources from
the operating system"*. Blocking socket reads are the case that matters, and they are extremely
common — [04b](04b-runnable-does-not-mean-running.md).

**★ An all-zeros stack pointer usually means no Java frame.**
`[0x0000000000000000]` appears for threads that are not executing Java code. It is not a sign of
corruption and it is not worth investigating.

**★ `prio` is nearly always irrelevant.**
Java thread priority maps weakly or not at all to OS scheduling on mainstream platforms. It is in
the header, it looks meaningful, and it almost never explains anything.

**★ Check `VMThread` when the application threads look innocent.**
If it is stuck in `SafepointSynchronize::begin`, the problem is bringing the VM to a safepoint —
a JVM-level issue, not an application deadlock, and a different investigation entirely.

**★ A stuck non-daemon thread means the process will never exit.**
The JVM waits for the last non-daemon thread. The `daemon` marker in the header is what tells you
whether a hung thread is also a shutdown bug.

**★ Unnamed pools cost you time during an incident.**
`pool-3-thread-1` identifies nothing. Naming thread factories turns "one of these four pools is
saturated" into "the payment client pool is saturated" at a glance.

## Interview questions

**★ Walk me through a thread block in a dump.**
A header line with the thread name, its number, priority, the JVM's `tid`, the native `nid` in
hex, HotSpot's own description of what it is doing and a stack pointer — then a second line with
the formal `java.lang.Thread.State`, then the stack innermost frame first with lock annotations
interleaved. The name and the `nid` are the fields that do the most work: the name identifies the
subsystem, and the `nid` links the thread to OS-level tools.

**★ What is `nid` and what would you use it for?**
The native thread id, printed in hexadecimal. If `top -H` or `ps -L` shows one thread pinning a
core, convert its decimal id to hex and find that `nid` in the dump — that maps an OS-level CPU
observation onto a specific Java stack. It is the standard technique for diagnosing a CPU loop,
and the decimal-versus-hex mismatch is the part everyone gets wrong the first time.

**★ A thread's header says `waiting on condition` but its state says `RUNNABLE`. Which is right?**
Both. They are different vocabularies: `java.lang.Thread.State` is a coarse enum whose own
documentation defines `RUNNABLE` as executing in the VM but possibly *"waiting for other resources
from the operating system"*, while HotSpot's description is finer-grained. The important
consequence is that `RUNNABLE` cannot be read as "this thread is making progress" — a thread
blocked indefinitely in a native socket read reports `RUNNABLE`.

**★ How do you find which thread holds the lock another thread is waiting for?**
Match the lock identity. A thread waiting shows `- waiting to lock <0x...>` and the holder shows
`- locked <0x...>` with the same address, so searching the dump for that hex value finds the
holder. The identity is reliable within a single dump but not across dumps, since a moving
collector can relocate the object. And note that this annotation style covers monitors — for
`java.util.concurrent` locks you need `Thread.print -l`.

**★ Which VM-internal threads are worth reading?**
Almost none, with one exception: `VMThread`, which executes VM operations such as garbage
collection. The Troubleshooting Guide advises checking it specifically — if it is stuck in
`SafepointSynchronize::begin`, the issue is getting the VM to a safepoint, which is a JVM-level
problem rather than an application deadlock and needs a different investigation. GC and compiler
threads are ordinarily noise.

**★ Why does the `daemon` marker matter?**
Because the JVM exits when the last non-daemon thread terminates. A stuck non-daemon thread means
the process will never shut down cleanly, so a hang and a shutdown bug can be the same defect.
Seeing whether the stuck thread is a daemon tells you whether you are also looking at the reason
deployments hang on SIGTERM.

**★ What one change to an application would make its dumps easier to read?**
Name the thread pools. `Executors.newFixedThreadPool(n)` produces `pool-N-thread-M`, which
identifies nothing, so during an incident you cannot tell which of several pools is saturated. A
named thread factory turns the most valuable field in the dump — the thread name — from noise
into an answer, and it costs one line per pool.

{/* FOOTER */}
