---
title: "The language vs its implementations: why almost everything you know about Python is really a fact about CPython"
sidebar_label: "1 · Language vs implementation"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14 Language Reference
> ([1. Introduction / 1.1 Alternate Implementations](https://docs.python.org/3.14/reference/introduction.html)),
> [`sys.implementation`](https://docs.python.org/3.14/library/sys.html#sys.implementation),
> the [`threading` module docs](https://docs.python.org/3.14/library/threading.html),
> the [Programming FAQ](https://docs.python.org/3.14/faq/programming.html),
> [PEP 703](https://peps.python.org/pep-0703/) (the `t` ABI tag), and the
> [uv Python versions guide](https://docs.astral.sh/uv/concepts/python-versions/)
> (updated 2026-07-25).
> Version spine: **Python 3.14.7**.

**There is a Python *language* — a grammar and a set of semantics written in
English prose — and there is CPython, the C program that implements it and that
you almost certainly have installed. The language reference is deliberately
vague in places; CPython is exact everywhere. When you learn "Python", you
learn a blend of the two, and nobody tells you which half is which. That
mixture is fine right up until you write code that depends on a CPython
implementation detail and then run it somewhere else — a PyPy worker, a
GraalPy embedding, a future CPython — and it stops working.**

## The language reference admits it is not a specification

The very first section of the Language Reference is refreshingly honest about
what it is:

> *"While I am trying to be as precise as possible, I chose to use English
> rather than formal specifications for everything except syntax and lexical
> analysis. This should make the document more understandable to the average
> reader, but will leave room for ambiguities."*

And on why CPython's quirks leak into it anyway:

> *"It is dangerous to add too many implementation details to a language
> reference document — the implementation may change, and other implementations
> of the same language may work differently. On the other hand, CPython is the
> one Python implementation in widespread use (although alternate
> implementations continue to gain support), and its particular quirks are
> sometimes worth being mentioned … Therefore, you'll find short
> 'implementation notes' sprinkled throughout the text."*

Those implementation notes are rendered in the docs as boxes labelled
**"CPython implementation detail:"**. Learning to notice them is a real skill.
The most consequential one in the whole standard library is in `threading`:

> *"CPython implementation detail: In CPython, due to the Global Interpreter
> Lock, only one thread can execute Python code at once (even though certain
> performance-oriented libraries might overcome this limitation)."*

The GIL — the thing everyone believes is *the* defining fact about Python — is
formally a footnote about one implementation. Jython never had one. PyPy has
one but a different one. Free-threaded CPython 3.14 can turn it off.

## What CPython is

CPython is a C program (roughly: a tokeniser, a PEG parser, a bytecode
compiler, an evaluation loop, an object system built on `PyObject`, and a
memory manager) plus the standard library, most of which is written in Python
itself. The language reference's own description:

> *"CPython — This is the original and most-maintained implementation of
> Python, written in C. New language features generally appear here first."*

"CPython" is not a fork or a variant. When you download Python from
python.org, `apt install python3`, or `uv python install 3.14`, you get
CPython. The name exists only so we can talk about the implementation
separately from the language.

The clearest place the two names are visible at runtime is `sys`:

```python
import sys

sys.version_info           # the LANGUAGE version this interpreter conforms to
sys.implementation.name    # 'cpython' | 'pypy' | 'graalpy' | ...
sys.implementation.version # the IMPLEMENTATION's own version
sys.implementation.cache_tag  # e.g. 'cpython-314' — used in __pycache__ filenames
```

The docs spell out exactly why these are two different fields:

> *"For example, for PyPy 1.8 `sys.implementation.version` might be
> `sys.version_info(1, 8, 0, 'final', 0)`, whereas `sys.version_info` would be
> `sys.version_info(2, 7, 2, 'final', 0)`. For CPython they are the same
> value, since it is the reference implementation."*

That last clause is the whole topic in nine words. On CPython, language version
and implementation version are identical, so the distinction is invisible —
which is exactly why it catches people out elsewhere.

## What the language guarantees vs what CPython happens to do

This is the table worth memorising, because each row is a bug waiting for
somebody:

| Behaviour | Guaranteed by the language? | Reality |
|---|---|---|
| An object is freed *promptly* when the last reference drops | **No** | CPython uses reference counting, so it is prompt. PyPy uses a tracing GC and it is not |
| `open(f).read()` closes the file | **No** | Relies on the above. On PyPy the file stays open until a GC cycle — use `with` |
| `sys.getrefcount(obj)` | **No** | CPython-only; PyPy provides no meaningful refcount |
| Small integers and short strings are cached, so `a is b` may be `True` | **No** | CPython interning; never compare values with `is` |
| `dict` preserves insertion order | **Yes**, since 3.7 | Was a CPython 3.6 implementation detail, then promoted to a language guarantee |
| One thread at a time runs bytecode (the GIL) | **No** | CPython-only, and optional in the 3.14 free-threaded build |
| String concatenation in a loop is sometimes fast | **No** | A CPython refcount-1 in-place optimisation. Use `"".join()` |
| `id(x)` is the memory address | **No** | Only that it is a unique, constant integer for the object's lifetime |

The rule that falls out: **anything you learned as a performance trick or an
identity trick is an implementation detail. Anything in the data model — how
`__len__` is called, what `for` does to an iterator — is the language.**

## The alternate implementations, honestly

You will be asked about these in interviews and you will almost never use them.
Know what each *is* and what it costs.

**PyPy** — a Python implementation written in a restricted subset of Python
(RPython), whose defining feature is a tracing just-in-time compiler. On
long-running, pure-Python, CPU-bound loops it is genuinely and dramatically
faster than CPython, because the JIT compiles hot loops to machine code. The
costs are real: it lags CPython's language version by a year or more (as of
uv's Python-version documentation, "PyPy versions lag behind CPython and
currently only supports Python versions up to 3.11"); its C-extension
compatibility layer (`cpyext`) is slow enough that a numpy/pandas workload can
be *slower* than CPython; startup and baseline memory are higher; and the JIT
needs a warm-up period, so short scripts see no benefit at all. PyPy is the
right answer for a long-lived, pure-Python compute service. It is the wrong
answer for a Django app full of C extensions.

**GraalPy** — Python on GraalVM, the Oracle Labs polyglot JVM runtime. Its
selling point is embedding: running Python inside a Java application and
passing objects across the boundary without serialisation, plus native-image
ahead-of-time compilation. It supports a growing set of C extensions but not
all of them. If you are not already a JVM shop, this is recognition-level
knowledge only.

**Jython** and **IronPython** — Python on the JVM and on .NET respectively.
Both are described in the current language reference, and both are effectively
historical for new work: Jython's mainline is Python 2.7 with a long-running 3.x
effort. Do not start a project on either.

**MicroPython / CircuitPython** — a reimplementation for microcontrollers with
a cut-down standard library. Not a drop-in Python; a Python-shaped language for
32 KB of RAM.

**Pyodide** — CPython compiled to WebAssembly so it runs in a browser or a
serverless WASM sandbox. It *is* CPython, so semantics match; what differs is
the platform (no threads in the classic build, no sockets, a virtual
filesystem). uv can install Pyodide distributions directly.

**Cython, Numba, mypyc** are not implementations of Python and it is worth
being pedantic about this in an interview. Cython compiles a Python *superset*
to C extension modules that CPython loads; Numba JIT-compiles individual
decorated functions via LLVM; mypyc compiles type-annotated Python to C
extensions. All three run *inside* CPython. They are accelerators, not
runtimes.

## Where the versions actually diverge

There is one more layer people conflate: the *language version* (3.14), the
*implementation* (CPython), and the *build* of that implementation. Since 3.13
CPython ships two builds from the same source tree — the standard GIL-enabled
build and the free-threaded build — and in 3.14 the free-threaded one is
officially supported. Same language, same implementation, different build, and
C extensions must be compiled separately for each. That is the subject of
[the GIL topic](../02-the-gil/README.md).

## Gotchas

**Symptom:** code that works on CPython leaks file descriptors on PyPy until the process runs out
**Cause:** the code relies on CPython's reference counting to close files at the end of an expression — `data = open(path).read()` has no reference left after the statement, so CPython frees and closes it immediately. PyPy's tracing GC frees it eventually, which may be minutes
**Fix:** always `with open(path) as f: data = f.read()`. Deterministic destruction is a CPython implementation detail, not a language feature — this is exactly why context managers exist

**Symptom:** `a is b` returns `True` in the REPL for `256` and `False` for `257`, and a code review argument follows
**Cause:** CPython pre-allocates and caches small integers. This is an allocation optimisation, not a semantic rule
**Fix:** use `==` for value comparison, always. Reserve `is` for `None`, `True`, `False` and genuine identity checks. Never write a test that asserts `is` on a number or a string

**Symptom:** a "fast string building" loop (`out += chunk`) is fast in one service and quadratic in another
**Cause:** `str` is immutable, so in principle every `+=` allocates a new string and copies. CPython contains an unofficial in-place resize path that sometimes avoids the copy, but it is not documented, not guaranteed, and stops applying as soon as another reference to the string exists. The FAQ's answer to *"What is the most efficient way to concatenate many strings together?"* does not mention it at all — it says: *"`str` and `bytes` objects are immutable, therefore concatenating many strings together is inefficient as each concatenation creates a new object"* and directs you to collect chunks in a list and call `str.join()` at the end
**Fix:** `parts.append(chunk)` in the loop, `"".join(parts)` at the end. That is linear on every implementation and every version. (I could not find the refcount-1 fast path documented anywhere official — treat it as an accident you must never design around)

**Symptom:** a library's docs promise a behaviour that stops holding on an upgrade
**Cause:** the behaviour was in a **"CPython implementation detail:"** box in the docs and got optimised away. `dict` ordering went the other way — a 3.6 implementation detail promoted to a 3.7 guarantee — but the promotion is the exception, not the rule
**Fix:** treat those boxes as "may change". If you need the behaviour, assert it in a test so an upgrade fails loudly rather than silently

**Symptom:** "we'll switch to PyPy for speed" makes the service slower
**Cause:** the workload is C-extension bound (numpy, pandas, psycopg, cryptography, lxml). PyPy's `cpyext` emulation layer adds per-call overhead that a CPython C extension does not have, and the JIT cannot optimise across it
**Fix:** measure first. PyPy wins on long-running pure-Python hot loops; it loses on C-extension-heavy and short-lived processes. If the hot code is already in C, the interpreter was never the bottleneck

**Symptom:** `sys.getrefcount()` in production diagnostics crashes with `AttributeError` on a non-CPython runtime
**Cause:** it is a CPython-only function; the language does not require refcounts to exist
**Fix:** guard implementation-specific diagnostics with `sys.implementation.name == "cpython"`, or use portable tooling (`tracemalloc`, `gc.get_objects()`)

**Symptom:** a wheel that installed fine on CPython 3.14 refuses to install on the free-threaded 3.14 interpreter
**Cause:** compiled extensions are built per-build, not just per-version; the free-threaded build has its own ABI tag (`cp314t`) and needs its own wheels
**Fix:** check the project's free-threading support before committing to that build. Pure-Python wheels are unaffected

**Symptom:** an interviewer asks "is Python compiled or interpreted?" and the answer "interpreted" gets a follow-up you can't answer
**Cause:** the premise is wrong. CPython compiles to bytecode ahead of execution, every run
**Fix:** "The language doesn't say. CPython compiles source to bytecode and then interprets that bytecode in a loop, with runtime specialisation since 3.11 and an experimental JIT in 3.14. PyPy compiles hot loops to machine code. 'Compiled to an intermediate form, then executed by a virtual machine' is the accurate sentence."

## Interview questions

**★ Is Python compiled or interpreted?**
Neither label is a property of the language — it is a property of the
implementation. CPython always compiles your source to bytecode first (that is
what `__pycache__` holds), then executes that bytecode in a C evaluation loop.
Since 3.11 the loop specialises hot instructions at runtime; 3.14 ships an
experimental JIT in the official macOS and Windows binaries. PyPy goes
further and compiles hot loops to native machine code. So: compiled to an
intermediate representation, then interpreted, with increasing amounts of
just-in-time native compilation depending on the implementation and version.

**★ What's the difference between "Python" and "CPython"?**
Python is the language: a grammar and a set of semantics described in the
Language Reference, in English prose rather than a formal specification.
CPython is the reference implementation of that language, written in C, and is
what you get from python.org, your distro, or `uv python install`. New language
features generally appear in CPython first. The distinction only becomes
visible when you run something else — `sys.version_info` (language version)
and `sys.implementation.version` (implementation version) are identical on
CPython precisely because it is the reference implementation.

**★ Name three things you believe about Python that are actually only true in CPython.**
Objects are destroyed the instant their last reference goes away (refcounting —
PyPy uses a tracing GC); the GIL means one thread runs bytecode at a time
(formally a CPython implementation detail, and switchable off in the 3.14
free-threaded build); and small integers/short strings are cached so `is` may
return `True` for equal values. A fourth: `id()` returning something that
resembles a memory address. The language only promises `id()` is unique and
constant for the object's lifetime.

**★ When would you actually reach for PyPy, and when would it hurt you?**
Reach for it when the process is long-lived, the hot code is pure Python, and
the workload is CPU-bound — a numeric simulation, a parser, a bytecode-heavy
transform pipeline. The tracing JIT needs a warm-up period, so short-lived CLI
processes gain nothing. It hurts when the hot code is already inside C
extensions (numpy, pandas, database drivers), because PyPy emulates the CPython
C API through `cpyext` and pays overhead per call that CPython does not; and
PyPy trails CPython's language version, so recent syntax and library features
may be unavailable.

**Is `dict` ordering guaranteed?**
Yes, since Python 3.7 — insertion order preservation is a language guarantee
now. It arrived in CPython 3.6 as a side effect of a memory-layout change and
was documented explicitly as an implementation detail at the time; the 3.7
release promoted it to a guarantee. This is the standard example of an
implementation detail being deliberately elevated, and the exception that
proves the rule: assume nothing else you see is on the same path.

**Are Cython, Numba and mypyc alternative Python implementations?**
No. Cython compiles a Python superset to C, producing an extension module that
CPython imports. Numba JIT-compiles individual decorated functions through
LLVM. mypyc compiles annotated Python to C extension modules. All three run
inside a CPython process — they are accelerators for parts of your program, not
runtimes that could execute your whole program on their own. Jython,
IronPython, PyPy, GraalPy, MicroPython and Pyodide are implementations.

**How would you write code that behaves identically on CPython and PyPy?**
Close resources explicitly with `with` rather than relying on refcounting;
compare with `==` not `is`; never depend on `sys.getrefcount`, `gc` internals,
or `id()` arithmetic; build strings with `join`; and don't assume `__del__`
runs at a particular moment (or at all). In practice this list is identical to
the list of things good CPython code does anyway — the portability rules are
also the correctness rules.

**What does `sys.implementation.cache_tag` do?**
It is the tag the import machinery embeds in cached bytecode filenames — on
CPython 3.14 that is `cpython-314`, producing `__pycache__/foo.cpython-314.pyc`.
Because the tag encodes both implementation and version, bytecode caches from
different interpreters coexist in the same directory without colliding. If an
implementation sets it to `None`, module caching is disabled entirely.

---

← Index: [What Python is](README.md) · Next → [Source to bytecode](02-source-to-bytecode.md)
