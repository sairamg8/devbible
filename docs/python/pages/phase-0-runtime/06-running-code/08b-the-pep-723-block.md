---
title: "The PEP 723 block is a comment with an exact byte-level format — one hash, one space, three slashes — and every way of getting it slightly wrong fails silently rather than loudly"
sidebar_label: "8b · The PEP 723 block"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the PyPA
> [inline script metadata specification](https://packaging.python.org/en/latest/specifications/inline-script-metadata/)
> (the canonical text, quoted throughout),
> [PEP 723](https://peps.python.org/pep-0723/) (Final; the PEP points at the PyPA
> spec as canonical).
> Version spine: **Python 3.14.7**, uv (current release, 2026-08).

**The metadata block looks like a casual convention and is in fact specified to the
character: a single `#`, a single space, three forward slashes, a single space,
the type. Get any of that wrong and nothing complains — the block is a comment, so
Python does not care, and the specification says an unclosed block "MUST be
ignored". The failure you see is a `ModuleNotFoundError` for a package you can
plainly see declared three lines above the import. This chunk is the format, the
rules that make it fail quietly, and the two commands that mean you never have to
type it.**

## The block

> *"Any Python script may have top-level comment blocks that MUST start with the
> line `# /// TYPE` where TYPE determines how to process the content. That is: a
> single `#`, followed by a single space, followed by three forward slashes,
> followed by a single space, followed by the type of metadata. Block MUST end
> with the line `# ///`. That is: a single `#`, followed by a single space,
> followed by three forward slashes. The TYPE MUST only consist of ASCII letters,
> numbers and hyphens."*

> *"Every line between these two lines (`# /// TYPE` and `# ///`) MUST be a comment
> starting with `#`. If there are characters after the `#` then the first character
> MUST be a space. The embedded content is formed by taking away the first two
> characters of each line if the second character is a space, otherwise just the
> first character (which means the line consists of only a single `#`)."*

The content that results is TOML. The `script` type:

> *"The first type of metadata block is named `script`, which contains script
> metadata (dependency data and tool configuration). This document MAY include the
> top-level fields `dependencies` and `requires-python`, and MAY optionally include
> a `[tool]` table. The `[tool]` table MAY be used by any tool, script runner or
> otherwise, to configure behavior. It has the same semantics as the `[tool]` table
> in `pyproject.toml`."*

> *"`dependencies`: A list of strings that specifies the runtime dependencies of
> the script. Each entry MUST be a valid dependency specifier."*
>
> *"`requires-python`: A string that specifies the Python version(s) with which the
> script is compatible. The value of this field MUST be a valid version
> specifier."*

The canonical example:

```python
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "requests<3",
#   "rich",
# ]
# ///

import requests
from rich.pretty import pprint
```

And under a shebang, with a bare `#` separating them — which is legal because a
line consisting of only `#` is explicitly allowed as embedded content:

```python
#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx"]
# ///

import httpx
```

## The rules that bite

**Multiple blocks of the same type are an error.**

> *"When there are multiple comment blocks of the same TYPE defined, tools MUST
> produce an error."*

**An unclosed block is ignored, not reported.**

> *"A starting line MUST NOT be placed between another starting line and its ending
> line. In such cases tools MAY produce an error. Unclosed blocks MUST be
> ignored."*

A missing `# ///` therefore gives you a script with *no* metadata and a
`ModuleNotFoundError`, not a complaint about the block.

**Parsing may be a textual scan, not a Python parse.**

> *"Tools MAY choose to do a simple textual scan, rather than a full Python parse.
> As a result of the previous point, the behaviour of scripts that contain data
> that looks like metadata within another Python construct such as a multi-line
> string is tool-dependent and should not be relied on."*

**The closing rule has a precedence clause**, and the specification's own example
of it is worth reading twice:

> *"Precedence for an ending line `# ///` is given when the next line is not a
> valid embedded content line as described above. For example, the following is a
> single fully valid block:"*

```python
# /// some-toml
# embedded-csharp = """
# /// <summary>
# /// text
# ///
# /// </summary>
# public class MyClass { }
# """
# ///
```

**Only standardised types may be read.** *"Tools MUST NOT read from metadata
blocks with types that have not been standardized by this specification."* So
inventing `# /// deploy` and expecting a tool to pick it up is out of spec; the
extension point is the `[tool]` table inside the `script` block.

**Encoding.** *"Tools reading embedded metadata MAY respect the standard Python
encoding declaration. If they choose not to do so, they MUST process the file as
UTF-8."* — the coding cookie from
[chunk 7c](07c-console-scripts-and-launchers.md), one more time.

**The regex is illustrative, not normative.**

> *"This is the canonical regular expression that MAY be used to parse the
> metadata: `(?m)^# /// (?P<type>[a-zA-Z0-9-]+)$\s(?P<content>(^#(| .*)$\s)+)^# ///$`"*
>
> *"In circumstances where there is a discrepancy between the text specification
> and the regular expression, the text specification takes precedence."*

## Do not type it

Given the exactness above, the sane workflow is to let a tool write the block:
`uv init --script`, `uv add --script` and `uv remove --script` insert and update
it in place, and they are covered with the rest of uv's script tooling in
[chunk 8c](08c-uv-script-tooling-and-locking.md).

## Gotchas

**★ The block was written by hand and silently does nothing.**
The format is exact: `# /// script` with single spaces, every line between the
markers a comment, the terminator exactly `# ///`. And *"unclosed blocks MUST be
ignored"* — a missing terminator produces no error at all. Use `uv init --script`
and `uv add --script` ([chunk 8c](08c-uv-script-tooling-and-locking.md)) rather
than typing it.

**★ A tab, or two spaces, after the `#`.**
The spec says *"if there are characters after the `#` then the first character
MUST be a space"*, and content is formed by removing the first two characters. A
tab leaves a leading tab in the TOML; two spaces leave one, which in a multi-line
array is often still valid TOML — so the failure surfaces during resolution rather
than at parse time, pointing at the wrong thing.

**★ `#/// script` with no space after the hash.**
Not a starting line. The block is invisible, and the script runs with no
dependencies.

**★ Two `# /// script` blocks in one file.**
Documented as an error: *"when there are multiple comment blocks of the same TYPE
defined, tools MUST produce an error."* This happens when a block is copied from
another script into a file that already has one.

**★ A `# /// script` line inside a docstring or a long string literal.**
*"The behaviour of scripts that contain data that looks like metadata within
another Python construct such as a multi-line string is tool-dependent and should
not be relied on."* If your script's job is to *generate* PEP 723 blocks, keep the
template out of module-level string literals — build it from parts, or read it
from a data file.

**★ `requires-python` omitted entirely, and the script breaks on an older
machine.**
Runners *SHOULD* error when no satisfying Python is available — but only if you
told them what you need. Without the field, a `match` statement or a 3.12 `type`
alias quietly becomes a `SyntaxError` on someone else's laptop. Set it even when
"everyone is on 3.13".

**★ A local path dependency in `dependencies`.**
Dependency specifiers can name a path or a URL, but a relative path resolves
against whatever the runner decides and the file stops being portable — which was
the entire point of putting the metadata in the file. If a script needs your local
package, it is not a standalone script any more
([chunk 8d](08d-tools-other-readers-and-the-boundary.md)).

**★ A custom block type such as `# /// deploy`.**
*"Tools MUST NOT read from metadata blocks with types that have not been
standardized by this specification."* Put tool-specific configuration in the
`[tool]` table inside the `script` block, which is the documented extension point
and *"has the same semantics as the `[tool]` table in `pyproject.toml`"*.

## Interview questions

**★ Describe the block's format precisely enough that you could write one by
hand.**
It starts with a line that is exactly `# /// script` — one `#`, one space, three
slashes, one space, the type — and ends with a line that is exactly `# ///`. Every
line between them must be a comment starting with `#`, and if anything follows the
`#` the first character must be a space. Content is derived by stripping those
first two characters from each line and parsing the result as TOML. The recognised
top-level fields are `dependencies` (a list of dependency specifiers) and
`requires-python` (a version specifier), plus an optional `[tool]` table with the
same semantics as `pyproject.toml`'s.

**★ What happens if you forget the closing `# ///`?**
Nothing visible. The specification says *"unclosed blocks MUST be ignored"*, so
the file is treated as having no metadata and fails later with an import error for
a dependency that was declared but never read. That silence is the whole argument
for using `uv init --script` and `uv add --script` rather than editing by hand.

**★ What does `requires-python` actually cause a runner to do?**
The specification says *"script runners SHOULD error if no version of Python that
satisfies the specified `requires-python` can be provided"* — and, for
dependencies, that they *MUST* error if those cannot be provided. uv goes further
than erroring: it will fetch a managed interpreter satisfying the constraint, so
the script runs on a machine whose system Python is much older.

**★ Why is the canonical regular expression not the definition of the format?**
Because the specification says so outright: *"in circumstances where there is a
discrepancy between the text specification and the regular expression, the text
specification takes precedence."* The regex is offered as an example of the
permitted *"simple textual scan"* implementation. The precedence rule for a
closing `# ///` — that it counts as the terminator *"when the next line is not a
valid embedded content line"* — is the kind of detail the prose settles and a
regex only approximates.

**★ Can you invent your own block type?**
No. *"Tools MUST NOT read from metadata blocks with types that have not been
standardized by this specification"*, and only `script` has been standardised.
The sanctioned extension point is the `[tool]` table inside the `script` block —
which is how uv stores `[[tool.uv.index]]` and `exclude-newer`.

**★ Why does a `# /// script` block inside a triple-quoted string produce
inconsistent behaviour across tools?**
Because the specification explicitly permits *"a simple textual scan, rather than
a full Python parse"*, and states that the behaviour of such a file *"is
tool-dependent and should not be relied on"*. A regex-based scanner sees the block;
an AST-based one does not. There is no correct answer to appeal to.

---

← Prev: [uv run and PEP 723](08-uv-run-and-inline-metadata.md) · Index: [Running code](README.md) · Next → [uv script tooling and locking](08c-uv-script-tooling-and-locking.md)

{/* FOOTER */}
