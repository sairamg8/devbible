---
title: "uvx and pipx run execute a published tool in a throwaway environment without installing it into anything of yours — which is a different operation from running your own script, and a different one again from adding a dependency"
sidebar_label: "8e · Running published tools"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the
> [uv tools guide](https://docs.astral.sh/uv/guides/tools/) (`uvx`,
> `uv tool run`, `--from`, `--with`, `uv tool install`) and the
> [pipx "Run scripts" documentation](https://github.com/pypa/pipx/blob/main/docs/how-to/run-scripts.rst)
> (`pipx run`, `--spec`, `--with`, `--python-args`, running from a URL and from
> source control).
> Version spine: **Python 3.14.7**, uv and pipx (current releases, 2026-08).

**A script is a file you wrote; a tool is a package someone else published. They
look similar from the command line and they are managed completely differently.
`uvx` and `pipx run` build a throwaway environment, run one command out of it, and
leave nothing behind — which is exactly right for `ruff` in a shell you opened
once, and exactly wrong for the linter your CI runs on every commit. This chunk is
the difference, the flags that make it work when the package and the command have
different names, and the boundary between "run a tool" and "depend on a tool".**

## `uvx` — a tool without an installation

> *"The `uvx` command invokes a tool without installing it."*
>
> *"`uvx` is exactly equivalent to: `uv tool run`"*
>
> *"Tools are installed into temporary, isolated environments when using `uvx`."*

```bash
uvx ruff check .
uvx --from httpie http example.com     # package name ≠ command name
uvx --with mkdocs-material mkdocs build
uv tool install ruff                   # persistent, exposed on PATH
```

> *"The `--from` option can be used to invoke a command from a specific package"*
> when *"the package and command names differ"*.

> *"`uv tool install` operates on a package and will install all executables
> provided by the tool"*, whereas with an ephemeral invocation, *"installing a tool
> does not make its modules available in the current environment"*.

That last clause is the sentence people misread. A tool installed with
`uv tool install` gets its **commands** onto your `PATH`; it does not get its
**modules** into any environment you can `import` from. Tools and dependencies are
separate concepts with separate commands.

## `pipx run` — the same idea, and it predates uv

> *"Run an app or a script in a temporary environment with `pipx run`, without
> installing it first. pipx downloads the package, caches the environment, and runs
> the app."*

```bash
pipx run pycowsay moo
pipx run mpremote==1.20.0
pipx run --spec 'esptool>=4.5' esptool.py
pipx run --with requests --with rich my-script.py
pipx run --python-args "-X dev" my-script.py
pipx run git+https://github.com/psf/black.git@branch
```

The `PACKAGE` argument is a full requirement specifier:

> *"The `PACKAGE` argument is a requirement specifier, so you can pin versions,
> ranges, or extras […] Quote any specifier that contains `>`, `<`, or spaces."*

`--spec` is pipx's equivalent of `--from`:

> *"Use `--spec` when the executable name differs from the package name or when
> installing from an archive URL"*

and `--python-args` is the flag worth memorising:

> *"`--python-args ARGS` forwards arguments to the interpreter that runs the app,
> rather than to the app itself"*

That is how you get `-X dev`, `-X importtime` or `-W error`
([chunk 5](05-options-worth-knowing.md)) into a program you are running through a
tool runner. Without it, the option lands in the program's own `sys.argv`.

pipx will also run a file from a URL:

> *"You can run `.py` files hosted anywhere"*

which is convenient and is the same trust problem as `curl | python`
([chunk 4](04-c-and-stdin.md)): you are executing code you have not read, fetched
over a connection that can fail halfway.

## Three operations that look alike

| You want | Command | What persists |
|---|---|---|
| Run someone's tool once | `uvx ruff check .` / `pipx run ruff check .` | nothing |
| Have the tool's command always available | `uv tool install ruff` / `pipx install ruff` | a command on `PATH`, in its own environment |
| The project to *depend* on the tool | `uv add --dev ruff`, then `uv run ruff` | a pinned entry in `pyproject.toml` and the lockfile |
| Run *your own* file with dependencies | `uv run script.py` with a PEP 723 block | the block in the file ([chunk 8b](08b-the-pep-723-block.md)) |

The third row is the one people skip. A linter that CI must run identically every
time is a **dependency**, not a tool invocation — it needs a version in a lockfile,
not a fresh resolution on every run.

## Gotchas

**★ `uvx somepackage` and the command has a different name.**
`uvx` runs the command matching the package name by default. Use `--from`,
documented as invoking *"a command from a specific package"* when *"the package and
command names differ"* — `uvx --from httpie http`. pipx's equivalent is `--spec`.

**★ `uv tool install` is expected to make the package importable.**
Documented: *"installing a tool does not make its modules available in the current
environment"*. Tools are installed into their own environments and exposed as
commands. If you want to `import` it, add it to your project instead.

**★ Treating `uvx` as a package manager.**
Every `uvx` invocation resolves into an ephemeral environment. That is right for
`uvx ruff check .` in a shell you opened once, and wrong inside a Makefile that
runs it a hundred times, and wrong for a linter CI needs pinned. `uv tool
install`, or a project dev-dependency, for anything repeated.

**★ CI uses `uvx ruff` and the version changes under you.**
No pin, no lock, fresh resolution each run — so a new ruff release changes your
build without a commit. Either pin the specifier (`uvx ruff@0.6.9`,
`pipx run ruff==0.6.9`) or make it a dev-dependency with a lockfile.

**★ A specifier with `>` or `<` is eaten by the shell.**
pipx's documentation says it outright: *"quote any specifier that contains `>`,
`<`, or spaces."* Unquoted, `>` is a redirection and you have just created a file
named after your version bound.

**★ Passing interpreter options to a script run through a tool runner.**
`pipx run -X dev script.py` passes `-X dev` to the *script*. The documented route
is `--python-args`, which *"forwards arguments to the interpreter that runs the
app, rather than to the app itself"*.

**★ `pipx run script.py` and `uv run script.py` disagree about what gets
installed.**
Both build an ephemeral environment keyed to the declared dependencies, but they
are different caches with different resolvers. That is normal; depending on the
agreement is not. If the exact resolution matters, lock the script
([chunk 8c](08c-uv-script-tooling-and-locking.md)) and use the tool that reads the
lock.

**★ `pipx run https://…/script.py` on a whim.**
It is `curl | python` with better ergonomics. You are executing unread code, and a
truncated download executes a truncated program. Fetch it, read it, then run it.

**★ A tool run ephemerally cannot see your project's packages.**
That is the definition — *"temporary, isolated environments"*. A plugin-based tool
(mkdocs, pytest, sphinx) needs its plugins named at invocation: `uvx --with
mkdocs-material mkdocs build`, or `pipx run --with …`. Otherwise the plugin simply
is not there.

**★ The first invocation on a CI runner is slow every time.**
Ephemeral environments are cached per resolved dependency set, and a fresh runner
has an empty cache. For repeated CI use, a project dev-dependency with a lockfile
is both faster and reproducible; `uvx` is for interactive use.

## Interview questions

**★ What is the difference between `uvx` and `uv run`?**
`uv run` runs a command or a script in the environment of your project or your
script. `uvx` — documented as *"exactly equivalent to `uv tool run`"* — runs a
*published tool* in a temporary isolated environment, without installing it into
anything of yours. `uvx ruff` is "give me ruff for a moment"; `uv run ruff` is
"run the ruff this project depends on", which is the version your lockfile pins.

**★ How do you pass `-X dev` to a script you are running through `pipx run`?**
`pipx run --python-args "-X dev" my-script.py`. The documentation is explicit that
`--python-args` *"forwards arguments to the interpreter that runs the app, rather
than to the app itself"* — without it, `-X dev` lands in your script's `sys.argv`.

**★ The command and the package have different names. What do you do?**
`uvx --from <package> <command>`, documented as invoking *"a command from a
specific package"* for exactly the case where *"the package and command names
differ"*; in pipx the flag is `--spec`, also used *"when installing from an archive
URL"*. `uvx httpie` fails because there is no `httpie` command; `uvx --from httpie
http` works.

**★ Should CI use `uvx ruff`?**
Only if you pin the version in the invocation. An unpinned ephemeral run resolves
afresh each time, so a release of the tool changes your build with no commit of
yours. The better shape for CI is a dev-dependency in `pyproject.toml` with the
version recorded in the lockfile, run through `uv run` — reproducible, cached, and
visible in review when it changes.

**★ Does `uv tool install` make a package importable?**
No. The documentation states that *"installing a tool does not make its modules
available in the current environment"*. It installs the package into its own
environment and exposes that package's executables. Importing is a dependency
relationship and belongs in your project's `pyproject.toml`.

**★ Why does a plugin-based tool behave differently under `uvx` than when
installed?**
Because `uvx` builds a *"temporary, isolated"* environment containing only the
tool. Plugins live in that environment or they do not exist, which is why both uv
and pipx offer `--with` to add them for the invocation. An installed tool has a
persistent environment you can inject into instead.

---

← Prev: [Tools and the boundary](08d-tools-other-readers-and-the-boundary.md) · Index: [Running code](README.md) · Next → [Everything is an object](../07-everything-is-an-object/README.md)

{/* FOOTER */}
