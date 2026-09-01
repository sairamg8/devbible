---
title: "A dump shows monitors by default and `java.util.concurrent` locks only if you asked for them, which means the lock most modern code actually uses is invisible unless you typed one extra flag — and its absence looks exactly like no contention at all"
sidebar_label: "05 · Locks in a dump"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** for `Thread.print`'s `-l`
> option — *"Prints `java.util.concurrent` locks"*
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs and Loops → Deadlock
> Detected", from which the lock-annotation fragments are quoted verbatim, including its statement
> that *"The default deadlock detection works with locks that are obtained using the synchronized
> keyword, as well as with locks that are obtained using the `java.util.concurrent` package"* and
> that `-XX:+PrintConcurrentLocks` adds *"a list of lock owners"*
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox** — quoted fragments are from Oracle's documentation; anything else is a marked
> schematic.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A thread waiting is only half a diagnosis. The other half is what it waits for and who holds
that thing, and a dump answers both — for monitors, always, and for `java.util.concurrent` locks
only when asked. This page is the annotation vocabulary, how to match a waiter to a holder, and
the flag whose absence makes the most widely used lock in modern Java disappear from the
evidence.**

## The three annotations

Quoted from the Troubleshooting Guide's deadlock example:

> ```
> "AWT-EventQueue-0":
>         at java.awt.Container.removeNotify(Container.java:2503)
>         - waiting to lock <0xf0c30560> (a java.awt.Component$AWTTreeLock)
>         at java.awt.Window$1DisposeAction.run(Window.java:604)
>         ...
>         - locked <0xf0c41ec8> (a java.util.Vector)
> ```

| Annotation | Means | Thread state |
|---|---|---|
| `- locked <0x…>` | **This thread holds this monitor** | Any — holding a lock does not block you |
| `- waiting to lock <0x…>` | **This thread wants it and cannot have it** | `BLOCKED` |
| `- waiting on <0x…>` | This thread called `Object.wait()` on it, **releasing it** | `WAITING` / `TIMED_WAITING` |
| `- parking to wait for <0x…>` | Parked on a `j.u.c.` synchronizer | `WAITING` / `TIMED_WAITING` |

🔴 **The distinction between `waiting to lock` and `waiting on` is the one people invert.**

- `waiting to lock` — the thread is **outside** the `synchronized` block, trying to get in.
  Someone else holds the monitor. There is a culprit.
- `waiting on` — the thread was **inside**, called `Object.wait()`, and **gave the monitor
  back**. It holds nothing. It is waiting for a `notify()` that may never come, and there is no
  culprit holding anything — the culprit is code that never notified.

Confusing them turns "nobody sent the signal" into "somebody is hogging the lock", which sends
the investigation in exactly the wrong direction.

⚠️ **Annotations attach to the frame above them** ([03](03-anatomy-of-a-dump.md)). The lock line
describes the method printed on the preceding line.

## Matching a waiter to a holder

This is the core technique and it is mechanical:

1. Find the blocked thread's `- waiting to lock <0x…>` and take the hex identity.
2. Search the whole dump for that same identity annotated `- locked`.
3. That thread is the holder. **Read its stack** — the answer is what it is doing while holding.

The Troubleshooting Guide performs exactly this reasoning on its own example:

> *"the thread `main` is locking object `0xf0c30560` and is waiting to enter `0xf0c41ec8`, which
> is locked by thread `AWT-EventQueue-0`. However, thread `AWT-EventQueue-0` is waiting to enter
> `0xf0c30560`, which is locked by `main`."*

**The holder's stack is where the bug is, not the waiter's.** Twenty threads `BLOCKED` on one
monitor is a symptom; the one thread holding it while doing a database call inside a
`synchronized` block is the defect.

⚠️ **Lock identities are stable within a dump, not across dumps.** A moving collector can relocate
the object, so the same lock may carry a different address in the next dump. Match within one
file.

⚠️ **Sometimes there is no holder in the dump at all.** If a monitor is held by a thread that has
since exited, or the contention resolved between the annotation and the rest of the dump being
written, you can find a waiter with no matching `locked` line. A dump is not taken atomically.

## 🔴 The flag that decides what you can see

```bash
jcmd <pid> Thread.print -l
```

