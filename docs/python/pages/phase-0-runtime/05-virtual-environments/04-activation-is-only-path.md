---
title: "Activation prepends one directory to PATH and defines a shell function called deactivate — it is a convenience for humans and you can do everything without it"
sidebar_label: "4 · Activation is only PATH"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` docs](https://docs.python.org/3.14/library/venv.html) ("How venvs work",
> the activation table, `VIRTUAL_ENV`, `install_scripts`),
> [PEP 405](https://peps.python.org/pep-0405/) (activation as a convenience), and
> the [binary distribution format specification](https://packaging.python.org/en/latest/specifications/binary-distribution-format/)
> (`#!python` shebang rewriting at install time).
> Version spine: **Python 3.14.7**.

**"Activating" a virtual environment sounds like it switches the interpreter into
a mode. It does not. `source .venv/bin/activate` is a shell script that prepends
`.venv/bin` to `PATH`, exports `VIRTUAL_ENV`, decorates your prompt, and defines
a function named `deactivate` that puts all three back. That is the complete list.
Every consequence people attribute to "being in the venv" is downstream of the
`PATH` change — and since you can simply name the interpreter you want, a great
deal of activation-related pain is avoidable by never activating at all.**

## What the documentation says activation is

> *"A virtual environment may be 'activated' using a script in its binary
> directory (`bin` on POSIX; `Scripts` on Windows). This will prepend that
> directory to your `PATH`, so that running **python** will invoke the
> environment's Python interpreter and you can run installed scripts without
> having to use their full path."*

And PEP 405, on whether you need it at all:

> *"This is not strictly necessary for use of a virtual environment (as an
> explicit path to the venv's python binary or scripts can just as well be used),
> but it is convenient."*

The `venv` page states the same thing in operational terms:

> *"You don't specifically *need* to activate a virtual environment, as you can
> just specify the full path to that environment's Python interpreter when
> invoking Python. Furthermore, all scripts installed in the environment should
> be runnable without activating it."*

Two documented facts, one conclusion: **activation is a `PATH` convenience for
interactive shells**, and any non-interactive context — a Makefile, a Dockerfile,
a systemd unit, a cron entry, a CI step — is better served by naming the
interpreter.

## The per-shell table

| Platform | Shell | Command to activate |
|---|---|---|
| POSIX | bash / zsh | `source <venv>/bin/activate` |
| POSIX | fish | `source <venv>/bin/activate.fish` |
| POSIX | csh / tcsh | `source <venv>/bin/activate.csh` |
| POSIX | pwsh | `<venv>/bin/Activate.ps1` |
| Windows | cmd.exe | `<venv>\Scripts\activate.bat` |
| Windows | PowerShell | `<venv>\Scripts\Activate.ps1` |

Note the shape of the POSIX entries: `source`, not execution. A script that is
*executed* runs in a child shell, changes that child's `PATH`, and exits — taking
the change with it. `./venv/bin/activate` therefore does nothing observable, and
this is the single most common first-day confusion.

Note also that there is one activation script per shell syntax, which is why a
venv created on Linux and used from Git Bash on Windows, or a `fish` user who
copies a `bash` instruction, gets syntax errors from a shell that is being fed
another shell's script.

## What the script does, line by line in spirit

The activation script is not a documented interface, but its four effects are:

1. **Save the current `PATH`** (and `PYTHONHOME`, if set) into private variables.
2. **`PATH="$VIRTUAL_ENV/bin:$PATH"`** — prepend, never replace. The rest of your
   `PATH` is intact; the environment simply wins for `python`, `pip` and anything
   installed into it.
3. **Export `VIRTUAL_ENV`** with the environment's absolute path, and modify the
   prompt with the prefix taken from `--prompt` (the docs describe
   `__VENV_PROMPT__` being *"replaced with the prompt (the environment name
   surrounded by parentheses and with a following space)"*).
4. **Define `deactivate`** as a shell function that restores what step 1 saved and
   then removes itself.

On the last point, the documentation is deliberately vague, and you should read
that vagueness as a warning not to build on it:

> *"You can deactivate a virtual environment by typing `deactivate` in your shell.
> The exact mechanism is platform-specific and is an internal implementation
> detail (typically, a script or shell function will be used)."*

