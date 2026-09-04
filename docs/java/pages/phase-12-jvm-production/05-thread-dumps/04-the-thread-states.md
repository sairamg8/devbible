---
title: "Six enum states describe every thread the JVM has ever run, four of them mean \"not running\" in four different ways, and knowing which of the four you are looking at is the difference between blaming a lock and blaming a timeout"
sidebar_label: "04 · The thread states"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **`java.lang.Thread.State` API documentation**, from which
> every state definition below is quoted verbatim
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)),
> and the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs and Loops → Deadlock Not
> Detected" and "No Thread Dump"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox** — no dump fragment here is a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Every thread in a dump carries one of six `java.lang.Thread.State` values, and the useful skill
is not memorising them but knowing what each one implicates. `BLOCKED` implicates another thread.
`WAITING` implicates a missing signal. `TIMED_WAITING` implicates nothing on its own. And
`RUNNABLE` implicates nothing at all, because it is the state a thread blocked in a socket read
reports — which gets its own page, [04b](04b-runnable-does-not-mean-running.md).**

## The six, verbatim

**`NEW`**

> *"Thread state for a thread which has not yet started."*

**`RUNNABLE`**

> *"Thread state for a runnable thread. A thread in the runnable state is executing in the Java
> virtual machine but it may be waiting for other resources from the operating system such as
> processor."*

**`BLOCKED`**

> *"Thread state for a thread blocked waiting for a monitor lock. A thread in the blocked state is
> waiting for a monitor lock to enter a synchronized block/method or reenter a synchronized
> block/method after calling `Object.wait`."*

**`WAITING`**

> *"Thread state for a waiting thread. A thread is in the waiting state due to calling one of the
> following methods:*
> - *`Object.wait` with no timeout*
> - *`Thread.join` with no timeout*
> - *`LockSupport.park`*
>
> *A thread in the waiting state is waiting for another thread to perform a particular action."*

**`TIMED_WAITING`**

> *"Thread state for a waiting thread with a specified waiting time. A thread is in the timed
> waiting state due to calling one of the following methods with a specified positive waiting
> time:*
> - *`Thread.sleep`*
> - *`Object.wait` with timeout*
> - *`Thread.join` with timeout*
> - *`LockSupport.parkNanos`*
> - *`LockSupport.parkUntil`"*

**`TERMINATED`**

> *"Thread state for a terminated thread. The thread has completed execution."*

## What each one actually implicates

The definitions are precise but they do not tell you what to *do*. This is the reading that
matters during an incident:

| State | Waiting for | Who can fix it | First question |
|---|---|---|---|
| `NEW` | Nothing — never started | — | Almost never seen in a dump |
| `RUNNABLE` | 🔴 **Possibly nothing. Possibly the network.** | Depends entirely | What is the top frame? |
| `BLOCKED` | **A monitor held by another thread** | The holder | Who holds it, and why for so long? |
| `WAITING` | **A signal that may never come** | Whoever should have sent it | What was supposed to wake it? |
| `TIMED_WAITING` | The same, but with a deadline | Often nobody — this is normal | Is the timeout sane, or is it 30 minutes? |
| `TERMINATED` | Nothing | — | Rarely in a dump at all |

### `BLOCKED` is the only state that names a culprit

`BLOCKED` means one specific thing: **waiting to enter a `synchronized` block or method whose
monitor another thread holds.** Nothing else produces it. Not `ReentrantLock`, not a semaphore,
not a queue, not I/O.

That narrowness is what makes it valuable. A `BLOCKED` thread is a direct accusation: some other
thread is holding a monitor, and the dump tells you which monitor and — via the lock identity —
which thread ([03](03-anatomy-of-a-dump.md), [05](05-locks-in-a-dump.md)). There is always a
holder, and the question is never "what is it waiting for" but "why is the holder taking so
long".

⚠️ **The corollary trips people up constantly: a thread waiting on a `ReentrantLock` is
`WAITING`, not `BLOCKED`.** It parks via `LockSupport.park`, so it lands in the `WAITING` bucket
alongside threads waiting for a queue item or a latch. **So "count the `BLOCKED` threads" as a
measure of lock contention systematically undercounts modern code**, which uses
`java.util.concurrent` locks far more than `synchronized`.

### `WAITING` is the state that hides the real problems

`WAITING` covers three quite different situations, and the top frame is what distinguishes them:

