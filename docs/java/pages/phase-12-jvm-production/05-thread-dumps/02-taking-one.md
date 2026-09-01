---
title: "There are five ways to get a thread dump out of a JVM, the one every tutorial names is now marked experimental and unsupported, and Oracle's own troubleshooting guide tells you in as many words to use a different one"
sidebar_label: "02 · Taking one"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` tool reference** for `Thread.print`,
> `Thread.dump_to_file`, `Thread.vthread_scheduler` and `Thread.vthread_pollers`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> the **JDK 25 `jstack` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jstack.html)),
> and the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs and Loops → Diagnose a
> Hung Process" and "Diagnostic Tools → The jstack Utility"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox** — command syntax and impact levels are quoted from the tool references.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Five mechanisms produce a thread dump, and on JDK 25 the choice between them is no longer a
matter of taste. `jstack` — the command in every tutorial, every StackOverflow answer and most
internal runbooks — now opens its own man page with a warning, and the Troubleshooting Guide
names its replacement explicitly. This page is each mechanism, what it costs, where its output
goes, and which one to put in your runbook.**

## 🔴 `jstack` is experimental and unsupported on JDK 25

The JDK 25 `jstack` man page opens:

> *"Note: This command is experimental and unsupported."*

and adds:

> *"This command is unsupported and might not be available in future releases of the JDK."*

The Troubleshooting Guide is more direct still:

> *"Use the `jcmd` or `jhsdb jstack` utility, instead of the `jstack` utility to diagnose problems
> with JVM and Java applications."*

**This is the same status `jmap` carries** ([topic 01](../01-memory-layout/01d-taking-a-heap-dump-on-purpose.md)
makes the equivalent point for heap dumps), and it reflects a deliberate consolidation: the
diagnostic surface is moving to `jcmd`, which speaks the attach protocol and exposes every
subcommand the VM offers rather than one fixed report.

⚠️ **It still works.** Nothing about this makes existing runbooks stop functioning today. What it
means is that a runbook built on `jstack` is built on a command the JDK says may disappear, and
that the replacement is strictly more capable — so there is no reason to keep it beyond
familiarity.

## The five mechanisms

### 1 · `jcmd Thread.print` — the default answer

```bash
jcmd <pid> Thread.print
jcmd <pid> Thread.print -l      # include java.util.concurrent locks
jcmd <pid> Thread.print -e      # extended thread information
```

From the tool reference, the two options are:

- `-e` — *"Print extended thread information (BOOLEAN, false)"*
- `-l` — *"Prints `java.util.concurrent` locks (BOOLEAN, false)"*

rated **"Impact: Medium --- depends on the number of threads."**

🔴 **Use `-l` essentially always.** Without it you get monitors — the locks taken by
`synchronized` — and not `java.util.concurrent` ownership, which is where `ReentrantLock`,
`ReentrantReadWriteLock` and every lock inside a modern library live.
[05 · Locks in a dump](05-locks-in-a-dump.md) shows exactly what the flag adds; the short version
is that a dump without `-l` can show you a thread waiting and give you no way to see who holds
what it waits for.

The output goes **to your terminal**, not to the target process's log, which is the practical
advantage over the signal-based mechanisms below.

### 2 · `jcmd Thread.dump_to_file` — the one for virtual threads

```bash
jcmd <pid> Thread.dump_to_file -format=json /tmp/threads-%p.json
jcmd <pid> Thread.dump_to_file -overwrite /tmp/threads.txt
```

From the tool reference:

- `-overwrite` — *"May overwrite existing file (BOOLEAN, false)"*
- `-format` — *"Output format ("plain" or "json") (STRING, plain)"*
- `filepath` — *"The file path to the output file. If %p is specified in the filename, it is
  expanded to the JVM's PID."*

🔴 **This is not merely `Thread.print` writing to a file.** It is the dump that includes **virtual
threads**, and it is the reason this subcommand exists.
[07 · Virtual threads](07-virtual-threads.md) is the full argument, and it matters more every
release: on a service using virtual threads, `Thread.print` shows you the carriers and misses the
millions of application threads entirely.

**The JSON format is the one to take when you intend to process the dump** rather than read it —
it is a structured tree of thread containers, which is far easier to filter and group than
free-form text.

### 3 · The Control+Break handler

The Troubleshooting Guide:

> *"On Linux operating systems, the combination of pressing the Control key and the backslash (\)
> key at the application console (standard input) causes the Java HotSpot VM to print a thread
> dump to the application's standard output. On Windows, the equivalent key sequence is the
> Control and Break keys. The general term for these key combinations is the Control+Break
> handler."*

Useful when you have the console in front of you, which in production you almost never do.

### 4 · `SIGQUIT`

```bash
kill -QUIT <pid>      # or kill -3 <pid>
```

The guide: *"On the Linux operating system, the thread dump can also be obtained by sending a
`SIGQUIT` to the process (command `kill -QUIT pid`). If the hung process can generate a thread
dump, then the output is printed to the standard output of the target process."*

⚠️ **The name is a lie in a useful way: `SIGQUIT` does not quit the JVM.** HotSpot installs a
handler that prints a dump and continues. Sending it feels alarming and is safe.

⚠️ **But the output goes to the target's standard output**, which is the crucial operational
detail. In a container that is the container log; under a supervisor it may be a file nobody
tails; if the process was started with output redirected somewhere forgotten, the dump goes there.
The guide warns about exactly this case — *"when the application is not accessible, or the output
is directed to an unknown location"*.

**Where `SIGQUIT` genuinely wins:** when you cannot run `jcmd`. It needs no JDK tooling in the
container, no matching JDK version, and no attach permission — just the ability to signal the
process. On a slim runtime image with no JDK tools installed, it may be the only mechanism you
have.

### 5 · `jhsdb jstack` — the one that works when nothing else does

```bash
jhsdb jstack --pid <pid>
jhsdb jstack --mixed --pid <pid>
```

The others all require the JVM to be healthy enough to respond: the attach mechanism and the
signal handler both need the VM to reach a state where it can service the request. **`jhsdb`
does not ask the JVM for anything** — it is the serviceability agent, and it reads the process's
memory from outside, so it works on a JVM that is genuinely wedged and on a core dump.

🔴 **`--mixed` is what you escalate to when a `BLOCKED` thread makes no sense.** It interleaves
native frames with Java frames. The Troubleshooting Guide gives the example of what that reveals:

> ```
> ----------------- t@13 -----------------
> 0xff31e8b8      ___lwp_cond_wait + 0x4
> 0xfea8c810      void ObjectMonitor::EnterI(Thread*) + 0x2b8
> 0xfeac86b8      void ObjectMonitor::enter2(Thread*) + 0x250
> :
> ```
>
> *— JDK 25 Troubleshooting Guide, "No Thread Dump". `ObjectMonitor::enter` frames near the top
> of a stack mean the thread is blocked entering a `synchronized` method or block.*

⚠️ **It pauses the target process while it reads it**, which is why it is an escalation rather
than a default.

## Which to put in the runbook

| Situation | Use |
|---|---|
| **Default, any investigation** | `jcmd <pid> Thread.print -l` |
| **Service uses virtual threads** | `jcmd <pid> Thread.dump_to_file -format=json <file>` |
| **No JDK tools in the container** | `kill -QUIT <pid>`, then read the container log |
| **`jcmd` hangs or the VM does not respond** | `jhsdb jstack --pid <pid>` |
| **A `BLOCKED` thread whose cause is unclear** | `jhsdb jstack --mixed --pid <pid>` |
| **Anything, on a JDK 25 runbook you are writing today** | not `jstack` |

## Two practical wrinkles

**`jcmd` must run as the same user as the target process**, or as root, because it uses the attach
mechanism. In a container the usual pattern is to exec into it — and the tool must be present,
which a JRE-only base image will not have. That is worth checking *before* an incident, because
discovering it during one costs you the dump.

**Capture to a file, always.** A dump is long, you will want to compare it against the next one
([02b](02b-take-three-of-them.md)), and terminal scrollback is not a reliable place to keep an
artefact you may need to attach to a ticket:

```bash
for i in 1 2 3; do jcmd <pid> Thread.print -l > dump-$i.txt; sleep 5; done
```

## Gotchas

**★ `jstack` is experimental and unsupported on JDK 25.**
Its own man page says so, and the Troubleshooting Guide says to use `jcmd` or `jhsdb jstack`
instead. It still works, but a runbook built on it is built on a command the JDK says may vanish.

**★ `Thread.print` without `-l` hides `java.util.concurrent` locks.**
The default shows monitors only. Every `ReentrantLock`, read-write lock and library lock built on
`AbstractQueuedSynchronizer` is invisible without the flag, which can leave you looking at a
waiting thread with no way to see who holds what it waits for.

**★ `Thread.dump_to_file` is not `Thread.print` with a redirect.**
It is a different dump that includes virtual threads and offers JSON. On a service using virtual
threads, `Thread.print` shows the carriers and misses the application's threads.

**★ `SIGQUIT` does not quit the JVM.**
HotSpot handles it by printing a dump and continuing. The name frightens people out of using the
one mechanism that needs no tooling installed.

**★ Signal and console dumps go to the target's stdout, not to you.**
In a container that is the container log. If output was redirected at startup, the guide's own
phrase applies — *"directed to an unknown location"* — and the dump you just took is somewhere
you are not looking.

**★ `jcmd` needs the right user and the tool present.**
It attaches to the process, so it must run as the process's user or as root, and `jcmd` must
exist in the image. A JRE-only base image has no `jcmd`, which is a discovery best made before an
incident rather than during one.

**★ `jhsdb` pauses the target while it reads it.**
That is the price of not asking the JVM to cooperate. It is the right tool for a wedged VM and
the wrong default for a service that is merely slow.

**★ `--mixed` is the escalation for an inexplicable `BLOCKED` thread.**
It interleaves native frames, and `ObjectMonitor::enter` near the top means the thread is blocked
entering a `synchronized` block. Pure Java frames sometimes cannot show you that.

**★ Take the dump to a file.**
It is long, you need to diff it against the next one, and it is evidence. Scrollback is not a
place to keep evidence.

## Interview questions

**★ How do you take a thread dump, and which method would you use on JDK 25?**
`jcmd <pid> Thread.print -l` is the default answer, with `-l` to include
`java.util.concurrent` locks. The alternatives are the Control+Break handler, `SIGQUIT`
(`kill -QUIT`), `jhsdb jstack` and `jstack` — and `jstack` is the one to avoid on 25, because its
man page marks it experimental and unsupported and the Troubleshooting Guide explicitly says to
use `jcmd` or `jhsdb jstack` instead.

**★ Why does `-l` matter?**
Without it the dump shows monitors — locks taken via `synchronized` — but not
`java.util.concurrent` lock ownership. Since most modern code and most libraries use
`ReentrantLock` and other `AbstractQueuedSynchronizer`-based locks, a dump without `-l` can show a
thread parked waiting with nothing indicating who holds the lock. It is the difference between
seeing that there is contention and seeing what is causing it.

**★ What is the difference between `Thread.print` and `Thread.dump_to_file`?**
`Thread.print` writes the classic text dump of platform threads to the caller's output.
`Thread.dump_to_file` writes to a path, supports `-format=json` for a structured dump and
`%p` expansion for the PID — and, decisively, it includes virtual threads. On a service using
virtual threads, `Thread.print` shows only the carriers, so `dump_to_file` is not a convenience
variant but the only complete option.

**★ Does `kill -QUIT` kill the JVM?**
No. HotSpot installs a `SIGQUIT` handler that prints a thread dump to the process's standard
output and continues running. The value is that it needs no JDK tooling in the image and no attach
permission; the catch is that the output goes to the target's stdout — the container log — rather
than to your terminal.

**★ `jcmd` hangs when you try to take a dump. Now what?**
`jhsdb jstack --pid <pid>`. `jcmd` uses the attach mechanism, which needs the VM healthy enough to
respond; if the VM is genuinely wedged it never will. `jhsdb` is the serviceability agent and
reads the process's memory from outside without the VM's cooperation, so it works on a hung JVM
and on a core dump. The cost is that it pauses the target while it reads.

**★ A thread is `BLOCKED` and the Java frames do not explain why. What next?**
`jhsdb jstack --mixed`, which interleaves native frames with Java ones. The Troubleshooting Guide
notes that `ObjectMonitor::enter` frames near the top of the stack mean the thread is blocked
trying to enter a `synchronized` method or block. It also suggests checking `VMThread` — if it is
stuck in `SafepointSynchronize::begin`, the problem may be reaching a safepoint rather than
anything in application code.

**★ You are writing an incident runbook for a JDK 25 service in Kubernetes. What does the thread
dump step say?**
Exec into the pod and run `jcmd <pid> Thread.print -l` three times, five seconds apart, redirected
to files, then copy them out. Add a fallback of `kill -QUIT <pid>` and read the container log for
images without JDK tooling, and an escalation to `jhsdb jstack --pid` if `jcmd` does not return.
If the service uses virtual threads, replace the primary step with
`Thread.dump_to_file -format=json`. And verify before the incident that `jcmd` actually exists in
the image and runs as the right user.

{/* FOOTER */}
