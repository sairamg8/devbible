---
title: "Running code: seven entry paths into the interpreter, and the sys.path[0] difference between two of them that causes most ModuleNotFoundError reports"
sidebar_label: "06 · Running code"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html),
> [the `sys.path` initialization page](https://docs.python.org/3.14/library/sys_path_init.html),
> the [import system reference](https://docs.python.org/3.14/reference/import.html),
> [`runpy`](https://docs.python.org/3.14/library/runpy.html),
> [`zipapp`](https://docs.python.org/3.14/library/zipapp.html),
> [Python Development Mode](https://docs.python.org/3.14/library/devmode.html) and
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html).
> Version spine: **Python 3.14.7**.

**`python file.py` and `python -m package.module` are not two spellings of one
command. The first puts the file's own directory at the front of `sys.path`; the
second puts the current working directory there and performs a real import. That
single difference decides whether your package is importable, whether relative
imports work, and whether `__main__` has a module spec — and it is the mechanism
behind most of the `ModuleNotFoundError` reports that get blamed on Python being
confusing about paths.**

This topic is the launch side of the interpreter. The general import machinery —
all five stages that build `sys.path`, the shadowing rules, relative imports —
belongs to [08 · Imports](../08-imports/README.md), and this topic links there
rather than repeating it. What lives here is everything that is decided *by the
command you typed*.

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The launch modes](01-the-launch-modes.md)** | The table: `sys.argv[0]`, the front of `sys.path` and `__main__.__spec__` for scripts, directories, zipfiles, `-m`, `-c`, stdin and the REPL; turning the front entry off with `-P` |
| 2 | **[Script versus `-m`](02-script-vs-m.md)** | One project run four ways; why running a file inside a package breaks its imports; flat versus src layout; the four fixes; and six reasons `PYTHONPATH` is the one that costs you |
| 3 | **[Packages and `__main__.py`](03-m-packages-and-main-py.md)** | `-m` on a package, directories and zipapps; why `python -m pip` beats `pip`; `runpy`; the double-import trap |
| 4 | **[`-c`, stdin and pipes](04-c-and-stdin.md)** | The 3.14 auto-dedent; heredoc quoting; why a program read from stdin cannot read stdin; `curl \| python`; code that has no `__file__` |
| 5 | **[Options worth knowing](05-options-worth-knowing.md)** | `-u` and the container with no logs; `-X dev`, `-X importtime`, `-i`, `-W error`; the isolation switches; and why `-O` is the flag to leave alone |

Still to be written for this topic: **the rewritten REPL of 3.13 and 3.14**,
**shebangs and the Windows launcher**, and **`uv run` with PEP 723 inline script
metadata**.

## The short version

```bash
python script.py            # sys.path[0] = the script's directory
python -m pkg.module        # sys.path[0] = the current directory, and a real import
python -m pkg               # runs pkg/__main__.py, after importing pkg
python dir/  |  python a.pyz  # runs the __main__.py inside
python -c "code"            # sys.path[0] = cwd; stdin stays free for data
python - <<'PY' … PY        # program comes from stdin, so stdin is used up
```

And the four lines that answer "why can it not find my module":

```python
import sys
print("argv[0] :", sys.argv[0])
print("path[0] :", sys.path[0])
print("__name__:", __name__)
print("__spec__:", __spec__)
```

## Phase gate contribution

After this topic you can explain why the same file imports differently under
`python file.py` and `python -m pkg.file`, name what `sys.path[0]` will be for
any launch mode, say why `PYTHONPATH` is the wrong fix for a project layout
problem, and reach for `-u`, `-X dev` and `-X importtime` by reflex instead of
guessing.

## Where this connects

- **[05 · Virtual environments](../05-virtual-environments/README.md)** decided
  *which* interpreter runs. This topic is what happens once it starts.
- **[08 · Imports](../08-imports/README.md)** owns `sys.path` in full;
  [`../08-imports/05b-running-a-module.md`](../08-imports/05b-running-a-module.md)
  is the deep version of chunk 2's argument.
- **`if __name__ == "__main__"`** *(not written yet)* is the module-identity half
  of `-m`.
- **Phase 7 — Packaging** turns "how do I run it" into a `[project.scripts]`
  entry point, which is the answer this topic keeps arriving at.

---

← Prev: [Virtual environments](../05-virtual-environments/README.md) · Index: [Phase 0 — The runtime](../README.md) · Next → [Everything is an object](../07-everything-is-an-object/README.md)