- **`Object.wait()` with no timeout** — the classic missed-notification bug. The Troubleshooting
  Guide's own description: *"the issue might be a bug in which a thread is waiting for a monitor
  that is never notified. This could be a timing issue or a general logic bug."* Its advice is to
  read the caller frame: *"The caller frame in the stack trace indicates the class and method that
  is invoking the `wait()` method."*
- **`Thread.join()` with no timeout** — waiting for another thread to finish, which is a hang if
  that thread is itself stuck.
- **`LockSupport.park`** — 🔴 **the enormous category.** Everything built on
  `AbstractQueuedSynchronizer` parks: `ReentrantLock`, `CountDownLatch`, `Semaphore`,
  `ArrayBlockingQueue.take()`, `CompletableFuture.get()`, and the connection pool in
  [06b](06b-the-connection-pool-in-a-dump.md).

**So `WAITING` on its own tells you almost nothing** — an idle worker thread parked on an empty
queue is `WAITING`, and so is a thread that will never be woken. The frame below `park` is the
entire diagnosis.

### `TIMED_WAITING` is usually innocent, and occasionally the whole bug

Most `TIMED_WAITING` threads in a healthy dump are supposed to be there: pool workers polling a
queue with a timeout, scheduled executors sleeping between runs, keep-alive threads.

🔴 **When it is the bug, it is because the timeout is wrong rather than missing.** A 30-minute
socket timeout is technically a timeout and practically a hang — the thread will be released
eventually, long after the request that needed it was abandoned and the pool it belongs to was
exhausted. Seeing `TIMED_WAITING` and concluding "it has a timeout, so it will recover" is only
true on a timescale that may be irrelevant.

⚠️ **A thread in `Thread.sleep` inside a retry loop is `TIMED_WAITING` and is often a symptom** —
it means something failed and is being retried, which points at the failure rather than at the
sleeping thread.

## The dump's own vocabulary, alongside the enum

[03](03-anatomy-of-a-dump.md) established that the header line carries HotSpot's own description
and the following line carries the enum. Roughly, they correspond like this:

| HotSpot's header text | Usual enum | Meaning |
|---|---|---|
| `runnable` | `RUNNABLE` | Executing Java code — or blocked in native I/O |
| `waiting for monitor entry` | `BLOCKED` | Trying to enter a `synchronized` block |
| `in Object.wait()` | `WAITING` / `TIMED_WAITING` | Inside `Object.wait` |
| `waiting on condition` | `WAITING` / `TIMED_WAITING` | Parked, usually via `LockSupport` |

⚠️ **This mapping is a reading aid, not a specification.** The header text is free-form and has
changed across releases; the enum is the contract. When they disagree, read the top frame — it
outranks both.

## Reading states as a distribution

Individual states matter less than the shape of the whole dump. Three shapes and what they mean:

**Many `BLOCKED` on one monitor.** Lock contention with a named culprit. Find the holder, see what
it is doing while holding — usually I/O inside a `synchronized` block, which is the classic
mistake.

**Many `WAITING` in the same `park` frame.** Almost always pool exhaustion of some kind
([06](06-pool-exhaustion.md)). The frames below `park` name which pool.

**Many `RUNNABLE` in the same socket-read frame.** A slow or dead dependency
([04b](04b-runnable-does-not-mean-running.md)). Nothing is contending; everything is waiting on
the network while the enum says they are running.

🔴 **Count states rather than reading threads.** A dump of 400 threads is a distribution, and the
distribution is the diagnosis.

## Gotchas

**★ `BLOCKED` means monitors only.**
It is exclusively "waiting to enter a `synchronized` block or method". A thread waiting on a
`ReentrantLock`, a semaphore or a latch is `WAITING`, not `BLOCKED` — so counting `BLOCKED`
threads systematically undercounts contention in code that uses `java.util.concurrent`.

**★ `RUNNABLE` does not mean running.**
The API's own definition allows *"waiting for other resources from the operating system"*, and
blocking socket reads report `RUNNABLE`. This is the single most consequential misreading in
thread-dump analysis — [04b](04b-runnable-does-not-mean-running.md).

**★ `WAITING` on its own says almost nothing.**
An idle worker parked on an empty queue and a thread that will never be notified are both
`WAITING`. The frame *below* the `park` or `wait` call is the entire diagnosis; the state is just
a bucket.

