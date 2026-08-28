---
title: "uv builds the same PEP 405 environment without pip inside it, discovers .venv upwards from the current directory, and makes activation a thing you stop thinking about"
sidebar_label: "7 · uv venv and uv run"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the uv documentation:
> [Using environments](https://docs.astral.sh/uv/pip/environments/),
> [Running commands in projects](https://docs.astral.sh/uv/concepts/projects/run/),
> [the CLI reference](https://docs.astral.sh/uv/reference/cli/) and
> [the environment variable reference](https://docs.astral.sh/uv/reference/environment/);
> cross-checked against the Python 3.14
> [`venv` docs](https://docs.python.org/3.14/library/venv.html) and
> [PEP 405](https://peps.python.org/pep-0405/).
> Version spine: **Python 3.14.7**, uv (current release, 2026-08).

**`uv venv` produces an ordinary PEP 405 virtual environment — the same
`pyvenv.cfg`, the same `bin/`, the same `site-packages` — so everything in the
previous six chunks still applies to it. What uv changes is the workflow around
the environment: it can fetch the interpreter you asked for, it does not put pip
inside, it finds `.venv` by walking up from the current directory, and `uv run`
guarantees the environment is up to date before your command starts. The
practical effect is that activation becomes optional in a way it never quite was
before.**

## `uv venv`

```bash
uv venv                      # create .venv here, using a discovered interpreter
uv venv --python 3.12        # find or download 3.12, then create
uv venv /srv/app/env         # a path other than .venv
uv venv --seed               # also install pip (and, below 3.12, setuptools/wheel)
uv venv --relocatable        # entry-point scripts that survive moving the directory
```

The `--python` flag is the difference that matters most against
`python -m venv`, which as [chunk 3](03-creating-with-python-m-venv.md) explains
cannot take a version at all. uv will use an interpreter it already manages, one
on `PATH`, or download a standalone build — the selection rules are in
[`../04-installing-and-versions/05-uv-resolution-and-variants.md`](../04-installing-and-versions/05-uv-resolution-and-variants.md).

**The environment has no pip in it by default.** That is deliberate: `uv pip
install` operates on an environment from the outside, so pip never needs to be
present in the target. The uv reference documents the opt-in:

> *"Install seed packages (one or more of: `pip`, `setuptools`, and `wheel`) into
> the virtual environment created by `uv venv`."*

with a note that setuptools and wheel are not included for Python 3.12 and later.
You want `--seed` when something *inside* the environment shells out to pip:
Jupyter's `%pip` magic, tools that call `python -m pip` at runtime, some editor
integrations.

`--relocatable` is documented through `UV_VENV_RELOCATABLE`: *"If set, the virtual
environment will be relocatable."* It addresses the shebang problem from
[chunk 5](05-not-relocatable.md), and it is a uv feature — a stdlib venv gains
nothing from it.

## How uv decides which environment to act on

For the pip-compatible interface, the discovery order is documented:

> *"A virtual environment at `.venv` in the current directory, or in the nearest
> parent directory"*

and the two overrides:

> *"Setting `VIRTUAL_ENV=/path/to/venv` will cause uv to install into
> `/path/to/venv`, regardless of where uv is installed."*
>
> *"`uv pip install --python /path/to/python` will install into the environment
> linked to the `/path/to/python` interpreter regardless of whether or not it is
> a virtual environment."*

The parent-directory walk is the useful part and the surprising part. It means
`uv pip install` from `src/app/handlers/` installs into the project's `.venv` at
the repository root, which is almost always what you meant — and it means running
uv inside a subdirectory of an unrelated project quietly acts on *that* project's
environment.

Unlike pip, uv will not install into a non-virtual environment by accident.
`UV_SYSTEM_PYTHON` exists — *"If set to `true`, uv will use the first Python
interpreter found in the system `PATH`"* — and its documentation carries a warning
that it is aimed at CI and containers. That default is the PEP 668 lesson from
[`../04-installing-and-versions/02-responding-to-pep-668.md`](../04-installing-and-versions/02-responding-to-pep-668.md)
built into the tool.

## `uv run`

For a project (a directory with a `pyproject.toml`), `uv run` is the command that
replaces activation entirely:

```bash
uv run python app.py
uv run pytest -q
uv run -- ruff check --fix .
```

The docs state the two properties that make this work:

> *"When working on a project, it is installed into the virtual environment at
> `.venv`."*
>
> *"When using `run`, uv will ensure that the project environment is up-to-date
> before running the given command."*

"Up to date" means resolved against the lockfile and synced — so the class of bug
where someone pulls a branch that added a dependency and then spends twenty
minutes on an import error simply does not occur.

The docs are also blunt about the isolation from your shell:

> *"This environment is isolated from the current shell by default, so
> invocations that require the project, e.g., `python -c "import example"`, will
> fail. Instead, use `uv run`…"*

Read that as the design statement: uv does not want your shell to carry the
environment. It wants each command to name it.

### The flags that change which environment `uv run` uses

| Flag | Documented behaviour |
|---|---|
| `--with PKG` | *"Run with the given packages installed. When used in a project, these dependencies will be layered on top of the project environment in a separate, ephemeral environment."* |
| `--no-project` | *"Avoid discovering the project or workspace. Instead of searching for projects in the current directory and parent directories, run in an isolated, ephemeral environment populated by the `--with` requirements."* |
| `--isolated` | *"Run the command in an isolated virtual environment. Usually, the project environment is reused for performance. This option forces a fresh environment to be used for the project."* |
| `--python`, `-p` | *"The Python interpreter to use for the run environment. If the interpreter request is satisfied by a discovered environment, the environment will be used."* |
| `--no-sync` | *"Avoid syncing the virtual environment. Implies `--frozen`, as the project dependencies will be ignored."* |
| `--active` | *"Prefer the active virtual environment over the project's virtual environment. If the project virtual environment is active or no virtual environment is active, this has no effect."* |

`--active` is the flag to remember, because it names the one behaviour that
surprises people: by default `uv run` in a project uses the **project's** `.venv`
even if a different environment is activated in your shell. That is the right
default — it makes the command reproducible regardless of your terminal's history
— and it is astonishing the first time.

Scripts with inline metadata are handled separately, and always in isolation:

> *"Scripts that declare inline metadata are automatically executed in
> environments isolated from the project."*

That is PEP 723, covered by
[06 · Running code — `uv run` and inline script metadata](../06-running-code/08-uv-run-and-inline-metadata.md),
with the block's own syntax in [the PEP 723 block](../06-running-code/08b-the-pep-723-block.md).

## Where the project environment lives

`UV_PROJECT_ENVIRONMENT` *"specifies the path to the directory to use for a
project virtual environment"*. Two legitimate uses: pointing at a path outside a
synced or networked directory ([chunk 9](09-where-the-venv-lives.md)), and, in a
container, deliberately setting it to a system path so the image does not carry a
nested environment. It is not a way to share one environment across projects —
uv syncs it to whichever project you run from.

## Gotchas

**Symptom:** `python -m pip` inside a uv-created environment reports that pip does not exist
**Cause:** `uv venv` does not seed pip; uv installs into the environment from outside
**Fix:** `uv pip install ...` from outside, or create with `uv venv --seed` when something inside the environment genuinely needs pip — Jupyter's `%pip`, tools that shell out to pip

**Symptom:** `uv pip install` from a subdirectory installs into an environment you did not expect
**Cause:** discovery walks up to the *"nearest parent directory"* containing `.venv`
**Fix:** be aware of it, and use `--python .venv/bin/python` or `VIRTUAL_ENV=` explicitly in scripts where the target must be unambiguous

**Symptom:** you activate environment A, run `uv run pytest` in a project whose environment is B, and B is used
**Cause:** the documented default — the project environment wins over the activated one
**Fix:** `uv run --active` if you really mean the activated environment. Usually the default is what you want and the activation is the mistake

**Symptom:** `uv run` reinstalls or changes packages you had installed manually with `uv pip install`
**Cause:** `uv run` syncs the project environment to the lockfile before executing, and manual installs are not in the lockfile
**Fix:** add the dependency properly (`uv add`), or use `--no-sync` for a one-off, understanding that it *"implies `--frozen`"*

**Symptom:** `uv run --with rich script.py` is fast the first time and the package is not in `.venv` afterwards
**Cause:** `--with` layers dependencies in *"a separate, ephemeral environment"* on top of the project's
**Fix:** that is the intended behaviour for throwaway needs. For a real dependency, `uv add rich`

**Symptom:** CI installs into the system interpreter under uv and someone assumes uv did it silently
**Cause:** `UV_SYSTEM_PYTHON` or `--system` was set, which is the documented way to opt into exactly that
**Fix:** it is a legitimate choice in a single-purpose container. Everywhere else, create an environment; the flag's own documentation warns about modifying a system Python

**Symptom:** an environment created by `uv venv` behaves unexpectedly with a tool that inspects `pyvenv.cfg`
**Cause:** it should not — uv creates a standard virtual environment — but tools that parse undocumented keys can be brittle
**Fix:** rely only on the documented keys, `home` and `include-system-site-packages`, in your own tooling. If a third-party tool needs more, that is a bug to report to it

**Symptom:** `uv venv` is used in a project that also has a `pyproject.toml`, and later `uv sync` seems to disagree about the environment
**Cause:** mixing the pip-compatible interface (`uv venv` + `uv pip install`) with the project interface (`uv sync` / `uv run`) on the same directory
**Fix:** pick one. Project workflow: `uv sync` and `uv run`, and let uv own `.venv`. Pip-compatible workflow: `uv venv` and `uv pip`, and manage requirements yourself

## Interview questions

**★ Is a `uv venv` environment different from a `python -m venv` one?**
Structurally, no — it is a PEP 405 environment with `pyvenv.cfg`, a `bin`/`Scripts`
directory and a `site-packages`, and any tool that understands venvs understands
it. The differences are in creation and management: uv can select and download an
interpreter with `--python`, it does not seed pip unless asked, it is much faster
because it never runs `ensurepip`, and it can produce a relocatable environment.

**★ Why does `uv venv` leave pip out?**
Because `uv pip install` acts on an environment from the outside, using the
environment's interpreter only as a target. pip inside the environment is
redundant weight and one more thing to keep upgraded. `--seed` puts it back for
the cases that need it — notebook `%pip` magics and tools that shell out to pip.

**★ What does `uv run` guarantee that activation does not?**
That the environment matches the project's declared dependencies before the
command runs, because uv syncs against the lockfile first. Activation guarantees
only that a directory is on `PATH`; it says nothing about whether the environment
is current. `uv run` also finds the environment itself, so there is no state in
your shell that can be wrong.

**★ You have environment A activated and run `uv run` in a project bound to B. Which wins?**
B, the project environment, unless you pass `--active`. That default keeps the
command reproducible across terminals and machines, and is the single most common
uv surprise for people arriving from an activate-first workflow.

**★ When would you set `UV_PROJECT_ENVIRONMENT`?**
When the environment must not live at `./.venv` — a project directory that is
synced by Dropbox or OneDrive, a network filesystem where thousands of small
files are slow, or a container image where you want the environment installed at
a fixed system path instead of alongside the source. It relocates the project
environment; it does not let two projects share one.

---

← Prev: [When the base moves](06-when-the-base-interpreter-moves.md) · Index: [Virtual environments](README.md) · Next → [--system-site-packages and leakage](08-system-site-packages.md)
