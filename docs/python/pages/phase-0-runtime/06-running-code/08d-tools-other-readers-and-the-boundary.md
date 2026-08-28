---
title: "One shebang line makes a PEP 723 file a real command, pipx and Hatch read the same block because it is a standard rather than a uv feature, and there is a point at which the honest answer is to make it a package"
sidebar_label: "8d · Tools and the boundary"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [uv scripts guide](https://docs.astral.sh/uv/guides/scripts/) (the shebang
> form), the
> [uv CLI reference](https://docs.astral.sh/uv/reference/cli/)
> (`uv run --script`), the
> [pipx "Run scripts" documentation](https://github.com/pypa/pipx/blob/main/docs/how-to/run-scripts.rst)
> (PEP 723 support), the
> [Hatch "How to run Python scripts" guide](https://hatch.pypa.io/latest/how-to/run/python-scripts/)
> and the PyPA
> [inline script metadata specification](https://packaging.python.org/en/latest/specifications/inline-script-metadata/).
> Version spine: **Python 3.14.7**, uv and pipx (current releases, 2026-08).

**Two things finish the script story. The first is that a PEP 723 file plus one
shebang line is a genuine command — no extension, no venv, no install step — which
is as close as Python gets to a single-file program. The second is knowing when to
stop: inline metadata is a real standard read by uv, pipx and Hatch, and it is
still a script format. There is a point where a file wants tests, a version, a
changelog and someone else's `pip install`, and past that point the answer is a
package with a `[project.scripts]` entry point, not a longer comment block.
Running published *tools* — `uvx`, `pipx run` — is a neighbouring problem and is
[chunk 8e](08e-running-published-tools.md).**

## The shebang: one file, executable

> *"A shebang can be added to make a script executable without using `uv run` —
> this makes it easy to run scripts that are on your `PATH` or in the current
> folder."*

```python
#!/usr/bin/env -S uv run --script

print("Hello, world!")
```

```bash
chmod +x greet
./greet
```

> *"Ensure that your script is executable, e.g., with `chmod +x greet`, then run
> the script"*

and with dependencies, which is where it becomes interesting:

```python
#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx"]
# ///

import httpx

print(httpx.get("https://example.com"))
```

The mechanism is entirely the `env -S` behaviour from
[chunk 7b](07b-when-a-shebang-fails.md): the kernel execs `/usr/bin/env`, `env`
splits the string into `uv run --script ./greet`, and uv takes over. Note the bare
`#` line between the shebang and the block — legal, because a line consisting of
only `#` is explicitly permitted embedded content, and useful because it keeps the
block visually separate.

`--script` is also what makes the extensionless filename work:

> *"`--script`: Run the given path as a Python script. Using `--script` will
> attempt to parse the path as a PEP 723 script, irrespective of its extension."*

So the file can be called `greet` rather than `greet.py`, which is what makes it
feel like a real command rather than a script you happen to run.

## PEP 723 is a standard, not a uv feature

This is the point that keeps getting lost. The specification is maintained by the
PyPA, PEP 723 is Final, and multiple tools implement it.

**pipx** reads the block directly:

> *"A script can declare its own dependencies with inline script metadata. pipx
> reads the `# /// script` block and installs the listed packages before running"*
>
> *"pipx caches an environment keyed to the script's dependency list. Changing the
> dependencies builds a fresh one."*

```bash
pipx run test.py pipx
```

**Hatch** reads it too:

> *"The `run` command supports executing Python scripts with inline metadata, such
> that a dedicated environment is automatically created with the required
> dependencies and with the correct version of Python. A script metadata block is a
> comment block that starts with `# /// script` and ends with `# ///`. Every line
> between those two lines must be a comment line that starts with `#` and contains
> a TOML document when the comment characters are removed."*

```bash
hatch run /path/to/script.py
```

Practically: the block travels. A colleague with pipx and no uv can run your
script. What does *not* travel is anything under `[tool.uv]` — the index, the
`exclude-newer` date, the `.lock` file — because the specification scopes `[tool]`
to each tool by design. A script that depends on `tool.uv` keys for correctness is
a uv script wearing a standard's clothing, and it is worth knowing which kind you
have written.

## The boundary: when it should be a package

Inline metadata solves one problem — a single file that needs third-party
dependencies. It solves nothing else. Reach for a package when any of these is
true:

| Signal | Why a script cannot carry it |
|---|---|
| **A second file** | A PEP 723 block describes *the file*. Two files means two blocks, or an import that only works from one directory. |
| **Tests** | There is nowhere to put them and no way to install the code under test. |
| **A version number** | No metadata field for it, so no way for anyone to say which one they are running. |
| **Other people install it** | `pip install yourtool` requires a distribution. A shebang requires them to have uv. |
| **A stable command name on `PATH`** | `[project.scripts]` generates a console script the installer places and rewrites ([chunk 7c](07c-console-scripts-and-launchers.md)); a file on `PATH` is a file you have to place yourself. |
| **Anything imports it** | A script is `__main__`. The moment something wants `from yourtool import run`, it needs to be a module in a package ([chunk 2](02-script-vs-m.md)). |
| **A team maintains it** | Review, changelog, semver and a release process all attach to a distribution, not to a file. |

The honest sequence is: one file with `--with`, then one file with a PEP 723
block, then one file with a block and a lock, then a package. Each step costs
more and buys something specific, and skipping straight to a package for a
forty-line script is its own mistake. The packaging half — `pyproject.toml`,
`[project.scripts]`, building a wheel, publishing — is **Phase 7 — Packaging**
*(not written yet)*.

## Gotchas

**★ `./greet` fails on a machine that has no uv.**
The shebang names `uv`, so the file only runs where uv is installed and on `PATH`.
That is the deliberate trade — a self-contained script in exchange for a tool
dependency — and it is exactly why this is not a substitute for shipping a wheel
with a console script.

**★ `#!/usr/bin/env uv run --script` without the `-S`.**
The kernel passes the whole string as one argument, so `env` looks for a program
named `uv run --script`. `-S` is mandatory here, for exactly the reason set out in
[chunk 7b](07b-when-a-shebang-fails.md) — and it is not available on every `env`
implementation.

**★ The executable script has no execute bit after cloning.**
Git records the mode. `chmod +x greet` locally does not help anyone else;
`git update-index --chmod=+x greet` records it.

**★ A script that relies on `[tool.uv]` keys is shared with a pipx user.**
`[tool]` is namespaced per tool by design. pipx and Hatch read `dependencies` and
`requires-python` and ignore `tool.uv` — so the private index is not used, the
`exclude-newer` date is not applied, and the `.lock` file beside the script is not
consulted. The script still runs; it runs differently.

**★ A PEP 723 script that grows a second file.**
The block describes one file. The moment there is a helper module beside it, you
are relying on `sys.path[0]` being the script's directory
([chunk 2](02-script-vs-m.md)) — which works until someone runs it from elsewhere
or installs it. That is the signal to make it a package.

## Interview questions

**★ Walk through what happens when someone runs `./greet` where `greet` starts
with `#!/usr/bin/env -S uv run --script`.**
The kernel sees `#!`, execs `/usr/bin/env` with the rest of the line as a single
argument; `env`'s `-S` splits it into `uv`, `run`, `--script`; `env` resolves `uv`
on `PATH` and execs it with `run --script ./greet` plus any arguments. uv parses
the file's PEP 723 block, resolves and installs the dependencies (reusing the
`.lock` if present), selects an interpreter satisfying `requires-python` —
downloading one if needed — and executes the file as an ordinary script. So
`sys.path[0]` is still the file's directory and `__main__` still has no spec.

**★ Why does `uv run --script` exist when `uv run file.py` already works?**
Because `--script` is documented to *"attempt to parse the path as a PEP 723
script, irrespective of its extension"*. That is what allows an executable called
`greet`, with no `.py`, to be treated as a Python script — and it is why the
shebang form names `--script` explicitly rather than relying on uv's inference.

**★ Is PEP 723 a uv feature?**
No. It is a Final PEP whose canonical specification is maintained by the PyPA, and
it is implemented by several tools. pipx documents that it *"reads the
`# /// script` block and installs the listed packages before running"*; Hatch's
`run` command *"supports executing Python scripts with inline metadata, such that
a dedicated environment is automatically created with the required dependencies
and with the correct version of Python"*. uv is one implementation, and the parts
of a uv script under `[tool.uv]` are the parts that do not travel.

**★ When should a PEP 723 script become a package?**
When it acquires a second file, tests, a version number, other people who install
it, a command name that has to be on `PATH` without them installing uv, or
anything that wants to import it. A script is `__main__` by definition, and inline
metadata describes exactly one file. Packaging buys a distribution, an entry point
that the installer places and whose shebang it rewrites, a version, and an import
surface — none of which a comment block can provide.

**★ A colleague has pipx but not uv, and your script has a `[tool.uv]` index. What
happens?**
It runs, and it resolves from the default index instead of yours, because
`[tool]` is namespaced per tool and pipx ignores `tool.uv`. If the package is
private the run fails with a resolution error that names the package rather than
the index. This is the practical limit of "PEP 723 is portable": the standard
fields travel, the tool table does not.

---

← Prev: [uv script tooling](08c-uv-script-tooling-and-locking.md) · Index: [Running code](README.md) · Next → [Running published tools](08e-running-published-tools.md)

{/* FOOTER */}
