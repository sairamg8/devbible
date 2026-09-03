---
title: "Recursion limits in Python: RecursionError, sys.setrecursionlimit, and the C-stack reality"
sidebar_label: "01 · RecursionError & C-stack"
sidebar_position: 100
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (sys module: getrecursionlimit, setrecursionlimit), CPython execution model.
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python is fundamentally an imperative language that treats deep recursion as an operational hazard. In CPython, every function call allocates a Python heap frame (`PyFrameObject`) and consumes native stack memory on the operating system's C call stack for the interpreter evaluation loop. To prevent unbounded recursion from exhausting the OS thread stack and crashing the process with an uncatchable segmentation fault (`SIGSEGV`), CPython enforces a strict depth ceiling via `sys.getrecursionlimit()` (defaulting to 1000). Exceeding this boundary raises `RecursionError`. Arbitrarily raising this threshold via `sys.setrecursionlimit()` without increasing operating system stack memory introduces catastrophic crash vulnerabilities in production.**

## The anatomy of `RecursionError`

When a function recurses without reaching a base case, CPython halts execution before the operating system stack overflows:

```python
import sys

print(sys.getrecursionlimit())  # Typically 1000 in standard CPython

def runaway_recursion(depth: int = 0):
    return runaway_recursion(depth + 1)

try:
    runaway_recursion()
except RecursionError as err:
    print(f"Caught recursion limit: {err}")
    # Output: Caught recursion limit: maximum recursion depth exceeded
```

`RecursionError` is a built-in exception inheriting from `Exception`. It provides a graceful recovery point for application code, allowing servers to report client errors rather than terminating the entire process.

## The C-stack reality

Why does Python restrict recursion to ~1000 calls when modern servers have gigabytes of available RAM?

### Heap memory versus Native Thread Stack

1. **Python objects reside on the heap:** Variables, lists, and closures have access to all available system RAM.
2. **Interpreter loops execute on the C stack:** When a Python function calls another function, CPython executes internal C functions (principally `_PyEval_EvalFrameDefault`).
3. **OS thread stacks are strictly limited:**
   - On Linux, the main thread stack is typically limited to **8 MB**, while worker threads spawned by `threading` are often allocated **2 MB** or less.
   - Each CPython evaluation frame consumes significant C stack space (storing local C variables, instruction pointers, and CPU register state).
4. **The Segfault disaster:** If CPython allowed 20,000 recursive calls, the C call stack would collide with the memory boundary. The OS kernel immediately kills the entire application via `SIGSEGV` (Segmentation Fault). **No `try...except` block can intercept a segfault.**

## The hazards of `sys.setrecursionlimit()`

When developers encounter `RecursionError` while parsing large trees or deeply nested JSON payloads, they frequently attempt a brute-force fix:

```python
import sys

# DANGEROUS IN PRODUCTION:
sys.setrecursionlimit(50000)
```

### Why this is dangerous

Setting the limit beyond what the native OS stack can support transforms a catchable Python `RecursionError` into an uncatchable native process crash:

```
[1] 14208 segmentation fault (core dumped) python3 service.py
```

If a malicious user submits an adversarial JSON payload with 15,000 nested brackets, an application with an artificially high recursion limit will immediately crash the entire server process.

### Safe stack configuration

If deep recursion is genuinely unavoidable, you must scale the native OS stack limits in tandem using `resource` or thread configuration:

```python
import sys
import resource

# Scale native OS stack to 64MB before raising interpreter limit
resource.setrlimit(resource.RLIMIT_STACK, (64 * 1024 * 1024, resource.RLIM_INFINITY))
sys.setrecursionlimit(20000)
```

In production architectures, however, transforming recursion into iteration is vastly superior to manipulating stack limits.

## Gotchas

### Setting the recursion limit too low
**Symptom.** `RecursionError: maximum recursion depth exceeded` immediately upon executing simple commands or importing standard modules.
**Cause.** Calling `sys.setrecursionlimit(50)` set the limit below the threshold required by the interpreter itself. Python requires dozens of frames just to execute standard imports, format exception tracebacks, and print strings.
**Fix.** Never set the recursion limit below default levels unless running specialized unit tests.

### Thread stack differences
**Symptom.** Code with `sys.setrecursionlimit(5000)` works on the main thread but crashes worker threads with segmentation faults.
**Cause.** Operating systems allocate substantially smaller stacks to background threads created via `threading.Thread` than to the process main thread.
**Fix.** Configure worker thread stack sizes before spawning using `threading.stack_size(size_in_bytes)`.

## Interview questions

**★ Q: What is the default recursion limit in CPython and what purpose does it serve?**
The default recursion limit is typically 1000. It acts as a fail-safe to prevent infinite or deeply nested recursion from exhausting the operating system's native C call stack, which would result in an immediate segmentation fault (`SIGSEGV`) and terminate the entire process.

**★ Q: What happens if you increase `sys.setrecursionlimit()` to an excessively high value like 100,000?**
If the function reaches a recursion depth that exceeds the physical memory allocated to the operating system thread's call stack (typically 2MB to 8MB), CPython will crash abruptly with a segmentation fault. The process terminates immediately without executing `finally` blocks, context manager cleanups, or exception handlers.

**★ Q: Why does CPython raise `RecursionError` instead of letting recursion proceed until memory runs out?**
Because Python function calls are implemented using native C function calls in the interpreter runtime (`_PyEval_EvalFrameDefault`). Even if the host machine has hundreds of gigabytes of free heap memory, the native execution thread stack is hard-capped by the OS kernel. `RecursionError` provides a safe, catchable boundary before that native memory wall is hit.

**Q: What type of exception is `RecursionError` and what is its base class?**
`RecursionError` inherits directly from `Exception` (specifically `BuiltinException`). In Python 3.5+, it replaced `RuntimeError` as the dedicated exception type raised when recursion depth is exceeded.

**Q: What is the relationship between `sys.setrecursionlimit` and the operating system thread stack?**
`sys.setrecursionlimit` configures only the logical depth counter inside CPython's interpreter loop; it does not allocate additional operating system stack memory. If the Python recursion limit is set higher than the physical capacity of the OS stack, stack overflow occurs before Python reaches its logical limit.

---

← [Topic index](README.md) · Next → [TCO absence and iteration](02-tail-call-optimization-and-iteration.md)
