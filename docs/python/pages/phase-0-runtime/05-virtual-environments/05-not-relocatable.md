---
title: "You cannot move a virtual environment, because every console script inside it has an absolute shebang — and the half of it that keeps working after a move is what makes the failure confusing"
sidebar_label: "5 · Venvs are not relocatable"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` docs](https://docs.python.org/3.14/library/venv.html) (the portability
> warning), [PEP 405](https://peps.python.org/pep-0405/) (the landmark search),
> the [binary distribution format specification](https://packaging.python.org/en/latest/specifications/binary-distribution-format/)
> (shebang rewriting), [`site`](https://docs.python.org/3.14/library/site.html)
> (`.pth` files), the Linux
> [`execve(2)` manual page](https://man7.org/linux/man-pages/man2/execve.2.html)
> (the shebang length limit), and the
> [uv environment variable reference](https://docs.astral.sh/uv/reference/environment/)
> (`UV_VENV_RELOCATABLE`).
> Version spine: **Python 3.14.7**.

**A virtual environment is full of absolute paths that were correct at creation
time, and nothing rewrites them when the directory moves. The documentation calls
environments "inherently non-portable" and tells you to recreate rather than
move. What makes this a real trap rather than a rule you can just follow is that
a moved environment does not fail cleanly: `python` usually still works, so the
environment looks alive, while every installed command-line tool in it is broken
and every editable install points into thin air.**

## The warning, verbatim

> *"Because scripts installed in environments should not expect the environment
> to be activated, their shebang lines contain the absolute paths to their
> environment's interpreters. Because of this, environments are inherently
> non-portable, in the general case. You should always have a simple means of
> recreating an environment (for example, if you have a requirements file
> `requirements.txt`, you can invoke `pip install -r requirements.txt` using the
> environment's `pip` to install all of the packages needed by the environment).
> If for any reason you need to move the environment to a new location, you
> should recreate it at the desired location and delete the one at the old
> location. If you move an environment because you moved a parent directory of
> it, you should recreate the environment in its new location. Otherwise,
> software installed into the environment may not work as expected."*

Read the third sentence twice. **Moving a parent directory counts as moving the
environment.** Renaming `~/work/project` to `~/work/project-old` breaks the venv
inside it just as thoroughly as `mv .venv /tmp/` would.

## The four absolute paths, and which survive a move

| Where | What it holds | Survives a move? |
|---|---|---|
| `pyvenv.cfg` → `home` | the **base** installation's bin directory | Yes — the base did not move |
| `.venv/bin/python` symlink | the base interpreter | Yes — same reason |
| Every console script's shebang | `.../old/path/.venv/bin/python` | **No** |
| `.pth` files from editable installs | the absolute path of your source tree | **No**, if the source moved too |

That table is the whole confusion. `sys.prefix` is *computed* at startup from the
path the interpreter was invoked as — that is the landmark search from
[chunk 2](02-how-the-interpreter-finds-it.md) — so it adjusts to the new location
automatically. `home` points at the base installation, which is somewhere else
entirely and unaffected. So:

```bash
mv ~/work/project ~/work/project2
cd ~/work/project2
.venv/bin/python -c "import httpx"       # works — prefix recomputed, packages found
.venv/bin/pytest                          # fails — shebang names the old path
```

An environment in this state passes every check a person casually makes and fails
the moment a tool with an entry point is invoked. Worse, if the *old* path still
exists (you copied rather than moved), the console scripts run happily against
the **old** environment, and you get results from packages you did not think you
were using.

## The other absolute path: editable installs

An editable install (`pip install -e .`, or `uv sync` on a project) does not copy
your code into `site-packages`. It writes a `.pth` file there containing a path,
or an import hook that knows one. The `site` docs describe the mechanism:

> *"A path configuration file is a file whose name has the form `_name_.pth` and
> exists in one of the site-packages directories. Its contents are additional
> items (one per line) to be added to `sys.path`."*

and

> *"Non-existing items are never added to `sys.path`."*

That second sentence is the failure mode: move the project and the `.pth` entry
silently stops contributing. There is no error, no warning — your own package
just stops being importable, which reads exactly like a broken install.

## The shebang length limit

There is a second, sharper edge on POSIX. The kernel truncates the `#!` line:

