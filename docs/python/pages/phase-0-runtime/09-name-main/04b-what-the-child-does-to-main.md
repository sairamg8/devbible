---
title: "The child re-executes your main module under the name __mp_main__ — unless you launched with -m, which is the one exempt case"
sidebar_label: "4b · What the child does to __main__"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`multiprocessing`](https://docs.python.org/3.14/library/multiprocessing.html)
> (Contexts and start methods; Programming guidelines; the `Pool` note on the
> interactive interpreter),
> [`multiprocessing.freeze_support`](https://docs.python.org/3.14/library/multiprocessing.html#multiprocessing.freeze_support)
> and CPython's
> [`Lib/multiprocessing/spawn.py`](https://github.com/python/cpython/blob/3.14/Lib/multiprocessing/spawn.py)
> for the `__mp_main__` mechanism.
> Version spine: **CPython 3.14.7**.

**Knowing that the child "re-imports the main module" is enough to write the
guard. Knowing *how* is what lets you predict the second-order effects: what
name the re-executed module gets, which launch mode skips the re-execution
entirely, and why a `--verbose` flag parsed at module level shows up in every
worker. The mechanism is a hundred lines of `multiprocessing/spawn.py`, and
three of its details explain most of the confusing behaviour people report.**

## The child's bootstrap, step by step

The parent sends the child a small dictionary of "preparation data" — its
`sys.path`, `sys.argv`, working directory, chosen start method, and an
identification of its own main module, either by module name or by file path.
The child applies all of that before unpickling anything.

The main-module step, from `Lib/multiprocessing/spawn.py`, is implementation
detail rather than documented API, and it works like this:

- If the parent's main module was named `__main__` or a name ending in
  `.__main__` — that is, `python -m mypkg` running `mypkg/__main__.py` — the
  child **returns immediately and re-runs nothing**. The source comment explains
  why: such files *"run their 'main only' code unconditionally"*, so re-running
  them would be actively wrong.
- If the process was forked, and `__main__` already looks right, it also returns
  and does nothing.
- Otherwise the child re-executes the module — via `runpy.run_module` when it
  has a name, `runpy.run_path` when it has a path — under the run name
  `__mp_main__`, and then points **both** `sys.modules['__main__']` and
  `sys.modules['__mp_main__']` at the resulting module.

That last aliasing step is the reason unpickling works. A function pickled in
the parent is recorded as `("__main__", "work")`; in the child, `__main__` now
refers to the freshly executed copy, so the lookup succeeds.

## Three consequences worth carrying

**1. `python -m mypkg` is the launch mode that interacts most gracefully with
`multiprocessing`.** The child skips the re-execution entirely, so nothing in
your `__main__.py` runs twice. Combined with the conventional two-line
`__main__.py`, there is nothing there to run anyway.

**2. In every other launch mode, your main module's top level runs again in
every worker.** Not the guard body — `__name__` is `"__mp_main__"` there, so the
guard is `False`, which is exactly the intent — but everything above it. Imports,
module-level constants, `logging.basicConfig`, `parse_args()`, a module-level
`Pool`: all of it, once per worker.

**3. `__name__` in a worker is `"__mp_main__"`, which is neither `"__main__"`
nor the module's real dotted name.** Any code that tests `__name__ !=
"__main__"` and concludes "therefore I am being imported normally" is wrong in a
worker.

The child also restores the parent's `sys.argv` and working directory, so
module-level argument parsing does not merely re-run — it re-runs with the same
arguments and can happily exit the worker with status 2.

## `freeze_support`

`freeze_support()` exists for programs turned into executables by PyInstaller,
cx_Freeze and similar tools. In a frozen program the "interpreter" the child
launches is your own executable, so without intervention the child would re-run
your entire application from the top. `freeze_support()` detects that this
process is a `multiprocessing` child and diverts it into the worker bootstrap
instead.

```python
import multiprocessing

def work(x): ...

if __name__ == "__main__":
    multiprocessing.freeze_support()      # first, before anything else
    with multiprocessing.Pool() as pool:
        pool.map(work, range(10))
```

The docs note it *"can be omitted if the program will be run normally instead of
frozen"* — it is a no-op in an ordinary POSIX run. They also carry a standing
caveat about freezing at all:

> *"The 'spawn' and 'forkserver' start methods generally cannot be used with
> 'frozen' executables (i.e., binaries produced by packages like PyInstaller and
> cx_Freeze) on POSIX systems. The 'fork' start method may work if code does not
> use threads."*

## Why the interactive prompt cannot work

The docs are direct about it:

> *"Functionality within this package requires that the `__main__` module be
> importable by the children. This is covered in Programming guidelines however
> it is worth pointing out here. This means that some examples, such as the
> `multiprocessing.pool.Pool` examples will not work in the interactive
> interpreter."*

and show the failure: `AttributeError: Can't get attribute 'f' on <module
'__main__' ...>` in each worker. A function typed at the prompt has
`__module__ == "__main__"` but no file behind it, so the child has nothing to
re-execute and nothing to import. Notebooks are the same problem wearing a
friendlier interface.

## Gotchas

### Everything works in a script and fails in the REPL or a notebook

**Symptom.** An `AttributeError` in the worker of the form the docs show:
`Can't get attribute 'f' on <module '__main__' ...>`.
**Cause.** Functions defined at the interactive prompt do not live in an
importable module, so the child cannot re-create them.
**Fix.** Put the worker function in a real module and import it:

```python
# workers.py
def work(x): return x * x
```
```python
# in the notebook
from workers import work
with ProcessPoolExecutor() as ex:
    list(ex.map(work, range(10)))
```

### The guard is present but the worker still re-runs your setup

**Symptom.** Log configuration, metrics registration or a database connection
happens once per worker.
**Cause.** That code is at module level, above the guard, so the child's
re-execution of the main module as `__mp_main__` runs it.
**Fix.** Move it into `main()`. If the workers genuinely need it, use the
executor's `initializer` parameter, which runs once per worker on purpose:

```python
ProcessPoolExecutor(initializer=configure_logging, initargs=(level,))
```

### Module-level `argparse` in a `multiprocessing` program

**Symptom.** Workers parse arguments, or exit 2, or print usage text into your
output.
**Cause.** The child restores the parent's `sys.argv` and then re-executes the
main module, so a module-level `parse_args()` runs in every worker with the same
arguments.
**Fix.** Parse inside `main`, under the guard. See
[chunk 1d](01d-sys-argv-and-a-testable-main.md).

### A frozen executable spawns copies of itself

**Symptom.** Running the packaged binary opens N windows, or N copies of the
whole application, or forks until the machine gives up.
**Cause.** In a frozen program the child re-runs the executable from the top,
and without `freeze_support()` it never reaches the worker bootstrap.
**Fix.** `multiprocessing.freeze_support()` as the first statement inside the
guard, and note the documented warning that spawn and forkserver *"generally
cannot be used with 'frozen' executables … on POSIX systems"* at all.

### Assuming `__name__ != "__main__"` means "imported"

**Symptom.** A module-level branch that behaves differently in workers than in
either the parent or a normal import.
**Cause.** In a spawn or forkserver child, the main module is re-executed under
the name `__mp_main__` — neither `"__main__"` nor its real dotted name.
**Fix.** Do not branch on `__name__` for anything except the guard itself. If a
worker needs to know it is a worker, ask
`multiprocessing.current_process().name`, or pass a flag as an argument.

### Relying on `__main__` being the same object in parent and child

**Symptom.** A value written into `__main__`'s namespace by the parent is absent
in the worker.
**Cause.** The child's `__main__` is a *new module object* produced by
re-executing the file. Nothing the parent assigned at runtime survives; only
what the module body creates on its own does.
**Fix.** Pass state explicitly as arguments, which the docs recommend anyway:
*"it is better to pass the object as an argument to the constructor for the
child process."*

### A module-level import that is expensive, in a program with many workers

**Symptom.** Worker startup dominates the run; `-X importtime` in a worker shows
the same heavy imports as the parent.
**Cause.** Every spawn/forkserver child re-executes the main module's top level,
including its imports. With `forkserver` those imports also happen once in the
server, but the main module's own imports still run per child.
**Fix.** Move heavy imports into the functions that need them, or preload them
in the forkserver with `multiprocessing.set_forkserver_preload([...])` — the
docs describe it as setting modules *"for the forkserver main process to attempt
to import so that their already imported state is inherited by forked
processes"*, and note that *"it must be called before the forkserver process has
been launched"*, so it goes under the guard alongside `set_start_method`.

## Interview questions

**★ Which launch mode is exempt from the main-module re-execution, and why?**
`python -m mypkg`, where the main module is `mypkg/__main__.py`. CPython's
`multiprocessing.spawn` checks whether the parent's main module was named
`__main__` or ends in `.__main__` and, if so, re-runs nothing in the child — the
source notes that such files *"run their 'main only' code unconditionally"*, so
re-executing them would be wrong. In every other mode the child re-executes the
main module under the run name `__mp_main__` and aliases `__main__` to it so
that unpickling can find the definitions.

**★ What is `__mp_main__`?**
The name under which a spawn or forkserver child re-executes the parent's main
module. `sys.modules['__main__']` and `sys.modules['__mp_main__']` are then made
to point at the same new module object, which is what lets a function pickled as
`("__main__", "work")` be resolved in the child. Practically it means `__name__`
in a worker is `"__mp_main__"`, so the guard correctly evaluates `False` there —
and any other test on `__name__` is unreliable.

**★ What is `freeze_support()` for?**
Programs converted into standalone executables. There the child process would
re-launch your whole application rather than a Python interpreter, so
`freeze_support()` detects that it is a `multiprocessing` child and diverts into
the worker bootstrap instead of running your `main`. It is a no-op in a normal
POSIX run, which is why the docs say the line can be omitted for programs that
will not be frozen — and they separately warn that spawn and forkserver
*"generally cannot be used with 'frozen' executables … on POSIX systems"* at all.

**Why do `multiprocessing` examples fail in the REPL?**
Because functions defined at the prompt do not belong to an importable module,
and the child needs to import the definition to unpickle the reference to it.
The docs say the package *"requires that the `__main__` module be importable by
the children"* and show the resulting `AttributeError` naming a function that
cannot be found on `__main__`. Put worker functions in a real module.

**Does the parent's runtime state reach the child?**
Only what is explicitly sent. The child receives the parent's `sys.path`,
`sys.argv`, working directory and start method, plus the pickled callable and
its arguments. Everything else is reconstructed by re-executing the main module,
so values the parent assigned at runtime are gone. The docs' guideline is to
pass resources as constructor arguments rather than relying on inheritance —
advice that is mandatory under spawn and merely wise under fork.

**How do you stop every worker paying for the same expensive import?**
Under `forkserver`, `multiprocessing.set_forkserver_preload([...])` imports the
named modules once in the server process, and every forked worker inherits them.
Beyond that, move heavy imports out of the main module's top level and into the
functions that need them, since the main module's own imports re-run in each
child under spawn.

---

← Prev: [multiprocessing and the guard](04-multiprocessing-and-the-guard.md) · Index: [if __name__ == "__main__"](README.md) · Next → [fork, threads and executors](04c-fork-threads-and-executors.md)
