---
title: "The interpreter loop: a stack machine, frames, and the reference counting that makes destruction deterministic"
sidebar_label: "5 · The interpreter loop"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against
> [`dis` — Disassembler for Python bytecode](https://docs.python.org/3.14/library/dis.html),
> [What's New in Python 3.11 § Faster CPython](https://docs.python.org/3.14/whatsnew/3.11.html#faster-cpython)
> (frames and inlined calls),
> the [`gc` module](https://docs.python.org/3.14/library/gc.html),
> and the [`sys` module](https://docs.python.org/3.14/library/sys.html).
> Version spine: **Python 3.14.7**.

**Once your source is a code object, execution is a C loop that fetches an
instruction, does the thing, and fetches the next one. That loop is the whole
of "Python is slow": every `a + b` costs a decode, a type-slot lookup, an
indirect call, an allocation and two refcount updates, where a compiled
language emits one CPU instruction. And the memory model underneath — a
reference count on every object, with a cycle collector behind it — is why
Python destroys objects the instant you stop using them, and why that promise
occasionally becomes an operational problem.**

## The stack machine

CPython's bytecode targets a stack machine. Instructions push operands, operate
on the top of the stack, and push results. `total = price * qty` becomes,
roughly: load `price`, load `qty`, multiply, store `total`. You can always
look:

```python
import dis

def line(price, qty):
    return price * qty

dis.dis(line)
```

Each instruction is an opcode plus an argument (hence "bytecode"), with
`EXTENDED_ARG` for large operands. There are on the order of a couple of
hundred opcodes and they are explicitly **not** a stable interface: the `dis`
documentation warns that bytecode is a CPython implementation detail that
changes between versions without notice. Read it to understand; never generate
or parse it in production code.

### The dispatch tax

For `a + b` the loop must: decode the opcode, pop two objects, find the left
operand's numeric-multiply slot through its type, call through that function
pointer, allocate a result object, push it, and adjust reference counts along
the way. In C, `a + b` on two integers is one instruction.

**That ratio — not "interpreted versus compiled" as a slogan — is the concrete
reason numeric Python loops are slow, and it dictates the fix.** You do not
speed up a Python loop by rewriting the Python. You speed it up by making the
loop happen somewhere that is not the interpreter: numpy iterating over unboxed
arrays in C, the database doing the aggregation, or a compiled extension. Every
element that crosses back into Python pays the tax again, which is also why
`for x in arr: total += x` over a numpy array is *slower* than a Python list —
you get the boxing cost and none of the vectorisation.

## Frames

Every executing function has a **frame**: the code object, a pointer to the
current instruction, the value stack, and the locals array. Frames chain to
their callers, and walking that chain is what prints a traceback.

3.11 changed two things here that are worth knowing because they alter
long-standing intuitions:

> *"Old-style frame objects are now created only when requested by debuggers or
> by Python introspection functions such as `sys._getframe()` and
> `inspect.currentframe()`. For most user code, no frame objects are created at
> all."*

So the heavyweight, introspectable frame object is now lazily materialised. Any
library that walks frames on every call — some logging and profiling code does
— forces that materialisation and pays for it.

And on calls:

> *"During a Python function call, Python will call an evaluating C function to
> interpret that function's code. This effectively limits pure Python recursion
> to what's safe for the C stack. In 3.11, when CPython detects Python code
> calling another Python function, it sets up a new frame, and 'jumps' to the
> new code inside the new frame. This avoids calling the C interpreting
> function altogether. Most Python function calls now consume no C stack
> space."*

That is why the relationship between `sys.setrecursionlimit()` and actually
crashing changed: Python-to-Python recursion no longer grows the C stack, so
raising the limit is safer than it used to be. Recursion *through C* — a
`__repr__` that recurses, a comparison callback, `json` encoding a deep
structure — still grows the C stack and can still segfault past the limit. The
recursion limit exists to convert that segfault into a `RecursionError`, which
is why lowering it is a defensive move and raising it is a calculated risk.

## Reference counting

Every `PyObject` carries a reference count. Binding a name, appending to a
list, passing an argument — each increments it; each scope exit or rebinding
decrements it. At zero the object is freed **immediately**, and its own
references are released, which can cascade.

Two consequences you feel constantly:

- **Destruction is deterministic.** A file whose last reference disappears is
  closed right then. This is why so much CPython-only code gets away with
  `open(path).read()` — and why that code breaks on PyPy, as
  [chunk 1](01-language-vs-implementation.md) covered. It is also why `with`
  is not optional: the guarantee is CPython's, not Python's.
- **Refcount fields sit inside the objects.** Merely *reading* a shared object
  writes to its memory page. That is a structural collision with
  copy-on-write, and it is why a pre-fork server's workers share far less
  memory than the object graph would suggest.

## The cycle collector

Refcounting cannot free cycles. `a.peer = b; b.peer = a` leaves both at count 1
forever once you drop your own references — the two objects keep each other
alive. So CPython also runs a generational **cycle collector** over container
objects, looking for unreachable groups.

Generational means new objects are examined often and survivors progressively
less often. The operational consequence for a long-lived process: **objects
that never become garbage are still re-examined on every full collection.** A
100k-entry in-memory cache, a loaded ML model, a big parsed config — all of it
gets walked, periodically, forever, to discover nothing.

`gc.freeze()` is the fix, and the documentation states the full recipe:

> *"Freeze all the objects tracked by the garbage collector; move them to a
> permanent generation and ignore them in all the future collections. If a
> process will `fork()` without `exec()`, avoiding unnecessary copy-on-write in
> child processes will maximize memory sharing and reduce overall memory usage.
> … To accomplish both, call `gc.disable()` early in the parent process,
> `gc.freeze()` right before `fork()`, and `gc.enable()` early in child
> processes."*

That three-step sequence is the actual pattern for Gunicorn-style pre-forking
servers, and it is worth copying exactly rather than approximating. `gc.freeze()`
on its own, without a fork, still helps: it removes the permanent object graph
from the collector's working set.

`gc.disable()` permanently is a blunter instrument and is only safe if your
workload creates no cycles — which is a stronger claim than it sounds, because
exception tracebacks reference the frames that reference them, and any
bidirectional object graph (parent/child, node/parent-node, ORM
relationships) is a cycle by construction.

## Gotchas

**Symptom:** a long-running service has growing pause times that correlate with nothing in the request path
**Cause:** the generational cycle collector doing full collections over a large, permanently-live object graph — every surviving container is re-examined each time, to find nothing
**Fix:** `gc.freeze()` after loading the permanent data so those objects leave the collector's working set. Do not reach for `gc.disable()` unless you can prove no cycles are created, which is rarely true

**Symptom:** pre-fork worker memory grows far beyond expectations and the workers share almost nothing
**Cause:** copy-on-write pages get dirtied because refcount fields live inside the objects — reading a shared object writes to its page — and GC's `gc_refs` bookkeeping touches long-lived parent objects in each child
**Fix:** the documented sequence: `gc.disable()` early in the parent, `gc.freeze()` immediately before `fork()`, `gc.enable()` early in each child. It is a mitigation; the refcount/COW tension is structural

**Symptom:** an object with `__del__` is never finalised even though the program dropped every reference it held
**Cause:** the object is part of a reference cycle, so refcounting alone cannot free it and it waits for the cycle collector — which may be a long time, or never before interpreter shutdown
**Fix:** break the cycle explicitly (`weakref` for back-pointers), or use a context manager instead of `__del__`. Never rely on `__del__` for releasing anything that matters

**Symptom:** `open(path).read()` works fine for years, then the process hits "too many open files" under load
**Cause:** it relies on refcounting to close the file at the end of the statement. If the file object ever gets captured — by an exception traceback that is being retained, by a profiler, by a cycle — the close is deferred
**Fix:** `with open(path) as f:` unconditionally. The deterministic-close behaviour is an implementation detail you are borrowing, not a guarantee

**Symptom:** a `RecursionError` appears in a code path that used to be fine after a Python upgrade, or a segfault appears where a `RecursionError` was expected
**Cause:** since 3.11, Python-to-Python calls consume no C stack, so the relationship between the recursion limit and the real C stack changed. Recursion that passes *through C* — `__repr__`, comparison callbacks, `json` encoding — still grows the C stack
**Fix:** don't raise the recursion limit as a reflex; it is the guard that turns a segfault into a catchable exception. Convert deep recursion into iteration with an explicit stack

**Symptom:** a logging or tracing library made everything measurably slower on 3.11+
**Cause:** it calls `sys._getframe()` or `inspect.currentframe()` per call, forcing creation of the old-style frame object that CPython otherwise no longer materialises
**Fix:** use the library's non-introspecting mode if it has one, restrict frame walking to error paths, or accept the cost knowingly. This is one of the few places where a 3.11 optimisation can be defeated by user code

**Symptom:** code that inspects or patches bytecode broke on a Python upgrade
**Cause:** the opcode set is an implementation detail and changes between minor versions — 3.11 in particular restructured calls and frames, and 3.12–3.14 continued to reshape instruction families
**Fix:** `dis` is for reading. If you need to transform code, work at the AST level (`ast` module), which is a far more stable interface with a documented compatibility story

**Symptom:** iterating a numpy array in a Python `for` loop is slower than iterating a plain list
**Cause:** every element must be boxed into a Python object as it crosses the boundary, so you pay the interpreter tax *and* the boxing, and get none of the vectorised C loop
**Fix:** stay inside numpy — vectorised expressions, `np.sum`, boolean masks. The rule generalises: crossing the Python/C boundary per element defeats the point of the C library

## Interview questions

**★ Walk me through what happens when the interpreter executes `total = price * qty`.**
The compiler has already turned it into roughly four bytecodes: load `price`,
load `qty`, binary multiply, store `total`. The eval loop fetches each opcode,
decodes it, and acts on the value stack. The multiply is the expensive one:
generically it pops two objects, consults the left operand's type for a numeric
multiply slot, calls through that function pointer, allocates a result object
and pushes it, adjusting reference counts throughout. On 3.11+ that instruction
may have been specialised in place after being seen to be hot — which is
[the next chunk](06-runtime-optimisation.md).

**★ Why is Python slow for numeric loops, and what is the actual fix?**
Because every operation goes through the interpreter's dispatch machinery:
decode an opcode, look up a type slot, call through a function pointer,
allocate a boxed result object, update reference counts. A compiled language
emits one CPU instruction for the same arithmetic. The fix is never to
micro-optimise the Python — it is to make the loop happen somewhere else:
numpy, which runs the loop in C over unboxed arrays; the database, which does
the aggregation for you; or a compiled extension via Cython, Numba or Rust. The
corollary is that you must not then iterate the numpy array element-by-element
in Python, because that reintroduces the tax you paid to avoid.

**★ How does CPython manage memory?**
Reference counting as the primary mechanism — every object carries a count,
incremented and decremented as references are made and dropped, and freed
immediately at zero, which is why destruction is deterministic and why `with`
usually appears redundant on CPython. Because refcounting cannot reclaim
reference *cycles*, a generational cycle collector runs periodically over
container objects to find unreachable groups. Neither is guaranteed by the
language: PyPy uses a tracing collector and has no refcounts at all, which is
why relying on prompt destruction is an implementation bet.

**★ When would you touch the `gc` module in production, and how exactly?**
Two specific patterns. First, a long-lived process with a large permanent
object graph: `gc.freeze()` after loading it moves those objects to a permanent
generation so full collections stop walking them. Second, a pre-fork server:
the documented sequence is `gc.disable()` early in the parent, `gc.freeze()`
immediately before `fork()`, and `gc.enable()` early in each child — that
maximises copy-on-write sharing by keeping the children's GC bookkeeping off
the parent's pages. What you should *not* do is `gc.disable()` permanently:
tracebacks and any bidirectional object graph create cycles, so you would be
choosing a slow leak.

**Why does a reference cycle need a separate collector at all?**
Because a cycle's members hold references to each other, so their counts never
reach zero even when nothing outside the cycle can reach them. Refcounting is a
local decision — "does anyone still point at me?" — and cycles make that
question answer "yes" forever. The cycle collector asks the global question
instead: starting from the roots, what is actually reachable? Everything in a
tracked container that is not reachable is garbage regardless of its count.

**What changed about frames and recursion in 3.11?**
Two things. Frame *objects* — the introspectable ones — are now created lazily,
only when a debugger or `sys._getframe()`/`inspect.currentframe()` asks, so
most user code creates none at all. And Python-to-Python calls are inlined into
the eval loop rather than recursing into the C evaluation function, so they
consume no C stack space. That means pure-Python recursion can go much deeper
if you raise the limit, but recursion that passes through C — `__repr__`,
comparison hooks, serialisation — still grows the C stack and still needs the
limit as a guard.

**Is the bytecode a stable interface you can build tools on?**
No. The `dis` documentation is explicit that bytecode is a CPython
implementation detail subject to change between versions, and 3.11 in
particular reshaped calls, frames and instruction families. Read bytecode with
`dis` to understand what a construct costs; if you need to *transform* code,
work at the AST level, which is documented as a stable-ish interface with an
explicit compatibility story.

**Why is `with` not redundant on CPython, given refcounting closes files anyway?**
Because "the last reference disappears at the end of this statement" is a claim
about your whole program, not about the line you are looking at. An exception
being handled retains a traceback that retains the frame that retains the file.
A profiler or debugger holds frames. A cycle defers everything to the
collector. And on any implementation that is not CPython, the whole premise is
false. `with` makes the release a property of the code rather than of the
runtime's bookkeeping.

---

← Prev: [Cache invalidation](04-cache-invalidation.md) · Index: [What Python is](README.md) · Next → [Runtime optimisation](06-runtime-optimisation.md)
