---
title: "python -m venv has no --python flag because the interpreter you run it with is the version you get, and the seven flags it does have each solve one specific problem"
sidebar_label: "3 · Creating one with venv"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` — Creation of virtual environments](https://docs.python.org/3.14/library/venv.html)
> (command-line options, `EnvBuilder`, version-changed notes),
> [`ensurepip`](https://docs.python.org/3.14/library/ensurepip.html), and
> [PEP 405](https://peps.python.org/pep-0405/).
> Version spine: **Python 3.14.7**.

**The most common misunderstanding about `python -m venv` is that it takes a
version argument. It does not, and it cannot: the module is part of a specific
interpreter's standard library, and the environment it builds is bound to the
interpreter that ran it. `python3.12 -m venv .venv` makes a 3.12 environment
because `python3.12` ran it, full stop. Everything else on the command line is a
small set of flags, each of which exists because of one concrete failure people
kept hitting, and knowing which failure each one addresses is the difference
between using them and cargo-culting them.**

## The invocation

```text
usage: venv [-h] [--system-site-packages] [--symlinks | --copies] [--clear]
            [--upgrade] [--without-pip] [--prompt PROMPT] [--upgrade-deps]
            [--without-scm-ignore-files]
            ENV_DIR [ENV_DIR ...]
```

The normal case is one line:

```bash
python3.14 -m venv .venv
```

Choosing the version means choosing the interpreter that runs the module:

```bash
python3.12 -m venv .venv                    # POSIX, version-suffixed name
/opt/python/3.13.5/bin/python -m venv .venv # an installation by absolute path
py -3.12 -m venv .venv                      # Windows, via the launcher
uv venv --python 3.12                       # uv does take a version, and will fetch it
```

`ENV_DIR` is positional and accepts more than one path, which is occasionally
handy for building a matrix of identical empty environments, and otherwise a
footgun — every one of them gets the same flags.

## The flags, and the problem each one solves

**`--system-site-packages`** — *"Give the virtual environment access to the
system site-packages directory."* Sets `include-system-site-packages = true` in
`pyvenv.cfg`. Use it only when you need a package that cannot be pip-installed
(distro-built GTK or Qt bindings, a vendor's proprietary module). It leaks in
both directions in ways that are subtle enough to deserve
[chunk 8](08-system-site-packages.md).

**`--symlinks` / `--copies`** — *"Try to use symlinks rather than copies, when
symlinks are not the default for the platform"* and the inverse. The defaults are
already right: symlinks on POSIX, copies on Windows. The one time to reach for
`--copies` on POSIX is when you are about to copy the environment directory into
a container image built `FROM scratch`-ish layers where the symlink target will
not exist — and even then, recreating the environment in the image is the better
answer.

**`--clear`** — *"Delete the contents of the environment directory if it already
exists, before environment creation."* This is the "start over" flag. It deletes
the *contents*, meaning every package you installed. That is the point; just be
aware that `--clear` on a directory you picked by mistake is destructive and
there is no confirmation.

**`--upgrade`** — *"Upgrade the environment directory to use this version of
Python, assuming Python has been upgraded in-place."* Read the second half
carefully. This is for the case where the *base interpreter binary* was upgraded
underneath the environment — a patch release, say 3.14.6 → 3.14.7, installed over
the same path. It re-links the executables and rewrites `pyvenv.cfg`. It does
**not** upgrade the packages inside, and it does not move an environment from
3.13 to 3.14 in any meaningful sense, because `site-packages` is a version-named
directory full of possibly ABI-specific wheels.

**`--without-pip`** — *"Skips installing or upgrading pip in the virtual
environment (pip is bootstrapped by default)."* Two real uses: you are going to
manage the environment entirely with `uv` (which does not need pip in the
target), and you are creating thousands of environments in a test harness where
the `ensurepip` subprocess dominates the runtime.

**`--prompt PROMPT`** — *"Provides an alternative prompt prefix for this
environment."* Without it, every activated `.venv` in every project renders as
the same `(.venv)` in your prompt, which is actively misleading when you have
three terminals open. The special value `.` is documented on the `EnvBuilder`
parameter: *"If the special string `"."` is provided, the basename of the current
directory is used as the prompt."*

```bash
python3.14 -m venv --prompt . .venv       # prompt shows the project directory name
```

**`--upgrade-deps`** — *"Upgrade core dependencies (pip) to the latest version in
PyPI."* Added in 3.9 to upgrade pip and setuptools; since 3.12, *"`setuptools` is
no longer a core venv dependency"*, so today it means pip. The version bundled
with the interpreter is whatever was current when that Python was released, so on
an older point release this flag saves you an immediate `pip install -U pip`.

**`--without-scm-ignore-files`** — added in 3.13, alongside the change that
*"`venv` now creates a `.gitignore` file for Git by default."* The generated file
makes the environment invisible to git without you touching the repository's own
`.gitignore`. Turn it off only if you are generating environments in a directory
where a stray ignore file would confuse tooling.

## What creation actually does

Four steps, in order:

1. Create `ENV_DIR` and its parents.
2. Write `pyvenv.cfg` with `home` pointing at the directory containing the
   interpreter that ran the module, and `include-system-site-packages` set from
   the flag.
3. Create `bin`/`Scripts` with the interpreter links and the activation scripts,
   and `lib/pythonX.Y/site-packages` (`Lib\site-packages` on Windows).
4. Bootstrap pip via `ensurepip`, unless `--without-pip`.

Step 4 is by far the slowest, because it unpacks and installs a wheel through a
subprocess. That is the entire reason `uv venv` and `virtualenv` feel instant by
comparison: neither of them runs `ensurepip` the way the stdlib does.

## The programmatic API

`venv.EnvBuilder` is the class behind the CLI, and it is genuinely useful when a
tool needs to create environments:

```python
import venv

