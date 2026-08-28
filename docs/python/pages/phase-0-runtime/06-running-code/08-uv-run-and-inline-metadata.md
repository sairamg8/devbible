---
title: "PEP 723 lets a single .py file declare the Python version and the dependencies it needs, and uv run reads that block, builds an environment and executes the file — turning a script into a program with no project around it"
sidebar_label: "8 · uv run and PEP 723"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 723 — Inline script metadata](https://peps.python.org/pep-0723/) (Final)
> and its canonical home, the PyPA
> [inline script metadata specification](https://packaging.python.org/en/latest/specifications/inline-script-metadata/),
> the [uv scripts guide](https://docs.astral.sh/uv/guides/scripts/), the
> [uv CLI reference](https://docs.astral.sh/uv/reference/cli/) (`uv run --script`,
> `--with`, `--python`, `--no-project`) and
> [Running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/).
> Version spine: **Python 3.14.7**, uv (current release, 2026-08).

**The awkward middle ground in Python has always been the file that is too big to
paste into a shell and too small to deserve a project: it needs `httpx` and
`rich`, so it needs an environment, so it needs a README explaining how to create
the environment, and now it is a project after all. PEP 723 removes that step by
letting the file declare its own requirements in a comment block, and `uv run`
reads the block, resolves it, and executes the file in an environment it manages
for you. The important framing is that PEP 723 is a **standard**, not a uv
feature — pipx and Hatch read the same block — and that `uv run` on a PEP 723
script is deliberately isolated from any project you happen to be standing in.
This chunk is the runner; the block's exact format is
[chunk 8b](08b-the-pep-723-block.md).**

## `uv run` on a file with no dependencies

```bash
uv run example.py
uv run example.py hello world!      # arguments pass through
uv run --no-project example.py      # ignore the project you are standing in
echo 'print("hello")' | uv run -    # the program from stdin
```

The guide documents the stdin form directly — *"additionally, your script can be
read directly from stdin"*, with a here-document variant — and it inherits every
constraint from [chunk 4](04-c-and-stdin.md), including that a program read from
stdin cannot then read data from stdin.

Standing inside a project changes the default:

> *"Note that if you use `uv run` in a project, i.e., a directory with a
> `pyproject.toml`, it will install the current project before running the script.
> If your script does not depend on the project, use the `--no-project` flag to
> skip this."*

and the flag has a position requirement that is easy to get wrong:

> *"Note: the `--no-project` flag must be provided before the script name."*

Everything after the script name belongs to the script, which is the same rule
every launcher in this topic follows.

## Dependencies without touching the file: `--with`

> *"`--with`: Run with the given packages installed. When used in a project, these
> dependencies will be layered on top of the project environment in a separate,
> ephemeral environment."*

```bash
uv run --with rich example.py
uv run --with 'rich>12,<13' example.py
uv run --with rich --with httpx example.py
```

This is the throwaway form: nothing is written to the file, nothing persists, and
the next person who runs the script has to know which packages to name. Use it to
try something; use inline metadata for anything you will run twice.

## Choosing the interpreter

```bash
uv run --python 3.10 example.py
```

> *"`--python`, `-p`: The Python interpreter to use for the run environment. If
> the interpreter request is satisfied by a discovered environment, the environment
> will be used."*

`requires-python` in the metadata does the same job declaratively and travels with
the file, which is the point — the flag is for a one-off check across versions,
the field is for the script's actual requirement. uv will fetch an interpreter it
does not have, so a script declaring `requires-python = ">=3.13"` runs on a machine
whose system Python is 3.9.

## The isolation rule

This is the behaviour that surprises people inside a project:

> *"Scripts that declare inline metadata are automatically executed in
> environments isolated from the project."*

> *"When using inline script metadata, even if `uv run` is used in a project, the
> project's dependencies will be ignored."*

So a PEP 723 script sitting inside a repository does **not** get the repository's
dependencies. That is correct — the file declares what it needs, and the whole
value proposition is that it behaves the same wherever it is — but it means a
script that "worked" only because the project had `pandas` installed will fail the
moment you add a metadata block to it.

`--script` forces the interpretation regardless of the filename:

> *"`--script`: Run the given path as a Python script. Using `--script` will
> attempt to parse the path as a PEP 723 script, irrespective of its extension."*

which is what makes an extensionless executable file work
([chunk 8c](08c-uv-script-tooling-and-locking.md)).

## GUI scripts on Windows

> *"On Windows `uv` will run your script ending with `.pyw` extension using
> `pythonw`."*

```
uv run example.pyw
uv run --with PyQt5 example_pyqt.pyw
```

That is the same `.pyw` convention the interpreter and the wheel specification use
([chunk 7d](07d-windows-launcher.md)) — the extension, not anything in the file,
decides whether a console window appears.

## Gotchas

**★ `python script.py` on a PEP 723 file fails with `ModuleNotFoundError`.**
The block is a comment. CPython does not read it and never will — it is metadata
for launchers, not a language feature. The file needs a runner: `uv run`,
`pipx run`, `hatch run`.

**★ A script inside a project suddenly cannot import the project's packages.**
That is the documented rule: *"scripts that declare inline metadata are
automatically executed in environments isolated from the project."* Either list
what the script needs in its own `dependencies`, or delete the metadata block and
let it be a project script run with plain `uv run`.

**★ `uv run --with` used as a permanent answer.**
Nothing is recorded in the file, so the next person — or the next CI job — has no
way to know what the script needs. `--with` is for exploration; `uv add --script`
is for anything that will be run again.

**★ `uv run --no-project` placed after the script name does nothing useful.**
Documented: *"the `--no-project` flag must be provided before the script name."*
After it, the flag is an argument to your script — which usually means your
argument parser rejects it, and if it does not, the project was still installed.

**★ `uv run` inside a project is slower than expected for a trivial script.**
Because *"it will install the current project before running the script"*. For a
one-file utility that does not import the project, `--no-project` skips the whole
sync.

**★ `uv run -` and a pipeline both want stdin.**
`-` means "the program comes from standard input", so there is nothing left on
stdin for the program to read — exactly as with `python -`
([chunk 4](04-c-and-stdin.md)). Put the program in a file when it needs to consume
piped data.

**★ The first run on a cold machine needs the network.**
uv resolves and downloads the declared dependencies, and may download an
interpreter to satisfy `requires-python`. A script that is "self-contained"
is self-*describing*, not offline-capable; a locked script plus a warm cache is
what makes a CI job reproducible without surprises
([chunk 8c](08c-uv-script-tooling-and-locking.md)).

**★ The script's `sys.path[0]` is not what you expected.**
`uv run` ultimately executes the file as a script, so everything in
[chunk 2](02-script-vs-m.md) still applies: the front of `sys.path` is the
script's own directory, `__main__.__spec__` is `None`, and relative imports do not
work. PEP 723 changes what is *installed*, not how the file is launched.

## Interview questions

**★ What is PEP 723, and whose feature is it?**
A packaging standard — Final, with its canonical text maintained by the PyPA —
that defines a comment block at the top of a single-file script declaring
`requires-python` and `dependencies` in TOML. It is not a uv feature; uv is one
implementation, alongside `pipx run` and Hatch. CPython itself does nothing with
the block: running the file with `python` ignores it entirely.

**★ Why is a PEP 723 script inside a project isolated from that project?**
Because the file's whole claim is that it declares everything it needs. uv
documents that *"scripts that declare inline metadata are automatically executed
in environments isolated from the project"* and that *"even if `uv run` is used in
a project, the project's dependencies will be ignored"*. If the script inherited
the project's environment, it would run on your machine and nowhere else — which
is exactly the problem the standard exists to solve.

**★ When is `--with` the right tool and when is it the wrong one?**
Right for a one-off — trying a library against a script you are still writing,
or adding a debugging dependency to an existing script without editing it. Wrong
as the documented way to run something, because nothing about the requirement is
recorded in the file: the next person has to be told. `uv add --script` writes it
into the metadata where it belongs.

**★ Does `uv run` change how the script is launched?**
No. It changes what is installed and which interpreter is used; the file is still
executed as a script, so `sys.path[0]` is the script's directory, `__main__` has
no spec, and relative imports still do not work
([chunk 2](02-script-vs-m.md)). Every launch-mode rule in this topic applies
unchanged.

**★ How does `uv run` behave differently inside a project versus outside one?**
Outside a project it creates an on-demand environment for the file. Inside a
project — a directory with a `pyproject.toml` — it *"will install the current
project before running the script"*, and `--with` dependencies are layered *"in
addition to the project's dependencies"*. `--no-project` opts out, and must appear
before the script name. The exception is a file with inline metadata, which is
always isolated from the project regardless.

**★ Can `uv run` execute a program from standard input?**
Yes: `uv run -`, including with a here-document, which the guide documents
explicitly. It is the same trade-off as `python -` — the program occupies stdin,
so the program cannot then read piped data — and the same absence of `__file__`
and of a module spec applies ([chunk 4](04-c-and-stdin.md)).

---

← Prev: [Windows: py and PyManager](07d-windows-launcher.md) · Index: [Running code](README.md) · Next → [The PEP 723 block, exactly](08b-the-pep-723-block.md)

{/* FOOTER */}
