---
title: "__main__.py is what python -m runs for a package, and it conventionally has no guard because nothing ever imports it by accident"
sidebar_label: "2 · __main__.py and python -m"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html)
> (`__main__.py` in Python Packages, Idiomatic Usage),
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (the `-m` option) and
> [`runpy`](https://docs.python.org/3.14/library/runpy.html).
> Version spine: **CPython 3.14.7**.

**A package cannot be executed, but a module inside it can, and `-m` on a
package name is defined to execute the submodule `__main__`. That file gets
`__name__ == "__main__"` like any entry point, but unlike a script it also gets
a real spec whose name is `mypkg.__main__` — so relative imports work inside it.
Because nothing ever reaches it by an ordinary import, the documented convention
is that `__main__.py` carries no guard at all: it is two or three lines that
import a function and call it.**

## What `-m` does with a package

The command-line documentation:

> *"Locate the module using the standard import mechanism and execute its
> contents as the `__main__` module."*

> *"Package names (including namespace packages) are also permitted. When a
> package name is supplied instead of a normal module, the interpreter will
> execute `<pkg>.__main__` as the main module. This behaviour is deliberately
> similar to the handling of directories and zipfiles that are passed to the
> interpreter as the script argument."*

So `python -m mypkg`:

1. imports `mypkg` — meaning `mypkg/__init__.py` runs, in full, first;
2. locates `mypkg.__main__`;
3. executes it with `__name__` set to `"__main__"`.

The `__main__` docs give the canonical layout:

```
bandclass
  ├── __init__.py
  ├── __main__.py
  └── student.py
```

> *"`__main__.py` will be executed when the package itself is invoked directly
> from the command line using the `-m` flag."*

## Why `__main__.py` has no guard

> *"The content of `__main__.py` typically isn't fenced with an
> `if __name__ == '__main__'` block. Instead, those files are kept short and
> import functions to execute from other modules. Those other modules can then
> be easily unit-tested and are properly reusable."*

A guard protects against being *imported*, and nothing imports
`mypkg.__main__` in normal operation. A file that only ever runs as an entry
point does not need to ask whether it is one.

The docs note the guard would still work — with one exception that is the actual
reason for the convention:

> *"If used, an `if __name__ == '__main__'` block will still work as expected
> for a `__main__.py` file within a package, because its `__name__` attribute
> will include the package's path if imported"*

> *"This won't work for `__main__.py` files in the root directory of a `.zip`
> file though. Hence, for consistency, a minimal `__main__.py` without a
> `__name__` check is preferred."*

At the root of a zipapp there is no package around the file, so there is no
dotted name to distinguish "imported" from "run". [Chunk 2b](02b-zipapps-runpy-and-import-main.md)
covers that case. The standard library follows its own advice: the docs point at
`venv`, *"an example of a package with a minimal `__main__.py` in the standard
library. It doesn't contain a `if __name__ == '__main__'` block."*

The file, in full:

```python
# mypkg/__main__.py
from mypkg.cli import main

raise SystemExit(main())
```

Three lines, **nothing defined**, nothing to duplicate. That last property is
the subject of [chunk 3](03-the-double-import-trap.md) and is the real reason to
write it this way.

## Relative imports work inside `__main__.py`

`runpy`, which implements `-m`, documents what it sets:

> *"The special global variables `__name__`, `__spec__`, `__file__`,
> `__cached__`, `__loader__` and `__package__` are set in the globals dictionary
> before the module code is executed."*

> *"`__spec__` will be set appropriately for the *actually* imported module
> (that is, `__spec__.name` will always be *mod_name* or
> `mod_name + '.__main__'`, never *run_name*)."*

So under `python -m mypkg`, the executed module has `__name__ == "__main__"` and
`__spec__.name == "mypkg.__main__"`. A leading dot resolves against
`__spec__.parent`, which is `"mypkg"`, so the docs' own example works:

```python
# bandclass/__main__.py
import sys
from .student import search_students

student_name = sys.argv[1] if len(sys.argv) >= 2 else ''
print(f'Found student: {search_students(student_name)}')
```

Contrast a plain script: `python mypkg/__main__.py` sets `__spec__` to `None`,
so the same relative import raises.
[Topic 08 chunk 5b](../08-imports/05b-running-a-module.md) covers that asymmetry
in detail.

## The other things `-m` implies

- **`sys.path[0]` is the current directory**, not the package directory. That is
  what makes `mypkg` importable at all. Running the file directly puts `mypkg/`
  on the path instead, which makes the package invisible.
- **`sys.argv[0]` is the full path to the module file** once located, and the
  literal `"-m"` while it is being located.
- **`-m` works on precompiled modules** — the docs note it *"can still be used
  for precompiled modules, even if the original source file is not available"* —
  but not on C extension modules, which have no Python file to execute.
- **Namespace packages are permitted**, so a `__main__.py` in a PEP 420
  namespace portion is runnable.
- **`-m` raises an auditing event**, `cpython.run_module`, with the module name
  as its argument — which is how an audit hook can see what a process was asked
  to run.

## The three-file shape for a package with a CLI

```
mypkg/
    __init__.py     # public API. No CLI, no side effects, minimal imports.
    __main__.py     # 3 lines: import main, call it.
    cli.py          # argparse, main(argv=None) -> int, the actual code.
    engine.py       # the work.
```

```python
# mypkg/cli.py
import argparse, sys

def build_parser() -> argparse.ArgumentParser: ...

def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run(args)
```

```python
# mypkg/__main__.py
from mypkg.cli import main

raise SystemExit(main())
```

```toml
# pyproject.toml
[project.scripts]
mytool = "mypkg.cli:main"
```

Three callers, one `main`. `python -m mypkg`, the installed `mytool` command,
and a direct `from mypkg.cli import main` in a test all execute the same
function with the same signature.

## Gotchas

### `python -m mypkg` fails with `No module named mypkg.__main__`

**Symptom.** Exactly that message, even though `import mypkg` works.
**Cause.** `-m` on a package name executes `<pkg>.__main__`, and the file does
not exist.
**Fix.** Create `mypkg/__main__.py` with the three lines above. Do **not** move
the CLI into `__init__.py` to avoid creating the file — see the next gotcha.

### The CLI lives in `__init__.py`

**Symptom.** `import mypkg` in a library consumer is slow, pulls in `requests`
and `rich`, or reconfigures logging.
**Cause.** `python -m mypkg` imports `__init__.py` first, so people put the
entry point there to make that work.
**Fix.** `__init__.py` holds the public API and as few imports as possible;
`__main__.py` holds three lines; `cli.py` holds the actual command-line code.
Three files, three jobs, as above.

### `python -m mypkg` runs `__init__.py`'s side effects

**Symptom.** Starting the CLI connects to a database or reads a config file
before argument parsing, so even `--help` fails on a machine with no config.
**Cause.** `-m` on a package imports the package first. Everything at the top
level of `__init__.py` runs before `__main__.py` starts.
**Fix.** Keep `__init__.py` free of effects. If lazy re-export is what you want,
PEP 562's module-level `__getattr__` gives it without an import-time cost — see
[topic 08 chunk 4](../08-imports/04-packages-and-init.md).

### Two entry points that drift

**Symptom.** `python -m mypkg` and `python -m mypkg.cli` behave differently, or
the installed console script does something a third way.
**Cause.** Each was given its own body over time.
**Fix.** One `main()`, three thin callers, as in the layout above.

### `python -m my-package` with a hyphen

**Symptom.** `No module named my-package`.
**Cause.** `-m` takes a *module* name, and a hyphen is not valid in a Python
identifier. The docs note the implementation *"may not always enforce this"*,
which makes the failure inconsistent rather than absent.
**Fix.** The distribution on PyPI may be `my-package`; the importable package is
`my_package`. Use the underscore form with `-m`, and ship a console script if
you want the hyphenated command.

### `python -m` on a C extension or built-in module

**Symptom.** A complaint that the module cannot be executed.
**Cause.** The docs: *"This option cannot be used with built-in modules and
extension modules written in C, since they do not have Python module files."*
**Fix.** Nothing to fix in the extension — write a small Python wrapper module
if you need an entry point for it.

### Assuming `-m` and running the file are interchangeable

**Symptom.** `python mypkg/__main__.py` gives `ImportError: attempted relative
import with no known parent package`, or silently imports a second copy of a
sibling module.
**Cause.** The two modes differ in `sys.path[0]` and in whether `__spec__`
exists. Only `-m` provides a package context.
**Fix.** Use `-m`, or install the project and use the console script. There is
no `sys.path` manipulation inside the file that fixes both differences.

## Interview questions

**★ What does `python -m mypkg` actually run?**
`mypkg/__main__.py`, executed under the name `__main__` but with a spec whose
name is `mypkg.__main__`. Before that it imports `mypkg` itself, so
`__init__.py` runs in full first. It also puts the *current* directory on
`sys.path` — not the package directory — which is what makes the package
importable, and sets `sys.argv[0]` to the module file's full path.

**★ Why does `__main__.py` conventionally not have an
`if __name__ == "__main__":` guard?**
Because nothing imports it in normal operation, so there is nothing to guard
against; and because the guard does not work at the root of a zipapp, where
there is no package name to distinguish import from execution. The docs
recommend omitting it *"for consistency"* so the two cases cannot diverge, and
keeping the file to a couple of lines that import a function and call it.

**★ Why do relative imports work inside `__main__.py` but not in a script?**
Because `-m` performs a real import. `runpy` sets `__spec__` to the spec of the
module it actually imported — `mypkg.__main__` — so `__spec__.parent` is
`"mypkg"` and a leading dot has something to resolve against. A file passed as a
script argument gets `__spec__ = None`, so there is no package context at all.

**Where should a package's command-line code live?**
In an ordinary module — `mypkg/cli.py` — with `main()` defined there.
`__main__.py` imports and calls it, the project's `console_scripts` entry point
names the same function, and a test imports it directly. `__init__.py` should
not know the CLI exists, because every library consumer pays for whatever it
imports.

**What runs first when you type `python -m mypkg`?**
`mypkg/__init__.py`, in full — `-m` on a package is a package import followed by
the execution of its `__main__` submodule. That ordering is why a heavyweight
`__init__.py` makes even `--help` slow, and why side effects there fire before
any argument has been looked at.

**Can `-m` run a namespace package or a module with no source file?**
Yes to both, within limits. Namespace packages are explicitly permitted, and the
docs say `-m` *"can still be used for precompiled modules, even if the original
source file is not available"*. It cannot run built-in or C extension modules,
because there is no Python module file to execute.

---

← Prev: [sys.argv and a testable main](01d-sys-argv-and-a-testable-main.md) · Index: [if __name__ == "__main__"](README.md) · Next → [zipapps, runpy and import __main__](02b-zipapps-runpy-and-import-main.md)
