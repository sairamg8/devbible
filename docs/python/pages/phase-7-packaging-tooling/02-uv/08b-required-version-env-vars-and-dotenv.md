---
title: "`required-version` is the only uv pin that travels with the repository, `UV_*` variables silently outrank every committed setting, and `uv run` can load `.env` files that lose to anything already exported — three settings that decide which uv, and which values, a command actually sees"
sidebar_label: "08b · required-version, UV_* and .env"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — the settings reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/settings/)), the environment variable reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)), *Configuration files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/configuration-files/)) and the release notes
> ([github.com/astral-sh/uv](https://github.com/astral-sh/uv/releases)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**[01c](01c-installing-and-pinning-uv.md) pins uv where a machine installs it — the CI step, the Docker
tag, the pre-commit `rev`. None of those travels with the repository to a developer's laptop, and on a
tool that ships weekly and adds flags mid-minor that gap is real: a script using `--no-locked` fails
on anything older than 0.12.9 with an error that reads like a typo. `required-version` closes it — the
project declares which uv may operate on it, and uv exits rather than proceed. The other two subjects
here are the layers that sit *above* every committed file: `UV_*` environment variables, which outrank
persistent configuration and are invisible at the call site, and `.env` files loaded by `uv run`, which
rank *below* anything already exported. Both explain a class of "the setting is right there in the
file, why is it ignored?"**

## `required-version` — the repository states which uv it needs

> *"Enforce a requirement on the version of uv. If the version of uv does not meet the requirement at
> runtime, uv will exit with an error."*
> — [settings reference](https://docs.astral.sh/uv/reference/settings/)

```toml
# pyproject.toml
[tool.uv]
required-version = ">=0.12.9,<0.13"
```

Why those two bounds, on a project using the lock-mode escape hatches from
[02d](02d-frozen-and-locked-in-ci.md):

- **`>=0.12.9`** — the release notes for 0.12.9 read *"Add `--no-locked` and `--no-frozen` to disable
  lock modes enabled by `UV_LOCKED` and `UV_FROZEN`"*
  ([releases](https://github.com/astral-sh/uv/releases)). Below it, the flag does not exist, and the
  failure would look like a mistyped command.
- **`<0.13`** — uv is `0.x`, so a minor bump is where behaviour is allowed to change. An upper bound
  makes adopting 0.13 a deliberate commit that someone reviews, instead of something that happens to
  whoever runs `uv self update` first.

The trade is that the upper bound must be moved on purpose. That is a feature on a pre-1.0 tool, and it
is the same shape as the bound `uv init` writes into `[build-system]` for `uv_build`
([09](09-uv-init-version-and-tree.md)).

## The environment variables that change what a project command does

Every `UV_*` variable below is documented as *"Equivalent to"* a flag, and flags and variables both
outrank every file ([08](08-configuration-files.md)). That precedence is the point in CI and the hazard
in a shell profile.

| Variable | Documented as | Belongs in | Covered in |
|---|---|---|---|
| `UV_LOCKED` / `UV_FROZEN` | *"assert that the `uv.lock` remains unchanged"* / *"run without updating the `uv.lock` file"* | CI job `env:` | [02d](02d-frozen-and-locked-in-ci.md) |
| `UV_NO_SYNC` | *"If set, uv will skip updating the environment."* | a container entrypoint, deliberately | [02d](02d-frozen-and-locked-in-ci.md) |
| `UV_PROJECT_ENVIRONMENT` | *"Specifies the path to the directory to use for a project virtual environment."* | CI / images | [02f](02f-a-complete-multi-stage-dockerfile.md) |
| `UV_PYTHON` | *"If set to a path, uv will use this Python interpreter for all operations."* | a CI matrix step | [05c](05c-interpreter-upgrades-and-ci-matrices.md) |
| `UV_PYTHON_DOWNLOADS` | *"Whether uv should allow Python downloads."* | images, locked-down runners | [05](05-uv-python.md) |
| `UV_SYSTEM_PYTHON` | *"uv will use the first Python interpreter found in the system `PATH`."* | a container, never a profile | [06c](06c-uv-pip.md) |
| `UV_DEFAULT_INDEX` | *"uv will use this index as the default index when searching for packages."* | CI secrets / images | [06c](06c-uv-pip.md) |
| `UV_LINK_MODE` / `UV_COMPILE_BYTECODE` | link mode / *"compile Python source files to bytecode after installation"* | images | [02e](02e-uv-inside-a-container-image.md) |
| `UV_CACHE_DIR` / `UV_NO_CACHE` | cache location / *"uv will not use the cache for any operations"* | CI cache steps | [01d](01d-the-cache-and-the-speed-claim.md) |
| `UV_TOOL_DIR` / `UV_TOOL_BIN_DIR` | tool environments / tool executables | build images | [07c](07c-uv-tool-install.md) |

— quotations from [environment variables](https://docs.astral.sh/uv/reference/environment/)

The rule that falls out of the precedence: **a `UV_*` variable in a shell profile is a machine-wide
override of every project's committed configuration**, applied to projects that never asked for it.
Put them in the job, the image, or the one command — not in `~/.bashrc`.

## `.env` files and `uv run`

> *"`uv run` can load environment variables from dotenv files (e.g., `.env`, `.env.local`,
> `.env.development`)."*

> *"To load a `.env` file from a dedicated location, set the `UV_ENV_FILE` environment variable, or
> pass the `--env-file` flag to `uv run`."*

> *"The `--env-file` flag can be provided multiple times, with subsequent files overriding values
> defined in previous files."*

> 🔴 *"If the same variable is defined in the environment and in a `.env` file, the value from the
> environment will take precedence."*

> *"To disable dotenv loading (e.g., to override `UV_ENV_FILE` or the `--env-file` command-line
> argument), set the `UV_NO_ENV_FILE` environment variable to `1`, or pass the`--no-env-file` flag to
> `uv run`."*
> — all [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

```bash
uv run --env-file .env --env-file .env.local -- python -m myapp    # .env.local wins over .env
UV_NO_ENV_FILE=1 uv run pytest                                     # no dotenv loading at all
```

⚠️ The configuration page as verified does not state whether `uv run` loads a `.env` from the project
directory with no flag and no variable. Pass `--env-file` explicitly when you depend on it, and do not
assume it is either on or off.

The precedence rule is the one to internalise, because it inverts the intuition that "the file I just
edited wins": an exported variable beats the file, always. Whether `.env` files belong in a project at
all — development only, never committed secrets, typed settings loaded at startup — is topic
**08 · Config and secrets** *(not written yet)*; this page is only uv's loading mechanism.

## Gotchas

**★ Symptom: a teammate's `uv lock --no-locked` fails with what looks like a typo in the flag.**
Cause: their uv predates 0.12.9, where the flag was added. Fix: make the repository refuse old uv
outright, so the error names the version instead.

```toml
[tool.uv]
required-version = ">=0.12.9"
```

**★ Symptom: right after `uv self update`, every uv command in the project fails with a uv version error.**
Cause: nothing is broken — `required-version` has an upper bound, the updated uv is past it, and so
*"uv will exit with an error"* on that machine. Fix: adopting the new minor is a reviewed change; bump
the bound in a pull request and let CI prove it.

```toml
[tool.uv]
required-version = ">=0.12.9,<0.14"    # moved deliberately, with CI green on the new minor
```

**★ Symptom: `uv run` ignores the value you just put in `.env`.**
Cause: the variable is already exported in your shell, and *"the value from the environment will take
precedence."* Fix: unset it for the run, or remove the export from your profile.

```bash
env -u DATABASE_URL uv run --env-file .env -- python -m myapp
```

**★ Symptom: CI suddenly picks up development settings from a `.env` file.**
Cause: `UV_ENV_FILE` is set somewhere the CI job inherits, so every `uv run` loads it. Fix: turn dotenv
loading off for the job.

```yaml
env:
  UV_NO_ENV_FILE: "1"
```

**★ Symptom: every project on your machine behaves as if its lockfile were frozen.**
Cause: `UV_FROZEN` (or `UV_NO_SYNC`) is exported in a shell profile, and variables outrank every
project's configuration. Fix: remove it from the profile and set it only where it is meant.

```bash
grep -n 'UV_' ~/.bashrc ~/.zshrc ~/.profile 2>/dev/null
unset UV_FROZEN UV_NO_SYNC
```

**Symptom: `uv sync` on your laptop has become noticeably slower than on colleagues' machines.**
Cause: `UV_COMPILE_BYTECODE=1` copied from a Dockerfile into a profile — it makes uv *"compile Python
source files to bytecode after installation"* on every sync. Fix: keep it in the image.

```dockerfile
ENV UV_COMPILE_BYTECODE=1
```

**Symptom: `git status` shows thousands of new files after setting `UV_PROJECT_ENVIRONMENT=venv`.**
Cause: the self-ignoring `.gitignore` only exists for an environment uv creates as `.venv`
([01b](01b-the-project-uv-sees.md)); a custom name has nothing ignoring it. Fix:

```text
# .gitignore
/venv/
```

## Interview questions

**★ uv is already pinned in CI and in the Dockerfile. What does `required-version` add?**
It is the only pin that travels with the repository to every machine that runs uv on it. A CI install
step and a Docker tag control two machines; a developer's laptop, a colleague's WSL shell and an
editor integration run whatever uv they happen to have. `required-version` — *"If the version of uv
does not meet the requirement at runtime, uv will exit with an error"* — makes every one of those check
itself against the project. On a pre-1.0 tool that adds flags in patch releases, the lower bound turns a
confusing unknown-argument failure into a clear version error, and the upper bound turns adopting a new
minor into a reviewed change rather than an accident.

**★ A variable is set in `.env` and also exported in the shell. Which one does `uv run` use, and why is that the right rule?**
The exported one: *"If the same variable is defined in the environment and in a `.env` file, the value
from the environment will take precedence."* It is the right rule because the environment is the more
deliberate, more local statement — a CI job, a container orchestrator or a person typing
`DATABASE_URL=… uv run …` is overriding a file's default for this run, and a file silently beating that
would make it impossible to override a committed default without editing the file. The cost is the
surprise when a stale export in a profile beats a value you just changed; `env -u` for one run, or
cleaning the profile, is the answer.

**Why is a `UV_*` variable in a shell profile riskier than the same setting in a project file?**
Because of where it sits in the precedence order and who can see it. Variables outrank every persistent
file, so a profile export overrides the committed configuration of *every* project on that machine —
including ones that deliberately set something different. And it is invisible in any repository, so
the resulting behaviour cannot be reproduced by anyone else from the code. The same variable in a CI
job's `env:` block is fine: it is scoped to one pipeline and it is in version control. The general rule
is to put `UV_*` variables at the narrowest scope that works — the command, the job, the image — and
almost never in a profile.

**Which uv settings belong in CI as environment variables rather than in `pyproject.toml`?**
The ones that describe the *run*, not the project. Whether the lockfile may change (`UV_LOCKED`), where
the cache lives so the CI system can persist it (`UV_CACHE_DIR`), whether interpreters may be
downloaded on this runner (`UV_PYTHON_DOWNLOADS`), and credentials such as an index URL carrying a
token. What the project *is* — its indexes without secrets, its sources, its constraints, the uv version
it needs — belongs in the project file, because every machine needs it and a reviewer should see it.
Mixing the two up produces either a project that only works in CI or a secret in `pyproject.toml`.

---

← Prev: [08 · Configuration files](08-configuration-files.md) · [Topic index](README.md) · Next → [08c · tool.uv resolution controls](08c-tool-uv-resolution-controls.md)