The tool reference: `-l` *"Prints `java.util.concurrent` locks"*.

**Without `-l`, a dump shows monitors — locks acquired via `synchronized` — and nothing else.**
With it, you additionally get the `java.util.concurrent` ownership information: which thread holds
a `ReentrantLock`, a `ReentrantReadWriteLock`, or any of the many library locks built on
`AbstractQueuedSynchronizer`.

The consequence is severe and easy to miss:

| Lock type | Waiting thread's state | Visible without `-l`? |
|---|---|---|
| `synchronized` monitor | `BLOCKED` | ✅ Yes, with holder |
| `ReentrantLock` | `WAITING` | ⚠️ You see it parked — but **not who holds it** |
| `ReentrantReadWriteLock` | `WAITING` | ⚠️ Same |
| `Semaphore`, `CountDownLatch` | `WAITING` | ⚠️ Same |

🔴 **A dump without `-l` of a service that uses `ReentrantLock` shows threads parked with no
indication of contention.** They look like idle workers. The contention is real, severe, and
completely absent from the evidence — which is why "we took a dump and there was no lock
contention" is a conclusion that must always be checked against whether `-l` was used.

**`-XX:+PrintConcurrentLocks`** is the JVM-flag equivalent: with it set, the guide says *"the
stack trace also shows a list of lock owners"*. It has to be set at startup, whereas `-l` is a
choice you make at dump time — which makes `-l` the practical answer and the flag a nice-to-have
on a service you already suspect.

## Monitors versus `java.util.concurrent`, and why it matters here

The two lock families produce different states, different annotations and different visibility:

**`synchronized`** — the JVM's own construct. Waiting threads are `BLOCKED`. Ownership is always
reported. The JVM can always identify the owner because it manages the monitor itself. It is also
what most textbook examples use, which is why textbook dump-reading advice works better on
textbook code than on production code.

**`java.util.concurrent`** — library locks built on `AbstractQueuedSynchronizer`, which parks
threads via `LockSupport.park`. Waiting threads are `WAITING`
([04](04-the-thread-states.md)). Ownership is a field in a Java object, which is why the dump has
to be asked to go and read it.

🔴 **Modern code and modern libraries overwhelmingly use the second family**, which means the
default dump is optimised for the lock type you are least likely to be contending on. That is the
single most useful operational fact on this page.

**Deadlock detection, notably, covers both** — the guide: *"The default deadlock detection works
with locks that are obtained using the synchronized keyword, as well as with locks that are
obtained using the `java.util.concurrent` package."* So the JVM will find a `ReentrantLock`
deadlock even though a `-l`-less dump would not have shown you the ownership
([05b](05b-deadlock.md)).

## What the holder's stack usually shows

When you find the holder, the defect is nearly always one of these:

- **I/O inside the lock.** A remote call, a database query or a file write performed while holding
  a lock. The lock is held for the duration of the network, and every waiter pays.
- **A lock scope that is far too wide.** `synchronized` on a whole method when only two lines
  needed protection.
- **A lock held across a callback**, where the callback does something unbounded that the lock's
  author never anticipated.
- **A slow operation nobody thought was slow** — a large serialisation, a regex, a sort inside a
  `synchronized` accessor.

**None of these is visible from the waiters.** All of them are obvious in the holder's stack,
which is why finding the holder is the whole technique.

## Gotchas

**★ `Thread.print` without `-l` hides `java.util.concurrent` lock ownership.**
The default shows monitors only. A service using `ReentrantLock` produces a dump full of parked
threads with no indication of who holds anything — which looks identical to a healthy idle pool.

**★ "We took a dump and saw no lock contention" needs a follow-up question.**
Namely: was `-l` used? Without it, the most common lock family in modern Java is invisible, so the
absence of evidence is an artefact of the command rather than a finding.

**★ `waiting to lock` and `waiting on` are opposites.**
`waiting to lock` means the thread is outside a `synchronized` block trying to enter, and someone
holds the monitor. `waiting on` means it was inside, called `Object.wait()` and *released* the
monitor. One has a culprit holding a lock; the other is waiting for a notification nobody sent.

**★ A thread in `Object.wait()` holds nothing.**
That is the defining behaviour of `wait` — it releases the monitor. Treating such a thread as a
lock holder inverts the diagnosis.