The practical consequence of `deactivate` being a *function*, not a program, is
that it does not exist in a subshell, in a script you `bash`-execute, or in a
different terminal. `deactivate` is not something you can put in a Makefile
recipe.

The activation scripts also honour a variable that suppresses the prompt change
(`VIRTUAL_ENV_DISABLE_PROMPT`), and set a variable carrying the prompt string.
Neither appears in the `venv` module documentation, so treat both as
implementation detail that happens to be stable rather than as a contract.

## Why installed scripts work without activation

Install anything with a console entry point — `pytest`, `ruff`, `black`,
`alembic` — and the installer writes an executable into `.venv/bin/` whose first
line is an absolute shebang pointing at `.venv/bin/python`. The wheel
specification describes the rewrite:

> *"If the first line of a file in `scripts/` starts with exactly `b'#!python'`,
> rewrite to point to the correct interpreter."*

So `.venv/bin/pytest` re-enters the environment by construction. You do not need
`PATH` to be set for it, you need only to type the path:

```bash
.venv/bin/pytest -q
.venv/bin/python -m pytest -q      # equivalent, and immune to a missing console script
.venv/bin/python -m pip install httpx
```

This is why the venv docs can promise that *"all scripts installed in the
environment should be runnable without activating it"* — and it is also the exact
mechanism that makes environments non-portable, which is
[chunk 5](05-not-relocatable.md).

## The activation-free playbook

| Instead of | Do |
|---|---|
| `source .venv/bin/activate && python app.py` | `.venv/bin/python app.py` |
| `source .venv/bin/activate && pip install -r requirements.txt` | `.venv/bin/python -m pip install -r requirements.txt` |
| `activate` in a Makefile recipe | `PY := .venv/bin/python` and use `$(PY)` |
| `activate` in a Dockerfile | `ENV PATH="/app/.venv/bin:$PATH"` |
| `activate` in a systemd unit | `ExecStart=/srv/app/.venv/bin/python -m app` |
| `activate` in CI | `uv run pytest`, or the absolute interpreter path |
| Remembering to activate at all | `uv run <cmd>`, which finds `.venv` itself |

## Gotchas

**Symptom:** `./.venv/bin/activate` runs and nothing changes; `python` is still the system one
**Cause:** executing the script spawns a child shell, which changes its own `PATH` and exits. Only `source` (or `.`) runs it in the current shell
**Fix:** `source .venv/bin/activate`. If you want a command that works when executed, you do not want activation — name the interpreter instead

**Symptom:** after activating, `pip` still writes to the system Python, and `which pip` shows the old path
**Cause:** the shell cached the location of `pip` from before the `PATH` change. bash and zsh keep a hash table of resolved command paths
**Fix:** `hash -r` (bash/zsh) or `rehash` (csh/tcsh). The stock activation script does this for you, but a wrapper, alias or function that shadows `pip` will defeat it — check with `type -a pip`

