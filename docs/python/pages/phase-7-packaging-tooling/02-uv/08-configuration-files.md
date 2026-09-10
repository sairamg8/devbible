---
title: "uv reads configuration from three file layers plus the environment plus the command line, merges them in a fixed order, and silently ignores `[tool.uv]` whenever a `uv.toml` sits beside it — which is why the same command behaves differently on your laptop and in CI"
sidebar_label: "08 · Configuration files"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Configuration files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/configuration-files/)), the settings reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/settings/)), the environment variable reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)) and the *pyproject.toml*
> specification ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Every uv setting can come from five places: a project file (`[tool.uv]` in `pyproject.toml`, or a
`uv.toml`), a user file, a system file, an environment variable, or a command-line flag. uv merges
them in a documented order — flag over variable over project over user over system — and two rules in
that merge produce most of the "works on my machine" reports. First, a `uv.toml` in the same directory
as `pyproject.toml` wins outright, and the `[tool.uv]` table beside it is ignored — the documentation
describes no warning. Second, the user and system files are invisible in the repository, so a
setting a colleague put in `~/.config/uv/uv.toml` two years ago — a preferred Python, an index, a
cache directory — changes what uv does on their machine and nowhere else. The defence is equally
simple: commit the settings that matter to the project file, and make CI name its configuration
explicitly — a committed `--config-file`, or `--no-config` where the build needs nothing persistent —
so nothing outside the repository can leak in.**

## Where uv looks

> *"Specifically, uv will search for a `pyproject.toml` or `uv.toml` file in the current directory, or
> in the nearest parent directory."*

> *"uv will also discover `uv.toml` configuration files in the user- and system-level configuration
> directories, e.g., user-level configuration in `~/.config/uv/uv.toml` on macOS and Linux, or
> `%APPDATA%\uv\uv.toml` on Windows, and system-level configuration at `/etc/uv/uv.toml` on macOS and
> Linux, or `%PROGRAMDATA%\uv\uv.toml` on Windows."*

