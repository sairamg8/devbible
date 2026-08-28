---
title: "sys.path is built at startup from five sources, and the first entry depends on how you launched Python"
sidebar_label: "2 · sys.path"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [initialization of the `sys.path` module search path](https://docs.python.org/3.14/library/sys_path_init.html),
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (interface options and `PYTHONPATH`),
> the [`site`](https://docs.python.org/3.14/library/site.html) module docs, and
> the [import system reference](https://docs.python.org/3.14/reference/import.html)
> (the path based finder). The `pytest` behaviour is verified against
> [pytest — import mechanisms and `sys.path`](https://docs.pytest.org/en/stable/explanation/pythonpath.html).
> Target: **CPython 3.14**.

**`sys.path` is an ordinary list of strings, assembled once during interpreter
startup from five sources in a fixed order, and searched top to bottom on every
import that misses the cache. The single most consequential entry is the first
one, and what goes there is decided not by your project layout but by the command
you typed. That is the whole reason a program can work under `python -m app` and
fail under `python app/__main__.py`, or work in your shell and fail in a
container whose working directory is different.**

## The five stages, in order

The `sys.path` initialisation page states the sequence directly. Stage 1:

> *"The first entry in the module search path is the directory that contains the
> input script, if there is one. Otherwise, the first entry is the current
> directory, which is the case when executing the interactive shell, a `-c`
> command, or `-m` module."*

Stage 2:

> *"The `PYTHONPATH` environment variable is often used to add directories to the
> search path. If this environment variable is found then the contents are added
> to the module search path."*

Stage 3:

> *"The next items added are the directories containing standard Python modules
> as well as any extension modules that these modules depend on. Extension
> modules are `.pyd` files on Windows and `.so` files on other platforms. The
> directory with the platform-independent Python modules is called `prefix`. The
> directory with the extension modules is called `exec_prefix`."*

Stage 4 — how `prefix` is located — matters mostly when it goes wrong:

> *"The `PYTHONHOME` environment variable may be used to set the `prefix` and
> `exec_prefix` locations. Otherwise these directories are found by using the
> Python executable as a starting point and then looking for various 'landmark'
> files and directories. Note that any symbolic links are followed so the real
> Python executable location is used as the search starting point."*

Stage 5:

> *"Finally, the `site` module is processed and `site-packages` directories are
> added to the module search path."*

So the resulting order is, roughly: **your directory → `PYTHONPATH` → the
standard library → site-packages**. Everything about "which copy of this module
did I get?" is a question about that ordering, and the answer is always "the
earliest entry that matched".

Note what is *not* in the list: there is no automatic entry for the parent of
your package, no entry for the git repository root, and nothing that reads
`pyproject.toml`. If your imports resolve in a checkout, it is because one of
these five stages put the right directory on the list — usually stage 1 or an
editable install's `.pth` file in stage 5.

## Stage 1 is decided by the command line, not by the files

This is the table worth memorising. The command-line documentation specifies each
case:

| How you launched | What lands at the front of `sys.path` |
|---|---|
| `python script.py` | *"the directory containing that file"* |
| `python dir/` or `python app.zip` | *"the script name is added"* — the directory or zipfile itself |
| `python -m pkg.mod` | *"the current directory will be added to the start of `sys.path`"* |
| `python -c "…"` | *"the current directory will be added to the start of `sys.path`"* |
| `python` (REPL) | the current directory |
| `python -` (stdin) | *"the current directory will be added to the start of `sys.path`"* |

Verbatim, for the two that people conflate:

> *"`<script>` — If the script name refers directly to a Python file, the
> directory containing that file is added to the start of `sys.path`. If the
> script name refers to a directory or zipfile, the script name is added to the
> start of `sys.path`."*

> *"If no interface option is given, `-i` is implied, `sys.argv[0]` is an empty
> string (`""`) and the current directory will be added to the start of
> `sys.path`."*

**`python script.py` uses the script's directory. `python -m` uses the current
working directory.** They coincide only when you run from the directory the
script lives in, which is exactly how everybody tests it and never how CI or a
container runs it.

Concretely, for this tree:

```
myproject/
    mypkg/
        __init__.py
        main.py
        helpers.py
    tests/
```

- `cd myproject && python -m mypkg.main` puts `myproject/` first, so `mypkg` is
  importable and relative imports inside it work.
- `cd myproject && python mypkg/main.py` puts `myproject/mypkg/` first, so
  `mypkg` is **not** importable at all, `helpers` *is* importable as a top-level
  module, and every relative import in `main.py` fails. That is the subject of
  chunk [5 · Relative imports](05-relative-imports.md).

The `-P` flag's own documentation makes the distinction explicit by describing
what it removes in each case:

> *"`python -m module` command line: Don't prepend the current working directory.
> `python script.py` command line: Don't prepend the script's directory. If it's
> a symbolic link, resolve symbolic links. `python -c code` and `python` (REPL)
> command lines: Don't prepend an empty string, which means the current working
> directory."*

Note the detail hidden in that quote: for `-c` and the REPL the entry is an
**empty string**, which the import machinery interprets as the current working
directory *at the time of each import*, not a snapshot of it. Code that calls
`os.chdir()` and then imports something therefore searches a different directory
than it did a moment earlier. For `python script.py` the entry is a resolved
absolute path and does not move.

## `-m` has one more rule: a package name runs its `__main__`

> *"Package names (including namespace packages) are also permitted. When a
> package name is supplied instead of a normal module, the interpreter will
> execute `<pkg>.__main__` as the main module. This behaviour is deliberately
> similar to the handling of directories and zipfiles that are passed to the
> interpreter as the script argument."*

So `python -m mypkg` requires `mypkg/__main__.py`, and `python mypkg/` (as a
directory argument) requires the same file. The two are not equivalent, though:
the directory form puts `mypkg/` itself at the front of `sys.path`, while `-m`
puts the current directory there, so `mypkg` is importable as a package only in
the second case. A `__main__.py` that does `from . import thing` therefore works
under `python -m mypkg` and fails under `python mypkg/`.

`-m` also changes `sys.argv[0]`:

> *"If this option is given, the first element of `sys.argv` will be the full path
> to the module file (while the module file is being located, the first element
> will be set to `"-m"`)."*

and for `-c`:

> *"If this option is given, the first element of `sys.argv` will be `"-c"`…"*

Anything that derives a program name or a base directory from `sys.argv[0]` needs
to cope with all three shapes.

## Why zipapps and directories are a separate case

A directory or a zipfile passed as the script argument is added to `sys.path`
*itself*, not its parent. That is what makes a zipapp work: the archive goes on
the path, and `__main__.py` inside it is executed. It is also why the pure-Python
restriction bites there — an extension module inside the archive cannot be
imported, because the zip importer cannot hand a `.so` to the dynamic linker.

## What `pytest` does to `sys.path`, and why it matters here

`pytest` is the third most common way a Python file gets executed, and it does
not use any of the interface options above — it imports your test modules itself.
Under its default `prepend` import mode, *"the directory path containing each
module will be inserted into the beginning of `sys.path` if not already there"* —
for a test file inside a package, that directory is the parent of the topmost
directory still containing an `__init__.py`. Two consequences follow directly
from this chunk:

- A test run can put a directory on `sys.path` that no production launch ever
  puts there, so an import that only works under `pytest` is a real bug that will
  surface in deployment.
- If the same file is reachable both as `mypkg.thing` and as `thing`, that
  insertion is usually what made it so — and chunk
  [1](01-modules-and-the-cache.md) covers what two executions of one file do to
  `isinstance`.
- Test files outside packages land in the global module namespace, so pytest
  documents that *"each test file needs to have a unique name compared to the
  other test files, otherwise pytest will raise an error if it finds two tests
  with the same name"*. Two `tests/unit/test_api.py` and
  `tests/integration/test_api.py` collide for a pure `sys.modules` reason.

The durable fix is a `src/` layout plus an editable install, so that the only way
to reach your code is the installed package, identically in tests and in
production. Phase 7 makes that concrete.

## Gotchas

**Symptom:** `python -m mypkg.main` works, `python mypkg/main.py` raises `ModuleNotFoundError: No module named 'mypkg'`
**Cause:** `-m` prepends the current directory (so the project root is on the path); running a file prepends the *file's* directory, which is inside the package
**Fix:** use `python -m`. If a file must be runnable directly, make the project installable and give it a console entry point — the same conclusion Phase 7 reaches

**Symptom:** an import works in your shell and fails in the container, same image, same code
**Cause:** the container's `WORKDIR` differs, and stage 1 for `-m`, `-c` and the REPL is the *current* directory
**Fix:** never rely on the cwd. Install the package (editable in dev), or set `WORKDIR` explicitly and treat it as part of the contract

**Symptom:** imports start resolving differently after the program calls `os.chdir()`
**Cause:** under `-c`, the REPL, or stdin, `sys.path[0]` is the empty string, which means "the current working directory" evaluated at import time
**Fix:** resolve the path once at startup (`sys.path[0] = os.getcwd()`) if you must chdir, or better, do not depend on cwd-relative imports at all

**Symptom:** `python -m mypkg` fails with `No module named mypkg.__main__`
**Cause:** `-m` on a package name executes `<pkg>.__main__`, and the file is missing
**Fix:** add `mypkg/__main__.py`. Note it is a *separate* file from `__init__.py`; putting the CLI in `__init__.py` makes every importer pay for it

**Symptom:** a script works when run from the IDE's green arrow and fails from the terminal
**Cause:** the IDE run configuration sets a working directory (and often a `PYTHONPATH`) that your shell does not
**Fix:** compare `sys.path[0]` and the cwd in both. Configure the IDE to use the same `-m` invocation the project actually ships

**Symptom:** `pytest` refuses to collect two test files with the same basename in different directories
**Cause:** without `__init__.py` files each test module is imported as a top-level name, so both want the same `sys.modules` key
**Fix:** add `__init__.py` files to the test directories, which pytest explicitly recommends, or switch to the `importlib` import mode

**Symptom:** an import succeeds under `pytest` and fails under `python -m myapp`
**Cause:** `pytest` inserted a rootdir onto `sys.path` that no production launch inserts
**Fix:** treat it as a real defect, not a test-config problem. A `src/` layout plus an editable install makes the two paths identical

**Symptom:** `sys.argv[0]` is `"-c"` or the module's file path rather than the script name you expected
**Cause:** documented per interface option — `-c` sets it to `"-c"`, `-m` sets it to the full path of the module file, and with no interface option it is the empty string
**Fix:** do not derive program names or base directories from `sys.argv[0]`. Use `importlib.resources` for data and an explicit constant for the program name

## Interview questions

**★ What is the first entry of `sys.path`, and what decides it?**
The command you ran, not the project layout. For `python script.py` it is the
directory containing the script; for a directory or zipfile argument it is that
directory or zipfile; for `-m`, `-c`, stdin and the REPL it is the current
working directory (an empty string, meaning "cwd at import time", in the last
three). Since imports are resolved by walking `sys.path` in order, that first
entry outranks the standard library and site-packages — which is why both the
shadowing bug and the "works on my machine" class of failure live here.

**★ Why does `python -m mypkg.main` work when `python mypkg/main.py` does not?**
`-m` prepends the current directory, so the project root is on `sys.path` and
`mypkg` is importable as a package. Running the file prepends
`mypkg/`, so the package directory's *contents* are top-level modules and the
package itself is not importable — every absolute `import mypkg.x` fails and
every relative import fails for a different reason (the module's `__spec__.parent`
is empty). The fix is `-m`, or a real console entry point.

**★ In what order is `sys.path` assembled?**
Script directory or cwd; then `PYTHONPATH`; then the standard library directories
derived from `prefix`/`exec_prefix`; then, once `site` runs, the site-packages
directories and anything their `.pth` files add. Earlier entries win. That
ordering explains why `PYTHONPATH` can override an installed package but not a
file sitting next to your script, and why a file next to your script can override
the standard library.

**★ What is the difference between `python -m mypkg` and `python mypkg/`?**
Both end up executing `mypkg/__main__.py`, and the docs say the behaviours are
deliberately similar. The difference is `sys.path[0]`: `-m` prepends the current
directory, so `mypkg` is importable as a package and relative imports inside
`__main__.py` resolve; the directory form prepends `mypkg/` itself, so the
package is not importable and relative imports fail. The same asymmetry applies
to a zipapp, which is why a zipapp's entry point should use absolute imports of
packages *inside* the archive.

**How does `pytest` change the picture?**
It imports test modules itself rather than launching them, and its default import
mode inserts the rootdir of each test package onto `sys.path`. That is a path
entry no production launch creates, so it can make a broken import look healthy,
and it can make the same source file reachable under two module names — which
produces two class objects and `isinstance` failures. A `src/` layout plus an
editable install removes both possibilities by making the installed package the
only route to your code.

---

← Prev: [Cache surgery](01d-cache-surgery.md) · Index: [Imports](README.md) · Next → [`PYTHONPATH`, site-packages and `.pth`](02b-pythonpath-and-site-packages.md)
