---
title: "fork was never safe in a threaded process, and forkserver is the compromise that bought back its speed at the price of the guard"
sidebar_label: "4c · fork, threads and forkserver"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`os.fork`](https://docs.python.org/3.14/library/os.html#os.fork),
> [`multiprocessing`](https://docs.python.org/3.14/library/multiprocessing.html)
> (Contexts and start methods; Programming guidelines § All start methods and
> § The spawn and forkserver start methods),
> and [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html).
> Version spine: **CPython 3.14.7**.

**The 3.14 default change was not a stylistic preference. `fork()` in a process
that has threads has never been safe on POSIX, CPython has emitted a
`DeprecationWarning` for it since 3.12, and the failure mode is a deadlock in a
child that inherited a lock held by a thread that no longer exists. `forkserver`
exists to keep fork's speed while forking from a process that is guaranteed to
be single-threaded — and the price of that safety is that its children start
from a clean interpreter, which is exactly why the guard became mandatory on
Linux.**

## Why forking a threaded process is unsafe

The `os.fork` documentation is unusually forthcoming, and this passage is worth
reading twice:

> *Changed in version 3.12: If Python is able to detect that your process has
> multiple threads, `os.fork()` now raises a `DeprecationWarning`. We chose to
> surface this as a warning, when detectable, to better inform developers of a
> design problem that the POSIX platform specifically notes as not supported.
> Even in code that appears to work, it has never been safe to mix threading
> with `os.fork()` on POSIX platforms. The CPython runtime itself has always
> made API calls that are not safe for use in the child process when threads
> existed in the parent (such as malloc and free).*

> *Users of macOS or users of libc or malloc implementations other than those
> typically found in glibc to date are among those already more likely to
> experience deadlocks running such code.*

The mechanism, stated plainly: `fork()` duplicates the process's memory but only
**one** thread — the caller. Every other thread vanishes, and any lock those
threads held is duplicated in its held state, with no owner left to release it.
The child then calls something that takes that lock — the allocator's arena
lock, the logging module's handler lock, a connection pool's mutex — and blocks
forever. Nothing in the child is corrupt in an inspectable way; it simply never
returns.

macOS has an additional, sharper version of the problem, from the
`multiprocessing` docs:

> *Changed in version 3.8: On macOS, the spawn start method is now the default.
> The fork start method should be considered unsafe as it can lead to crashes of
> the subprocess as macOS system libraries may start threads.*

That is the killer detail: **you do not have to start the threads yourself.**
`urllib`, Core Foundation, a GUI toolkit, an ML library's thread pool, or the
allocator can all have threads running before your first line executes.

## What `forkserver` does differently

> *"When the program starts and selects the forkserver start method, a server
> process is spawned. From then on, whenever a new process is needed, the parent
> process connects to the server and requests that it fork a new process. The
> fork server process is single threaded unless system libraries or preloaded
> imports spawn threads as a side-effect so it is generally safe for it to use
> `os.fork()`. No unnecessary resources are inherited."*

The trick is *when* the fork happens. The server is spawned early, before your
application has created threads, and stays single-threaded; every worker is
forked from it rather than from your process. You keep fork's cheap process
creation and lose the inherited-thread-state hazard. What you also lose — and
this is why the guard is now needed on Linux — is the inherited *memory*: a
forkserver child is a clean interpreter, so it must re-import your main module
to find your functions.

`set_forkserver_preload(["numpy", "myapp.models"])` recovers some of the lost
sharing: those modules are imported once in the server, and every forked worker
inherits them already loaded.

## The resource tracker

> *"On POSIX using the spawn or forkserver start methods will also start a
> resource tracker process which tracks the unlinked named system resources
> (such as named semaphores or `SharedMemory` objects) created by processes of
> the program. When all processes have exited the resource tracker unlinks any
> remaining tracked object. Usually there should be none, but if a process was
> killed by a signal there may be some 'leaked' resources."*

Which is why moving from fork to forkserver adds a process to your `ps` output
that was not there before, and why `SIGKILL`ing a worker can produce a warning
about a leaked semaphore at shutdown.

## Gotchas

### `DeprecationWarning` from `os.fork` in a threaded process

**Symptom.** A `DeprecationWarning` naming `os.fork` from code that has worked
for years.
**Cause.** Since 3.12 CPython warns when it can detect that the forking process
has multiple threads. It is telling you about *"a design problem that the POSIX
platform specifically notes as not supported."*
**Fix.** Stop using the `fork` start method — which on 3.14 means stop asking
for it explicitly, since it is no longer any platform's default.

### A forked child hangs forever with no CPU use

**Symptom.** A worker that never produces a result and cannot be interrupted;
`py-spy dump` shows it blocked acquiring a lock.
**Cause.** The lock was held by a thread in the parent at the moment of the
fork. That thread does not exist in the child, so the lock is never released.
**Fix.** `forkserver` or `spawn`. There is no in-child workaround;
`os.register_at_fork` can reset *your* locks but not the ones inside libc, the
allocator, or a third-party C library.

### macOS crashes in a forked child, in code that never started a thread

**Symptom.** A crash inside a system framework, typically after a network or
GUI call in the child.
**Cause.** The docs: *"macOS system libraries may start threads."* Your process
was multi-threaded before your code ran.
**Fix.** Nothing to fix — macOS has defaulted to `spawn` since 3.8. Do not
override it.

### A leaked semaphore warning at shutdown

**Symptom.** A message about leaked semaphore objects when the program exits.
**Cause.** The resource tracker unlinks named resources at shutdown, and reports
any that outlived the process that created them — usually because a worker was
killed by a signal.
**Fix.** Shut pools down cleanly (`with` blocks, `shutdown(wait=True)`) and stop
`SIGKILL`ing workers. The docs note leaked semaphores and shared memory segments
*"will not be automatically unlinked until the next reboot."*

## Interview questions

**★ Why is `fork()` unsafe in a process that has threads?**
Because `fork()` duplicates the memory but only the calling thread. Locks held
by the other threads are duplicated in a held state with no owner to release
them, so the child deadlocks the moment it touches one — and that includes locks
inside the allocator and libc, not just yours. The `os.fork` docs state that
*"it has never been safe to mix threading with `os.fork()` on POSIX platforms"*
and that *"the CPython runtime itself has always made API calls that are not
safe for use in the child process when threads existed in the parent (such as
malloc and free)"*. Since 3.12 CPython raises a `DeprecationWarning` when it can
detect the situation.

**★ What does `forkserver` do that makes it safe, and what does it cost?**
It spawns a small server process early, while the program is still
single-threaded, and forks every worker from *that* instead of from your
process. The docs describe the server as *"single threaded unless system
libraries or preloaded imports spawn threads as a side-effect so it is generally
safe for it to use `os.fork()`"*. The cost is that workers no longer inherit
your process's memory: they start from a clean interpreter and must re-import
the main module, which is why the `if __name__ == "__main__":` guard became
mandatory on Linux in 3.14.

**What is the resource-tracker process I now see under 3.14 on Linux?**
It is started by the spawn and forkserver start methods to track named system
resources — semaphores, `SharedMemory` segments — and unlink any that remain
when all processes have exited. It was always there on Windows and macOS; the
Linux default change made it visible. It is also the source of the "leaked
semaphore" warning you get after a worker is killed by a signal.

---

← Prev: [What the child does to __main__](04b-what-the-child-does-to-main.md) · Index: [if __name__ == "__main__"](README.md) · Next → [Python vs Node for a backend](../10-python-vs-node/README.md)
