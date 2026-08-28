---
title: "uv writes the metadata block for you, locks a script to an adjacent .py.lock file that projects get by default and scripts do not, and pins resolution to a date with exclude-newer"
sidebar_label: "8c · uv script tooling"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [uv scripts guide](https://docs.astral.sh/uv/guides/scripts/) (creating scripts,
> declaring dependencies, alternative indexes, locking, `exclude-newer`, the
> shebang form, GUI scripts) and the
> [uv CLI reference](https://docs.astral.sh/uv/reference/cli/)
> (`uv init --script`, `uv run --script`).
> Version spine: **Python 3.14.7**, uv (current release, 2026-08).

**[Chunk 8b](08b-the-pep-723-block.md) established that the PEP 723 block has an
exact format that fails silently when you get it wrong. This chunk is the
consequence: you should not type it. `uv init --script`, `uv add --script` and
`uv remove --script` write and maintain the block; `uv lock --script` produces a
lockfile next to the file so "resolves its own dependencies" stops meaning
"resolves them differently next month"; `exclude-newer` pins resolution to a date
without a lockfile at all; and `uv add --index` puts a private index
inside the block where another runner will ignore it rather than choke on it. The
shebang that turns the file into a directly executable program is
[chunk 8d](08d-tools-other-readers-and-the-boundary.md).**

## Writing and maintaining the block

```bash
uv init --script example.py --python 3.13
uv add --script example.py 'requests<3' 'rich'
uv remove --script example.py rich
uv add --index "https://example.com/simple" --script example.py 'internal-lib'
```

> *"`--script`: Create a script. A script is a standalone file with embedded
> metadata enumerating its dependencies, along with any Python version
> requirements, as defined in the PEP 723 specification."*

> *"uv supports adding and updating inline script metadata for you. Use
> `uv add --script` to declare the dependencies for the script […] This will add a
> `script` section at the top of the script declaring the dependencies using
> TOML."*

`uv add --script` inserts or updates the `dependencies` array in place and leaves
the rest of the file alone. The `--index` form writes the index into the block:

> *"If you wish to use an alternative package index to resolve dependencies, you
> can provide the index with the `--index` option […] This will include the package
> data in the inline metadata:"*

```python
# [[tool.uv.index]]
# url = "https://example.com/simple"
```

That is the `[tool]` table doing exactly what the specification describes — a
uv-specific key inside a standard block, which another runner will ignore rather
than choke on.

One uv-specific requirement that the standard does not impose:

> *"The `dependencies` field must be provided even if empty."*

So a script that only wants to pin a Python version still needs the array:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///

type Point = tuple[float, float]     # 3.12 syntax
```

## Locking a script

Declaring `rich` and `requests<3` does not make a script reproducible — it makes
it *resolvable*, which is a different and much weaker property. Resolution happens
at run time, against whatever the index offers that day.

> *"uv supports locking dependencies for PEP 723 scripts using the `uv.lock` file
> format. Unlike with projects, scripts must be explicitly locked using
> `uv lock`."*

```bash
uv lock --script example.py
```

> *"Running `uv lock --script` will create a `.lock` file adjacent to the script
> (e.g., `example.py.lock`)."*

> *"Once locked, subsequent operations like `uv run --script`, `uv add --script`,
> `uv export --script`, and `uv tree --script` will reuse the locked dependencies,
> updating the lockfile if necessary."*

> *"If no such lockfile is present, commands like `uv export --script` will still
> function as expected, but will not create a lockfile."*

Note what "explicitly" costs you. **A project is locked by default; a script is
not.** So the moment a script matters — it runs in CI, it runs on a schedule, it
is the thing that reconciles the billing data — it needs `uv lock --script` and
the `.lock` file needs to be committed beside it. And the single-file property is
now a two-file property, which is a real trade to make consciously.

```bash
uv tree --script example.py       # what the script actually resolves to
uv export --script example.py     # a requirements-style export
```

## `exclude-newer` — reproducibility without a lockfile

> *"In addition to locking dependencies, uv supports an `exclude-newer` field in
> the `tool.uv` section of inline script metadata to limit uv to only considering
> distributions released before a specific date. This is useful for improving the
> reproducibility of your script when run at a later point in time."*

> *"The date should be specified as an RFC 3339 timestamp (e.g.,
> `2006-12-02T02:07:43Z`)."*

```python
# /// script
# dependencies = [
#   "requests",
# ]
# [tool.uv]
# exclude-newer = "2023-10-16T00:00:00Z"
# ///

import requests
```

This keeps the script a single file, which is the whole point of PEP 723, at the
cost of being weaker than a lockfile: it constrains *when* a distribution was
released, not *which* one is chosen, so a yanked release, a changed index, or a
different platform can still change the outcome. Use it for scripts whose value is
that they are one file; use `uv lock --script` for scripts whose value is that
they produce the same answer.

## Gotchas

**★ `requires-python` set, `dependencies` omitted, and uv refuses.**
uv documents that *"the `dependencies` field must be provided even if empty"*.
Write `dependencies = []`. This is a uv requirement, not a rule of the standard,
so a script that works under another runner can fail here.

**★ Editing the block by hand and reflowing it with a formatter.**
Formatters generally leave comments alone, but a comment-reflow setting, an editor
that strips trailing whitespace inside the block, or a "convert tabs" action can
all break the byte-level format. If a script stops finding its dependencies right
after a formatting change, diff the top of the file.

**★ A PEP 723 script is treated as reproducible because it declares its
dependencies.**
It is not. Declaring `requests` pins nothing; resolution happens per run. Scripts
*"must be explicitly locked using `uv lock`"* — unlike projects, which are locked
by default. If the output matters, `uv lock --script` and commit the `.lock`.

**★ The `.lock` file is not committed, so the lock does nothing for anyone else.**
`uv lock --script example.py` writes `example.py.lock` next to the file. It is
useless in your working copy alone. Commit it, and remember that the script is now
two files — the trade you made in exchange for reproducibility.

**★ `exclude-newer` is expected to behave like a lockfile.**
It limits uv *"to only considering distributions released before a specific
date"*. That constrains the candidate set, not the choice: a different platform,
a different Python version, or a yank can still change what is installed. It is a
reproducibility *improvement*, and the docs say exactly that.

**★ `exclude-newer` written as a plain date.**
The documented format is an RFC 3339 timestamp — `2023-10-16T00:00:00Z`, not
`2023-10-16`.

**★ `uv add --index` used and then the script is shared outside the network.**
The index URL is written into the block, so anyone running the script tries to
reach an index they cannot see. An internal index makes a script internal; that is
usually fine, but it should be a decision rather than a surprise.

**★ A locked script edited by hand and then run.**
`uv run --script` will *"reuse the locked dependencies, updating the lockfile if
necessary"* — so an edit to the block is picked up and the lock is regenerated,
which is usually what you want and is also a silent change to a committed file.
Check `git status` after running a locked script you just edited.

## Interview questions

**★ uv insists on `dependencies = []` in a script that has no dependencies. Is
that the standard?**
No — the standard makes `dependencies` optional (*"MAY include the top-level
fields"*). uv's own guide states that *"the `dependencies` field must be provided
even if empty"*. It is a tool requirement, and a good example of why a script that
runs under one PEP 723 runner is not automatically portable to another.

**★ Does a PEP 723 script give you reproducible runs?**
Not by itself. The block declares constraints, and resolution happens at run time
against the index. uv documents that *"unlike with projects, scripts must be
explicitly locked using `uv lock`"*, which writes a `.lock` file adjacent to the
script and is then reused by `uv run --script`, `uv add --script`,
`uv export --script` and `uv tree --script`. Without that file, or without
`exclude-newer`, the same script can resolve differently next month.

**★ What is `exclude-newer` and when would you choose it over a lockfile?**
A field in the `tool.uv` table of the inline metadata that limits uv *"to only
considering distributions released before a specific date"*, written as an RFC
3339 timestamp. You choose it when the script's whole value is that it is one file
you can paste into a ticket or a gist — a lockfile would make it two. You choose a
lockfile when the script's value is that it produces the same result, because
`exclude-newer` constrains the candidate set rather than the resolution.

**★ Where does an alternative package index live for a PEP 723 script, and what
happens to a runner that does not understand it?**
In the `[tool]` table inside the block — `uv add --index` writes
`[[tool.uv.index]]`. The specification defines `[tool]` as having *"the same
semantics as the `[tool]` table in `pyproject.toml`"*, so it is a namespaced area
each tool owns. A different runner ignores `tool.uv` entirely, which means the
script's dependencies will be resolved from the default index — silently, and
possibly not at all if the package is private.

---

← Prev: [The PEP 723 block](08b-the-pep-723-block.md) · Index: [Running code](README.md) · Next → [Tools, other readers and the boundary](08d-tools-other-readers-and-the-boundary.md)

{/* FOOTER */}
