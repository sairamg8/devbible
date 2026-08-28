---
title: "A directory and a zipfile are entry points too, -m is just runpy, and import __main__ hands you a module that is only partly built"
sidebar_label: "2b · zipapps, runpy and import __main__"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`runpy`](https://docs.python.org/3.14/library/runpy.html),
> [`zipapp`](https://docs.python.org/3.14/library/zipapp.html),
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html)
> (`import __main__`) and
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html).
> Version spine: **CPython 3.14.7**.

**Three loose ends of the entry-point mechanism, each of which surprises someone
in production. A directory or a zip archive handed to `python` is an entry point
in exactly the same way a package is — CPython looks for `__main__.py` at its
root. `-m` is not interpreter magic but a call into `runpy`, whose documentation
is the precise specification of what an entry point's globals contain. And any
module may `import __main__` to reach the entry point's namespace, getting back
a module that is *partially populated*, with all the hazards that word implies.**

## Directories and zip archives as the script argument

The `-m` docs describe the package case as *"deliberately similar to the
handling of directories and zipfiles that are passed to the interpreter as the
script argument"*. Concretely: give `python` a directory or a `.zip`, and it
looks for `__main__.py` at the root and runs that.

```
myapp.pyz              # a zip archive
  ├── __main__.py      # entry point, at the archive root
  └── mypkg/
      ├── __init__.py
      └── cli.py
```

`python myapp.pyz` runs the archive's `__main__.py`. `zipapp` is the standard
library's tool for building these — `python -m zipapp myapp -m "mypkg.cli:main"`
generates the `__main__.py` for you.

The archive root is **not a package**, and two consequences follow:

- Relative imports in that `__main__.py` do not work — there is no parent
  package for a dot to resolve against. Absolute imports of `mypkg` do, because
  the archive itself lands on `sys.path`.
- The `__name__` guard is meaningless there, which is the documented reason the
  convention is to omit it from every `__main__.py`:

  > *"This won't work for `__main__.py` files in the root directory of a `.zip`
  > file though. Hence, for consistency, a minimal `__main__.py` without a
  > `__name__` check is preferred."*

The generated file is the two-line form:

```python
# __main__.py at the archive root
from mypkg.cli import main

main()
```

## `-m` is `runpy`

> *"The `runpy` module is used to locate and run Python modules without
> importing them first. Its main use is to implement the `-m` command line
> switch that allows scripts to be located using the Python module namespace
> rather than the filesystem."*

`runpy.run_module(mod_name, run_name=..., alter_sys=...)` is the programmatic
form, and its documentation is the authoritative list of what an entry point's
globals contain:

> *"The special global variables `__name__`, `__spec__`, `__file__`,
> `__cached__`, `__loader__` and `__package__` are set in the globals dictionary
> before the module code is executed."*

> *"`__name__` is set to *run_name* if this optional argument is not `None`, to
> `mod_name + '.__main__'` if the named module is a package and to the
> *mod_name* argument otherwise."*

> *"`__spec__` will be set appropriately for the *actually* imported module
> (that is, `__spec__.name` will always be *mod_name* or
> `mod_name + '.__main__'`, never *run_name*)."*

Two warnings in that documentation matter for anyone calling it directly. The
first is that it is not isolation:

> *"Note that this is not a sandbox module - all code is executed in the current
> process, and any side effects (such as cached imports of other modules) will
> remain in place after the functions have returned."*

> *"Furthermore, any functions and classes defined by the executed code are not
> guaranteed to work correctly after a `runpy` function has returned. If that
> limitation is not acceptable for a given use case, `importlib` is likely to be
> a more suitable choice than this module."*

The second is about threads:

> *"Note that this manipulation of `sys` is not thread-safe. Other threads may
> see the partially initialised module, as well as the altered list of
> arguments. It is recommended that the `sys` module be left alone when invoking
> this function from threaded code."*

That `alter_sys=True` behaviour — temporarily rewriting `sys.argv[0]` and
`sys.modules[__name__]`, then restoring them — is exactly what makes it unsafe
to call from a worker thread while other threads are running.

## `import __main__`

Any module can reach the entry point's namespace:

> *"Regardless of which module a Python program was started with, other modules
> running within that same program can import the top-level environment's scope
> (namespace) by importing the `__main__` module. This doesn't import a
> `__main__.py` file but rather whichever module that received the special name
> `'__main__'`."*

This works even though it is an import cycle, and the docs explain why:

> *"Python inserts an empty `__main__` module in `sys.modules` at interpreter
> startup, and populates it by running top-level code. In our example this is
> the `start` module which runs line by line and imports `namely`. In turn,
> `namely` imports `__main__` (which is really `start`). That's an import cycle!
> Fortunately, since the partially populated `__main__` module is present in
> `sys.modules`, Python passes that to `namely`."*

The word doing the work is **partially**. A module that imports `__main__` at
*its own import time* sees only the names the entry point had bound before it
reached that import — which, for anything below the guard, is nothing at all.
The docs' own example only works because the lookup happens later, inside a
function:

```python
# namely.py
import __main__

def did_user_define_their_name():
    return 'my_name' in dir(__main__)   # evaluated when called, not at import
```

Legitimate consumers are narrow: `pdb` and the REPL use it to reach the
interactive namespace, `doctest` and IPython inspect it, and `pickle` consults
it when resolving a class whose `__module__` is `"__main__"`. In application
code, reaching into `__main__` for configuration builds a dependency that works
under one launch mode and fails under the others.

## Gotchas

### A guard in a zipapp's root `__main__.py`