> *"Before Linux 5.1, the limit is 127 characters. Since Linux 5.1, the limit is
> 255 characters."*

A deeply nested checkout — CI runners and Jenkins workspaces are notorious —
can push `#!/very/long/path/.venv/bin/python` past that limit. The line is
truncated, the truncated path does not exist, and the script fails to execute
with the shell reporting that the interpreter cannot be found. Nothing about the
message points at length.

Two things make this survivable:

```bash
# 1. Bypass the shebang entirely: the interpreter is an argument, not an exec header
.venv/bin/python -m pytest

# 2. Keep environments shallow. ~/.venvs/<project> instead of a path
#    six directories deep inside a workspace.
```

## What to do instead of moving

**Recreate, from a declarative source of truth.**

```bash
# Old machine / old path
.venv/bin/python -m pip freeze > requirements.txt

# New location
rm -rf /new/path/.venv
python3.14 -m venv /new/path/.venv
/new/path/.venv/bin/python -m pip install -r requirements.txt
```

or, with a project that has a lockfile, the whole procedure is one command:

```bash
uv sync            # creates .venv here and installs exactly what uv.lock names
```

**If you must repair rather than recreate**, reinstalling the packages rewrites
the shebangs, because the installer regenerates the console scripts against the
interpreter it is currently running under:

```bash
/new/path/.venv/bin/python -m pip install --force-reinstall -r requirements.txt
```

This fixes entry points and re-lays editable installs. It does not fix anything
that hardcoded a path in its own configuration, which is why recreation remains
the recommended move.

**If you control the tooling, uv can build a relocatable environment.** The uv
reference documents `UV_VENV_RELOCATABLE`: *"If set, the virtual environment will
be relocatable."*

```bash
uv venv --relocatable .venv
```

This changes how the environment's entry-point scripts locate their interpreter
so the directory can be moved. It is a uv feature, not a `venv` one — an
environment created by `python -m venv` gains nothing from the flag's existence,
and a relocatable environment is still bound to the base interpreter that `home`
names.

## Copying an environment *is* moving it

Every one of these is the same operation as far as the shebangs are concerned:

- `cp -r .venv /elsewhere/`
- committing `.venv` to git and checking it out on another machine
- `docker COPY .venv` into an image at a different path
- rsyncing a deployment directory to a server with a different layout
- a backup tool restoring a home directory to a new username
- Dropbox/OneDrive syncing a project folder between two machines

The one case that works — and it works precisely because it is *not* a move — is
copying a venv between Docker build stages **to the identical absolute path**,
where the base interpreter also exists at the identical path. That pattern is in
[chunk 11](11-editors-ci-and-docker.md), and it is worth knowing exactly why it is
the exception: nothing in the environment ever refers to a path that changed.

## Gotchas

**Symptom:** after renaming a project directory, `python` in the venv works but `pytest`, `black` and `alembic` do not
**Cause:** `sys.prefix` is recomputed from the invocation path, so the interpreter adapts; console-script shebangs are literal text written at install time and do not
**Fix:** recreate the environment, or `--force-reinstall` the requirements so the scripts are regenerated. Do not conclude the environment is fine because `python` started

**Symptom:** you copy a project (leaving the original in place) and the copy's tools silently operate on the original's environment
**Cause:** the copied console scripts still name the original absolute interpreter path, which still exists
**Fix:** recreate the environment in the copy immediately. This one is dangerous precisely because nothing errors — check with `head -1 .venv/bin/pytest`

