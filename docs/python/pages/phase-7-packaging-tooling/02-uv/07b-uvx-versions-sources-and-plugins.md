---
title: "`uvx ruff` means \"whichever ruff this machine cached first\" — pin the version at the call site or in a committed file, reach for `--from` when the command is not the package, and put plugins in the tool's environment with `--with`"
sidebar_label: "07b · uvx — versions, sources, plugins"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Tools* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)),
> *Using tools* ([docs.astral.sh](https://docs.astral.sh/uv/guides/tools/)) and the CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · **ruff 0.16.6** · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**[07](07-uvx-and-tools.md) established *where* `uvx` runs a tool: in a disposable environment that
never sees your project. This page is about *what* it puts in that environment. Three questions decide
it — which version, which package, and which extra packages — and each has a default that is
convenient for one person and wrong for a team. The version defaults to whatever was cached on the
first invocation, or to an installed tool if there is one; the package defaults to the command name;
and the environment contains the tool's own dependencies and nothing else, so a plugin installed in
your project is invisible to it. Every one of these defaults can be overridden on the command line,
and the overrides are the whole of this page.**

## Which version runs

This is the part people get wrong in teams. From the tools concept page:

> *"`uvx` will use the latest available version of the requested tool on the first invocation. After
> that, `uvx` will use the cached version."*

> *"Once a tool is installed with `uv tool install`, `uvx` will use the installed version by default."*
> — both [tools](https://docs.astral.sh/uv/concepts/tools/)

So "which ruff does `uvx ruff` run" has three possible answers — an installed tool's version if one
exists, otherwise whatever was newest the first time this machine ran it, otherwise the newest now —
and they differ between machines. Ask explicitly:

```bash
uvx ruff@0.16.6 check .                 # an exact version
uvx ruff@latest check .                 # the newest, refreshing the cache
uvx --from 'ruff==0.16.6' ruff check .  # the same pin, in specifier form
uvx --isolated ruff check .             # ignore an installed ruff; use a fresh tool environment
```

> *"To request the latest version of Ruff and refresh the cache, use the `@latest` suffix"*
> — [using tools](https://docs.astral.sh/uv/guides/tools/)

`--isolated` is documented in the CLI reference as *"Run the command in an isolated virtual
environment"* ([CLI reference](https://docs.astral.sh/uv/reference/cli/)); the tools page uses it to
bypass an installed version.

⚠️ For a team, the honest answer to "which ruff" is not a `uvx` flag at all. If a formatter's output
has to be identical on every machine and in CI, the version belongs in a committed file — a dev
dependency group locked in `uv.lock`, or the `rev` of a pre-commit hook. Topic [05 · ruff](../05-ruff/12-pinning-ruff.md) makes that argument for ruff specifically; the general rule is that `uvx` without a
version is a personal convenience, not a team contract.

## `--from`: when the command is not the package

> *"The `--from` option can be used to invoke a command from a specific package, e.g., `http` which is
> provided by `httpie`: `$ uvx --from httpie http`"*
> — [using tools](https://docs.astral.sh/uv/guides/tools/)

`uvx` infers the package from the command name, which works until the two differ. `--from` takes a full
requirement, so the same flag carries versions, extras and non-registry sources — all three forms from
uv's guide:

```bash
uvx --from httpie http https://example.com
uvx --from 'mypy[faster-cache,reports]' mypy --xml-report mypy_report
uvx --from git+https://github.com/httpie/cli httpie
```

## `--with`: plugins the tool loads

> *"Additional packages can be included during tool execution: `$ uvx --with <extra-package> <tool>`"*
> — [tools](https://docs.astral.sh/uv/concepts/tools/)

The use case is a tool with a plugin system — a documentation generator and its theme, a linter and a
third-party rule pack. The plugin must be in the *tool's* environment, and `uvx` builds that environment
from the command line alone:

```bash
uvx --with mkdocs-material mkdocs build
```

## Which Python a tool gets

> *"Each tool environment is linked to a specific Python version."*
> — [tools](https://docs.astral.sh/uv/concepts/tools/)

Tool environments are selected by uv's normal interpreter discovery, but they are not part of your
project, so your project's `.python-version` and `requires-python` are not what decides — the tools
page describes local version requests as ignored for tools (paraphrased: the exact sentence was not
captured when this page was verified). Ask explicitly when it matters:

```bash
uvx --python 3.14 ruff check .
```

## Gotchas

**★ Symptom: two developers run `uvx ruff format` and produce different diffs on the same file.**
Cause: each machine runs whichever ruff it cached first — *"After that, `uvx` will use the cached
version."* Fix: pin the version at the call site, or better, in a committed file.

```bash
uvx ruff@0.16.6 format .       # call-site pin
uv add --dev ruff==0.16.6      # or a locked dev dependency, run with: uv run ruff format .
```

**★ Symptom: a new ruff release is out and `uvx ruff --version` still reports the old one.**
Cause: the cached tool environment wins until something refreshes it. Fix: ask for the latest
explicitly, which also refreshes the cache.

```bash
uvx ruff@latest --version
```

**★ Symptom: `uvx ruff` runs an old version even though you never pinned one.**
Cause: an earlier `uv tool install ruff==…` — *"Once a tool is installed with `uv tool install`, `uvx`
will use the installed version by default."* Fix: upgrade the installed tool, or bypass it.

```bash
uv tool upgrade ruff
uvx --isolated ruff --version
```

**★ Symptom: `uvx http https://example.com` fails because no package called `http` provides that command.**
Cause: `uvx` infers the package from the command name, and httpie's command is not its package name.
Fix:

```bash
uvx --from httpie http https://example.com
```

**Symptom: `uvx mkdocs build` fails because the configured theme or plugin cannot be found.**
Cause: the plugin is installed in your project, or nowhere — never in the tool's disposable
environment. Fix: add it to the tool environment.

```bash
uvx --with mkdocs-material mkdocs build
```

**Symptom: a tool fails with a syntax or feature error that only makes sense on an older Python.**
Cause: the tool environment was built with whichever interpreter discovery found, not your project's
pinned one. Fix: request the interpreter.

```bash
uvx --python 3.14 some-tool
```

## Interview questions

**★ How does `uvx` decide which version of a tool to run, and why does that matter in a team?**
Three rules, applied in order: an installed tool's version if `uv tool install` put one there; otherwise
the cached environment from the first invocation — *"`uvx` will use the latest available version of the
requested tool on the first invocation. After that, `uvx` will use the cached version"*; and `@latest`
or an explicit `@version` overrides both. The consequence is that two machines typing the same command
can run different versions, depending only on when each first ran it. For a linter that is a nuisance;
for a formatter it is a diff that flips back and forth between contributors. A team contract needs the
version in a committed file — a locked dev dependency or a pre-commit hook revision — with `uvx` kept
for personal, unversioned convenience.

**When do you need `--from`, and what can it carry?**
Whenever the command name is not the package name, or when you need more than a bare name. `uvx`
infers the package from the command, so `uvx http` looks for a package called `http`; httpie's command
needs `--from httpie`. Because `--from` accepts a full requirement, it is also how you pass a version
(`--from 'ruff==0.16.6'`), extras (`--from 'mypy[faster-cache,reports]'`), or a non-registry source such
as a git URL. It is the general form; `tool@version` is a shorthand for the common case.

**A documentation build with `uvx mkdocs build` cannot find its theme. Why, and what is the fix?**
Because a plugin has to be importable in the environment of the program that loads it, and the only
environment involved is the tool's disposable one, built from the command line. Having the theme in the
project's dependencies does nothing — `uvx` never looks at the project. The fix is to put the plugin in
the tool environment with `--with`, which uv documents as *"Additional packages can be included during
tool execution"*; for a permanently installed tool the same flag exists on `uv tool install`. If the
documentation build is part of the project's CI, a dependency group plus `uv run mkdocs build` is the
more reproducible arrangement.

**Are `uvx ruff@0.16.6` and `uvx --from 'ruff==0.16.6' ruff` different?**
Not in what they select — both run ruff 0.16.6 — but they generalise differently. `tool@version` is a
shorthand that works when the command and the package share a name; uv's guide shows it as the way *"to
run a tool at a specific version"* and pairs it with `@latest`. `--from` takes a full requirement
string, so it is the form that also carries extras, a git source, or a package whose command has a
different name. Knowing that `@version` is sugar for a `--from` requirement is what lets you read
`uvx --from 'mypy[reports]==1.18' mypy` without looking anything up: the package, its extras and its
version, then the command to run from it.

**What does `uvx --isolated` do, and when do you need it?**
It runs the tool in a fresh, isolated environment rather than reusing an installed one; the CLI
reference describes it as *"Run the command in an isolated virtual environment"*, and the tools page
uses it to show `uvx` ignoring a version put there by `uv tool install`. You need it when an installed
tool is deliberately held at an old version — for a legacy project, say — and you want to try the
current one without disturbing the install, or when you suspect a tool environment has been modified by
hand and want to rule that out. For choosing a specific version, `@version` is the clearer tool;
`--isolated` answers "not the installed one", not "which one".

---

← Prev: [07 · uvx — running tools](07-uvx-and-tools.md) · [Topic index](README.md) · Next → [07c · uv tool install](07c-uv-tool-install.md)
