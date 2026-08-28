---
title: "PyPy and GraalPy are real and you will probably still deploy CPython — because the thing that makes Python fast is the C extension ecosystem that alternative implementations struggle with"
sidebar_label: "8 · Alternative implementations"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against [pypy.org](https://pypy.org/) and its
> [Python compatibility page](https://pypy.org/compat.html), the
> [GraalPy README](https://github.com/oracle/graalpython) and
> [graalpy.org](https://www.graalpy.org/), the [Deno
> documentation](https://docs.deno.com/runtime/) and [Bun
> documentation](https://bun.com/docs).
> **Every performance figure below is the project's own published claim about its own
> benchmark suite, attributed as such — none is a measurement taken for this page.**
> Targets: **Python 3.14.7** · **Node.js 24 LTS**.

**Both languages have a small field of alternative runtimes that are faster on paper, and
in both cases the default implementation keeps winning deployments for the same reason:
compatibility with the ecosystem is worth more than a benchmark multiple. On the Python
side, PyPy's JIT genuinely transforms pure-Python code and then meets the wall that most
production Python spends its time inside C extensions, which is precisely the case PyPy
handles least well. On the Node side, Deno and Bun are the mirror image. This is
recognition-level material — you should be able to say what each one is, what it claims,
and why you would not reach for it by default.**

## PyPy

**What it is.** A Python implementation with a tracing JIT, written in RPython. It has
been the serious alternative implementation for well over a decade.

**What it claims.** Its front page states: *"On average, PyPy is about 3 times faster than
CPython 3.11."* That is PyPy's own claim about its own benchmark set, and the honest
reading is "on pure-Python-heavy workloads that resemble those benchmarks".

**Version.** The site states it *"currently support python 3.11 and 2.7"* — so it trails
CPython by a few releases, which is itself a deployment consideration if you want 3.14's
free-threading, template strings or lazy annotations.

**Where it is genuinely the right answer.** Long-running, pure-Python, CPU-bound
work — a simulation, a compiler, a large batch transformation written in Python rather
than delegated to a library. The JIT needs a warm-up period, so short-lived processes get
the cost without the benefit.

**Why you probably still deploy CPython.** The compatibility page is direct about the
C API: modules that use it *"will probably work, but will not achieve a speedup via the
JIT"*, and PyPy encourages library authors toward **CFFI** and **HPy** instead. Since a
typical production Python service spends its time in exactly those C extensions —
`asyncpg`, `pydantic-core`, `orjson`, NumPy — the JIT has little pure-Python left to
optimise.

**The semantic differences that break real code.** PyPy does not use reference counting,
so finalisation is not immediate:

```python
open("filename", "w").write("stuff")   # ❌ on PyPy, may not flush when you expect
```

```python
with open("filename", "w") as f:       # ✅ deterministic on every implementation
    f.write("stuff")
```

The same applies to generators — the compatibility page notes you must `close()` a
non-exhausted generator for its pending `finally` or `with` clauses to run immediately —
and to file descriptors, where a program that leaks unclosed files hits system limits
sooner than on CPython. PyPy's memory reporting also looks high in monitoring tools,
because unused pages are marked for lazy reclamation rather than returned to the OS
immediately.

**The transferable lesson:** code that relies on CPython's refcounting for cleanup is
already latently buggy. Writing `with` blocks everywhere is correct on CPython and
*required* everywhere else.

## GraalPy

**What it is.** Oracle's Python on the GraalVM stack — *"a high-performance embeddable
Python 3 runtime"*, per its own site.

**What it claims.** The README states it is *"a Python 3.12 compliant runtime"* and that
*"GraalPy is geomean ~4x faster than CPython on the official Python Performance Benchmark
Suite"*, adding that *"Pure Python code is often faster than on CPython after JIT
compilation"* and that *"C extension performance is near CPython, but varies depending on
the specific interactions of native and Python code."* Again: the project's own claim
about a standard suite, not a measurement of your service.

**Where it is genuinely the right answer.** Embedding Python inside a JVM application, and
polyglot work — the site advertises using *"Python packages directly in Java, Kotlin, or
Scala"*, scripting JVM applications with Python, using Java libraries from Python, and
upgrading old Jython projects to Python 3. If you have a Java platform and want Python in
it without a subprocess or a network hop, this is the tool that exists for that.

**Why you probably still deploy CPython.** The README describes native extension support
as *"considered experimental"*, while noting that packages like NumPy and PyTorch can
already be installed. Experimental support for the exact dependencies a production service
depends on is not a place to start.

## The Node-side parallel

Worth knowing because the dynamic is identical, and because an interviewer may test
whether you know the comparison runs both ways.

**Deno** — *"an open source JavaScript, TypeScript, and WebAssembly runtime with secure
defaults and a great developer experience."* Its distinguishing feature is a permission
sandbox: *"Code runs in a sandbox with no file, network, or environment access until you
grant it."* It runs `.ts` files directly — *"No `tsc`, no build step, no config"* — and it
now accommodates the npm world: *"Drop Deno into a repo with `package.json` and
`node_modules` and it just runs; mix `npm:` imports with native ES modules as you
migrate."*

**Bun** — *"an all-in-one toolkit for developing modern JavaScript/TypeScript
applications"*, positioned as *"a faster, leaner, more modern replacement for Node.js."*
It is written in Rust and powered by **JavaScriptCore** (Apple's engine, from Safari)
rather than V8, and it bundles a runtime, package manager, bundler and Jest-compatible
test runner in one binary. On Node compatibility, its docs say it *"aims for full
compatibility with built-in Node.js globals … and modules"* while noting *"This is an
ongoing effort."*

**The parallel is exact.** Both are faster on their own benchmarks, both are pleasant, and
both meet the same wall: an ecosystem's compatibility surface is enormous, and "ongoing
effort" is a load-bearing phrase in a production decision. Node keeps the deployments for
the same reason CPython does.

## The one-paragraph version

CPython and Node.js are the implementations everything else is tested against. PyPy is the
right call for long-running pure-Python compute; GraalPy is the right call for embedding
Python in a JVM; Deno is the right call when a permission sandbox is a requirement; Bun is
the right call when the integrated toolchain is worth the compatibility risk. **Choosing
any of them because a benchmark said 3x is how a team acquires a compatibility problem
they did not budget for.**

## Gotchas

### Expecting PyPy to speed up a web service
**Symptom.** A migration to PyPy that produces no measurable improvement, or a regression.
**Cause.** The service's time is in C extensions and sockets. Per PyPy's own compatibility
page, C API modules work but do not get a JIT speedup — and the JIT also needs warm-up,
which a short-lived worker never reaches.
**Fix.** Profile first. If the profile is dominated by C frames and I/O waits, PyPy is not
the lever. If it is dominated by pure-Python frames in a long-lived process, it may be.

### Code that relies on refcounting for cleanup
**Symptom.** Works on CPython, loses data or exhausts file descriptors on PyPy or GraalPy.
**Cause.** CPython frees an object as soon as its last reference goes, so an unclosed file
happens to flush at the end of the statement. No other implementation guarantees that.
**Fix.** Context managers, everywhere, and `close()` on a generator you abandon:

```python
gen = producer()
try:
    first = next(gen)
finally:
    gen.close()          # runs its pending finally / with clauses now
```

### Reading a project's own benchmark as a prediction about your service
**Symptom.** A migration budgeted against "4x" that delivers nothing like it.
**Cause.** `pyperformance` and PyPy's suite measure pure-Python workloads. Your service is
mostly C extensions, network waits and database time — the parts a JIT cannot touch.
**Fix.** Treat published multiples as evidence that the JIT works, not as a forecast. Run
your own workload on both, with the discipline in [chunk 7](07-performance.md), before
committing.

### Assuming an alternative runtime tracks the latest CPython
**Symptom.** A dependency requiring 3.13+ that will not install; or missing a 3.14 feature
you designed around.
**Cause.** Alternative implementations trail. PyPy's site states support for 3.11;
GraalPy's README states 3.12 compliance, against CPython's 3.14.
**Fix.** Check the supported version *before* designing, and treat free-threading,
`concurrent.interpreters`, t-strings and PEP 649 annotations as CPython-3.14-only until
each alternative says otherwise.

### Treating GraalPy's native-extension support as production-ready
**Symptom.** A prototype with NumPy works; a production dependency does not, or behaves
subtly differently.
**Cause.** The README calls native extension support *"considered experimental"*, even
though popular packages install.
**Fix.** If the reason for GraalPy is JVM embedding, keep the Python side to pure Python
and cross the boundary for anything native. If the reason was speed alone, that is not a
strong enough reason.

### Migrating to Bun or Deno on a compatibility claim
**Symptom.** Ninety percent of the service runs and one dependency's native addon or
obscure `node:` API does not.
**Cause.** "Aims for full compatibility … an ongoing effort" is precise and honest
language; a large service will find the gaps.
**Fix.** The same discipline as the Python side: run the real test suite on the
alternative runtime before committing, and treat it as a per-service decision rather than
a platform migration.

## Interview questions

**Q. What is PyPy and when would you use it?**
A. A Python implementation with a tracing JIT. Its front page claims it is about 3 times
faster than CPython 3.11 on average, on its own benchmarks. It is the right choice for
long-running, CPU-bound, pure-Python workloads. It is the wrong choice for a typical web
service, because that service's time is in C extensions, which per PyPy's own docs work
but get no JIT speedup — and short processes never reach the warm JIT.

**Q. What is GraalPy for?**
A. Embedding Python in a JVM application, and polyglot work — calling Python packages from
Java, Kotlin or Scala, or Java libraries from Python. Its README claims geomean ~4x over
CPython on the official benchmark suite and describes it as Python 3.12 compliant, with
native extension support explicitly experimental. The embedding story is the reason to
choose it; the benchmark is not.

**Q. Why does CPython keep winning deployments if faster implementations exist?**
A. Because the C extension ecosystem is what makes Python useful, and CPython is the
implementation that ecosystem is built and tested against. An alternative that is 3x faster
on pure Python but experimental on NumPy is a worse deal for a service whose hot path is
NumPy. Compatibility beats a benchmark multiple.

**Q. What breaks when you move code from CPython to PyPy?**
A. Anything relying on refcounting for prompt cleanup. `open(f).write(x)` may not flush
when you expect, an abandoned generator's `finally` does not run immediately, and file
descriptor limits arrive sooner. Memory also *looks* higher in monitoring because unused
pages are reclaimed lazily. All of it is fixed by `with` blocks and explicit `close()`,
which is correct practice on CPython too.

**Q. Do Deno and Bun change the Python-versus-Node comparison?**
A. Not materially. They change JavaScript's runtime story — Deno adds a permission sandbox
and first-class TypeScript, Bun bundles the toolchain and runs on JavaScriptCore rather
than V8 — but the concurrency model, the library ecosystem and the ML gap are unchanged.
The comparison is about ecosystems, and those are shared.

**Q. Bun uses JavaScriptCore rather than V8. Does that matter?**
A. For a compatibility decision, yes: performance characteristics differ per workload, and
anything depending on V8-specific behaviour — native addons compiled against V8, some
profiling and debugging tooling, `--v8-options` — is not portable. For the language-choice
question in this topic, no.

**Q. How would you evaluate whether an alternative runtime is worth it?**
A. Profile the real service first to see whether the time is even in the language. Check
the runtime's supported Python or Node version against what your dependencies need. Run
the full test suite on it. Then benchmark your own workload with the discipline of
[chunk 7](07-performance.md) — same layer, real I/O, warmed up, p99. Published multiples
are a reason to run the experiment, never a substitute for it.

---

← Prev: [Performance, honestly](07-performance.md) · Index: [Python vs Node](README.md) · Next → [Choosing, in scenarios](09-choosing.md)

{/* FOOTER */}