**★ The holder's stack is where the bug is.**
Twenty blocked waiters are a symptom. The defect is in the one thread holding the monitor, and it
is nearly always I/O or an unexpectedly slow operation inside the lock.

**★ Lock identities are stable within a dump, not between dumps.**
Match `waiting to lock` to `locked` inside one file. A moving collector can relocate the object,
so the address may differ in the next dump even though the lock is the same.

**★ A waiter can have no matching holder in the dump.**
Dumps are not taken atomically, so the holder may have exited or released between the two lines
being written. An unmatched waiter is not evidence of corruption; take another dump.

**★ Deadlock detection covers both lock families even when the dump does not show ownership.**
The guide says detection works for `synchronized` *and* `java.util.concurrent`. So a
`ReentrantLock` deadlock is reported even from a dump that omitted `-l` — the detection is not
limited by the printing option.

**★ `-XX:+PrintConcurrentLocks` must be set at startup.**
It adds lock owners to every dump, which is useful on a service you already suspect. `-l` is the
version you can decide on during the incident, which makes it the one to remember.

**★ Textbook dump-reading advice assumes `synchronized`.**
Most examples, including Oracle's own, use monitors, because they predate or ignore the
`java.util.concurrent` shift. Advice that only mentions `BLOCKED` and `waiting to lock` will
mislead you on a modern codebase.

## Interview questions

**★ What lock annotations appear in a thread dump, and what does each mean?**
`- locked <0x…>` means this thread holds the monitor. `- waiting to lock <0x…>` means it is
`BLOCKED` trying to enter a `synchronized` block someone else holds. `- waiting on <0x…>` means it
called `Object.wait()` and released the monitor, so it holds nothing and is waiting for a
notification. And `- parking to wait for <0x…>` means it is parked on a `java.util.concurrent`
synchronizer.

**★ How do you find which thread holds the lock a blocked thread wants?**
Take the hex identity from its `- waiting to lock <0x…>` line and search the dump for the same
identity annotated `- locked`. That thread is the holder, and its stack is where the actual
problem is — typically I/O or an unexpectedly slow operation performed inside the lock. The
identity is reliable within one dump but not across dumps.

**★ What does `-l` add, and why does it matter so much?**
It prints `java.util.concurrent` lock ownership. Without it a dump shows monitors only, so for any
code using `ReentrantLock`, read-write locks, semaphores or latches you see threads parked with no
indication of who holds what. Since modern code and libraries use that family far more than
`synchronized`, the default dump is optimised for the lock type you are least likely to be
contending on.

**★ A dump shows dozens of threads `WAITING` and zero `BLOCKED`. Does that mean there is no lock
contention?**
No, and it may mean the opposite. Threads waiting on `java.util.concurrent` locks are `WAITING`,
not `BLOCKED`, because they park rather than block on a monitor. If the dump was taken without
`-l`, there is no ownership information to reveal the contention either. The correct next step is
another dump with `-l`, not a conclusion.

**★ What is the difference between `waiting to lock` and `waiting on`, in terms of what you do
next?**
`waiting to lock` means go find the holder — there is one, the dump identifies it, and its stack
contains the defect. `waiting on` means there is no holder to find, because the thread released
the monitor when it called `wait()`; the question becomes which code was supposed to call `notify`
and why it did not, which is a logic bug rather than a contention problem.

**★ You find the holder and it is doing an HTTP call inside a `synchronized` method. What is your
recommendation?**
Move the I/O outside the lock. The lock exists to protect some state, and the network call almost
certainly does not touch that state — so the lock is being held for the duration of a remote
dependency, converting one slow call into a queue of blocked threads. If the call's result must be
stored under the lock, do the call first and take the lock only to publish the result. This is the
most common finding at the end of this technique.

**★ Does deadlock detection work for `ReentrantLock`?**
Yes. The Troubleshooting Guide states that detection works for locks obtained with the
`synchronized` keyword *and* with the `java.util.concurrent` package. It is worth knowing because
the printing of `j.u.c.` ownership is optional while the detection is not — so the JVM can report
a deadlock involving locks whose ownership your dump did not otherwise display.

{/* FOOTER */}