**Symptom:** an editable-installed package stops importing after moving the repository, with no error at install time because nothing was installed
**Cause:** the `.pth` entry names a directory that no longer exists, and *"non-existing items are never added to `sys.path`"*
**Fix:** re-run `pip install -e .` (or `uv sync`) from the new location

**Symptom:** on a CI runner, scripts in a venv fail with the shell claiming the interpreter does not exist, though the file is plainly there
**Cause:** the shebang exceeded the kernel's `#!` line limit (127 characters before Linux 5.1, 255 after) and was truncated
**Fix:** shorten the path to the environment, or invoke through `python -m <tool>`, which never involves a shebang

**Symptom:** someone "fixes" a moved venv with `sed -i` across `bin/`
**Cause:** it does patch the shebangs, so it appears to work
**Fix:** it is fine as an emergency measure and wrong as a habit — it misses `.pth` files, any package that recorded a path in its own data, and `RECORD` metadata. Prefer `--force-reinstall`; prefer recreation over both

**Symptom:** a venv is created with `--copies` in the belief it will make the environment portable
**Cause:** `--copies` only affects whether the interpreter in `bin/` is a copy or a symlink. It has no effect on the shebangs of installed scripts, which are the actual obstacle
**Fix:** nothing makes a stdlib venv portable. Use `uv venv --relocatable`, or recreate

**Symptom:** a home directory restored under a new username has hundreds of broken environments
**Cause:** `/home/old/...` appears in every shebang across every environment
**Fix:** recreate them from their requirement files. If you have ever wondered why the docs insist you *"always have a simple means of recreating an environment"*, this is the day it pays for itself

**Symptom:** a venv shared over a network mount between machines with different mount points works on one and not the other
**Cause:** same absolute-path problem, expressed through the mount table
**Fix:** one environment per machine. Environments are cheap; a lockfile makes them identical without sharing bytes

## Interview questions

**★ Can you move a virtual environment to a different directory?**
No. The documentation calls environments *"inherently non-portable"* and says to
recreate at the destination and delete the original. The reason is that installed
console scripts have shebang lines containing the absolute path to the
environment's interpreter, written at install time, and nothing rewrites them.
Editable installs add a second class of absolute path, in `.pth` files.

**★ Then why does `python` still work after you move a venv?**
Because `sys.prefix` is not stored anywhere — it is derived at startup from the
directory of the executable path you invoked, by finding `pyvenv.cfg` next to it
or one level above. That search adapts to the new location automatically, and
`pyvenv.cfg`'s `home` key points at the base installation, which did not move. So
the interpreter and the imports work while the entry points do not, which is the
worst possible mixture for diagnosis.

**★ What are the correct responses to needing an environment somewhere else?**
Recreate it from `requirements.txt`, a lockfile or `pyproject.toml` — the whole
reason to keep one of those. If repairing in place is unavoidable, reinstall the
packages with `--force-reinstall` so the entry points are regenerated with
correct shebangs. If you control the tooling, `uv venv --relocatable` produces an
environment designed to survive relocation.

**★ Why can a container image copy a venv from one build stage to another?**
Because it is not a move: the environment is copied to the identical absolute
path, and the base interpreter exists at the identical path in the final image.
Every absolute reference inside the environment is still correct. Change the
`WORKDIR`, the target path, or the base image's Python location and the pattern
collapses.

**★ What is the shebang length limit and when does it actually bite?**
`execve(2)` documents 127 characters before Linux 5.1 and 255 since. It bites on
CI runners and build systems with deeply nested workspace directories, where the
path to `.venv/bin/python` alone can exceed it. The failure looks like a missing
interpreter, not a length problem. Running tools as `python -m tool` avoids the
shebang path entirely.

---

← Prev: [Activation is only PATH](04-activation-is-only-path.md) · Index: [Virtual environments](README.md) · Next → [When the base interpreter moves](06-when-the-base-interpreter-moves.md)
