---
title: "What the GIL is and what it protects: one mutex, reference counts, and a 5 ms switch interval"
sidebar_label: "1 · What the GIL is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14
> [glossary entry for *global interpreter lock*](https://docs.python.org/3.14/glossary.html#term-global-interpreter-lock),
> the [`threading` module docs](https://docs.python.org/3.14/library/threading.html),
> [`sys.setswitchinterval`](https://docs.python.org/3.14/library/sys.html#sys.setswitchinterval),
> [What's New in Python 3.2 § Multi-threading](https://docs.python.org/3.14/whatsnew/3.2.html)
> (the 5 ms default), and [PEP 703](https://peps.python.org/pep-0703/).
> Version spine: **Python 3.14.7**.

**The GIL is a mutex that a thread must hold to execute Python bytecode. It
exists to protect the interpreter's own data structures — above all the
reference count on every object — from being corrupted by concurrent access,
and it does that job completely. It is not a coarse lock somebody was lazy
about: it is the direct consequence of choosing non-atomic reference counting
because that is fast in the single-threaded case, which is the case almost all
Python code is. Understanding it as "the price of cheap refcounting" is what
makes everything else about it — including how hard it has been to remove —
make sense.**

## The definition, from the glossary

> *"The mechanism used by the CPython interpreter to assure that only one
> thread executes Python bytecode at a time. This simplifies the CPython
> implementation by making the object model (including critical built-in types
> such as `dict`) implicitly safe against concurrent access. Locking the entire
> interpreter makes it easier for the interpreter to be multi-threaded, at the
> expense of much of the parallelism afforded by multi-processor machines."*

Three things in that paragraph deserve separate emphasis:

- **"only one thread executes Python bytecode at a time"** — not "only one
  thread runs". Threads are real OS threads, scheduled by the OS onto real
  cores. They just queue for one lock before they can advance a Python
  instruction.
- **"implicitly safe against concurrent access"** applies to *the object
  model*, not to your program. A `dict` will not be corrupted into an unusable
  state by two threads writing it. Whether the *values* you wrote make sense is
  entirely your problem — [chunk 2](02-the-gil-is-not-thread-safety.md).
- **"at the expense of much of the parallelism"** — the trade is stated in the
  definition itself. Implementation simplicity, bought with CPU parallelism.

And the operative implementation note, from `threading`:

> *"CPython implementation detail: In CPython, due to the Global Interpreter
> Lock, only one thread can execute Python code at once (even though certain
> performance-oriented libraries might overcome this limitation). If you want
> your application to make better use of the computational resources of
> multi-core machines, you are advised to use `multiprocessing` or
> `concurrent.futures.ProcessPoolExecutor`. However, threading is still an
> appropriate model if you want to run multiple I/O-bound tasks
> simultaneously."*

That parenthetical — *"certain performance-oriented libraries might overcome
this limitation"* — is the hinge on which the whole practical story turns, and
it gets its own chunk.

## What it actually protects

The GIL is not there for your data. It is there for CPython's.

**Reference counts, first and foremost.** Every object carries an integer count
that is incremented and decremented constantly — merely binding a name touches
it, and so does passing an argument, appending to a list, or returning a value.
Those increments are not atomic operations on their own. Making them atomic
with CPU primitives (a `lock xadd` per touch) is meaningfully slower on the
single-threaded path that almost all Python code takes, so CPython instead
guards all of it with one mutex.

The failure mode if it did not is worth being concrete about. If two threads
decrement a count simultaneously and one update is lost, the count reaches zero
while a live reference still exists. The object is freed. The next access is a
use-after-free — a segfault or silent memory corruption, not a Python
exception. That is a categorically worse failure than any application-level
race, and it is what the GIL is buying.

**Everything else that is interpreter-internal**: the memory allocator's free
lists, the interned-string table, type caches and method resolution caches, the
import machinery. And, per the glossary, the built-in container types, which
cannot be *structurally* corrupted by concurrent mutation.

## Why it has been so hard to remove

Because removing it means replacing the guarantee, not just deleting a lock.
PEP 703's design needs biased reference counting (fast path for the owning
thread, slow path for others), deferred reference counting for objects like
function and type objects that every thread touches, immortal objects that are
never counted at all, per-object locking for containers, and a different memory
allocator (mimalloc). PEP 703 also states the compatibility consequence
plainly:

> *"CPython builds without the GIL will not be ABI compatible with the standard
> CPython build or with the stable ABI due to changes to the Python object
> header needed to support biased reference counting. C-API extensions will
> need to be rebuilt specifically for this version."*

Every prior attempt — Greg Stein's free-threading patch in the 1990s, the
"Gilectomy" — produced an interpreter that worked and was substantially slower
single-threaded. That is why PEP 779 (see
[chunk 6](06-free-threading.md)) set an explicit, numeric performance budget as
a condition of official support rather than leaving it to judgement.

## The switch interval

The GIL is not held until a thread finishes its work. A running thread is asked
to drop it periodically so others get a turn. From What's New in 3.2, which
introduced the current mechanism:

> *"The notion of a 'check interval' to allow thread switches has been
> abandoned and replaced by an absolute duration expressed in seconds. This
> parameter is tunable through `sys.setswitchinterval()`. It currently defaults
> to 5 milliseconds."*

Two caveats from the `sys` documentation, and both matter operationally:

> *"Please note that the actual value can be higher, especially if long-running
> internal functions or methods are used. Also, which thread becomes scheduled
> at the end of the interval is the operating system's decision. The
> interpreter doesn't have its own scheduler."*

- **A single long GIL-holding C call blocks everyone.** If a thread enters a C
  function that does not release the GIL and runs for 400 ms, every other
  Python thread is stopped for 400 ms. The switch interval cannot preempt it —
  the request to drop the lock is only checked between bytecodes, and that
  thread is not executing bytecodes. This is the mechanism behind "our async
  event loop stalled".
- **CPython does not schedule threads.** It only signals "please drop the
  lock"; the OS decides who gets it next, with no fairness guarantee and no
  priority. The thread that just released it can immediately reacquire it.

Tuning `setswitchinterval` is almost never the answer. Lowering it increases
switching overhead and hurts cache locality; raising it increases latency for
waiting threads. If you are reaching for it, the real problem is usually an
operation that holds the GIL too long and belongs in a process or in a C
library that releases the lock.

## What the GIL is not

- **It is not a language feature.** Both the glossary and `threading` mark it a
  CPython implementation detail. Jython and IronPython have never had one; PyPy
  has one; free-threaded CPython 3.14 can run without one.
- **It is not one lock per object.** It is one lock for the whole interpreter —
  which is precisely why it is called *global*. Sub-interpreters (PEP 684,
  PEP 734) give each interpreter its own, which is a different mechanism with
  a different set of trade-offs.
- **It is not held during I/O.** That is
  [chunk 5](05-io-releases-the-gil.md), and it is the single most useful thing
  to know about it.
- **It does not make your code thread-safe.** That is
  [chunk 2](02-the-gil-is-not-thread-safety.md), and it is the single most
  commonly believed falsehood about it.
- **It is not why Python is "slow".** Single-threaded speed is about
  interpreter dispatch —
  [topic 01, chunk 5](../01-what-python-is/05-the-interpreter-loop.md). The GIL
  costs you *scaling across cores*, not per-thread speed.

## Gotchas

**Symptom:** an `asyncio` event loop stops responding for hundreds of milliseconds at a time
**Cause:** a CPU-bound or otherwise GIL-holding call ran on the event loop thread. The switch interval cannot preempt a C function that never releases the lock, and pure-Python CPU work simply monopolises it
**Fix:** move it off — `asyncio.to_thread` / `loop.run_in_executor` if the call releases the GIL, or a `ProcessPoolExecutor` if it is pure Python CPU work. Nothing about the event loop can rescue a blocked thread

**Symptom:** `sys.setswitchinterval()` was lowered to "improve responsiveness" and throughput got worse
**Cause:** every switch costs a lock handoff and system calls, and destroys CPU cache locality. More switches means more overhead
**Fix:** revert it. The switch interval is a rarely-correct knob; fix the operation that holds the GIL for too long instead

**Symptom:** a thread that should be getting CPU time appears to starve while another spins
**Cause:** CPython has no scheduler of its own — it signals a request to drop the lock, and the OS chooses the next holder. The releasing thread can immediately reacquire it
**Fix:** never build a design that depends on thread fairness. Distribute work explicitly through a `queue.Queue` rather than hoping the scheduler does it for you

**Symptom:** a C extension author reports their module "randomly segfaults" when used from threads
**Cause:** they released the GIL around a call and then touched a `PyObject` — including a refcount — without holding it again
**Fix:** the C-API contract is absolute: no `PyObject` access without the GIL held (or, in free-threaded builds, an attached thread state). `Py_BEGIN_ALLOW_THREADS` must bracket only work that touches no Python objects

**Symptom:** someone claims "Python can't do threads"
**Cause:** conflating CPU parallelism with concurrency. Python threads are real OS threads and are genuinely concurrent for anything that waits
**Fix:** the accurate statement is "CPython threads do not run Python bytecode in parallel." For I/O they are excellent, which is chunk 3

**Symptom:** a design that assumed one process per core, with threads inside, does not use the cores
**Cause:** threads inside one process share one GIL, so N threads doing Python work give you one core's worth of Python execution regardless of N
**Fix:** processes for CPU parallelism, threads for waiting. A typical Python web deployment is *processes × threads*: enough processes to fill the cores, threads inside each for the I/O concurrency

**Symptom:** profiling a multithreaded program shows total CPU near 100% of *one* core no matter how many threads are added
**Cause:** exactly the expected behaviour for GIL-bound Python work — you are measuring the lock
**Fix:** this is the diagnosis, not the bug. Either move the work to processes, find a C library that releases the lock, or evaluate the free-threaded build

## Interview questions

**★ What is the GIL and why does CPython have it?**
A mutex that a thread must hold in order to execute Python bytecode, so only
one thread advances Python code at a time. It exists primarily to protect
reference counts: every object carries a count modified on essentially every
operation, and making each modification individually atomic would slow down the
single-threaded case that most Python code is. One global lock buys correctness
for the whole object model cheaply — the glossary describes it as making the
object model "implicitly safe against concurrent access" — at the documented
cost of "much of the parallelism afforded by multi-processor machines."

**★ What exactly does the GIL protect?**
CPython's own state. Reference counts above all: a lost decrement means the
object is freed while still referenced, and the next access is a use-after-free
segfault rather than a Python exception. Beyond that, the memory allocator's
internal structures, the interned-string table, type and method caches, the
import machinery, and the built-in containers, which cannot be structurally
corrupted by concurrent mutation. It is an interpreter-integrity mechanism.

**★ How often do threads switch, and can I control it?**
CPython asks the running thread to drop the lock after a switch interval, which
has defaulted to 5 milliseconds since the 3.2 rewrite and is readable and
writable via `sys.getswitchinterval()` / `sys.setswitchinterval()`. Two caveats
from the docs: the actual interval can be longer if a long-running internal
function is executing, and CPython has no scheduler of its own — which thread
gets the lock next is the OS's decision, and the releasing thread may
immediately reacquire it. Tuning the interval is almost never the right fix.

**★ Why has the GIL been so hard to remove?**
Because it is not a lazy coarse lock — it is the consequence of using
non-atomic reference counting, itself a deliberate single-thread performance
choice. Removing it means replacing that guarantee everywhere: PEP 703 needs
biased reference counting, deferred reference counting, immortal objects,
per-object locking for containers, and a different allocator. It also breaks
ABI compatibility, so every compiled extension must be rebuilt — PEP 703 says
so explicitly. Every earlier attempt produced a working interpreter that was
substantially slower single-threaded, which is why PEP 779 set a numeric
performance budget as a condition of official support.

**Is the GIL part of the Python language?**
No. Both the glossary and the `threading` documentation frame it as a CPython
implementation detail. Jython and IronPython have never had one, PyPy has one,
and CPython 3.13 introduced a build without one which 3.14 made officially
supported. "Python has a GIL" is a claim about one implementation's default
build.

**Why does adding threads to a CPU-bound Python program not use more cores?**
Because all of those threads must hold the same lock to execute bytecode, so
they take turns on one core's worth of Python execution while paying the
overhead of switching between them — which is why a threaded CPU-bound program
is often *slower* than the single-threaded version. Real cores need real
processes (`multiprocessing`, `ProcessPoolExecutor`), a C library that releases
the lock, or the free-threaded build.

**Why does a long-running C call freeze every other thread even though the switch interval is 5 ms?**
Because the switch request is checked between bytecode instructions, and a
thread inside a C function is not executing bytecode. If that C function does
not voluntarily release the GIL, it holds it for its entire duration and
nothing can preempt it. This is the difference between a well-behaved extension
(which brackets its work with `Py_BEGIN_ALLOW_THREADS`) and one that stalls the
whole process.

**How does a sub-interpreter differ from a thread with respect to the GIL?**
Since PEP 684, each sub-interpreter can have its own GIL, so two
sub-interpreters can execute bytecode simultaneously in one process — which
threads within a single interpreter cannot. PEP 734 exposed this through a
standard-library module in 3.14. The cost is that sub-interpreters do not share
objects, so communication looks more like message passing between processes
than like shared memory between threads.

---

← Index: [The GIL](README.md) · Next → [The GIL is not thread safety](02-the-gil-is-not-thread-safety.md)
