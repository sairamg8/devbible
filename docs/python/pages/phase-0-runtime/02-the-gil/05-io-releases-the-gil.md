---
title: "Why I/O is the exception: the GIL is released around the wait, which is why 100 HTTP calls speed up and a Python loop never does"
sidebar_label: "5 · Why I/O is the exception"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 C-API
> [Thread State and the Global Interpreter Lock](https://docs.python.org/3.14/c-api/threads.html)
> (the `Py_BEGIN_ALLOW_THREADS` / `Py_END_ALLOW_THREADS` macros, their expansion,
> and the named `zlib` / `hashlib` examples),
> [`hashlib`](https://docs.python.org/3.14/library/hashlib.html) for the 2047-byte
> release threshold, the
> [glossary entry for *global interpreter lock*](https://docs.python.org/3.14/glossary.html#term-global-interpreter-lock)
> and the [`threading` module docs](https://docs.python.org/3.14/library/threading.html).
> Target: **CPython 3.14.7**, default (GIL-enabled) build.

**Chunk [1](01-what-the-gil-is.md) established that only one thread executes
Python bytecode at a time. If that were the whole story, threads would be
useless. They are not useless — they are the standard answer to a few hundred
concurrent HTTP calls — and the reason is a single mechanism: a thread that is
about to wait for something other than the CPU gives the lock away first. The
GIL is held while your code *runs*, not while it *waits*. Everything people
find confusing about "when do threads help" is a consequence of that one
sentence — including the part, in chunk
[5b](05b-native-code-releases-the-gil.md), where a checksum does speed up after all.**

## The mechanism, not the folklore

"I/O releases the GIL" is usually taught as a rule handed down from nowhere. It
is not a rule; it is what the C code does, and the C-API documentation states
the pattern in the open. Most extension code that blocks has this shape:

```c
Py_BEGIN_ALLOW_THREADS
... Do some blocking I/O operation ...
Py_END_ALLOW_THREADS
```

Those macros are not magic. They expand to a save and a restore of the calling
thread's state:

```c
{ PyThreadState *_save; _save = PyEval_SaveThread();
   ... Do some blocking I/O operation ...
  PyEval_RestoreThread(_save); }
```

and the documentation explains exactly what that buys:

> *"By detaching the thread state, the GIL is released, which allows other
> threads to attach to the interpreter and execute while the current thread
> performs blocking I/O. When the I/O operation is complete, the old thread
> state is reattached by calling `PyEval_RestoreThread()`, which will wait
> until the GIL can be acquired."*

So the sequence for `sock.recv(4096)` is: hold the GIL → enter the C function →
**release the GIL** → make the blocking `recv` syscall → the kernel parks this
thread → *another Python thread acquires the GIL and runs* → data arrives →
this thread waits to reacquire the GIL → returns the bytes to your Python code.

The window in which the lock is free is exactly the window in which this thread
was going to be doing nothing anyway. That is the whole trick. Nothing is
overlapped that could not have been overlapped; the thread simply stops
squatting on a lock it has no use for.

⚠️ **Note the last step.** Reacquiring is not instant — the thread joins the
queue for the GIL like everyone else. A thread returning from I/O can sit
waiting on the lock behind a CPU-bound thread that is mid-interval. This is why
adding one CPU-heavy thread to an otherwise healthy I/O thread pool degrades
*latency* for every other thread, and why the effect is so often misdiagnosed
as "the network got slow".

## The two workloads, side by side

This is the Phase 0 gate question, and it is worth writing both halves out.

```python
import threading, time, urllib.request

URLS = ["https://example.com/"] * 100

def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read()

# Threaded: each thread spends ~all of its time inside a blocking socket read,
# with the GIL released. 100 waits overlap. Wall clock ~= the slowest request,
# not the sum of all of them.
threads = [threading.Thread(target=fetch, args=(u,)) for u in URLS]
for t in threads: t.start()
for t in threads: t.join()
```

```python
import threading

def count(n):
    total = 0
    for i in range(n):        # pure Python bytecode, start to finish
        total += i
    return total

# Threaded: every one of these threads needs the GIL to execute a single
# bytecode. They take turns at the switch interval. Wall clock >= the
# single-threaded time, plus switching overhead. There is no win available.
threads = [threading.Thread(target=count, args=(10_000_000,)) for _ in range(4)]
for t in threads: t.start()
for t in threads: t.join()
```

**The distinction is not "I/O vs CPU" as categories of task. It is: during this
call, is the interpreter executing Python bytecode?** If yes, the lock is held
and nothing else runs. If the thread is parked in a syscall, or inside C code
that opted out, the lock is free.

## What "I/O-bound" actually means

The useful definition is mechanical, not thematic: **a workload is I/O-bound to
the extent that its wall-clock time is spent waiting on something that is not
this CPU.** A disk. A socket. Another process. A lock. A timer.

Things that release the GIL while they wait, in the standard library:

| Operation | Waits on |
|---|---|
| `socket.recv` / `send`, and everything built on them — `urllib`, `requests`, `httpx`, database drivers | The network peer |
| File reads and writes, `os.read`, `os.write` | The filesystem / block device |
| `time.sleep()` | A timer |
| `subprocess` waiting on a child, `os.waitpid` | Another process |
| `threading.Lock.acquire()`, `Queue.get()`, `Event.wait()`, `Thread.join()` | Another thread |
| `select`, `poll`, `epoll` | Any of the above |

That last row is the reason `threading.Lock` does not deadlock the whole
interpreter: blocking on a lock releases the GIL, so the thread that holds the
lock is free to run and eventually release it.

⚠️ **There is no exhaustive published list** of which standard-library calls
release the GIL. The C-API page states the guidance and names `zlib` and
`hashlib` as examples; individual module docs mention it only occasionally
(`hashlib` does, with a number — see chunk
[5b](05b-native-code-releases-the-gil.md)). Treat the table above as the
reliable core, and treat any specific claim beyond it as something to check in
the CPython source rather than assume.

## Why asyncio exists, if threads already handle I/O

A fair question, given the above. Threads genuinely do solve I/O concurrency
under the GIL. What they cost is:

- **Memory and setup per task.** Each thread carries an OS stack (commonly
  8 MiB of reserved address space on Linux, committed lazily). Ten thousand
  threads is a bad idea; ten thousand coroutines is routine.
- **Preemption you did not ask for.** A thread can be switched out between any
  two bytecodes, which is precisely what makes chunk
  [2](02-the-gil-is-not-thread-safety.md)'s races possible. `await` points are
  visible in the source, so the set of places state can change under you is
  finite and readable.
- **Switching overhead** at scale, both the OS context switch and the GIL
  handoff.

What threads give you in exchange is that **everything works unmodified** — any
blocking library, any driver, any C extension. asyncio requires the whole call
chain to be async-aware, and one synchronous database call inside a coroutine
stalls the entire event loop. That trade — "threads: universal but heavy;
asyncio: light but demands an async ecosystem" — is Phase 8's subject. What
Phase 0 owes you is the reason both are viable at all: **the GIL is not held
during the wait.**

## Gotchas

**Symptom:** a `ThreadPoolExecutor` over 200 URLs is barely faster than a loop
**Cause:** the work per task is dominated by Python-level parsing or object
construction after the response arrives, not by the wait itself
**Fix:** measure the split before choosing a tool. If the response body is
parsed by a Python-level parser, that half is serialised no matter how many
threads you add. Move the parsing to a process pool, or to a C-implemented
parser that releases the lock (`orjson` over a pure-Python JSON path)

**Symptom:** adding a background thread that does light CPU work makes API
latency spike for every request
**Cause:** the CPU thread holds the GIL for a full switch interval at a time,
and I/O threads returning from their syscall must queue behind it to reacquire
**Fix:** move that work to a separate process. This is the convoy effect and it
cannot be tuned away; `sys.setswitchinterval` trades throughput for latency but
does not remove the queue

**Symptom:** a file copy loop in threads shows no speedup
**Cause:** the underlying device is the bottleneck, not the GIL. Releasing the
lock lets other *Python* threads run; it does not make the disk faster
**Fix:** confirm the resource you are actually contending for before blaming the
interpreter. Concurrency helps latency-bound waits, not bandwidth-bound ones

**Symptom:** `time.sleep(0)` used as a "yield to other threads" does nothing
reliable
**Cause:** it is not a documented scheduling primitive. Sleeping releases the
lock, but a zero sleep gives no guarantee about who runs next, and the OS
scheduler and the GIL handoff both get a say
**Fix:** if the goal is fairness, restructure the work. If the goal is to let a
different thread make progress, use an actual synchronisation primitive

## Interview questions

**Why do threads speed up 100 HTTP requests but not 100 Python loops?**
Because the GIL is released around the blocking syscall, not around bytecode
execution. Each HTTP thread spends nearly all its wall-clock time parked in
`recv` with the lock free, so the waits overlap. Each loop thread needs the lock
to execute every bytecode, so they take turns and the total is unchanged.

**What does `Py_BEGIN_ALLOW_THREADS` actually do?**
It saves the current thread state into a local variable via `PyEval_SaveThread()`,
which detaches the thread state and thereby releases the GIL. `Py_END_ALLOW_THREADS`
calls `PyEval_RestoreThread()`, which blocks until the GIL can be reacquired.
Between the two, the thread must not touch any Python object or call any
C-API function.

**If threads handle I/O concurrency fine, why does asyncio exist?**
Cost and control. Threads cost an OS stack each and can be preempted between any
two bytecodes; coroutines are cheap enough to have tens of thousands, and their
suspension points are visible in the source. The trade is that asyncio requires
the whole stack to be async-aware, whereas threads work with any blocking
library unmodified.

**Does releasing the GIL make the I/O itself faster?**
No. It makes *other Python threads* able to run during the wait. If the
bottleneck is disk bandwidth or the remote server, releasing the lock changes
nothing about that resource — a point worth making before anyone reaches for
threads to fix a saturated device.

**Why can a thread returning from I/O still be slow to resume?**
Because `PyEval_RestoreThread` waits until the GIL can be acquired. If a
CPU-bound thread holds it, the returning thread waits for at least the remainder
of that thread's switch interval. Under the GIL, I/O completion and Python
resumption are two different events.

---

← Prev: [Lock discipline and testing for races](04-lock-discipline-and-testing.md) · Index: [The GIL](README.md) · Next → [Native code that releases the lock](05b-native-code-releases-the-gil.md)
