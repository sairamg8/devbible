---
title: "`Thread.print` does not show virtual threads, so on a service that uses them the command in every runbook returns a dump of a few carrier threads and silently omits the million threads you wanted to see — there is a different subcommand, and it is not a convenience variant"
sidebar_label: "07 · Virtual threads"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** for `Thread.print`,
> `Thread.dump_to_file`, `Thread.vthread_scheduler` and `Thread.vthread_pollers`, including their
> documented options and impact levels
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> and **JEP 444 "Virtual Threads"**, from which the stack-chunk and GC-root statements are quoted
> ([openjdk.org](https://openjdk.org/jeps/444)).
> 🔴 **No sandbox** — no dump below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Everything in this topic so far assumed platform threads: one Java thread, one OS thread, one
block in the dump. Virtual threads break that assumption and they break the tooling with it. A
service running a virtual thread per request may have a million threads, and `Thread.print`
will show you a few dozen — the carriers. This page is why, what to run instead, and how the
diagnostic questions change when threads stop being the scarce resource.**

## Why `Thread.print` misses them

`Thread.print` reports threads the JVM tracks as platform threads. Virtual threads are not
platform threads: they are Java objects, scheduled onto a small pool of carrier platform threads,
and — from **JEP 444** — their stacks live somewhere else entirely:

> *"The stacks of virtual threads are stored in Java's garbage-collected heap as stack chunk
> objects. The stacks grow and shrink as the application runs, both to be memory-efficient and to
> accommodate stacks of depth up to the JVM's configured platform thread stack size."*

and, decisively for tooling:

> *"Unlike platform thread stacks, virtual thread stacks are not GC roots."*

🔴 **So a virtual thread that is parked — waiting on I/O, a lock, or a queue — is not running on
any carrier at all.** It is a heap object with a stack chunk. There is no OS thread to report and
nothing for the classic dump mechanism to walk.

**What `Thread.print` shows you instead** is the carrier pool: a handful of
`ForkJoinPool`-managed platform threads, each either running some virtual thread's continuation or
idle. That is a real and occasionally useful view — [07b](07b-pinning-in-a-dump.md) uses it — but
it is not the application's threads.

⚠️ **Nothing warns you.** The command succeeds, the output looks like a normal dump, and the
absence is silent. A runbook that says "run `jcmd Thread.print`" produces a confident, complete-
looking, useless artefact on a virtual-thread service.

## The command that does show them

```bash
jcmd <pid> Thread.dump_to_file -format=json /tmp/threads-%p.json
jcmd <pid> Thread.dump_to_file -overwrite /tmp/threads.txt
```

From the tool reference:

- `-overwrite` — *"May overwrite existing file (BOOLEAN, false)"*
- `-format` — *"Output format ("plain" or "json") (STRING, plain)"*
- `filepath` — *"The file path to the output file. If %p is specified in the filename, it is
  expanded to the JVM's PID."*

rated **"Impact: Medium: Depends on the number of threads"** — which on a service with a million
virtual threads is a meaningful caveat rather than a formality.

🔴 **This subcommand exists because of virtual threads.** It is not `Thread.print` with a
redirect: it walks the thread containers, including virtual threads, and it can emit structured
JSON.

### Why JSON is the right default here

A plain-text dump of a million threads is not something a human reads. The JSON format is a tree
of **thread containers** — structured groupings that mirror how the threads were created, so a
structured-concurrency scope or an executor appears as a container with its threads inside it.

That structure is what makes the dump tractable: you filter and group programmatically rather than
scrolling. **With virtual threads, dump analysis stops being reading and becomes querying**, and
the format choice is what enables it.

⚠️ **Take it to a file and copy it out.** At a million threads the file is large; it is not going
to be pleasant in terminal scrollback, and `%p` in the path keeps dumps from several pods
distinct.

## Two more subcommands worth knowing

Both are rated **"Impact: Low"**, so both are safe on a production JVM:

```bash
jcmd <pid> Thread.vthread_scheduler
```

> *"Print the virtual thread scheduler, and the delayed task schedulers that support virtual
> threads doing timed operations."*

**This is how you see the carrier pool's state** — its parallelism, its queue, and the schedulers
behind timed operations. When the question is "are the carriers saturated", this answers it more
directly than reading a dump.

```bash
jcmd <pid> Thread.vthread_pollers
```

> *"Print the I/O pollers that support virtual threads doing blocking network I/O operations."*

**The pollers are the mechanism that makes blocking I/O cheap for virtual threads** — a virtual
thread blocking on a socket is unmounted and its interest registered with a poller, rather than an
OS thread being parked. When network behaviour is in question, this is the view of that machinery.

## The diagnostic questions change

With platform threads, the scarce resource is threads, so the questions are about pool sizes
([06](06-pool-exhaustion.md)). With virtual threads, threads are abundant and the scarcity moves.

| Platform threads | Virtual threads |
|---|---|
| Is the request pool exhausted? | ⚠️ There is no request pool to exhaust |
| How many threads are blocked? | How many are blocked, and **is the downstream thing bounded?** |
| Are the carriers busy? | 🔴 **Are the carriers *pinned*?** — [07b](07b-pinning-in-a-dump.md) |
| Thread count is a cost | Thread count is nearly free; **heap for stack chunks is the cost** |

🔴 **The most important consequence: pool exhaustion stops being the safety limit.** A fixed pool
of 200 threads was an accidental bulkhead — it capped how much work could hit a slow dependency at
once. With a virtual thread per request, a million requests can all pile onto that dependency
simultaneously, and the failure moves from "the service is unresponsive" to "the dependency is
destroyed".

**So explicit limits become mandatory rather than optional.** A semaphore around calls to each
dependency does deliberately what the thread pool used to do accidentally. That is phase 16's
subject, and it is the single most important design consequence of adopting virtual threads.

**And the memory question replaces the thread-count question.** Stack chunks live on the heap, so
a million parked virtual threads is a heap cost proportional to their stack depths — which is
[topic 01's](../01-memory-layout/06b-virtual-thread-stacks.md) subject and a real budget item.

## What a virtual thread dump is good for

Once you can see them, the analysis is recognisably the same discipline as
[06](06-pool-exhaustion.md), with counting done by tooling:

- **Group by top frame.** A million threads in one socket read to one dependency is the same
  finding as 200 platform threads in it, and far more alarming.
- **Group by container.** Structured concurrency scopes appear as containers, so an entire task
  tree can be examined as a unit — which is much closer to how the code is written.
- **Look for the ones that are mounted.** A virtual thread currently on a carrier is either
  running or [pinned](07b-pinning-in-a-dump.md), and the pinned case is the one that reintroduces
  a hard limit.

## Gotchas

**★ `Thread.print` does not show virtual threads, and does not say so.**
It reports the carrier platform threads and succeeds normally. The output looks like a complete
dump. On a virtual-thread service it omits essentially the whole application, silently.

**★ Every runbook written before virtual threads is wrong for a service that adopts them.**
The step "run `jcmd Thread.print`" still executes and still produces output, so nobody notices
until an incident where the dump explains nothing.

**★ `Thread.dump_to_file` is a different dump, not a redirect.**
It walks thread containers including virtual threads, and offers `-format=json`. Treating it as
"`Thread.print` writing to a file" is the mistake that keeps people on the wrong command.

**★ Parked virtual threads are not on any carrier.**
JEP 444: their stacks live on the heap as stack chunk objects, and *"virtual thread stacks are not
GC roots"*. There is no OS thread to walk, which is precisely why the classic mechanism cannot
report them.

**★ Use JSON and analyse programmatically.**
A million thread blocks is not a document. The JSON tree of thread containers turns dump reading
into querying, which is the only workable approach at that scale.

**★ `Impact: Medium: Depends on the number of threads` is a real warning here.**
On a service with a very large number of virtual threads, taking the dump is not free. It is still
the right thing to do during an incident; it is not something to schedule every thirty seconds.

**★ Removing the thread pool removes an accidental bulkhead.**
A fixed pool capped concurrent load on downstream dependencies. Virtual threads remove that cap,
so a slow dependency can be hit by every in-flight request at once. Explicit semaphores replace
what the pool was doing by accident.

**★ The cost moves from threads to heap.**
Stack chunks are heap objects, so a million parked virtual threads is a memory budget item
proportional to stack depth. "Threads are free" is true of OS threads and false of memory.

**★ `Thread.vthread_scheduler` and `Thread.vthread_pollers` are Impact: Low.**
Both are safe on production and both answer questions a dump answers badly — carrier pool state
and the I/O poller machinery respectively.

**★ Seeing few threads in a dump is not evidence of low load.**
On a virtual-thread service, a dump showing twenty carrier threads is entirely consistent with a
million in-flight requests. The number in a `Thread.print` output has almost no relationship to
what the service is doing.

## Interview questions

**★ Why does `jcmd Thread.print` not help on a service using virtual threads?**
Because it reports platform threads, and virtual threads are not platform threads — they are heap
objects whose stacks are stored as stack chunk objects, mounted onto a small pool of carriers only
while running. A parked virtual thread is not on any OS thread, so there is nothing for the
classic dump mechanism to walk. The command still succeeds and shows you the carriers, which makes
the omission silent.

**★ What do you run instead?**
`jcmd <pid> Thread.dump_to_file`, preferably with `-format=json`. It walks thread containers
including virtual threads, and `%p` in the path expands to the PID. The JSON tree is what makes a
dump of a very large number of threads analysable at all, because the analysis becomes filtering
and grouping rather than reading.

**★ Where do virtual thread stacks live, and why does it matter for diagnostics?**
On the garbage-collected heap, as stack chunk objects — JEP 444 also notes they are not GC roots,
unlike platform thread stacks. It matters twice: it is why the classic dump mechanism cannot see
them, and it is why a million parked virtual threads is a heap cost rather than an OS thread cost.
The memory question replaces the thread-count question.

**★ How does pool exhaustion change with virtual threads?**
It largely stops existing as a symptom, and that is not entirely good news. A fixed thread pool was
an accidental bulkhead: it capped how many requests could hit a slow dependency simultaneously.
With a virtual thread per request, that cap is gone, so a slow dependency can receive every
in-flight request at once. The failure moves outward from your service into the dependency, which
is why explicit limits — a semaphore per dependency — become mandatory rather than a nicety.

**★ Your dump shows twenty threads on a service handling heavy load. What do you conclude?**
Nothing, until you know whether it uses virtual threads. Twenty carrier threads is exactly what a
`Thread.print` on a virtual-thread service looks like under any load, including a million
concurrent requests. The correct response is to take a `Thread.dump_to_file` and look at the real
picture, not to conclude the service is idle.

**★ What are `Thread.vthread_scheduler` and `Thread.vthread_pollers` for?**
The first prints the virtual thread scheduler and the delayed task schedulers behind timed
operations — the direct way to ask whether the carrier pool is saturated. The second prints the
I/O pollers that support blocking network operations, which is the machinery that lets a virtual
thread block on a socket without holding an OS thread. Both are Impact: Low and safe on
production, and both answer questions a thread dump answers poorly.

**★ How do you analyse a dump with a million virtual threads?**
Not by reading it. Take it as JSON, then group programmatically: by top frame, which finds the
dependency everything is waiting on, and by thread container, which reflects how the work was
structured and lets you examine a whole task tree as a unit. The findings are the same shapes as
with platform threads — everything waiting on one thing — but the counting has to be done by
tooling.

{/* FOOTER */}
