---
title: "The GIL: one thread runs Python bytecode at a time — and every rule you have heard about it has an exception"
sidebar_label: "02 · The GIL"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14
> [glossary entry for *global interpreter lock*](https://docs.python.org/3.14/glossary.html#term-global-interpreter-lock),
> the [`threading` module docs](https://docs.python.org/3.14/library/threading.html),
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html),
> [PEP 703](https://peps.python.org/pep-0703/) and
> [PEP 779](https://peps.python.org/pep-0779/),
> and [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html).
> Version spine: **Python 3.14.7**; free-threaded build officially supported
> (phase II), not the default.

**The Global Interpreter Lock is a mutex inside CPython that only one thread
may hold while executing Python bytecode. That single sentence generates two
enormously consequential facts and about six popular misreadings. The facts:
threads give you no CPU parallelism for Python code, and they give you
excellent concurrency for anything that waits — because every blocking I/O call
releases the lock. The misreadings all descend from the same error, which is
believing the GIL makes your code thread-safe. It never did.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What the GIL is and what it protects](01-what-the-gil-is.md)** | The lock, reference counts, the switch interval, and why a threaded counter is still wrong |
| 2 | **[Why I/O is the exception](02-io-releases-the-gil.md)** | The precise reason 100 HTTP calls speed up and 100 checksums do not, plus which C extensions release the lock |
| 3 | **[Free-threaded CPython](03-free-threading.md)** | PEP 703 and PEP 779, what "officially supported" means in 3.14, how to tell which build you are on, and what it costs |

## The one question this topic exists to answer

> *Why do threads speed up 100 HTTP requests but not 100 checksum
> computations?*

That is the Phase 0 gate, and the answer is exactly three steps long:

1. A thread must hold the GIL to execute Python bytecode.
2. Every blocking I/O call **releases** the GIL before it waits and reacquires
   it afterwards — so 100 sockets can be waiting simultaneously while zero
   threads hold the lock.
3. A checksum loop written in Python holds the GIL continuously, so 100 of them
   serialise onto one core no matter how many cores you own. (Written in C —
   `hashlib` — they release it, and the answer flips.)

Everything else in this topic is that answer with the edges filled in.

## Where this connects

- **[Topic 01](../01-what-python-is/README.md)** is the substrate: the GIL is a
  lock around the interpreter state that
  [the interpreter loop](../01-what-python-is/05-the-interpreter-loop.md)
  manipulates, and reference counting is the main thing it protects.
- **Phase 8 — Concurrency and async** *(not written yet)* is the payoff: this
  model becomes the threads-vs-processes-vs-asyncio decision, `ThreadPoolExecutor`
  vs `ProcessPoolExecutor`, and why `asyncio` exists at all.
- **Phase 13 — Production and performance** *(not written yet)* picks up the
  deployment consequences: worker counts, pre-fork servers, and why a Python web
  server is usually processes-times-threads rather than either alone.

## Phase gate contribution

After this topic you can answer the gate question, name what the GIL protects
and what it never protected, and say precisely what free-threaded CPython 3.14
changes and what it costs — including that it is not the default build and that
C extensions must opt in.

---

← Prev: [What Python is](../01-what-python-is/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [What the GIL is and what it protects](01-what-the-gil-is.md)