builder = venv.EnvBuilder(
    system_site_packages=False,
    clear=True,
    symlinks=True,
    with_pip=True,
    prompt="myapp",
    upgrade_deps=False,
)
builder.create("/srv/myapp/.venv")
```

Subclassing it and overriding `post_setup(self, context)` is the supported hook
for "create the environment, then install these packages into it" — `context`
carries `env_dir`, `env_exe`, `bin_path` and (since 3.12) `lib_path`, so you have
the paths you need to invoke the new environment's interpreter. There is also a
module-level `venv.create()` for the simple case.

## Gotchas

**Symptom:** `python3 -m venv .venv` fails on Debian or Ubuntu with a message pointing at `ensurepip`
**Cause:** the distro splits the standard library across packages and `ensurepip`'s bundled wheel is not in the base one
**Fix:** `sudo apt install python3-venv` (or `python3-full`), or use `uv venv`, which does not go through `ensurepip` at all. This is the same distro-packaging boundary that produces the PEP 668 error — see [`../04-installing-and-versions/02-responding-to-pep-668.md`](../04-installing-and-versions/02-responding-to-pep-668.md)

**Symptom:** someone runs `python -m venv --python 3.12 .venv` and gets an argument error
**Cause:** there is no such flag. The stdlib module cannot fetch or select an interpreter — it only knows the one it is running under
**Fix:** run the interpreter you want (`python3.12 -m venv`, `py -3.12 -m venv`), or use `uv venv --python 3.12`, which *will* find or download that version

**Symptom:** `python -m venv --upgrade .venv` after installing Python 3.15, expecting the environment to move to 3.15
**Cause:** `--upgrade` is for an in-place upgrade of the *same* installation (a patch release over the same prefix). The environment's `lib/python3.14/site-packages` and any compiled wheels in it are still 3.14's
**Fix:** delete and recreate: `rm -rf .venv && python3.15 -m venv .venv && pip install -r requirements.txt`. Recreation is the documented posture — the environment is *"considered as disposable"*

**Symptom:** `--clear` used to "refresh" an environment and a day of installed work vanishes
**Cause:** it deletes the contents of the directory, which is exactly what it advertises
**Fix:** capture state first (`pip freeze > requirements.txt`) or, better, keep that file as the source of truth so the environment never holds anything you would miss

**Symptom:** a freshly created environment has an old `pip` that warns on every command
**Cause:** `ensurepip` installs the wheel bundled with that interpreter release, which ages
**Fix:** `python -m venv --upgrade-deps .venv` at creation, or `python -m pip install -U pip` after. Do not `pip install -U pip` with the *system* interpreter to try to fix it — that is a different pip entirely

**Symptom:** `pip` inside the environment is missing entirely and every command says "No module named pip"
**Cause:** the environment was created with `--without-pip`, commonly because it was created by `uv venv` (which does not seed pip unless asked)
**Fix:** `python -m ensurepip --upgrade` inside the environment, or `uv venv --seed` when creating it, or simply use `uv pip install`, which does not need pip present in the target

**Symptom:** the shell prompt shows `(.venv)` and you cannot tell which project you are in
**Cause:** the default prompt is the environment directory's name, and everyone names it `.venv`
**Fix:** `--prompt .` at creation time to use the project directory's name instead. It only affects the activation scripts, so it changes nothing else

**Symptom:** creating an environment while another one is activated produces something confusing
**Cause:** the interpreter on `PATH` is the outer environment's, so that is what `-m venv` runs. The documentation does not specify what `home` becomes in the resulting `pyvenv.cfg`, and I could not confirm it from the docs — inspect the file if you end up here
**Fix:** `deactivate` first, then create with an explicit interpreter path. Nested environments have no legitimate use case

**Symptom:** `python -m venv` writes an environment but the `.gitignore` inside it is unexpected in a repository that manages ignores centrally
**Cause:** the 3.13 default — *"`venv` now creates a `.gitignore` file for Git by default"*
**Fix:** `--without-scm-ignore-files`, and add the environment path to the repository's own ignore file instead

## Interview questions

**★ How do you create a virtual environment for a specific Python version with the standard library?**
By running that version's interpreter: `python3.12 -m venv .venv`,
`/path/to/python3.12 -m venv .venv`, or `py -3.12 -m venv .venv` on Windows.
`venv` has no version flag because the module ships inside each interpreter and
binds the environment to the interpreter that executed it. Selecting a version as
an argument is a version-manager's job — `uv venv --python 3.12` will even
download it.

**★ What is the difference between `--clear` and `--upgrade`?**
`--clear` deletes the contents of the environment directory and rebuilds it
empty. `--upgrade` keeps the contents and re-points the environment at the
current interpreter, for the case where the base Python was upgraded in place.
Neither touches the packages' versions: `--clear` removes them, `--upgrade`
leaves them exactly as they were, which is only safe across a patch release.

**★ Why is `python -m venv` noticeably slower than `uv venv` or `virtualenv`?**
Because it bootstraps pip via `ensurepip`, which installs a wheel in a
subprocess. virtualenv's own documentation contrasts its cached "app-data"
seeding against venv, which it describes as *"Slowest (60s+); spawns pip as a
subprocess to seed"*. `uv venv` sidesteps the problem by not putting pip in the
environment at all — `uv pip install` operates on the environment from outside.

**★ When would you use `--system-site-packages`?**
When the environment genuinely needs a module that only exists as a
system-installed, non-pip-installable package — distro-built GUI toolkit
bindings, a hardware vendor's SDK, a system-managed build of a scientific library.
Never as a shortcut to avoid reinstalling dependencies, because it makes the
environment's contents depend on the machine, which is the exact property
environments exist to remove.

**★ What is `EnvBuilder` for?**
For tools that create environments programmatically. It exposes the same options
as the CLI plus a `post_setup(context)` hook that runs after creation, with a
context object carrying `env_dir`, `env_exe`, `bin_path` and `lib_path` — enough
to install packages into the new environment by invoking its interpreter. Test
harnesses, deployment scripts and IDE integrations use it rather than shelling
out to `python -m venv`.

---

← Prev: [How the interpreter finds it](02-how-the-interpreter-finds-it.md) · Index: [Virtual environments](README.md) · Next → [Activation is only PATH](04-activation-is-only-path.md)
