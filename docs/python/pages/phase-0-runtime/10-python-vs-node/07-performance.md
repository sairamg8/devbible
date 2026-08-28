---
title: "Node's JIT beats CPython's interpreter on code written in the language, and for an I/O-bound backend that fact almost never reaches your latency graph"
sidebar_label: "7 · Performance, honestly"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html),
> [PEP 659](https://peps.python.org/pep-0659/) (the specialising adaptive interpreter),
> [PEP 779](https://peps.python.org/pep-0779/), the
> [`timeit`](https://docs.python.org/3.14/library/timeit.html) and
> [`profile`](https://docs.python.org/3.14/library/profile.html) documentation, and the
> [V8 documentation](https://v8.dev/docs). Comparative claims are attributed to their
> sources; none are measurements taken for this page.
> Targets: **Python 3.14.7** · **Node.js 24 LTS**.

**There is one true sentence about raw speed here, and it is narrow: for code written in
the language itself — a tight loop, a hand-rolled parser, string manipulation in a hot
path — V8's optimising JIT is substantially faster than CPython's bytecode interpreter.
Everything people build on top of that sentence is where it goes wrong. A backend spends
its time waiting on a database and a network, not executing your language; Python's hot
paths are deliberately not Python at all; and the "10x" figure in every blog post comes
from a microbenchmark with no I/O in it. This chunk is about holding the true part and
discarding the rest — and about not generating your own bad numbers.**

## What is actually true

**CPython 3.14 executes bytecode in an interpreter loop.** It is a good one — PEP 659's
specialising adaptive interpreter rewrites hot bytecodes into type-specialised versions at
runtime, and 3.14 adds an opt-in tail-call interpreter that What's New reports as a 3–5%
improvement on the `pyperformance` suite when built with Clang 19+ and profile-guided
optimisation. But it is an interpreter, and the JIT work in CPython is still early.

**V8 is a mature optimising JIT.** It profiles, speculates on types, compiles to machine
code, and deoptimises when a guess is wrong. For a numeric loop over monomorphic objects
it produces code in a completely different class from an interpreter.

So for *this* program, Node wins and it is not close:

```python
def collatz_steps(n: int) -> int:      # pure Python, tight loop, no I/O
    steps = 0
    while n != 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        steps += 1
    return steps
```

And for *this* one, the language is irrelevant, because neither runtime is doing the work:

```python
@app.get("/orders/{oid}")
async def get_order(oid: int):
    order = await conn.fetchrow("SELECT ... WHERE id = $1", oid)   # network + disk
    lines = await conn.fetch("SELECT ... WHERE order_id = $1", oid) # network + disk
    return serialize(order, lines)                                  # orjson: C
```

Almost every backend endpoint is the second program.

## The three reasons the gap does not reach production

**1. Your hot code is not Python.** This is the design of the ecosystem, not an excuse.
JSON serialisation goes through `orjson` (Rust). Validation goes through `pydantic-core`
(Rust). Postgres row parsing happens in `asyncpg`'s C protocol implementation. Array maths
is NumPy. Hashing is `hashlib`'s C code, which also releases the GIL. When a Python service
is fast, it is fast for the same reason a Node service using `sharp` for image processing
is fast: the loop is not in the scripting language.

**2. The database dominates.** A single indexed Postgres query on a warm cache is a
round trip; a slightly worse query plan swamps any interpreter difference by orders of
magnitude. Time spent choosing a language on speed grounds is time not spent on the index
that would have mattered.

**3. Both scale the same way.** Both languages run one process per core behind a proxy
([chunk 6](06-packaging-and-deploy.md)). If a Python service needs six containers where a
Node service needs four, that is a real cost — and it is an infrastructure line item,
usually a small one against engineer time, not an architectural problem.

## Where the difference does reach production

Be specific here, because a blanket "it never matters" is as wrong as "Python is slow":

| Workload | Does it matter? |
|---|---|
| CRUD API, DB-bound | **No.** Network and query plan dominate. |
| High-volume JSON transformation in pure Python | **Yes.** Use `orjson`/`msgspec`, or reconsider. |
| A hand-written parser or tokeniser in the hot path | **Yes.** This is exactly the case V8 wins. |
| Per-request template rendering | **Sometimes.** Jinja2 is C-accelerated; measure. |
| Serverless with strict cold-start budgets | **Yes.** See below. |
| Long-lived worker, CPU-bound, pure Python | **Yes** — and the answer is processes, a C library, or a free-threaded build. |
| Anything already in NumPy / PyTorch | **No**, and often Python is faster than naive JS. |

**Cold start** is the one that consistently favours Node in a way teams actually feel.
Python's import machinery executes module-level code for every import in the chain, and a
framework's import graph can be large. This is precisely what
[11 · Startup and import cost](../11-startup-and-import-cost/README.md) is about, and it
is the reason PEP 810's lazy imports (targeting 3.15) matter. If your workload is
short-lived functions with a strict cold-start budget, that is a legitimate,
measurement-backed reason to prefer Node — and it is worth measuring rather than assuming,
because the answer depends entirely on your import graph.

## Measure it properly or do not cite it

Most Python-versus-Node numbers in circulation are unusable, in ways that are easy to
avoid. Before you believe any comparison — including your own:

- **Same layer on both sides.** An ASGI app on `uvicorn` against Fastify, not Flask's
  development server against a tuned Node process. [Chunk 1](01-the-real-question.md)
  has the layer table.
- **Real I/O in the benchmark.** A test with no database in it is measuring a program
  nobody ships.
- **Warm-up.** V8 needs time to reach optimised code; CPython's specialising interpreter
  needs to see the hot path several times. A short run measures start-up, not throughput.
- **p99, not mean.** A mean hides the tail, and the tail is what pages you.
- **Same connection-pool size, same concurrency, same hardware, same kernel.**
- **State the version of both runtimes.** A 3.11-versus-Node-18 result is a historical
  document.

```python
# Micro-timing in Python, done correctly — timeit handles repetition and the
# best-of selection, which a hand-rolled time.time() loop gets wrong.
python -m timeit -s "from mymod import parse" "parse(payload)"
```

```python
# Where the time goes, for a real workload:
python -m cProfile -s cumtime app.py     # deterministic, adds overhead
py-spy record -o profile.svg -- python app.py   # sampling, safe on production
python -X importtime app.py              # startup cost, per import
```

🔴 **Do not repeat a number you did not measure, and do not measure carelessly.** A real
number from a confounded benchmark — a shared database, an unwarmed JIT, a different
connection-pool size on each side — is more damaging than no number, because it looks like
evidence.

## The alternative-implementation caveat

Claims of "Python is 3–4x faster on X" usually refer to alternative implementations, not
CPython, and they carry conditions. Those are covered in
[chunk 8](08-alternatives.md) with their sources and their caveats — the short version is
that PyPy's front page claims *"on average, PyPy is about 3 times faster than CPython
3.11"*, and GraalPy's README states it is *"geomean ~4x faster than CPython on the
official Python Performance Benchmark Suite"*. Both are the projects' own claims about
their own benchmark suites, and neither transfers automatically to a web service whose
time is spent in C extensions and sockets.

## Gotchas

### Benchmarking a development server
**Symptom.** Numbers showing Python an order of magnitude behind.
**Cause.** Flask's or Django's development server against a production Node setup. Those
servers are single-threaded, explicitly documented as not for production, and were never
in the race.
**Fix.** Compare production configurations only: `uvicorn`/`granian` with a real worker
count against Fastify with the same process count, both behind the same proxy.

### Measuring with the JIT cold
**Symptom.** Node looks slower than expected on a short benchmark.
**Cause.** V8 starts in an unoptimised tier and needs the code to be hot before it
compiles. A 200-iteration benchmark measures the interpreter tier.
**Fix.** Warm up, discard the first samples, and run long enough to reach steady state.
The same applies to CPython's specialising interpreter, which needs repeated execution
before it specialises.

### Attributing a database problem to the language
**Symptom.** "We rewrote it in Node and it got 4x faster."
**Cause.** The rewrite usually also fixed an N+1 query, added an index, or replaced a
synchronous driver. The language change is credited with the query change's win.
**Fix.** Profile before rewriting. `EXPLAIN ANALYZE` the top three queries first. If the
service is DB-bound, a rewrite in any language will not move p99, and the rewrite that
appears to has changed something else.

### Reaching for a rewrite when the fix is a library
**Symptom.** A serialisation hot spot triggering a language migration proposal.
**Cause.** Assuming the ceiling of Python is the ceiling of `json` and pure-Python loops.
**Fix.** Change the library first, and measure:

```python
import orjson                       # Rust; drop-in for the common cases
body = orjson.dumps(payload)

import msgspec                      # schema-aware encode/decode, also very fast
```

Those are hours of work against months for a rewrite, and they frequently close the gap
entirely.

### Using `time.time()` for a microbenchmark
**Symptom.** Wildly variable numbers, or a "measurement" of something that got optimised
away.
**Cause.** Wall-clock resolution, no repetition strategy, and no isolation from other
work on the machine.
**Fix.** `timeit` for micro-timing, `perf_counter` if you must hand-roll, and a profiler
rather than timing for anything larger than a single call:

```python
from time import perf_counter       # monotonic, high resolution
```

### Assuming free-threading is free
**Symptom.** Switching to `python3.14t` and finding single-threaded paths slower.
**Cause.** The free-threaded build carries a documented single-threaded penalty — What's
New in 3.14 reports it reduced to roughly 5–10% — which is the price of removing the GIL.
**Fix.** Use it where the workload is genuinely multi-threaded and CPU-bound in Python,
and measure both builds on your own workload before committing. It is a trade, not an
upgrade.

## Interview questions

**Q. Is Node faster than Python?**
A. For code executing in the language itself — a tight loop, a hand-written parser — yes,
substantially, because V8 is an optimising JIT and CPython is a bytecode interpreter. For
an I/O-bound backend, the question rarely reaches the latency graph: both use a
single-threaded event loop, both wait on the same network, and the database dominates.
And Python's hot paths are deliberately C or Rust — `orjson`, `pydantic-core`, `asyncpg`,
NumPy — so the interpreter is not usually on the critical path.

**Q. When have you seen the difference actually matter?**
A. Cold start in serverless, where Python's import graph costs real milliseconds; and
CPU-bound work written in pure Python — a parser, a large transformation — where the
answer is a C or Rust library, a process pool, or a free-threaded build rather than a
language change.

**Q. Someone shows you a benchmark where Node is 10x faster. What do you ask?**
A. What was on each side of the comparison — a development server against a production
one is the usual answer. Whether there was any I/O in the test. Whether both runtimes were
warmed up. Whether it reports p99 or a mean. And what versions: a result against Python
3.11 and Node 18 is a historical document, not current evidence.

**Q. Your Python service is CPU-bound. What do you do, in order?**
A. Profile first — `py-spy` on production, `cProfile` locally — to find where the time
actually goes. Then replace the hot path with a C or Rust-backed library if one exists.
Then move the work to a process pool, or a free-threaded build if the dependency set
supports it. A rewrite in another language is last, because it is the most expensive option
and frequently fixes something that was not the problem.

**Q. What did Python 3.14 do for performance?**
A. An opt-in tail-call interpreter, reported in What's New as a 3–5% improvement on
`pyperformance` with Clang 19+ and PGO. The specialising adaptive interpreter is now
enabled on free-threaded builds too, and the free-threaded single-threaded penalty is down
to roughly 5–10%. None of that changes the fundamental picture against a JIT; it narrows
it.

**Q. How do you profile a Python service in production?**
A. `py-spy`, because it samples another process's stacks without instrumenting it and
without a restart — `py-spy record` for a flame graph, `py-spy dump` for a live stack of
every thread, which is also how you catch a blocked event loop. `cProfile` is for local
work; its overhead makes it unsuitable for production.

**Q. Why is "we rewrote it in X and it got faster" weak evidence?**
A. Because a rewrite changes everything at once — the queries, the data access patterns,
the serialisation library, and usually the architecture, by people who now understand the
domain better than they did the first time. Attributing the improvement to the language
requires holding all of that constant, which a rewrite by definition does not.

---

← Prev: [Packaging and deployment](06-packaging-and-deploy.md) · Index: [Python vs Node](README.md) · Next → [Alternative implementations](08-alternatives.md)

{/* FOOTER */}
