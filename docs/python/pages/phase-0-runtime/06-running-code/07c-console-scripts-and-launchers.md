---
title: "Most shebang lines in a working system were written by a tool, not a person: pip and uv rewrite them to an absolute interpreter, zipapp prepends one to an archive, uv run turns one into a whole environment, and the coding cookie is their historical cousin"
sidebar_label: "7c · Generated shebangs"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the PyPA
> [binary distribution format specification](https://packaging.python.org/en/latest/specifications/binary-distribution-format/)
> (shebang rewriting in `scripts/`), the Python 3.14
> [`venv` documentation](https://docs.python.org/3.14/library/venv.html)
> (the portability warning),
> [`zipapp`](https://docs.python.org/3.14/library/zipapp.html) (`-p` and the
> archive format), the
> [lexical analysis reference](https://docs.python.org/3.14/reference/lexical_analysis.html)
> (encoding declarations), [PEP 263](https://peps.python.org/pep-0263/) and the
> [uv scripts guide](https://docs.astral.sh/uv/guides/scripts/).
> Version spine: **Python 3.14.7**.

**Count the shebang lines on a working machine and almost none of them were typed
by a human. Every console script in every virtual environment — `pytest`, `ruff`,
`alembic`, `uvicorn` — has one that an installer generated, pointing at an
absolute interpreter path, and that is the mechanism behind the single most common
"my environment is broken" report. `zipapp` prepends one to a zip archive.
`uv run` turns one into an entire dependency resolution. And on line one or two of
your source sits the coding cookie, a magic comment that predates all of them and
still has a rule about coexisting with the shebang.**

## Console scripts: what pip and uv write

When you declare an entry point:

```toml
# pyproject.toml
[project.scripts]
report = "myapp.cli:main"
```

the installer generates an executable file in the environment's `bin/` (or
`Scripts\` on Windows) whose first line names the interpreter. The wheel
specification describes the rewriting:

> *"If the first line of a file in `scripts/` starts with exactly `b'#!python'`,
> rewrite to point to the correct interpreter. Unix installers may need to add the
> +x bit to these files if the archive was created on Windows. The `b'#!pythonw'`
> convention is allowed. `b'#!pythonw'` indicates a GUI script instead of a
> console script."*

"The correct interpreter" is an **absolute path** to the environment's Python,
resolved at install time. You can read it:

```bash
head -1 .venv/bin/pytest
```

The `venv` documentation states the consequence in its own words:

> *"Because scripts installed in environments should not expect the environment to
> be activated, their shebang lines contain the absolute paths to their
> environment's interpreters. Because of this, environments are inherently
> non-portable, in the general case."*

That is the whole reason a moved or renamed environment half-works: `python`
recomputes its prefix from the path it was invoked as and keeps functioning, while
every console script still names the old absolute path and does not. The full
failure analysis, including editable installs and the repair procedure, is
[`../05-virtual-environments/05-not-relocatable.md`](../05-virtual-environments/05-not-relocatable.md).

Two things follow for daily work:

- **`python -m tool` never uses a shebang.** `python -m pytest`, `python -m pip`,
  `python -m ruff` bypass the generated script entirely — the interpreter is the
  one you named, and no absolute path is consulted. That is the same argument
  [chunk 3](03-m-packages-and-main-py.md) makes for `python -m pip`.
- **Regenerating the scripts is the repair.** Reinstalling rewrites the shebang
  against the interpreter currently running the installer:

  ```bash
  /new/path/.venv/bin/python -m pip install --force-reinstall -r requirements.txt
  ```

uv's answer to the same problem is to generate scripts that locate their
interpreter relatively:

```bash
uv venv --relocatable .venv
```

documented through `UV_VENV_RELOCATABLE` — *"If set, the virtual environment will
be relocatable."* It is a uv feature; a `python -m venv` environment gains nothing
from it.

## The shebang that builds an environment

A single file can carry its own dependencies and still be executed like any other
program, using the `env -S` mechanism from
[chunk 7b](07b-when-a-shebang-fails.md):

```python
#!/usr/bin/env -S uv run --script
```

The kernel execs `/usr/bin/env`, `env` splits the string and runs
`uv run --script ./yourfile`, and uv resolves the file's declared dependencies
into an environment before executing it. That is a whole topic of its own —
the metadata format, locking, and the boundary where a script should become a real
package — and it is [chunk 8](08-uv-run-and-inline-metadata.md).

## `zipapp -p` — a shebang in front of a zip archive

`zipapp` writes the same kind of line, in front of binary data:

> *"`-p <interpreter>`, `--python=<interpreter>`: Add a `#!` line to the archive
> specifying interpreter as the command to run. Also, on POSIX, make the archive
> executable. The default is to write no `#!` line, and not make the file
> executable."*

This works because of a property of the container format:

> *"The zip file format allows arbitrary data to be prepended to a zip file. The
> zip application format uses this ability to prepend a standard POSIX "shebang"
> line to the file (`#!/path/to/interpreter`)."*

and the format is specified as:

> *"1. An optional shebang line, containing the characters `b'#!'` followed by an
> interpreter name, and then a newline (`b'\n'`) character. The interpreter name
> can be anything acceptable to the OS "shebang" processing, or the Python launcher
> on Windows. […] 2. Standard zipfile data, as generated by the `zipfile` module.
> The zipfile content must include a file called `__main__.py`."*

```bash
python -m zipapp src/myapp -m "myapp.cli:main" -p "/usr/bin/env python3" -o report
chmod +x report        # zipapp already did this, per the -p documentation
./report
```

Note that `-p` takes the *whole* interpreter string, so `"/usr/bin/env python3"`
is exactly the two-token form the kernel expects — and the single-argument rule
from [chunk 7b](07b-when-a-shebang-fails.md) applies unchanged, so
`-p "/usr/bin/env python3 -u"` is broken for the same reason it always is. The
zipapp mechanics themselves are [chunk 3](03-m-packages-and-main-py.md).

## The coding cookie: the shebang's historical cousin

The other magic comment that can occupy the top of a Python file is the encoding
declaration, and the rule about *where* it goes exists precisely because of the
shebang:

> *"If a comment in the first or second line of the Python script matches the
> regular expression `coding[=:]\s*([-\w.]+)`, this comment is processed as an
> encoding declaration; the first group of this expression names the encoding of
> the source code file. The encoding declaration must appear on a line of its own.
> If it is the second line, the first line must also be a comment-only line."*

> *"The recommended forms of an encoding expression are `# -*- coding:
> <encoding-name> -*-` which is recognized also by GNU Emacs, and
> `# vim:fileencoding=<encoding-name>` which is recognized by Bram Moolenaar's
> VIM."*

"If it is the second line, the first line must also be a comment-only line" is the
shebang clause. A shebang *is* a comment to Python, so the two coexist:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
```

The important part for 2026 is that **you no longer need the second line**:

> *"If no encoding declaration is found, the default encoding is UTF-8."*

PEP 263, which introduced the cookie, is explicit that its default was the Python 2
one — *"Python will default to ASCII as standard encoding if no other encoding
hints are given"* — and that is what changed. A `# -*- coding: utf-8 -*-` in
modern code is harmless, and is pure noise; a cookie naming a *different* encoding
is meaningful and rare.

Two details still worth carrying:

- **The declaration must be alone on its line.** PEP 263: *"There must not be any
  Python statement on the line that contains the encoding declaration."*
- **A wrong cookie is a hard error.** *"If an encoding is declared, the encoding
  name must be recognized by Python"*, and the declared encoding *"is used for all
  lexical analysis, including string literals, comments and identifiers"* — so a
  file saved as UTF-8 but declaring `latin-1` decodes into mojibake rather than
  failing cleanly.

## Gotchas

**★ After renaming a project directory, `python` in the venv works but `pytest`
does not.**
`sys.prefix` is recomputed from the invocation path; the console script's shebang
is literal text written at install time. The environment is documented as
*"inherently non-portable"*. Recreate it, or `--force-reinstall` so the scripts are
regenerated — and do not conclude the environment is fine because `python`
started.

**★ You copy a project, leave the original in place, and the copy's tools operate
on the original's environment.**
The copied console scripts still name the original absolute interpreter, which
still exists. Nothing errors. `head -1 .venv/bin/pytest` in the copy is the
one-line diagnosis.

**★ A console script's shebang exceeds the kernel's limit on a CI runner.**
Deep workspace paths plus an absolute interpreter path. `python -m <tool>` avoids
the shebang entirely; a shallower environment location avoids the problem. See
[chunk 7b](07b-when-a-shebang-fails.md).

**★ `pip install` in a Docker build stage, then `COPY` to a different path.**
Every console script in the copied environment points at the build stage's path.
Copying between stages only works when the destination path — and the base
interpreter's path — are identical.

**★ `uv venv --relocatable` is expected to make a `python -m venv` environment
portable.**
It is a uv feature that changes how uv-generated entry points find their
interpreter. A stdlib `venv` environment gains nothing from the flag existing, and
a relocatable environment is still bound to the base interpreter its `pyvenv.cfg`
names.

**★ A zipapp with `-p "/usr/bin/env python3 -u"` will not execute.**
Same single-argument rule as any other shebang; `zipapp` writes the string
verbatim. Use `-p "/usr/bin/env -S python3 -u"` where `-S` is available, or set
the option in the environment.

**★ A zipapp built without `-p` is reported as not executable.**
Documented: *"The default is to write no `#!` line, and not make the file
executable."* Either pass `-p`, or run it as `python app.pyz`, which needs neither.

**★ `# -*- coding: utf-8 -*-` on line 3.**
The declaration is only honoured on line 1 or 2, and only if line 1 is a
comment-only line. A docstring or an import above it makes it inert — and since
UTF-8 is the default, nothing appears to break until someone adds a non-ASCII
character with an editor that saved something else.

**★ A file declares `latin-1` but was saved as UTF-8.**
The declared encoding *"is used for all lexical analysis, including string
literals, comments and identifiers"*, so the file decodes successfully into wrong
characters instead of raising. Delete the cookie and save as UTF-8; that is now
the language default.

## Interview questions

**★ Why does moving a virtual environment break its tools but not `python`?**
Because the interpreter recomputes `sys.prefix` from the path it was invoked as,
while console scripts contain a literal absolute shebang written at install time.
The `venv` docs state that *"scripts installed in environments should not expect
the environment to be activated, their shebang lines contain the absolute paths to
their environment's interpreters"* and that environments are therefore
*"inherently non-portable"*. Recreate the environment, or force-reinstall so the
scripts are regenerated.

**★ How does an installer decide what to put in a console script's shebang?**
The wheel specification says that a file in `scripts/` beginning exactly with
`#!python` is rewritten *"to point to the correct interpreter"* — the absolute
path of the interpreter the installer is running under — with `#!pythonw`
reserved for GUI scripts on Windows. Entry points declared in `[project.scripts]`
are generated the same way.

**★ Why is `python -m pytest` more robust than `pytest`?**
Because `-m` never involves a shebang. `pytest` executes a generated script whose
first line is an absolute path that can be stale, truncated by the kernel's
shebang limit, or simply pointing at a different environment from the one you
think you are in. `python -m pytest` uses the interpreter you named and resolves
the module through the import system.

**★ How can a zip archive have a shebang line?**
Because the zip format tolerates arbitrary data prepended to the archive — offsets
are recorded relative to the end-of-central-directory record rather than the start
of the file. The `zipapp` documentation defines the Python zip application format
as *"an optional shebang line"* followed by *"standard zipfile data"* containing a
top-level `__main__.py`, and `zipapp -p` also sets the executable bit on POSIX.

**★ Is `# -*- coding: utf-8 -*-` still needed?**
No. The reference states that *"if no encoding declaration is found, the default
encoding is UTF-8"*. The cookie is a Python 2 inheritance — PEP 263 was written
when the default was ASCII. It is still honoured, still restricted to line 1 or 2,
and still meaningful if you genuinely need a non-UTF-8 encoding, but in new code
it is noise.

**★ Why must the coding declaration be on line 1 or 2 specifically?**
Because it is read by the tokenizer before the file is decoded, so it has to be in
a fixed, tiny window. The two-line window exists for the shebang: the reference
says that *"if it is the second line, the first line must also be a comment-only
line"*, which is exactly the case where line 1 is `#!/usr/bin/env python3`.

---

← Prev: [When a shebang fails](07b-when-a-shebang-fails.md) · Index: [Running code](README.md) · Next → [Windows: the py launcher and PyManager](07d-windows-launcher.md)

{/* FOOTER */}
