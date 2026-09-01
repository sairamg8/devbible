---
title: "The checkpoint that refused: CRaC checks for open files and sockets and aborts rather than writing an image it cannot honour, and the exception it throws names the port — which makes adoption a series of small, legible failures"
sidebar_label: "04 · What must be released"
sidebar_position: 5
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the CRaC project's
> [step-by-step guide](https://github.com/CRaC/docs/blob/master/STEP-BY-STEP.md) — which
> contains the `CheckpointOpenSocketException` stack trace quoted below — the
> [best practices guide](https://github.com/CRaC/docs/blob/master/best-practices.md), the
> project [README](https://github.com/CRaC/docs/blob/master/README.md) and its note on
> [file-descriptor policies](https://github.com/CRaC/docs/blob/master/fd-policies.md).
> 🔴 **No sandbox** — the transcript below is the project's, not a run performed here.

**The first time you try to checkpoint a real application it fails, and that is the system
working. CRaC will not write an image whose restored process would hold handles to things that
no longer exist.**

## The rule

> *"For now, CRaC implementation checks for open files and sockets at the checkpoint. The
> checkpoint is aborted if one is found, also, an exception is thrown with a description of the
> file name or socket address."*

and, from the overview:

> *"CRaC implementation creates the checkpoint only if the whole Java instance state can be
> stored in the image. Resources like open files or sockets are cannot, so it is required to
> release them when checkpoint is made."*

## What the failure looks like

The project's own transcript, for a Jetty server listening on 8080:

```
jdk.crac.impl.CheckpointOpenSocketException: tcp6 localAddr :: localPort 8080 remoteAddr :: remotePort 0
        at java.base/jdk.crac.Core.translateJVMExceptions(Core.java:80)
        at java.base/jdk.crac.Core.checkpointRestore1(Core.java:137)
        at java.base/jdk.crac.Core.checkpointRestore(Core.java:177)
```

🔴 **The exception names the resource** — protocol, local address, port. Adoption is therefore
an iterative loop: attempt a checkpoint, read the name of the thing that was open, teach that
component to close it in `beforeCheckpoint` ([03](03-the-resource-lifecycle.md)), repeat.

⚠️ **And remember where to read it.** `jcmd` always reports success; the exception appears in
the *application's* console.

## The inventory — what a real service holds open

| Held open | Released in `beforeCheckpoint` by | Reacquired in `afterRestore` by |
|---|---|---|
| HTTP listener | stopping the server / web container | starting it again |
| JDBC connection pool | closing all pooled connections | reopening, or letting the pool refill lazily |
| Message broker consumers and producers | stopping containers, closing the connection | reconnecting and resubscribing |
| Log file appenders | stopping the appender or the logging context | restarting it — see below |
| Watch services, memory-mapped files, temp files | closing them | reopening, re-mapping |
| HTTP client connection pools with keep-alive | evicting idle connections | nothing, if the client dials lazily |
| Native handles (JNI, FFM, native libraries with sockets) | library-specific | library-specific |
| Scheduled and background threads | quiescing them | restarting them |

🔴 **Logging is the one that surprises people**, because it is the component you want working
*while* you shut everything else down. Expect a window where the appender is closed and diagnostics
go nowhere — and expect that any exception thrown during checkpoint preparation may be the one
you cannot see.

## Threads are not checked, and that is the harder problem

The open-handle check catches files and sockets. It does not catch a thread that is in the
middle of something. The best-practices guide devotes its longest section to this, because the
rest of the application keeps running while one component is suspended:

> *"CRaC extends the lifecycle of some components by adding the transition from active to a
> suspended state and back. In the suspended state, until the whole VM is terminated or before
> the component is restored, the rest of that application is still running and could access the
> component - e.g. a pool of network connections - and would find this component to be unusable
> at that moment. One solution is to block the thread and unblock it when the component is
> ready for serving again."*

Its three patterns, by threading model:

- **Unknown callers, arriving randomly** → a `ReadWriteLock`: readers take the read lock on the
  hot path, `beforeCheckpoint` takes the write lock and `afterRestore` releases it in a
  `finally`. The guide is candid about the cost: *"This solution has the obvious drawback of
  adding contention on the hot path"*, since read locking *"likely has to perform some atomic
  writes which are not cost free."*
- **One or a known number of periodic threads** → a `java.util.concurrent.Phaser`, chosen over
  `CyclicBarrier` *"as the former has a non-interruptible version of waiting"*, costing *"only
  one volatile read on each `write()` call"*. ⚠️ But: *"if one of the expected threads is
  waiting for a long time the checkpoint would be blocked"*, mitigated with shorter poll
  timeouts or by interrupting from `beforeCheckpoint`.
- **Event loop** → schedule the suspension as a task on the loop itself. ⚠️ Not applicable when
  a single-threaded executor is shared between components, *"as one resource would block and
  the others would not be able to get suspended."*

## The escape hatch for code you cannot change

> *"Sometimes it might be difficult to alter the application to properly coordinate with the
> checkpoint (e.g. due to a code in a library you cannot modify). As a temporary workaround you
> can configure file-descriptor policies."*

⚠️ **Read "temporary workaround" as written.** A policy that tells CRaC what to do with a
descriptor the application never closed is a way to get moving; it is not equivalent to the
library participating in the lifecycle, and it will not reopen anything for you.

## Gotchas

🔴 **The checkpoint aborts; it does not warn.** This is the good outcome — an image with a
stale socket would fail at restore, on a production machine, instead of in your build.

🔴 **Every dependency needs an opinion.** Frameworks with CRaC support (Spring Boot, Micronaut,
Quarkus) handle their own resources; a bespoke client wrapping a socket does not, and nothing
tells you until the checkpoint fails.

⚠️ **A pool that reopens eagerly in `afterRestore` turns a restore into a connection storm**
when many instances restore at once. Consider lazy refill.

⚠️ **Closing the logging appender blinds you at the worst moment.** Arrange a fallback — console
output, or ordering that keeps logging last.

⚠️ **Quiescing threads can deadlock the checkpoint.** Both synchronisation patterns can block
indefinitely if a thread never arrives; use timeouts and consider interrupting from
`beforeCheckpoint`.

⚠️ **`beforeCheckpoint` throwing still runs `afterRestore`** ([03](03-the-resource-lifecycle.md)),
so cleanup that must happen on both paths belongs there — but the checkpoint itself is aborted.

⚠️ **Memory-mapped files and native libraries are outside CRaC's inventory of "checked"
resources but not outside the problem.** A native library holding a descriptor may checkpoint
"successfully" and misbehave after restore.

⚠️ **`Level`-style shutdown ordering is your responsibility.** Two independently registered
resources have no guaranteed order between them.

## Interview questions

**★ What happens if a socket is open when a checkpoint is requested?**
The checkpoint is aborted and an exception naming the socket is thrown — the project's example
shows `CheckpointOpenSocketException` with the protocol, address and port. The image is not
written.

**★ Why abort instead of snapshotting anyway?**
Because a restored process cannot hold a file descriptor or connection from the checkpointing
machine. Failing at checkpoint time, in your build, is strictly better than failing at restore
time in production.

**★ Where do you read the real result of `jcmd … JDK.checkpoint`?**
In the application's console. `jcmd` always reports success in the current implementation, so
its output is not evidence that a checkpoint was taken.

**★ Which resources does CRaC check, and which are still your problem?**
It checks open files and sockets. Threads, in-flight work, native handles, and any library
holding state that will be invalid after restore are the application's responsibility.

**★ Describe the ReadWriteLock pattern and its cost.**
Callers take a read lock on the hot path; `beforeCheckpoint` takes the write lock to exclude
them and closes the resource; `afterRestore` reinitialises and releases the write lock in a
`finally`. The cost is permanent contention on the hot path — read locking performs atomic
writes even when uncontended.

**★ Why does the best-practices guide prefer `Phaser` to `CyclicBarrier`?**
Because `Phaser` offers a non-interruptible wait, which suits a small, known set of periodic
threads. Its risk is that a thread waiting a long time blocks the checkpoint, so poll timeouts
or interruption from `beforeCheckpoint` are recommended.

**★ What are file-descriptor policies for?**
As a temporary workaround for descriptors held by code you cannot modify. They let a checkpoint
proceed but do not give the library a lifecycle, and nothing reopens the resource for you.

Next: [What changes across a restore](04b-what-changes-across-a-restore.md).

{/* FOOTER */}