**Symptom:** PowerShell refuses to run `Activate.ps1` with an execution-policy error
**Cause:** PowerShell's default policy blocks local script files
**Fix:** `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, or avoid activation entirely and call `.venv\Scripts\python.exe` directly

**Symptom:** each `RUN` line in a Dockerfile "loses" the activation
**Cause:** every `RUN` is a fresh shell process; environment changes made by a sourced script do not survive it
**Fix:** set the `PATH` once at image level — `ENV PATH="/app/.venv/bin:$PATH"` — which is exactly what activation does, only persistently. [Chunk 11](11-editors-ci-and-docker.md) covers the full pattern

**Symptom:** a Makefile recipe activates and then the next line behaves as if it had not
**Cause:** each recipe line runs in its own shell unless joined with `&&` or `.ONESHELL:` is in effect
**Fix:** define `PY := $(CURDIR)/.venv/bin/python` and call `$(PY)` in every recipe. Nothing to activate, nothing to lose

**Symptom:** activating a second environment without deactivating the first leaves a confusing `PATH`
**Cause:** each activation prepends, so both `bin` directories are on `PATH` with the newest first, and `VIRTUAL_ENV` now names only the second. `deactivate` restores the `PATH` saved by the *most recent* activation
**Fix:** `deactivate` before activating another environment. If a `PATH` has already accumulated several, open a fresh shell — that is faster than untangling it

**Symptom:** a shell script does `source .venv/bin/activate` at the top and later calls `deactivate`, and in CI it fails with "deactivate: command not found"
**Cause:** the script is being run with `sh`, where the bash/zsh activation script's function definitions may not be available, or the activation was in a subshell
**Fix:** stop activating inside scripts. Absolute paths have none of these failure modes

**Symptom:** the prompt still shows `(.venv)` in a shell where the environment no longer works
**Cause:** the prompt string is a cosmetic side effect. Delete or recreate the environment directory and the prompt does not notice
**Fix:** trust `python -c "import sys; print(sys.prefix)"`, never the prompt. The prompt is the least reliable signal in the entire system

**Symptom:** a tool reads `VIRTUAL_ENV` and installs into an environment you thought you had left
**Cause:** you started a long-lived process (an editor, a shell multiplexer, a language server) from an activated shell, and it inherited the variable permanently
**Fix:** restart the tool from a clean shell, or explicitly pass the interpreter. The docs' warning that `VIRTUAL_ENV` *"cannot be relied upon"* cuts both ways: absent when it should be set, and set when it should be absent

**Symptom:** `direnv`, a shell hook or an IDE terminal auto-activates an environment and a script that expects the system Python breaks
**Cause:** automatic activation is `PATH` manipulation applied without your asking
**Fix:** in any script whose interpreter matters, use an absolute path or `sys.executable` rather than depending on which `python` `PATH` resolves to today

## Interview questions

**★ What does activating a virtual environment actually do?**
It prepends the environment's `bin` (or `Scripts`) directory to `PATH`, sets
`VIRTUAL_ENV` to the environment path, alters the shell prompt, and defines a
`deactivate` function that reverses those changes. It does not modify the
interpreter, does not touch any file inside the environment, and has no effect on
processes that were already running.

**★ Do you need to activate a venv to use it?**
No. The documentation says explicitly that you can *"just specify the full path
to that environment's Python interpreter"* and that *"all scripts installed in
the environment should be runnable without activating it"*, because installed
console scripts carry an absolute shebang pointing back into the environment. In
non-interactive contexts — Docker, systemd, cron, CI, Makefiles — not activating
is the more reliable choice.

**★ Why is `deactivate` a function rather than a command?**
Because it has to modify the *current* shell's environment, and a child process
cannot do that. The same reasoning is why `activate` must be sourced rather than
executed. The docs deliberately call the mechanism *"an internal implementation
detail"*, so the practical advice is: never script around `deactivate`, just
start a new shell.

**★ You activate an environment and `pip` still installs into the system Python. Why?**
Most often the shell's command hash still points at the old `pip` (fixed with
`hash -r`), or an alias or wrapper function shadows `pip` with an absolute path,
or a later profile script re-prepended something to `PATH`. Diagnose with
`type -a pip` and `python -m pip -V`, and avoid the class of problem entirely by
running `python -m pip` rather than bare `pip`, so the interpreter chooses the pip
rather than `PATH` choosing both independently.

**★ Why can't you `source activate` inside a Dockerfile `RUN` and expect it to stick?**
Each `RUN` instruction starts a new shell in a new container layer; environment
mutations made inside it are discarded when the shell exits. `ENV
PATH="/app/.venv/bin:$PATH"` does the same thing activation does, at image scope,
and survives every subsequent instruction and the container's runtime.

**★ How do installed command-line tools inside an environment find the right interpreter?**
The installer rewrites the `#!python` shebang of each console script to the
absolute path of the interpreter it is installing into, as the wheel
specification recommends. So `.venv/bin/ruff` starts with a shebang naming
`.venv/bin/python` and re-enters the environment even if `PATH` never mentioned
it. That same absolute path is what makes environments non-relocatable.

---

← Prev: [Creating one with venv](03-creating-with-python-m-venv.md) · Index: [Virtual environments](README.md) · Next → [Venvs are not relocatable](05-not-relocatable.md)
