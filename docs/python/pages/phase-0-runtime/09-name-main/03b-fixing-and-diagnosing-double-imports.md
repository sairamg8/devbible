---
title: "The fix is to make the runnable file define nothing, and the diagnosis is one comparison of __module__ and __file__"
sidebar_label: "3b · Fixing and diagnosing double imports"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [import system reference § Special considerations for `__main__`](https://docs.python.org/3.14/reference/import.html#special-considerations-for-main),
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html)
> (Idiomatic Usage),
> [`sys.modules`](https://docs.python.org/3.14/library/sys.html#sys.modules) and
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html).
> Version spine: **CPython 3.14.7**.

**Two module objects from one file cannot be prevented — it is how the import
cache works — so the fix is not to prevent it but to make it free. If the file
that gets executed defines nothing, duplicating it duplicates nothing, and every
symptom in [chunk 3](03-the-double-import-trap.md) disappears at once. This
chunk is that fix in code, the two-line diagnosis that identifies the bug in
under a minute, and an honest account of the `sys.modules` aliasing hack that
people reach for instead.**

## The three routes into it

1. **`python -m mypkg.cli`** when something else in the program also imports
   `mypkg.cli`. The language reference's *"still considered distinct modules"*
   note is describing exactly this.
2. **`python mypkg/cli.py`** — worse, because `sys.path[0]` becomes `mypkg/`,
   so a sibling `import helpers` creates a *third* naming of the same file:
   `helpers` as a top-level module, and `mypkg.helpers` from everywhere else.
   [Topic 08 chunk 5b](../08-imports/05b-running-a-module.md) has that path in
   full.
3. **`multiprocessing` with spawn or forkserver**, which re-executes the main
   module in every child process — see
   [chunk 4](04-multiprocessing-and-the-guard.md). This is the route most people
   meet first, because it announces itself with a `RuntimeError` rather than a
   silent `isinstance` failure.

## The fix, in code

Define nothing in the file that gets run.

```python
# mypkg/__main__.py         ← the runnable file
from mypkg.cli import main

raise SystemExit(main())
```

```python
# mypkg/cli.py              ← every definition lives here
import argparse
from mypkg.errors import ConfigError

class Job: ...
HANDLERS: dict[str, Callable] = {}

def build_parser() -> argparse.ArgumentParser: ...

def main(argv: list[str] | None = None) -> int:
    ...
```

`mypkg/__main__.py` may well be executed twice — as `__main__` and, if something
imports it, as `mypkg.__main__` — and it costs nothing, because it binds one
imported name and calls it. `cli.py` is only ever imported, so it exists once,
and so does every class in it.

That is the entire content of the advice "keep the guard body to one line". It
is not tidiness; it is making the duplicated region empty. The `__main__` docs
say the same thing about `__main__.py` files: keep them *"short"* and have them
*"import functions to execute from other modules"*, so those modules *"can then
be easily unit-tested and are properly reusable."*

The same discipline applies when you keep a guard in a normal module for
convenience:

```python
# mypkg/cli.py — a guard here is fine, as long as its body is a call
if __name__ == "__main__":
    raise SystemExit(main())
```

Running `python -m mypkg.cli` still duplicates `cli.py`, so this is a weaker
position than the `__main__.py` split — but the guard body itself contributes
nothing to the damage.

## Diagnosing it in under a minute

Two checks turn a mystifying `isinstance` failure into an obvious one:

```python
type(obj).__module__          # '__main__' where you expected 'mypkg.cli'
Job.__module__                # 'mypkg.cli'  — different string, different class
```

and the confirming comparison:

```python
import sys, mypkg.cli
sys.modules['__main__'].__file__ == mypkg.cli.__file__     # True → two copies
```

Same file behind two module objects, one of them named `__main__`, is the
definitive signature. A third check that catches the `python mypkg/cli.py`
variant:

```python
[name for name, m in sys.modules.items()
 if getattr(m, '__file__', None) == mypkg.cli.__file__]
# ['__main__', 'mypkg.cli']  — or three entries, with a bare 'cli' as well
```

## The aliasing hack, and why it is not the answer

The tempting shortcut is to make the two names share one module object:

```python
# don't do this
import sys
sys.modules['mypkg.cli'] = sys.modules['__main__']
```

This is not nonsense — CPython's own `multiprocessing.spawn` does something
structurally similar in the child, re-running the main module as `__mp_main__`
and aliasing `sys.modules['__main__']` to it — but as an application-level fix
it is fragile in three specific ways:

1. **Ordering.** It only works if it executes before anything imports
   `mypkg.cli`. Put it under the guard and any import that already happened
   during the module body has already created the second copy.
2. **It lies to the import system.** `mypkg.cli.__name__` is now `"__main__"`,
   so `pickle` still records `__main__` for classes defined there, so the
   cross-process failure remains.
3. **It hides the shape of the program.** The next person adds a class to the
   runnable module because the symptom went away.

Fixing the file layout takes the same number of lines and has none of these
properties.

## Making it impossible, structurally

The layout that cannot exhibit the bug at all:

```
mypkg/
    __init__.py     # public API, no side effects
    __main__.py     # from mypkg.cli import main; raise SystemExit(main())
    cli.py          # argparse + main(argv=None) -> int
    errors.py       # every exception class
    models.py       # every dataclass / Enum / ORM model
    engine.py       # the work
```

Rules that follow from it, each of which is separately worth having:

- **No `class` statement in any file with a guard.** Exceptions in `errors.py`,
  data types in `models.py`.
- **No module-level mutable state in a runnable file.** Registries, caches,
  pools and locks live in imported modules.