**★ `LockSupport.park` is the state of almost everything modern.**
`ReentrantLock`, `CountDownLatch`, `Semaphore`, blocking queues, `CompletableFuture.get()` and
connection pools all park. A dump full of `WAITING` threads in `park` is normal, and telling the
normal ones from the stuck ones needs the frames and a second dump.

**★ `TIMED_WAITING` is not reassurance.**
A 30-minute timeout is a hang on any timescale a user cares about. "It has a timeout so it will
recover" is true and irrelevant if the recovery arrives after the pool is exhausted.

**★ A `TIMED_WAITING` thread in `Thread.sleep` is often a retry.**
Which means something upstream failed. The sleeping thread is the symptom; the failure being
retried is the cause, and it is usually visible in the frames or the logs.

**★ The header text and the enum are different vocabularies.**
`waiting on condition` with `RUNNABLE` is a real and documented combination. The header is
free-form and has changed across releases; the enum is the contract; the top frame outranks both.

**★ `NEW` and `TERMINATED` essentially never appear.**
A thread that has not started or has finished is not usually in a dump. Seeing either is unusual
enough to be worth a second look rather than an explanation.

**★ Read the distribution, not the threads.**
Four hundred thread blocks are unreadable individually. Counting states and top frames turns the
dump into a shape, and the shape — many `BLOCKED` on one monitor, many parked in one pool, many in
one socket read — is what names the failure.

## Interview questions

**★ What are the six thread states, and which ones mean the thread is not making progress?**
`NEW`, `RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING`, `TERMINATED`. `BLOCKED`, `WAITING` and
`TIMED_WAITING` all mean not progressing, in three different ways — waiting for a monitor,
waiting for a signal with no deadline, and waiting with one. And `RUNNABLE` can also mean not
progressing, because the API defines it as executing in the VM but possibly waiting on an OS
resource, which includes a blocking socket read.

**★ What exactly does `BLOCKED` mean?**
Waiting to enter a `synchronized` block or method whose monitor another thread holds — or to
re-enter one after `Object.wait`. Nothing else produces it. That narrowness makes it the most
actionable state in a dump: there is always a specific holder, and the dump identifies both the
monitor and the holding thread, so the question is immediately "why is the holder slow" rather
than "what is this waiting for".

**★ A thread is waiting on a `ReentrantLock`. What state is it in?**
`WAITING`, not `BLOCKED`. `ReentrantLock` is built on `AbstractQueuedSynchronizer` and parks via
`LockSupport.park`, which is one of the three documented causes of `WAITING`. This matters
practically: any heuristic that measures lock contention by counting `BLOCKED` threads will miss
essentially all contention in code that uses `java.util.concurrent`.

**★ Your dump has 200 threads in `WAITING`. Is that a problem?**
Unknowable from the state alone. Idle worker threads parked on an empty queue are `WAITING`, and
so is a thread whose notification never arrives. What decides it is the frame below the `park` or
`wait` call — which pool, which queue, which future — plus a second dump to see whether those
threads are the same ones five seconds later. If the count equals a pool's configured maximum and
the threads do not change, that is exhaustion.

**★ Is `TIMED_WAITING` reassuring?**
Not by itself. It means a deadline exists, not that the deadline is sensible. A 30-minute socket
timeout releases the thread long after the request was abandoned and the pool was exhausted, so on
any timescale that matters it behaves like a hang. The useful follow-up is always what the timeout
value actually is.

**★ How do you tell the difference between a missed notification and a normal idle wait?**
Both are `WAITING`, so the state does not separate them. The top frame does — `Object.wait` with
no timeout in application code is suspicious in a way that a pool worker parked on a queue is not
— and the Troubleshooting Guide's advice is to read the caller frame, which *"indicates the class
and method that is invoking the `wait()` method"*. Then take a second dump: a normal idle wait is
usually a thread that wakes and works, and a missed notification never moves.

**★ You have a 400-thread dump. What is your reading strategy?**
Distribution first, threads second. Count the states, then count the top frames, and look at the
shape: many `BLOCKED` on one monitor is contention with a named holder; many `WAITING` in one
`park` frame is pool exhaustion; many `RUNNABLE` in one socket read is a slow dependency. Only
after the shape names a suspect do you read individual thread blocks — and always against a second
and third dump to confirm the threads are not moving.

{/* FOOTER */}
