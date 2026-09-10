---
title: "You never activate anything with uv, because activation only edits `PATH` — and uv has two different environment-discovery rule sets that agree until the moment you activate something"
sidebar_label: "02b · Activation and discovery"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Using Python environments*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/environments/)), *pip compatibility*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/compatibility/)), the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)), *Using uv in
> Docker* ([docs.astral.sh](https://docs.astral.sh/uv/guides/integration/docker/)), CPython's
> `venv` documentation ([docs.python.org](https://docs.python.org/3.14/library/venv.html)) and
> *Installing packages using pip and virtual environments*
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**"I installed it and it is not there" is the most common uv question, and it has one cause: uv
resolves environments by two different rule sets and you were using the other one. The pip
interface follows `VIRTUAL_ENV`, then searches the current directory and every parent for a
`.venv`. Project commands use the environment belonging to the project they found. Those rules
agree in the ordinary case and diverge precisely when you have activated something or when you
are in a monorepo subdirectory with no environment of its own. Underneath both sits a fact worth
internalising: activation is a shell function that prepends a directory to `PATH`, nothing more,
and the reason uv does not need it is that installed scripts carry the interpreter path in their
shebang.**

## Activation is optional — and knowing *why* removes a class of bug

CPython's documentation states it outright:

> *"You don't specifically need to activate a virtual environment, as you can just specify the
> full path to that environment's Python interpreter when invoking Python. Furthermore, all
> scripts installed in the environment should be runnable without activating it."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

And it explains the mechanism, which is the useful half:

> *"In order to achieve this, scripts installed into virtual environments have a "shebang" line
> which points to the environment's Python interpreter, `#!/<path-to-venv>/bin/python`. This
> means that the script will run with that interpreter regardless of the value of `PATH`."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

Read those together and activation shrinks to what it actually is — a shell function that
prepends a directory to `PATH` and sets `VIRTUAL_ENV`:

> *"Activating a virtual environment will put the virtual environment-specific `python` and `pip`
> executables into your shell's `PATH`."*
> — [packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)

Nothing about activation changes where a package installs *to*; it changes which `python` your
shell resolves. uv resolves the interpreter itself, so the `PATH` edit adds nothing and costs
something — it creates a second source of truth about which environment is "current". That is why
the whole uv workflow is `uv run …` ([04c](04c-uv-run.md)) and never
`source .venv/bin/activate`.

In a container, uv's own docs give the same idea as a `PATH` line rather than an activation:

> *"you can either activate the project virtual environment by placing its binary directory at the
> front of the path:"* `ENV PATH="/app/.venv/bin:$PATH"`
> — [using uv in Docker](https://docs.astral.sh/uv/guides/integration/docker/)

```dockerfile
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "app.wsgi:application"]     # no uv in the final stage at all
```

## 🔴 Two interfaces, two discovery rules

**The pip interface** searches like this:

> *"`uv pip install` and `uv pip sync` are designed to work with virtual environments by default.
> Specifically, uv will always install packages into the currently active virtual environment, or
> search for a virtual environment named `.venv` in the current directory or any parent directory
> (even if it is not activated)."*
> — [pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)

> *"A virtual environment at `.venv` in the current directory, or in the nearest parent
> directory"*
> — [using Python environments](https://docs.astral.sh/uv/pip/environments/)

> *"setting `VIRTUAL_ENV=/path/to/venv` will cause uv to install into `/path/to/venv`, regardless
> of where uv is installed"*

> *"if `VIRTUAL_ENV` is set to a directory that is **not** a PEP 405 compliant virtual
> environment, it will be ignored"*
> — both [using Python environments](https://docs.astral.sh/uv/pip/environments/)

That last rule is doing real work: an environment is a directory with a `pyvenv.cfg`
([02](02-the-environment-uv-expects.md)), so a stale `VIRTUAL_ENV`, a plain directory, or a conda
prefix is *silently* skipped rather than erroring.

**Project commands** (`uv sync`, `uv run`, `uv add`) instead use the environment belonging to the
project uv found — `.venv` beside the `pyproject.toml` — or wherever `UV_PROJECT_ENVIRONMENT`
points:

> `UV_PROJECT_ENVIRONMENT`: *"Specifies the path to the directory to use for a project virtual
> environment."*
> — [environment variables](https://docs.astral.sh/uv/reference/environment/)

| | pip interface | project commands |
|---|---|---|
| honours `VIRTUAL_ENV` | ✅ if PEP 405 compliant, else ignored | environment is the project's |
| searches parent directories | ✅ nearest `.venv` | finds the *project* by `pyproject.toml` |
| configured by | `VIRTUAL_ENV`, `--python`, `--system` | `UV_PROJECT_ENVIRONMENT` |
| records what it did | ❌ nothing | ✅ `uv.lock` |
| removes undeclared packages | only `uv pip sync` | ✅ `uv sync` is exact |

⚠️ **What I could not confirm:** the documentation I checked does not state what uv does when an
unrelated environment is activated *and* you run a project command — the two rule sets are
documented separately and the conflict case is not spelled out. Do not guess and do not trust a
remembered warning message; ask the machine:

```bash
uv run python -c "import sys; print(sys.executable)"
```

There is one documented opt-out from all of this — `--system` / `UV_SYSTEM_PYTHON`, which makes
uv target a global interpreter the way pip does. Because it is a *deliberate divergence from
pip's default*, it is documented with the rest of that comparison in [06c](06c-uv-pip.md).

## Environments are not portable, and `--relocatable` is the narrow exception

> *"Because of this, environments are inherently non-portable, in the general case... If you move
> an environment because you moved a parent directory of it, you should recreate the environment
> in its new location."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

Two absolute paths are baked in: `pyvenv.cfg`'s `home` key, and every console script's shebang.
Rename the project directory and both point at nothing. uv's `--relocatable` —
*"Create a virtual environment with a relative path."* — addresses the interpreter path
specifically, and it is the right tool when an environment is *deliberately* copied: built in one
Docker stage and used in another, or shipped to a machine at a known path. It is not a licence to
treat environments as artefacts; for a project, the cheap and correct answer is to re-create.

```bash
rm -rf .venv && uv sync        # the environment is derived state; this loses nothing
```

## Gotchas

**★ Symptom: in a monorepo, `uv pip install` puts the package in the repository-root environment instead of the service you are standing in.**
Cause: the pip interface searches *"the current directory or any parent directory"* for a `.venv`,
and the root one matched because the service has none. Fix: give the service its own environment,
or name the target explicitly.

```bash
uv venv                                              # create one here, so the search stops here
uv pip install --python .venv/bin/python requests     # or point at it explicitly
```

**★ Symptom: you activated a venv, ran `uv sync`, and your activated environment is unchanged.**
Cause: project commands use the *project's* environment, not the activated one — two different
discovery rules. Fix: stop activating, and ask uv which interpreter it is using.

```bash
uv run python -c "import sys; print(sys.executable)"
uv run pytest        # runs in the project environment, always
```

**★ Symptom: `VIRTUAL_ENV` is exported and uv ignores it entirely.**
Cause: *"if `VIRTUAL_ENV` is set to a directory that is not a PEP 405 compliant virtual
environment, it will be ignored"* — the path is stale, or points at a plain directory, or at a
conda prefix. Fix: check that the directory really is an environment before blaming uv.

```bash
cat "$VIRTUAL_ENV/pyvenv.cfg"      # no pyvenv.cfg, not a PEP 405 environment
```

**★ Symptom: you renamed or moved the project directory and every command in `.venv/bin` now fails.**
Cause: `pyvenv.cfg`'s `home` key and each script's shebang hold absolute paths — CPython:
environments *"are inherently non-portable, in the general case."* Fix: re-create it, which is
cheap by design.

```bash
rm -rf .venv && uv sync
```

**★ Symptom: your editor runs the wrong interpreter — old packages, missing imports, wrong Python version.**
Cause: the editor was pointed at a system interpreter, or at a stale environment path from before
a rebuild. Fix: ask uv for the path and configure *that*, rather than typing one from memory.

```bash
uv python find                                     # the interpreter uv would use here
uv run python -c "import sys; print(sys.prefix)"
```

**★ Symptom: a Docker image built with a virtual environment cannot run the app, though `uv run` works.**
Cause: the final stage has the environment but nothing puts it on `PATH`, and the entrypoint calls
a bare command name. Fix: use uv's documented `PATH` line instead of activation — the shebangs do
the rest.

```dockerfile
ENV PATH="/app/.venv/bin:$PATH"
```

**★ Symptom: an environment copied from one image stage to another has a broken `python`.**
Cause: the interpreter reference in `pyvenv.cfg` is absolute, and the path differs between stages.
Fix: create it relocatable, or place it at the identical path in both stages.

```bash
uv venv --relocatable /app/.venv
```

**★ Symptom: `uv` picks a different environment inside `make` or a subshell than it does in your terminal.**
Cause: the parent search depends on the working directory, and `VIRTUAL_ENV` may or may not be
inherited into that process. Fix: make the target explicit rather than positional.

```makefile
test:
	uv run --project . pytest
```

## Interview questions

**★ Why does the uv workflow never activate a virtual environment, and what does activation actually do?**
Activation is a shell script that prepends the environment's `bin` directory to `PATH` and sets
`VIRTUAL_ENV` — the packaging guide describes it as putting *"the virtual environment-specific
`python` and `pip` executables into your shell's `PATH`."* It is a convenience for humans typing
`python`, not the mechanism packages are installed through. CPython says so directly: *"You don't
specifically need to activate a virtual environment, as you can just specify the full path to that
environment's Python interpreter when invoking Python."* uv resolves the interpreter itself for
every command, so the `PATH` edit adds nothing and introduces a second source of truth about which
environment is current — which is exactly the ambiguity behind "I installed it and it is not
there". `uv run` is the same idea made explicit and auditable.

**★ How do console scripts in a virtual environment work without activation?**
Through the shebang. CPython: *"scripts installed into virtual environments have a "shebang" line
which points to the environment's Python interpreter, `#!/<path-to-venv>/bin/python`. This means
that the script will run with that interpreter regardless of the value of `PATH`."* So
`.venv/bin/pytest` runs under the environment's Python whether or not anything is activated —
which is why `ENV PATH="/app/.venv/bin:$PATH"` is a complete substitute for activation in a
container, and why an environment that has been *moved* breaks: the shebang is an absolute path
written at install time.

**★ uv has two ways of finding an environment. What are they, and when does the difference bite?**
The pip interface *"will always install packages into the currently active virtual environment, or
search for a virtual environment named `.venv` in the current directory or any parent directory
(even if it is not activated)"*, and it honours `VIRTUAL_ENV` — but only if the target is *"a PEP
405 compliant virtual environment"*, otherwise *"it will be ignored"*. Project commands operate on
the environment belonging to the project they discovered, relocatable via
`UV_PROJECT_ENVIRONMENT`. The difference bites in two places: a monorepo, where the parent search
silently finds the root `.venv` for a subdirectory that has none of its own; and any workflow that
still activates out of habit, where `uv pip install` targets the activated environment while
`uv sync` targets the project's. The diagnostic is the same in both cases — print `sys.executable`
from inside `uv run` and stop reasoning about it.

**★ Why is a virtual environment not portable, and what does `--relocatable` change?**
Because two absolute paths are written into it at creation and install time: `pyvenv.cfg` carries
a *"`home` key pointing to the Python installation from which the command was run"*, and every
installed console script carries a shebang naming the environment's interpreter by full path.
CPython's conclusion is blunt — environments *"are inherently non-portable, in the general case"*,
and *"if you move an environment because you moved a parent directory of it, you should recreate
the environment in its new location."* uv's `--relocatable` creates the environment *"with a
relative path"*, addressing the interpreter reference so the environment survives being relocated
as a unit. It is the right flag when an environment is genuinely copied — built in one image stage
and used in another. For everyday work the better answer is that the environment is derived state.

**In a Dockerfile, would you activate the environment, put it on `PATH`, or use `uv run`?**
`PATH`, in the final stage, and `uv run` only if uv is present there for another reason.
Activation is a shell function, so it does not survive across `RUN` instructions and cannot apply
to an `ENTRYPOINT` that is not a shell — it is the wrong shape for a Dockerfile entirely. uv's own
guidance is the `PATH` line: *"you can either activate the project virtual environment by placing
its binary directory at the front of the path"*, `ENV PATH="/app/.venv/bin:$PATH"`. That works
because installed scripts carry their interpreter in the shebang, so the container never needs uv
at runtime — which lets the final stage omit the tool and keeps the runtime image smaller and its
attack surface narrower.

---

← Prev: [02 · The environment uv expects](02-the-environment-uv-expects.md) · [Topic index](README.md) · Next → [02c · uv sync](02c-uv-sync-makes-the-environment-match.md)
