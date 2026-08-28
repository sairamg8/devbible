---
title: "multiprocessing re-imports your main module in every child, which is why the guard stopped being optional in 3.14 on Linux too"
sidebar_label: "4 · multiprocessing and the guard"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`multiprocessing`](https://docs.python.org/3.14/library/multiprocessing.html)
> (Contexts and start methods; Programming guidelines § Safe importing of main
> module),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> (`concurrent.futures`, `multiprocessing`) and
> CPython's [`Lib/multiprocessing/spawn.py`](https://github.com/python/cpython/blob/3.14/Lib/multiprocessing/spawn.py)
> for the `RuntimeError` text and the `__mp_main__` mechanism.
> Version spine: **CPython 3.14.7**.

**A child process created by the spawn or forkserver start method is a *fresh
interpreter*. It has none of the parent's objects, so before it can unpickle the
function you asked it to run it must re-create the namespace that function came
from — which means re-importing your main module. If your main module starts
processes at its top level, the child re-runs that code and starts more
processes, forever, and CPython detects the recursion and raises. Python 3.14
changed the default start method on Linux from fork to forkserver, which means
the guard that Windows and macOS developers have always needed is now needed
everywhere.**

## The 3.14 change, verbatim

The `multiprocessing` docs' changed-in notes are the whole story:

> *Changed in version 3.14: On POSIX platforms the default start method was
> changed from `fork` to `forkserver` to retain the performance but avoid common
> multithreaded process incompatibilities.*

> *Changed in version 3.14 (on `fork`): This is no longer the default start
> method on any platform. Code that requires `fork` must explicitly specify that
> via `get_context()` or `set_start_method()`.*

And What's New states the `concurrent.futures` half:

> *"On Unix platforms other than macOS, 'forkserver' is now the default start
> method for `ProcessPoolExecutor` (replacing 'fork'). This change does not
> affect Windows or macOS, where 'spawn' remains the default start method. If
> the threading incompatible fork method is required, you must explicitly
> request it by supplying a multiprocessing context `mp_context` to
> `ProcessPoolExecutor`."*

The defaults as of 3.14:

| Platform | Default start method | Re-imports `__main__`? |
|---|---|---|
| Windows | `spawn` | yes |
| macOS | `spawn` | yes |
| Linux and other POSIX with fd-passing | `forkserver` | yes |
| anywhere, explicitly `fork` | `fork` | no |

The right-hand column is the one that matters here. Under `fork` the child is a
copy of the parent's memory, so nothing is re-imported and a missing guard
causes no error — which is exactly why so much Linux-only code got away without
one until 3.14.

## What the three methods actually do

> *spawn: "The parent process starts a fresh Python interpreter process. The
> child process will only inherit those resources necessary to run the process
> object's `run()` method. In particular, unnecessary file descriptors and
> handles from the parent process will not be inherited. Starting a process
> using this method is rather slow compared to using fork or forkserver."*

> *fork: "The parent process uses `os.fork()` to fork the Python interpreter.
> The child process, when it begins, is effectively identical to the parent
> process. All resources of the parent are inherited by the child process. Note
> that safely forking a multithreaded process is problematic."*

> *forkserver: "When the program starts and selects the forkserver start method,
> a server process is spawned. From then on, whenever a new process is needed,
> the parent process connects to the server and requests that it fork a new
> process. The fork server process is single threaded unless system libraries or
> preloaded imports spawn threads as a side-effect so it is generally safe for
> it to use `os.fork()`. No unnecessary resources are inherited."*

forkserver is the interesting compromise: a single-threaded server forked *early*,
before your program has created threads, so its `fork()` is safe — and each
worker is forked from that server rather than from your process. The children
still start from a clean interpreter state, so they still need to import your
main module to find your functions.

## The `RuntimeError`, and what it means

The documentation's guideline:

> *"Make sure that the main module can be safely imported by a new Python
> interpreter without causing unintended side effects (such as starting a new
> process)."*

> *"For example, using the spawn or forkserver start method running the
> following module would fail with a `RuntimeError`:"*

```python
from multiprocessing import Process

def foo():
    print('hello')

p = Process(target=foo)
p.start()
```

> *"Instead one should protect the 'entry point' of the program by using
> `if __name__ == '__main__':` as follows:"*

```python
from multiprocessing import Process, freeze_support, set_start_method

def foo():
    print('hello')

if __name__ == '__main__':
    freeze_support()
    set_start_method('spawn')
    p = Process(target=foo)
    p.start()
```

> *"(The `freeze_support()` line can be omitted if the program will be run
> normally instead of frozen.)"*

> *"This allows the newly spawned Python interpreter to safely import the module
> and then run the module's `foo()` function."*

> *"Similar restrictions apply if a pool or manager is created in the main
> module."*