> *"User- and system-level configuration files cannot use the `pyproject.toml` format."*
> — all three [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

| Layer | File | Format | In the repository? |
|---|---|---|---|
| project | `pyproject.toml` → `[tool.uv]`, or `uv.toml` | either | ✅ |
| user | `~/.config/uv/uv.toml` · `%APPDATA%\uv\uv.toml` | `uv.toml` only | ❌ |
| system | `/etc/uv/uv.toml` · `%PROGRAMDATA%\uv\uv.toml` | `uv.toml` only | ❌ |

The two formats carry the same settings with different nesting: in `pyproject.toml` everything sits
under `[tool.uv]`, because the packaging specification reserves `[tool]` sub-tables for tools
([01b](01b-the-project-uv-sees.md), and topic 01's
[tool namespace](../01-pyproject-toml/12-the-tool-namespace.md)); in `uv.toml` the same keys are at the
top level.

```toml
# pyproject.toml
[tool.uv]
python-preference = "only-managed"

[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
```

```toml
# uv.toml — the identical settings
python-preference = "only-managed"

[[index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
```

## 🔴 A `uv.toml` beside `pyproject.toml` wins, and `[tool.uv]` is ignored

> *"`uv.toml` files take precedence over `pyproject.toml` files, so if both `uv.toml` and
> `pyproject.toml` files are present in a directory, configuration will be read from `uv.toml`, and
> `[tool.uv]` section in the accompanying `pyproject.toml` will be ignored."*
> — [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

Read the last clause again: not *merged*, **ignored**. A repository that grows a `uv.toml` — someone
adds one to set a cache directory — has, from that commit on, a `[tool.uv]` table that uv does not read.
Every index, source, constraint and `package` flag in it stops applying at once, and the diff that
caused it touches a different file.

Which one to use is therefore a one-time decision per project. `pyproject.toml` is the usual answer,
because the settings live next to the dependencies they affect. A standalone `uv.toml` suits a
directory with no `pyproject.toml` — a scripts folder, a monorepo root that is not itself a project.
What does not work is both.

## How the layers merge

> *"If project-, user-, and system-level configuration files are found, the settings will be merged,
> with project-level configuration taking precedence over the user-level configuration, and user-level
> configuration taking precedence over the system-level configuration."*

> *"If an array is present in both tables, the arrays will be concatenated, with the project-level
> settings appearing earlier in the merged array."*

> *"Settings provided via environment variables take precedence over persistent configuration, and
> settings provided via the command line take precedence over both."*
> — all three [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

So the full order, highest first:

```text
command-line flag  >  UV_* environment variable  >  project file  >  user uv.toml  >  system uv.toml
```

Scalars take the highest layer's value. **Arrays do not** — they concatenate, project entries first.
That is the right behaviour for a list of indexes (your project's internal index is consulted, and the
user's extra index is still available), and a surprise for anyone who expected the project's list to
*replace* the user's.

## Switching the file layers off

> *"uv accepts a `--no-config` command-line argument which, when provided, disables the discovery of
> any persistent configuration."*

> *"uv also accepts a `--config-file` command-line argument, which accepts a path to a `uv.toml` to use
> as the configuration file. When provided, this file will be used in place of _any_ discovered
> configuration files."*
> — both [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

`--no-config` is the reproducibility switch. With it, only flags and environment variables apply —
things you can see in the CI definition — and nothing a runner image left in `/etc/uv/uv.toml` or a home
directory can change the result. `--config-file` is the opposite tool: point every job at one reviewed
file.

```bash
uv sync --locked --no-config                     # nothing from disk outside the flags
uv sync --locked --config-file ci/uv.toml        # exactly this file, and no other
```

⚠️ Check what `--no-config` removes before adopting it. If the project's own `[tool.uv]` table carries
settings the build needs — an index, sources — "disables the discovery of any persistent configuration"
reads as covering those too; the page does not carve out an exception. Where the project file matters,
`--config-file` pointing at a committed file is the safer lever.

## Two scopes that do not follow the directory you are in

> *"For `tool` commands, which operate at the user level, local configuration files will be ignored."*

> *"In workspaces, uv will begin its search at the workspace root, ignoring any configuration defined in
> workspace members."*
> — both [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

The first is why a project's index does not reach `uvx` ([07d](07d-tools-config-and-choosing.md)). The
second is why a `[tool.uv]` setting in a workspace member does nothing: the whole workspace is
configured from the root, which is consistent with it sharing one lockfile
([10](10-workspaces.md)).

## Gotchas

**★ Symptom: every setting in `[tool.uv]` stopped working after an unrelated commit.**
Cause: the commit added a `uv.toml` to the same directory, and then *"`[tool.uv]` section in the
accompanying `pyproject.toml` will be ignored."* Fix: keep one of the two. To keep `pyproject.toml`:

```bash
git rm uv.toml       # after moving anything it set into [tool.uv]
```

**★ Symptom: `uv lock` produces a different lockfile on one developer's machine.**
Cause: a user-level `~/.config/uv/uv.toml` — an extra index, a resolution setting — is merged into
every command that developer runs, and it is not in the repository. Fix: reproduce without it, then move
anything the project genuinely needs into the project file.

```bash
cat ~/.config/uv/uv.toml                               # what is being merged in?
mv ~/.config/uv/uv.toml ~/.config/uv/uv.toml.off       # take the user layer out
uv lock                                                # does the lock now match everyone else's?
mv ~/.config/uv/uv.toml.off ~/.config/uv/uv.toml
```

**★ Symptom: CI on one runner image behaves differently from CI on another, with the same commit.**
Cause: a system-level `/etc/uv/uv.toml` baked into one image. Fix: make CI independent of anything on
disk outside the repository.

```bash
uv sync --locked --config-file ci/uv.toml
```

**★ Symptom: a user-level config file with a `[tool.uv]` table has no effect.**
Cause: *"User- and system-level configuration files cannot use the `pyproject.toml` format."* Fix:
write the keys at the top level.

```toml
# ~/.config/uv/uv.toml
cache-dir = "/mnt/fast/uv-cache"     # not under [tool.uv]
```

**★ Symptom: a committed project setting is ignored on one machine, with no config file involved.**
Cause: an environment variable in that shell's profile — *"Settings provided via environment variables
take precedence over persistent configuration."* Fix: find and remove the override.

```bash
env | grep '^UV_'
unset UV_PYTHON UV_INDEX_URL UV_DEFAULT_INDEX
```

**Symptom: a `[tool.uv]` setting in a workspace member's `pyproject.toml` does nothing.**
Cause: *"uv will begin its search at the workspace root, ignoring any configuration defined in
workspace members."* Fix: move it to the root.

```toml
# the workspace root's pyproject.toml
[tool.uv]
constraint-dependencies = ["urllib3<3"]
```

**Symptom: packages resolve from the user's extra index before the one you configured, or the other way round.**
Cause: arrays from different layers are *"concatenated, with the project-level settings appearing
earlier in the merged array"* — the user's entries were added, not replaced. Fix: make the project's
intent explicit, and run CI with the user layer out of the picture.

```toml
[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
default = true
```

## Interview questions

**★ In what order does uv apply configuration, and which rule surprises people?**
Command-line flags beat environment variables, which beat persistent files; among files, project beats
user beats system — *"Settings provided via environment variables take precedence over persistent
configuration, and settings provided via the command line take precedence over both."* Two rules
surprise people. Arrays are concatenated rather than overridden, with project entries first, so a
user-level index list adds to the project's instead of being replaced. And within one directory, a
`uv.toml` does not merge with `pyproject.toml` — it wins, and the `[tool.uv]` table is ignored — so
adding a `uv.toml` can switch off every project setting in one commit that never touched them.

**★ How do you make a CI job immune to configuration that is not in the repository?**
Either switch persistent configuration off with `--no-config` — *"disables the discovery of any
persistent configuration"* — or replace it with one committed file via `--config-file`, which *"will be
used in place of _any_ discovered configuration files."* Both remove the user and system layers, which
are exactly the layers a reviewer cannot see: a `/etc/uv/uv.toml` in a runner image, a `~/.config`
someone mounted into a container. Of the two, `--config-file` is usually the better fit when the
project's own table carries settings the build needs, because the documentation's description of
`--no-config` does not exempt the project file. Environment variables still apply either way, so the
job's `env:` block is part of the configuration and belongs in review.

**When would you choose a standalone `uv.toml` over `[tool.uv]` in `pyproject.toml`?**
When there is no `pyproject.toml` to put it in, or when the directory is not a project — a repository of
scripts, a monorepo root that only holds shared settings, a CI directory holding a file passed with
`--config-file`. For a real project, `[tool.uv]` is the better home, because the settings sit next to
the dependencies they change and a reviewer sees both in one diff. The one arrangement to avoid is both
files in the same directory, since *"configuration will be read from `uv.toml`, and `[tool.uv]` section
in the accompanying `pyproject.toml` will be ignored."*

**Why can't a user-level `uv.toml` use the `pyproject.toml` format?**
Because a user or system file is not a project, and the `[tool.uv]` nesting only exists to live inside a
project's metadata file alongside other tools — the packaging specification's `[tool]` table is a
namespace for tools *within `pyproject.toml`*. A file whose whole purpose is uv configuration has no
reason to nest its settings under a namespace, so it uses the flat `uv.toml` form; uv states the rule
plainly: *"User- and system-level configuration files cannot use the `pyproject.toml` format."* The
practical consequence is copy-paste: a snippet from a project needs its `tool.uv` prefix removed before
it works at user level.

**Why does uv ignore configuration in workspace members?**
Because a workspace is resolved as one unit. The members share a single lockfile, so settings that
affect resolution — indexes, constraints, sources — have to be the same for the whole workspace, or the
one lockfile would not have one meaning. uv makes the root the only place those settings can come from:
*"uv will begin its search at the workspace root, ignoring any configuration defined in workspace
members."* The trap is that a member's `pyproject.toml` still looks like a normal project file, with a
`[tool.uv]` table that parses and does nothing.

---

← Prev: [07d · Tools: config and choosing](07d-tools-config-and-choosing.md) · [Topic index](README.md) · Next → [08b · required-version, UV_* and .env](08b-required-version-env-vars-and-dotenv.md)