**Symptom.** The archive runs and does nothing.
**Cause.** At the root of a `.zip` there is no package, so the documented caveat
applies — the `__name__` check does not behave as it does inside a package.
**Fix.** Omit the guard from every `__main__.py`, package or archive, so the two
cases cannot diverge. The body is a call, not a definition, so there is nothing
to protect.

### Relative imports in a zipapp root

**Symptom.** `attempted relative import with no known parent package` from the
archive's `__main__.py`.
**Cause.** The archive root is not a package.
**Fix.** Import your code absolutely — `from mypkg.cli import main` — and put
everything inside a real package directory in the archive.

### `runpy.run_module` in a threaded program

**Symptom.** Bizarre, intermittent behaviour in another thread while the module
is being executed — a half-built module, or the wrong `sys.argv`.
**Cause.** Documented: *"this manipulation of `sys` is not thread-safe"*.
**Fix.** Run it in a subprocess, or restrict `run_module` to single-threaded
startup code. If you only want to *import*, use `importlib.import_module`, which
makes no such changes.

### Using `runpy` as a sandbox

**Symptom.** Running a user's script through `runpy` leaves the caller's
`sys.modules`, `sys.path` and monkeypatches altered afterwards.
**Cause.** The docs say it plainly: *"this is not a sandbox module - all code is
executed in the current process, and any side effects … will remain in place
after the functions have returned."*
**Fix.** `subprocess`. There is no in-process isolation here to reach for.

### Objects defined by `runpy`-executed code stop working

**Symptom.** A class returned in the globals dict behaves oddly, or its methods
fail on names that were present a moment ago.
**Cause.** Documented: *"any functions and classes defined by the executed code
are not guaranteed to work correctly after a `runpy` function has returned"* —
the temporary module they closed over is gone.
**Fix.** Use `importlib.import_module` when you want live objects; `runpy` is
for *running*, not for loading.

### Reaching into `__main__` from a library

**Symptom.** A helper works when the application is started one way and raises
`AttributeError` when it is started another, or under `pytest`.
**Cause.** `import __main__` gives whichever module happens to be the entry
point, partially populated at that moment. Under `pytest` the entry point is
`pytest`'s own console script; under `-m` it is `mypkg/__main__.py`; in a
notebook it is the kernel.
**Fix.** Pass what you need in as an argument. The `__main__` namespace is a
debugging and REPL facility, not a configuration channel.

### Reading `__main__` attributes at import time

**Symptom.** An attribute that is definitely set in the entry point is missing.
**Cause.** The importing module ran *while* the entry point's top level was
still executing, so it saw a partially populated module. Anything defined below
the import statement — and everything below the guard — did not exist yet.
**Fix.** Do the lookup inside a function that runs later, as the docs' `namely`
example does.

### Assuming a zipapp can contain C extensions

**Symptom.** `ImportError` for a compiled dependency inside the archive.
**Cause.** The import system cannot load an extension module from inside a zip;
the OS loader needs a real file.
**Fix.** Keep C-extension dependencies outside the archive, or use a different
packaging tool. `zipapp` suits pure-Python tools.

## Interview questions

**★ What is the relationship between `-m` and `runpy`?**
`-m` is implemented by `runpy`. `runpy.run_module` locates the module through
the normal import mechanism, executes it in a fresh namespace, and sets
`__name__`, `__spec__`, `__file__`, `__cached__`, `__loader__` and `__package__`
before running the body. Its documentation is therefore the precise
specification of what a `-m` entry point's globals contain, including the rule
that `__spec__.name` is the module actually imported and never the `run_name`.

**★ What does `import __main__` give you, and when is it appropriate?**
Whichever module received the name `"__main__"` in this process — not a
`__main__.py` file. It works even though it is a cycle, because CPython inserts
an empty `__main__` into `sys.modules` at startup and populates it as the
top-level code runs, so an importer gets the partially populated module. It is
appropriate for tools that inspect the interactive namespace — `pdb`, `doctest`,
IPython — and for `pickle`'s class resolution. It is not appropriate as a way
for a library to read the application's configuration, because which module is
`__main__` changes with the launch mode.

**★ Why can a directory or a zipfile be passed to `python` directly?**
Because the interpreter looks for `__main__.py` at its root and runs that — the
same rule as `-m` on a package, which the docs describe as *"deliberately
similar"*. `zipapp` builds such archives. The difference is that the archive
root is not a package, so relative imports and the `__name__` guard do not
behave as they do inside one, which is exactly the case the "minimal
`__main__.py`" convention exists to cover.

**Is `runpy` a safe way to execute untrusted code?**
No, and the documentation says so directly: it is *"not a sandbox module"*, all
code runs in the current process, and side effects such as cached imports
persist after the call returns. It also warns that functions and classes defined
by the executed code may not work correctly afterwards. Untrusted code needs a
subprocess at minimum.

**Why is `runpy.run_module` unsafe to call from a thread?**
Because with `alter_sys=True` it temporarily rewrites `sys.argv[0]` and
`sys.modules[__name__]` and restores them afterwards, and those are
process-global. The docs state that other threads *"may see the partially
initialised module, as well as the altered list of arguments"*, and recommend
leaving `sys` alone when calling it from threaded code.

**What limits a zipapp?**
Pure Python. The import system cannot load a compiled extension module from
inside a zip archive, because the platform's dynamic loader needs a real file on
disk. A zipapp is an excellent single-file distribution for a pure-Python tool
and the wrong tool for anything that depends on a wheel with a `.so` in it.

---

← Prev: [__main__.py and python -m](02-main-py-and-dash-m.md) · Index: [if __name__ == "__main__"](README.md) · Next → [The double-import trap](03-the-double-import-trap.md)
