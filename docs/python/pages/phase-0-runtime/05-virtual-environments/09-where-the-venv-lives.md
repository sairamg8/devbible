---
title: "Call it .venv, put it in the project root, keep it out of git and out of your Docker build context — every other choice costs you something specific"
sidebar_label: "9 · Where the venv lives"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` docs](https://docs.python.org/3.14/library/venv.html) (the conventions
> list, `--without-scm-ignore-files`, the 3.13 `.gitignore` change),
> the [uv environment variable reference](https://docs.astral.sh/uv/reference/environment/)
> (`UV_PROJECT_ENVIRONMENT`), the
> [VS Code Python environments documentation](https://code.visualstudio.com/docs/python/environments)
> (workspace discovery), and
> [pytest's import-mechanisms explanation](https://docs.pytest.org/en/stable/explanation/pythonpath.html).
> Version spine: **Python 3.14.7**.

**The location of a virtual environment is a boring decision with a surprising
number of ways to get it wrong, because the directory is large, full of absolute
paths, full of files that look like source code to any tool that walks a tree,
and worthless to anybody but the machine that created it. The convention —
`.venv` in the project root, ignored by git and by every build context — exists
because each of the alternatives breaks something concrete.**

## The convention, and where it comes from

The `venv` documentation states both halves:

> *"Contained in a directory, conventionally named `.venv` or `venv` in the
> project directory, or under a container directory for lots of virtual
> environments, such as `~/.virtualenvs`."*
>
> *"Not checked into source control systems such as Git."*

Between `.venv` and `venv`, choose `.venv`. It is what `uv venv` creates by
default, what `uv run` and `uv pip` discover, and what VS Code searches for — the
extension *"searches your entire workspace for virtual environments using the
glob pattern `./**/.venv`"*. Picking the name the ecosystem already looks for
removes an entire category of configuration.

Being hidden is not cosmetic: it keeps the environment out of shell globs, out of
casual `ls`, and out of a lot of naive directory walks.

## In the project, or in a central directory?

**In the project (`./.venv`)** — the default answer.

- The environment is found automatically by uv, VS Code, PyCharm and most other
  tooling.
- Deleting the project deletes the environment; nothing is orphaned.
- Relative invocation works from the project root: `.venv/bin/python`.
- Costs: it sits inside anything that copies the project — build contexts,
  archives, file-sync tools. That is the whole risk, and it is manageable with
  ignore files.

**In a central directory (`~/.venvs/<project>`)** — the right answer in three
specific cases.

- The project directory is synced by Dropbox, OneDrive or iCloud. Thousands of
  small files, constantly rewritten, is the worst possible sync workload, and a
  partially-synced environment is a genuinely confusing thing to debug.
- The project lives on a network filesystem or a VM shared folder, where
  per-file latency makes installs and imports slow, and where symlink support may
  be absent.
- You keep several environments per project (multiple Python versions), in which
  case name them explicitly: `~/.venvs/proj-3.13`, `~/.venvs/proj-3.14`.

With uv, express the choice once rather than in every command:

```bash
export UV_PROJECT_ENVIRONMENT="$HOME/.venvs/myproject"
```

documented as *"specifies the path to the directory to use for a project virtual
environment"*.

## Keeping it out of everything that copies files

Source control is the famous one, and since 3.13 it is handled for you: *"`venv`
now creates a `.gitignore` file for Git by default"*, so a fresh environment is
invisible to git without touching the repository's own ignore rules. (Suppress it
with `--without-scm-ignore-files` if your repository manages ignores centrally.)

The one that actually bites in production is **`.dockerignore`**, because it is
not handled for you:

```text
# .dockerignore
.venv/
__pycache__/
*.pyc
.git/
```

Without that line, `COPY . .` drags your host's environment into the image. The
image then contains an environment whose shebangs point at your laptop's paths
and whose compiled extensions may be for another platform entirely, layered
underneath whatever the Dockerfile installs. The symptom is an image that is
inexplicably large and behaves differently from a clean build.

The same reasoning applies to every other copy mechanism: `.gcloudignore`,
serverless deployment excludes, `rsync --exclude=.venv`, `tar --exclude`, and the
"files to package" list in any build backend.

## Keep it out of tools that walk the tree

An environment contains tens of thousands of `.py` files that are not yours. Any
tool that recurses will find them:

- **pytest** collecting tests from inside `site-packages` — pytest's own
  documentation covers how its import modes and `rootdir` interact with
  `sys.path`, and the practical rule is to give it a `testpaths` setting or an
  explicit directory argument rather than letting it walk from the root.
- **Linters and type checkers** — `ruff`, `mypy` and friends default to excluding
  common environment directory names, but only the common ones. A `venv-3.14`
  will be scanned unless you say otherwise.
- **`grep -r` and editor search** — a dot-prefixed name keeps it out of many
  defaults, which is a small daily saving.
- **Watchers and reloaders** — a file watcher on the project root that includes
  the environment will burn CPU and can hit inotify limits.

## Names to avoid, and why

| Name | Problem |
|---|---|
| `env` | collides with the common `env/` directory for environment config; too generic to ignore safely |
| `venv` | fine, but not hidden and not what uv or VS Code look for first |
| `.env` | **actively wrong** — that name is the de facto standard for a dotenv *file* of secrets, and tooling will try to parse the directory |
| `virtualenv` | long, and implies the third-party tool made it |
| any name inside the package directory | it becomes part of the importable tree and can be picked up by packaging globs |

## Multiple environments for one project

Testing across interpreter versions is a real need and the answer is a tool, not
a naming scheme:

```bash
uv run --python 3.13 pytest
uv run --python 3.14 pytest
# or nox / tox, which create and manage one environment per session
```

Hand-managed parallel environments (`.venv313`, `.venv314`) work, but every
command then needs the right prefix and it is only a matter of time before
someone installs into the wrong one.

## Gotchas

**Symptom:** a Docker image is hundreds of megabytes larger than expected and fails with import or architecture errors
**Cause:** `COPY . .` with no `.dockerignore`, so the host's `.venv` is inside the image — including compiled extensions for the host platform and shebangs pointing at host paths
**Fix:** add `.venv/` to `.dockerignore`, and build the environment inside the image. This is the single highest-value line in the file

**Symptom:** a project directory in Dropbox or OneDrive syncs constantly and environments break in odd, partial ways
**Cause:** an environment is thousands of small files and symlinks, which sync clients handle slowly and sometimes incorrectly — a symlink replaced by a copy, or a half-uploaded `site-packages`
**Fix:** move the environment outside the synced tree (`UV_PROJECT_ENVIRONMENT`, or a `~/.venvs/<project>` path), or exclude it in the sync client. Never sync an environment between machines — it is not portable anyway ([chunk 5](05-not-relocatable.md))

**Symptom:** `pytest` collects and fails on tests belonging to installed third-party packages
**Cause:** collection started at a directory that contains the environment
**Fix:** set `testpaths` in your configuration, or pass the test directory explicitly. The environment should never be inside the collected tree

**Symptom:** creating a venv on a Windows drive from inside WSL fails or produces something broken
**Cause:** the `/mnt/c` filesystem does not provide the POSIX semantics (symlinks, permission bits) the Linux interpreter expects
**Fix:** keep both the project and its environment on the Linux filesystem. Crossing the boundary costs correctness as well as speed

**Symptom:** a path with spaces or non-ASCII characters produces console scripts that will not execute
**Cause:** shebang handling across kernels and shells is not uniform for unusual paths, and the interpreter path is embedded literally
**Fix:** keep environment paths plain ASCII and space-free. If you cannot, invoke tools as `python -m tool`, which never touches a shebang

**Symptom:** an environment ends up committed despite the 3.13 automatic ignore file
**Cause:** somebody ran `git add -f`, or the environment predates 3.13, or it was created by a tool that does not write the ignore file
**Fix:** `git rm -r --cached .venv` and add it to the repository's `.gitignore` as well. Belt and braces: the generated file inside the environment protects new environments, not old commits

**Symptom:** two projects accidentally share one environment and a dependency upgrade for one breaks the other
**Cause:** a central environment reused across projects, usually because activation is manual and nobody noticed
**Fix:** one environment per project, always. They cost seconds to create and the isolation is the entire point

**Symptom:** disk fills up and nobody knows where the space went
**Cause:** dozens of forgotten environments in old project directories
**Fix:** they are disposable by design — `find ~/code -maxdepth 3 -type d -name .venv` and delete freely. Anything you cannot recreate from a requirements file or lockfile was not safe to depend on in the first place

**Symptom:** a build backend packages the environment into an sdist or wheel
**Cause:** the environment sits inside a directory the backend's include patterns cover
**Fix:** keep the environment out of the package directory, and confirm with the backend's file-listing command before publishing

## Interview questions

**★ Where should a virtual environment live, and what should it be called?**
`.venv` in the project root, in almost all cases. The documentation names `.venv`
or `venv` in the project directory, or a container directory such as
`~/.virtualenvs`, as the conventions. `.venv` wins on tooling: uv creates and
discovers it by default and VS Code globs for it. The exceptions are synced
directories, network filesystems and multi-version setups, where a path outside
the project is better.

**★ Why is a virtual environment never committed to source control?**
Because it is machine-specific and worthless elsewhere: absolute paths in every
console script's shebang, a `pyvenv.cfg` pointing at a base installation that
does not exist on other machines, and platform-specific compiled extensions. It
is also large and changes constantly. The reproducible artifact is the
requirements file or lockfile, which is small, textual and reviewable.

**★ What is the most expensive omission from a `.dockerignore`?**
`.venv/`. Without it, `COPY . .` copies the host's environment into the image,
adding size, host-specific shebangs and possibly wrong-architecture binaries,
which then interact with whatever the Dockerfile installs. It is a quiet failure —
the image builds, it is just wrong.

**★ Why does the environment's location matter to test and lint runs?**
Because those tools walk directory trees, and an environment is tens of thousands
of Python files that are not yours. Left inside the collected tree, pytest can
collect third-party tests and linters can spend minutes on `site-packages`.
Keeping the environment at a predictable, hidden, ignorable path is what makes
default tool configurations behave.

**★ Since Python 3.13, what does `venv` do about source control by default?**
It writes a `.gitignore` inside the created environment so that git ignores it
without any change to the repository's own ignore file, and `--without-scm-ignore-files`
opts out. It protects new environments only — anything already committed still
has to be removed from the index by hand.

---

← Prev: [--system-site-packages](08-system-site-packages.md) · Index: [Virtual environments](README.md) · Next → [venv, virtualenv and conda](10-venv-virtualenv-conda.md)
