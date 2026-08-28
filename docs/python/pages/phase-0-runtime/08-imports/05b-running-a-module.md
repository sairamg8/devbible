---
title: "python -m mypkg.module and python mypkg/module.py are not two spellings of one thing"
sidebar_label: "5b · Running a module"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (special considerations for `__main__`, `__main__.__spec__`),
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-m` and the script argument),
> [import-related attributes on module objects](https://docs.python.org/3.14/reference/datamodel.html)
> (the `__package__` deprecation),
> [`runpy`](https://docs.python.org/3.14/library/runpy.html) and
> [PEP 366](https://peps.python.org/pep-0366/).
> Target: **CPython 3.14**.

**The two ways of running a file inside a package differ in `sys.path[0]`, in the
module's name, and in whether it has a spec at all — three differences that
compound. `-m` is not a convenience wrapper around running the file; it is a real
import, with a real package context, that happens to bind the result to
`__main__`. Everything relative imports need comes from that difference, and the
one price you pay for it is that the module can end up in `sys.modules` twice.**

## `python mypkg/module.py` versus `python -m mypkg.module`

This is the single most common Python packaging question, and both halves of the
answer are already in this topic.

**`python mypkg/module.py`:**

- `sys.path[0]` becomes `mypkg/` ([chunk 2](02-sys-path.md)), so the *package* is
  not importable — only its contents, as top-level modules.
- The module is named `__main__`, and the reference states its spec is `None`:

  > *"Note that `__main__.__spec__` is always `None` in the last case, *even if*
  > the file could technically be imported directly as a module instead. Use the
  > `-m` switch if valid module metadata is desired in `__main__`."*

  With no spec there is no `parent`, so relative imports fail.
- Absolute imports of siblings *appear* to work (`import helpers` finds
  `mypkg/helpers.py` as a top-level module) — which is worse than failing,
  because it produces a second copy of that module under the wrong name.

**`python -m mypkg.module`:**

- `sys.path[0]` becomes the current directory, so `mypkg` is importable.
- `mypkg/__init__.py` runs first, as for any submodule import.
- The main module gets a real spec: *"When Python is started with the `-m`
  option, `__spec__` is set to the module spec of the corresponding module or
  package."* So `__spec__.parent` is `"mypkg"` and relative imports resolve.

There is one cost to `-m` that catches people. The reference:

> *"Note also that even when `__main__` corresponds with an importable module and
> `__main__.__spec__` is set accordingly, they're still considered *distinct*
> modules. This is due to the fact that blocks guarded by
> `if __name__ == "__main__":` checks only execute when the module is used to
> populate the `__main__` namespace, and not during normal import."*

`python -m mypkg.module` puts the module in `sys.modules` twice: once as
`__main__`, once as `mypkg.module` if anything imports it. Two executions, two
copies of every module-level object — the `isinstance` failure from
[chunk 1](01-modules-and-the-cache.md), arriving by a different road. The
standard mitigation is to keep the runnable module tiny: a `__main__.py` that
imports a `cli` module and calls one function, so the duplicated body contains
nothing worth duplicating. Topic **09 · `if __name__ == "__main__"`** *(not
written yet)* is the sequel.

## Absolute or relative — choosing on purpose

Both work; PEP 328 made absolute the default and left relative as an explicit
opt-in. The honest trade:

- **Relative (`from .models import User`)** survives renaming the top-level
  package and moving the whole subtree, keeps intra-package imports visually
  distinct from third-party ones, and is shorter. It also makes a module
  un-runnable as a script, which is a feature more often than a defect.
- **Absolute (`from myapp.models import User`)** is greppable, unambiguous in a
  traceback, works identically in a REPL paste, and does not care how the module
  was launched.

The rule that avoids the worst outcomes: **never import from your own package's
`__init__.py`.** `from mypkg import X` inside `mypkg/thing.py` requires
`mypkg/__init__.py` to have finished, which it has not if the import chain
started there — that is the [chunk 6](06-circular-imports.md) failure. Import
from the defining submodule instead, relatively or absolutely.

## What `-m` actually does, per `runpy`

`-m` is implemented by `runpy`, and its documentation names the variables that
get set — which is precisely the list that direct execution cannot provide:

> *"The special global variables `__name__`, `__spec__`, `__file__`,
> `__cached__`, `__loader__` and `__package__` are set in the globals dictionary
> before the module code is executed."*

> *"`__name__` is set to *run_name* if this optional argument is not `None`, to
> `mod_name + '.__main__'` if the named module is a package and to the *mod_name*
> argument otherwise."*

> *"`__spec__` will be set appropriately for the *actually* imported module (that
> is, `__spec__.name` will always be *mod_name* or `mod_name + '.__main__'`,
> never *run_name*)."*

Note the second quote: for `python -m mypkg`, the executed module is
`mypkg.__main__`, and its spec name says so even though `__name__` is
`"__main__"`. That is what makes relative imports inside a `__main__.py` resolve
against `mypkg`.

`runpy` also carries a warning that applies to anything doing this
programmatically:

> *"Note that this manipulation of `sys` is not thread-safe. Other threads may see
> the partially initialised module, as well as the altered list of arguments."*

## The `__main__` double-import, concretely

```
mypkg/
    __init__.py
    __main__.py        # entry point
    cli.py             # argument parsing and main()
    engine.py