The error itself is raised by `_check_not_importing_main` in CPython's
`Lib/multiprocessing/spawn.py`, and its message is the clearest statement of the
mechanism anywhere in the project — it begins *"An attempt has been made to
start a new process before the current process has finished its bootstrapping
phase"* and goes on to say *"This probably means that you are not using fork to
start your child processes and you have forgotten to use the proper idiom in the
main module"*, pointing at the `if __name__ == '__main__':` block and the
documentation section quoted above.

The detection is precise rather than heuristic. The child sets a private
`_inheriting` flag on the current process while it is re-importing the parent's
main module; `Process.start()` checks that flag and raises if it is set. So the
`RuntimeError` means exactly one thing: **a child process tried to start a
process while it was still re-importing your main module.** It is not a
guess.

## Gotchas

### `RuntimeError` about the bootstrapping phase

**Symptom.** The message quoted above, often repeated many times, sometimes with
processes appearing and dying in a loop before it lands.
**Cause.** `Process.start()`, `Pool(...)` or `ProcessPoolExecutor(...)` was
called at module level in the main module, and a child re-imported that module.
**Fix.** Put the call under the guard:

```python
def work(x): ...

if __name__ == "__main__":
    with multiprocessing.Pool() as pool:
        print(pool.map(work, range(10)))
```

### It worked on Linux and broke in CI, or after upgrading to 3.14

**Symptom.** Code with no guard that ran for years now raises the bootstrap
`RuntimeError`.
**Cause.** 3.14 changed the POSIX default from `fork` to `forkserver`, and
forkserver children re-import the main module the way spawn children do.
**Fix.** Add the guard. Reverting to `fork` with
`multiprocessing.set_start_method("fork")` is available and is a bad trade — see
[chunk 4c](04c-fork-threads-and-executors.md) for why the change was made.

### A `Pool` created at import time in a library

**Symptom.** A user of your library gets the bootstrap `RuntimeError` from code
they did not write.
**Cause.** The library constructs a pool at module level, and the user's main
module imports the library, so the child re-imports it too.
**Fix.** Create pools lazily, inside a function, and let the caller own the
lifetime. The docs also ask libraries not to pin a start method: *"Libraries
using `multiprocessing` or `ProcessPoolExecutor` should be designed to allow
their users to provide their own multiprocessing context."*

### `set_start_method` called twice

**Symptom.** `RuntimeError: context has already been set`.
**Cause.** Either two calls in your own code, or one call at module level that
the child re-executed. The docs: *"`set_start_method()` should not be used more
than once in the program."*
**Fix.** One call, inside the guard. For library code use
`multiprocessing.get_context("spawn")` instead, which sets nothing globally.

## Interview questions

**★ Why does `multiprocessing` need `if __name__ == "__main__":`?**
Because with the spawn and forkserver start methods the child is a fresh
interpreter with none of the parent's objects. To find the function you asked it
to run, it re-imports your main module — and if that module starts processes at
its top level, the child starts more, recursively. CPython detects this: the
child sets a flag while it is re-importing the main module, `Process.start()`
checks that flag, and raises the *"attempt has been made to start a new process
before the current process has finished its bootstrapping phase"* error.

**★ What changed in Python 3.14, and why does it matter to Linux developers?**
The default start method on POSIX changed from `fork` to `forkserver` — *"to
retain the performance but avoid common multithreaded process
incompatibilities"* — and `fork` is now, in the docs' words, *"no longer the
default start method on any platform"*. `ProcessPoolExecutor` inherited the same
change on Unix other than macOS. Since fork children never re-import anything,
Linux-only code without a guard used to work; on 3.14 it raises. This is the
single most out-of-date piece of folklore about `multiprocessing`.

**What exactly does the bootstrap `RuntimeError` tell you?**
That a child process called `Process.start()` (or built a `Pool`, or a
`ProcessPoolExecutor`) *while it was still re-importing the parent's main
module*. It is a flag check, not a heuristic, so it is never a false positive.
The fix is always the same: move the process creation below an
`if __name__ == "__main__":` line, or out of the main module entirely.

**Where does `set_start_method` belong, and what is the alternative?**
Inside the guard, called once — the docs place it *"in the `if __name__ ==
'__main__'` clause of the main module"* and state it *"should not be used more
than once in the program"*. The alternative, and the right choice for library
code, is `multiprocessing.get_context("spawn")`, which returns an object with
the same API and changes nothing globally. The docs ask libraries to let users
supply their own context precisely because a library that calls
`set_start_method` breaks applications that wanted a different one.

---

← Prev: [Fixing and diagnosing double imports](03b-fixing-and-diagnosing-double-imports.md) · Index: [if __name__ == "__main__"](README.md) · Next → [What the child does to __main__](04b-what-the-child-does-to-main.md)
