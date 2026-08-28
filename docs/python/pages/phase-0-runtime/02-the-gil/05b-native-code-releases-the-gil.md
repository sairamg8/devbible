---
title: "Native code that releases the lock: why threaded `hashlib` scales, threaded NumPy scales, and your Python byte loop never will"
sidebar_label: "5b · Native code releases it too"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 C-API
> [Thread State and the Global Interpreter Lock](https://docs.python.org/3.14/c-api/threads.html)
> — which names `zlib` and `hashlib` as modules that detach the thread state —
> and [`hashlib`](https://docs.python.org/3.14/library/hashlib.html) for the
> 2047-byte release threshold.
> Target: **CPython 3.14.7**, default (GIL-enabled) build.

**Chunk [5](05-io-releases-the-gil.md) framed the rule as "the GIL is released
around the wait". That framing is the useful 90%, and it is also slightly
wrong, in a way that matters commercially. The actual rule is broader: *code
that does not need the interpreter can release the GIL*. Blocking I/O is the
common case, not the only one. Long-running native computation qualifies too —
which is why "the GIL means Python cannot use more than one core for CPU work"
is false for most of the CPU work real Python programs actually do.**

## The part that ruins the neat story: CPU work that releases it too

The rule is not "I/O releases the GIL". The rule is **"code that does not need
the interpreter can release the GIL"**, and blocking I/O is merely the most
common case. Long-running native computation qualifies just as well, and the
documentation says so directly, naming two standard modules:

> *"the standard `zlib` and `hashlib` modules detach the thread state when
> compressing or hashing data."*

`hashlib` even publishes its threshold:

> *"To allow multithreading, the Python GIL is released while computing a hash
> supplied more than 2047 bytes of data at once in its constructor or `.update`
> method."*

🔴 **So "100 checksums do not speed up" is only true of a checksum you wrote in
Python.** This does scale across cores:

```python
import hashlib, threading

def digest(block: bytes) -> bytes:      # block is, say, 1 MiB
    return hashlib.sha256(block).digest()   # >2047 bytes: GIL released

threads = [threading.Thread(target=digest, args=(block,)) for block in blocks]
```

and this does not:

```python
def checksum(data: bytes) -> int:
    total = 0
    for byte in data:        # a Python loop; the GIL is held for every iteration
        total = (total + byte) % 65521
    return total
```

Same job. Same words in the sentence describing it. Opposite answers, because
one of them spends its time in C with the lock released and the other spends its
time in the interpreter with the lock held.

The same is true of the numeric stack: NumPy, SciPy, Pillow, `lxml`,
`cryptography`, `orjson`, most database drivers' parsing layers and most
compression libraries release the GIL around their heavy native loops. **A
"CPU-bound Python program" that spends 95% of its time inside NumPy is, from the
GIL's point of view, an I/O-bound program.** Threads work there. This is the
single most useful practical consequence in this whole topic, and it is the one
most reliably missed by people who learned "the GIL means threads are useless
for CPU work" and stopped.

### The threshold is a real trap

`hashlib`'s 2047-byte rule is per call, not per total. This hashes the same
bytes and never releases the lock once:

```python
h = hashlib.sha256()
for i in range(0, len(data), 1024):     # 1 KiB at a time: under the threshold
    h.update(data[i:i + 1024])          # GIL held for every single update
```

```python
h = hashlib.sha256()
for i in range(0, len(data), 1 << 20):  # 1 MiB at a time: over the threshold
    h.update(data[i:i + (1 << 20)])     # GIL released for each update
```

Chunk size is a concurrency decision, not just a memory one. The same shape
applies to `zlib`: feed it meaningful blocks, not scraps.

## Gotchas

**Symptom:** `hashlib` in threads scales beautifully in a benchmark and not at
all in production
**Cause:** the benchmark fed it megabytes per `update()`; production streams it
1 KiB at a time, under the 2047-byte threshold, so the lock is never released
**Fix:** buffer up to a real block size before calling `update()`

**Symptom:** a C extension is documented as "fast" but threads do not help
**Cause:** being written in C does not release the GIL — the extension must
*choose* to, with `Py_BEGIN_ALLOW_THREADS`. An extension that manipulates
Python objects throughout has no opportunity to
**Fix:** check the project's documentation or source for the macros. There is no
runtime way to ask "does this function release the GIL"

**Symptom:** a NumPy pipeline parallelises across threads except for one stage,
which serialises everything
**Cause:** that stage dropped back into Python — a list comprehension over an
array, a `for` loop over rows, a Python callback passed into the library. Once
the interpreter is executing bytecode again, the lock is held
**Fix:** find the boundary where the data leaves C. Vectorise the stage, or move
that stage alone to a process pool

**Symptom:** wrapping a `zlib` compression in threads gives no speedup on small
messages
**Cause:** the per-call native work is too short to matter next to the Python
overhead of getting there — the lock is released, but for microseconds
**Fix:** batch. Releasing the lock only helps when the released window is long
enough for another thread to do something with it

**Symptom:** a rewrite from a pure-Python parser to a C parser made a threaded
service dramatically faster, far beyond the single-threaded speedup
**Cause:** this is expected, not suspicious — the rewrite bought both a faster
parse *and* the removal of a serialisation point. The two multiply
**Fix:** none needed. But record why, because the same reasoning tells you which
component to rewrite next

## Interview questions

**Is a checksum CPU-bound or I/O-bound with respect to the GIL?**
It depends entirely on the implementation. `hashlib.sha256` releases the GIL for
any single call given more than 2047 bytes, so it parallelises across threads. A
byte loop written in Python holds the lock throughout and does not. The question
"is this CPU-bound" is the wrong question; the question is "does this call hold
the lock while it runs".

**A colleague says "the GIL means Python can't use more than one core." What is
wrong with that?**
It is true only of Python-level bytecode. Any C extension that releases the lock
around its native work — NumPy, `hashlib`, `zlib`, `cryptography`, most drivers —
uses as many cores as it has threads. And `multiprocessing`, and the
free-threaded build, and any subprocess. The accurate statement is narrower:
*one thread at a time executes Python bytecode in a GIL-enabled interpreter.*

**How would you decide whether threads will help a given CPU-heavy function?**
Find where the time goes. If it is inside a C extension that releases the lock,
threads help and a process pool is unnecessary overhead. If it is inside Python
bytecode, threads cannot help and the choice is between processes, a C-backed
library, or the free-threaded build. Profiling answers this; the task's subject
matter does not.

**Why does `hashlib` have a size threshold at all rather than always releasing?**
Because releasing and reacquiring the lock is not free. For a small input the
handoff would cost more than the hash. The threshold is the point where the
native work is long enough to be worth the round trip — which is also the
principle to apply when deciding your own chunk sizes.

**Can you tell at runtime whether a function releases the GIL?**
Not directly — there is no introspection for it. You infer it from the library's
documentation, from its source (`Py_BEGIN_ALLOW_THREADS`), or empirically, by
checking whether wall-clock time improves with threads on a CPU-saturating
input.

---

← Prev: [Why I/O is the exception](05-io-releases-the-gil.md) · Index: [The GIL](README.md) · Next → [Free-threaded CPython](06-free-threading.md)