- **One `main`, three callers**: `__main__.py`, the `console_scripts` entry
  point, and tests.

## Gotchas

### The fix applied halfway

**Symptom.** The `isinstance` failure moves rather than disappearing: a
different class now fails.
**Cause.** Some definitions moved to `cli.py` and one — often a small helper
`dataclass`, or the exception class — stayed in the runnable file.
**Fix.** Grep the runnable file for `class`, `= {`, `= []`, `Lock(`, `cache`:

```bash
grep -nE '^(class |[A-Z_]+ *=|@)' mypkg/__main__.py    # should print nothing
```

### `sys.modules` aliasing under the guard

**Symptom.** The hack appears to work in a small script and fails in the real
program.
**Cause.** By the time the guard runs, the module body has already executed its
imports, and anything that imported `mypkg.cli` transitively created the second
copy before the alias was installed.
**Fix.** Fix the layout instead. If you truly cannot, the alias must be the
first statement in the file, above every import — which is itself a strong hint
that it is the wrong tool.

### Tests never reproduce it

**Symptom.** Everything passes under `pytest` and fails when a human runs the
tool.
**Cause.** `pytest` imports your modules under their real dotted names, so the
`__main__` copy never exists. The bug requires the launch mode the tests do not
use.
**Fix.** Add one test that runs the entry point the way users do:

```python
def test_module_entry_point_runs():
    proc = subprocess.run(
        [sys.executable, "-m", "mypkg", "--help"],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 0
```

That is the one place a subprocess test earns its cost — it is the only way to
exercise the `__main__` naming.

### Coverage shows the guard line as never executed

**Symptom.** A permanently uncovered line in every entry-point file.
**Cause.** Under `pytest` the module is imported, so the guard is `False` and
its body never runs. This is correct behaviour, not a gap.
**Fix.** Exclude it, and keep the body to one line so nothing meaningful is
excluded with it:

```toml
# pyproject.toml
[tool.coverage.report]
exclude_also = ['if __name__ == .__main__.:']
```

### Moving the class but leaving the import

**Symptom.** A circular import appears where there was none.
**Cause.** `models.py` now imports from `cli.py` for a constant that stayed
behind, while `cli.py` imports `models.py`.
**Fix.** Constants used by both go in a leaf module that imports nothing of
yours. [Topic 08 chunk 6b](../08-imports/06b-breaking-circular-imports.md) is
the general treatment.

### Assuming an installed console script has the problem too

**Symptom.** Time spent chasing a bug that is not there.
**Cause.** A console-script entry point *imports* `mypkg.cli` and calls
`main()`; `__name__` is never `"__main__"` in your code at all, so no second
copy is created.
**Fix.** Note the asymmetry deliberately: the installed command is immune, and
`python -m mypkg.cli` is not. If a bug reproduces under one and not the other,
this is the first thing to check — and it is the
strongest practical argument for shipping a console-script entry point rather
than telling users to run `python -m`.

## Interview questions

**★ What is the structural fix for the double-import problem, and why does it
work?**
Make the runnable file define nothing. `mypkg/__main__.py` imports `main` from
`mypkg/cli.py` and calls it; every class, constant and registry lives in
`cli.py`, which is only ever imported and therefore exists once. You cannot stop
the file from being executed twice — that is how the name-keyed import cache
works — so instead you make the duplicated region empty. It is the same reason
the docs tell you to keep `__main__.py` short and have it *"import functions to
execute from other modules"*.

**★ How do you confirm this is what is happening, rather than guessing?**
Compare `type(obj).__module__` with the checking class's `__module__`; if one
says `'__main__'` and the other says the real dotted name, that is the bug.
Confirm with `sys.modules['__main__'].__file__ == mypkg.cli.__file__` — the same
file behind two module objects is the definitive signature. Listing every
`sys.modules` entry whose `__file__` matches will also catch the three-copy
variant that `python mypkg/cli.py` produces.

**★ Why is `sys.modules['mypkg.cli'] = sys.modules['__main__']` not the fix?**
Because it has to run before anything imports `mypkg.cli`, which under the guard
it usually does not; because it leaves the module's `__name__` as `"__main__"`,
so `pickle` still writes `__main__` into every serialised class and the
cross-process failure survives; and because it removes the symptom that would
otherwise stop someone adding more definitions to the runnable file. CPython
does something similar internally in `multiprocessing`'s child bootstrap, but it
controls the ordering completely and you do not.

**Why do your tests not catch this?**
Because `pytest` imports the modules under their real dotted names, so
`__main__` is `pytest`'s own entry point and your file exists once. The bug
needs the launch mode the tests never use. The cheap remedy is a single
subprocess test that runs `python -m mypkg --help` and asserts a zero exit code
— the one case where a subprocess test is the only instrument available.

**Is an installed console script affected?**
No. The generated wrapper imports `mypkg.cli` and calls `main()`, so your module
is loaded under its real name and `__name__` is never `"__main__"` in your code.
That asymmetry is diagnostic: a bug that reproduces under `python -m mypkg.cli`
but not under the installed command is almost certainly this one.

**Why does the coverage report show the guard as uncovered forever?**
Because under the test runner the module is imported, so the guard evaluates
`False` and its body never runs. That is the guard working as designed. Exclude
the line in the coverage configuration — and keep its body to a single call so
that excluding it excludes nothing you care about.

---

← Prev: [The double-import trap](03-the-double-import-trap.md) · Index: [if __name__ == "__main__"](README.md) · Next → [multiprocessing and the guard](04-multiprocessing-and-the-guard.md)
