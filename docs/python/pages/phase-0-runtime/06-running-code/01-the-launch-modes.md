---
title: "There are seven ways to start Python and each one sets sys.argv[0], sys.path[0] and __main__ differently — the table is worth memorising"
sidebar_label: "1 · The launch modes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (interface options), the
> [initialization of the `sys.path` module search path](https://docs.python.org/3.14/library/sys_path_init.html),
> the [import system reference](https://docs.python.org/3.14/reference/import.html)
> (special considerations for `__main__`) and
> [`runpy`](https://docs.python.org/3.14/library/runpy.html).
> Version spine: **Python 3.14.7**.

**"Run the program" is not one operation. The interpreter has seven distinct
entry paths, and they differ in three observable ways: what lands in
`sys.argv[0]`, what lands at the front of `sys.path`, and whether the `__main__`
module has a spec. Almost every "it works when I run it this way and not that
way" report is one of those three differences, and the fastest route to
diagnosing them is to have the table in your head rather than to reason it out
each time.**

## The table

| Command | `sys.argv[0]` | Front of `sys.path` | `__main__` comes from | `__main__.__spec__` |
|---|---|---|---|---|
| `python script.py` | `script.py` as typed | the **directory containing the script** | that file | `None` |
| `python dir/` | the directory as typed | the **directory itself** | `dir/__main__.py` | `None` |
| `python app.pyz` | the archive as typed | the **archive itself** | `__main__.py` inside it | `None` |
| `python -m pkg.mod` | full path to the module file | the **current directory** | `pkg.mod`, imported | the module's spec |
| `python -m pkg` | full path to the module file | the **current directory** | `pkg.__main__` | that module's spec |
| `python -c "…"` | `"-c"` | the **current directory** | the string | `None` |
| `python -` | `"-"` | the **current directory** | standard input | `None` |
| `python` (REPL) | `""` | the **current directory** | the interactive session | `None` |

Every row is documented. The script case:

> *"If the script name refers directly to a Python file, the directory containing
> that file is added to the start of `sys.path`, and the file is executed as the
> `__main__` module."*

The directory and zipfile cases:

> *"If the script name refers to a directory or zipfile, the script name is added
> to the start of `sys.path` and the `__main__.py` file in that location is
> executed as the `__main__` module."*

`-m`:

> *"Locate the module using the standard import mechanism and execute its contents
> as the `__main__` module."*
>
> *"If this option is given, the first element of `sys.argv` will be the full path
> to the module file (while the module file is being located, the first element
> will be set to `"-m"`). As with the `-c` option, the current directory will be
> added to the start of `sys.path`."*

`-c`:

> *"If this option is given, the first element of `sys.argv` will be `"-c"` and
> the current directory will be added to the start of `sys.path` (allowing
> modules in that directory to be imported as top level modules)."*

Standard input:

> *"Read commands from standard input (`sys.stdin`). If standard input is a
> terminal, `-i` is implied. If this option is given, the first element of
> `sys.argv` will be `"-"` and the current directory will be added to the start of
> `sys.path`."*

## The one column that causes the trouble

The `sys.path` column splits cleanly into two groups:

- **`python script.py`, `python dir/`, `python app.pyz`** put *the thing you
  named* at the front.
- **`-m`, `-c`, `-`, the REPL** put *the current working directory* at the front.

That is the fault line. Running a file inside a package makes the package's own
directory the search root, so the package is not importable from itself; running
with `-m` from the project root makes the project root the search root, so it is.
[Chunk 2](02-script-vs-m.md) is that difference in full, because it is the single
most common cause of `ModuleNotFoundError` in real projects.

The general mechanism — all five stages that build `sys.path`, in order — is in
[`../08-imports/02-sys-path.md`](../08-imports/02-sys-path.md). This topic is
about the launch side of it.

## The spec column, briefly

Only `-m` gives `__main__` a real module spec. The import reference:

> *"Note that `__main__.__spec__` is always `None` in the last case, *even if* the
> file could technically be imported directly as a module instead. Use the `-m`
> switch if valid module metadata is desired in `__main__`."*

The visible consequence is that **relative imports do not work in a file run as a
script** — there is no spec, so there is no package context to be relative to.
That is developed in
[`../08-imports/05b-running-a-module.md`](../08-imports/05b-running-a-module.md).

## Turning the front entry off

Every "current directory" and "script directory" entry above can be suppressed:

> *"`-P`: Don't prepend a potentially unsafe path to `sys.path`:
> `python -m module` command line: Don't prepend the current working directory.
> `python script.py` command line: Don't prepend the script's directory. If it's a
> symbolic link, resolve symbolic links. `python -c code` and `python` (REPL)
> command lines: Don't prepend an empty string, which means the current working
> directory."*

`PYTHONSAFEPATH` does the same thing through the environment. This matters for
security-sensitive programs and for reproducing "it only breaks in production"
bugs; the details and the related switches are in
[`../08-imports/02c-controlling-sys-path.md`](../08-imports/02c-controlling-sys-path.md).

## Seeing it for yourself

Rather than trusting the table, print it from whatever launch mode you are
debugging:

```python
# whereami.py
import sys
print("argv[0]  :", sys.argv[0])
print("path[0]  :", sys.path[0])
print("__name__ :", __name__)
print("__spec__ :", __spec__)
```

Run it every way — `python whereami.py`, `python -m whereami`, `python -c "import
whereami"` — from different directories. Four lines of output answer more
questions than any amount of reasoning about what *should* happen.

## Gotchas

**Symptom:** a script works from its own directory and fails from anywhere else
**Cause:** it depends on the current directory rather than on its own location — a relative data path, or an import that only resolves because cwd happened to be right
**Fix:** resolve paths against the file: `pathlib.Path(__file__).resolve().parent / "data.json"`. Never assume the process's cwd

**Symptom:** `python -m tool` finds a different `tool` than `python /path/to/tool.py` does
**Cause:** `-m` searches `sys.path` starting with the current directory; the script form names a file directly
**Fix:** that is the design. If you want the installed one, use `-m` from a directory that does not contain a shadowing file; if you want the file, name the file

**Symptom:** `sys.argv[0]` is an absolute path under `-m` and a relative one under the script form
**Cause:** the documented behaviour — `-m` sets it to *"the full path to the module file"*, the script form to the name *"as given on the command line"*
**Fix:** never parse `sys.argv[0]` for a program name. Use `sys.argv[0]` only for messages, and `__file__` (or `importlib.resources`) for locating files

**Symptom:** code that inspects `sys.argv[0]` to find the program directory breaks under `-c` or the REPL
**Cause:** `sys.argv[0]` is `"-c"` or `""` in those modes and names no file at all
**Fix:** guard on the launch mode, or stop deriving locations from `argv`

**Symptom:** a relative import fails with a message about the parent package, in a file that is inside a package
**Cause:** the file was run as a script, so `__main__.__spec__` is `None` and there is no package context
**Fix:** run it with `-m` from the project root. Full treatment in [`../08-imports/05b-running-a-module.md`](../08-imports/05b-running-a-module.md)

**Symptom:** a program behaves differently when a colleague runs it from a different directory
**Cause:** `-m`, `-c`, `-` and the REPL all put the *current directory* on `sys.path`, so what is importable depends on where you stood
**Fix:** be explicit about the intended working directory in your run instructions, or use `-P`/`PYTHONSAFEPATH` to remove the dependency entirely

## Interview questions

**★ What is the difference between `python foo.py` and `python -m foo`?**
Three differences. `sys.path[0]` becomes the directory containing `foo.py` in the
first case and the current working directory in the second. `sys.argv[0]` becomes
the name as typed versus the full path to the module file. And `-m` performs a
real import, so `__main__` has a module spec and a package context, while the
script form leaves `__spec__` as `None`. The first of those causes most import
errors; the third causes all relative-import errors.

**★ What does `sys.path[0]` contain in each launch mode?**
The script's directory for `python script.py`; the directory or archive itself
for `python dir/` and `python app.pyz`; and the current working directory for
`-m`, `-c`, `-` and the interactive interpreter. That last group is why running
the same code from a different directory can change which modules are
importable.

**★ Why does `__main__.__spec__` matter?**
Because relative imports resolve against the current module's package, which
comes from its spec. A file run as a script has no spec, so it has no package,
so `from . import helpers` cannot work. Running with `-m` performs a genuine
import and gives `__main__` a spec whose parent is the package, which is why the
same file works that way.

**★ How do you stop Python putting the script directory or the cwd on `sys.path`?**
`-P` on the command line, or `PYTHONSAFEPATH` in the environment; `-I` (isolated
mode) implies `-P` along with `-E` and `-s`. This removes an entire class of
shadowing bug at the cost of requiring your imports to resolve through installed
packages or an explicit `PYTHONPATH`.

---

← Index: [Running code](README.md) · Next → [Script versus -m](02-script-vs-m.md)
