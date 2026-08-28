---
title: "if __name__ == \"__main__\": a string comparison that decides whether a file is a library or a program, and the only thing standing between multiprocessing and an infinite loop"
sidebar_label: "09 · if __name__ == \"__main__\""
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html),
> the [import system reference § Special considerations for `__main__`](https://docs.python.org/3.14/reference/import.html#special-considerations-for-main),
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html),
> [`runpy`](https://docs.python.org/3.14/library/runpy.html),
> [`sys`](https://docs.python.org/3.14/library/sys.html),
> [`os.fork`](https://docs.python.org/3.14/library/os.html#os.fork),
> [`multiprocessing`](https://docs.python.org/3.14/library/multiprocessing.html),
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)
> and CPython's
> [`Lib/multiprocessing/spawn.py`](https://github.com/python/cpython/blob/3.14/Lib/multiprocessing/spawn.py).
> Version spine: **CPython 3.14.7**.

**`__name__` is a plain string in a module's own globals. The import system sets
it to the module's dotted name; the five ways of *starting* a program set it to
the literal `"__main__"`. That is the entire mechanism, and everything difficult
about this topic is a second-order consequence of it: that a module's top level
runs on import whether you want it to or not, that one file can end up loaded
twice under two names with two of every class it defines, and that a
`multiprocessing` child re-imports your main module — so a program that starts
processes at module level starts them again in every child, recursively, until
CPython stops it with a `RuntimeError`.**

The single most out-of-date piece of folklore about this topic is that the guard
is "a Windows thing". **Python 3.14 changed the default start method on POSIX
from `fork` to `forkserver`**, and forkserver children re-import the main module
exactly the way spawn children do. Code that ran for a decade on Linux without a
guard raises on 3.14.

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `__name__` is](01-what-name-is.md)** | The string, who sets it, the five top-level environments, why importing executes the body, and why `__name__` is writable but must not be written |
| 1b | **[What belongs inside the guard](01b-what-belongs-in-the-guard.md)** | Module scope versus function scope; `app = FastAPI()` outside and `uvicorn.run(app)` inside; `set_start_method` inside; `asyncio.run` |
| 1c | **[The entry-point contract](01c-the-entry-point-contract.md)** | `sys.exit(main())` as an interface with pip's console-script wrapper; what `main()` may return; why `SystemExit` is a `BaseException` |
| 1d | **[`sys.argv` and a testable `main`](01d-sys-argv-and-a-testable-main.md)** | The six things `sys.argv[0]` can hold; `main(argv=None)`; `argparse` construction versus parsing; `surrogateescape` |
| 2 | **[`__main__.py` and `python -m`](02-main-py-and-dash-m.md)** | What `-m` does with a package; why `__main__.py` carries no guard; relative imports inside it; the three-file layout for a package with a CLI |
| 2b | **[zipapps, `runpy` and `import __main__`](02b-zipapps-runpy-and-import-main.md)** | Directories and archives as entry points; `-m` as a call into `runpy`; the partially populated `__main__` module |
| 3 | **[The double-import trap](03-the-double-import-trap.md)** | `__main__` and `mypkg.cli` are distinct modules; eleven ways that shows up, from `isinstance` to `pickle` to ORM model registration |
| 3b | **[Fixing and diagnosing double imports](03b-fixing-and-diagnosing-double-imports.md)** | Make the runnable file define nothing; the `__module__`/`__file__` diagnosis; why the `sys.modules` aliasing hack is not the answer |
| 4 | **[`multiprocessing` and the guard](04-multiprocessing-and-the-guard.md)** | The 3.14 start-method change; what spawn, fork and forkserver each do; the bootstrapping `RuntimeError` and why it is never a false positive |
| 4b | **[What the child does to `__main__`](04b-what-the-child-does-to-main.md)** | The `__mp_main__` re-execution; the one launch mode that is exempt; `freeze_support`; why the REPL cannot work |
| 4c | **[fork, threads and forkserver](04c-fork-threads-and-executors.md)** | Why forking a threaded process was never safe; the 3.12 `DeprecationWarning`; what forkserver buys and costs; the resource tracker |

## The mechanism, in one pass

1. Every module has a `__name__` in its own globals.
2. The **import system** sets it to the module's fully qualified dotted name —
   `"mypkg.cli"`, never `"cli"`.
3. **Starting a program** sets it to `"__main__"` instead. Five things count as
   starting a program: a file argument, `-m`, `-c`, code on stdin, and the
   interactive prompt.
4. So `if __name__ == "__main__":` is a runtime test of *how this file was
   loaded*, and its body runs only on the launch path.
5. Because the import cache is keyed on the **name**, `__main__` and
   `mypkg.cli` are two cache entries. One file, two module objects, two
   executions, two of every class.
6. `multiprocessing`'s spawn and forkserver children are fresh interpreters, so
   they re-execute your main module to rebuild the namespace a pickled function
   came from. Anything at module level runs again, per worker.

Steps 5 and 6 are the ones that produce production incidents, and they are
chunks 3 and 4.

## Why this is an Understand row, not a Know row

You cannot ship a Python CLI, a Celery worker, a data pipeline or anything using
`ProcessPoolExecutor` without meeting this. The guard itself takes ten seconds
to learn; what takes a career to learn the hard way is that

- an `isinstance` check can be `False` for an object of visibly the right class,
- an `except MyError:` clause can miss a `MyError`,
- and a program that has worked on Linux since 3.6 can raise on 3.14

and that all three are the same fact about module names, seen from three angles.

## Where this connects

- **[Topic 08 — Imports](../08-imports/README.md)** is the prerequisite: the
  cache keyed on module name, `sys.path[0]` per launch mode, and the
  [`-m` versus a file](../08-imports/05b-running-a-module.md) asymmetry all come
  from there.
- **[Topic 02 — The GIL](../02-the-gil/README.md)** is why `multiprocessing`
  exists at all, and therefore why the guard matters as much as it does.
- **11 · Startup and import cost** *(not written yet)* picks up the other half
  of "the module body runs": that you pay for it, once per process, and a
  spawn-based worker pool pays for it once per worker.
- **Phase 7 — Packaging** turns `[project.scripts]` and the `console_scripts`
  entry point from a footnote here into the shipping story.
- **Phase 8 — Concurrency** takes the start methods introduced in chunks 4–4c
  and turns them into the threads-versus-processes-versus-asyncio decision.

---

← Prev: [Imports](../08-imports/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [What __name__ is](01-what-name-is.md)