```

`python -m mypkg` executes `mypkg/__main__.py` under the name `__main__`. If
anything then does `import mypkg.__main__` — a test, a plugin scan, a
`multiprocessing` child — the file executes a second time under its real name.
Two module objects, two copies of every class defined there.

The defence is structural and takes three lines:

```python
# mypkg/__main__.py
from mypkg.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
```

Nothing is *defined* in the duplicated file, so duplicating it costs nothing. All
the classes, constants and functions live in `cli.py`, which is only ever
imported once. This is the same reason a `if __name__ == "__main__":` guard
exists at all, and topic **09 · `if __name__ == "__main__"`** *(not written yet)*
takes it further into `multiprocessing`.

## PEP 366, and why its answer expired

PEP 366 existed to make relative imports work in a directly executed file:

> *"When the main module is specified by its filename, then the `__package__`
> attribute will be set to `None`. To allow relative imports when the module is
> executed directly, boilerplate similar to the following would be needed before
> the first relative import statement:"*

```python
if __name__ == "__main__" and __package__ is None:
    __package__ = "expected.package.name"
```

The PEP was already honest about its limits:

> *"Note that this boilerplate is sufficient only if the top level package is
> already accessible via `sys.path`. Additional code that manipulates `sys.path`
> would be needed in order for direct execution to work without the top level
> package already being importable."*

> *"This approach also has the same disadvantage as the use of absolute imports of
> sibling modules — if the script is moved to a different package or subpackage,
> the boilerplate will need to be updated manually."*

And on 3.14 it is on a clock, because the data model marks `__package__`
*"Deprecated since version 3.13, will be removed in version 3.15"*, at which point
it *"will cease to be set or taken into consideration by the import system or
standard library"*. There is no `__spec__.parent` equivalent of the trick —
`parent` is documented as read-only. The replacement is `python -m`, or an
installed console entry point.

## Gotchas

**Symptom:** relative imports work under `pytest` and fail when the module is run directly
**Cause:** `pytest` imports test modules as package members when `__init__.py` files are present, giving them a real package name; direct execution does not
**Fix:** expected. Do not run package modules as files — that is what `-m` and console entry points are for

**Symptom:** a module runs as a script *and* is imported, and its module-level state is duplicated
**Cause:** it exists as both `__main__` and `mypkg.module`; the reference calls these *distinct* modules, so the body ran twice
**Fix:** keep the runnable module to a `main()` call. Put the logic in a module that is only ever imported

**Symptom:** the PEP 366 `__package__ = "..."` boilerplate stops working
**Cause:** `__package__` is deprecated since 3.13 and is removed in 3.15; the import system will no longer consult it
**Fix:** delete the boilerplate and use `python -m`, or install the project and use a console entry point

**Symptom:** moving a subpackage breaks dozens of absolute imports
**Cause:** absolute imports name the whole path from the top-level package down
**Fix:** this is the case relative imports are for. Within a self-contained subtree, `from .models import User` survives the move

**Symptom:** copying a code snippet with relative imports into a REPL fails
**Cause:** the REPL's `__main__` has no package, so no dot can resolve
**Fix:** expected, and one of the arguments for absolute imports in code that is frequently pasted or demonstrated

**Symptom:** `python -m mypkg` fails with `No module named mypkg.__main__`
**Cause:** `-m` on a package executes `<pkg>.__main__`; the file does not exist
**Fix:** create `mypkg/__main__.py`. Do not move the CLI into `__init__.py` to avoid it — that makes every importer pay for the CLI's imports

**Symptom:** `sys.argv[0]` differs between `-m` and direct execution and a log line breaks
**Cause:** `-m` sets it to the full path of the module file (and to `"-m"` while the module is being located); `-c` sets it to `"-c"`
**Fix:** do not derive identity from `sys.argv[0]`. Use a constant, or `__spec__.name` when there is a spec

**Symptom:** a `runpy.run_module` call in a threaded program produces bizarre results
**Cause:** documented — the `sys` manipulation *"is not thread-safe. Other threads may see the partially initialised module"*
**Fix:** run it in a subprocess, or restrict `run_module` to single-threaded startup code

**Symptom:** an installed console entry point behaves differently from `python -m mypkg`
**Cause:** the entry point imports a function and calls it, so the module is imported under its real name and `__name__` is never `"__main__"`; anything under the guard does not run
**Fix:** keep the guard's body to a single `main()` call so both routes execute the same code

## Interview questions

**★ Why does `python mypkg/module.py` break relative imports when
`python -m mypkg.module` does not?**
Two independent reasons, both fatal on their own. Running a file sets
`sys.path[0]` to the file's directory, so `mypkg` itself is not importable; and
it names the module `__main__` with `__spec__` set to `None`, so there is no
package name for a leading dot to be resolved against. `-m` puts the current
directory on the path instead and gives `__main__` a real spec whose `parent` is
`mypkg`, so both problems disappear at once.

**★ Should a package use absolute or relative imports internally?**
Either, consistently. Relative imports survive renaming or relocating the whole
package and keep internal references visually distinct; absolute imports are
greppable and behave identically however the module is reached. The rule that
actually matters is orthogonal to the choice: a submodule must never import from
its own package's `__init__.py`, because that file is only partially executed
while its own submodules are being imported.

**Why is `python -m mypkg.module` said to import the module twice?**
Because `__main__` and `mypkg.module` are distinct entries in `sys.modules` even
when they come from one file — the reference states they are *"still considered
distinct modules"*. So anything that imports `mypkg.module` after it was run as
the main module executes the body a second time, producing two copies of every
class and every module-level object. Keeping the runnable module trivial is the
standard defence.

**Is the `if __name__ == "__main__": __package__ = "pkg"` trick still valid?**
No. It is PEP 366 boilerplate for running a package submodule as a file, and it
writes an attribute the data model deprecated in 3.13 and removes in 3.15, after
which the import system will neither set nor consult it. Use `python -m`, or
install the project and expose a console entry point.

**★ Why does running a package submodule as a file break, in two independent ways?**
Because the launch mode decides both the search path and the module identity.
`python mypkg/module.py` sets `sys.path[0]` to `mypkg/`, so the package is not
importable at all; and it binds the code to `__main__` with `__spec__` of `None`,
so there is no package name for relative imports to resolve against. Fixing one
does not fix the other, which is why `sys.path` hacks in the file never quite
work.

**How does `-m` give the main module a package context?**
It performs a real import through `runpy`, which sets `__name__`, `__spec__`,
`__file__`, `__cached__`, `__loader__` and `__package__` before executing the
body. The spec name is the module's actual dotted name — or `pkg.__main__` when a
package is named — so `__spec__.parent` is the package and relative imports
resolve normally.

**What does `python -m mypkg` run, exactly?**
`mypkg/__main__.py`, executed under the name `__main__` but with a spec whose
name is `mypkg.__main__`. The command-line docs describe the behaviour as
*"deliberately similar to the handling of directories and zipfiles that are
passed to the interpreter as the script argument"* — but unlike those, `-m` puts
the *current* directory on `sys.path`, not the package directory, so the package
itself remains importable.

---

← Prev: [Absolute and relative imports](05-relative-imports.md) · Index: [Imports](README.md) · Next → [Circular imports](06-circular-imports.md)
