---
title: "__name__ is an ordinary string attribute the import system sets, and the guard works because import and execution set it differently"
sidebar_label: "1 · What __name__ is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [`__main__` — Top-level code environment](https://docs.python.org/3.14/library/__main__.html),
> the [import system reference](https://docs.python.org/3.14/reference/import.html)
> and [Command line and environment](https://docs.python.org/3.14/using/cmdline.html).
> Version spine: **CPython 3.14.7**.

**There is no magic in `if __name__ == "__main__":`. `__name__` is a plain
string stored in the module's own global namespace, and the only interesting
fact about it is who writes it: the import system writes the module's dotted
name, while the five ways of *starting* a program write the literal
`"__main__"`. The guard is therefore not a "run this as a script" directive —
it is a runtime test of how the code you are reading got loaded, and every
useful and every surprising consequence in this topic follows from taking that
literally.**

## The rule, stated by the documentation

The `__main__` module docs give both halves in two sentences:

> *"When a Python module or package is imported, `__name__` is set to the
> module's name. Usually, this is the name of the Python file itself without
> the `.py` extension"*

> *"However, if the module is executed in the top-level code environment, its
> `__name__` is set to the string `'__main__'`."*

And the docs define "the top-level code environment":

> *"`__main__` is the name of the environment where top-level code is run.
> 'Top-level code' is the first user-specified Python module that starts
> running. It's 'top-level' because it imports all other modules that the
> program needs. Sometimes 'top-level code' is called an entry point to the
> application."*

Five launch modes qualify, per the same page:

| Launch | `__name__` in that code |
|---|---|
| `python helloworld.py` | `"__main__"` |
| `python -m tarfile` | `"__main__"` |
| `python -c "import this"` | `"__main__"` |
| `echo "import this" \| python` (stdin) | `"__main__"` |
| the interactive prompt | `"__main__"` |
| `import helloworld` from anywhere | `"helloworld"` |
| `from concurrent.futures import process` | `"concurrent.futures.process"` |

That last row matters more than it looks: a module inside a package gets its
**full dotted path**, not its bare filename. `mypkg/cli.py` is `"mypkg.cli"`,
never `"cli"`. Code that tries to be clever with `__name__` — a plugin registry
keyed on it, a logger name, a `__name__.split(".")[0]` to find the package —
must account for the fact that in exactly one process, one module's `__name__`
is `"__main__"` instead.

## Why the top level of a module runs at all

The half of the mechanism people skip is that importing a module **executes
it**. There is no declaration phase. `def`, `class`, decorators, module-level
constants, `logging.basicConfig(...)`, `app = FastAPI()`, a `print`, a database
connection — all of it is statements, executed top to bottom, the first time
that module name is imported.
[Topic 08](../08-imports/01-modules-and-the-cache.md) covers the cache that
makes it *once*; what matters here is that it happens **at all**, on import,
with no way to opt out.

```python
# report.py
import sys

print("building the report")          # runs on import. Every time.
rows = fetch_everything_from_the_db() # runs on import.

def render(rows): ...
```

`import report` in a test file runs the print and hits the database. This is not
a bug in the import system; it is what "import" means. The guard is the opt-out:

```python
# report.py
import sys

def fetch_everything_from_the_db(): ...
def render(rows): ...

def main() -> int:
    render(fetch_everything_from_the_db())
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

Now `import report` defines three functions and calls none of them. The
`__main__` docs state the payoff precisely:

> *"When `echo.py` is imported, the `echo` and `main` functions will be
> defined, but neither of them will be called, because `__name__ != '__main__'`."*

## Two names for one idea: script and library

The reason the idiom is worth a whole topic is that it is the only mechanism
Python gives a single file for being **both** an importable library and a
runnable program. Other languages separate the two structurally — a `main`
symbol the linker looks for, a `package main`, a `public static void main`.
Python instead makes the entry point a *property of how you launched*, decided
at runtime, and exposes it as a string.

That design has one enormous benefit and one enormous cost, and both are covered
in this topic:

- **Benefit:** any module can be executed for a demo, a self-test or a
  one-off admin task with no build step and no separate entry-point file.
- **Cost:** one file can end up loaded twice under two names in one process, as
  `__main__` and as `mypkg.cli`, producing two of everything it defines.
  [Chunk 3](03-the-double-import-trap.md) is that cost in full.

## `__name__` is writable, and that is not a feature

Nothing protects `__name__`. It is a normal global:

```python
# don't
__name__ = "__main__"     # legal, and now the guard below fires on import
```

The import system reads `__name__` in a few places (older relative-import
machinery, `runpy`, `pickle`'s class lookup by `obj.__class__.__module__`), so
rewriting it produces failures far away from the assignment. The supported
attribute for asking "what package am I in" is `__spec__.parent`; `__package__`
is
[deprecated since 3.13 and removed in 3.15](../08-imports/01c-module-attributes-and-specs.md).

## Gotchas

### The guard that is spelled slightly wrong

**Symptom.** The script runs, prints nothing, exits 0. No error anywhere.
**Cause.** `if __name__ == "__main__":` is an ordinary string comparison against
an ordinary variable. `"main"`, `"_main_"`, `"__Main__"` are all valid strings
that simply never equal `"__name__"`'s value, so the block is skipped in
silence. (The one *loud* misspelling is `__name__ == __main__` without quotes,
which raises `NameError` — and is therefore the harmless one.)
**Fix.** The comparison is exact, both dunders, lowercase:

```python
if __name__ == "__main__":
    raise SystemExit(main())
```

Linters catch this: `ruff` and `pylint` both ship a check for a suspicious
`__name__` comparison, for exactly this reason.

### Top-level side effects that only bite in tests

**Symptom.** `pytest` collection is slow, opens sockets, or fails in CI with a
connection error, before a single test runs.
**Cause.** Collecting a test module imports the module under test, which
executes its top level, which connects, reads or writes.
**Fix.** Move every effect behind a function and call it from `main()`:

```python
# before — runs at import
conn = psycopg.connect(os.environ["DATABASE_URL"])

# after — runs when someone asks
@functools.cache
def get_conn():
    return psycopg.connect(os.environ["DATABASE_URL"])
```

### `logging.getLogger(__name__)` in the entry-point module

**Symptom.** Log filtering by module name works for every module except the one
you started; its records arrive under the logger `__main__`.
**Cause.** `getLogger(__name__)` is the correct idiom and it faithfully reports
the module's `__name__` — which in the entry-point module is `"__main__"`. A
`logging` config keyed on `"myapp"` will not match it, so those records fall
through to the root logger's configuration instead of yours.
**Fix.** Name the logger explicitly in the entry point:

```python
# mypkg/__main__.py
logger = logging.getLogger("mypkg")   # not __name__: this file is "__main__"
```

The better structural answer is that the entry-point module should not log at
all — everything it does should be one call into a module that has a real name.

### Assuming `__name__` is the filename

**Symptom.** `__name__.split(".")[-1]` or a comparison to `"cli"` fails once the
module lives in a package, or once it is the entry point.
**Cause.** `__name__` for a package member is the full dotted path
(`"mypkg.cli"`), and for the entry point it is `"__main__"` regardless of the
file's name.
**Fix.** For the file, use `__file__`. For the package, use `__spec__.parent`.
For a stable identity, use a constant you wrote yourself:

```python
APP_NAME = "mypkg"          # never derived, never surprising
```

### The guard indented inside a function

**Symptom.** Code under the guard never runs, even when the file is the entry
point.
**Cause.** `__name__` inside a function body still resolves to the module
global, so the comparison itself is fine — but the function is never called,
because the only thing that would call it is the guard you just moved inside it.
**Fix.** The guard belongs at module level, at the bottom of the file, at zero
indentation. Nothing else.

### `exit()` and `quit()` in a script

**Symptom.** `exit()` works when you test it by hand and raises `NameError` in a
frozen build, an embedded interpreter, or under `python -S`.
**Cause.** `exit` and `quit` are injected into builtins by the `site` module as
a convenience for the interactive prompt, not by the language. `-S` skips
`site`; frozen and embedded builds often do too.
**Fix.** `sys.exit()` or `raise SystemExit(...)` in code that ships.

### Reassigning `__name__` to force the guard

**Symptom.** A module you import mysteriously runs its `main()`, or `pickle`
starts producing `PicklingError` for classes defined in it.
**Cause.** Someone wrote `__name__ = "__main__"` at module level. `pickle`
serialises a class by `__module__` and `__qualname__`, and `__module__` comes
from `__name__` at class-creation time — so the class now claims to live in a
module the unpickler cannot find.
**Fix.** Never assign to `__name__`. If a module needs to run its own
demonstration on import, that is what a separate `__main__.py` or a test is for.

## Interview questions

**★ What is `__name__`, precisely, and who sets it?**
It is an entry in the module's own globals dictionary holding a string. The
import system sets it to the module's fully qualified dotted name when the
module is imported. When a module is executed as the top-level code environment
— a file argument, `-m`, `-c`, stdin, or the REPL — it is set to the literal
`"__main__"` instead. Nothing else is special about it; it is readable,
writable, and just a string.

**★ Why does `if __name__ == "__main__":` work at all?**
Because the two ways of loading a module set that string differently, so
comparing it is a runtime test of *how this file was loaded*. Code under the
guard runs only when the file is the program's entry point, and is skipped when
the file was reached through an `import`. The `__main__` docs put it as: *"Code
within this block won't run unless the module is executed in the top-level
environment."*

**★ Why does importing a module run code in it at all — can't Python import just
the functions?**
There is no separate declaration phase in Python. A module body is a sequence of
statements executed top to bottom, and `def` and `class` are themselves
statements that create objects and bind names. The import system executes the
whole body to produce the module's namespace; it has no way to execute the
`def`s and skip everything else. That is why anything with an effect must be
inside a function, and why the guard exists.

**What is `__name__` for a module inside a package?**
The full dotted path — `"mypkg.cli"`, not `"cli"`. The `__main__` docs
demonstrate it with `from concurrent.futures import process`, whose `__name__`
is `'concurrent.futures.process'`. This is why `__name__` is a good logger name
(the hierarchy matches the package hierarchy) and a bad filename.

**How many ways are there to become `__main__`?**
Five, per the documentation: a file path argument, `-m`, `-c`, code piped in on
standard input, and the interactive prompt. All five set the top-level module's
`__name__` to `"__main__"`. That is worth knowing because the REPL is one of
them — pasting a snippet into the prompt runs its guard body, which is why
`multiprocessing` examples fail interactively.

**Is there anything wrong with `logging.getLogger(__name__)`?**
Not in a normal module — it is the recommended idiom, because the logger name
mirrors the package hierarchy and configuration can filter on it. In the entry
point it produces a logger named `__main__`, which no configuration keyed on
your package name will match. The clean answer is that the entry-point module
should be small enough to have nothing to log.

**Can you assign to `__name__`, and what breaks if you do?**
You can — it is a normal global — and you should not. `pickle` derives a class's
`__module__` from the `__name__` in effect when the class statement ran, so
rewriting it produces classes that claim to live in a module the unpickler
cannot import. The import machinery also consults it in places. If you want to
know which package you are in, read `__spec__.parent`.

---

← Prev: [Imports](../08-imports/README.md) · Index: [if __name__ == "__main__"](README.md) · Next → [What belongs inside the guard](01b-what-belongs-in-the-guard.md)
